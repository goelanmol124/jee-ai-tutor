/**
 * Pilot runtime bootstrap: stores, holdout bank, assignment/manifest interfaces.
 */
import type { PilotStoreBundle } from '../pilot/db.ts';
import {
  defaultPilotDbPaths,
  openPilotStoresInMemory,
  openPilotStoresOnDisk,
  persistPilotDb,
  queryAll,
  queryOne,
} from '../pilot/db.ts';
import { evaluateLaunchGates, resolveRuntimeMode, type PilotLaunchConfig } from '../pilot/launchGates.ts';
import {
  buildLaunchChecklist,
  createHoldoutBank,
  freezeHoldoutBank,
  type SoftwareLaunchSignals,
} from '../pilot-study/index.ts';
import type { HoldoutBank } from '../pilot-study/types.ts';
import type { LearnerCohort } from '../learner/types.ts';
import type { TelemetryEvent } from '../telemetry/types.ts';
import { deriveActiveTime } from '../telemetry/activeTime.ts';
import { newOpaqueId, nowIso } from '../pilot/ids.ts';

export type PilotCohort = LearnerCohort;

let storesPromise: Promise<PilotStoreBundle> | null = null;
let holdoutBank: HoldoutBank | null = null;

export function getLaunchConfig(): PilotLaunchConfig {
  return { runtimeMode: resolveRuntimeMode() };
}

export async function getPilotStores(): Promise<PilotStoreBundle> {
  if (!storesPromise) {
    const mode = resolveRuntimeMode();
    storesPromise = (async () => {
      if (mode === 'test' || process.env.PILOT_IN_MEMORY === '1') {
        return openPilotStoresInMemory();
      }
      return openPilotStoresOnDisk();
    })();
  }
  return storesPromise;
}

/** Test helper — reset singleton between smoke specs. */
export async function resetPilotRuntimeForTests(): Promise<PilotStoreBundle> {
  storesPromise = Promise.resolve(await openPilotStoresInMemory());
  holdoutBank = freezeHoldoutBank(
    createHoldoutBank('test_holdout_v1', ['holdout_q_smoke_1', 'holdout_q_smoke_2'], {
      freeze: true,
    }),
  );
  return storesPromise;
}

export function getHoldoutBank(): HoldoutBank {
  if (!holdoutBank) {
    const fromEnv = process.env.PILOT_HOLDOUT_ITEM_IDS?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const ids =
      fromEnv && fromEnv.length > 0
        ? fromEnv
        : ['holdout_q_placeholder_1', 'holdout_q_placeholder_2'];
    holdoutBank = freezeHoldoutBank(
      createHoldoutBank(process.env.PILOT_HOLDOUT_BANK_VERSION?.trim() || 'pilot_holdout_v1', ids, {
        freeze: true,
      }),
    );
  }
  return holdoutBank;
}

export function setHoldoutBankForTests(bank: HoldoutBank): void {
  holdoutBank = bank;
}

export function persistPilotStores(stores: PilotStoreBundle): void {
  if (process.env.PILOT_IN_MEMORY === '1' || resolveRuntimeMode() === 'test') return;
  const paths = defaultPilotDbPaths();
  persistPilotDb(stores.identityConsent, paths.identity_consent);
  persistPilotDb(stores.learningState, paths.learning_state);
  persistPilotDb(stores.conversations, paths.conversations);
  persistPilotDb(stores.transientPhotos, paths.transient_photos);
  persistPilotDb(stores.evaluationPhotos, paths.evaluation_photos);
  persistPilotDb(stores.securityLogs, paths.security_logs);
  persistPilotDb(stores.researchExtracts, paths.research_extracts);
}

export function upsertStudentProfile(
  stores: PilotStoreBundle,
  studentId: string,
  profile: { nickname?: string; language?: string },
): void {
  const now = nowIso();
  stores.identityConsent.run(
    `INSERT INTO pilot_student_profile (student_id, nickname, language_preference, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       nickname = COALESCE(excluded.nickname, pilot_student_profile.nickname),
       language_preference = COALESCE(excluded.language_preference, pilot_student_profile.language_preference),
       updated_at = excluded.updated_at`,
    [studentId, profile.nickname ?? null, profile.language ?? null, now],
  );
}

export function getStudentCohort(stores: PilotStoreBundle, studentId: string): PilotCohort | null {
  const row = queryOne(
    stores.identityConsent,
    `SELECT cohort FROM pilot_students WHERE student_id = ?`,
    [studentId],
  );
  const cohort = row?.cohort;
  if (cohort === 'class_11' || cohort === 'class_12' || cohort === 'dropper') {
    return cohort;
  }
  return null;
}

export function getStudentProfile(
  stores: PilotStoreBundle,
  studentId: string,
): { nickname: string | null; language: string | null; cohort: PilotCohort | null } {
  const profile = queryOne(
    stores.identityConsent,
    `SELECT nickname, language_preference FROM pilot_student_profile WHERE student_id = ?`,
    [studentId],
  );
  return {
    nickname: profile?.nickname != null ? String(profile.nickname) : null,
    language: profile?.language_preference != null ? String(profile.language_preference) : null,
    cohort: getStudentCohort(stores, studentId),
  };
}

export function ingestTelemetryEvents(
  stores: PilotStoreBundle,
  events: TelemetryEvent[],
): { accepted: number; activeTime: ReturnType<typeof deriveActiveTime> | null } {
  const now = nowIso();
  let accepted = 0;
  for (const event of events) {
    stores.researchExtracts.run(
      `INSERT OR IGNORE INTO pilot_telemetry_events (
        event_id, student_id, session_id, event_type, client_at, server_received_at,
        visible, context, payload_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        event.eventId,
        event.studentId,
        event.sessionId,
        event.type,
        event.clientAt,
        event.serverReceivedAt ?? now,
        event.visible ? 1 : 0,
        event.context,
        JSON.stringify({
          eventVersion: event.eventVersion,
        }),
      ],
    );
    accepted += 1;
  }
  // Derive from clientAt when server stamps would collapse same-ms batches.
  const forDerivation = events.map((e) => ({
    ...e,
    serverReceivedAt: e.clientAt,
  }));
  const activeTime = forDerivation.length > 0 ? deriveActiveTime({ events: forDerivation }) : null;
  return { accepted, activeTime };
}

export function listTelemetryForStudent(
  stores: PilotStoreBundle,
  studentId: string,
): TelemetryEvent[] {
  const rows = queryAll(
    stores.researchExtracts,
    `SELECT * FROM pilot_telemetry_events WHERE student_id = ? ORDER BY server_received_at ASC`,
    [studentId],
  );
  return rows.map((row) => ({
    eventId: String(row.event_id),
    studentId: String(row.student_id),
    sessionId: String(row.session_id),
    type: String(row.event_type) as TelemetryEvent['type'],
    clientAt: String(row.client_at),
    serverReceivedAt: String(row.server_received_at),
    visible: Number(row.visible) === 1,
    context: String(row.context) as TelemetryEvent['context'],
    eventVersion: 'foreground_heartbeat_v1' as const,
  }));
}

/**
 * Assignment / manifest persistence interface.
 * Full stratified randomization remains operator-driven; this stores opaque refs only.
 */
export function persistAssignmentRef(
  stores: PilotStoreBundle,
  ref: {
    studentId: string;
    arm: 'early' | 'delayed';
    stratum: PilotCohort;
    seedRef: string;
    manifestVersion?: string;
  },
): void {
  stores.researchExtracts.run(
    `INSERT INTO pilot_assignment_refs (student_id, arm, stratum, randomized_at, seed_ref, manifest_version)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET
       arm = excluded.arm,
       stratum = excluded.stratum,
       randomized_at = excluded.randomized_at,
       seed_ref = excluded.seed_ref,
       manifest_version = excluded.manifest_version`,
    [
      ref.studentId,
      ref.arm,
      ref.stratum,
      nowIso(),
      ref.seedRef,
      ref.manifestVersion ?? null,
    ],
  );
}

export function persistManifestRef(
  stores: PilotStoreBundle,
  ref: { manifestId: string; contentHash: string; frozen: boolean; payload?: unknown },
): void {
  stores.researchExtracts.run(
    `INSERT INTO pilot_analysis_manifest_refs (manifest_id, content_hash, frozen, created_at, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(manifest_id) DO UPDATE SET
       content_hash = excluded.content_hash,
       frozen = excluded.frozen,
       payload_json = excluded.payload_json`,
    [
      ref.manifestId,
      ref.contentHash,
      ref.frozen ? 1 : 0,
      nowIso(),
      ref.payload != null ? JSON.stringify(ref.payload) : null,
    ],
  );
}

export function recordDispute(
  stores: PilotStoreBundle,
  input: { studentId: string; diagnosisId: string; questionId: string; note?: string },
): string {
  const disputeId = newOpaqueId('dsp');
  stores.learningState.run(
    `INSERT INTO pilot_disputes (dispute_id, student_id, diagnosis_id, question_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      disputeId,
      input.studentId,
      input.diagnosisId,
      input.questionId,
      input.note ?? null,
      nowIso(),
    ],
  );
  return disputeId;
}

export function softwareLaunchSignals(): SoftwareLaunchSignals {
  return {
    stratifiedAssignmentModule: true,
    blindedAnalysisManifest: true,
    holdoutBankBoundary: true,
    activeTimeDerivation: true,
    feasibilityGates: true,
    handwritingEvalSchema: true,
    pilotExecuted: false,
  };
}

export function currentLaunchChecklist() {
  const gates = evaluateLaunchGates(getLaunchConfig());
  const humanResolutions: Record<string, { resolved: boolean; note?: string }> = {};
  // Map W1 gate keys onto checklist human blocker ids without inventing resolution.
  const gateToChecklist: Record<string, string> = {
    legal_entity: 'indian_operator_entity',
    indian_counsel: 'indian_counsel_memo',
    parent_verification_provider: 'parent_verification_method',
    ethics_approval: 'ethics_body',
    model_zdr: 'model_provider_zdr_dpa',
    safeguarding_personnel: 'safeguarding_personnel',
  };
  for (const g of gates) {
    const id = gateToChecklist[g.key];
    if (!id) continue;
    humanResolutions[id] = {
      resolved: g.configured,
      note: g.configured ? undefined : g.blockerMessage,
    };
  }
  return buildLaunchChecklist(softwareLaunchSignals(), nowIso(), humanResolutions);
}
