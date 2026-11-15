import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVIEW_BUDGET,
  DEFAULT_STRETCH_PRIOR,
  FALSE_ADVANCEMENT_COST_RATIOS,
  beliefFloorForAdvancement,
  cohortObjectivePreference,
  deferReviewWithoutPenalty,
  emptyReviewBudgetState,
  evaluateReviewBudget,
  requiredDelayedIndependentSuccesses,
  stretchFitForAssistance,
} from './policy';

describe('review budget and cohort defaults', () => {
  it('allows reviews under 20% and caps at 30% without learner choice', () => {
    const under = evaluateReviewBudget({
      sessionItemCount: 10,
      reviewItemsUsed: 1,
      deferredReviewConceptIds: [],
    });
    expect(under.allow).toBe(true);

    const atDefault = evaluateReviewBudget({
      sessionItemCount: 10,
      reviewItemsUsed: 2,
      deferredReviewConceptIds: [],
    });
    expect(atDefault.allow).toBe(false);
    if (!atDefault.allow) expect(atDefault.suggestDefer).toBe(true);

    const atCap = evaluateReviewBudget({
      sessionItemCount: 10,
      reviewItemsUsed: 3,
      deferredReviewConceptIds: [],
    });
    expect(atCap.allow).toBe(false);

    const optedIn = evaluateReviewBudget({
      sessionItemCount: 10,
      reviewItemsUsed: 5,
      deferredReviewConceptIds: [],
      learnerChoseMoreReview: true,
    });
    expect(optedIn.allow).toBe(true);
  });

  it('defers reviews without mutating lapse counters (penalty-free)', () => {
    const budget = emptyReviewBudgetState();
    const next = deferReviewWithoutPenalty(budget, 'c1');
    expect(next.deferredReviewConceptIds).toEqual(['c1']);
    expect(next.reviewItemsUsed).toBe(0);
    expect(DEFAULT_REVIEW_BUDGET.defaultShare).toBe(0.2);
    expect(DEFAULT_REVIEW_BUDGET.maxShare).toBe(0.3);
  });

  it('keeps 80/20 as configurable predicted-success prior per assistance level', () => {
    expect(DEFAULT_STRETCH_PRIOR.targetSuccessByAssistance.independent).toBe(0.8);
    const onTarget = stretchFitForAssistance(0.8, 'independent');
    const off = stretchFitForAssistance(0.4, 'independent');
    expect(onTarget).toBeGreaterThan(off);
    expect(onTarget).toBeCloseTo(1, 5);
  });

  it('encodes false-advancement cost ratios 4:1 / 2:1 / 1:1', () => {
    expect(FALSE_ADVANCEMENT_COST_RATIOS.critical_high_centrality).toBe(4);
    expect(FALSE_ADVANCEMENT_COST_RATIOS.normal_prerequisite).toBe(2);
    expect(FALSE_ADVANCEMENT_COST_RATIOS.isolated_recall).toBe(1);
    expect(requiredDelayedIndependentSuccesses('critical_high_centrality')).toBe(4);
    expect(requiredDelayedIndependentSuccesses('normal_prerequisite')).toBe(2);
    expect(requiredDelayedIndependentSuccesses('isolated_recall')).toBe(1);
    expect(beliefFloorForAdvancement('critical_high_centrality')).toBeGreaterThan(
      beliefFloorForAdvancement('isolated_recall'),
    );
  });

  it('orders cohort objectives with Class 11 foundations and dropper exam mix', () => {
    expect(cohortObjectivePreference('class_11')[0]).toBe('orientation');
    expect(cohortObjectivePreference('class_12')[0]).toBe('critical_repair');
    expect(cohortObjectivePreference('dropper')).toContain('exam_integration');
    expect(cohortObjectivePreference('dropper').indexOf('exam_integration')).toBeLessThan(
      cohortObjectivePreference('dropper').indexOf('orientation'),
    );
  });
});
