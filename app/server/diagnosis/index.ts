/**
 * W2 evidence-grounded photo diagnosis core.
 * Routes / persistence wiring stay outside this ownership boundary.
 */

export * from './types';
export {
  validateMultiPageInput,
  orderPages,
  MAX_DIAGNOSIS_PAGES,
  MAX_OCR_CHARS_PER_PAGE,
} from './input';
export {
  isolateUntrustedImageText,
  buildIsolatedOcrPromptBlock,
} from './injection';
export {
  scrubOptionLeakage,
  scanAnswerLeakage,
  anyAnswerLeakage,
} from './leakage';
export {
  assessCaptureSufficiency,
  preciseRequestFromIssues,
  tierAllowsDefinitive,
  tierAllowsTentative,
} from './sufficiency';
export {
  runVerifierContract,
  verifierAllowsDefinitive,
} from './verifier';
export { decideStateEligibility } from './stateEligibility';
export {
  ACTION_RISK_BUDGETS,
  decideOutputMode,
  buildRiskMetrics,
  coverageMeetsTarget,
} from './risk';
export { compileStagedDiagnosis } from './pipeline';
export { stagedToDiagnosisResult, unclearFromPreciseRequest } from './adapter';
