import { queryOne, type PilotSqlDb, type PilotStoreBundle } from './db.ts';
import { getConsentStatusMap } from './consent.ts';
import { getEnrollmentState } from './identity.ts';
import type { ParentProgressSummary } from './types.ts';

export type ProgressMetricInput = {
  independentlyCompletedQuestions?: number;
  questionsSuccessfullyRescued?: number;
  repeatedErrorCategoriesDeclining?: string[];
  delayedReviewRetention?: number | null;
  pastSelfTrends?: Array<{ label: string; direction: 'up' | 'down' | 'flat' }>;
};

/**
 * Bounded parent progress summary. Never includes transcript text or turn content.
 */
export function buildParentProgressSummary(
  stores: PilotStoreBundle,
  studentId: string,
  metrics: ProgressMetricInput = {},
): ParentProgressSummary {
  const enrollment = getEnrollmentState(stores.identityConsent, studentId);
  if (!enrollment) throw new Error('Unknown student');

  // Intentionally do not read conversations store for parent summary.
  const learning = queryOne(
    stores.learningState,
    `SELECT * FROM learning_progress_metrics WHERE student_id = ? AND metric_key = 'independently_completed'`,
    [studentId],
  );

  const summary = {
    studentId,
    accountStatus: enrollment,
    consentStatus: getConsentStatusMap(stores.identityConsent, studentId),
    independentlyCompletedQuestions:
      metrics.independentlyCompletedQuestions ?? Number(learning?.metric_value ?? 0),
    questionsSuccessfullyRescued: metrics.questionsSuccessfullyRescued ?? 0,
    repeatedErrorCategoriesDeclining: metrics.repeatedErrorCategoriesDeclining ?? [],
    delayedReviewRetention: metrics.delayedReviewRetention ?? null,
    pastSelfTrends: metrics.pastSelfTrends ?? [],
  };

  // Runtime guard: reject any accidental transcript leakage keys.
  const forbidden = ['transcript', 'turns', 'messages', 'fullTranscript', 'conversation'];
  for (const key of Object.keys(summary)) {
    if (forbidden.some((f) => key.toLowerCase().includes(f) && key !== 'studentId')) {
      throw new Error(`Parent progress summary must not include ${key}`);
    }
  }

  return summary;
}

/** Upsert a learning metric used by the bounded parent view (not transcript). */
export function upsertProgressMetric(
  learningDb: PilotSqlDb,
  studentId: string,
  metricKey: string,
  metricValue: number,
): void {
  learningDb.run(
    `INSERT INTO learning_progress_metrics (student_id, metric_key, metric_value, recorded_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(student_id, metric_key) DO UPDATE SET
       metric_value = excluded.metric_value,
       recorded_at = excluded.recorded_at`,
    [studentId, metricKey, metricValue, new Date().toISOString()],
  );
}

/**
 * Explicit policy helper: parents never receive full transcripts.
 * Always returns false for transcript access requests.
 */
export function parentMayViewFullTranscript(): false {
  return false;
}
