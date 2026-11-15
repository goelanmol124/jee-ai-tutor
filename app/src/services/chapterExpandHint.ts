import { MASTERY_THRESHOLD } from '../data/concepts';
import type { GraphData } from '../domain/types';
import { beliefsFromConceptStates, type SingleUserLearningState } from './studentModel';

const MIN_ATTEMPTS_BETWEEN_HINTS = 5;

/** Bump after the user dismisses the hint or opens the chapter picker so we don’t nag every question. */
export function markExpandChapterHintShown(prev: SingleUserLearningState): SingleUserLearningState {
  return {
    ...prev,
    expandChapterHintLastAtAttemptCount: prev.attemptHistory.length,
  };
}

export interface ExpandChapterHint {
  title: string;
  body: string;
}

/**
 * Decides whether to suggest adding chapters: mastery within current scope, enough practice volume,
 * or a deterministic low-frequency “roll” so occasional learners still see the idea.
 */
export function getExpandChapterHint(
  graph: GraphData,
  state: SingleUserLearningState,
  now = new Date(),
): ExpandChapterHint | undefined {
  if (!shouldSuggestExpandChapters(graph, state, now)) return undefined;
  const covered = new Set(state.coveredChapters);
  const missing = graph.chapters.filter((ch) => !covered.has(ch.id));
  const extra = missing.length <= 3
    ? missing.map((ch) => ch.title).join(', ')
    : `${missing.length} more topics`;
  return {
    title: 'Add another chapter?',
    body: `You’re making progress in your current scope. Opening chapters adds ${extra} so practice and review stay balanced.`,
  };
}

function shouldSuggestExpandChapters(
  graph: GraphData,
  state: SingleUserLearningState,
  now: Date,
): boolean {
  const covered = new Set(state.coveredChapters);
  if (graph.chapters.every((ch) => covered.has(ch.id))) return false;

  const attempts = state.attemptHistory.length;
  const last = state.expandChapterHintLastAtAttemptCount ?? -1000;
  if (attempts - last < MIN_ATTEMPTS_BETWEEN_HINTS) return false;
  if (attempts < 5) return false;

  const beliefs = beliefsFromConceptStates(state.conceptStates);
  const inScope = graph.concepts.filter((c) => covered.has(c.chapterId));
  if (inScope.length === 0) return false;

  const mastered = inScope.filter((c) => (beliefs[c.id] ?? 0) >= MASTERY_THRESHOLD).length;
  const masteryRatio = mastered / inScope.length;

  const strongMastery = masteryRatio >= 0.4 && mastered >= 5;
  const volume =
    attempts >= 12
    && covered.size <= Math.max(1, Math.ceil(graph.chapters.length * 0.65));

  const dayKey = now.toISOString().slice(0, 10);
  let hash = 0;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash = (hash << 5) - hash + dayKey.charCodeAt(i);
    hash |= 0;
  }
  hash = Math.abs(hash) + attempts * 31 + covered.size * 17;
  const roll = Math.abs(hash) % 100;
  const sporadic = attempts >= 8 && roll < 10;

  return strongMastery || volume || sporadic;
}
