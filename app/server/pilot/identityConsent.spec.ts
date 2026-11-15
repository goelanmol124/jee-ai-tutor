import { describe, expect, it } from 'vitest';
import {
  acknowledgeAdultNotice,
  ALL_PURPOSES,
  getConsentStatusMap,
  isProcessingAllowed,
  recordChildAssent,
  recordGranularConsent,
  recordParentVerification,
} from './consent.ts';
import { openPilotStoresInMemory } from './db.ts';
import {
  createInvite,
  declareAdultTransition,
  deactivateInvite,
  getEnrollmentState,
  redeemEnrollmentInvite,
  redeemRecoveryInvite,
  resolveSessionToken,
  issueRecoveryInvite,
} from './identity.ts';
import { LaunchGateError } from './launchGates.ts';
import { assertNoProhibitedData, ProhibitedDataError } from './prohibitedData.ts';
import { parentMayViewFullTranscript, buildParentProgressSummary } from './parentProgress.ts';

const NOTICE = 'parent-notice-v1';
const RETENTION = 'retention-v1';

function allPurposes(photo = false, research = false) {
  return ALL_PURPOSES.map((purpose) => ({
    purpose,
    decision:
      purpose === 'account_tutor_operation' ||
      (photo && purpose === 'transient_photo_diagnosis') ||
      (research && purpose === 'raw_photo_research_evaluation') ||
      (research && purpose === 'coded_research_evaluation')
        ? ('granted' as const)
        : ('denied' as const),
  }));
}

describe('identity + consent state machine', () => {
  it('creates opaque stu_* identity and resolves session token server-side', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment', cohort: 'class_12' });
    const redeemed = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: '18_plus',
      actor: 'self_adult',
    });
    expect(redeemed.studentId).toMatch(/^stu_[a-f0-9]{32}$/);
    const resolved = resolveSessionToken(stores.identityConsent, redeemed.sessionToken);
    expect(resolved?.studentId).toBe(redeemed.studentId);
    expect(resolveSessionToken(stores.identityConsent, 'bogus')).toBeNull();
  });

  it('routes adults through notice → consent → active', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const { studentId } = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: '18_plus',
      actor: 'self_adult',
    });
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('adult_notice_pending');
    acknowledgeAdultNotice(stores.identityConsent, studentId, NOTICE);
    const { enrollmentState } = recordGranularConsent(stores.identityConsent, {
      studentId,
      actorRole: 'adult_participant',
      noticeVersion: NOTICE,
      retentionVersion: RETENTION,
      dataCategories: ['learning_state', 'transcripts'],
      processorList: ['model_provider'],
      purposes: allPurposes(true),
    });
    expect(enrollmentState).toBe('active');
    expect(isProcessingAllowed(stores.identityConsent, studentId)).toBe(true);
  });

  it('requires parent verification config and child assent for minors; respects dissent', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const { studentId } = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: 'under_18',
      actor: 'parent_guardian',
    });
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('parent_verification_pending');

    expect(() =>
      recordParentVerification(
        stores.identityConsent,
        studentId,
        { verificationResultToken: 'tok', guardianDeclaration: 'parent' },
        { runtimeMode: 'development' },
      ),
    ).toThrow(LaunchGateError);
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('parent_verification_blocked');

    recordParentVerification(
      stores.identityConsent,
      studentId,
      { verificationResultToken: 'tok_abc', guardianDeclaration: 'lawful_guardian' },
      { parentVerificationProvider: 'configured-provider', runtimeMode: 'development' },
    );
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('parent_permission_pending');

    recordGranularConsent(stores.identityConsent, {
      studentId,
      actorRole: 'parent_guardian',
      noticeVersion: NOTICE,
      retentionVersion: RETENTION,
      dataCategories: ['learning_state'],
      processorList: ['model_provider'],
      purposes: allPurposes(),
    });
    expect(getEnrollmentState(stores.identityConsent, studentId)).toBe('awaiting_child_assent');

    const dissented = recordChildAssent(stores.identityConsent, studentId, 'dissented', 'child-notice-v1');
    expect(dissented).toBe('child_dissented');
    expect(isProcessingAllowed(stores.identityConsent, studentId)).toBe(false);
  });

  it('activates minor only after assent despite parent permission', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const { studentId } = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: 'under_18',
      actor: 'parent_guardian',
    });
    recordParentVerification(
      stores.identityConsent,
      studentId,
      { verificationResultToken: 'tok', guardianDeclaration: 'parent' },
      { parentVerificationProvider: 'provider-x' },
    );
    recordGranularConsent(stores.identityConsent, {
      studentId,
      actorRole: 'parent_guardian',
      noticeVersion: NOTICE,
      retentionVersion: RETENTION,
      dataCategories: ['learning_state'],
      processorList: [],
      purposes: allPurposes(),
    });
    expect(recordChildAssent(stores.identityConsent, studentId, 'assented', 'child-notice-v1')).toBe(
      'active',
    );
  });

  it('suspends on age transition and retires parent recovery authority', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const redeemed = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: 'under_18',
      actor: 'parent_guardian',
    });
    const next = declareAdultTransition(stores.identityConsent, redeemed.studentId);
    expect(next).toBe('suspended_age_transition');
    expect(resolveSessionToken(stores.identityConsent, redeemed.sessionToken)).toBeNull();

    const parent = stores.identityConsent.prepare(
      `SELECT recovery_authority_active FROM pilot_parent_accounts WHERE student_id = ?`,
    );
    parent.bind([redeemed.studentId]);
    parent.step();
    expect(Number(parent.getAsObject().recovery_authority_active)).toBe(0);
    parent.free();

    const recovery = issueRecoveryInvite(stores.identityConsent, redeemed.studentId);
    expect(() => redeemRecoveryInvite(stores.identityConsent, recovery.inviteCode)).toThrow(
      /Recovery blocked|Parent recovery authority/,
    );
  });

  it('rejects prohibited data fields', () => {
    expect(() => assertNoProhibitedData({ school_name: 'X' })).toThrow(ProhibitedDataError);
    expect(() => assertNoProhibitedData({ aadhaar: '1234' })).toThrow(ProhibitedDataError);
    expect(() => assertNoProhibitedData({ cohort: 'class_11' })).not.toThrow();
  });

  it('never allows parent full transcript; parent summary stays bounded', async () => {
    expect(parentMayViewFullTranscript()).toBe(false);
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const { studentId } = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: '18_plus',
      actor: 'self_adult',
    });
    acknowledgeAdultNotice(stores.identityConsent, studentId, NOTICE);
    recordGranularConsent(stores.identityConsent, {
      studentId,
      actorRole: 'adult_participant',
      noticeVersion: NOTICE,
      retentionVersion: RETENTION,
      dataCategories: [],
      processorList: [],
      purposes: allPurposes(),
    });
    // Seed a conversation ref that must not appear in parent summary fields
    stores.conversations.run(
      `INSERT INTO conversation_turn_refs (turn_id, student_id, created_at, retention_expires_at)
       VALUES ('t1', ?, datetime('now'), datetime('now', '+90 days'))`,
      [studentId],
    );
    const summary = buildParentProgressSummary(stores, studentId, {
      independentlyCompletedQuestions: 3,
      questionsSuccessfullyRescued: 1,
    });
    expect(summary.independentlyCompletedQuestions).toBe(3);
    expect(summary.consentStatus.account_tutor_operation).toBe('granted');
    expect(Object.keys(summary)).not.toContain('transcript');
    expect(getConsentStatusMap(stores.identityConsent, studentId).recontact).toBe('denied');
  });

  it('deactivates invites without deleting student rows', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    deactivateInvite(stores.identityConsent, invite.inviteId);
    expect(() =>
      redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
        ageBand: '18_plus',
        actor: 'self_adult',
      }),
    ).toThrow(/Invite not found/);
  });
});
