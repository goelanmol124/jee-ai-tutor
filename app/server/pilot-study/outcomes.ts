import type {
  AggregateEfficiencyResult,
  EfficiencyObservation,
  Week3IttAnalysisContract,
  Week3IttObservation,
} from './types';

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Primary causal analysis data contract: week-3 baseline-adjusted ITT on
 * linked holdout points. This builds the analysis table and unadjusted
 * preview statistics; it does not claim the pilot has been run.
 */
export function buildWeek3IttAnalysisContract(
  observations: Week3IttObservation[],
): Week3IttAnalysisContract {
  const warnings: string[] = [];
  const withOutcome = observations.filter((o) => o.week3LinkedPoints !== null);
  const early = withOutcome.filter((o) => o.arm === 'early');
  const delayed = withOutcome.filter((o) => o.arm === 'delayed');

  if (observations.length < 24) {
    warnings.push('Fewer than 24 randomized observations in analysis set');
  }
  if (withOutcome.length < observations.length) {
    warnings.push(
      `${observations.length - withOutcome.length} randomized students missing week-3 outcome`,
    );
  }

  const earlyMean = mean(early.map((o) => o.week3LinkedPoints as number));
  const delayedMean = mean(delayed.map((o) => o.week3LinkedPoints as number));
  const unadjusted =
    earlyMean !== null && delayedMean !== null ? earlyMean - delayedMean : null;

  return {
    estimand: 'week3_baseline_adjusted_itt_linked_holdout_points',
    claimLanguage: 'randomized_feasibility_pilot_not_efficacy_trial',
    model: 'Y_week3 ~ arm + baseline + allocation_block + form',
    observations: observations.slice(),
    nRandomized: observations.length,
    nWithWeek3Outcome: withOutcome.length,
    earlyMeanWeek3: earlyMean,
    delayedMeanWeek3: delayedMean,
    unadjustedMeanDifference: unadjusted,
    warnings,
  };
}

/**
 * Descriptive north-star: linked holdout gain per valid product-active hour.
 * Undefined when hours are missing; students below h_min are excluded from the
 * aggregate ratio, never coerced to zero efficiency.
 */
export function computeAggregateEfficiency(
  observations: EfficiencyObservation[],
  hMinHours = 0.5,
): AggregateEfficiencyResult {
  const warnings: string[] = [
    'Descriptive metric only; not a causal estimand',
  ];
  let nExcludedBelowHMin = 0;
  let nUndefinedMissingHours = 0;
  let numeratorSum = 0;
  let denominatorSum = 0;
  let nIncluded = 0;

  for (const obs of observations) {
    if (obs.validActiveHours === null || !obs.telemetryComplete) {
      nUndefinedMissingHours += 1;
      continue;
    }
    if (obs.linkedGain === null) {
      warnings.push(`Student ${obs.studentId} missing linked gain; excluded`);
      continue;
    }
    if (obs.validActiveHours < hMinHours) {
      nExcludedBelowHMin += 1;
      continue;
    }
    numeratorSum += obs.linkedGain;
    denominatorSum += obs.validActiveHours;
    nIncluded += 1;
  }

  const aggregateRatio =
    nIncluded > 0 && denominatorSum > 0 ? numeratorSum / denominatorSum : null;

  if (nUndefinedMissingHours > 0) {
    warnings.push(
      `${nUndefinedMissingHours} students have missing/incomplete telemetry; not treated as zero use`,
    );
  }

  return {
    metric: 'observed_linked_holdout_gain_per_valid_product_active_hour',
    claimLanguage: 'descriptive_not_causal',
    hMinHours: 0.5,
    numeratorSum: nIncluded > 0 ? numeratorSum : null,
    denominatorSum: nIncluded > 0 ? denominatorSum : null,
    aggregateRatio,
    nIncluded,
    nExcludedBelowHMin,
    nUndefinedMissingHours,
    warnings,
  };
}
