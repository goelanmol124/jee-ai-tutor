import type { ConceptNode, GraphData, SessionResult } from '../domain/types';

/** Self-rated recall — only updates deck state, never tutor concept beliefs. */
export type MemoryCardGrade = 'easy' | 'moderate' | 'hard';

export interface MemoryCard {
  id: string;
  conceptId: string;
  prompt: string;
  answer: string;
  sourceQuestionId?: string;
  createdAt: string;
  /**
   * 0..1 “how well the deck thinks you recall this cue” — independent of concept `belief`.
   */
  recallStrength: number;
  ease: number;
  intervalDays: number;
  nextDueAt: string;
  repetitions: number;
  lastReviewedAt?: string;
}

function addDays(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function clamp01(x: number): number {
  return Math.max(0.02, Math.min(0.99, x));
}

function conceptCardPrompt(concept: ConceptNode): string {
  if (concept.whenToUse?.trim()) {
    return `In your own words: when should you reach for “${concept.name}” on a problem?`;
  }
  return `What is the core idea of “${concept.name}” that you were meant to apply?`;
}

function conceptCardAnswer(concept: ConceptNode): string {
  return [concept.whenToUse, concept.definition, concept.statement].find((s) => s?.trim())?.trim()
    ?? concept.name;
}

export function makeMemoryCardForConcept(
  graph: GraphData,
  conceptId: string,
  sourceQuestionId: string | undefined,
  now: Date,
): MemoryCard | null {
  const concept = graph.concepts.find((c) => c.id === conceptId);
  if (!concept) return null;
  return {
    id: `mc_${conceptId}`,
    conceptId,
    prompt: conceptCardPrompt(concept),
    answer: conceptCardAnswer(concept),
    sourceQuestionId,
    createdAt: now.toISOString(),
    recallStrength: 0.35,
    ease: 2.5,
    intervalDays: 0,
    nextDueAt: now.toISOString(),
    repetitions: 0,
  };
}

/** Add or refresh cards from diagnosed weak concepts; does not touch tutor beliefs. */
export function mergeMemoryCardsFromSession(
  graph: GraphData,
  prev: MemoryCard[],
  result: SessionResult,
  now: Date,
  enabled: boolean,
): MemoryCard[] {
  if (!enabled) return prev;
  const byId = new Map(prev.map((c) => [c.id, c]));
  const gapConcepts = [...new Set(result.closedGaps)].filter(Boolean);

  for (const conceptId of gapConcepts) {
    const fresh = makeMemoryCardForConcept(graph, conceptId, result.questionId, now);
    if (!fresh) continue;
    const existing = byId.get(fresh.id);
    if (existing) {
      // Same gap again — keep SRS progress but surface the card sooner.
      byId.set(fresh.id, {
        ...existing,
        prompt: fresh.prompt,
        answer: fresh.answer,
        sourceQuestionId: result.questionId,
        nextDueAt:
          new Date(existing.nextDueAt).getTime() > now.getTime()
            ? now.toISOString()
            : existing.nextDueAt,
      });
    } else {
      byId.set(fresh.id, fresh);
    }
  }

  return [...byId.values()];
}

/**
 * SM-2–style interval on the card only. `grade` maps: easy / moderate / hard.
 */
export function applyMemoryCardGrade(card: MemoryCard, grade: MemoryCardGrade, now: Date): MemoryCard {
  const easePrev = card.ease;
  let ease = easePrev;
  let interval = Math.max(0, card.intervalDays);
  let recall = card.recallStrength;

  if (grade === 'hard') {
    ease = Math.max(1.3, easePrev - 0.2);
    interval = 1;
    recall = clamp01(recall - 0.14);
    return {
      ...card,
      ease,
      intervalDays: interval,
      nextDueAt: addDays(now, interval),
      recallStrength: recall,
      repetitions: 0,
      lastReviewedAt: now.toISOString(),
    };
  }

  if (grade === 'moderate') {
    recall = clamp01(recall + 0.06);
    ease = Math.max(1.4, easePrev - 0.05);
    const nextInterval = interval > 0
      ? Math.max(1, Math.round(interval * ease * 0.65))
      : 1;
    return {
      ...card,
      ease,
      intervalDays: nextInterval,
      nextDueAt: addDays(now, nextInterval),
      recallStrength: recall,
      repetitions: card.repetitions + 1,
      lastReviewedAt: now.toISOString(),
    };
  }

  // easy
  recall = clamp01(recall + 0.14);
  ease = Math.min(2.9, easePrev + 0.1);
  const nextInterval = interval > 0
    ? Math.max(3, Math.round(interval * ease))
    : 3;
  return {
    ...card,
    ease,
    intervalDays: nextInterval,
    nextDueAt: addDays(now, nextInterval),
    recallStrength: recall,
    repetitions: card.repetitions + 1,
    lastReviewedAt: now.toISOString(),
  };
}

export function updateMemoryCardInList(
  cards: MemoryCard[],
  cardId: string,
  grade: MemoryCardGrade,
  now: Date,
): MemoryCard[] {
  return cards.map((c) => (c.id === cardId ? applyMemoryCardGrade(c, grade, now) : c));
}

export function pickNextDueMemoryCard(cards: MemoryCard[], now = new Date()): MemoryCard | undefined {
  const t = now.getTime();
  const due = cards.filter((c) => new Date(c.nextDueAt).getTime() <= t);
  due.sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());
  return due[0];
}

export function countMemoryCardsDue(cards: MemoryCard[], now = new Date()): number {
  const t = now.getTime();
  return cards.filter((c) => new Date(c.nextDueAt).getTime() <= t).length;
}

export function dismissMemoryCard(cards: MemoryCard[], cardId: string): MemoryCard[] {
  return cards.filter((c) => c.id !== cardId);
}
