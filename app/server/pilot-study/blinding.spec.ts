import { describe, expect, it } from 'vitest';
import {
  assertBlindedAnalysisDataset,
  createBlindMapping,
  freezeBlindMapping,
  fromBlindedLabel,
  toBlindedLabel,
} from './blinding';
import {
  buildDraftAnalysisManifest,
  freezeAnalysisManifest,
  assertManifestFrozen,
} from './analysisManifest';

describe('blinding and analysis manifest', () => {
  it('creates a deterministic blind mapping from seed', () => {
    const a = createBlindMapping({ seed: 'freeze-me' });
    const b = createBlindMapping({ seed: 'freeze-me' });
    expect(a).toEqual(b);
    expect(new Set([a.early, a.delayed]).size).toBe(2);
  });

  it('maps arms to blinded labels and refuses early unblind', () => {
    const mapping = createBlindMapping({ seed: 'x' });
    const label = toBlindedLabel('early', mapping);
    expect(label === 'arm_A' || label === 'arm_B').toBe(true);
    expect(() => fromBlindedLabel(label, mapping)).toThrow(/frozen/);
    const frozen = freezeBlindMapping(mapping);
    expect(fromBlindedLabel(label, frozen)).toBe('early');
  });

  it('freezes a versioned analysis manifest', () => {
    const draft = buildDraftAnalysisManifest({
      assignmentSeed: 'pilot-seed',
      holdoutBankVersion: 'holdout_v1',
      tutoringBankVersion: 'tutor_v1',
    });
    expect(draft.status).toBe('draft');
    expect(draft.primaryEstimand).toBe(
      'week3_baseline_adjusted_itt_linked_holdout_points',
    );
    expect(draft.idleCapMinutesPrimary).toBe(5);
    expect(draft.idleCapMinutesSensitivity).toEqual([2, 10]);

    const frozen = freezeAnalysisManifest(draft, '2026-07-18T00:00:00.000Z');
    expect(frozen.status).toBe('frozen');
    expect(frozen.blindMapping.frozen).toBe(true);
    assertManifestFrozen(frozen);
    expect(() => freezeAnalysisManifest(frozen, 'later')).toThrow(/already frozen/);
  });

  it('requires frozen mapping for blinded analysis datasets', () => {
    const mapping = freezeBlindMapping(createBlindMapping({ seed: 'y' }));
    expect(() =>
      assertBlindedAnalysisDataset([{ armLabel: 'arm_A' }, { armLabel: 'arm_B' }], mapping),
    ).not.toThrow();
  });
});
