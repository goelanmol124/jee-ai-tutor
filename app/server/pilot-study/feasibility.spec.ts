import { describe, expect, it } from 'vitest';
import { evaluateFeasibilityGates } from './feasibility';

describe('evaluateFeasibilityGates', () => {
  it('marks unknown gates when the pilot has not been run', () => {
    const report = evaluateFeasibilityGates({
      nRandomized: null,
      week3RetentionRate: null,
      holdoutCompletionRate: null,
      validTelemetryRate: null,
      delayedArmContaminationRate: null,
      unresolvedSeriousPrivacyOrSafetyIncident: null,
      assessmentLinkingAcceptable: null,
      evaluatedAt: '2026-07-18T00:00:00.000Z',
    });
    expect(report.allPass).toBe(false);
    expect(report.readyForLargerTrialClaim).toBe(false);
    expect(report.gates.every((g) => g.status === 'unknown')).toBe(true);
  });

  it('passes only when all decision-memo thresholds are met', () => {
    const report = evaluateFeasibilityGates({
      nRandomized: 30,
      week3RetentionRate: 0.9,
      holdoutCompletionRate: 0.95,
      validTelemetryRate: 0.92,
      delayedArmContaminationRate: 0.05,
      unresolvedSeriousPrivacyOrSafetyIncident: false,
      assessmentLinkingAcceptable: true,
    });
    expect(report.allPass).toBe(true);
    expect(report.gates.find((g) => g.id === 'min_randomized')?.status).toBe('pass');
  });

  it('fails contamination at or above 10%', () => {
    const report = evaluateFeasibilityGates({
      nRandomized: 30,
      week3RetentionRate: 0.9,
      holdoutCompletionRate: 0.95,
      validTelemetryRate: 0.92,
      delayedArmContaminationRate: 0.1,
      unresolvedSeriousPrivacyOrSafetyIncident: false,
      assessmentLinkingAcceptable: true,
    });
    expect(report.gates.find((g) => g.id === 'delayed_contamination')?.status).toBe(
      'fail',
    );
    expect(report.allPass).toBe(false);
  });
});
