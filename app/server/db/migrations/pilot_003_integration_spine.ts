/**
 * Integration-spine tables (assignment refs, telemetry, disputes, proposals, prefs).
 * Applied only via pilot store bootstrap — does not invent external providers.
 */

export const PILOT_MIGRATION_003_ID = 'pilot_003_integration_spine';

export const PILOT_003_IDENTITY_SQL = `
CREATE TABLE IF NOT EXISTS pilot_student_profile (
  student_id TEXT PRIMARY KEY,
  nickname TEXT,
  language_preference TEXT,
  updated_at TEXT NOT NULL
);
`;

export const PILOT_003_LEARNING_SQL = `
CREATE TABLE IF NOT EXISTS pilot_disputes (
  dispute_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  diagnosis_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_learner_proposals (
  proposal_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  concept_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  photo_ids_json TEXT NOT NULL,
  rationale TEXT NOT NULL,
  created_at TEXT NOT NULL,
  diagnosis_id TEXT
);

CREATE TABLE IF NOT EXISTS pilot_diagnosis_boundary (
  diagnosis_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  output_mode TEXT NOT NULL,
  state_mutated INTEGER NOT NULL DEFAULT 0,
  integration_gap TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const PILOT_003_RESEARCH_SQL = `
CREATE TABLE IF NOT EXISTS pilot_telemetry_events (
  event_id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  client_at TEXT NOT NULL,
  server_received_at TEXT NOT NULL,
  visible INTEGER NOT NULL,
  context TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pilot_assignment_refs (
  student_id TEXT PRIMARY KEY,
  arm TEXT NOT NULL,
  stratum TEXT NOT NULL,
  randomized_at TEXT NOT NULL,
  seed_ref TEXT NOT NULL,
  manifest_version TEXT
);

CREATE TABLE IF NOT EXISTS pilot_analysis_manifest_refs (
  manifest_id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  frozen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  payload_json TEXT
);
`;

function mark(db: { run: (sql: string, params?: unknown[]) => void }, id: string): void {
  db.run(`INSERT OR IGNORE INTO pilot_schema_migrations (id, applied_at) VALUES (?, datetime('now'))`, [id]);
}

export function applyPilot003IdentityMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_003_IDENTITY_SQL);
  mark(db, PILOT_MIGRATION_003_ID);
}

export function applyPilot003LearningMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_003_LEARNING_SQL);
  mark(db, PILOT_MIGRATION_003_ID);
}

export function applyPilot003ResearchMigration(db: { run: (sql: string, params?: unknown[]) => void }): void {
  db.run(PILOT_003_RESEARCH_SQL);
  mark(db, PILOT_MIGRATION_003_ID);
}
