import { describe, expect, it } from 'vitest';
import {
  HoldoutLeakError,
  assertDisjointBanks,
  assertTutoringEligible,
  createHoldoutBank,
  filterTutoringEligible,
  freezeHoldoutBank,
  isHoldoutItem,
} from './holdoutBank';

describe('holdout bank boundary', () => {
  it('prevents tutoring leakage of holdout items', () => {
    const bank = freezeHoldoutBank(
      createHoldoutBank('holdout_v1', ['h1', 'h2', 'h3']),
    );
    expect(isHoldoutItem(bank, 'h2')).toBe(true);
    expect(() => assertTutoringEligible(bank, 'h2')).toThrow(HoldoutLeakError);
    expect(() => assertTutoringEligible(bank, 'tutor_ok')).not.toThrow();
  });

  it('filters tutoring candidates and detects disjoint bank violations', () => {
    const bank = createHoldoutBank('holdout_v1', ['h1', 'h2']);
    const items = [{ id: 'h1' }, { id: 'q9' }, { id: 'h2' }];
    expect(filterTutoringEligible(bank, items).map((x) => x.id)).toEqual(['q9']);
    expect(assertDisjointBanks(bank, ['q9', 'q10'])).toEqual({ ok: true });
    expect(assertDisjointBanks(bank, ['q9', 'h1'])).toEqual({
      ok: false,
      leaks: ['h1'],
    });
  });
});
