import type { LaunchChecklist, LaunchChecklistItem } from './types';

/**
 * External human blockers from RESEARCH_SYNTHESIS_AND_DECISIONS §7.
 * Code cannot invent these as resolved.
 */
const HUMAN_BLOCKERS: Array<Omit<LaunchChecklistItem, 'resolved' | 'unresolvedReason'>> = [
  {
    id: 'indian_operator_entity',
    kind: 'human_external',
    label: 'Named Indian operator / legal entity',
    required: true,
    owner: 'operator',
  },
  {
    id: 'indian_counsel_memo',
    kind: 'human_external',
    label: 'Indian counsel and applicability memo',
    required: true,
    owner: 'counsel',
  },
  {
    id: 'parent_verification_method',
    kind: 'human_external',
    label: 'Parent-verification provider / method',
    required: true,
    owner: 'operator',
  },
  {
    id: 'model_provider_zdr_dpa',
    kind: 'human_external',
    label: 'Model-provider ZDR / DPA confirmation',
    required: true,
    owner: 'operator',
  },
  {
    id: 'ethics_body',
    kind: 'human_external',
    label: 'Independent ethics body / determination',
    required: true,
    owner: 'operator',
  },
  {
    id: 'safeguarding_personnel',
    kind: 'human_external',
    label: 'Trained academic reviewers and safeguarding personnel',
    required: true,
    owner: 'operator',
  },
  {
    id: 'holdout_calibration_source',
    kind: 'human_external',
    label: 'Holdout item-calibration source',
    required: true,
    owner: 'assessment_lead',
  },
  {
    id: 'recruitment_compensation',
    kind: 'human_external',
    label: 'Pilot recruitment and compensation amount',
    required: true,
    owner: 'operator',
  },
];

export interface SoftwareLaunchSignals {
  stratifiedAssignmentModule: boolean;
  blindedAnalysisManifest: boolean;
  holdoutBankBoundary: boolean;
  activeTimeDerivation: boolean;
  feasibilityGates: boolean;
  handwritingEvalSchema: boolean;
  /** Explicit: pilot execution has not occurred. */
  pilotExecuted: false;
}

export function buildLaunchChecklist(
  software: SoftwareLaunchSignals,
  generatedAt?: string,
  humanResolutions?: Partial<Record<string, { resolved: boolean; note?: string }>>,
): LaunchChecklist {
  const softwareItems: LaunchChecklistItem[] = [
    {
      id: 'sw_assignment',
      kind: 'software',
      label: 'Stratified delayed-start assignment service',
      required: true,
      resolved: software.stratifiedAssignmentModule,
      owner: 'engineering',
      unresolvedReason: software.stratifiedAssignmentModule
        ? null
        : 'Assignment module not ready',
    },
    {
      id: 'sw_manifest',
      kind: 'software',
      label: 'Blinded labels and frozen analysis manifest',
      required: true,
      resolved: software.blindedAnalysisManifest,
      owner: 'engineering',
      unresolvedReason: software.blindedAnalysisManifest
        ? null
        : 'Analysis manifest / blinding not ready',
    },
    {
      id: 'sw_holdout',
      kind: 'software',
      label: 'Holdout-bank tutoring leakage boundary',
      required: true,
      resolved: software.holdoutBankBoundary,
      owner: 'engineering',
      unresolvedReason: software.holdoutBankBoundary
        ? null
        : 'Holdout boundary not ready',
    },
    {
      id: 'sw_active_time',
      kind: 'software',
      label: 'Foreground heartbeat active-time derivation',
      required: true,
      resolved: software.activeTimeDerivation,
      owner: 'engineering',
      unresolvedReason: software.activeTimeDerivation
        ? null
        : 'Active-time derivation not ready',
    },
    {
      id: 'sw_feasibility',
      kind: 'software',
      label: 'Pilot feasibility gate evaluator',
      required: true,
      resolved: software.feasibilityGates,
      owner: 'engineering',
      unresolvedReason: software.feasibilityGates
        ? null
        : 'Feasibility gates not ready',
    },
    {
      id: 'sw_handwriting_eval',
      kind: 'software',
      label: 'Handwriting risk–coverage evaluation schema',
      required: true,
      resolved: software.handwritingEvalSchema,
      owner: 'engineering',
      unresolvedReason: software.handwritingEvalSchema
        ? null
        : 'Handwriting eval schema not ready',
    },
    {
      id: 'op_pilot_not_run',
      kind: 'operational',
      label: 'Pilot field execution complete',
      required: true,
      resolved: false,
      owner: 'operator',
      unresolvedReason:
        'Pilot has not been run; software readiness must not be reported as launch completion',
    },
  ];

  const humanItems: LaunchChecklistItem[] = HUMAN_BLOCKERS.map((item) => {
    const resolution = humanResolutions?.[item.id];
    if (resolution?.resolved) {
      return {
        ...item,
        resolved: true,
        unresolvedReason: null,
      };
    }
    return {
      ...item,
      resolved: false,
      unresolvedReason:
        resolution?.note ??
        'External human decision / confirmation required; not inventable in code',
    };
  });

  const items = [...softwareItems, ...humanItems];
  const unresolvedHumanBlockers = humanItems.filter((i) => !i.resolved);
  const softwareReady = softwareItems
    .filter((i) => i.kind === 'software')
    .every((i) => i.resolved);
  const launchCleared =
    softwareReady &&
    unresolvedHumanBlockers.length === 0 &&
    items.every((i) => !i.required || i.resolved);

  return {
    checklistVersion: 'pilot_launch_checklist_v1',
    generatedAt: generatedAt ?? new Date(0).toISOString(),
    items,
    unresolvedHumanBlockers,
    softwareReady,
    launchCleared,
  };
}
