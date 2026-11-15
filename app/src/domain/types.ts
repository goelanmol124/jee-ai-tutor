export type Subject = 'math' | 'physics' | 'chemistry';

export type SessionMode = 'diagnose' | 'build' | 'polish';

export type MistakeType =
  | 'conceptual_gap'
  | 'wrong_understanding'
  | 'procedure_error'
  | 'silly_mistake'
  | 'unclear_evidence';

export type TutorTool =
  | 'diagnosis_card'
  | 'hint_ladder'
  | 'micro_lesson'
  | 'worked_example'
  | 'splice'
  | 'micro_drill'
  | 'full_drill'
  | 'flashcard'
  | 'check_card'
  | 'reflection_card';

export type TutorCardKind =
  | 'diagnosis'
  | 'fix'
  | 'next_action'
  | 'check'
  | 'reflection'
  | 'clarification';

export interface ChapterNode {
  id: string;
  title: string;
  subject: Subject;
}

export interface ConceptNode {
  id: string;
  name: string;
  chapterId: string;
  subject: Subject;
  prereqIds: string[];
  centrality: number;
  definition?: string;
  statement?: string;
  whenToUse?: string;
  confidence?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: 'prereq' | 'related' | 'co_occurs';
  weight?: number;
}

/** A known wrong move at a canonical step (used by the offline diagnoser). */
export interface StepTrap {
  /** Alternatives; tokens inside one alternative are joined with `&&`. */
  checks: string[];
  mistakeType: MistakeType;
  /** Student-facing explanation of the gap. Must not reveal the final answer. */
  note: string;
}

export interface CanonicalStepNode {
  id: string;
  text: string;
  conceptIds: string[];
  /** Offline step matcher: alternatives that show this step was done. */
  checks?: string[];
  /** Offline step matcher: recognisable wrong versions of this step. */
  traps?: StepTrap[];
  /** One-line nudge toward this step (no answer). */
  hint?: string;
}

export interface QuestionNode {
  id: string;
  source: string;
  prompt: string;
  options?: string[];
  subject: Subject;
  chapterId: string;
  conceptIds: string[];
  prereqIds: string[];
  canonicalSteps: CanonicalStepNode[];
  finalAnswer?: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  mode: SessionMode;
  examFeel: number;
  finalAnswerDetail?: string;
  estimatedTimeSeconds?: number;
  answerType?: string;
  needsHumanReview?: boolean;
  /** Zero-based index of the correct option (MCQ). */
  answerIndex?: number;
  /** Offline matcher: tokens that identify the final answer in the last line of work. */
  answerChecks?: string[];
}

export interface StudentConceptState {
  conceptId: string;
  belief: number;
  streakRight: number;
  attempts?: number;
  lastSeenAt?: string;
  recentMistakes: MistakeType[];
  nextReviewAt?: string;
  reviewIntervalDays?: number;
  reviewEase?: number;
  lastReviewedAt?: string;
}

export interface StudentState {
  conceptStates: Record<string, StudentConceptState>;
  profileText: string;
  sillyMistakePatterns: string[];
  coveredChapterIds: string[];
  attemptedQuestionIds?: string[];
}

export interface TutorCard {
  id: string;
  kind: TutorCardKind;
  title: string;
  body: string;
  actionLabel?: string;
  conceptIds?: string[];
}

export interface TutorToolResult {
  tool: TutorTool;
  title: string;
  intent: string;
  cards: TutorCard[];
  targetConceptIds: string[];
  successCriteria: string;
  suggestedBeliefUpdates?: BeliefUpdate[];
}

export interface BeliefUpdate {
  conceptId: string;
  delta: number;
  reason: string;
}

/** Per-step outcome for LLM/judge diagnosis trace (aligned with offline lib/diagnose step shapes). */
export type AttemptStepStatus =
  | 'correct'
  | 'ambiguous'
  | 'broken'
  | 'pending';

/**
 * One student-visible step in the attempt trace. Anchors margin notes and belief credit.
 * canonicalStepId matches QuestionNode.canonicalSteps[].id when aligned to the canonical path.
 */
export interface AttemptStepTrace {
  id: string;
  raw: string;
  status: AttemptStepStatus;
  canonicalStepId?: string;
  conceptIds: string[];
  note?: string;
  confidence: number;
}

export type ConceptEvidenceOutcome =
  | 'applied_well'
  | 'fragile'
  | 'missing'
  | 'not_applicable';

/**
 * Structured attribution for belief updates and analytics (source of truth vs free-text cards).
 */
export interface ConceptEvidence {
  conceptId: string;
  outcome: ConceptEvidenceOutcome;
  confidence: number;
  reason: string;
}

/** Where the conversation should head right after this diagnosis lands. */
export type NextMoveKind =
  | 'try_again'        // the student should fix and retry the same question
  | 'see_fix'          // open the tutor tool / show the fix
  | 'micro_drill'      // tiny follow-up problem on the fragile idea
  | 'next_question'    // they nailed it — move on
  | 'clarify';         // need one more piece of evidence (clearer photo, one more line)

/** A two-tap follow-up question rendered inline in the chat. */
export interface QuickCheckOption {
  /** Short label (1-6 words). MCQ-style. */
  label: string;
  /** Whether this option is the right answer. Exactly one option should be true. */
  correct: boolean;
  /** One-line coach reply when the student taps this option. */
  feedback: string;
}

export interface QuickCheck {
  /** One short question (one sentence). Targets the fragile idea. */
  prompt: string;
  /** 2-4 options. */
  options: QuickCheckOption[];
}

export interface DiagnosisResult {
  verdict: 'correct' | 'partially_correct' | 'needs_work' | 'unclear';
  mistakeType: MistakeType;
  firstProblemStep?: string;
  conceptsPositive: string[];
  conceptsNegative: string[];
  sillyMistakeTags: string[];
  confidence: number;
  recommendedTool: TutorTool;
  /** Ordered trace of the student's work for UI margin notes and graph hooks. */
  attemptTrace: AttemptStepTrace[];
  /** Concept-level evidence supporting beliefUpdates. */
  conceptEvidence: ConceptEvidence[];
  cards: TutorCard[];
  beliefUpdates: BeliefUpdate[];
  needsClarification: boolean;

  /**
   * Short, friendly chat-bubble message from the coach (1-3 sentences max).
   * Optional for backwards compat — UI falls back to cards[0].body.
   */
  coachMessage?: string;
  /** Optional one-tap micro check question to convert understanding into evidence. */
  quickCheck?: QuickCheck;
  /**
   * What the bottom CTA should suggest after the diagnosis.
   * Optional — UI defaults based on verdict / mistakeType.
   */
  nextMove?: NextMoveKind;
}

export interface GraphData {
  version?: string;
  generatedAt?: string;
  source?: 'mock' | 'sample' | 'snapshot';
  chapters: ChapterNode[];
  concepts: ConceptNode[];
  questions: QuestionNode[];
  edges: GraphEdge[];
}

/** Multiple-choice context for diagnosis (optional). */
export interface AttemptMcqContext {
  /** Zero-based index into `QuestionNode.options`. */
  selectedIndex?: number;
  selectedLabel?: string;
  /** Student explicitly says they cannot attempt the problem yet. */
  declaredUnknown?: boolean;
  /**
   * Student tapped "Orient me / What's this even about?" — they want a
   * zero-commitment frame of the question, NOT a hint toward the answer.
   * Coach should: name the concept(s), name the angle to think from, optionally
   * point at the prereq idea — and STOP before any first algebraic move.
   */
  requestedOrient?: boolean;
}

export interface AttemptInput {
  question: QuestionNode;
  studentState: StudentState;
  typedWork?: string;
  imageFile?: File;
  imageDataUrl?: string;
  mcq?: AttemptMcqContext;
}

export interface TutorToolInput {
  question: QuestionNode;
  studentState: StudentState;
  diagnosis: DiagnosisResult;
  tool: TutorTool;
  targetConceptIds: string[];
}

/**
 * Compact transcript line we send back to the LLM for a follow-up turn.
 * Only role + content — no nested QuickCheck shapes — so the prompt stays small.
 */
export interface CoachConversationTurn {
  role: 'student' | 'coach';
  content: string;
}

/**
 * What the student is sending in a follow-up turn (after the first diagnosis already exists).
 * Free text, a QuickCheck pick, or one of the canned chips ("re-attempted", "show me more", "still confused").
 */
export type CoachFollowupStudentMessage =
  | { kind: 'free_text'; text: string }
  | { kind: 'qc_pick'; quickCheckPrompt: string; pickedLabel: string; pickedCorrect: boolean }
  | { kind: 'chip'; chipId: 'still_confused' | 'show_me_more' | 'why' | 'got_it' };

export interface CoachFollowupInput {
  question: QuestionNode;
  studentState: StudentState;
  /**
   * The original diagnosis from this question's first turn — gives the follow-up
   * coach memory of what broke and why. Sent compact: verdict + coachMessage +
   * firstProblemStep + concept ids only.
   */
  diagnosis: DiagnosisResult;
  /** Recent conversation turns (newest last). Keep ~6 for the prompt budget. */
  conversation: CoachConversationTurn[];
  /** What the student just sent. */
  studentMessage: CoachFollowupStudentMessage;
}

/**
 * Coach's reply in a multi-turn dialogue.
 * Smaller than DiagnosisResult — no belief plumbing, no traces. Just the bubble + an
 * optional new check + a soft signal about whether it's a good moment to wrap up.
 */
export interface CoachFollowupResult {
  /** ONE chat bubble from the coach (≤ ~40 words). All math wrapped. */
  coachMessage: string;
  /** Optional new mini-check the student can tap (replaces / augments the previous one). */
  quickCheck?: QuickCheck;
  /**
   * If true, the coach thinks this is a natural place to move on. The UI uses this to
   * subtly pulse the "Next question" chip — but the student is never forced to.
   */
  conversationDone?: boolean;
  /**
   * Optional CTA suggestion (e.g. open the worked example tool). Defaults to staying in chat.
   */
  suggestedAction?: 'see_fix' | 'try_again' | 'next_question' | null;
}

/** Result of finishing a practice attempt (persisted in app state). */
export interface SessionResult {
  questionId: string;
  closedGaps: string[];
  confirmed: string[];
  caughtSlips: string[];
  hintsUsed: number;
  durationMs: number;
  diagnosis?: DiagnosisResult;
}

export interface AttemptHistoryItem {
  questionId: string;
  completedAt: string;
  status: 'good' | 'gap' | 'unclear';
  mode: SessionMode;
  durationMs: number;
  confirmed: string[];
  closedGaps: string[];
  caughtSlips: string[];
}

export interface WarmupCard {
  id: string;
  prompt: string;
  answer: string;
  conceptId: string;
  source: 'review_due' | 'recent_stumble' | 'freebie' | 'shaky';
}
