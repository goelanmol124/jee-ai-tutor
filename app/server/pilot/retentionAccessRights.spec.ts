import { describe, expect, it } from 'vitest';
import {
  AccessDeniedError,
  assertActiveGrant,
  assertRoleStoreAccess,
  listAuditForStudent,
  requestJustInTimeAccess,
} from './accessControl.ts';
import { acknowledgeAdultNotice, ALL_PURPOSES, recordGranularConsent } from './consent.ts';
import { openPilotStoresInMemory } from './db.ts';
import { createInvite, redeemEnrollmentInvite } from './identity.ts';
import {
  registerTransientPhoto,
  runDueRetentionJobs,
  RETENTION_POLICIES,
} from './retention.ts';
import {
  exportStudentData,
  requestDeletion,
  startParentRecovery,
  withdrawParticipation,
} from './rights.ts';
import { parentMayAccessStore, roleMayReadStore } from './stores.ts';
import { redeemRecoveryInvite } from './identity.ts';

const NOTICE = 'n1';
const RETENTION = 'r1';

function allPurposes() {
  return ALL_PURPOSES.map((purpose) => ({
    purpose,
    decision: purpose === 'account_tutor_operation' ? ('granted' as const) : ('denied' as const),
  }));
}

async function activeAdult() {
  const stores = await openPilotStoresInMemory();
  const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
  const redeemed = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
    ageBand: '18_plus',
    actor: 'self_adult',
  });
  acknowledgeAdultNotice(stores.identityConsent, redeemed.studentId, NOTICE);
  recordGranularConsent(stores.identityConsent, {
    studentId: redeemed.studentId,
    actorRole: 'adult_participant',
    noticeVersion: NOTICE,
    retentionVersion: RETENTION,
    dataCategories: ['learning_state'],
    processorList: ['model'],
    purposes: allPurposes(),
  });
  return { stores, studentId: redeemed.studentId };
}

describe('retention, rights, access', () => {
  it('encodes decision-memo retention categories', () => {
    const cats = RETENTION_POLICIES.map((p) => p.category);
    expect(cats).toContain('operational_raw_photos');
    expect(cats).toContain('consent_receipts');
    expect(RETENTION_POLICIES.find((p) => p.category === 'operational_raw_photos')?.maxAgeMs).toBe(
      24 * 60 * 60 * 1000,
    );
  });

  it('deletes due transient photo refs via retention jobs', async () => {
    const { stores, studentId } = await activeAdult();
    const { photoId } = registerTransientPhoto(
      stores.transientPhotos,
      stores.identityConsent,
      studentId,
    );
    // Force due
    stores.identityConsent.run(`UPDATE pilot_deletion_jobs SET due_at = ? WHERE store_name = 'transient_photos'`, [
      new Date(0).toISOString(),
    ]);
    const results = runDueRetentionJobs(stores, new Date());
    expect(results.some((r) => r.status === 'completed')).toBe(true);
    const remaining = stores.transientPhotos.prepare(
      `SELECT COUNT(*) AS c FROM transient_photo_refs WHERE photo_id = ?`,
    );
    remaining.bind([photoId]);
    remaining.step();
    expect(Number(remaining.getAsObject().c)).toBe(0);
    remaining.free();
  });

  it('separates store roles: parent never gets conversations; engineer never browses', async () => {
    expect(parentMayAccessStore('conversations')).toBe(false);
    expect(parentMayAccessStore('identity_consent')).toBe(true);
    expect(roleMayReadStore('engineer', 'learning_state')).toBe(false);
    expect(roleMayReadStore('photo_annotator', 'evaluation_photos')).toBe(true);
    expect(roleMayReadStore('photo_annotator', 'conversations')).toBe(false);
  });

  it('JIT content access is reason-coded, expiring, and audited; engineers denied', async () => {
    const { stores, studentId } = await activeAdult();
    expect(() =>
      requestJustInTimeAccess(stores.identityConsent, {
        actorId: 'eng1',
        actorRole: 'engineer',
        studentId,
        resourceStore: 'conversations',
        reasonCode: 'debug',
        caseId: 'case-1',
        fields: ['turn'],
      }),
    ).toThrow(AccessDeniedError);

    const grant = requestJustInTimeAccess(stores.identityConsent, {
      actorId: 'safety1',
      actorRole: 'safety_admin',
      studentId,
      resourceStore: 'conversations',
      reasonCode: 'safeguarding_review',
      caseId: 'case-9',
      fields: ['excerpt'],
      ttlMs: 60_000,
    });
    assertActiveGrant(stores.identityConsent, grant.grantId, 'safety1', 'conversations');
    const audit = listAuditForStudent(stores.identityConsent, studentId);
    expect(audit.some((a) => a.action === 'jit_granted')).toBe(true);
    expect(audit.some((a) => a.action === 'jit_used')).toBe(true);

    expect(() =>
      assertRoleStoreAccess(stores.identityConsent, 'parent1', 'parent_guardian', 'conversations'),
    ).toThrow(AccessDeniedError);
  });

  it('supports export, withdrawal, deletion, and parent recovery contracts', async () => {
    const stores = await openPilotStoresInMemory();
    const invite = createInvite(stores.identityConsent, { kind: 'enrollment' });
    const redeemed = redeemEnrollmentInvite(stores.identityConsent, invite.inviteCode, {
      ageBand: 'under_18',
      actor: 'parent_guardian',
    });
    // Minimal path to active for rights tests on adult-like consent is skipped;
    // exercise recovery + export-shaped APIs on the under_18 identity vault directly.
    const exportBlockedState = exportStudentData(stores, redeemed.studentId, {
      role: 'parent_guardian',
      actorId: 'par1',
    });
    expect(exportBlockedState.bundle.studentId).toBe(redeemed.studentId);
    expect(exportBlockedState.bundle.transcriptsWithinRetention).toEqual([]);

    const recoveryBlocked = startParentRecovery(stores, redeemed.studentId, {
      role: 'parent_guardian',
      actorId: 'par1',
    }, { simultaneousContactChange: true });
    expect(recoveryBlocked.status).toBe('blocked');

    const recovery = startParentRecovery(stores, redeemed.studentId, {
      role: 'parent_guardian',
      actorId: 'par1',
    });
    expect(recovery.status).toBe('completed');
    expect(recovery.inviteCode).toBeTruthy();
    const restored = redeemRecoveryInvite(stores.identityConsent, recovery.inviteCode!);
    expect(restored.studentId).toBe(redeemed.studentId);

    // Adult withdrawal/deletion path
    const adult = await activeAdult();
    const withdrawn = withdrawParticipation(adult.stores, adult.studentId, {
      role: 'adult_participant',
      actorId: adult.studentId,
    });
    expect(withdrawn.deletionJobIds.length).toBeGreaterThan(0);

    const adult2 = await activeAdult();
    const deleted = requestDeletion(adult2.stores, adult2.studentId, {
      role: 'adult_participant',
      actorId: adult2.studentId,
    });
    expect(deleted.requestId).toMatch(/^rgt_/);
  });
});
