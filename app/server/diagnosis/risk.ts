import type {
  ActionRiskBudgets,
  CaptureAssessment,
  DiagnosisOutputMode,
  DiagnosisRiskMetrics,
  EvidenceSufficiencyTier,
  VerifierReport,
} from './types';
import { DEFAULT_ACTION_RISK_BUDGETS } from './types';
import { verifierAllowsDefinitive } from './verifier';
import { tierAllowsDefinitive, tierAllowsTentative } from './sufficiency';

export const ACTION_RISK_BUDGETS = DEFAULT_ACTION_RISK_BUDGETS;

export interface RiskGateInput {
  captureAssessment: CaptureAssessment;
  verifier: VerifierReport | null;
  answerLeakage: boolean;
  hasUnsupportedVisualClaim: boolean;
}

/**
 * Map structural signals onto allowed pedagogical action.
 * Numeric budgets are evaluation targets; runtime uses hard structural gates.
 */
export function decideOutputMode(input: RiskGateInput): DiagnosisOutputMode {
  const { captureAssessment, verifier, answerLeakage, hasUnsupportedVisualClaim } = input;

  if (answerLeakage) return 'blocked';

  if (captureAssessment.isCaptureFailure || captureAssessment.tier === 'insufficient') {
    return 'recapture';
  }

  if (captureAssessment.tier === 'low' || hasUnsupportedVisualClaim) {
    return 'clarify';
  }

  if (tierAllowsDefinitive(captureAssessment.tier) && verifier && verifierAllowsDefinitive(verifier)) {
    return 'definitive';
  }

  if (tierAllowsTentative(captureAssessment.tier)) {
    return 'tentative';
  }

  return 'clarify';
}

export function buildRiskMetrics(
  input: RiskGateInput,
  budgets: ActionRiskBudgets = DEFAULT_ACTION_RISK_BUDGETS,
): DiagnosisRiskMetrics {
  const allowedAction = decideOutputMode(input);
  return {
    targets: budgets,
    observed: {
      evidenceTier: input.captureAssessment.tier,
      hasUnsupportedVisualClaim: input.hasUnsupportedVisualClaim,
      answerLeakage: input.answerLeakage,
      verifierAgree: Boolean(input.verifier && verifierAllowsDefinitive(input.verifier)),
      captureFailure: input.captureAssessment.isCaptureFailure,
    },
    allowedAction,
  };
}

/** Coverage helper for evaluation harnesses. */
export function coverageMeetsTarget(
  definitiveRate: number,
  usefulNextActionRate: number,
  budgets: ActionRiskBudgets = DEFAULT_ACTION_RISK_BUDGETS,
): { definitiveOk: boolean; usefulOk: boolean } {
  return {
    definitiveOk: definitiveRate >= budgets.definitiveCoverageMin,
    usefulOk: usefulNextActionRate >= budgets.usefulNextActionMin,
  };
}

export function tierLabel(tier: EvidenceSufficiencyTier): string {
  return tier;
}

export type { ActionRiskBudgets, DiagnosisRiskMetrics };
