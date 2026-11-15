import { describe, expect, it } from 'vitest';
import {
  buildWeek3IttAnalysisContract,
  computeAggregateEfficiency,
} from './outcomes';
import type { EfficiencyObservation, Week3IttObservation } from './types';

describe('week-3 ITT analysis contract', () => {
  it('builds baseline-adjusted ITT contract without claiming efficacy', () => {
    const observations: Week3IttObservation[] = [];
    for (let i = 0; i < 24; i++) {
      observations.push({
        studentId: `s${i}`,
        arm: i % 2 === 0 ? 'early' : 'delayed',
        allocationBlockId: `b${Math.floor(i / 2)}`,
        stratum: 'class_11',
        baselineLinkedPoints: 50 + i,
        week3LinkedPoints: 55 + i + (i % 2 === 0 ? 5 : 0),
        formId: 'form_w3_a',
      });
    }
    const contract = buildWeek3IttAnalysisContract(observations);
    expect(contract.estimand).toBe('week3_baseline_adjusted_itt_linked_holdout_points');
    expect(contract.claimLanguage).toBe(
      'randomized_feasibility_pilot_not_efficacy_trial',
    );
    expect(contract.nRandomized).toBe(24);
    expect(contract.nWithWeek3Outcome).toBe(24);
    expect(contract.unadjustedMeanDifference).not.toBeNull();
    expect(contract.model).toContain('baseline');
  });

  it('tracks missing week-3 outcomes without zero-filling', () => {
    const observations: Week3IttObservation[] = [
      {
        studentId: 'a',
        arm: 'early',
        allocationBlockId: 'b0',
        stratum: 'dropper',
        baselineLinkedPoints: 40,
        week3LinkedPoints: null,
        formId: 'f',
        missingReason: 'unreachable',
      },
      {
        studentId: 'b',
        arm: 'delayed',
        allocationBlockId: 'b0',
        stratum: 'dropper',
        baselineLinkedPoints: 42,
        week3LinkedPoints: 50,
        formId: 'f',
      },
    ];
    const contract = buildWeek3IttAnalysisContract(observations);
    expect(contract.nWithWeek3Outcome).toBe(1);
    expect(contract.warnings.some((w) => w.includes('missing'))).toBe(true);
  });
});

describe('aggregate efficiency', () => {
  it('computes descriptive gain per valid active hour and skips missing telemetry', () => {
    const observations: EfficiencyObservation[] = [
      {
        studentId: 'u1',
        linkedGain: 10,
        validActiveHours: 2,
        telemetryComplete: true,
      },
      {
        studentId: 'u2',
        linkedGain: 5,
        validActiveHours: 1,
        telemetryComplete: true,
      },
      {
        studentId: 'u3',
        linkedGain: 8,
        validActiveHours: null,
        telemetryComplete: false,
      },
      {
        studentId: 'u4',
        linkedGain: 3,
        validActiveHours: 0.2,
        telemetryComplete: true,
      },
    ];
    const result = computeAggregateEfficiency(observations);
    expect(result.claimLanguage).toBe('descriptive_not_causal');
    expect(result.nIncluded).toBe(2);
    expect(result.nUndefinedMissingHours).toBe(1);
    expect(result.nExcludedBelowHMin).toBe(1);
    expect(result.aggregateRatio).toBeCloseTo(15 / 3, 8);
    expect(result.warnings.some((w) => w.includes('not treated as zero'))).toBe(
      true,
    );
  });
});
