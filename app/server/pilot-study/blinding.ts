import { createHash } from 'node:crypto';
import type { BlindedArmLabel, BlindMapping, PilotArm } from './types';

export interface CreateBlindMappingOptions {
  seed: string;
  /** When true, mapping cannot be mutated in-process. */
  freeze?: boolean;
}

/**
 * Create a deterministic blinded arm mapping from the assignment seed.
 * Analysis code should use blinded labels until the manifest is frozen and
 * exclusions are locked.
 */
export function createBlindMapping(options: CreateBlindMappingOptions): BlindMapping {
  const digest = createHash('sha256').update(`blind|${options.seed}`).digest('hex');
  const flip = parseInt(digest.slice(0, 8), 16) % 2 === 0;
  const early: BlindedArmLabel = flip ? 'arm_A' : 'arm_B';
  const delayed: BlindedArmLabel = flip ? 'arm_B' : 'arm_A';
  return {
    early,
    delayed,
    frozen: options.freeze ?? false,
    mappingId: `blind_${digest.slice(0, 16)}`,
  };
}

export function freezeBlindMapping(mapping: BlindMapping): BlindMapping {
  return { ...mapping, frozen: true };
}

export function toBlindedLabel(arm: PilotArm, mapping: BlindMapping): BlindedArmLabel {
  return arm === 'early' ? mapping.early : mapping.delayed;
}

export function fromBlindedLabel(
  label: BlindedArmLabel,
  mapping: BlindMapping,
): PilotArm {
  if (!mapping.frozen) {
    throw new Error('Refusing to unblind before blind mapping is frozen');
  }
  if (label === mapping.early) return 'early';
  if (label === mapping.delayed) return 'delayed';
  throw new Error(`Unknown blinded label: ${label}`);
}

export function assertBlindedAnalysisDataset(
  rows: Array<{ armLabel: BlindedArmLabel }>,
  mapping: BlindMapping,
): void {
  if (!mapping.frozen) {
    throw new Error('Analysis dataset requires a frozen blind mapping');
  }
  for (const row of rows) {
    if (row.armLabel !== 'arm_A' && row.armLabel !== 'arm_B') {
      throw new Error(`Non-blinded arm label in analysis dataset: ${String(row.armLabel)}`);
    }
  }
}
