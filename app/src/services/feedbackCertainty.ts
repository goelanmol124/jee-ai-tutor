import type { FeedbackCertainty, StudentFacingDiagnosis } from '../domain/pilotExperience';
import type { DiagnosisResult } from '../domain/types';

/**
 * Map a diagnosis into student-facing certainty.
 * Uses evidence structure — never exposes raw belief/confidence numbers as mastery.
 */
export function certaintyFromDiagnosis(diagnosis: DiagnosisResult): FeedbackCertainty {
  if (diagnosis.needsClarification || diagnosis.verdict === 'unclear') {
    return 'uncertain';
  }
  if (diagnosis.verdict === 'partially_correct' || diagnosis.mistakeType === 'unclear_evidence') {
    return 'tentative';
  }
  // Definitive only when evidence anchors exist and verdict is clear.
  const hasAnchors =
    diagnosis.attemptTrace.some((s) => s.status === 'broken' || s.status === 'correct')
    || diagnosis.conceptEvidence.length > 0;
  if (!hasAnchors && diagnosis.verdict === 'needs_work') {
    return 'tentative';
  }
  return 'definitive';
}

export function certaintyLabel(certainty: FeedbackCertainty): string {
  switch (certainty) {
    case 'uncertain':
      return 'Not sure yet';
    case 'tentative':
      return 'Tentative read';
    case 'definitive':
      return 'Based on your working';
  }
}

export function certaintyHint(certainty: FeedbackCertainty): string {
  switch (certainty) {
    case 'uncertain':
      return 'I need a clearer look before changing anything that sticks.';
    case 'tentative':
      return 'This is a working hypothesis from what I can see — tap if it looks wrong.';
    case 'definitive':
      return 'Grounded in the evidence below. Still disputable if I misread.';
  }
}

export function toStudentFacingDiagnosis(
  diagnosis: DiagnosisResult,
  diagnosisId?: string,
): StudentFacingDiagnosis {
  const certainty = certaintyFromDiagnosis(diagnosis);
  const evidenceAnchors = diagnosis.attemptTrace
    .filter((step) => step.note || step.status !== 'pending')
    .slice(0, 4)
    .map((step, i) => ({
      label: step.canonicalStepId ? `Step ${step.canonicalStepId}` : `Line ${i + 1}`,
      detail: step.note?.trim() || step.raw.slice(0, 120) || step.status,
    }));

  if (evidenceAnchors.length === 0 && diagnosis.conceptEvidence[0]) {
    evidenceAnchors.push({
      label: 'Evidence',
      detail: diagnosis.conceptEvidence[0].reason,
    });
  }

  const message = diagnosis.coachMessage?.trim()
    || diagnosis.cards[0]?.body
    || 'Let me show you the next move.';

  const firstBreakOrSound =
    diagnosis.verdict === 'correct'
      ? 'Your working looks sound on the evidence I have.'
      : diagnosis.firstProblemStep
        ? `First break I can point to: ${diagnosis.firstProblemStep}`
        : diagnosis.needsClarification
          ? 'I cannot yet name a first break — the photo needs a clearer look.'
          : 'I see a gap, but I want one more check before locking it in.';

  const invitation =
    certainty === 'uncertain'
      ? 'Retake or clarify the unclear page, then send again.'
      : diagnosis.nextMove === 'try_again'
        ? 'Want to fix that line and try again?'
        : 'Reply in your own words, or tap a shortcut below.';

  return {
    diagnosisId: diagnosisId ?? `local_${Math.random().toString(36).slice(2, 10)}`,
    certainty,
    evidenceSummary:
      diagnosis.attemptTrace.length > 0
        ? `I can see ${diagnosis.attemptTrace.length} line(s) of working.`
        : diagnosis.verdict === 'unclear'
          ? 'I could not reliably read your working yet.'
          : 'I used the text or photo you sent as evidence.',
    coachMessage: message,
    firstBreakOrSound,
    invitation,
    needsClarification: diagnosis.needsClarification || certainty === 'uncertain',
    evidenceAnchors,
  };
}
