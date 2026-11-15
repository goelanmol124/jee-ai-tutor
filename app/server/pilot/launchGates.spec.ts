import { afterEach, describe, expect, it } from 'vitest';
import {
  assertLaunchGatesOrThrow,
  evaluateLaunchGates,
  LaunchGateError,
  missingLaunchGates,
  requireParentVerificationConfigured,
} from './launchGates.ts';

const FULL_CONFIG = {
  legalEntity: 'Example Education Pvt Ltd',
  indianCounsel: 'counsel-memo-2026-07',
  parentVerificationProvider: 'configured-token-provider',
  ethicsApproval: 'ethics-det-001',
  modelZdrConfirmation: 'zdr-dpa-ref',
  safeguardingPersonnel: 'safeguarding-lead-named',
};

describe('launchGates', () => {
  afterEach(() => {
    delete process.env.PILOT_RUNTIME_MODE;
    delete process.env.PILOT_LEGAL_ENTITY;
    delete process.env.PILOT_PARENT_VERIFICATION_PROVIDER;
  });

  it('reports all six external blockers when unconfigured', () => {
    const missing = missingLaunchGates({ runtimeMode: 'development' });
    expect(missing.map((m) => m.key).sort()).toEqual([
      'ethics_approval',
      'indian_counsel',
      'legal_entity',
      'model_zdr',
      'parent_verification_provider',
      'safeguarding_personnel',
    ]);
  });

  it('does not invent defaults in development — only skips hard throw', () => {
    expect(() => assertLaunchGatesOrThrow({ runtimeMode: 'development' })).not.toThrow();
    expect(evaluateLaunchGates({}).every((g) => !g.configured)).toBe(true);
  });

  it('hard-fails in production with no permissive fallback', () => {
    expect(() => assertLaunchGatesOrThrow({ runtimeMode: 'production' })).toThrow(LaunchGateError);
    expect(() => assertLaunchGatesOrThrow({ runtimeMode: 'pilot_production' })).toThrow(
      LaunchGateError,
    );
  });

  it('passes only when every gate is explicitly configured', () => {
    expect(() =>
      assertLaunchGatesOrThrow({ ...FULL_CONFIG, runtimeMode: 'production' }),
    ).not.toThrow();
  });

  it('requires parent verification provider without fabricating one', () => {
    expect(() => requireParentVerificationConfigured({})).toThrow(LaunchGateError);
    expect(
      requireParentVerificationConfigured({
        parentVerificationProvider: 'digilocker-style-token',
      }),
    ).toBe('digilocker-style-token');
  });
});
