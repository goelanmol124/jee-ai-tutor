import type { TutorTurn, UnifiedTutorStudentState, ChapterTopicChip } from '../domain/tutorUnified';

export interface TutorChapterEntryResponse {
  ok: boolean;
  chapterId?: string;
  chips?: ChapterTopicChip[];
  unifiedState?: UnifiedTutorStudentState;
  error?: string;
}

export interface TutorStepResponse {
  ok: boolean;
  tutorTurn?: TutorTurn;
  unifiedState?: UnifiedTutorStudentState;
  error?: string;
}

const jsonHeaders = { 'Content-Type': 'application/json' };

async function parse<T>(res: Response): Promise<T & { ok?: boolean; error?: string }> {
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  return data;
}

export async function tutorChapterEntryGet(chapterId: string): Promise<TutorChapterEntryResponse> {
  const url = `/api/tutor/chapter-entry?chapterId=${encodeURIComponent(chapterId)}`;
  const res = await fetch(url);
  const body = await parse<TutorChapterEntryResponse>(res);
  return {
    ...body,
    ok: res.ok && body.ok !== false,
    error: res.ok ? body.error : body.error ?? `HTTP ${res.status}`,
  };
}

export async function tutorChapterEntryPost(params: {
  studentId?: string;
  chapterId: string;
  chipAnswers?: Record<string, 'confident' | 'roughly' | 'heard' | 'new'>;
  freeText?: string;
}): Promise<TutorChapterEntryResponse> {
  const res = await fetch('/api/tutor/chapter-entry', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(params),
  });
  const body = await parse<TutorChapterEntryResponse>(res);
  return {
    ...body,
    ok: res.ok && body.ok !== false,
    error: res.ok ? body.error : body.error ?? `HTTP ${res.status}`,
  };
}

export async function tutorStep(params: {
  studentId?: string;
  chapterId: string;
  lastStudentMessage?: string;
  mixedPractice?: boolean;
}): Promise<TutorStepResponse> {
  const res = await fetch('/api/tutor/step', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(params),
  });
  const body = await parse<TutorStepResponse>(res);
  return {
    ...body,
    ok: res.ok && body.ok !== false,
    error: res.ok ? body.error : body.error ?? `HTTP ${res.status}`,
  };
}
