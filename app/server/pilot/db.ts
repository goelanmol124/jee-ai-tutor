/**
 * Pilot sql.js store bootstrap. Separate from legacy tutor sqlite.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';
import {
  applyIdentityConsentMigrations,
  applyPilot002PhotosMigration,
  applySeparatedStoreMigrations,
} from '../db/migrations/index.ts';
import type { DataStoreName } from './types.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export type PilotSqlDb = {
  run: (sql: string, params?: unknown[]) => void;
  prepare: (sql: string) => {
    bind: (values?: unknown[]) => void;
    step: () => boolean;
    get: () => unknown[];
    getAsObject: () => Record<string, unknown>;
    free: () => void;
  };
  exec: (sql: string) => unknown;
  export: () => Uint8Array;
  close: () => void;
};

function sqlJsWasmDir(): string {
  return path.dirname(require.resolve('sql.js'));
}

async function openSqlJs(filePath?: string): Promise<PilotSqlDb> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => path.join(sqlJsWasmDir(), path.basename(file)),
  });
  if (filePath && fs.existsSync(filePath)) {
    const buf = fs.readFileSync(filePath);
    return new SQL.Database(buf) as unknown as PilotSqlDb;
  }
  return new SQL.Database() as unknown as PilotSqlDb;
}

export type PilotStoreBundle = {
  identityConsent: PilotSqlDb;
  learningState: PilotSqlDb;
  conversations: PilotSqlDb;
  transientPhotos: PilotSqlDb;
  evaluationPhotos: PilotSqlDb;
  securityLogs: PilotSqlDb;
  researchExtracts: PilotSqlDb;
};

export type PilotDbPaths = Partial<Record<DataStoreName, string>>;

function defaultDataDir(): string {
  const fromEnv = process.env.PILOT_DATA_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(__dirname, '../../data/pilot');
}

export function defaultPilotDbPaths(): Required<PilotDbPaths> {
  const dir = defaultDataDir();
  return {
    identity_consent: path.join(dir, 'identity_consent.sqlite'),
    learning_state: path.join(dir, 'learning_state.sqlite'),
    conversations: path.join(dir, 'conversations.sqlite'),
    transient_photos: path.join(dir, 'transient_photos.sqlite'),
    evaluation_photos: path.join(dir, 'evaluation_photos.sqlite'),
    security_logs: path.join(dir, 'security_logs.sqlite'),
    research_extracts: path.join(dir, 'research_extracts.sqlite'),
  };
}

/** In-memory separated stores with migrations applied — for tests and local harnesses. */
export async function openPilotStoresInMemory(): Promise<PilotStoreBundle> {
  const [
    identityConsent,
    learningState,
    conversations,
    transientPhotos,
    evaluationPhotos,
    securityLogs,
    researchExtracts,
  ] = await Promise.all([
    openSqlJs(),
    openSqlJs(),
    openSqlJs(),
    openSqlJs(),
    openSqlJs(),
    openSqlJs(),
    openSqlJs(),
  ]);

  applyIdentityConsentMigrations(identityConsent);
  applySeparatedStoreMigrations({
    learning: learningState,
    conversations,
    photos: transientPhotos,
    research: researchExtracts,
    securityLogs,
  });
  // Separate physical evaluation-photo DB; same schema family, distinct access role.
  applyPilot002PhotosMigration(evaluationPhotos);

  return {
    identityConsent,
    learningState,
    conversations,
    transientPhotos,
    evaluationPhotos,
    securityLogs,
    researchExtracts,
  };
}

/** Open on-disk separated stores (integration wiring may call this later). */
export async function openPilotStoresOnDisk(paths: PilotDbPaths = {}): Promise<PilotStoreBundle> {
  const resolved = { ...defaultPilotDbPaths(), ...paths };
  for (const p of Object.values(resolved)) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
  }

  const identityConsent = await openSqlJs(resolved.identity_consent);
  const learningState = await openSqlJs(resolved.learning_state);
  const conversations = await openSqlJs(resolved.conversations);
  const transientPhotos = await openSqlJs(resolved.transient_photos);
  const evaluationPhotos = await openSqlJs(resolved.evaluation_photos);
  const securityLogs = await openSqlJs(resolved.security_logs);
  const researchExtracts = await openSqlJs(resolved.research_extracts);

  applyIdentityConsentMigrations(identityConsent);
  applySeparatedStoreMigrations({
    learning: learningState,
    conversations,
    photos: transientPhotos,
    research: researchExtracts,
    securityLogs,
  });
  applyPilot002PhotosMigration(evaluationPhotos);

  return {
    identityConsent,
    learningState,
    conversations,
    transientPhotos,
    evaluationPhotos,
    securityLogs,
    researchExtracts,
  };
}

export function persistPilotDb(db: PilotSqlDb, filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, Buffer.from(db.export()));
}

export function queryAll(
  db: PilotSqlDb,
  sql: string,
  params: unknown[] = [],
): Record<string, unknown>[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: Record<string, unknown>[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function queryOne(
  db: PilotSqlDb,
  sql: string,
  params: unknown[] = [],
): Record<string, unknown> | null {
  const rows = queryAll(db, sql, params);
  return rows[0] ?? null;
}
