import type { LaunchGateKey, LaunchGateStatus } from './types.ts';

export type PilotLaunchConfig = {
  /** Named Indian operator / legal entity. */
  legalEntity?: string;
  /** Indian counsel / applicability memo reference. */
  indianCounsel?: string;
  /** Parent verification provider or method name (not fabricated). */
  parentVerificationProvider?: string;
  /** Independent ethics body or written competent determination reference. */
  ethicsApproval?: string;
  /** Model-provider ZDR / DPA confirmation reference. */
  modelZdrConfirmation?: string;
  /** Trained safeguarding personnel / lead reference. */
  safeguardingPersonnel?: string;
  /**
   * Runtime mode. Production and pilot-production forbid missing gates.
   * Development may inspect blockers without inventing defaults.
   */
  runtimeMode?: 'development' | 'test' | 'production' | 'pilot_production';
};

const GATE_ENV: Record<LaunchGateKey, { env: string; blockerMessage: string }> = {
  legal_entity: {
    env: 'PILOT_LEGAL_ENTITY',
    blockerMessage: 'Named Indian operator/legal entity is not configured.',
  },
  indian_counsel: {
    env: 'PILOT_INDIAN_COUNSEL',
    blockerMessage: 'Indian counsel applicability memo is not configured.',
  },
  parent_verification_provider: {
    env: 'PILOT_PARENT_VERIFICATION_PROVIDER',
    blockerMessage: 'Parent-verification provider/method is not configured.',
  },
  ethics_approval: {
    env: 'PILOT_ETHICS_APPROVAL',
    blockerMessage: 'Independent ethics approval or competent determination is not configured.',
  },
  model_zdr: {
    env: 'PILOT_MODEL_ZDR_CONFIRMATION',
    blockerMessage: 'Model-provider ZDR/DPA confirmation is not configured.',
  },
  safeguarding_personnel: {
    env: 'PILOT_SAFEGUARDING_PERSONNEL',
    blockerMessage: 'Trained safeguarding personnel are not configured.',
  },
};

function readConfiguredValue(key: LaunchGateKey, config: PilotLaunchConfig): string | undefined {
  const fromConfig: Partial<Record<LaunchGateKey, string | undefined>> = {
    legal_entity: config.legalEntity,
    indian_counsel: config.indianCounsel,
    parent_verification_provider: config.parentVerificationProvider,
    ethics_approval: config.ethicsApproval,
    model_zdr: config.modelZdrConfirmation,
    safeguarding_personnel: config.safeguardingPersonnel,
  };
  const direct = fromConfig[key]?.trim();
  if (direct) return direct;
  const fromEnv = process.env[GATE_ENV[key].env]?.trim();
  return fromEnv || undefined;
}

export function resolveRuntimeMode(config: PilotLaunchConfig = {}): PilotLaunchConfig['runtimeMode'] {
  if (config.runtimeMode) return config.runtimeMode;
  const fromEnv = process.env.PILOT_RUNTIME_MODE?.trim();
  if (
    fromEnv === 'development' ||
    fromEnv === 'test' ||
    fromEnv === 'production' ||
    fromEnv === 'pilot_production'
  ) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') return 'production';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}

export function evaluateLaunchGates(config: PilotLaunchConfig = {}): LaunchGateStatus[] {
  return (Object.keys(GATE_ENV) as LaunchGateKey[]).map((key) => {
    const value = readConfiguredValue(key, config);
    return {
      key,
      configured: Boolean(value),
      blockerMessage: GATE_ENV[key].blockerMessage,
    };
  });
}

export function missingLaunchGates(config: PilotLaunchConfig = {}): LaunchGateStatus[] {
  return evaluateLaunchGates(config).filter((g) => !g.configured);
}

export function isStrictLaunchMode(config: PilotLaunchConfig = {}): boolean {
  const mode = resolveRuntimeMode(config);
  return mode === 'production' || mode === 'pilot_production';
}

/**
 * Production / pilot_production: hard-fail when any gate is missing.
 * Never invents defaults for legal entity, verification, ethics, ZDR, or safeguarding.
 */
export function assertLaunchGatesOrThrow(config: PilotLaunchConfig = {}): void {
  if (!isStrictLaunchMode(config)) return;
  const missing = missingLaunchGates(config);
  if (missing.length === 0) return;
  const detail = missing.map((m) => `${m.key}: ${m.blockerMessage}`).join(' | ');
  throw new LaunchGateError(`Pilot launch blocked — missing configuration: ${detail}`, missing);
}

export function requireParentVerificationConfigured(config: PilotLaunchConfig = {}): string {
  const value = readConfiguredValue('parent_verification_provider', config);
  if (!value) {
    throw new LaunchGateError(GATE_ENV.parent_verification_provider.blockerMessage, [
      {
        key: 'parent_verification_provider',
        configured: false,
        blockerMessage: GATE_ENV.parent_verification_provider.blockerMessage,
      },
    ]);
  }
  return value;
}

export class LaunchGateError extends Error {
  readonly missing: LaunchGateStatus[];

  constructor(message: string, missing: LaunchGateStatus[]) {
    super(message);
    this.name = 'LaunchGateError';
    this.missing = missing;
  }
}
