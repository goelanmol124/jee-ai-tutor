import { createHash } from 'node:crypto';
import { createBlindMapping, freezeBlindMapping } from './blinding';
import type { AnalysisManifest, BlindMapping } from './types';

export interface BuildManifestInput {
  assignmentSeed: string;
  holdoutBankVersion: string;
  tutoringBankVersion: string;
  notes?: string;
  blindMapping?: BlindMapping;
}

const DEFAULT_EXCLUSIONS = [
  'Exclude consent, onboarding, support, administration, and holdout-test time from active hours',
  'Never treat missing telemetry as zero product use',
  'Do not drop low users from ITT',
  'Do not adjust primary ITT for post-randomization usage, contamination, or satisfaction',
  'Do not reuse scored holdout items in tutoring',
];

const DEFAULT_INCLUSIONS = [
  'All randomized students remain in the ITT set',
  'Week-3 linked holdout points are the primary causal outcome',
  'Observed linked holdout gain per valid product-active hour is descriptive only',
  'Report 2-minute and 10-minute idle-cap sensitivity for active time',
];

export function buildDraftAnalysisManifest(input: BuildManifestInput): AnalysisManifest {
  const blind = input.blindMapping ?? createBlindMapping({ seed: input.assignmentSeed });
  const body = {
    assignmentSeed: input.assignmentSeed,
    holdoutBankVersion: input.holdoutBankVersion,
    tutoringBankVersion: input.tutoringBankVersion,
    primaryEstimand: 'week3_baseline_adjusted_itt_linked_holdout_points' as const,
    activeTimeAlgorithmVersion: 'foreground_heartbeat_v1' as const,
  };
  const manifestVersion = `analysis_${createHash('sha256')
    .update(JSON.stringify(body))
    .digest('hex')
    .slice(0, 12)}`;

  return {
    manifestVersion,
    status: 'draft',
    frozenAt: null,
    assignmentSeed: input.assignmentSeed,
    blindMapping: { ...blind, frozen: false },
    primaryEstimand: 'week3_baseline_adjusted_itt_linked_holdout_points',
    operationalNorthStar: 'observed_linked_holdout_gain_per_valid_product_active_hour',
    activeTimeAlgorithmVersion: 'foreground_heartbeat_v1',
    idleCapMinutesPrimary: 5,
    idleCapMinutesSensitivity: [2, 10],
    heartbeatIntervalSeconds: 15,
    hiddenCutoffSeconds: 30,
    exclusionRules: [...DEFAULT_EXCLUSIONS],
    inclusionRules: [...DEFAULT_INCLUSIONS],
    content: {
      holdoutBankVersion: input.holdoutBankVersion,
      tutoringBankVersion: input.tutoringBankVersion,
    },
    notes: input.notes ?? '',
  };
}

/**
 * Freeze the versioned analysis manifest. After freeze, exclusions and blind
 * mapping are immutable for this object graph.
 */
export function freezeAnalysisManifest(
  draft: AnalysisManifest,
  frozenAt: string,
): AnalysisManifest {
  if (draft.status === 'frozen') {
    throw new Error(`Manifest ${draft.manifestVersion} is already frozen`);
  }
  return {
    ...draft,
    status: 'frozen',
    frozenAt,
    blindMapping: freezeBlindMapping(draft.blindMapping),
    exclusionRules: Object.freeze([...draft.exclusionRules]) as string[],
    inclusionRules: Object.freeze([...draft.inclusionRules]) as string[],
    idleCapMinutesSensitivity: Object.freeze([
      ...draft.idleCapMinutesSensitivity,
    ]) as [2, 10],
  };
}

export function assertManifestFrozen(manifest: AnalysisManifest): void {
  if (manifest.status !== 'frozen' || !manifest.frozenAt || !manifest.blindMapping.frozen) {
    throw new Error('Analysis code and exclusions are not frozen');
  }
}

export function manifestContentHash(manifest: AnalysisManifest): string {
  return createHash('sha256').update(JSON.stringify(manifest)).digest('hex');
}
