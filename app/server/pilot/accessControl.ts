import { queryAll, queryOne, type PilotSqlDb } from './db.ts';
import { newOpaqueId, nowIso } from './ids.ts';
import { roleMayReadStore } from './stores.ts';
import type { AccessGrant, AccessRole, DataStoreName } from './types.ts';

const DEFAULT_JIT_TTL_MS = 15 * 60 * 1000;

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}

function writeAudit(
  db: PilotSqlDb,
  entry: {
    grantId?: string | null;
    actorId: string;
    actorRole: AccessRole;
    action: string;
    resourceStore: DataStoreName;
    studentId?: string | null;
    reasonCode?: string | null;
    caseId?: string | null;
    fieldsViewed?: string[];
    detail?: unknown;
  },
): void {
  db.run(
    `INSERT INTO pilot_access_audit (
      audit_id, grant_id, actor_id, actor_role, action, resource_store, student_id,
      reason_code, case_id, fields_viewed_json, recorded_at, detail_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newOpaqueId('aud'),
      entry.grantId ?? null,
      entry.actorId,
      entry.actorRole,
      entry.action,
      entry.resourceStore,
      entry.studentId ?? null,
      entry.reasonCode ?? null,
      entry.caseId ?? null,
      JSON.stringify(entry.fieldsViewed ?? []),
      nowIso(),
      entry.detail ? JSON.stringify(entry.detail) : null,
    ],
  );
}

/**
 * Just-in-time content access: reason-coded, expiring, audited.
 * Engineers never receive ordinary or JIT production content access.
 */
export function requestJustInTimeAccess(
  db: PilotSqlDb,
  input: {
    actorId: string;
    actorRole: AccessRole;
    studentId?: string;
    resourceStore: DataStoreName;
    reasonCode: string;
    caseId: string;
    fields: string[];
    ttlMs?: number;
  },
): AccessGrant {
  if (input.actorRole === 'engineer') {
    writeAudit(db, {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: 'jit_denied_engineer',
      resourceStore: input.resourceStore,
      studentId: input.studentId,
      reasonCode: input.reasonCode,
      caseId: input.caseId,
    });
    throw new AccessDeniedError('Engineers do not browse production content');
  }
  if (!input.reasonCode.trim() || !input.caseId.trim()) {
    throw new AccessDeniedError('JIT access requires reason_code and case_id');
  }
  if (input.resourceStore === 'conversations' || input.resourceStore === 'transient_photos') {
    if (input.actorRole !== 'safety_admin') {
      writeAudit(db, {
        actorId: input.actorId,
        actorRole: input.actorRole,
        action: 'jit_denied_role',
        resourceStore: input.resourceStore,
        studentId: input.studentId,
        reasonCode: input.reasonCode,
        caseId: input.caseId,
      });
      throw new AccessDeniedError(`Role ${input.actorRole} cannot JIT-access ${input.resourceStore}`);
    }
  } else if (!roleMayReadStore(input.actorRole, input.resourceStore) && input.actorRole !== 'safety_admin') {
    throw new AccessDeniedError(`Role ${input.actorRole} cannot access ${input.resourceStore}`);
  }

  const grantId = newOpaqueId('grt');
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? DEFAULT_JIT_TTL_MS)).toISOString();
  db.run(
    `INSERT INTO pilot_access_grants (
      grant_id, actor_id, actor_role, student_id, resource_store, reason_code, case_id,
      created_at, expires_at, fields_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      grantId,
      input.actorId,
      input.actorRole,
      input.studentId ?? null,
      input.resourceStore,
      input.reasonCode,
      input.caseId,
      createdAt,
      expiresAt,
      JSON.stringify(input.fields),
    ],
  );
  writeAudit(db, {
    grantId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: 'jit_granted',
    resourceStore: input.resourceStore,
    studentId: input.studentId,
    reasonCode: input.reasonCode,
    caseId: input.caseId,
    fieldsViewed: input.fields,
  });
  return {
    grantId,
    actorId: input.actorId,
    actorRole: input.actorRole,
    studentId: input.studentId ?? null,
    resourceStore: input.resourceStore,
    reasonCode: input.reasonCode,
    caseId: input.caseId,
    createdAt,
    expiresAt,
    fields: input.fields,
  };
}

export function assertActiveGrant(
  db: PilotSqlDb,
  grantId: string,
  actorId: string,
  resourceStore: DataStoreName,
): AccessGrant {
  const row = queryOne(db, `SELECT * FROM pilot_access_grants WHERE grant_id = ?`, [grantId]);
  if (!row) throw new AccessDeniedError('Unknown access grant');
  if (String(row.actor_id) !== actorId) throw new AccessDeniedError('Grant actor mismatch');
  if (String(row.resource_store) !== resourceStore) throw new AccessDeniedError('Grant store mismatch');
  if (row.revoked_at) throw new AccessDeniedError('Grant revoked');
  if (String(row.expires_at) < nowIso()) throw new AccessDeniedError('Grant expired');

  writeAudit(db, {
    grantId,
    actorId,
    actorRole: String(row.actor_role) as AccessRole,
    action: 'jit_used',
    resourceStore,
    studentId: row.student_id ? String(row.student_id) : null,
    reasonCode: String(row.reason_code),
    caseId: row.case_id ? String(row.case_id) : null,
    fieldsViewed: JSON.parse(String(row.fields_json)) as string[],
  });

  return {
    grantId,
    actorId,
    actorRole: String(row.actor_role) as AccessRole,
    studentId: row.student_id ? String(row.student_id) : null,
    resourceStore,
    reasonCode: String(row.reason_code),
    caseId: row.case_id ? String(row.case_id) : null,
    createdAt: String(row.created_at),
    expiresAt: String(row.expires_at),
    fields: JSON.parse(String(row.fields_json)) as string[],
  };
}

export function revokeGrant(db: PilotSqlDb, grantId: string, actorId: string): void {
  db.run(`UPDATE pilot_access_grants SET revoked_at = ? WHERE grant_id = ?`, [nowIso(), grantId]);
  const row = queryOne(db, `SELECT * FROM pilot_access_grants WHERE grant_id = ?`, [grantId]);
  if (row) {
    writeAudit(db, {
      grantId,
      actorId,
      actorRole: String(row.actor_role) as AccessRole,
      action: 'jit_revoked',
      resourceStore: String(row.resource_store) as DataStoreName,
      studentId: row.student_id ? String(row.student_id) : null,
      reasonCode: String(row.reason_code),
      caseId: row.case_id ? String(row.case_id) : null,
    });
  }
}

/** Ordinary role check without elevating to content. Audits denials. */
export function assertRoleStoreAccess(
  db: PilotSqlDb,
  actorId: string,
  actorRole: AccessRole,
  store: DataStoreName,
): void {
  if (!roleMayReadStore(actorRole, store)) {
    writeAudit(db, {
      actorId,
      actorRole,
      action: 'role_denied',
      resourceStore: store,
    });
    throw new AccessDeniedError(`Role ${actorRole} cannot read store ${store}`);
  }
  writeAudit(db, {
    actorId,
    actorRole,
    action: 'role_allowed',
    resourceStore: store,
  });
}

export function listAuditForStudent(db: PilotSqlDb, studentId: string): Record<string, unknown>[] {
  return queryAll(
    db,
    `SELECT * FROM pilot_access_audit WHERE student_id = ? ORDER BY recorded_at DESC`,
    [studentId],
  );
}
