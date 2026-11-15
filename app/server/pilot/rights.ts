import { queryAll, queryOne, type PilotStoreBundle } from './db.ts';
import { listConsentReceipts, withdrawPurpose, REQUIRED_PARTICIPATION_PURPOSE } from './consent.ts';
import { newOpaqueId, nowIso } from './ids.ts';
import {
  issueRecoveryInvite,
  revokeAllSessions,
  setEnrollmentState,
} from './identity.ts';
import { enqueueWithdrawalDeletions } from './retention.ts';
import type {
  ExportBundle,
  RightsRequestStatus,
  RightsRequestType,
} from './types.ts';

export type RightsActor = {
  role: 'adult_participant' | 'parent_guardian' | 'student' | 'support';
  actorId: string;
};

function createRightsRequest(
  stores: PilotStoreBundle,
  studentId: string,
  requestType: RightsRequestType,
  actor: RightsActor,
  payload?: unknown,
): string {
  const requestId = newOpaqueId('rgt');
  stores.identityConsent.run(
    `INSERT INTO pilot_rights_requests (
      request_id, student_id, request_type, status, requester_role, payload_json, created_at
    ) VALUES (?, ?, ?, 'pending', ?, ?, ?)`,
    [
      requestId,
      studentId,
      requestType,
      actor.role,
      payload ? JSON.stringify(payload) : null,
      nowIso(),
    ],
  );
  return requestId;
}

function completeRequest(
  stores: PilotStoreBundle,
  requestId: string,
  status: RightsRequestStatus,
  tombstone?: unknown,
): void {
  stores.identityConsent.run(
    `UPDATE pilot_rights_requests SET status = ?, completed_at = ?, tombstone_json = ? WHERE request_id = ?`,
    [status, nowIso(), tombstone ? JSON.stringify(tombstone) : null, requestId],
  );
}

export function exportStudentData(stores: PilotStoreBundle, studentId: string, actor: RightsActor): {
  requestId: string;
  bundle: ExportBundle;
} {
  const requestId = createRightsRequest(stores, studentId, 'export', actor);
  const adminAccesses = queryAll(
    stores.identityConsent,
    `SELECT audit_id, actor_role, action, resource_store, reason_code, case_id, recorded_at
     FROM pilot_access_audit WHERE student_id = ? ORDER BY recorded_at DESC LIMIT 100`,
    [studentId],
  );
  const photoStatus = queryAll(
    stores.transientPhotos,
    `SELECT photo_id, created_at, delete_by, deleted_at, purpose FROM transient_photo_refs WHERE student_id = ?`,
    [studentId],
  );
  const transcripts = queryAll(
    stores.conversations,
    `SELECT turn_id, created_at, retention_expires_at FROM conversation_turn_refs
     WHERE student_id = ? AND retention_expires_at > ?`,
    [studentId, nowIso()],
  );
  const learning = queryAll(
    stores.learningState,
    `SELECT metric_key, metric_value, recorded_at FROM learning_progress_metrics WHERE student_id = ?`,
    [studentId],
  );

  const bundle: ExportBundle = {
    studentId,
    exportedAt: nowIso(),
    identityConsentReceipts: listConsentReceipts(stores.identityConsent, studentId),
    learningState: learning,
    transcriptsWithinRetention: transcripts,
    photoRetentionStatus: photoStatus,
    processorCategories: ['model_inference', 'hosting', 'backup'],
    majorAdminAccesses: adminAccesses,
  };
  completeRequest(stores, requestId, 'completed', { exportAt: bundle.exportedAt });
  return { requestId, bundle };
}

export function correctStudentField(
  stores: PilotStoreBundle,
  studentId: string,
  actor: RightsActor,
  fieldPath: string,
  newValueRedacted: string,
): { requestId: string; correctionId: string } {
  const allowed = ['cohort', 'language_preference', 'contact_channel_hash'];
  if (!allowed.includes(fieldPath)) {
    throw new Error(`Field ${fieldPath} is not correctable or is prohibited`);
  }
  const requestId = createRightsRequest(stores, studentId, 'correction', actor, { fieldPath });
  const correctionId = newOpaqueId('cor');
  stores.identityConsent.run(
    `INSERT INTO pilot_correction_records (
      correction_id, student_id, field_path, old_value_redacted, new_value_redacted, requester_role, recorded_at
    ) VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    [correctionId, studentId, fieldPath, newValueRedacted, actor.role, nowIso()],
  );
  if (fieldPath === 'cohort') {
    stores.identityConsent.run(`UPDATE pilot_students SET cohort = ?, updated_at = ? WHERE student_id = ?`, [
      newValueRedacted,
      nowIso(),
      studentId,
    ]);
  }
  completeRequest(stores, requestId, 'completed', { correctionId });
  return { requestId, correctionId };
}

export function withdrawParticipation(
  stores: PilotStoreBundle,
  studentId: string,
  actor: RightsActor,
): { requestId: string; deletionJobIds: string[] } {
  if (actor.role === 'student') {
    // Students may withdraw assent/participation; parent/adult also may.
  }
  const requestId = createRightsRequest(stores, studentId, 'withdrawal', actor);
  withdrawPurpose(stores.identityConsent, studentId, REQUIRED_PARTICIPATION_PURPOSE, actor.role);
  // Research withdrawal: mark coded extracts
  stores.researchExtracts.run(
    `UPDATE research_extracts SET withdrawn_at = ? WHERE coded_subject_id = ? AND withdrawn_at IS NULL`,
    [nowIso(), studentId],
  );
  const deletionJobIds = enqueueWithdrawalDeletions(stores.identityConsent, studentId);
  revokeAllSessions(stores.identityConsent, studentId, 'withdrawal');
  completeRequest(stores, requestId, 'completed', { deletionJobIds });
  return { requestId, deletionJobIds };
}

export function requestDeletion(
  stores: PilotStoreBundle,
  studentId: string,
  actor: RightsActor,
): { requestId: string; deletionJobIds: string[] } {
  const requestId = createRightsRequest(stores, studentId, 'deletion', actor);
  const deletionJobIds = enqueueWithdrawalDeletions(stores.identityConsent, studentId);
  setEnrollmentState(stores.identityConsent, studentId, 'deactivated');
  revokeAllSessions(stores.identityConsent, studentId, 'deletion');
  const tombstone = {
    studentId,
    deletedAt: nowIso(),
    contentRetained: false,
    consentReceiptsRetained: true,
  };
  completeRequest(stores, requestId, 'completed', tombstone);
  return { requestId, deletionJobIds };
}

export function revokeSessionsRight(
  stores: PilotStoreBundle,
  studentId: string,
  actor: RightsActor,
): { requestId: string; revoked: number } {
  const requestId = createRightsRequest(stores, studentId, 'session_revocation', actor);
  const revoked = revokeAllSessions(stores.identityConsent, studentId, 'rights_request');
  completeRequest(stores, requestId, 'completed', { revoked });
  return { requestId, revoked };
}

/**
 * Parent recovery: issues a new recovery invite. Does not reveal transcript content.
 * Contact-channel change + recovery simultaneously remains a staff-review blocker.
 */
export function startParentRecovery(
  stores: PilotStoreBundle,
  studentId: string,
  actor: RightsActor,
  opts: { simultaneousContactChange?: boolean } = {},
): { requestId: string; inviteCode?: string; status: RightsRequestStatus; blocker?: string } {
  if (actor.role !== 'parent_guardian' && actor.role !== 'support') {
    throw new Error('Only parent_guardian or support may start parent recovery');
  }
  const requestId = createRightsRequest(stores, studentId, 'parent_recovery', actor, opts);
  if (opts.simultaneousContactChange) {
    completeRequest(stores, requestId, 'blocked', {
      reason: 'Simultaneous contact-change and recovery requires staff review',
    });
    return {
      requestId,
      status: 'blocked',
      blocker: 'Simultaneous contact-change and recovery requires staff review',
    };
  }
  const invite = issueRecoveryInvite(stores.identityConsent, studentId);
  completeRequest(stores, requestId, 'completed', { inviteId: invite.inviteId });
  return { requestId, inviteCode: invite.inviteCode, status: 'completed' };
}

export function getRightsRequest(stores: PilotStoreBundle, requestId: string): Record<string, unknown> | null {
  return queryOne(stores.identityConsent, `SELECT * FROM pilot_rights_requests WHERE request_id = ?`, [
    requestId,
  ]);
}
