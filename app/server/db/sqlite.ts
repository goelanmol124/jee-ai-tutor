/**
 * sql.js persistent DB for unified tutor state.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function sqlJsWasmDir(): string {
  /** `exports` forbid resolving `sql.js/package.json`; main resolves to dist/sql-wasm.js */
  return path.dirname(require.resolve('sql.js'));
}

export type SqlDatabase = Awaited<ReturnType<typeof initSqlJs>>['Database'];

let dbInstance: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']> | null = null;
let initPromise: Promise<InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>> | null = null;

function defaultDbPath(): string {
  const fromEnv = process.env.TUTOR_SQLITE_PATH?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(__dirname, '../../data/tutor.sqlite');
}

async function createDatabase(): Promise<InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>> {
  const wasmDir = sqlJsWasmDir();
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, path.basename(file)),
  });

  const dbPath = defaultDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  let db: InstanceType<(typeof SQL)['Database']>;
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  runMigrations(db);
  persistDb(db, dbPath);

  return db;
}

function persistDb(db: { export: () => Uint8Array }, dbPath: string) {
  const data = db.export();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(data));
}

export async function getTutorDb(): Promise<InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>> {
  if (dbInstance) return dbInstance;
  if (!initPromise) {
    initPromise = createDatabase().then((db) => {
      dbInstance = db;
      return db;
    });
  }
  return initPromise;
}

export function flushTutorDb(db: { export: () => Uint8Array }) {
  const dbPath = defaultDbPath();
  persistDb(db, dbPath);
}

function runMigrations(db: InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>) {
  db.run(`
    CREATE TABLE IF NOT EXISTS tutor_meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS tutor_student_state (
      student_id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tutor_transcript_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id TEXT NOT NULL,
      chapter_id TEXT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      tutor_turn_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tutor_review_schedule (
      student_id TEXT NOT NULL,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL,
      interval_days REAL NOT NULL,
      ease REAL NOT NULL,
      due_at TEXT NOT NULL,
      lapses INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (student_id, scope, scope_id)
    );
    CREATE TABLE IF NOT EXISTS tutor_cached_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bucket TEXT NOT NULL DEFAULT '_global',
      concept_id TEXT NOT NULL,
      intent TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 1,
      item_json TEXT NOT NULL,
      UNIQUE(bucket, concept_id, intent, difficulty)
    );
    CREATE TABLE IF NOT EXISTS tutor_mistake_pattern (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      concept_id TEXT,
      category TEXT NOT NULL,
      canonical_key TEXT NOT NULL,
      occurrences INTEGER NOT NULL DEFAULT 1,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL,
      surface_forms_json TEXT
    );
    CREATE TABLE IF NOT EXISTS tutor_chapter_chips (
      chapter_id TEXT PRIMARY KEY,
      chips_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_review_due ON tutor_review_schedule(student_id, due_at);
  `);
}

/** For tests: reset in-memory DB */
export async function openTutorDbInMemory(): Promise<InstanceType<Awaited<ReturnType<typeof initSqlJs>>['Database']>> {
  const wasmDir = sqlJsWasmDir();
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(wasmDir, path.basename(file)),
  });
  const db = new SQL.Database();
  runMigrations(db);
  return db;
}
