/**
 * Handwriting risk–coverage / adjudication evaluation schema.
 * Metadata and validation only — does not claim evaluation has been executed.
 */

export type HandwritingSplit = 'development_stress' | 'blind';

export type HandwritingSubject = 'physics' | 'chemistry' | 'mathematics';
export type HandwritingCohort = 'class_11' | 'class_12' | 'dropper';
export type ImageQualitySlice =
  | 'clean'
  | 'moderate_blur'
  | 'glare_shadow'
  | 'skew'
  | 'low_contrast'
  | 'crop_loss';
export type LanguageSlice = 'english' | 'roman_hinglish' | 'notation_only';
export type PageCountSlice = '1' | '2' | '3_plus';
export type ErrorFamilySlice =
  | 'none'
  | 'algebraic'
  | 'conceptual'
  | 'transcription_ambiguous'
  | 'multi_error'
  | 'incomplete';

export interface HandwritingBundleMeta {
  bundleId: string;
  split: HandwritingSplit;
  writerId: string;
  questionFamilyId: string;
  subject: HandwritingSubject;
  cohort: HandwritingCohort;
  pageCount: PageCountSlice;
  imageQuality: ImageQualitySlice;
  language: LanguageSlice;
  errorFamily: ErrorFamilySlice;
  alternateMethod: boolean;
  /** Independent rater ids (blind set requires adjudication metadata). */
  raterIds: string[];
  adjudicatorId: string | null;
  adjudicationStatus: 'pending' | 'agreed' | 'adjudicated' | 'not_required';
  acceptedOrAbstentionLabel: 'accepted_definitive' | 'abstention' | 'tentative' | 'unset';
}

export interface RiskCoveragePoint {
  coverage: number;
  selectiveRisk: number;
  nRetained: number;
}

export interface RiskCoverageCurve {
  curveId: string;
  split: HandwritingSplit;
  points: RiskCoveragePoint[];
  areaUnderRiskCoverage: number | null;
  sliceKey: string | null;
}

export interface HandwritingEvalSchema {
  schemaVersion: 'handwriting_eval_v1';
  targets: {
    minDevelopmentStressBundles: 100;
    minBlindAdjudicatedBundles: 300;
    writerDisjoint: true;
    questionFamilyDisjoint: true;
  };
  riskBudgets: {
    insufficientAcceptedAsReadable: 0.05;
    falsePraise: 0.01;
    falseCorrection: 0.02;
    wrongFirstCausalErrorAmongAccepted: 0.1;
    unsupportedPersistentStateUpdate: 0.005;
    answerLeakage: 0;
  };
  coverageTargets: {
    definitiveAmongSufficientNatural: 0.7;
    usefulNextAction: 0.9;
  };
  requiredSlices: Array<
    | 'subject'
    | 'cohort'
    | 'page_count'
    | 'image_quality'
    | 'language'
    | 'alternate_method'
    | 'error_family'
  >;
  bundles: HandwritingBundleMeta[];
  riskCoverageCurves: RiskCoverageCurve[];
}

export interface DisjointnessReport {
  writerDisjoint: boolean;
  questionFamilyDisjoint: boolean;
  sharedWriterIds: string[];
  sharedQuestionFamilyIds: string[];
}

export interface HandwritingEvalInventory {
  developmentStressCount: number;
  blindCount: number;
  meetsDevelopmentStressTarget: boolean;
  meetsBlindTarget: boolean;
  disjointness: DisjointnessReport;
  missingSliceKeys: string[];
  readyForBlindGateClaim: boolean;
  warnings: string[];
}

export function createEmptyHandwritingEvalSchema(): HandwritingEvalSchema {
  return {
    schemaVersion: 'handwriting_eval_v1',
    targets: {
      minDevelopmentStressBundles: 100,
      minBlindAdjudicatedBundles: 300,
      writerDisjoint: true,
      questionFamilyDisjoint: true,
    },
    riskBudgets: {
      insufficientAcceptedAsReadable: 0.05,
      falsePraise: 0.01,
      falseCorrection: 0.02,
      wrongFirstCausalErrorAmongAccepted: 0.1,
      unsupportedPersistentStateUpdate: 0.005,
      answerLeakage: 0,
    },
    coverageTargets: {
      definitiveAmongSufficientNatural: 0.7,
      usefulNextAction: 0.9,
    },
    requiredSlices: [
      'subject',
      'cohort',
      'page_count',
      'image_quality',
      'language',
      'alternate_method',
      'error_family',
    ],
    bundles: [],
    riskCoverageCurves: [],
  };
}

export function checkWriterQuestionFamilyDisjointness(
  bundles: readonly HandwritingBundleMeta[],
): DisjointnessReport {
  const devWriters = new Set<string>();
  const blindWriters = new Set<string>();
  const devFamilies = new Set<string>();
  const blindFamilies = new Set<string>();

  for (const b of bundles) {
    if (b.split === 'development_stress') {
      devWriters.add(b.writerId);
      devFamilies.add(b.questionFamilyId);
    } else {
      blindWriters.add(b.writerId);
      blindFamilies.add(b.questionFamilyId);
    }
  }

  const sharedWriterIds = [...devWriters].filter((id) => blindWriters.has(id)).sort();
  const sharedQuestionFamilyIds = [...devFamilies]
    .filter((id) => blindFamilies.has(id))
    .sort();

  return {
    writerDisjoint: sharedWriterIds.length === 0,
    questionFamilyDisjoint: sharedQuestionFamilyIds.length === 0,
    sharedWriterIds,
    sharedQuestionFamilyIds,
  };
}

function sliceCoverageKeys(bundles: readonly HandwritingBundleMeta[]): Set<string> {
  const keys = new Set<string>();
  for (const b of bundles) {
    keys.add(`subject:${b.subject}`);
    keys.add(`cohort:${b.cohort}`);
    keys.add(`page_count:${b.pageCount}`);
    keys.add(`image_quality:${b.imageQuality}`);
    keys.add(`language:${b.language}`);
    keys.add(`alternate_method:${b.alternateMethod ? 'yes' : 'no'}`);
    keys.add(`error_family:${b.errorFamily}`);
  }
  return keys;
}

const EXPECTED_SLICE_EXAMPLES = [
  'subject:physics',
  'subject:chemistry',
  'subject:mathematics',
  'cohort:class_11',
  'cohort:class_12',
  'cohort:dropper',
  'language:english',
  'language:roman_hinglish',
];

/**
 * Inventory check against decision-memo targets. Returns readiness false when
 * counts/disjointness are unmet — does not fabricate completed evaluation.
 */
export function inventoryHandwritingEval(
  schema: HandwritingEvalSchema,
): HandwritingEvalInventory {
  const warnings: string[] = [];
  const developmentStressCount = schema.bundles.filter(
    (b) => b.split === 'development_stress',
  ).length;
  const blindBundles = schema.bundles.filter((b) => b.split === 'blind');
  const blindCount = blindBundles.length;
  const adjudicatedBlind = blindBundles.filter(
    (b) =>
      b.adjudicationStatus === 'agreed' ||
      b.adjudicationStatus === 'adjudicated',
  ).length;

  if (blindCount > 0 && adjudicatedBlind < blindCount) {
    warnings.push(
      `${blindCount - adjudicatedBlind} blind bundles lack completed adjudication`,
    );
  }

  const disjointness = checkWriterQuestionFamilyDisjointness(schema.bundles);
  if (!disjointness.writerDisjoint) {
    warnings.push(
      `Writer leakage across splits: ${disjointness.sharedWriterIds.join(', ')}`,
    );
  }
  if (!disjointness.questionFamilyDisjoint) {
    warnings.push(
      `Question-family leakage across splits: ${disjointness.sharedQuestionFamilyIds.join(', ')}`,
    );
  }

  const present = sliceCoverageKeys(schema.bundles);
  const missingSliceKeys = EXPECTED_SLICE_EXAMPLES.filter((k) => !present.has(k));
  if (missingSliceKeys.length > 0) {
    warnings.push(`Missing recommended slice keys: ${missingSliceKeys.join(', ')}`);
  }

  const meetsDevelopmentStressTarget =
    developmentStressCount >= schema.targets.minDevelopmentStressBundles;
  const meetsBlindTarget =
    adjudicatedBlind >= schema.targets.minBlindAdjudicatedBundles;

  if (!meetsDevelopmentStressTarget) {
    warnings.push(
      `Development/stress inventory ${developmentStressCount} < ${schema.targets.minDevelopmentStressBundles}`,
    );
  }
  if (!meetsBlindTarget) {
    warnings.push(
      `Blind adjudicated inventory ${adjudicatedBlind} < ${schema.targets.minBlindAdjudicatedBundles}`,
    );
  }

  const readyForBlindGateClaim =
    meetsDevelopmentStressTarget &&
    meetsBlindTarget &&
    disjointness.writerDisjoint &&
    disjointness.questionFamilyDisjoint;

  return {
    developmentStressCount,
    blindCount,
    meetsDevelopmentStressTarget,
    meetsBlindTarget,
    disjointness,
    missingSliceKeys,
    readyForBlindGateClaim,
    warnings,
  };
}

export function attachRiskCoverageCurve(
  schema: HandwritingEvalSchema,
  curve: RiskCoverageCurve,
): HandwritingEvalSchema {
  return {
    ...schema,
    riskCoverageCurves: [...schema.riskCoverageCurves, curve],
  };
}
