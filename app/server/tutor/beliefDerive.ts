import type { UnifiedConceptKnowledge } from '../../src/domain/tutorUnified';

/** Derive numeric belief [0,1] from layered fields (never authoritative alone). */
export function deriveBeliefFromLayers(concept: Pick<
  UnifiedConceptKnowledge,
  'observed' | 'formulaUnderstanding' | 'applicationFlexibility' | 'confidence' | 'recentEvidence' | 'mistakePatterns'
>): number {
  let score = 0.35;

  switch (concept.observed) {
    case 'untested':
      score += 0;
      break;
    case 'shaky':
      score += 0.1;
      break;
    case 'applied_correctly':
      score += 0.35;
      break;
    case 'failed':
      score -= 0.08;
      break;
    default:
      break;
  }

  switch (concept.formulaUnderstanding) {
    case 'derives_it':
      score += 0.12;
      break;
    case 'shaky':
      score += 0.04;
      break;
    default:
      break;
  }

  switch (concept.applicationFlexibility) {
    case 'transfers':
      score += 0.1;
      break;
    case 'rigid':
      score += 0.02;
      break;
    default:
      break;
  }

  if (concept.confidence === 'high') score += 0.06;
  if (concept.confidence === 'low') score -= 0.06;

  const recent = concept.recentEvidence.slice(-5);
  for (const e of recent) {
    if (e.outcome === 'applied_well') score += 0.04;
    if (e.outcome === 'failed') score -= 0.06;
    if (e.outcome === 'applied_with_help') score += 0.02;
  }

  score -= Math.min(0.2, concept.mistakePatterns.length * 0.03);

  // Monotonic-ish toward applied_correctly with strong evidence chain
  if (concept.observed === 'applied_correctly' && recent.filter((x) => x.outcome === 'applied_well').length >= 2) {
    score += 0.05;
  }

  return Math.min(1, Math.max(0, Math.round(score * 100) / 100));
}
