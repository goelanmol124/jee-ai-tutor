/**
 * Multi-page readback / staged diagnosis boundary.
 *
 * Live Grok diagnose cannot safely supply the independent verifier contract —
 * when that path is used, return tentative feedback and keep learner state unchanged.
 */
import type { DiagnosisResult, QuestionNode } from '../../src/domain/types.ts';
import {
  compileStagedDiagnosis,
  stagedToDiagnosisResult,
  unclearFromPreciseRequest,
  validateMultiPageInput,
  type DiagnosisCaptureMetadata,
  type StagedDiagnosisBundle,
} from '../diagnosis/index.ts';
import { proposeFromPhoto, type LearnerStateProposal } from '../learner/index.ts';
import { queryAll, type PilotStoreBundle } from '../pilot/db.ts';
import { newOpaqueId, nowIso } from '../pilot/ids.ts';
import { isPhotoDiagnosisAllowed } from '../pilot/consent.ts';
import { SafeApiError } from './safeErrors.ts';

export type CapturePageClient = {
  id: string;
  pageNumber: number;
  previewUrl?: string;
  fileName?: string;
  clientReadableHint?: 'readable' | 'blurry' | 'glare' | 'cropped' | 'unknown';
};

export type PrepareDiagnosisRequest = {
  studentId: string;
  question: QuestionNode;
  pages: CapturePageClient[];
  typedWork?: string;
  correctionNote?: string;
  readbackConfirmed: boolean;
  /** When true, attempt was already run through legacy Grok — stay tentative. */
  liveModelPath?: boolean;
};

export type PhotoReadback = {
  transcribedWork: string;
  pageSummaries: Array<{ pageNumber: number; note: string }>;
  needsCorrection: boolean;
  suggestedRecapture?: string;
  recognizedQuestionHint?: string;
};

export type PrepareDiagnosisResponse = {
  ok: true;
  diagnosisId?: string;
  readback?: PhotoReadback;
  diagnosis?: DiagnosisResult;
  studentFacingHint?: {
    certainty: 'uncertain' | 'tentative' | 'definitive';
    stateMutated: false;
  };
  proposals?: LearnerStateProposal[];
  integrationGap?: string;
  staged?: Pick<
    StagedDiagnosisBundle,
    'outputMode' | 'stateEligibility' | 'captureAssessment'
  >;
};

function buildReadback(
  pages: CapturePageClient[],
  typedWork?: string,
  correctionNote?: string,
): PhotoReadback {
  const pageSummaries = pages.map((p) => ({
    pageNumber: p.pageNumber,
    note: p.fileName
      ? `Page ${p.pageNumber}: ${p.fileName}`
      : `Page ${p.pageNumber}: handwritten working`,
  }));
  const base =
    typedWork?.trim()
    || (pages.length
      ? `I see ${pages.length} page${pages.length === 1 ? '' : 's'} of handwritten work (ordered).`
      : 'No working attached yet.');
  const transcribedWork = correctionNote?.trim() ? correctionNote.trim() : base;
  let suggestedRecapture: string | undefined;
  if (pages.length === 0 && !typedWork?.trim()) {
    suggestedRecapture = 'add_missing_page';
  } else if (pages.some((p) => !p.previewUrl)) {
    suggestedRecapture = 'retake_page';
  }
  return {
    transcribedWork,
    pageSummaries,
    needsCorrection: false,
    suggestedRecapture,
    recognizedQuestionHint: 'Matching to the pinned question above.',
  };
}

function toCaptureMetadata(req: PrepareDiagnosisRequest): DiagnosisCaptureMetadata {
  const pages = req.pages.map((p) => ({
    pageId: p.id,
    order: p.pageNumber,
    imageRef: p.previewUrl ? `client:${p.id}` : undefined,
    clientReadableHint: p.clientReadableHint ?? 'unknown',
  }));
  return {
    attemptId: newOpaqueId('att'),
    questionId: req.question.id,
    capturedAtIso: nowIso(),
    pageCount: pages.length,
    pages,
    typedWork: req.correctionNote?.trim() || req.typedWork,
  };
}

function persistBoundary(
  stores: PilotStoreBundle,
  row: {
    diagnosisId: string;
    studentId: string;
    questionId: string;
    outputMode: string;
    stateMutated: boolean;
    integrationGap?: string;
    payload: unknown;
  },
): void {
  stores.learningState.run(
    `INSERT INTO pilot_diagnosis_boundary (
      diagnosis_id, student_id, question_id, output_mode, state_mutated, integration_gap, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.diagnosisId,
      row.studentId,
      row.questionId,
      row.outputMode,
      row.stateMutated ? 1 : 0,
      row.integrationGap ?? null,
      JSON.stringify(row.payload),
      nowIso(),
    ],
  );
}

function persistProposals(
  stores: PilotStoreBundle,
  studentId: string,
  diagnosisId: string,
  proposals: LearnerStateProposal[],
): void {
  for (const p of proposals) {
    stores.learningState.run(
      `INSERT INTO pilot_learner_proposals (
        proposal_id, student_id, concept_id, kind, status, evidence_json, photo_ids_json,
        rationale, created_at, diagnosis_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        studentId,
        p.conceptId,
        p.kind,
        p.status,
        JSON.stringify(p.evidenceIds),
        JSON.stringify(p.photoIds),
        p.rationale,
        p.createdAt,
        diagnosisId,
      ],
    );
  }
}

/**
 * Readback-first photo diagnosis boundary.
 * A single photo / unreadable capture cannot produce persistent mastery updates.
 */
export function preparePhotoDiagnosis(
  stores: PilotStoreBundle,
  req: PrepareDiagnosisRequest,
): PrepareDiagnosisResponse {
  if (!isPhotoDiagnosisAllowed(stores.identityConsent, req.studentId)) {
    // Allow readback preview without photo consent; block consequential diagnosis.
    if (req.readbackConfirmed) {
      throw new SafeApiError(
        'forbidden',
        'Photo diagnosis requires explicit transient_photo_diagnosis consent.',
        403,
      );
    }
  }

  if (!req.readbackConfirmed) {
    return {
      ok: true,
      readback: buildReadback(req.pages, req.typedWork, req.correctionNote),
    };
  }

  if (req.pages.length === 0 && !req.typedWork?.trim() && !req.correctionNote?.trim()) {
    const diagnosis = unclearFromPreciseRequest(
      'I need at least one page of work or typed notes before I can diagnose.',
    );
    const diagnosisId = newOpaqueId('diag');
    persistBoundary(stores, {
      diagnosisId,
      studentId: req.studentId,
      questionId: req.question.id,
      outputMode: 'recapture',
      stateMutated: false,
      payload: { reason: 'empty_capture' },
    });
    return {
      ok: true,
      diagnosisId,
      readback: buildReadback(req.pages, req.typedWork, req.correctionNote),
      diagnosis,
      studentFacingHint: { certainty: 'uncertain', stateMutated: false },
      proposals: [],
    };
  }

  const capture = toCaptureMetadata(req);
  const validated = validateMultiPageInput(capture);
  if (!validated.ok || !validated.capture) {
    throw new SafeApiError('bad_request', 'Invalid multi-page capture.', 400, {
      errors: validated.errors,
    });
  }

  const diagnosisId = newOpaqueId('diag');
  const integrationGap =
    'Live Grok /api/diagnose does not yet emit the staged verifier contract; '
    + 'integration returns tentative non-state-changing feedback only.';

  // Without an independent verifier payload from the live model, compile a
  // moderate/low evidence staged bundle that cannot mutate persistent mastery.
  const singlePhoto = req.pages.length <= 1;
  const unreadable = req.pages.every(
    (p) => p.clientReadableHint === 'blurry' || p.clientReadableHint === 'glare' || !p.previewUrl,
  );

  const staged = compileStagedDiagnosis({
    capture: validated.capture,
    transcription: {
      kind: 'observation',
      spans: unreadable
        ? []
        : [
            {
              spanId: 'span_1',
              citation: { pageId: validated.capture.pages[0]!.pageId },
              verbatim: req.correctionNote?.trim() || req.typedWork?.trim() || '[HANDWRITTEN]',
              confidence: unreadable ? 0.1 : 0.45,
            },
          ],
      pageNotes: validated.capture.pages.map((p) => ({
        pageId: p.pageId,
        note: 'Client-ordered page pending independent verifier.',
      })),
    },
    // No verifier report → pipeline stays non-definitive / state-ineligible for mastery.
    verifier: null,
  });

  const diagnosis = stagedToDiagnosisResult(staged);
  // Force non-definitive when using live-model gap path.
  if (req.liveModelPath !== false) {
    diagnosis.beliefUpdates = [];
    if (diagnosis.verdict !== 'unclear') {
      diagnosis.verdict = diagnosis.verdict === 'correct' ? 'partially_correct' : diagnosis.verdict;
    }
    diagnosis.confidence = Math.min(diagnosis.confidence, 0.55);
  }

  const proposals: LearnerStateProposal[] = [];
  const conceptId = req.question.conceptIds[0];
  const photoId = req.pages[0]?.id ?? diagnosisId;

  if (
    conceptId
    && staged.stateEligibility.mayAddReversibleObservation
    && !staged.captureAssessment.isCaptureFailure
  ) {
    const proposalResult = proposeFromPhoto({
      conceptId,
      photoId,
      captureFailed: false,
      diagnosisConfident: false,
      existingPhotoEvidenceCountForConcept: singlePhoto ? 0 : 1,
      note: 'integration_tentative_observation',
    });
    if (proposalResult.ok) {
      // Never promote to confirmed mastery from this path.
      if (
        proposalResult.proposal.status === 'observation_only'
        || proposalResult.proposal.status === 'needs_confirmation'
      ) {
        proposals.push(proposalResult.proposal);
      }
    }
  }

  // Capture failures / unreadable: zero proposals, zero belief updates.
  if (staged.captureAssessment.isCaptureFailure || unreadable) {
    proposals.length = 0;
    diagnosis.beliefUpdates = [];
  }

  persistBoundary(stores, {
    diagnosisId,
    studentId: req.studentId,
    questionId: req.question.id,
    outputMode: staged.outputMode,
    stateMutated: false,
    integrationGap,
    payload: {
      stateEligibility: staged.stateEligibility.decision,
      proposalCount: proposals.length,
    },
  });
  if (proposals.length > 0) {
    persistProposals(stores, req.studentId, diagnosisId, proposals);
  }

  const certainty: 'uncertain' | 'tentative' | 'definitive' =
    staged.outputMode === 'recapture' || staged.outputMode === 'clarify' || staged.outputMode === 'blocked'
      ? 'uncertain'
      : 'tentative';

  return {
    ok: true,
    diagnosisId,
    readback: buildReadback(req.pages, req.typedWork, req.correctionNote),
    diagnosis,
    studentFacingHint: { certainty, stateMutated: false },
    proposals,
    integrationGap,
    staged: {
      outputMode: staged.outputMode,
      stateEligibility: staged.stateEligibility,
      captureAssessment: staged.captureAssessment,
    },
  };
}

/** Count persisted proposals that claim confirmed mastery (should stay 0 from one photo). */
export function countConfirmedMasteryProposals(
  stores: PilotStoreBundle,
  studentId: string,
): number {
  const rows = queryAll(
    stores.learningState,
    `SELECT status, kind FROM pilot_learner_proposals WHERE student_id = ?`,
    [studentId],
  );
  return rows.filter(
    (r) => String(r.status) === 'confirmed' && String(r.kind) === 'mastery_hypothesis',
  ).length;
}
