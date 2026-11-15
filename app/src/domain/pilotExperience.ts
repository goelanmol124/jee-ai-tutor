/**
 * Pilot student-experience contracts (W4).
 * Frontend-local types + adapters until the pilot API is wired in integration.
 */

import type { UnifiedSelfReport } from './tutorUnified';

export type PilotCohort = 'class_11' | 'class_12' | 'dropper';

export type PreferredLanguage = 'english' | 'roman_hinglish';

/** Evidence-linked coach certainty — never a hidden mastery probability. */
export type FeedbackCertainty = 'uncertain' | 'tentative' | 'definitive';

export type RecaptureHint =
  | 'retake_page'
  | 'add_missing_page'
  | 'brighter_lighting'
  | 'flatten_page'
  | 'crop_tighter'
  | 'write_darker';

export interface CapturePage {
  id: string;
  /** 1-based page number in current order */
  pageNumber: number;
  /** Object URL or data URL for preview */
  previewUrl: string;
  /** Original file when available (not persisted offline) */
  file?: File;
  fileName?: string;
  /** ISO timestamp when captured */
  capturedAt: string;
}

export interface PhotoReadback {
  /** What the system believes it saw — student may correct before diagnosis */
  transcribedWork: string;
  recognizedQuestionHint?: string;
  pageSummaries: Array<{ pageNumber: number; note: string }>;
  needsCorrection: boolean;
  suggestedRecapture?: RecaptureHint;
}

export interface StudentFacingDiagnosis {
  diagnosisId: string;
  certainty: FeedbackCertainty;
  /** Short evidence sentence: what was genuinely present */
  evidenceSummary: string;
  coachMessage: string;
  firstBreakOrSound: string;
  invitation: string;
  needsClarification: boolean;
  suggestedRecapture?: RecaptureHint;
  /** Opaque citation anchors for UI (page/region) — not hidden scores */
  evidenceAnchors: Array<{ label: string; detail: string }>;
}

export interface TopicPriorAnswer {
  subtopicId: string;
  label: string;
  /** Preserve formula_only distinctly — never collapse to seen */
  tier: UnifiedSelfReport;
}

export interface PilotProfile {
  nickname: string;
  cohort: PilotCohort;
  language: PreferredLanguage;
  coveredChapters: string[];
  topicPriors: TopicPriorAnswer[];
  /** Opaque student id from join; device stores only this */
  studentId?: string;
  /** Age band for notice copy — not full DOB */
  ageBand: 'under_18' | '18_plus';
  aiNoticeAcceptedAt?: string;
  privacyNoticeAcceptedAt?: string;
}

/** Bounded parent surface — never a full transcript */
export interface ParentProgressSummary {
  studentNickname: string;
  consentStatus: 'pending' | 'active' | 'withdrawn';
  independentlyCompleted: number;
  successfullyRescued: number;
  repeatedErrorCategoriesDeclining: boolean;
  delayedReviewRetentionNote: string;
  pastSelfTrendNote: string;
  lastActiveAt?: string;
  /** Explicitly no transcript, no rank, no readiness score */
  transcriptAvailable: false;
  readinessRankShown: false;
}

export type SolveStage = 'read' | 'capture' | 'readback' | 'live';

export interface OfflineSessionDraft {
  version: 1;
  savedAt: string;
  questionId: string;
  stage: SolveStage;
  captureMode: 'photo' | 'typed' | null;
  typedText: string;
  mcqIndex?: number;
  /** Persistable page previews (data URLs only) */
  pages: Array<{
    id: string;
    pageNumber: number;
    previewUrl: string;
    fileName?: string;
    capturedAt: string;
  }>;
  readbackCorrection?: string;
  threadSummary?: string;
  language: PreferredLanguage;
}

export interface DisputePayload {
  diagnosisId: string;
  questionId: string;
  note: string;
  createdAt: string;
}
