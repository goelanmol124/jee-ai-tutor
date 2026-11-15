/**
 * Client adapters for pilot API contracts (PROJECT_REPLAN §4.3).
 * Prefers real API routes; development fallback is explicit and marked.
 */

import type {
  CapturePage,
  DisputePayload,
  ParentProgressSummary,
  PhotoReadback,
  PilotCohort,
  PilotProfile,
  PreferredLanguage,
  RecaptureHint,
  StudentFacingDiagnosis,
  TopicPriorAnswer,
} from '../domain/pilotExperience';
import type { DiagnosisResult, QuestionNode } from '../domain/types';
import { toStudentFacingDiagnosis } from './feedbackCertainty';

/**
 * Development-only offline fallback when the pilot API is unreachable.
 * Never used as a silent production default — gated by VITE_PILOT_ALLOW_DEV_FALLBACK.
 */
const ALLOW_DEV_FALLBACK =
  import.meta.env.DEV === true
  && String(import.meta.env.VITE_PILOT_ALLOW_DEV_FALLBACK ?? '1') === '1';

const SESSION_TOKEN_KEY = 'al_pilot_session_token_v1';
const STUDENT_ID_KEY = 'al_pilot_student_id_v1';

export interface JoinRequest {
  inviteCode: string;
  nickname: string;
  cohort: PilotCohort;
  language: PreferredLanguage;
  ageBand: PilotProfile['ageBand'];
  acceptNotices?: boolean;
  grantPhotoDiagnosis?: boolean;
}

export interface JoinResponse {
  ok: boolean;
  studentId?: string;
  sessionToken?: string;
  enrollmentState?: string;
  processingAllowed?: boolean;
  blockers?: string[];
  error?: string;
  code?: string;
}

export interface SessionStartResponse {
  ok: boolean;
  questionId?: string;
  mode?: 'review' | 'continuation' | 'next_question';
  cohort?: PilotCohort;
  enrollmentState?: string;
  error?: string;
  code?: string;
}

export interface DiagnosePagesRequest {
  question: QuestionNode;
  pages: CapturePage[];
  typedWork?: string;
  correctionNote?: string;
  /** Student confirmed readback before consequential diagnosis */
  readbackConfirmed: boolean;
}

export interface DiagnosePagesResponse {
  ok: boolean;
  diagnosisId?: string;
  readback?: PhotoReadback;
  studentFacing?: StudentFacingDiagnosis;
  /** Pass-through local diagnosis for existing Solve coach path */
  diagnosis?: DiagnosisResult;
  integrationGap?: string;
  error?: string;
  code?: string;
}

function sessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeSession(studentId: string, token: string): void {
  try {
    localStorage.setItem(STUDENT_ID_KEY, studentId);
    localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch { /* ignore */ }
}

function authHeaders(json = true): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const token = sessionToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['x-session-token'] = token;
  }
  return headers;
}

async function parseJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

function mockStudentId(): string {
  const k = STUDENT_ID_KEY;
  try {
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const neo = `stu_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(k, neo);
    return neo;
  } catch {
    return `stu_${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** DEV FALLBACK ONLY — local opaque id when API is unreachable in development. */
function devFallbackJoin(req: JoinRequest): JoinResponse {
  console.warn('[pilotApi] DEV FALLBACK: join using local mock (API unreachable)');
  if (!req.nickname.trim()) return { ok: false, error: 'Nickname required' };
  if (!req.cohort) return { ok: false, error: 'Cohort required', code: 'cohort_required' };
  const studentId = mockStudentId();
  const token = `devtok_${Math.random().toString(36).slice(2, 14)}`;
  storeSession(studentId, token);
  return {
    ok: true,
    studentId,
    sessionToken: token,
    enrollmentState: req.ageBand === '18_plus' ? 'active' : 'parent_verification_pending',
    processingAllowed: req.ageBand === '18_plus',
    blockers:
      req.ageBand === 'under_18'
        ? ['Parent verification required (dev fallback — not a real verification).']
        : undefined,
  };
}

export async function pilotJoin(req: JoinRequest): Promise<JoinResponse> {
  try {
    const res = await fetch('/api/auth/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...req,
        acceptNotices: req.acceptNotices ?? true,
        grantPhotoDiagnosis: req.grantPhotoDiagnosis ?? true,
      }),
    });
    const data = await parseJson<JoinResponse>(res);
    if (data.ok && data.studentId && data.sessionToken) {
      storeSession(data.studentId, data.sessionToken);
    }
    return data;
  } catch (error) {
    if (ALLOW_DEV_FALLBACK) return devFallbackJoin(req);
    return { ok: false, error: error instanceof Error ? error.message : 'Join failed' };
  }
}

export async function pilotSessionStart(): Promise<SessionStartResponse> {
  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    return await parseJson<SessionStartResponse>(res);
  } catch (error) {
    if (ALLOW_DEV_FALLBACK) {
      console.warn('[pilotApi] DEV FALLBACK: session/start');
      return { ok: true, mode: 'next_question' };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Session start failed' };
  }
}

export async function pilotTutorContext(): Promise<{
  ok: boolean;
  cohort?: PilotCohort;
  reviewBudget?: unknown;
  stretchPrior?: unknown;
  prereqAnnotations?: unknown[];
  error?: string;
}> {
  try {
    const res = await fetch('/api/tutor/context', { headers: authHeaders(false) });
    return await parseJson(res);
  } catch (error) {
    if (ALLOW_DEV_FALLBACK) {
      console.warn('[pilotApi] DEV FALLBACK: tutor/context unavailable');
      return { ok: false, error: 'Tutor context unavailable (dev fallback)' };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Context failed' };
  }
}

/** Build a local readback the student can correct before diagnosis. */
export function buildLocalReadback(
  pages: CapturePage[],
  typedWork?: string,
  correctionNote?: string,
): PhotoReadback {
  const pageSummaries = pages.map((p) => ({
    pageNumber: p.pageNumber,
    note: p.fileName
      ? `Page ${p.pageNumber}: ${p.fileName}`
      : `Page ${p.pageNumber}: handwritten working`,
  }));
  const base =
    typedWork?.trim()
    || (pages.length
      ? `I see ${pages.length} page${pages.length === 1 ? '' : 's'} of handwritten work (ordered).`
      : 'No working attached yet.');
  const transcribedWork = correctionNote?.trim()
    ? correctionNote.trim()
    : base;
  let suggestedRecapture: RecaptureHint | undefined;
  if (pages.length === 0 && !typedWork?.trim()) {
    suggestedRecapture = 'add_missing_page';
  } else if (pages.some((p) => !p.previewUrl)) {
    suggestedRecapture = 'retake_page';
  }
  return {
    transcribedWork,
    pageSummaries,
    needsCorrection: false,
    suggestedRecapture,
    recognizedQuestionHint: 'Matching to the pinned question above.',
  };
}

/**
 * Photo path: first call without confirmation returns readback only.
 * After student confirms, hits staged diagnosis boundary (tentative / no mastery mutation).
 */
export async function pilotPreparePhotoDiagnosis(
  req: DiagnosePagesRequest,
): Promise<DiagnosePagesResponse> {
  try {
    const res = await fetch('/api/diagnosis/prepare', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        question: req.question,
        pages: req.pages.map((p) => ({
          id: p.id,
          pageNumber: p.pageNumber,
          previewUrl: p.previewUrl,
          fileName: p.fileName,
        })),
        typedWork: req.typedWork,
        correctionNote: req.correctionNote,
        readbackConfirmed: req.readbackConfirmed,
      }),
    });
    const data = await parseJson<DiagnosePagesResponse & { studentFacingHint?: { certainty: string } }>(res);
    if (data.ok && data.diagnosis) {
      data.studentFacing = toStudentFacingDiagnosis(data.diagnosis, data.diagnosisId);
    }
    return data;
  } catch (error) {
    if (!ALLOW_DEV_FALLBACK) {
      return { ok: false, error: error instanceof Error ? error.message : 'Diagnosis prepare failed' };
    }
    console.warn('[pilotApi] DEV FALLBACK: local readback/diagnosis shell');
    if (!req.readbackConfirmed) {
      return {
        ok: true,
        readback: buildLocalReadback(req.pages, req.typedWork, req.correctionNote),
      };
    }
    const diagnosisId = `diag_${Math.random().toString(36).slice(2, 12)}`;
    return {
      ok: true,
      diagnosisId,
      readback: buildLocalReadback(req.pages, req.typedWork, req.correctionNote),
      integrationGap: 'DEV FALLBACK: server diagnosis boundary unreachable',
    };
  }
}

export function attachStudentFacing(
  diagnosis: DiagnosisResult,
  diagnosisId?: string,
): StudentFacingDiagnosis {
  return toStudentFacingDiagnosis(diagnosis, diagnosisId);
}

export async function pilotDispute(payload: DisputePayload): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/feedback/dispute', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return (await res.json()) as { ok: boolean; error?: string };
  } catch (error) {
    if (ALLOW_DEV_FALLBACK) {
      console.warn('[pilotApi] DEV FALLBACK: dispute stored locally');
      try {
        const key = 'al_pilot_disputes_v1';
        const prev = JSON.parse(localStorage.getItem(key) ?? '[]') as DisputePayload[];
        prev.push(payload);
        localStorage.setItem(key, JSON.stringify(prev.slice(-50)));
      } catch { /* ignore */ }
      return { ok: true };
    }
    return { ok: false, error: error instanceof Error ? error.message : 'Dispute failed' };
  }
}

export async function pilotParentSummary(profile: PilotProfile): Promise<ParentProgressSummary> {
  try {
    const res = await fetch('/api/parent/summary', { headers: authHeaders(false) });
    const data = await parseJson<ParentProgressSummary & { ok?: boolean }>(res);
    if (data && 'transcriptAvailable' in data) {
      return {
        studentNickname: data.studentNickname || profile.nickname || 'Student',
        consentStatus: data.consentStatus,
        independentlyCompleted: data.independentlyCompleted,
        successfullyRescued: data.successfullyRescued,
        repeatedErrorCategoriesDeclining: data.repeatedErrorCategoriesDeclining,
        delayedReviewRetentionNote: data.delayedReviewRetentionNote,
        pastSelfTrendNote: data.pastSelfTrendNote,
        lastActiveAt: data.lastActiveAt,
        transcriptAvailable: false,
        readinessRankShown: false,
      };
    }
  } catch {
    if (!ALLOW_DEV_FALLBACK) {
      return {
        studentNickname: profile.nickname || 'Student',
        consentStatus: 'pending',
        independentlyCompleted: 0,
        successfullyRescued: 0,
        repeatedErrorCategoriesDeclining: false,
        delayedReviewRetentionNote: 'Parent summary unavailable.',
        pastSelfTrendNote: 'Parent summary unavailable.',
        transcriptAvailable: false,
        readinessRankShown: false,
      };
    }
    console.warn('[pilotApi] DEV FALLBACK: bounded local parent summary');
  }
  return {
    studentNickname: profile.nickname || 'Student',
    consentStatus: profile.privacyNoticeAcceptedAt ? 'active' : 'pending',
    independentlyCompleted: 0,
    successfullyRescued: 0,
    repeatedErrorCategoriesDeclining: false,
    delayedReviewRetentionNote: 'Review retention appears after a few spaced sessions.',
    pastSelfTrendNote: 'Past-self trends unlock after repeat practice on similar ideas.',
    lastActiveAt: new Date().toISOString(),
    transcriptAvailable: false,
    readinessRankShown: false,
  };
}

export async function pilotTelemetryIngest(events: Array<{
  eventId: string;
  type: string;
  clientAt: string;
  visible: boolean;
  context?: string;
}>): Promise<{ ok: boolean; accepted?: number }> {
  try {
    const res = await fetch('/api/telemetry/ingest', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ events }),
    });
    return await parseJson(res);
  } catch {
    if (ALLOW_DEV_FALLBACK) {
      console.warn('[pilotApi] DEV FALLBACK: telemetry drop');
      return { ok: true, accepted: 0 };
    }
    return { ok: false };
  }
}

export async function pilotLaunchChecklist(): Promise<unknown> {
  const res = await fetch('/api/pilot/launch-checklist');
  return parseJson(res);
}

export function defaultTopicPriorsFromChapters(
  chapters: Array<{ id: string; title: string }>,
): TopicPriorAnswer[] {
  return chapters.slice(0, 6).map((ch) => ({
    subtopicId: ch.id,
    label: ch.title,
    tier: 'not_seen' as const,
  }));
}

export const COHORT_LABELS: Record<PilotCohort, string> = {
  class_11: 'Class 11',
  class_12: 'Class 12',
  dropper: 'Dropper',
};

export const LANGUAGE_LABELS: Record<PreferredLanguage, string> = {
  english: 'English',
  roman_hinglish: 'Roman Hinglish',
};

export const SELF_REPORT_TIERS: Array<{ id: TopicPriorAnswer['tier']; label: string }> = [
  { id: 'confident', label: 'Confident' },
  { id: 'seen', label: 'Know roughly' },
  { id: 'formula_only', label: 'Formula only' },
  { id: 'not_seen', label: 'New to me' },
];
