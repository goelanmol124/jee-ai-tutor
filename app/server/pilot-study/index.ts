export { assignStratifiedDelayedStart, armAccessWindow, hasProductAccessAtWeek } from './assignment';
export {
  createBlindMapping,
  freezeBlindMapping,
  toBlindedLabel,
  fromBlindedLabel,
  assertBlindedAnalysisDataset,
} from './blinding';
export {
  buildDraftAnalysisManifest,
  freezeAnalysisManifest,
  assertManifestFrozen,
  manifestContentHash,
} from './analysisManifest';
export {
  HoldoutLeakError,
  createHoldoutBank,
  freezeHoldoutBank,
  isHoldoutItem,
  assertTutoringEligible,
  filterTutoringEligible,
  assertDisjointBanks,
} from './holdoutBank';
export {
  buildWeek3IttAnalysisContract,
  computeAggregateEfficiency,
} from './outcomes';
export { evaluateFeasibilityGates } from './feasibility';
export type { FeasibilityInputs } from './feasibility';
export {
  createEmptyHandwritingEvalSchema,
  checkWriterQuestionFamilyDisjointness,
  inventoryHandwritingEval,
  attachRiskCoverageCurve,
} from './handwritingEval';
export type {
  HandwritingBundleMeta,
  HandwritingEvalSchema,
  HandwritingEvalInventory,
  RiskCoverageCurve,
} from './handwritingEval';
export { buildLaunchChecklist } from './launchChecklist';
export type { SoftwareLaunchSignals } from './launchChecklist';
export type * from './types';
