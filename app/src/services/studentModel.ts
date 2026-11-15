import { MASTERY_THRESHOLD, SHAKY_THRESHOLD } from '../data/concepts';
import type { PilotProfile } from '../domain/pilotExperience';
import type {
  AttemptHistoryItem,
  GraphData,
  MistakeType,
  SessionResult,
  StudentConceptState,
  WarmupCard,
} from '../domain/types';
import { mergeMemoryCardsFromSession, updateMemoryCardInList, dismissMemoryCard, countMemoryCardsDue, type MemoryCard, type MemoryCardGrade } from './memoryCards';


export const STORAGE_KEY = 'al-single-user-state-v2';

export interface SingleUserLearningState {
  coveredChapters: string[];
  conceptStates: Record<string, StudentConceptState>;
  profileText: string;
  sillyMistakePatterns: string[];
  attemptHistory: AttemptHistoryItem[];
  streakDays: number;
  lastStudiedAt?: string;
  /** attemptHistory.length when we last showed the “add chapters” hint (cooldown). */
  expandChapterHintLastAtAttemptCount?: number;
  /**
   * Optional spaced-repetition deck for past mistakes. Does not drive tutor concept beliefs.
   */
  memoryCardsEnabled?: boolean;
  memoryCards?: MemoryCard[];
  /** Pilot onboarding profile (cohort, language, priors). */
  pilotProfile?: PilotProfile;
}

export function makeInitialConceptStates(graph: GraphData, coveredChapters: string[]): Record<string, StudentConceptState> {
  const out: Record<string, StudentConceptState> = {};
  for (const concept of graph.concepts) {
    const covered = coveredChapters.includes(concept.chapterId);
    out[concept.id] = {
      conceptId: concept.id,
      belief: covered ? 0.32 : 0.06,
      streakRight: 0,
      attempts: 0,
      recentMistakes: [],
      reviewEase: 2.5,
      reviewIntervalDays: 0,
    };
  }
  return out;
}

export function makeInitialStudentState(
  graph: GraphData,
  coveredChapters: string[],
  pilotProfile?: PilotProfile,
): SingleUserLearningState {
  const languageNote =
    pilotProfile?.language === 'roman_hinglish'
      ? ' Prefers Roman Hinglish; keep technical terms precise.'
      : ' Prefers English; keep technical terms precise.';
  const priorNote = pilotProfile?.topicPriors?.length
    ? ` Topic priors (not mastery): ${pilotProfile.topicPriors
        .map((p) => `${p.label}=${p.tier}`)
        .slice(0, 8)
        .join('; ')}.`
    : '';
  return {
    coveredChapters,
    conceptStates: makeInitialConceptStates(graph, coveredChapters),
    profileText:
      `New student (${pilotProfile?.cohort ?? 'unknown cohort'}). Start from chapter preference and update after every diagnosed attempt.${languageNote}${priorNote}`,
    sillyMistakePatterns: [],
    attemptHistory: [],
    streakDays: 0,
    memoryCardsEnabled: true,
    memoryCards: [],
    pilotProfile,
  };
}

export function updatePilotLanguage(
  state: SingleUserLearningState,
  language: PilotProfile['language'],
): SingleUserLearningState {
  if (!state.pilotProfile) return state;
  return {
    ...state,
    pilotProfile: { ...state.pilotProfile, language },
  };
}

export function ensureStateMatchesGraph(state: SingleUserLearningState, graph: GraphData): SingleUserLearningState {
  const conceptStates = { ...state.conceptStates };
  for (const concept of graph.concepts) {
    if (!conceptStates[concept.id]) {
      conceptStates[concept.id] = {
        conceptId: concept.id,
        belief: state.coveredChapters.includes(concept.chapterId) ? 0.32 : 0.06,
        streakRight: 0,
        attempts: 0,
        recentMistakes: [],
        reviewEase: 2.5,
        reviewIntervalDays: 0,
      };
    }
  }
  return normalizeMemoryDeckFields({ ...state, conceptStates });
}

function normalizeMemoryDeckFields(state: SingleUserLearningState): SingleUserLearningState {
  return {
    ...state,
    memoryCardsEnabled: state.memoryCardsEnabled ?? true,
    memoryCards: state.memoryCards ?? [],
  };
}

/** Updates which chapters count as “in scope” without wiping history; nudges beliefs when coverage flips. */
export function applyCoveredChaptersChange(
  prev: SingleUserLearningState,
  graph: GraphData,
  coveredChapters: string[],
): SingleUserLearningState {
  const nextList = [...new Set(coveredChapters)];
  const was = new Set(prev.coveredChapters);
  const now = new Set(nextList);
  const conceptStates = { ...prev.conceptStates };

  for (const concept of graph.concepts) {
    const wc = was.has(concept.chapterId);
    const nc = now.has(concept.chapterId);
    if (wc === nc) continue;
    const current = conceptStates[concept.id] ?? makeInitialConceptStates(graph, prev.coveredChapters)[concept.id];
    if (nc && !wc) {
      conceptStates[concept.id] = {
        ...current,
        belief: clampBelief(Math.max(current.belief, 0.28)),
      };
    } else {
      conceptStates[concept.id] = {
        ...current,
        belief: clampBelief(Math.min(current.belief, 0.12)),
      };
    }
  }

  return ensureStateMatchesGraph(normalizeMemoryDeckFields({ ...prev, coveredChapters: nextList, conceptStates }), graph);
}

export function beliefsFromConceptStates(states: Record<string, StudentConceptState>): Record<string, number> {
  return Object.fromEntries(Object.entries(states).map(([conceptId, state]) => [conceptId, state.belief]));
}

function clampBelief(value: number): number {
  return Math.max(0.02, Math.min(0.99, value));
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function nextReviewForOutcome(prev: StudentConceptState, positive: boolean, now: Date): Pick<StudentConceptState, 'reviewEase' | 'reviewIntervalDays' | 'nextReviewAt' | 'lastReviewedAt'> {
  if (!positive) {
    return {
      reviewEase: Math.max(1.4, (prev.reviewEase ?? 2.5) - 0.2),
      reviewIntervalDays: 1,
      nextReviewAt: addDays(now, 1),
      lastReviewedAt: now.toISOString(),
    };
  }

  const ease = Math.min(3, (prev.reviewEase ?? 2.5) + 0.05);
  const interval = prev.reviewIntervalDays && prev.reviewIntervalDays > 0
    ? Math.max(2, Math.round(prev.reviewIntervalDays * ease))
    : 2;
  return {
    reviewEase: ease,
    reviewIntervalDays: interval,
    nextReviewAt: addDays(now, interval),
    lastReviewedAt: now.toISOString(),
  };
}

function attemptStatus(result: SessionResult): AttemptHistoryItem['status'] {
  if (result.diagnosis?.verdict === 'unclear') return 'unclear';
  return result.closedGaps.length > 0 ? 'gap' : 'good';
}

export function applySessionResult(
  prev: SingleUserLearningState,
  graph: GraphData,
  result: SessionResult,
  now = new Date(),
): SingleUserLearningState {
  const graphConceptIds = new Set(graph.concepts.map((concept) => concept.id));
  const conceptStates = { ...prev.conceptStates };
  const updates = result.diagnosis?.beliefUpdates ?? [];
  const positive = new Set(result.confirmed);
  const negative = new Set(result.closedGaps);

  for (const update of updates) {
    if (!graphConceptIds.has(update.conceptId)) continue;
    const current = conceptStates[update.conceptId] ?? makeInitialConceptStates(graph, [])[update.conceptId];
    const nextBelief = clampBelief(current.belief + update.delta);
    const wasPositive = update.delta >= 0;
    conceptStates[update.conceptId] = {
      ...current,
      belief: nextBelief,
      streakRight: wasPositive ? current.streakRight + 1 : 0,
      attempts: (current.attempts ?? 0) + 1,
      lastSeenAt: now.toISOString(),
      recentMistakes: wasPositive ? current.recentMistakes : [result.diagnosis?.mistakeType ?? 'procedure_error', ...current.recentMistakes].slice(0, 5),
      ...nextReviewForOutcome(current, wasPositive && nextBelief >= SHAKY_THRESHOLD, now),
    };
  }

  for (const conceptId of new Set([...positive, ...negative])) {
    if (!graphConceptIds.has(conceptId) || updates.some((update) => update.conceptId === conceptId)) continue;
    const current = conceptStates[conceptId] ?? makeInitialConceptStates(graph, [])[conceptId];
    const isPositive = positive.has(conceptId) && !negative.has(conceptId);
    const nextBelief = clampBelief(current.belief + (isPositive ? 0.08 : -0.1));
    conceptStates[conceptId] = {
      ...current,
      belief: nextBelief,
      streakRight: isPositive ? current.streakRight + 1 : 0,
      attempts: (current.attempts ?? 0) + 1,
      lastSeenAt: now.toISOString(),
      recentMistakes: isPositive ? current.recentMistakes : [result.diagnosis?.mistakeType ?? 'procedure_error', ...current.recentMistakes].slice(0, 5),
      ...nextReviewForOutcome(current, isPositive && nextBelief >= SHAKY_THRESHOLD, now),
    };
  }

  const question = graph.questions.find((item) => item.id === result.questionId);
  const attempt: AttemptHistoryItem = {
    questionId: result.questionId,
    completedAt: now.toISOString(),
    status: attemptStatus(result),
    mode: question?.mode ?? 'build',
    durationMs: result.durationMs,
    confirmed: result.confirmed,
    closedGaps: result.closedGaps,
    caughtSlips: result.caughtSlips,
  };

  const sillyMistakePatterns = Array.from(new Set([
    ...prev.sillyMistakePatterns,
    ...result.caughtSlips,
    ...(result.diagnosis?.sillyMistakeTags ?? []),
  ])).slice(-20);

  const profileSuffix = result.diagnosis
    ? ` Latest: ${result.diagnosis.mistakeType.replaceAll('_', ' ')} on ${question?.source ?? result.questionId}; ${result.diagnosis.cards[0]?.body ?? 'diagnosed attempt.'}`
    : '';

  const base: SingleUserLearningState = {
    ...prev,
    conceptStates,
    sillyMistakePatterns,
    profileText: `${prev.profileText}${profileSuffix}`.slice(-1200),
    attemptHistory: [...prev.attemptHistory, attempt].slice(-200),
    streakDays: updateStreak(prev.lastStudiedAt, prev.streakDays, now),
    lastStudiedAt: now.toISOString(),
  };

  const normalized = normalizeMemoryDeckFields(base);
  return {
    ...normalized,
    memoryCards: mergeMemoryCardsFromSession(
      graph,
      normalized.memoryCards ?? [],
      result,
      now,
      Boolean(normalized.memoryCardsEnabled),
    ),
  };
}

function updateStreak(lastStudiedAt: string | undefined, currentStreak: number, now: Date): number {
  if (!lastStudiedAt) return Math.max(1, currentStreak);
  const previous = new Date(lastStudiedAt);
  const dayMs = 24 * 60 * 60 * 1000;
  const previousDay = Math.floor(previous.getTime() / dayMs);
  const today = Math.floor(now.getTime() / dayMs);
  if (today === previousDay) return Math.max(1, currentStreak);
  if (today === previousDay + 1) return currentStreak + 1;
  return 1;
}

export function buildStudentStateForTutor(state: SingleUserLearningState) {
  return {
    conceptStates: state.conceptStates,
    profileText: state.profileText,
    sillyMistakePatterns: state.sillyMistakePatterns,
    coveredChapterIds: state.coveredChapters,
    attemptedQuestionIds: state.attemptHistory.map((attempt) => attempt.questionId),
  };
}

export function buildWarmupCards(graph: GraphData, state: SingleUserLearningState, now = new Date()): WarmupCard[] {
  const cards: WarmupCard[] = [];
  const byId = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const due = Object.values(state.conceptStates)
    .filter((conceptState) => conceptState.nextReviewAt && new Date(conceptState.nextReviewAt).getTime() <= now.getTime())
    .sort((a, b) => (a.belief - b.belief));

  const recentStumbles = [...state.attemptHistory]
    .reverse()
    .flatMap((attempt) => attempt.closedGaps)
    .filter((conceptId, index, arr) => arr.indexOf(conceptId) === index);

  const shaky = Object.values(state.conceptStates)
    .filter((conceptState) => conceptState.belief >= 0.2 && conceptState.belief < MASTERY_THRESHOLD)
    .sort((a, b) => a.belief - b.belief)
    .map((conceptState) => conceptState.conceptId);

  const addCard = (conceptId: string, source: WarmupCard['source']) => {
    if (cards.some((card) => card.conceptId === conceptId)) return;
    const concept = byId.get(conceptId);
    if (!concept || cards.length >= 5) return;
    cards.push({
      id: `${source}_${conceptId}`,
      prompt: concept.whenToUse ? `When should you use: ${concept.name}?` : `Recall the key idea: ${concept.name}`,
      answer: concept.whenToUse || concept.statement || concept.definition || concept.name,
      conceptId,
      source,
    });
  };

  for (const item of due) addCard(item.conceptId, 'review_due');
  for (const conceptId of recentStumbles) addCard(conceptId, 'recent_stumble');
  for (const conceptId of shaky) addCard(conceptId, 'shaky');
  for (const concept of graph.concepts) {
    if (state.coveredChapters.includes(concept.chapterId)) addCard(concept.id, 'freebie');
  }
  for (const concept of graph.concepts) addCard(concept.id, 'freebie');

  return cards.slice(0, 5);
}

export function shouldStartWithWarmup(graph: GraphData, state: SingleUserLearningState, now = new Date()): boolean {
  if (state.attemptHistory.length === 0) return false;
  if (state.lastStudiedAt && new Date(state.lastStudiedAt).toDateString() === now.toDateString()) {
    return false;
  }
  return buildWarmupCards(graph, state, now).some((card) => (
    card.source === 'review_due' || card.source === 'recent_stumble' || card.source === 'shaky'
  ));
}

export function applyWarmupGrade(
  prev: SingleUserLearningState,
  conceptId: string,
  grade: 'hard' | 'good' | 'easy',
  now = new Date(),
): SingleUserLearningState {
  const current = prev.conceptStates[conceptId];
  if (!current) return prev;
  const delta = grade === 'hard' ? -0.04 : grade === 'good' ? 0.05 : 0.08;
  const positive = grade !== 'hard';
  const intervalBoost = grade === 'easy' ? 1.4 : 1;
  const review = nextReviewForOutcome(current, positive, now);
  const interval = Math.max(1, Math.round((review.reviewIntervalDays ?? 1) * intervalBoost));
  return {
    ...prev,
    conceptStates: {
      ...prev.conceptStates,
      [conceptId]: {
        ...current,
        belief: clampBelief(current.belief + delta),
        streakRight: positive ? current.streakRight + 1 : 0,
        attempts: (current.attempts ?? 0) + 1,
        lastSeenAt: now.toISOString(),
        recentMistakes: positive ? current.recentMistakes : ['unclear_evidence' as MistakeType, ...current.recentMistakes].slice(0, 5),
        ...review,
        reviewIntervalDays: interval,
        nextReviewAt: addDays(now, interval),
      },
    },
    streakDays: updateStreak(prev.lastStudiedAt, prev.streakDays, now),
    lastStudiedAt: now.toISOString(),
  };
}

export type { MemoryCardGrade, MemoryCard };

export function applyMemoryCardReviewToState(
  prev: SingleUserLearningState,
  cardId: string,
  grade: MemoryCardGrade,
  now = new Date(),
): SingleUserLearningState {
  const base = normalizeMemoryDeckFields(prev);
  return {
    ...base,
    memoryCards: updateMemoryCardInList(base.memoryCards!, cardId, grade, now),
  };
}

export function removeMemoryCardFromState(prev: SingleUserLearningState, cardId: string): SingleUserLearningState {
  const base = normalizeMemoryDeckFields(prev);
  return {
    ...base,
    memoryCards: dismissMemoryCard(base.memoryCards!, cardId),
  };
}

export function setMemoryDeckEnabled(prev: SingleUserLearningState, enabled: boolean): SingleUserLearningState {
  return { ...normalizeMemoryDeckFields(prev), memoryCardsEnabled: enabled };
}

export function learningStats(graph: GraphData, state: SingleUserLearningState) {
  const beliefs = beliefsFromConceptStates(state.conceptStates);
  const mastered = graph.concepts.filter((concept) => (beliefs[concept.id] ?? 0) >= MASTERY_THRESHOLD).length;
  const shaky = graph.concepts.filter((concept) => {
    const belief = beliefs[concept.id] ?? 0;
    return belief >= SHAKY_THRESHOLD && belief < MASTERY_THRESHOLD;
  }).length;
  const today = new Date().toDateString();
  const attemptsToday = state.attemptHistory.filter((attempt) => new Date(attempt.completedAt).toDateString() === today);
  return {
    mastered,
    shaky,
    solved: state.attemptHistory.length,
    studiedMinutesToday: Math.round(attemptsToday.reduce((sum, attempt) => sum + attempt.durationMs, 0) / 60000),
    hintsUsedToday: 0,
    gapsClosed: state.attemptHistory.reduce((sum, attempt) => sum + attempt.closedGaps.length, 0),
    memoryCardsDue: state.memoryCardsEnabled ? countMemoryCardsDue(state.memoryCards ?? []) : 0,
    memoryDeckSize: state.memoryCardsEnabled ? (state.memoryCards ?? []).length : 0,
    memoryDeckOn: Boolean(state.memoryCardsEnabled),
  };
}

export type LearningStats = ReturnType<typeof learningStats>;
