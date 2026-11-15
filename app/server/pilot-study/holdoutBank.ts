import type { HoldoutBank } from './types';

export class HoldoutLeakError extends Error {
  readonly itemId: string;
  readonly bankVersion: string;

  constructor(itemId: string, bankVersion: string) {
    super(
      `Holdout item ${itemId} must not appear in tutoring (bank ${bankVersion})`,
    );
    this.name = 'HoldoutLeakError';
    this.itemId = itemId;
    this.bankVersion = bankVersion;
  }
}

export function createHoldoutBank(
  bankVersion: string,
  itemIds: Iterable<string>,
  options?: { freeze?: boolean },
): HoldoutBank {
  const unique = [...new Set([...itemIds])];
  if (unique.length === 0) {
    throw new Error('Holdout bank must contain at least one item');
  }
  const bank: HoldoutBank = {
    bankVersion,
    itemIds: Object.freeze(unique),
    frozen: options?.freeze ?? false,
  };
  return bank;
}

export function freezeHoldoutBank(bank: HoldoutBank): HoldoutBank {
  return {
    bankVersion: bank.bankVersion,
    itemIds: Object.freeze([...bank.itemIds]),
    frozen: true,
  };
}

export function isHoldoutItem(bank: HoldoutBank, itemId: string): boolean {
  return bank.itemIds.includes(itemId);
}

/**
 * Hard boundary: tutoring / picker selection must call this before serving an item.
 */
export function assertTutoringEligible(bank: HoldoutBank, itemId: string): void {
  if (isHoldoutItem(bank, itemId)) {
    throw new HoldoutLeakError(itemId, bank.bankVersion);
  }
}

export function filterTutoringEligible<T extends { id: string }>(
  bank: HoldoutBank,
  items: readonly T[],
): T[] {
  return items.filter((item) => !isHoldoutItem(bank, item.id));
}

export function assertDisjointBanks(
  holdout: HoldoutBank,
  tutoringItemIds: readonly string[],
): { ok: true } | { ok: false; leaks: string[] } {
  const leaks = tutoringItemIds.filter((id) => isHoldoutItem(holdout, id));
  if (leaks.length > 0) return { ok: false, leaks };
  return { ok: true };
}
