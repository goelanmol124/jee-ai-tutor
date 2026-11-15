import type { OfflineSessionDraft, PreferredLanguage, SolveStage } from '../domain/pilotExperience';
import type { CapturePage } from '../domain/pilotExperience';
import { pagesFromPersisted, pagesToPersistable } from './photoPages';

export const SESSION_DRAFT_KEY = 'al-solve-session-draft-v1';

export interface DraftSnapshotInput {
  questionId: string;
  stage: SolveStage;
  captureMode: 'photo' | 'typed' | null;
  typedText: string;
  mcqIndex?: number;
  pages: CapturePage[];
  readbackCorrection?: string;
  threadSummary?: string;
  language: PreferredLanguage;
}

export function buildSessionDraft(input: DraftSnapshotInput): OfflineSessionDraft {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    questionId: input.questionId,
    stage: input.stage,
    captureMode: input.captureMode,
    typedText: input.typedText,
    mcqIndex: input.mcqIndex,
    pages: pagesToPersistable(input.pages),
    readbackCorrection: input.readbackCorrection,
    threadSummary: input.threadSummary,
    language: input.language,
  };
}

export function saveSessionDraft(draft: OfflineSessionDraft, storage: Storage = localStorage): void {
  try {
    storage.setItem(SESSION_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadSessionDraft(storage: Storage = localStorage): OfflineSessionDraft | null {
  try {
    const raw = storage.getItem(SESSION_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineSessionDraft;
    if (parsed?.version !== 1 || !parsed.questionId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionDraft(storage: Storage = localStorage): void {
  try {
    storage.removeItem(SESSION_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function draftPages(draft: OfflineSessionDraft): CapturePage[] {
  return pagesFromPersisted(draft.pages ?? []);
}

/** Resume only when draft matches the current question and is incomplete. */
export function shouldResumeDraft(
  draft: OfflineSessionDraft | null,
  questionId: string,
): draft is OfflineSessionDraft {
  if (!draft) return false;
  if (draft.questionId !== questionId) return false;
  return draft.stage === 'capture' || draft.stage === 'readback' || draft.stage === 'live';
}
