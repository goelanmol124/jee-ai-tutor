/**
 * Join / enrollment orchestration for the pilot API.
 * Requires explicit cohort; never invents parent verification.
 */
import type { PilotStoreBundle } from '../pilot/db.ts';
import {
  acknowledgeAdultNotice,
  ALL_PURPOSES,
  isProcessingAllowed,
  recordGranularConsent,
  type PurposeDecision,
} from '../pilot/consent.ts';
import {
  ensureInviteWithCode,
  getEnrollmentState,
  redeemEnrollmentInvite,
  resolveSessionToken,
} from '../pilot/identity.ts';
import { assertLaunchGatesOrThrow, resolveRuntimeMode } from '../pilot/launchGates.ts';
import type { AgeBand, EnrollmentState } from '../pilot/types.ts';
import { SafeApiError } from './safeErrors.ts';
import {
  getLaunchConfig,
  persistPilotStores,
  upsertStudentProfile,
  type PilotCohort,
} from './pilotRuntime.ts';

const NOTICE = 'pilot-notice-v1';
const RETENTION = 'retention-v1';

export type JoinRequest = {
  inviteCode: string;
  nickname: string;
  cohort: PilotCohort;
  language: 'english' | 'roman_hinglish';
  ageBand: AgeBand;
  /** When true, adults complete notice+consent in the same request (onboarding checkbox). */
  acceptNotices?: boolean;
  /** Photo diagnosis purpose — must be explicit; default denied. */
  grantPhotoDiagnosis?: boolean;
};

export type JoinResponse = {
  ok: true;
  studentId: string;
  sessionToken: string;
  sessionId: string;
  enrollmentState: EnrollmentState;
  ageBand: AgeBand;
  cohort: PilotCohort;
  processingAllowed: boolean;
  blockers?: string[];
};

function isCohort(value: unknown): value is PilotCohort {
  return value === 'class_11' || value === 'class_12' || value === 'dropper';
}

function purposeDecisions(grantPhoto: boolean): PurposeDecision[] {
  return ALL_PURPOSES.map((purpose) => ({
    purpose,
    decision:
      purpose === 'account_tutor_operation' ||
      (grantPhoto && purpose === 'transient_photo_diagnosis')
        ? ('granted' as const)
        : ('denied' as const),
  }));
}

export function parseJoinRequest(body: unknown): JoinRequest {
  if (!body || typeof body !== 'object') {
    throw new SafeApiError('bad_request', 'Join body is required.', 400);
  }
  const raw = body as Record<string, unknown>;
  if (!isCohort(raw.cohort)) {
    throw new SafeApiError(
      'cohort_required',
      'Explicit cohort is required (class_11, class_12, or dropper).',
      400,
    );
  }
  const nickname = typeof raw.nickname === 'string' ? raw.nickname.trim() : '';
  if (!nickname) {
    throw new SafeApiError('bad_request', 'Nickname is required.', 400);
  }
  const inviteCode = typeof raw.inviteCode === 'string' ? raw.inviteCode.trim() : '';
  if (!inviteCode) {
    throw new SafeApiError('bad_request', 'Invite code is required.', 400);
  }
  const language =
    raw.language === 'roman_hinglish' || raw.language === 'english'
      ? raw.language
      : null;
  if (!language) {
    throw new SafeApiError('bad_request', 'Preferred language is required.', 400);
  }
  const ageBand =
    raw.ageBand === 'under_18' || raw.ageBand === '18_plus' ? raw.ageBand : null;
  if (!ageBand) {
    throw new SafeApiError('bad_request', 'Age band is required (under_18 or 18_plus).', 400);
  }
  return {
    inviteCode,
    nickname,
    cohort: raw.cohort,
    language,
    ageBand,
    acceptNotices: raw.acceptNotices === true,
    grantPhotoDiagnosis: raw.grantPhotoDiagnosis === true,
  };
}

export function joinPilot(stores: PilotStoreBundle, req: JoinRequest): JoinResponse {
  const mode = resolveRuntimeMode(getLaunchConfig());
  // Production / pilot_production: hard-fail missing launch gates before enrollment.
  assertLaunchGatesOrThrow(getLaunchConfig());

  const actor = req.ageBand === '18_plus' ? 'self_adult' : 'parent_guardian';
  let redeemed;
  try {
    // Development/test may bootstrap (and reuse) an invite with the supplied code.
    // Production requires a pre-issued active invite.
    if (mode === 'development' || mode === 'test') {
      ensureInviteWithCode(stores.identityConsent, req.inviteCode, {
        kind: 'enrollment',
        cohort: req.cohort,
        reactivateConsumed: true,
      });
    }

    redeemed = redeemEnrollmentInvite(stores.identityConsent, req.inviteCode, {
      ageBand: req.ageBand,
      actor,
      cohort: req.cohort,
    });
  } catch (err) {
    if (err instanceof SafeApiError) throw err;
    const message = err instanceof Error ? err.message : 'Join failed';
    if (message.includes('Invite')) {
      throw new SafeApiError(
        'not_found',
        'Invite not found or already used. In local dev, retry with the same code — it will be reactivated.',
        404,
      );
    }
    if (message.includes('Under-18') || message.includes('Adult enrollment')) {
      throw new SafeApiError('forbidden', message, 403);
    }
    throw new SafeApiError('bad_request', 'Could not complete enrollment.', 400);
  }

  // Binding: never silently default missing cohort — we required it above and stored it.
  upsertStudentProfile(stores, redeemed.studentId, {
    nickname: req.nickname,
    language: req.language,
  });

  let enrollmentState = redeemed.enrollmentState;
  const blockers: string[] = [];

  if (req.ageBand === '18_plus' && req.acceptNotices) {
    acknowledgeAdultNotice(stores.identityConsent, redeemed.studentId, NOTICE);
    const { enrollmentState: next } = recordGranularConsent(stores.identityConsent, {
      studentId: redeemed.studentId,
      actorRole: 'adult_participant',
      noticeVersion: NOTICE,
      retentionVersion: RETENTION,
      dataCategories: ['learning_state', 'transcripts', 'transient_photos'],
      processorList: ['model_provider'],
      purposes: purposeDecisions(Boolean(req.grantPhotoDiagnosis)),
    });
    enrollmentState = next;
  } else if (req.ageBand === 'under_18') {
    blockers.push(
      'Parent verification is required before tutoring. Verification provider is a configuration blocker — not inventable in software.',
    );
    const state = getEnrollmentState(stores.identityConsent, redeemed.studentId);
    if (state === 'parent_verification_pending' || state === 'parent_verification_blocked') {
      enrollmentState = state;
    }
  }

  persistPilotStores(stores);

  return {
    ok: true,
    studentId: redeemed.studentId,
    sessionToken: redeemed.sessionToken,
    sessionId: redeemed.sessionId,
    enrollmentState,
    ageBand: redeemed.ageBand,
    cohort: req.cohort,
    processingAllowed: isProcessingAllowed(stores.identityConsent, redeemed.studentId),
    ...(blockers.length ? { blockers } : {}),
  };
}

export function requireSession(
  stores: PilotStoreBundle,
  sessionToken: string | undefined,
): { studentId: string; sessionId: string; enrollmentState: EnrollmentState; ageBand: AgeBand } {
  if (!sessionToken?.trim()) {
    throw new SafeApiError('unauthorized', 'Session token is required.', 401);
  }
  const resolved = resolveSessionToken(stores.identityConsent, sessionToken.trim());
  if (!resolved) {
    throw new SafeApiError('unauthorized', 'Session is invalid or expired.', 401);
  }
  return {
    studentId: resolved.studentId,
    sessionId: resolved.sessionId,
    enrollmentState: resolved.enrollmentState,
    ageBand: resolved.ageBand,
  };
}

export function requireActiveProcessing(
  stores: PilotStoreBundle,
  studentId: string,
): void {
  if (!isProcessingAllowed(stores.identityConsent, studentId)) {
    const state = getEnrollmentState(stores.identityConsent, studentId);
    throw new SafeApiError(
      'enrollment_blocked',
      'Tutoring is not available until enrollment is active with participation consent.',
      403,
      { enrollmentState: state ?? 'unknown' },
    );
  }
}
