import { queryAll, type PilotSqlDb, type PilotStoreBundle } from './db.ts';
import { newOpaqueId, nowIso } from './ids.ts';
import type { RetentionCategory, RetentionPolicy } from './types.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Binding retention schedule from the research decision memo. */
export const RETENTION_POLICIES: RetentionPolicy[] = [
  {
    category: 'operational_raw_photos',
    rule: 'Delete within 24 hours; target minutes',
    maxAgeMs: DAY,
    store: 'transient_photos',
  },
  {
    category: 'evaluation_photos',
    rule: 'Delete 90 days after final locked evaluation',
    maxAgeMs: 90 * DAY,
    store: 'evaluation_photos',
  },
  {
    category: 'tutor_transcripts',
    rule: 'Rolling 90 days',
    maxAgeMs: 90 * DAY,
    store: 'conversations',
  },
  {
    category: 'structured_learner_state',
    rule: 'Pilot plus 90 days',
    maxAgeMs: null,
    store: 'learning_state',
  },
  {
    category: 'identity_recovery',
    rule: 'Pilot plus 30 days',
    maxAgeMs: null,
    store: 'identity_consent',
  },
  {
    category: 'consent_receipts',
    rule: 'Three years, subject to counsel/ethics decision',
    maxAgeMs: 3 * 365 * DAY,
    store: 'identity_consent',
  },
  {
    category: 'security_logs',
    rule: '365 days with required rolling Indian storage',
    maxAgeMs: 365 * DAY,
    store: 'security_logs',
  },
  {
    category: 'encrypted_backups',
    rule: '30-day expiry',
    maxAgeMs: 30 * DAY,
    store: 'identity_consent',
  },
  {
    category: 'deletion_tombstones',
    rule: 'Three years with no deleted content',
    maxAgeMs: 3 * 365 * DAY,
    store: 'identity_consent',
  },
];

export function policyFor(category: RetentionCategory): RetentionPolicy {
  const found = RETENTION_POLICIES.find((p) => p.category === category);
  if (!found) throw new Error(`Unknown retention category ${category}`);
  return found;
}

export function scheduleDeletionJob(
  identityDb: PilotSqlDb,
  input: {
    studentId?: string;
    storeName: string;
    category: RetentionCategory;
    dueAt: string;
  },
): string {
  const jobId = newOpaqueId('del');
  identityDb.run(
    `INSERT INTO pilot_deletion_jobs (
      job_id, student_id, store_name, category, due_at, status, created_at
    ) VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    [jobId, input.studentId ?? null, input.storeName, input.category, input.dueAt, nowIso()],
  );
  return jobId;
}

export function registerTransientPhoto(
  photosDb: PilotSqlDb,
  identityDb: PilotSqlDb,
  studentId: string,
  purpose: 'transient_photo_diagnosis' | 'raw_photo_research_evaluation' = 'transient_photo_diagnosis',
): { photoId: string; deleteBy: string } {
  const photoId = newOpaqueId('pho');
  const createdAt = nowIso();
  const deleteBy = new Date(Date.now() + DAY).toISOString();
  photosDb.run(
    `INSERT INTO transient_photo_refs (photo_id, student_id, created_at, delete_by, purpose)
     VALUES (?, ?, ?, ?, ?)`,
    [photoId, studentId, createdAt, deleteBy, purpose],
  );
  scheduleDeletionJob(identityDb, {
    studentId,
    storeName: 'transient_photos',
    category: 'operational_raw_photos',
    dueAt: deleteBy,
  });
  return { photoId, deleteBy };
}

export type RetentionRunResult = {
  jobId: string;
  category: string;
  status: 'completed' | 'skipped';
  detail: string;
};

/**
 * Apply due deletion jobs. Content bytes are not stored here; refs are hard-deleted
 * and tombstones retained in the identity vault.
 */
export function runDueRetentionJobs(
  stores: PilotStoreBundle,
  now = new Date(),
): RetentionRunResult[] {
  const nowIsoStr = now.toISOString();
  const due = queryAll(
    stores.identityConsent,
    `SELECT * FROM pilot_deletion_jobs WHERE status = 'pending' AND due_at <= ?`,
    [nowIsoStr],
  );
  const results: RetentionRunResult[] = [];

  for (const job of due) {
    const jobId = String(job.job_id);
    const category = String(job.category) as RetentionCategory;
    const studentId = job.student_id ? String(job.student_id) : null;

    if (category === 'operational_raw_photos') {
      // Job due_at is authoritative; delete_by on the ref is the schedule hint.
      if (studentId) {
        stores.transientPhotos.run(
          `UPDATE transient_photo_refs SET deleted_at = ? WHERE student_id = ? AND deleted_at IS NULL`,
          [nowIsoStr, studentId],
        );
        stores.transientPhotos.run(
          `DELETE FROM transient_photo_refs WHERE student_id = ? AND deleted_at IS NOT NULL`,
          [studentId],
        );
      } else {
        stores.transientPhotos.run(
          `UPDATE transient_photo_refs SET deleted_at = ? WHERE deleted_at IS NULL AND delete_by <= ?`,
          [nowIsoStr, nowIsoStr],
        );
        stores.transientPhotos.run(`DELETE FROM transient_photo_refs WHERE deleted_at IS NOT NULL`);
      }
    } else if (category === 'tutor_transcripts') {
      stores.conversations.run(
        `DELETE FROM conversation_turn_refs WHERE student_id = ? AND retention_expires_at <= ?`,
        [studentId, nowIsoStr],
      );
    } else if (category === 'evaluation_photos') {
      stores.evaluationPhotos.run(
        `UPDATE evaluation_photo_refs SET deleted_at = ? WHERE delete_by IS NOT NULL AND delete_by <= ? AND deleted_at IS NULL`,
        [nowIsoStr, nowIsoStr],
      );
      stores.evaluationPhotos.run(`DELETE FROM evaluation_photo_refs WHERE deleted_at IS NOT NULL`);
    } else if (category === 'security_logs') {
      const cutoff = new Date(now.getTime() - 365 * DAY).toISOString();
      stores.securityLogs.run(`DELETE FROM security_access_logs WHERE recorded_at < ?`, [cutoff]);
    }

    const tombstone = {
      jobId,
      category,
      studentId,
      completedAt: nowIsoStr,
      contentRetained: false,
    };
    stores.identityConsent.run(
      `UPDATE pilot_deletion_jobs SET status = 'completed', completed_at = ?, evidence_json = ? WHERE job_id = ?`,
      [nowIsoStr, JSON.stringify(tombstone), jobId],
    );
    results.push({ jobId, category, status: 'completed', detail: 'deleted_refs_and_tombstoned' });
  }

  return results;
}

/** Schedule post-withdrawal operational deletion across separated stores. */
export function enqueueWithdrawalDeletions(
  identityDb: PilotSqlDb,
  studentId: string,
  pilotClosedAt?: string,
): string[] {
  const now = Date.now();
  const jobs: string[] = [];
  jobs.push(
    scheduleDeletionJob(identityDb, {
      studentId,
      storeName: 'transient_photos',
      category: 'operational_raw_photos',
      dueAt: new Date(now).toISOString(),
    }),
  );
  jobs.push(
    scheduleDeletionJob(identityDb, {
      studentId,
      storeName: 'conversations',
      category: 'tutor_transcripts',
      dueAt: new Date(now).toISOString(),
    }),
  );
  const learnerDue = pilotClosedAt
    ? new Date(new Date(pilotClosedAt).getTime() + 90 * DAY).toISOString()
    : new Date(now + 90 * DAY).toISOString();
  jobs.push(
    scheduleDeletionJob(identityDb, {
      studentId,
      storeName: 'learning_state',
      category: 'structured_learner_state',
      dueAt: learnerDue,
    }),
  );
  return jobs;
}
