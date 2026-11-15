/**
 * Logical separated stores for learning markers, conversations, photos,
 * research extracts, and content-free security logs (W1 contracts).
 */

export const PILOT_MIGRATION_002_ID = 'pilot_002_separated_stores';

export const PILOT_002_LEARNING_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_state_refs (
  student_id TEXT PRIMARY KEY,
  state_updated_at TEXT NOT NULL,
  retention_anchor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_progress_metrics (
  student_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  metric_value REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (student_id, metric_key)
);
`;

export const PILOT_002_CONVERSATIONS_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversation_turn_refs (
  turn_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retention_expires_at TEXT NOT NULL
);
`;

export const PILOT_002_PHOTOS_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transient_photo_refs (
  photo_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  delete_by TEXT NOT NULL,
  deleted_at TEXT,
  purpose TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluation_photo_refs (
  photo_id TEXT PRIMARY KEY,
  coded_subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  final_eval_locked_at TEXT,
  delete_by TEXT,
  deleted_at TEXT
);
`;

export const PILOT_002_RESEARCH_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS research_extracts (
  extract_id TEXT PRIMARY KEY,
  coded_subject_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  withdrawn_at TEXT,
  payload_kind TEXT NOT NULL
);
`;

export const PILOT_002_SECURITY_LOGS_SQL = `
CREATE TABLE IF NOT EXISTS pilot_schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS security_access_logs (
  log_id TEXT PRIMARY KEY,
  event_name TEXT NOT NULL,
  opaque_account_id TEXT,
  request_id TEXT,
  recorded_at TEXT NOT NULL,
  status TEXT NOT NULL,
  redacted_error_category TEXT,
  region_tag TEXT NOT NULL DEFAULT 'IN'
);
`;

function mark(db: { run: (sql: string, params?: unknown[]) => void }, id: string): void {
  db.run(`INSERT OR IGNORE INTO pilot_schema_migrations (id, applied_at) VALUES (?, datetime('now'))`, [id]);
}

export function applyPilot002LearningMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_002_LEARNING_SQL);
  mark(db, PILOT_MIGRATION_002_ID);
}

export function applyPilot002ConversationsMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_002_CONVERSATIONS_SQL);
  mark(db, PILOT_MIGRATION_002_ID);
}

export function applyPilot002PhotosMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_002_PHOTOS_SQL);
  mark(db, PILOT_MIGRATION_002_ID);
}

export function applyPilot002ResearchMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_002_RESEARCH_SQL);
  mark(db, PILOT_MIGRATION_002_ID);
}

export function applyPilot002SecurityLogsMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_002_SECURITY_LOGS_SQL);
  mark(db, PILOT_MIGRATION_002_ID);
}
