import { MASTERY_THRESHOLD } from '../data/concepts';
import type { GraphData, QuestionNode, StudentConceptState, Subject } from '../domain/types';
import { getConcept } from './graphSelectors';

/** PLAN §6-style weights with product-readiness balance. */
const W_STRETCH = 1.2;
const W_INFO = 0.45;
const W_UNLOCK = 0.35;
const W_EXAM = 0.22;
const W_REVIEW = 0.45;
const W_WEAK_TARGET = 0.55;
const W_CONFIDENCE = 0.18;
const W_LOAD = 0.34;
const W_REPEAT = 0.7;
const W_REVIEW_ONLY = 0.3;
const W_RECENT_CHAPTER = 0.28;
const W_RECENT_SUBJECT = 0.16;
const W_HUMAN_REVIEW = 0.55;
const W_EARLY_HARD = 0.4;
const W_LOW_READINESS_HARD = 0.45;

export interface PickQuestionOptions {
  /** 0..1 higher = more fatigue → penalize harder questions */
  fatigue?: number;
  attemptedQuestionIds?: string[];
  conceptStates?: Record<string, StudentConceptState>;
  now?: Date;
  allowRepeat?: boolean;
}

export interface QuestionScoreBreakdown {
  question: QuestionNode;
  score: number;
  knownPrereqRatio: number;
  stretchFit: number;
  infoGain: number;
  downstreamUnlock: number;
  examFeel: number;
  reviewDue: number;
  weakTarget: number;
  confidence: number;
  cognitiveLoad: number;
  repeatPenalty: number;
  recentChapterPenalty: number;
  recentSubjectPenalty: number;
  reason: string;
}

/**
 * Triangular stretch fit peaking when ~20% of prereqs are “unknown” below mastery.
 */
function stretchFit(knownPrereqRatio: number): number {
  const unknownFrac = 1 - knownPrereqRatio;
  const targetUnknown = 0.2;
  const d = Math.abs(unknownFrac - targetUnknown);
  return Math.max(0, 1 - d / 0.4);
}

function infoGain(question: QuestionNode, beliefs: Record<string, number>): number {
  let sum = 0;
  for (const cid of question.conceptIds) {
    const b = beliefs[cid] ?? 0.05;
    sum += b * (1 - b);
  }
  return question.conceptIds.length ? sum / question.conceptIds.length : 0;
}

function downstreamUnlock(graph: GraphData, question: QuestionNode, beliefs: Record<string, number>): number {
  let sum = 0;
  for (const cid of question.conceptIds) {
    const c = getConcept(graph, cid);
    const centrality = c?.centrality ?? 0;
    sum += centrality * (1 - (beliefs[cid] ?? 0));
  }
  return sum;
}

function prerequisiteReadiness(question: QuestionNode, beliefs: Record<string, number>): number {
  const targetConcepts = new Set(question.conceptIds);
  const prereqIds = question.prereqIds.filter((conceptId) => !targetConcepts.has(conceptId));
  if (prereqIds.length === 0) return 1;

  let total = 0;
  for (const conceptId of prereqIds) {
    total += Math.min(1, (beliefs[conceptId] ?? 0) / MASTERY_THRESHOLD);
  }
  return total / prereqIds.length;
}

function weakTarget(question: QuestionNode, beliefs: Record<string, number>): number {
  const ids = question.conceptIds.length ? question.conceptIds : question.prereqIds;
  if (ids.length === 0) return 0;
  let total = 0;
  for (const id of ids) {
    const b = beliefs[id] ?? 0.05;
    // Peaks in the "teachable but not hopeless" range.
    total += b < 0.15 ? 0.25 : b < MASTERY_THRESHOLD ? 1 - b : 0.1;
  }
  return total / ids.length;
}

function sourceConfidence(question: QuestionNode): number {
  return question.needsHumanReview ? 0 : 1;
}

function reviewDue(question: QuestionNode, conceptStates?: Record<string, StudentConceptState>, now = new Date()): number {
  if (!conceptStates) return 0;
  const touched = new Set([...question.conceptIds, ...question.prereqIds]);
  if (touched.size === 0) return 0;
  let due = 0;
  for (const conceptId of touched) {
    const nextReviewAt = conceptStates[conceptId]?.nextReviewAt;
    if (nextReviewAt && new Date(nextReviewAt).getTime() <= now.getTime()) {
      due += 1;
    }
  }
  return Math.min(1, due / Math.max(1, touched.size));
}

function cognitiveLoad(question: QuestionNode, fatigue: number): number {
  return Math.min(1, question.difficulty / 5) * (0.65 + fatigue * 0.5);
}

function averageTargetBelief(question: QuestionNode, beliefs: Record<string, number>): number {
  if (question.conceptIds.length === 0) return 0;
  let total = 0;
  for (const conceptId of question.conceptIds) total += beliefs[conceptId] ?? 0.05;
  return total / question.conceptIds.length;
}

function scoreQuestion(
  graph: GraphData,
  question: QuestionNode,
  beliefs: Record<string, number>,
  fatigue: number,
  conceptStates?: Record<string, StudentConceptState>,
  now?: Date,
  attempted?: Set<string>,
  recentChapterIds?: string[],
  recentSubjects?: Subject[],
): QuestionScoreBreakdown {
  const kr = prerequisiteReadiness(question, beliefs);
  const sf = stretchFit(kr);
  const ig = infoGain(question, beliefs);
  const un = downstreamUnlock(graph, question, beliefs);
  const ef = question.examFeel;
  const rd = reviewDue(question, conceptStates, now);
  const wt = weakTarget(question, beliefs);
  const cf = sourceConfidence(question);
  const cl = cognitiveLoad(question, fatigue);
  const rp = attempted?.has(question.id) ? 1 : 0;
  const recentChapterPenalty = recentChapterIds?.length
    ? recentChapterIds.filter((chapterId) => chapterId === question.chapterId).length / recentChapterIds.length
    : 0;
  const recentSubjectPenalty = recentSubjects?.length
    ? recentSubjects.filter((subject) => subject === question.subject).length / recentSubjects.length
    : 0;
  const reviewOnlyPenalty = rd > 0.6 && sf < 0.2 ? W_REVIEW_ONLY : 0;
  const humanReviewPenalty = question.needsHumanReview ? W_HUMAN_REVIEW : 0;
  const earlyHardPenalty = (attempted?.size ?? 0) < 5 && question.difficulty >= 4 && averageTargetBelief(question, beliefs) < 0.45
    ? W_EARLY_HARD
    : 0;
  const lowReadinessHardPenalty = question.difficulty >= 4 && kr < 0.35 ? W_LOW_READINESS_HARD : 0;

  const score = (
    W_STRETCH * sf
    + W_INFO * ig
    + W_UNLOCK * un
    + W_EXAM * ef
    + W_REVIEW * rd
    + W_WEAK_TARGET * wt
    + W_CONFIDENCE * cf
    - W_LOAD * cl
    - W_REPEAT * rp
    - W_RECENT_CHAPTER * recentChapterPenalty
    - W_RECENT_SUBJECT * recentSubjectPenalty
    - reviewOnlyPenalty
    - humanReviewPenalty
    - earlyHardPenalty
    - lowReadinessHardPenalty
  );
  return {
    question,
    score,
    knownPrereqRatio: kr,
    stretchFit: sf,
    infoGain: ig,
    downstreamUnlock: un,
    examFeel: ef,
    reviewDue: rd,
    weakTarget: wt,
    confidence: cf,
    cognitiveLoad: cl,
    repeatPenalty: rp,
    recentChapterPenalty,
    recentSubjectPenalty,
    reason: explainPick(question, kr, rd, wt, cf),
  };
}

function explainPick(question: QuestionNode, knownRatio: number, review: number, weak: number, confidence: number): string {
  const bits = [
    `${Math.round(knownRatio * 100)}% prereqs known`,
    review > 0 ? 'includes due review' : 'new practice',
    weak > 0.45 ? 'targets a weak concept' : 'keeps load steady',
  ];
  if (confidence < 0.5) bits.push('source flagged for review');
  return `${question.source}: ${bits.join(', ')}.`;
}

export function rankQuestionCandidates(
  graph: GraphData,
  preferredChapterIds: string[],
  beliefs: Record<string, number>,
  options?: PickQuestionOptions,
): QuestionScoreBreakdown[] {
  const fatigue = options?.fatigue ?? 0;
  const attemptedQuestionIds = options?.attemptedQuestionIds ?? [];
  const attempted = new Set(attemptedQuestionIds);
  const questionById = new Map(graph.questions.map((question) => [question.id, question]));
  const chapterById = new Map(graph.chapters.map((chapter) => [chapter.id, chapter]));
  const preferredSubjects = new Set(
    preferredChapterIds
      .map((chapterId) => chapterById.get(chapterId)?.subject)
      .filter((subject): subject is QuestionNode['subject'] => Boolean(subject)),
  );
  const recentChapterIds = attemptedQuestionIds
    .slice(-3)
    .map((questionId) => questionById.get(questionId)?.chapterId)
    .filter((chapterId): chapterId is string => Boolean(chapterId));
  const recentSubjects = attemptedQuestionIds
    .slice(-3)
    .map((questionId) => questionById.get(questionId)?.subject)
    .filter((subject): subject is Subject => Boolean(subject));

  const basePool = graph.questions.filter((q) => q.canonicalSteps.length > 0 && q.conceptIds.length > 0);
  let pool = basePool;
  if (preferredChapterIds.length > 0) {
    const filtered = pool.filter((q) => preferredChapterIds.includes(q.chapterId));
    if (filtered.length > 0) pool = filtered;
  }

  if (!options?.allowRepeat) {
    const unseen = pool.filter((q) => !attempted.has(q.id));
    if (unseen.length > 0) {
      pool = unseen;
    } else {
      const sameSubjectUnseen = preferredSubjects.size > 0
        ? basePool.filter((q) => preferredSubjects.has(q.subject) && !attempted.has(q.id))
        : [];
      const globalUnseen = basePool.filter((q) => !attempted.has(q.id));
      if (sameSubjectUnseen.length > 0) {
        pool = sameSubjectUnseen;
      } else if (globalUnseen.length > 0) {
        pool = globalUnseen;
      }
    }
  }

  const stretchPool = pool.filter((q) => {
    const knownRatio = prerequisiteReadiness(q, beliefs);
    return knownRatio >= 0.55 && knownRatio <= 0.98;
  });
  if (stretchPool.length >= Math.min(6, pool.length)) {
    pool = stretchPool;
  }

  return pool
    .map((q) => scoreQuestion(graph, q, beliefs, fatigue, options?.conceptStates, options?.now, attempted, recentChapterIds, recentSubjects))
    .sort((a, b) => b.score - a.score);
}

/**
 * Pick next question from graph using chapter preference as a hard filter when possible,
 * then deterministic PLAN §6-style scoring.
 */
export function pickInitialQuestion(
  graph: GraphData,
  preferredChapterIds: string[],
  beliefs: Record<string, number>,
  options?: PickQuestionOptions,
): QuestionNode {
  return pickNextQuestion(graph, preferredChapterIds, beliefs, options);
}

/**
 * Pick the next practice item. This is still deterministic, but it is now a real
 * session picker: chapter filter, attempted-question avoidance, review pressure,
 * and fatigue all feed the same PLAN §6 score.
 */
export function pickNextQuestion(
  graph: GraphData,
  preferredChapterIds: string[],
  beliefs: Record<string, number>,
  options?: PickQuestionOptions,
): QuestionNode {
  const ranked = rankQuestionCandidates(graph, preferredChapterIds, beliefs, options);
  if (ranked.length > 0) return ranked[0].question;
  if (graph.questions.length === 0) {
    return graph.questions[0] ?? {
      id: 'empty_graph_question',
      source: 'Graph unavailable',
      prompt: 'No questions are available in the current graph snapshot.',
      subject: 'math',
      chapterId: 'math_general',
      conceptIds: [],
      prereqIds: [],
      canonicalSteps: [],
      difficulty: 1,
      mode: 'diagnose',
      examFeel: 0,
    };
  }
  return graph.questions[0];
}

