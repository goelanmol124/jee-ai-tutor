import {
  beliefFloorForAdvancement,
  requiredDelayedIndependentSuccesses,
} from './policy';
import type {
  FalseAdvancementClass,
  LearnerEvidenceEvent,
  LearnerStateProposal,
  StateProposalKind,
} from './types';

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function isPhotoCaptureFailure(event: LearnerEvidenceEvent): boolean {
  return event.source === 'photo_failure' || event.outcome === 'capture_failure';
}

/**
 * Photo / OCR / unreadability failures never become concept-failure evidence.
 */
export function sanitizeEvidenceForConceptUpdate(
  event: LearnerEvidenceEvent,
): LearnerEvidenceEvent | null {
  if (isPhotoCaptureFailure(event)) return null;
  return event;
}

export function countDelayedIndependentSuccesses(
  events: LearnerEvidenceEvent[],
  conceptId: string,
): number {
  return events.filter(
    (e) =>
      e.conceptId === conceptId &&
      e.source === 'delayed_independent_transfer' &&
      e.outcome === 'success' &&
      e.assistance === 'independent' &&
      (e.delayed ?? true) &&
      (e.transfer ?? true),
  ).length;
}

export function hasConfirmedMasteryEvidence(
  events: LearnerEvidenceEvent[],
  conceptId: string,
  advancementClass: FalseAdvancementClass,
  belief: number,
): boolean {
  const need = requiredDelayedIndependentSuccesses(advancementClass);
  const count = countDelayedIndependentSuccesses(events, conceptId);
  if (count < need) return false;
  return belief >= beliefFloorForAdvancement(advancementClass);
}

export interface PhotoProposalInput {
  conceptId: string;
  photoId: string;
  at?: string;
  kind?: Exclude<StateProposalKind, 'observation'>;
  diagnosisConfident?: boolean;
  captureFailed?: boolean;
  note?: string;
  existingPhotoEvidenceCountForConcept?: number;
}

export type PhotoProposalResult =
  | {
      ok: true;
      event: LearnerEvidenceEvent;
      proposal: LearnerStateProposal;
    }
  | {
      ok: false;
      reason:
        | 'photo_capture_failure_not_concept_evidence'
        | 'single_photo_cannot_confirm_mastery_or_misconception';
      event?: LearnerEvidenceEvent;
      proposal?: LearnerStateProposal;
    };

/**
 * One photo may add a reversible observation or needs_confirmation hypothesis.
 * It may not independently establish mastery or a persistent misconception.
 */
export function proposeFromPhoto(input: PhotoProposalInput): PhotoProposalResult {
  const at = input.at ?? new Date().toISOString();

  if (input.captureFailed) {
    const event: LearnerEvidenceEvent = {
      id: newId('ev'),
      conceptId: input.conceptId,
      at,
      source: 'photo_failure',
      assistance: 'independent',
      outcome: 'capture_failure',
      photoId: input.photoId,
      note: input.note ?? 'capture_or_ocr_failure',
    };
    return {
      ok: false,
      reason: 'photo_capture_failure_not_concept_evidence',
      event,
    };
  }

  const event: LearnerEvidenceEvent = {
    id: newId('ev'),
    conceptId: input.conceptId,
    at,
    source: 'photo_observation',
    assistance: 'independent',
    outcome: input.diagnosisConfident ? 'partial' : 'inconclusive',
    photoId: input.photoId,
    note: input.note,
  };

  const priorPhotos = input.existingPhotoEvidenceCountForConcept ?? 0;
  const hypothesisKind =
    input.kind === 'mastery_hypothesis' || input.kind === 'misconception_hypothesis'
      ? input.kind
      : undefined;

  // A single photo is never enough to confirm mastery/misconception.
  if (priorPhotos < 1) {
    const proposal: LearnerStateProposal = {
      id: newId('prop'),
      conceptId: input.conceptId,
      kind: hypothesisKind ?? 'observation',
      status: hypothesisKind ? 'needs_confirmation' : 'observation_only',
      evidenceIds: [event.id],
      createdAt: at,
      reversible: true,
      photoIds: [input.photoId],
      rationale: hypothesisKind
        ? 'single_photo_needs_confirmation'
        : 'photo_observation_only',
    };
    return { ok: true, event, proposal };
  }

  // Even with multiple photos, mastery/misconception stay needs_confirmation until
  // confirmation probe or delayed independent transfer (caller promotes).
  const proposal: LearnerStateProposal = {
    id: newId('prop'),
    conceptId: input.conceptId,
    kind: hypothesisKind ?? 'observation',
    status: hypothesisKind ? 'needs_confirmation' : 'observation_only',
    evidenceIds: [event.id],
    createdAt: at,
    reversible: true,
    photoIds: [input.photoId],
    rationale: 'photo_evidence_reversible_pending_confirmation',
  };

  return { ok: true, event, proposal };
}

export function confirmProposal(
  proposal: LearnerStateProposal,
  confirmationEvidence: LearnerEvidenceEvent,
): LearnerStateProposal | { error: string } {
  if (proposal.status === 'reversed') {
    return { error: 'proposal_already_reversed' };
  }
  if (
    confirmationEvidence.source !== 'confirmation_probe' &&
    confirmationEvidence.source !== 'delayed_independent_transfer'
  ) {
    return { error: 'confirmation_requires_probe_or_delayed_transfer' };
  }
  if (confirmationEvidence.outcome !== 'success') {
    return { error: 'confirmation_evidence_not_successful' };
  }
  if (confirmationEvidence.conceptId !== proposal.conceptId) {
    return { error: 'concept_mismatch' };
  }
  return {
    ...proposal,
    status: 'confirmed',
    evidenceIds: [...proposal.evidenceIds, confirmationEvidence.id],
    reversible: true,
  };
}

export function reverseProposal(
  proposal: LearnerStateProposal,
  counterEvidence: LearnerEvidenceEvent,
): LearnerStateProposal {
  return {
    ...proposal,
    status: 'reversed',
    evidenceIds: [...proposal.evidenceIds, counterEvidence.id],
    reversible: true,
    rationale: `${proposal.rationale};reversed_by:${counterEvidence.id}`,
  };
}

/**
 * Mastery target: delayed independent transfer — not reading, explanation, or supported success.
 */
export function evidenceCountsTowardMastery(event: LearnerEvidenceEvent): boolean {
  if (isPhotoCaptureFailure(event)) return false;
  if (event.source === 'worked_example' || event.source === 'self_report') return false;
  if (event.assistance !== 'independent') return false;
  if (event.source === 'delayed_independent_transfer' && event.outcome === 'success') {
    return true;
  }
  return (
    event.source === 'independent_attempt' &&
    event.outcome === 'success' &&
    Boolean(event.delayed) &&
    Boolean(event.transfer)
  );
}

export function classifyAdvancement(
  isCriticalPrereq: boolean,
  highCentrality: boolean,
  isolatedRecall: boolean,
): FalseAdvancementClass {
  if (isolatedRecall) return 'isolated_recall';
  if (isCriticalPrereq && highCentrality) return 'critical_high_centrality';
  return 'normal_prerequisite';
}
