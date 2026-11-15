/**
 * Pilot identity/consent vault schema (W1).
 * Applied only via pilot store bootstrap — does not mutate legacy tutor migrations.
 */

export const PILOT_MIGRATION_ID = 'pilot_001_identity_consent';

export const PILOT_001_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_invites (
  invite_id TEXT PRIMARY KEY,
  invite_code_hash TEXT NOT NULL UNIQUE,
  invite_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  cohort TEXT,
  created_at TEXT NOT NULL,
  deactivated_at TEXT,
  rotated_from TEXT,
  meta_json TEXT
);

CREATE TABLE IF NOT EXISTS pilot_students (
  student_id TEXT PRIMARY KEY,
  age_band TEXT NOT NULL,
  enrollment_status TEXT NOT NULL,
  cohort TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  adult_transition_at TEXT,
  deactivated_at TEXT
);

CREATE TABLE IF NOT EXISTS pilot_parent_accounts (
  parent_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  verification_status TEXT NOT NULL,
  verification_method TEXT,
  verification_result_token TEXT,
  guardian_declaration TEXT,
  contact_channel_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  recovery_authority_active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_sessions (
  session_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  revoke_reason TEXT,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_consent_records (
  consent_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  purpose TEXT NOT NULL,
  decision TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  retention_version TEXT NOT NULL,
  data_categories_json TEXT NOT NULL,
  processor_list_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  withdrawn_at TEXT,
  verification_method TEXT,
  verification_result TEXT,
  receipt_id TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_assent_records (
  assent_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  notice_version TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_enrollment_state (
  student_id TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  detail_json TEXT,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_rights_requests (
  request_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  request_type TEXT NOT NULL,
  status TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  payload_json TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  tombstone_json TEXT,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE TABLE IF NOT EXISTS pilot_access_grants (
  grant_id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  student_id TEXT,
  resource_store TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  case_id TEXT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  fields_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_access_audit (
  audit_id TEXT PRIMARY KEY,
  grant_id TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_store TEXT NOT NULL,
  student_id TEXT,
  reason_code TEXT,
  case_id TEXT,
  fields_viewed_json TEXT,
  recorded_at TEXT NOT NULL,
  detail_json TEXT
);

CREATE TABLE IF NOT EXISTS pilot_deletion_jobs (
  job_id TEXT PRIMARY KEY,
  student_id TEXT,
  store_name TEXT NOT NULL,
  category TEXT NOT NULL,
  due_at TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  evidence_json TEXT
);

CREATE TABLE IF NOT EXISTS pilot_correction_records (
  correction_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  field_path TEXT NOT NULL,
  old_value_redacted TEXT,
  new_value_redacted TEXT,
  requester_role TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  FOREIGN KEY (student_id) REFERENCES pilot_students(student_id)
);

CREATE INDEX IF NOT EXISTS idx_pilot_sessions_student ON pilot_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_pilot_consent_student ON pilot_consent_records(student_id, purpose);
CREATE INDEX IF NOT EXISTS idx_pilot_deletion_due ON pilot_deletion_jobs(status, due_at);
CREATE INDEX IF NOT EXISTS idx_pilot_access_grants_expiry ON pilot_access_grants(expires_at);
`;

export function applyPilot001Migration(db: { run: (sql: string) => void }): void {
  db.run(PILOT_001_SQL);
  db.run(
    `INSERT OR IGNORE INTO pilot_schema_migrations (id, applied_at) VALUES ('${PILOT_MIGRATION_ID}', datetime('now'))`,
  );
}
