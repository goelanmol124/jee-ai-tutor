import type {
  Citation,
  EvidenceAlignmentRecord,
  FirstCausalErrorRecord,
  VerifierReport,
  VerifierVerdict,
} from './types';
import { scanAnswerLeakage } from './leakage';

export interface VerifierInput {
  /** Primary model diagnosis summary. */
  primary: {
    firstCausalError: FirstCausalErrorRecord;
    evidenceAlignment: EvidenceAlignmentRecord;
    coachMessage: string;
    claimedCitations: Citation[];
  };
  /**
   * Independent verifier judgment. When omitted, definitive/state-changing
   * outputs are blocked (contract requires an independent check).
   */
  independent?: {
    verdict: VerifierVerdict;
    supportedCitationKeys: string[];
    notes?: string;
  };
  forbiddenAnswerTokens?: string[];
}

function citationKey(c: Citation): string {
  return `${c.pageId}|${c.regionId ?? ''}|${c.stepId ?? ''}`;
}

/**
 * Independent verifier contract.
 * Definitive or state-changing output requires agree + supported citations + no leakage.
 */
export function runVerifierContract(input: VerifierInput): VerifierReport {
  const leakage = scanAnswerLeakage(input.primary.coachMessage, input.forbiddenAnswerTokens ?? []);

  if (!input.independent) {
    return {
      verdict: 'abstain',
      citationsSupported: false,
      unsupportedClaims: ['independent_verifier_missing'],
      answerLeakageDetected: leakage.leaked,
      notes: 'Definitive output blocked until an independent verifier runs.',
    };
  }

  const unsupportedClaims: string[] = [];
  const supported = new Set(input.independent.supportedCitationKeys);

  for (const c of input.primary.claimedCitations) {
    const key = citationKey(c);
    if (!supported.has(key) && !supported.has(c.pageId)) {
      unsupportedClaims.push(`unsupported_citation:${key}`);
    }
  }

  // Evidence alignment items marked unsupported are visual-claim failures
  for (const item of input.primary.evidenceAlignment.items) {
    if (!item.supported) {
      unsupportedClaims.push(`unsupported_visual_claim:${item.stepId}`);
    }
  }

  // First-causal-error without citation when claiming an error
  if (
    input.primary.firstCausalError.stepId
    && !input.primary.firstCausalError.citation
  ) {
    unsupportedClaims.push('first_causal_error_missing_citation');
  }

  const citationsSupported = unsupportedClaims.length === 0;
  let verdict = input.independent.verdict;

  if (leakage.leaked) {
    verdict = 'disagree';
    unsupportedClaims.push(...leakage.reasons.map((r) => `leakage:${r}`));
  } else if (!citationsSupported && verdict === 'agree') {
    verdict = 'disagree';
  }

  return {
    verdict,
    citationsSupported,
    unsupportedClaims,
    answerLeakageDetected: leakage.leaked,
    notes: input.independent.notes,
  };
}

export function verifierAllowsDefinitive(report: VerifierReport): boolean {
  return (
    report.verdict === 'agree'
    && report.citationsSupported
    && !report.answerLeakageDetected
    && report.unsupportedClaims.length === 0
  );
}
