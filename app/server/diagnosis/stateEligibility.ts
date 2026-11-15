import type {
  CaptureAssessment,
  PersistentStateProposal,
  StateEligibilityRecord,
  VerifierReport,
} from './types';
import { verifierAllowsDefinitive } from './verifier';

export interface StateEligibilityInput {
  captureAssessment: CaptureAssessment;
  verifier: VerifierReport | null;
  /** True when student method is valid but outside covered rubric alternatives. */
  alternateMethodUncovered?: boolean;
  proposed?: PersistentStateProposal[];
}

/**
 * Persistent learner-state eligibility.
 * Policy: one photo may only add a reversible observation or needs_confirmation;
 * never mastery / persistent misconception from a single photo.
 */
export function decideStateEligibility(input: StateEligibilityInput): {
  eligibility: StateEligibilityRecord;
  proposals: PersistentStateProposal[];
} {
  const { captureAssessment, verifier, alternateMethodUncovered } = input;
  const proposed = input.proposed ?? [];

  if (captureAssessment.isCaptureFailure || captureAssessment.tier === 'insufficient') {
    const hasAbsent = captureAssessment.issues.some((i) => i.kind === 'absent_work');
    return {
      eligibility: {
        kind: 'state_eligibility',
        decision: hasAbsent ? 'ineligible_absent_work' : 'ineligible_capture_failure',
        mayProposePersistentChange: false,
        mayAddReversibleObservation: false,
        mayAddNeedsConfirmation: false,
        reason:
          'Missing, unreadable, or absent work is a capture/system issue — never learner-failure evidence.',
      },
      proposals: gateProposals(proposed, { observation: false, needsConfirmation: false }, [
        'capture_failure_blocks_state',
      ]),
    };
  }

  if (captureAssessment.tier === 'low') {
    return {
      eligibility: {
        kind: 'state_eligibility',
        decision: 'ineligible_insufficient_evidence',
        mayProposePersistentChange: false,
        mayAddReversibleObservation: false,
        mayAddNeedsConfirmation: false,
        reason: 'Low evidence: request precise recapture/clarification only.',
      },
      proposals: gateProposals(proposed, { observation: false, needsConfirmation: false }, [
        'low_evidence',
      ]),
    };
  }

  if (alternateMethodUncovered) {
    return {
      eligibility: {
        kind: 'state_eligibility',
        decision: 'ineligible_alternate_method_uncovered',
        mayProposePersistentChange: false,
        mayAddReversibleObservation: true,
        mayAddNeedsConfirmation: false,
        reason: 'Valid alternate method not covered by rubric — do not mark as misconception.',
      },
      proposals: gateProposals(proposed, { observation: true, needsConfirmation: false }, [
        'alternate_method_uncovered',
      ]),
    };
  }

  if (!verifier || !verifierAllowsDefinitive(verifier)) {
    const missingCitation =
      verifier?.unsupportedClaims.some((c) => c.includes('citation')) ?? true;
    return {
      eligibility: {
        kind: 'state_eligibility',
        decision:
          missingCitation && verifier?.verdict === 'agree'
            ? 'ineligible_missing_citation'
            : 'ineligible_verifier_disagree',
        mayProposePersistentChange: false,
        mayAddReversibleObservation: true,
        mayAddNeedsConfirmation: false,
        reason:
          'Definitive/state-changing output requires independent verifier agreement with citations.',
      },
      proposals: gateProposals(proposed, { observation: true, needsConfirmation: false }, [
        'verifier_gate',
      ]),
    };
  }

  // High evidence + verifier agree: still no persistent change from a single photo.
  return {
    eligibility: {
      kind: 'state_eligibility',
      decision: 'blocked_no_persistent_from_single_photo',
      mayProposePersistentChange: false,
      mayAddReversibleObservation: true,
      mayAddNeedsConfirmation: true,
      reason:
        'Single photo may add observation or needs_confirmation only; promotion requires probe or later independent evidence.',
    },
    proposals: gateProposals(proposed, { observation: true, needsConfirmation: true }, [
      'no_persistent_from_single_photo',
    ]),
  };
}

function gateProposals(
  proposed: PersistentStateProposal[],
  allow: { observation: boolean; needsConfirmation: boolean },
  blocks: string[],
): PersistentStateProposal[] {
  return proposed.map((p) => {
    const mode: PersistentStateProposal['mode'] =
      p.mode === 'needs_confirmation' && allow.needsConfirmation
        ? 'needs_confirmation'
        : 'observation';

    let eligible = false;
    if (mode === 'needs_confirmation') eligible = allow.needsConfirmation;
    else eligible = allow.observation;

    const blockingReasons = Array.from(
      new Set([...p.blockingReasons, ...blocks, ...(eligible ? [] : ['gated'])]),
    );

    return {
      ...p,
      mode,
      eligible,
      blockingReasons,
    };
  });
}
