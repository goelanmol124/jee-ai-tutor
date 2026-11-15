import type {
  AssistanceLevel,
  FalseAdvancementClass,
  FalseAdvancementCostRatios,
  LearnerCohort,
  ReviewBudgetConfig,
  ReviewBudgetState,
  StretchPriorConfig,
  TurnObjective,
} from './types';

/** Configurable 80/20 prior: predicted success at a specified assistance level. */
export const DEFAULT_STRETCH_PRIOR: StretchPriorConfig = {
  targetSuccessByAssistance: {
    independent: 0.8,
    one_hint: 0.8,
    splice: 0.8,
    worked_example_transition: 0.8,
    review: 0.8,
  },
  bandHalfWidthByAssistance: {
    independent: 0.25,
    one_hint: 0.3,
    splice: 0.35,
    worked_example_transition: 0.4,
    review: 0.35,
  },
};

export const DEFAULT_REVIEW_BUDGET: ReviewBudgetConfig = {
  defaultShare: 0.2,
  maxShare: 0.3,
};

/** Initialize policy thresholds; recalibrate later from delayed independent attempts. */
export const FALSE_ADVANCEMENT_COST_RATIOS: FalseAdvancementCostRatios = {
  critical_high_centrality: 4,
  normal_prerequisite: 2,
  isolated_recall: 1,
};

export function emptyReviewBudgetState(): ReviewBudgetState {
  return {
    sessionItemCount: 0,
    reviewItemsUsed: 0,
    deferredReviewConceptIds: [],
    learnerChoseMoreReview: false,
  };
}

export function reviewShareUsed(budget: ReviewBudgetState): number {
  if (budget.sessionItemCount <= 0) return 0;
  return budget.reviewItemsUsed / budget.sessionItemCount;
}

export type ReviewBudgetDecision =
  | { allow: true; reason: string }
  | { allow: false; reason: string; suggestDefer: true };

/**
 * Reviews get ~20% by default and never more than 30% without explicit choice.
 * Deferral is always available without penalty (caller records deferred ids).
 */
export function evaluateReviewBudget(
  budget: ReviewBudgetState,
  config: ReviewBudgetConfig = DEFAULT_REVIEW_BUDGET,
): ReviewBudgetDecision {
  if (budget.learnerChoseMoreReview) {
    return { allow: true, reason: 'learner_opted_into_extra_review' };
  }
  const share = reviewShareUsed(budget);
  if (share >= config.maxShare) {
    return {
      allow: false,
      reason: 'review_cap_30_percent',
      suggestDefer: true,
    };
  }
  if (share >= config.defaultShare) {
    return {
      allow: false,
      reason: 'review_default_budget_exhausted',
      suggestDefer: true,
    };
  }
  return { allow: true, reason: 'within_review_budget' };
}

/** Penalty-free deferral: record id, never bump lapses. */
export function deferReviewWithoutPenalty(
  budget: ReviewBudgetState,
  conceptId: string,
): ReviewBudgetState {
  if (budget.deferredReviewConceptIds.includes(conceptId)) return budget;
  return {
    ...budget,
    deferredReviewConceptIds: [...budget.deferredReviewConceptIds, conceptId],
  };
}

/**
 * Soft fit of predicted success to the configurable prior for an assistance level.
 * Returns 0..1; diagnostic / due-review callers may ignore this band intentionally.
 */
export function stretchFitForAssistance(
  predictedSuccess: number,
  assistance: AssistanceLevel,
  config: StretchPriorConfig = DEFAULT_STRETCH_PRIOR,
): number {
  const target = config.targetSuccessByAssistance[assistance];
  const half = Math.max(1e-6, config.bandHalfWidthByAssistance[assistance]);
  const d = Math.abs(predictedSuccess - target);
  return Math.max(0, 1 - d / half);
}

/**
 * Minimum independent delayed-transfer successes required before treating readiness
 * as established, scaled by false-advancement cost ratio.
 */
export function requiredDelayedIndependentSuccesses(
  kind: FalseAdvancementClass,
  ratios: FalseAdvancementCostRatios = FALSE_ADVANCEMENT_COST_RATIOS,
): number {
  return Math.max(1, Math.ceil(ratios[kind]));
}

export function beliefFloorForAdvancement(
  kind: FalseAdvancementClass,
  ratios: FalseAdvancementCostRatios = FALSE_ADVANCEMENT_COST_RATIOS,
): number {
  const ratio = ratios[kind];
  // Higher false-advancement cost → stricter belief floor (0.70 / 0.80 / 0.90).
  if (ratio >= 4) return 0.9;
  if (ratio >= 2) return 0.8;
  return 0.7;
}

/** Cohort-aware default objective preference (lower index = higher priority). */
export function cohortObjectivePreference(cohort: LearnerCohort): TurnObjective[] {
  switch (cohort) {
    case 'class_11':
      return [
        'orientation',
        'critical_repair',
        'diagnostic_probe',
        'acquisition',
        'due_review',
        'independent_application',
        'discrimination',
        'exam_integration',
      ];
    case 'class_12':
      return [
        'critical_repair',
        'independent_application',
        'diagnostic_probe',
        'acquisition',
        'due_review',
        'discrimination',
        'exam_integration',
        'orientation',
      ];
    case 'dropper':
      return [
        'critical_repair',
        'discrimination',
        'exam_integration',
        'independent_application',
        'diagnostic_probe',
        'due_review',
        'acquisition',
        'orientation',
      ];
    default: {
      const _exhaustive: never = cohort;
      return _exhaustive;
    }
  }
}

export function cohortDefaultAssistance(cohort: LearnerCohort): AssistanceLevel {
  switch (cohort) {
    case 'class_11':
      return 'worked_example_transition';
    case 'class_12':
      return 'one_hint';
    case 'dropper':
      return 'independent';
    default: {
      const _exhaustive: never = cohort;
      return _exhaustive;
    }
  }
}

/** Class 12 only repairs blocking backlog; Class 11 emphasizes foundations. */
export function cohortAllowsNonBlockingRepair(cohort: LearnerCohort): boolean {
  return cohort !== 'class_12';
}
