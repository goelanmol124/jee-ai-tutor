/** Pilot cohort strata locked in the decision memo. */
export type PilotStratum = 'class_11' | 'class_12' | 'dropper';

/** Randomized delayed-start arms. */
export type PilotArm = 'early' | 'delayed';

/** Opaque analysis labels used until unblinding. */
export type BlindedArmLabel = 'arm_A' | 'arm_B';

export interface EligibleStudent {
  studentId: string;
  stratum: PilotStratum;
  /** Pre-randomization linked holdout baseline score. */
  baselineScore: number;
  /** Optional connected-group id when household/study pairs must share arm. */
  connectedGroupId?: string;
}

export interface AssignmentRecord {
  studentId: string;
  stratum: PilotStratum;
  baselineScore: number;
  arm: PilotArm;
  allocationBlockId: string;
  connectedGroupId?: string;
}

export interface StratifiedAssignmentResult {
  protocolVersion: 'pilot_delayed_start_v1';
  seed: string;
  randomizedAt: string;
  nRandomized: number;
  assignments: AssignmentRecord[];
  stratumCounts: Record<PilotStratum, { early: number; delayed: number; total: number }>;
  warnings: string[];
}

export interface BlindMapping {
  /** Maps true arm → blinded label. Frozen with the analysis manifest. */
  early: BlindedArmLabel;
  delayed: BlindedArmLabel;
  frozen: boolean;
  mappingId: string;
}

export type AnalysisManifestStatus = 'draft' | 'frozen';

export interface AnalysisManifest {
  manifestVersion: string;
  status: AnalysisManifestStatus;
  frozenAt: string | null;
  assignmentSeed: string;
  blindMapping: BlindMapping;
  primaryEstimand: 'week3_baseline_adjusted_itt_linked_holdout_points';
  operationalNorthStar: 'observed_linked_holdout_gain_per_valid_product_active_hour';
  activeTimeAlgorithmVersion: 'foreground_heartbeat_v1';
  idleCapMinutesPrimary: 5;
  idleCapMinutesSensitivity: [2, 10];
  heartbeatIntervalSeconds: 15;
  hiddenCutoffSeconds: 30;
  exclusionRules: string[];
  inclusionRules: string[];
  content: {
    holdoutBankVersion: string;
    tutoringBankVersion: string;
  };
  notes: string;
}

export interface HoldoutBank {
  bankVersion: string;
  itemIds: readonly string[];
  frozen: boolean;
}

export interface Week3IttObservation {
  studentId: string;
  /** True arm; analysis code should prefer blinded labels until freeze. */
  arm: PilotArm;
  allocationBlockId: string;
  stratum: PilotStratum;
  baselineLinkedPoints: number;
  week3LinkedPoints: number | null;
  formId: string;
  /** Missingness reason when week3LinkedPoints is null. */
  missingReason?: string;
}

export interface Week3IttAnalysisContract {
  estimand: 'week3_baseline_adjusted_itt_linked_holdout_points';
  claimLanguage: 'randomized_feasibility_pilot_not_efficacy_trial';
  model:
    | 'Y_week3 ~ arm + baseline + allocation_block + form';
  observations: Week3IttObservation[];
  nRandomized: number;
  nWithWeek3Outcome: number;
  earlyMeanWeek3: number | null;
  delayedMeanWeek3: number | null;
  /** Unadjusted mean difference (early − delayed); descriptive preview only. */
  unadjustedMeanDifference: number | null;
  warnings: string[];
}

export interface EfficiencyObservation {
  studentId: string;
  linkedGain: number | null;
  validActiveHours: number | null;
  telemetryComplete: boolean;
}

export interface AggregateEfficiencyResult {
  metric: 'observed_linked_holdout_gain_per_valid_product_active_hour';
  claimLanguage: 'descriptive_not_causal';
  hMinHours: 0.5;
  numeratorSum: number | null;
  denominatorSum: number | null;
  aggregateRatio: number | null;
  nIncluded: number;
  nExcludedBelowHMin: number;
  nUndefinedMissingHours: number;
  warnings: string[];
}

export type FeasibilityGateId =
  | 'min_randomized'
  | 'week3_retention'
  | 'holdout_completion'
  | 'valid_telemetry'
  | 'delayed_contamination'
  | 'privacy_safety'
  | 'assessment_linking';

export type FeasibilityGateStatus = 'pass' | 'fail' | 'unknown' | 'blocked_human';

export interface FeasibilityGate {
  id: FeasibilityGateId;
  label: string;
  threshold: string;
  status: FeasibilityGateStatus;
  observed: string | null;
  detail: string;
}

export interface FeasibilityReport {
  protocolVersion: 'pilot_feasibility_gates_v1';
  evaluatedAt: string;
  gates: FeasibilityGate[];
  allPass: boolean;
  readyForLargerTrialClaim: boolean;
  notes: string[];
}

export type LaunchBlockerKind = 'human_external' | 'software' | 'operational';

export interface LaunchChecklistItem {
  id: string;
  kind: LaunchBlockerKind;
  label: string;
  required: boolean;
  resolved: boolean;
  owner: string;
  /** Explicit unresolved reason; never invent a resolved state. */
  unresolvedReason: string | null;
}

export interface LaunchChecklist {
  checklistVersion: 'pilot_launch_checklist_v1';
  generatedAt: string;
  items: LaunchChecklistItem[];
  unresolvedHumanBlockers: LaunchChecklistItem[];
  softwareReady: boolean;
  launchCleared: boolean;
}
