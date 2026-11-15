/**
 * Unified tutor student model (graph-driven tutor plan).
 * Separate from legacy `StudentState` in `./types.ts` used by Solve/diagnose.
 */

export type TutorConfidence = 'low' | 'medium' | 'high';

export type TutorCoachMode =
  | 'chapter_intro'
  | 'gauge_probe'
  | 'teach_concept'
  | 'derive_formula'
  | 'splice_step'
  | 'present_question'
  | 'diagnose_attempt'
  | 'error_probe'
  | 'local_correction'
  | 'confidence_reflection'
  | 'meta_narrate'
  | 'park_and_pivot'
  | 'review_recall';

/** Self-report for a topic / concept chip (prior only). */
export type UnifiedSelfReport = 'not_seen' | 'seen' | 'formula_only' | 'confident';

export type UnifiedObserved = 'untested' | 'shaky' | 'applied_correctly' | 'failed';

export interface UnifiedConceptEvidence {
  at: string;
  source:
    | 'self_report'
    | 'calibration_probe'
    | 'attempt_step'
    | 'follow_up'
    | 'splice'
    | 'micro_lesson_recap';
  outcome:
    | 'applied_well'
    | 'applied_with_help'
    | 'failed'
    | 'declared_unknown'
    | 'partially_correct'
    | 'recall_only';
  note: string;
  questionId?: string;
}

export interface UnifiedMistakePattern {
  id: string;
  category:
    | 'arithmetic'
    | 'sign'
    | 'factor'
    | 'formula_recall'
    | 'formula_application'
    | 'planning'
    | 'misread'
    | 'unit'
    | 'identity_choice'
    | 'boundary'
    | 'domain';
  firstSeen: string;
  lastSeen: string;
  occurrences: number;
  recoveredViaProbe?: boolean;
  /** Open-vocabulary description (canonical-ish). */
  specificInstance?: string;
  surfaceForms?: string[];
}

export interface UnifiedConceptKnowledge {
  conceptId: string;
  selfReport?: UnifiedSelfReport;
  observed: UnifiedObserved;
  formulaQuoting?: 'unknown' | 'partial' | 'correct';
  formulaUnderstanding?: 'unknown' | 'shaky' | 'derives_it';
  applicationFlexibility?: 'unknown' | 'rigid' | 'transfers';
  /** Derived; recomputed server-side — never authoritative alone. */
  belief: number;
  confidence: TutorConfidence;
  recentEvidence: UnifiedConceptEvidence[];
  mistakePatterns: UnifiedMistakePattern[];
  nextReviewAt?: string;
}

export interface UnifiedParkedItem {
  questionRef: string;
  parkedAt: string;
  reason?: string;
  chapterId?: string;
}

export type CoverageLevel = 'not_touched' | 'introduced' | 'practiced' | 'mastered_for_now';

export interface UnifiedChapterSession {
  chapterId: string;
  startedAt: string;
  conceptCoverage: Array<{
    conceptId: string;
    state: CoverageLevel;
    lastTouchedAt?: string;
  }>;
  subtopicCoverage: Array<{
    subtopicId: string;
    state: CoverageLevel;
  }>;
  parkedItems: UnifiedParkedItem[];
  lastChoiceRationale?: string;
}

/** SM-2 style schedule keyed in DB; also surfaced on concepts when needed */
export interface TutorReviewSchedule {
  intervalDays: number;
  ease: number;
  dueAt: string;
  lapses: number;
}

/** Picker passes these to LLM — rule layer proposes top 3 */
export interface PickerCandidate {
  id: string;
  mode: TutorCoachMode;
  targetConceptId: string;
  itemIntent: string;
  rationale: string;
}

export type TutorItem =
  | { kind: 'probe'; prompt: string; expectedAnswerShape?: string }
  | { kind: 'micro_lesson'; explanation: string; tinyExample?: string }
  | { kind: 'derivation'; setup: string; missingLine: string }
  | { kind: 'splice'; questionRef: string; presolved: string; gap: string }
  | { kind: 'question_ref'; questionRef: string }
  | { kind: 'review_recall'; conceptId: string; prompt: string }
  | { kind: 'park'; questionRef: string; reason: string };

export type TutorStateUpdate =
  | {
      kind: 'concept_observed';
      conceptId: string;
      observed: Exclude<UnifiedObserved, 'untested'>;
      formulaQuoting?: UnifiedConceptKnowledge['formulaQuoting'];
      formulaUnderstanding?: UnifiedConceptKnowledge['formulaUnderstanding'];
      applicationFlexibility?: UnifiedConceptKnowledge['applicationFlexibility'];
      confidence?: TutorConfidence;
      evidence: Omit<UnifiedConceptEvidence, 'at'>;
    }
  | {
      kind: 'mistake_observed';
      conceptId: string;
      candidate: {
        category: UnifiedMistakePattern['category'];
        specificInstance: string;
        surfaceForm: string;
      };
      recoveredViaProbe?: boolean;
    }
  | {
      kind: 'coverage_advance';
      conceptId: string;
      to: Exclude<CoverageLevel, 'not_touched'>;
    }
  | { kind: 'park_question'; questionRef: string; reason: string; chapterId?: string }
  | { kind: 'schedule_review'; conceptId: string; outcome: 'success' | 'fail' };

export interface TutorTurn {
  chosenCandidateId: string | 'custom';
  customCandidate?: { mode: TutorCoachMode; targetConcept: string; itemIntent: string };
  mode: TutorCoachMode;
  coachMessage: string;
  item?: TutorItem;
  metaNarration?: string;
  stateUpdates: TutorStateUpdate[];
  endsTurn: boolean;
}

/** Full persisted graph tutor state */
export interface UnifiedTutorStudentState {
  studentId: string;
  language: 'english' | 'hinglish';
  profileNarrative: string;
  concepts: Record<string, UnifiedConceptKnowledge>;
  chapterSessions: Record<string, UnifiedChapterSession>;
  globalMistakePatterns: UnifiedMistakePattern[];
  /** keyed conceptId → schedule */
  reviewSchedules?: Record<string, TutorReviewSchedule>;
  mistakePatternSchedules?: Record<string, TutorReviewSchedule>;
  updatedAt?: string;
  /** Mixed practice preference */
  sessionMode?: 'chapter' | 'mixed_practice';
  /** consecutive full JEe questions presented (interleave guard) */
  consecutiveFullQuestions?: number;
}

export interface TutorTranscriptTurn {
  role: 'student' | 'coach';
  content: string;
  at: string;
  tutorTurn?: TutorTurn;
}

export interface ChapterTopicChip {
  subtopicId: string;
  label: string;
  conceptIds: string[];
}
