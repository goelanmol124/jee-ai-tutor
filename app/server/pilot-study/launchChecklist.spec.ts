import { describe, expect, it } from 'vitest';
import { buildLaunchChecklist } from './launchChecklist';

describe('buildLaunchChecklist', () => {
  it('keeps human blockers unresolved and launch uncleared when pilot not run', () => {
    const checklist = buildLaunchChecklist(
      {
        stratifiedAssignmentModule: true,
        blindedAnalysisManifest: true,
        holdoutBankBoundary: true,
        activeTimeDerivation: true,
        feasibilityGates: true,
        handwritingEvalSchema: true,
        pilotExecuted: false,
      },
      '2026-07-18T00:00:00.000Z',
    );

    expect(checklist.softwareReady).toBe(true);
    expect(checklist.launchCleared).toBe(false);
    expect(checklist.unresolvedHumanBlockers.length).toBe(8);
    expect(
      checklist.unresolvedHumanBlockers.map((b) => b.id),
    ).toEqual(
      expect.arrayContaining([
        'indian_operator_entity',
        'indian_counsel_memo',
        'ethics_body',
        'holdout_calibration_source',
      ]),
    );
    expect(
      checklist.items.find((i) => i.id === 'op_pilot_not_run')?.resolved,
    ).toBe(false);
  });

  it('still fails launch if software signals are incomplete', () => {
    const checklist = buildLaunchChecklist({
      stratifiedAssignmentModule: false,
      blindedAnalysisManifest: true,
      holdoutBankBoundary: true,
      activeTimeDerivation: true,
      feasibilityGates: true,
      handwritingEvalSchema: true,
      pilotExecuted: false,
    });
    expect(checklist.softwareReady).toBe(false);
    expect(checklist.launchCleared).toBe(false);
  });
});
