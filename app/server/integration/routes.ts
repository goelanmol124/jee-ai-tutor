/**
 * Pilot API routes — mounted from app/server/index.ts.
 */
import type { Express, Request, Response } from 'express';
import type { QuestionNode } from '../../src/domain/types.ts';
import { buildParentProgressSummary, parentMayViewFullTranscript } from '../pilot/parentProgress.ts';
import { LaunchGateError, assertLaunchGatesOrThrow, evaluateLaunchGates } from '../pilot/launchGates.ts';
import { assertTutoringEligible, HoldoutLeakError } from '../pilot-study/index.ts';
import { emptyReviewBudgetState, DEFAULT_STRETCH_PRIOR } from '../learner/index.ts';
import type { TelemetryEvent } from '../telemetry/types.ts';
import { preparePhotoDiagnosis, type CapturePageClient } from './diagnosisBridge.ts';
import {
  joinPilot,
  parseJoinRequest,
  requireActiveProcessing,
  requireSession,
} from './joinService.ts';
import {
  currentLaunchChecklist,
  getHoldoutBank,
  getPilotStores,
  getStudentProfile,
  ingestTelemetryEvents,
  persistPilotStores,
  recordDispute,
  getLaunchConfig,
} from './pilotRuntime.ts';
import { logServerError, safeErrorBody, SafeApiError } from './safeErrors.ts';

function bearerToken(req: Request): string | undefined {
  const header = req.header('authorization') ?? req.header('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice(7).trim();
  const body = req.body as { sessionToken?: unknown } | undefined;
  if (typeof body?.sessionToken === 'string') return body.sessionToken;
  if (typeof req.header('x-session-token') === 'string') return req.header('x-session-token')!;
  return undefined;
}

function sendSafe(res: Response, error: unknown, scope: string): void {
  logServerError(scope, error);
  if (error instanceof LaunchGateError) {
    res.status(503).json({
      ok: false,
      code: 'launch_gate',
      error: 'Pilot launch configuration incomplete.',
      details: { missing: error.missing.map((m) => m.key) },
    });
    return;
  }
  if (error instanceof HoldoutLeakError) {
    res.status(403).json({
      ok: false,
      code: 'holdout_ineligible',
      error: 'This item is reserved for assessment and cannot be used in tutoring.',
    });
    return;
  }
  const body = safeErrorBody(error);
  const status = error instanceof SafeApiError ? error.status : 500;
  res.status(status).json(body);
}

export function mountPilotRoutes(app: Express): void {
  app.get('/api/pilot/launch-checklist', async (_req, res) => {
    try {
      const checklist = currentLaunchChecklist();
      const gates = evaluateLaunchGates(getLaunchConfig());
      res.json({
        ok: true,
        checklist,
        launchGates: gates,
        softwareReadyPrivatePilot: checklist.softwareReady,
        fieldPilotComplete: false,
      });
    } catch (error) {
      sendSafe(res, error, 'launch-checklist');
    }
  });

  app.post('/api/auth/join', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const parsed = parseJoinRequest(req.body);
      const result = joinPilot(stores, parsed);
      res.json(result);
    } catch (error) {
      sendSafe(res, error, 'auth/join');
    }
  });

  app.post('/api/session/start', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      requireActiveProcessing(stores, session.studentId);

      const profile = getStudentProfile(stores, session.studentId);
      if (!profile.cohort) {
        throw new SafeApiError(
          'cohort_required',
          'Explicit cohort is required before starting a pilot session.',
          400,
        );
      }

      // Soft check: launch gates visible but development may proceed.
      try {
        assertLaunchGatesOrThrow(getLaunchConfig());
      } catch (err) {
        if (err instanceof LaunchGateError) {
          // Strict modes already throw via join; development surfaces blockers.
          res.status(200).json({
            ok: true,
            mode: 'next_question',
            studentId: session.studentId,
            sessionId: session.sessionId,
            cohort: profile.cohort,
            enrollmentState: session.enrollmentState,
            launchGateWarnings: err.missing.map((m) => m.key),
          });
          return;
        }
        throw err;
      }

      res.json({
        ok: true,
        mode: 'next_question',
        studentId: session.studentId,
        sessionId: session.sessionId,
        cohort: profile.cohort,
        enrollmentState: session.enrollmentState,
      });
    } catch (error) {
      sendSafe(res, error, 'session/start');
    }
  });

  app.get('/api/tutor/context', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      const profile = getStudentProfile(stores, session.studentId);
      if (!profile.cohort) {
        throw new SafeApiError('cohort_required', 'Explicit cohort is required.', 400);
      }
      res.json({
        ok: true,
        studentId: session.studentId,
        cohort: profile.cohort,
        language: profile.language,
        nickname: profile.nickname,
        reviewBudget: emptyReviewBudgetState(),
        stretchPrior: DEFAULT_STRETCH_PRIOR,
        prereqAnnotations: [],
        holdoutBankVersion: getHoldoutBank().bankVersion,
        enrollmentState: session.enrollmentState,
      });
    } catch (error) {
      sendSafe(res, error, 'tutor/context');
    }
  });

  app.post('/api/diagnosis/prepare', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      requireActiveProcessing(stores, session.studentId);

      const body = req.body as {
        question?: QuestionNode;
        pages?: unknown[];
        typedWork?: string;
        correctionNote?: string;
        readbackConfirmed?: boolean;
      };
      if (!body.question || typeof body.question !== 'object') {
        throw new SafeApiError('bad_request', 'question is required.', 400);
      }
      const pagesRaw = Array.isArray(body.pages) ? body.pages : [];
      const pages: CapturePageClient[] = pagesRaw.map((p, i) => {
        const row = p as Record<string, unknown>;
        const hint = row.clientReadableHint;
        let clientReadableHint: CapturePageClient['clientReadableHint'];
        if (
          hint === 'readable'
          || hint === 'blurry'
          || hint === 'glare'
          || hint === 'cropped'
          || hint === 'unknown'
        ) {
          clientReadableHint = hint;
        }
        return {
          id: typeof row.id === 'string' ? row.id : `p${i + 1}`,
          pageNumber:
            typeof row.pageNumber === 'number' ? row.pageNumber : i + 1,
          previewUrl: typeof row.previewUrl === 'string' ? row.previewUrl : undefined,
          fileName: typeof row.fileName === 'string' ? row.fileName : undefined,
          clientReadableHint,
        };
      });

      const result = preparePhotoDiagnosis(stores, {
        studentId: session.studentId,
        question: body.question,
        pages,
        typedWork: typeof body.typedWork === 'string' ? body.typedWork : undefined,
        correctionNote:
          typeof body.correctionNote === 'string' ? body.correctionNote : undefined,
        readbackConfirmed: body.readbackConfirmed === true,
        liveModelPath: true,
      });
      persistPilotStores(stores);
      res.json(result);
    } catch (error) {
      sendSafe(res, error, 'diagnosis/prepare');
    }
  });

  app.post('/api/feedback/dispute', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      const body = req.body as {
        diagnosisId?: string;
        questionId?: string;
        note?: string;
      };
      if (!body.diagnosisId || !body.questionId) {
        throw new SafeApiError('bad_request', 'diagnosisId and questionId are required.', 400);
      }
      const disputeId = recordDispute(stores, {
        studentId: session.studentId,
        diagnosisId: body.diagnosisId,
        questionId: body.questionId,
        note: typeof body.note === 'string' ? body.note.slice(0, 500) : undefined,
      });
      persistPilotStores(stores);
      res.json({ ok: true, disputeId, queuedForReview: true });
    } catch (error) {
      sendSafe(res, error, 'feedback/dispute');
    }
  });

  app.get('/api/parent/summary', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      const profile = getStudentProfile(stores, session.studentId);
      const summary = buildParentProgressSummary(stores, session.studentId);
      // Frontend-bounded shape — never include transcript.
      res.json({
        ok: true,
        studentNickname: profile.nickname || 'Student',
        consentStatus:
          summary.accountStatus === 'active'
            ? 'active'
            : summary.accountStatus === 'withdrawn'
              ? 'withdrawn'
              : 'pending',
        independentlyCompleted: summary.independentlyCompletedQuestions,
        successfullyRescued: summary.questionsSuccessfullyRescued,
        repeatedErrorCategoriesDeclining:
          summary.repeatedErrorCategoriesDeclining.length > 0,
        delayedReviewRetentionNote:
          summary.delayedReviewRetention == null
            ? 'Review retention appears after a few spaced sessions.'
            : `Delayed review retention: ${summary.delayedReviewRetention}`,
        pastSelfTrendNote:
          summary.pastSelfTrends.length === 0
            ? 'Past-self trends unlock after repeat practice on similar ideas.'
            : summary.pastSelfTrends.map((t) => `${t.label}: ${t.direction}`).join('; '),
        lastActiveAt: new Date().toISOString(),
        transcriptAvailable: parentMayViewFullTranscript(),
        readinessRankShown: false as const,
        accountStatus: summary.accountStatus,
      });
    } catch (error) {
      sendSafe(res, error, 'parent/summary');
    }
  });

  app.post('/api/telemetry/ingest', async (req, res) => {
    try {
      const stores = await getPilotStores();
      const session = requireSession(stores, bearerToken(req));
      const body = req.body as { events?: unknown };
      const rawEvents = Array.isArray(body.events) ? body.events : [];
      const events: TelemetryEvent[] = [];
      for (const item of rawEvents) {
        if (!item || typeof item !== 'object') continue;
        const e = item as Record<string, unknown>;
        if (typeof e.eventId !== 'string' || typeof e.type !== 'string') continue;
        if (typeof e.clientAt !== 'string') continue;
        events.push({
          eventId: e.eventId,
          studentId: session.studentId,
          sessionId: session.sessionId,
          type: e.type as TelemetryEvent['type'],
          clientAt: e.clientAt,
          visible: e.visible === true,
          context: (typeof e.context === 'string' ? e.context : 'product') as TelemetryEvent['context'],
          eventVersion: 'foreground_heartbeat_v1',
        });
      }
      const result = ingestTelemetryEvents(stores, events);
      persistPilotStores(stores);
      res.json({
        ok: true,
        accepted: result.accepted,
        activeTime: result.activeTime
          ? {
              algorithmVersion: result.activeTime.algorithmVersion,
              totals: result.activeTime.totals,
              telemetryStatus: result.activeTime.telemetryStatus,
            }
          : null,
      });
    } catch (error) {
      sendSafe(res, error, 'telemetry/ingest');
    }
  });

  /** Holdout eligibility check for a candidate question id. */
  app.post('/api/pilot/holdout-check', async (req, res) => {
    try {
      const stores = await getPilotStores();
      requireSession(stores, bearerToken(req));
      const questionId =
        typeof (req.body as { questionId?: unknown })?.questionId === 'string'
          ? (req.body as { questionId: string }).questionId
          : '';
      if (!questionId) {
        throw new SafeApiError('bad_request', 'questionId is required.', 400);
      }
      assertTutoringEligible(getHoldoutBank(), questionId);
      res.json({ ok: true, eligible: true });
    } catch (error) {
      sendSafe(res, error, 'holdout-check');
    }
  });
}
