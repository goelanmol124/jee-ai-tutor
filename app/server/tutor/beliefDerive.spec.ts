import { describe, expect, it } from 'vitest';
import { deriveBeliefFromLayers } from './beliefDerive';

describe('deriveBeliefFromLayers', () => {
  it('increases toward strong evidence chains', () => {
    const high = deriveBeliefFromLayers({
      observed: 'applied_correctly',
      formulaUnderstanding: 'derives_it',
      applicationFlexibility: 'transfers',
      confidence: 'high',
      recentEvidence: [
        { at: '1', source: 'attempt_step', outcome: 'applied_well', note: 'ok' },
        { at: '2', source: 'attempt_step', outcome: 'applied_well', note: 'ok' },
      ],
      mistakePatterns: [],
    });
    expect(high).toBeGreaterThanOrEqual(0.85);

    const low = deriveBeliefFromLayers({
      observed: 'failed',
      confidence: 'low',
      recentEvidence: [{ at: '1', source: 'attempt_step', outcome: 'failed', note: 'x' }],
      mistakePatterns: [],
    });
    expect(low).toBeLessThan(0.65);
  });
});
