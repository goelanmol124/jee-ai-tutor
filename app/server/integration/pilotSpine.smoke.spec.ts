/**
 * Targeted smoke tests for the integrated pilot spine.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { evaluateLaunchGates, LaunchGateError, assertLaunchGatesOrThrow } from '../pilot/launchGates.ts';
import {
  acknowledgeAdultNotice,
  ALL_PURPOSES,
  isProcessingAllowed,
  recordGranularConsent,
} from '../pilot/consent.ts';
import { createInvite, redeemEnrollmentInvite, getEnrollmentState } from '../pilot/identity.ts';
import { buildParentProgressSummary, parentMayViewFullTranscript } from '../pilot/parentProgress.ts';
import { assertTutoringEligible, createHoldoutBank, freezeHoldoutBank, HoldoutLeakError } from '../pilot-study/index.ts';
import { deriveActiveTime } from '../telemetry/activeTime.ts';
import type { TelemetryEvent } from '../telemetry/types.ts';
import { countConfirmedMasteryProposals, preparePhotoDiagnosis } from './diagnosisBridge.ts';
import { joinPilot, parseJoinRequest, requireActiveProcessing } from './joinService.ts';
import {
  currentLaunchChecklist,
  getHoldoutBank,
  ingestTelemetryEvents,
  resetPilotRuntimeForTests,
  setHoldoutBankForTests,
} from './pilotRuntime.ts';
import { SafeApiError } from './safeErrors.ts';

const sampleQuestion = {
  id: 'q_smoke_1',
  source: 'test',
  prompt: 'Solve x',
  subject: 'math' as const,
  chapterId: 'ch-a',
  conceptIds: ['c-a1'],
  prereqIds: [] as string[],
  canonicalSteps: [] as [],
  difficulty: 1 as const,
  mode: 'diagnose' as const,
  examFeel: 1 as const,
};

describe('pilot spine smoke', () => {
  beforeEach(async () => {
    await resetPilotRuntimeForTests();
    process.env.PILOT_RUNTIME_MODE = 'test';
    delete process.env.PILOT_LEGAL_ENTITY;
    delete process.env.PILOT_INDIAN_COUNSEL;
    delete process.env.PILOT_PARENT_VERIFICATION_PROVIDER;
    delete process.env.PILOT_ETHICS_APPROVAL;
    delete process.env.PILOT_MODEL_ZDR_CONFIRMATION;
    delete process.env.PILOT_SAFEGUARDING_PERSONNEL;
  });

  afterEach(() => {
    delete process.env.PILOT_RUNTIME_MODE;
  });

  it('launch-gate failure remains visible and blocks strict modes', () => {
    const missing = evaluateLaunchGates({ runtimeMode: 'development' }).filter((g) => !g.configured);
    expect(missing.length).toBeGreaterThan(0);

    expect(() =>
      assertLaunchGatesOrThrow({ runtimeMode: 'pilot_production' }),
    ).toThrow(LaunchGateError);

    const checklist = currentLaunchChecklist();
    expect(checklist.softwareReady).toBe(true);
    expect(checklist.launchCleared).toBe(false);
    expect(checklist.unresolvedHumanBlockers.length).toBeGreaterThan(0);
  });

  it('adult flow: join with explicit cohort → notice/consent → processing allowed', async () => {
    const stores = await resetPilotRuntimeForTests();
    const parsed = parseJoinRequest({
      inviteCode: 'smoke-adult-1',
      nickname: 'Aarav',
      cohort: 'class_12',
      language: 'english',
      ageBand: '18_plus',
      acceptNotices: true,
      grantPhotoDiagnosis: true,
    });
    const joined = joinPilot(stores, parsed);
    expect(joined.ok).toBe(true);
    expect(joined.cohort).toBe('class_12');
    expect(joined.enrollmentState).toBe('active');
    expect(joined.processingAllowed).toBe(true);
    expect(isProcessingAllowed(stores.identityConsent, joined.studentId)).toBe(true);
  });

  it('rejects join without explicit cohort (no silent Class 11)', async () => {
    expect(() =>
      parseJoinRequest({
        inviteCode: 'x',
        nickname: 'A',
        language: 'english',
        ageBand: '18_plus',
      }),
    ).toThrow(SafeApiError);
  });

  it('minor blocked before verification — tutoring not allowed', async () => {
    const stores = await resetPilotRuntimeForTests();
    const joined = joinPilot(stores, {
      inviteCode: 'smoke-minor-1',
      nickname: 'Kid',
      cohort: 'class_11',
      language: 'english',
      ageBand: 'under_18',
      acceptNotices: true,
    });
    expect(joined.processingAllowed).toBe(false);
    expect(
      joined.enrollmentState === 'parent_verification_pending'
        || joined.enrollmentState === 'parent_verification_blocked',
    ).toBe(true);
    expect(() => requireActiveProcessing(stores, joined.studentId)).toThrow(SafeApiError);
  });

  it('multi-page abstention / tentative path keeps state unmutated', async () => {
    const stores = await resetPilotRuntimeForTests();
    const joined = joinPilot(stores, {
      inviteCode: 'smoke-diag-1',
      nickname: 'Diag',
      cohort: 'dropper',
      language: 'roman_hinglish',
      ageBand: '18_plus',
      acceptNotices: true,
      grantPhotoDiagnosis: true,
    });

    const readback = preparePhotoDiagnosis(stores, {
      studentId: joined.studentId,
      question: sampleQuestion,
      pages: [
        { id: 'p1', pageNumber: 1, previewUrl: 'data:image/png;base64,xx', clientReadableHint: 'blurry' },
        { id: 'p2', pageNumber: 2, previewUrl: 'data:image/png;base64,yy', clientReadableHint: 'glare' },
      ],
      readbackConfirmed: false,
    });
    expect(readback.readback).toBeTruthy();
    expect(readback.diagnosisId).toBeUndefined();

    const confirmed = preparePhotoDiagnosis(stores, {
      studentId: joined.studentId,
      question: sampleQuestion,
      pages: [
        { id: 'p1', pageNumber: 1, previewUrl: 'data:image/png;base64,xx', clientReadableHint: 'blurry' },
      ],
      readbackConfirmed: true,
      liveModelPath: true,
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.studentFacingHint?.stateMutated).toBe(false);
    expect(confirmed.integrationGap).toMatch(/verifier contract/i);
    expect(confirmed.diagnosis?.beliefUpdates ?? []).toEqual([]);
    expect(countConfirmedMasteryProposals(stores, joined.studentId)).toBe(0);
  });

  it('one photo cannot produce confirmed mastery proposals', async () => {
    const stores = await resetPilotRuntimeForTests();
    const joined = joinPilot(stores, {
      inviteCode: 'smoke-photo-1',
      nickname: 'Photo',
      cohort: 'class_12',
      language: 'english',
      ageBand: '18_plus',
      acceptNotices: true,
      grantPhotoDiagnosis: true,
    });
    const result = preparePhotoDiagnosis(stores, {
      studentId: joined.studentId,
      question: sampleQuestion,
      pages: [{ id: 'p1', pageNumber: 1, previewUrl: 'data:image/png;base64,aa', clientReadableHint: 'readable' }],
      typedWork: 'x = 2',
      readbackConfirmed: true,
    });
    const proposals = result.proposals ?? [];
    expect(proposals.every((p) => p.status !== 'confirmed')).toBe(true);
    expect(proposals.every((p) => p.kind !== 'mastery_hypothesis' || p.status === 'needs_confirmation')).toBe(true);
    expect(countConfirmedMasteryProposals(stores, joined.studentId)).toBe(0);
  });

  it('holdout rejection before tutoring serves content', () => {
    const bank = freezeHoldoutBank(createHoldoutBank('smoke_holdout', ['holdout_q_smoke_1']));
    setHoldoutBankForTests(bank);
    expect(getHoldoutBank().itemIds).toContain('holdout_q_smoke_1');
    expect(() => assertTutoringEligible(getHoldoutBank(), 'holdout_q_smoke_1')).toThrow(
      HoldoutLeakError,
    );
    expect(() => assertTutoringEligible(getHoldoutBank(), 'ordinary_q_1')).not.toThrow();
  });

  it('heartbeat active time uses 15s / 5min cap / >30s hidden cutoff', () => {
    const base = Date.parse('2026-07-18T10:00:00.000Z');
    const events: TelemetryEvent[] = [];
    for (let i = 0; i < 8; i++) {
      events.push({
        eventId: `hb_${i}`,
        studentId: 'stu_test',
        sessionId: 'ses_test',
        type: 'heartbeat',
        clientAt: new Date(base + i * 15_000).toISOString(),
        visible: true,
        context: 'product',
        eventVersion: 'foreground_heartbeat_v1',
      });
    }
    // Hidden for 45s should stop accrual
    events.push({
      eventId: 'hide',
      studentId: 'stu_test',
      sessionId: 'ses_test',
      type: 'visibility_change',
      clientAt: new Date(base + 8 * 15_000).toISOString(),
      visible: false,
      context: 'product',
      eventVersion: 'foreground_heartbeat_v1',
    });
    const derived = deriveActiveTime({ events });
    expect(derived.algorithmVersion).toBe('foreground_heartbeat_v1');
    expect(derived.heartbeatIntervalSeconds).toBe(15);
    expect(derived.hiddenCutoffSeconds).toBe(30);
    expect(derived.caps.primaryMinutes).toBe(5);
    expect(derived.totals.activeMsPrimary).toBeGreaterThan(0);
  });

  it('parent summary privacy — no transcript access', async () => {
    const stores = await resetPilotRuntimeForTests();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment', cohort: 'class_12' });
    const { studentId } = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: '18_plus',
      actor: 'self_adult',
      cohort: 'class_12',
    });
    acknowledgeAdultNotice(stores.identityConsent, studentId, 'n1');
    recordGranularConsent(stores.identityConsent, {
      studentId,
      actorRole: 'adult_participant',
      noticeVersion: 'n1',
      retentionVersion: 'r1',
      dataCategories: ['learning_state'],
      processorList: ['model_provider'],
      purposes: ALL_PURPOSES.map((purpose) => ({
        purpose,
        decision: purpose === 'account_tutor_operation' ? ('granted' as const) : ('denied' as const),
      })),
    });
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('active');
    expect(parentMayViewFullTranscript()).toBe(false);
    const summary = buildParentProgressSummary(stores, studentId);
    expect(summary).not.toHaveProperty('transcript');
    expect(JSON.stringify(summary).toLowerCase()).not.toContain('coachmessage');
  });

  it('telemetry ingest persists and derives active time', async () => {
    const stores = await resetPilotRuntimeForTests();
    const joined = joinPilot(stores, {
      inviteCode: 'smoke-tel-1',
      nickname: 'Tel',
      cohort: 'class_11',
      language: 'english',
      ageBand: '18_plus',
      acceptNotices: true,
    });
    const t0 = '2026-07-18T12:00:00.000Z';
    const t1 = '2026-07-18T12:00:15.000Z';
    const result = ingestTelemetryEvents(stores, [
      {
        eventId: 'e1',
        studentId: joined.studentId,
        sessionId: joined.sessionId,
        type: 'heartbeat',
        clientAt: t0,
        visible: true,
        context: 'product',
        eventVersion: 'foreground_heartbeat_v1',
      },
      {
        eventId: 'e2',
        studentId: joined.studentId,
        sessionId: joined.sessionId,
        type: 'heartbeat',
        clientAt: t1,
        visible: true,
        context: 'product',
        eventVersion: 'foreground_heartbeat_v1',
      },
    ]);
    expect(result.accepted).toBe(2);
    expect(result.activeTime?.totals.activeMsPrimary).toBe(15_000);
  });

  it('legacy tutor path still constructs without pilot cohort (isolated default)', async () => {
    // Importing the picker legacy entry must not throw when cohort omitted.
    const { proposePickerCandidates } = await import('../picker/ruleLayer.ts');
    const { defaultUnifiedState } = await import('../tutorStore.ts');
    const graph = {
      chapters: [{ id: 'ch-a', title: 'A', subject: 'math' as const }],
      concepts: [
        {
          id: 'c-a1',
          name: 'A1',
          chapterId: 'ch-a',
          subject: 'math' as const,
          prereqIds: [],
          centrality: 0.5,
        },
      ],
      edges: [],
      questions: [sampleQuestion],
    };
    const state = defaultUnifiedState('legacy_stu');
    const cands = proposePickerCandidates(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
    });
    expect(cands.length).toBeGreaterThanOrEqual(1);
  });
});
