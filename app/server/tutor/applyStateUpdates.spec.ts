import { describe, expect, it } from 'vitest';
import { defaultUnifiedState, ensureConcept } from '../tutorStore';
import { filterAndApplyStateUpdates } from './applyStateUpdates';

describe('filterAndApplyStateUpdates', () => {
  const nowIso = '2026-05-02T12:00:00.000Z';

  it('drops updates outside slice scope', () => {
    const state = defaultUnifiedState('stu_scope');
    ensureConcept(state, 'c-local');
    const res = filterAndApplyStateUpdates(
      state,
      [
        {
          kind: 'concept_observed',
          conceptId: 'c-outside',
          observed: 'failed',
          evidence: { source: 'attempt_step', outcome: 'failed', note: 'x' },
        },
      ],
      { sliceConceptIds: new Set(['c-local']), taughtConceptIds: new Set([]), nowIso },
    );

    expect(res.applied).toHaveLength(0);
    expect(res.dropped).toHaveLength(1);
    expect(res.dropped[0]?.reason).toBe('out_of_scope');
  });

  it('downgrades contradictory applied_correctly when formula_application mistake is present', () => {
    const state = defaultUnifiedState('stu_contradict');
    ensureConcept(state, 'c-main');
    const res = filterAndApplyStateUpdates(
      state,
      [
        {
          kind: 'mistake_observed',
          conceptId: 'c-main',
          candidate: {
            category: 'formula_application',
            specificInstance: 'wrong antiderivative',
            surfaceForm: 'lost 1/A',
          },
        },
        {
          kind: 'concept_observed',
          conceptId: 'c-main',
          observed: 'applied_correctly',
          evidence: {
            source: 'follow_up',
            outcome: 'applied_well',
            note: 'looks right',
          },
        },
      ],
      { sliceConceptIds: new Set(['c-main']), taughtConceptIds: new Set(['c-main']), nowIso },
    );

    expect(res.applied.length).toBeGreaterThanOrEqual(2);
    const obsUpdate = [...res.applied].reverse().find((u) => u.kind === 'concept_observed');
    expect(obsUpdate && obsUpdate.kind === 'concept_observed').toBe(true);
    if (obsUpdate?.kind === 'concept_observed') {
      expect(obsUpdate.observed).toBe('shaky');
      expect(state.concepts['c-main']?.observed).toBe('shaky');
    }
  });
});
