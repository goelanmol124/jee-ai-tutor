import type {
  FeasibilityGate,
  FeasibilityGateStatus,
  FeasibilityReport,
} from './types';

export interface FeasibilityInputs {
  nRandomized: number | null;
  week3RetentionRate: number | null;
  holdoutCompletionRate: number | null;
  validTelemetryRate: number | null;
  delayedArmContaminationRate: number | null;
  unresolvedSeriousPrivacyOrSafetyIncident: boolean | null;
  assessmentLinkingAcceptable: boolean | null;
  evaluatedAt?: string;
}

function rateStatus(
  value: number | null,
  threshold: number,
  higherIsBetter: boolean,
): { status: FeasibilityGateStatus; observed: string | null } {
  if (value === null) return { status: 'unknown', observed: null };
  const pass = higherIsBetter ? value >= threshold : value < threshold;
  return {
    status: pass ? 'pass' : 'fail',
    observed: `${(value * 100).toFixed(1)}%`,
  };
}

/**
 * Progression gates from the decision memo. Unknown inputs stay explicit;
 * this never pretends the pilot has been executed.
 */
export function evaluateFeasibilityGates(input: FeasibilityInputs): FeasibilityReport {
  const gates: FeasibilityGate[] = [];

  const nStatus: FeasibilityGateStatus =
    input.nRandomized === null
      ? 'unknown'
      : input.nRandomized >= 24
        ? 'pass'
        : 'fail';
  gates.push({
    id: 'min_randomized',
    label: 'At least 24 randomized',
    threshold: '>= 24',
    status: nStatus,
    observed: input.nRandomized === null ? null : String(input.nRandomized),
    detail: 'Individually randomized stratified delayed-start cohort size',
  });

  const retention = rateStatus(input.week3RetentionRate, 0.85, true);
  gates.push({
    id: 'week3_retention',
    label: 'Week-3 retention',
    threshold: '>= 85%',
    status: retention.status,
    observed: retention.observed,
    detail: 'Retention for the week-3 causal endpoint',
  });

  const holdout = rateStatus(input.holdoutCompletionRate, 0.9, true);
  gates.push({
    id: 'holdout_completion',
    label: 'Holdout completion',
    threshold: '>= 90%',
    status: holdout.status,
    observed: holdout.observed,
    detail: 'Independent linked holdout assessment completion',
  });

  const telemetry = rateStatus(input.validTelemetryRate, 0.9, true);
  gates.push({
    id: 'valid_telemetry',
    label: 'Valid telemetry',
    threshold: '>= 90%',
    status: telemetry.status,
    observed: telemetry.observed,
    detail: 'Expected heartbeat coverage in counted sessions',
  });

  const contamination = rateStatus(input.delayedArmContaminationRate, 0.1, false);
  gates.push({
    id: 'delayed_contamination',
    label: 'Delayed-arm contamination',
    threshold: '< 10%',
    status: contamination.status,
    observed: contamination.observed,
    detail: 'Confirmed delayed-arm product access before crossover',
  });

  let privacyStatus: FeasibilityGateStatus;
  let privacyObserved: string | null;
  if (input.unresolvedSeriousPrivacyOrSafetyIncident === null) {
    privacyStatus = 'unknown';
    privacyObserved = null;
  } else if (input.unresolvedSeriousPrivacyOrSafetyIncident) {
    privacyStatus = 'fail';
    privacyObserved = 'unresolved_incident';
  } else {
    privacyStatus = 'pass';
    privacyObserved = 'none';
  }
  gates.push({
    id: 'privacy_safety',
    label: 'No unresolved serious privacy/safety incident',
    threshold: 'none unresolved',
    status: privacyStatus,
    observed: privacyObserved,
    detail: 'Human-confirmed safety/privacy posture',
  });

  let linkingStatus: FeasibilityGateStatus;
  let linkingObserved: string | null;
  if (input.assessmentLinkingAcceptable === null) {
    linkingStatus = 'unknown';
    linkingObserved = null;
  } else {
    linkingStatus = input.assessmentLinkingAcceptable ? 'pass' : 'fail';
    linkingObserved = input.assessmentLinkingAcceptable ? 'acceptable' : 'unacceptable';
  }
  gates.push({
    id: 'assessment_linking',
    label: 'Assessment linking and reliability',
    threshold: 'acceptable',
    status: linkingStatus,
    observed: linkingObserved,
    detail: 'Score-linking audit before efficacy-scale claims',
  });

  const allKnown = gates.every((g) => g.status !== 'unknown');
  const allPass = allKnown && gates.every((g) => g.status === 'pass');
  const notes: string[] = [
    'Randomized feasibility pilot gates; not an efficacy success criterion',
    'Do not require a statistically significant ITT result for progression',
  ];
  if (!allKnown) {
    notes.push('One or more gates are unknown because the pilot has not been run or data are incomplete');
  }

  return {
    protocolVersion: 'pilot_feasibility_gates_v1',
    evaluatedAt: input.evaluatedAt ?? new Date(0).toISOString(),
    gates,
    allPass,
    readyForLargerTrialClaim: allPass,
    notes,
  };
}
