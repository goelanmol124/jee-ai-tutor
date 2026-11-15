import { queryOne, type PilotSqlDb } from './db.ts';
import { hashSecret, newInviteCode, newOpaqueId, newSessionToken, newStudentId, nowIso } from './ids.ts';
import { assertNoProhibitedData } from './prohibitedData.ts';
import type {
  AgeBand,
  EnrollmentState,
  InviteKind,
  InviteStatus,
  SessionResolution,
} from './types.ts';

export type CreateInviteInput = {
  kind: InviteKind;
  cohort?: string;
  meta?: Record<string, unknown>;
};

export type CreateInviteResult = {
  inviteId: string;
  /** Plain invite code — shown once; only the hash is stored. */
  inviteCode: string;
  kind: InviteKind;
};

export type RedeemEnrollmentResult = {
  studentId: string;
  sessionToken: string;
  sessionId: string;
  enrollmentState: EnrollmentState;
  ageBand: AgeBand;
};

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function setEnrollmentState(db: PilotSqlDb, studentId: string, state: EnrollmentState, detail?: unknown): void {
  const now = nowIso();
  db.run(
    `INSERT INTO pilot_enrollment_state (student_id, state, updated_at, detail_json)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       state = excluded.state,
       updated_at = excluded.updated_at,
       detail_json = excluded.detail_json`,
    [studentId, state, now, detail ? JSON.stringify(detail) : null],
  );
  db.run(`UPDATE pilot_students SET enrollment_status = ?, updated_at = ? WHERE student_id = ?`, [
    state,
    now,
    studentId,
  ]);
}

export function getEnrollmentState(db: PilotSqlDb, studentId: string): EnrollmentState | null {
  const row = queryOne(db, `SELECT state FROM pilot_enrollment_state WHERE student_id = ?`, [studentId]);
  return row ? (String(row.state) as EnrollmentState) : null;
}

export function createInvite(db: PilotSqlDb, input: CreateInviteInput): CreateInviteResult {
  if (input.meta) assertNoProhibitedData(input.meta);
  const inviteId = newOpaqueId('inv');
  const inviteCode = newInviteCode();
  const now = nowIso();
  db.run(
    `INSERT INTO pilot_invites (
      invite_id, invite_code_hash, invite_kind, status, cohort, created_at, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      inviteId,
      hashSecret(inviteCode),
      input.kind,
      'active',
      input.cohort ?? null,
      now,
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
  return { inviteId, inviteCode, kind: input.kind };
}

/**
 * Create or reuse an active enrollment invite with a caller-supplied code.
 * Used for development bootstrap and operator-issued codes — never invents
 * parent verification or production launch defaults.
 */
export function ensureInviteWithCode(
  db: PilotSqlDb,
  inviteCode: string,
  input: CreateInviteInput & {
    /** Dev/test only: allow reusing a consumed invite code for local tryouts. */
    reactivateConsumed?: boolean;
  },
): CreateInviteResult {
  const trimmed = inviteCode.trim();
  if (!trimmed) throw new Error('Invite code is required');
  if (input.meta) assertNoProhibitedData(input.meta);
  const existing = queryOne(
    db,
    `SELECT invite_id, invite_kind, status FROM pilot_invites WHERE invite_code_hash = ?`,
    [hashSecret(trimmed)],
  );
  if (existing) {
    if (String(existing.status) !== 'active') {
      if (input.reactivateConsumed) {
        db.run(
          `UPDATE pilot_invites SET status = 'active', deactivated_at = NULL WHERE invite_id = ?`,
          [existing.invite_id],
        );
        return {
          inviteId: String(existing.invite_id),
          inviteCode: trimmed,
          kind: String(existing.invite_kind) as InviteKind,
        };
      }
      throw new Error('Invite not found or inactive');
    }
    return {
      inviteId: String(existing.invite_id),
      inviteCode: trimmed,
      kind: String(existing.invite_kind) as InviteKind,
    };
  }
  const inviteId = newOpaqueId('inv');
  const now = nowIso();
  db.run(
    `INSERT INTO pilot_invites (
      invite_id, invite_code_hash, invite_kind, status, cohort, created_at, meta_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      inviteId,
      hashSecret(trimmed),
      input.kind,
      'active',
      input.cohort ?? null,
      now,
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
  return { inviteId, inviteCode: trimmed, kind: input.kind };
}

export function deactivateInvite(db: PilotSqlDb, inviteId: string): void {
  db.run(`UPDATE pilot_invites SET status = ?, deactivated_at = ? WHERE invite_id = ?`, [
    'deactivated',
    nowIso(),
    inviteId,
  ]);
}

/**
 * Adult or parent redeems an enrollment invite and declares age-band routing.
 * Does not invent parent verification — minors enter parent_verification_pending.
 */
export function redeemEnrollmentInvite(
  db: PilotSqlDb,
  inviteCode: string,
  opts: {
    ageBand: AgeBand;
    actor: 'self_adult' | 'parent_guardian';
    cohort?: string;
  },
): RedeemEnrollmentResult {
  assertNoProhibitedData(opts as unknown as Record<string, unknown>);
  const invite = queryOne(
    db,
    `SELECT * FROM pilot_invites WHERE invite_code_hash = ? AND status = 'active'`,
    [hashSecret(inviteCode)],
  );
  if (!invite) throw new Error('Invite not found or inactive');
  if (String(invite.invite_kind) !== 'enrollment') {
    throw new Error('Invite is not an enrollment invite');
  }

  if (opts.ageBand === 'under_18' && opts.actor !== 'parent_guardian') {
    throw new Error('Under-18 enrollment requires parent/lawful-guardian actor');
  }
  if (opts.ageBand === '18_plus' && opts.actor !== 'self_adult') {
    throw new Error('Adult enrollment requires self_adult actor');
  }

  const studentId = newStudentId();
  const now = nowIso();
  const initialState: EnrollmentState =
    opts.ageBand === '18_plus' ? 'adult_notice_pending' : 'parent_verification_pending';

  db.run(
    `INSERT INTO pilot_students (student_id, age_band, enrollment_status, cohort, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [studentId, opts.ageBand, initialState, opts.cohort ?? invite.cohort ?? null, now, now],
  );
  setEnrollmentState(db, studentId, initialState);

  if (opts.ageBand === 'under_18') {
    const parentId = newOpaqueId('par');
    db.run(
      `INSERT INTO pilot_parent_accounts (
        parent_id, student_id, verification_status, created_at, updated_at, recovery_authority_active
      ) VALUES (?, ?, ?, ?, ?, 1)`,
      [parentId, studentId, 'pending', now, now],
    );
  }

  db.run(`UPDATE pilot_invites SET status = ? WHERE invite_id = ?`, ['consumed', invite.invite_id]);

  const session = issueSession(db, studentId);
  return {
    studentId,
    sessionToken: session.sessionToken,
    sessionId: session.sessionId,
    enrollmentState: initialState,
    ageBand: opts.ageBand,
  };
}

export function issueSession(
  db: PilotSqlDb,
  studentId: string,
  ttlMs = SESSION_TTL_MS,
): { sessionId: string; sessionToken: string; expiresAt: string } {
  const sessionId = newOpaqueId('ses');
  const sessionToken = newSessionToken();
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlMs).toISOString();
  db.run(
    `INSERT INTO pilot_sessions (session_id, student_id, token_hash, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [sessionId, studentId, hashSecret(sessionToken), createdAt, expiresAt],
  );
  return { sessionId, sessionToken, expiresAt };
}

export function resolveSessionToken(db: PilotSqlDb, sessionToken: string): SessionResolution | null {
  const row = queryOne(
    db,
    `SELECT s.session_id, s.student_id, s.expires_at, s.revoked_at, st.age_band, e.state AS enrollment_state
     FROM pilot_sessions s
     JOIN pilot_students st ON st.student_id = s.student_id
     JOIN pilot_enrollment_state e ON e.student_id = s.student_id
     WHERE s.token_hash = ?`,
    [hashSecret(sessionToken)],
  );
  if (!row) return null;
  if (row.revoked_at) return null;
  if (String(row.expires_at) < nowIso()) return null;
  return {
    sessionId: String(row.session_id),
    studentId: String(row.student_id),
    ageBand: String(row.age_band) as AgeBand,
    enrollmentState: String(row.enrollment_state) as EnrollmentState,
  };
}

export function revokeSession(db: PilotSqlDb, sessionId: string, reason: string): void {
  db.run(`UPDATE pilot_sessions SET revoked_at = ?, revoke_reason = ? WHERE session_id = ?`, [
    nowIso(),
    reason,
    sessionId,
  ]);
}

export function revokeAllSessions(db: PilotSqlDb, studentId: string, reason: string): number {
  const now = nowIso();
  db.run(
    `UPDATE pilot_sessions SET revoked_at = ?, revoke_reason = ?
     WHERE student_id = ? AND revoked_at IS NULL`,
    [now, reason, studentId],
  );
  const row = queryOne(
    db,
    `SELECT COUNT(*) AS c FROM pilot_sessions WHERE student_id = ? AND revoke_reason = ? AND revoked_at = ?`,
    [studentId, reason, now],
  );
  return Number(row?.c ?? 0);
}

/** Rotate a recovery invite; previous recovery invite is marked rotated. */
export function issueRecoveryInvite(db: PilotSqlDb, studentId: string): CreateInviteResult {
  const student = queryOne(db, `SELECT student_id FROM pilot_students WHERE student_id = ?`, [studentId]);
  if (!student) throw new Error('Student not found');

  const existing = queryOne(
    db,
    `SELECT invite_id FROM pilot_invites
     WHERE invite_kind = 'recovery' AND status = 'active'
       AND meta_json LIKE ?`,
    [`%"studentId":"${studentId}"%`],
  );
  if (existing) {
    db.run(`UPDATE pilot_invites SET status = ? WHERE invite_id = ?`, ['rotated', existing.invite_id]);
  }

  return createInvite(db, {
    kind: 'recovery',
    meta: { studentId },
  });
}

export function redeemRecoveryInvite(
  db: PilotSqlDb,
  inviteCode: string,
): { studentId: string; sessionToken: string; sessionId: string } {
  const invite = queryOne(
    db,
    `SELECT * FROM pilot_invites WHERE invite_code_hash = ? AND status = 'active' AND invite_kind = 'recovery'`,
    [hashSecret(inviteCode)],
  );
  if (!invite) throw new Error('Recovery invite not found or inactive');
  const meta = invite.meta_json ? (JSON.parse(String(invite.meta_json)) as { studentId?: string }) : {};
  if (!meta.studentId) throw new Error('Recovery invite missing student binding');

  const student = queryOne(db, `SELECT * FROM pilot_students WHERE student_id = ?`, [meta.studentId]);
  if (!student) throw new Error('Student not found');
  if (student.deactivated_at) throw new Error('Student account deactivated');

  const enrollment = getEnrollmentState(db, meta.studentId);
  if (
    enrollment === 'suspended_age_transition' ||
    enrollment === 'withdrawn' ||
    enrollment === 'deactivated' ||
    enrollment === 'child_dissented'
  ) {
    throw new Error(`Recovery blocked while enrollment is ${enrollment}`);
  }

  // Parent recovery authority required for minors; retired after age transition.
  if (String(student.age_band) === 'under_18') {
    const parent = queryOne(
      db,
      `SELECT recovery_authority_active FROM pilot_parent_accounts WHERE student_id = ?`,
      [meta.studentId],
    );
    if (!parent || Number(parent.recovery_authority_active) !== 1) {
      throw new Error('Parent recovery authority is not active');
    }
  }

  revokeAllSessions(db, meta.studentId, 'recovery');
  db.run(`UPDATE pilot_invites SET status = ? WHERE invite_id = ?`, ['consumed', invite.invite_id]);
  const session = issueSession(db, meta.studentId);
  return { studentId: meta.studentId, sessionToken: session.sessionToken, sessionId: session.sessionId };
}

export function declareAdultTransition(db: PilotSqlDb, studentId: string): EnrollmentState {
  const student = queryOne(db, `SELECT * FROM pilot_students WHERE student_id = ?`, [studentId]);
  if (!student) throw new Error('Student not found');
  if (String(student.age_band) !== 'under_18') {
    throw new Error('Adult transition applies only to under_18 accounts');
  }
  const now = nowIso();
  db.run(
    `UPDATE pilot_students SET age_band = ?, adult_transition_at = ?, updated_at = ? WHERE student_id = ?`,
    ['18_plus', now, now, studentId],
  );
  db.run(
    `UPDATE pilot_parent_accounts SET recovery_authority_active = 0, updated_at = ? WHERE student_id = ?`,
    [now, studentId],
  );
  setEnrollmentState(db, studentId, 'suspended_age_transition');
  revokeAllSessions(db, studentId, 'age_transition');
  return 'suspended_age_transition';
}

export function getInviteStatus(db: PilotSqlDb, inviteId: string): InviteStatus | null {
  const row = queryOne(db, `SELECT status FROM pilot_invites WHERE invite_id = ?`, [inviteId]);
  return row ? (String(row.status) as InviteStatus) : null;
}

export { setEnrollmentState };
