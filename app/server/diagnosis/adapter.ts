import type { DiagnosisResult, MistakeType, NextMoveKind } from '../../src/domain/types';
import type { StagedDiagnosisBundle } from './types';
import { scrubOptionLeakage } from './leakage';

/**
 * Adapt a gated staged bundle into the legacy DiagnosisResult shape used by
 * the current API / UI. Belief updates are emptied when state is ineligible.
 */
export function stagedToDiagnosisResult(bundle: StagedDiagnosisBundle): DiagnosisResult {
  const captureBlocked =
    bundle.captureAssessment.isCaptureFailure
    || bundle.outputMode === 'recapture'
    || bundle.outputMode === 'clarify'
    || bundle.outputMode === 'blocked';

  const verdict: DiagnosisResult['verdict'] = captureBlocked
    ? 'unclear'
    : bundle.firstCausalError.mistakeFamily === 'none' && bundle.outputMode === 'definitive'
      ? 'correct'
      : bundle.outputMode === 'definitive'
        ? bundle.firstCausalError.stepId
          ? 'needs_work'
          : 'correct'
        : bundle.outputMode === 'tentative'
          ? 'partially_correct'
          : 'unclear';

  let mistakeType: MistakeType = mapMistake(bundle.firstCausalError.mistakeFamily);
  if (verdict === 'correct' || verdict === 'unclear') {
    mistakeType = 'unclear_evidence';
  }

  // Capture failures must never emit negative concept evidence
  const beliefUpdates = bundle.stateEligibility.mayAddNeedsConfirmation
    || bundle.stateEligibility.mayAddReversibleObservation
    ? [] // proposals stay in staged bundle; legacy beliefUpdates stay empty until W3 wires them
    : [];

  const coachMessage = scrubOptionLeakage(bundle.response.coachMessage);

  const nextMove: NextMoveKind | undefined = bundle.response.nextMove;

  return {
    verdict,
    mistakeType,
    firstProblemStep:
      verdict === 'correct' || captureBlocked
        ? undefined
        : bundle.firstCausalError.explanation || undefined,
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: confidenceFor(bundle),
    recommendedTool: captureBlocked ? 'diagnosis_card' : 'micro_lesson',
    attemptTrace: bundle.stepGraph.steps.map((s) => ({
      id: s.stepId,
      raw: s.verbatim ?? s.normalizedLatex ?? '',
      status:
        s.status === 'broken'
          ? 'broken'
          : s.status === 'correct'
            ? 'correct'
            : s.status === 'ambiguous' || s.status === 'illegible'
              ? 'ambiguous'
              : 'pending',
      canonicalStepId: undefined,
      conceptIds: [],
      note: s.alternateMethod ? `alternate:${s.methodLabel ?? 'valid'}` : undefined,
      confidence: s.status === 'illegible' ? 0.2 : 0.7,
    })),
    conceptEvidence: [],
    cards: [
      {
        id: captureBlocked ? 'unclear_photo' : 'staged_diag',
        kind: captureBlocked ? 'clarification' : 'diagnosis',
        title: captureBlocked ? 'Need a clearer look' : 'Coach note',
        body: coachMessage,
        actionLabel: captureBlocked ? 'Retake photo' : undefined,
      },
    ],
    beliefUpdates,
    needsClarification: captureBlocked || bundle.outputMode === 'clarify',
    coachMessage,
    nextMove,
  };
}

function mapMistake(
  family: StagedDiagnosisBundle['firstCausalError']['mistakeFamily'],
): MistakeType {
  switch (family) {
    case 'conceptual_gap':
    case 'wrong_understanding':
    case 'procedure_error':
    case 'silly_mistake':
    case 'unclear_evidence':
      return family;
    case 'none':
      return 'unclear_evidence';
    default:
      return 'unclear_evidence';
  }
}

function confidenceFor(bundle: StagedDiagnosisBundle): number {
  switch (bundle.outputMode) {
    case 'definitive':
      return 0.85;
    case 'tentative':
      return 0.55;
    case 'clarify':
      return 0.35;
    case 'recapture':
      return 0.2;
    case 'blocked':
      return 0.1;
    default:
      return 0.4;
  }
}

/**
 * Build unclear legacy result from a precise recapture/clarify request.
 * Compatible with existing unclearDiagnosisResult usage.
 */
export function unclearFromPreciseRequest(message: string): DiagnosisResult {
  const coachMessage = scrubOptionLeakage(message);
  return {
    verdict: 'unclear',
    mistakeType: 'unclear_evidence',
    firstProblemStep: coachMessage,
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: 0.2,
    recommendedTool: 'diagnosis_card',
    attemptTrace: [],
    conceptEvidence: [],
    cards: [
      {
        id: 'unclear_photo',
        kind: 'clarification',
        title: 'Need a clearer look',
        body: coachMessage,
        actionLabel: 'Retake photo',
      },
    ],
    beliefUpdates: [],
    needsClarification: true,
    coachMessage,
    nextMove: 'clarify',
  };
}
