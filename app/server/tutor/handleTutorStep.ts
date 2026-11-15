import type { GraphData, QuestionNode } from '../../src/domain/types';
import type { TutorTurn, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import { parseLlmJson } from '../jsonRepair';
import type { AnnotatedPrereqEdge, LearnerCohort, ReviewBudgetState, StretchPriorConfig } from '../learner';
import { chatCompletions, providerLabel } from '../llmClient.ts';
import { proposePickerCandidates } from '../picker/ruleLayer';
import {
  appendTranscript,
  ensureChapterSession,
  loadUnifiedState,
  recentQuestionRefsFromCoachTranscript,
  saveUnifiedState,
  sliceConceptIdsForChapter,
  transcriptSliceForPrompt,
  type TutorSqlDb,
} from '../tutorStore';
import { filterAndApplyStateUpdates } from './applyStateUpdates';
import { buildTutorStepPrompt, compactGraphSliceForChapter } from './tutorStepPrompt';
import { validateTutorTurn } from './validateTutorTurn';

export interface TutorStepRequestBody {
  studentId?: string;
  chapterId?: string;
  lastStudentMessage?: string;
  mixedPractice?: boolean;
  /** Pilot paths must pass explicit cohort; legacy callers may omit. */
  cohort?: LearnerCohort;
  reviewBudget?: ReviewBudgetState;
  prereqAnnotations?: AnnotatedPrereqEdge[];
  stretchPrior?: StretchPriorConfig;
  /** When set, reject holdout items before they are served. */
  holdoutAssert?: (questionId: string) => void;
}

export type TutorFallbackReason = 'no_api_key' | 'bad_json' | 'upstream';

function tutorFallbackMeta(reason: TutorFallbackReason): string {
  switch (reason) {
    case 'no_api_key':
      return '(tutor_fallback:no_api_key)';
    case 'bad_json':
      return '(tutor_fallback:bad_json)';
    case 'upstream':
      return '(tutor_fallback:upstream)';
  }
}

function fallbackTurnFromCandidates(
  candidates: ReturnType<typeof proposePickerCandidates>,
  reason: TutorFallbackReason,
): TutorTurn {
  const primary = candidates[0];
  const mode = primary.mode;
  const mkItem = (): TutorTurn['item'] => {
    if (mode === 'present_question') return { kind: 'question_ref', questionRef: primary.itemIntent };
    return {
      kind: 'probe',
      prompt: 'Warm-up: in your own words, how do you know which idea this question is testing?',
    };
  };
  return {
    chosenCandidateId: primary.id,
    mode,
    coachMessage:
      mode === 'chapter_intro'
        ? "Hi — quick check before we jump in. How are you feeling about this chapter? (Honestly is best — 'not sure' is a great answer.)"
        : "Let's stay light. Tell me what jumps out at you — even messy notes count.",
    metaNarration: tutorFallbackMeta(reason),
    item: mkItem(),
    endsTurn: true,
    stateUpdates: [],
  };
}

async function grokCoachJson(prompt: string, apiKey: string, coachModel: string): Promise<unknown> {
  const timeoutMs = Number(process.env.GROK_TUTOR_TIMEOUT_MS ?? 120_000);
  const response = await chatCompletions(
    apiKey,
    {
      model: coachModel,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.35,
      max_tokens: 4000,
    },
    {
      signal: Number.isFinite(timeoutMs) && timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${providerLabel()} tutor-step failed (${response.status}). ${body.slice(0, 220)}`);
  }

  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerLabel()} returned empty tutor-step JSON.`);
  return parseLlmJson(text);
}

async function grokCoachJsonWithBackoff(prompt: string, apiKey: string, coachModel: string): Promise<unknown> {
  const maxAttempts = Math.max(1, Math.min(8, Number(process.env.GROK_TUTOR_RETRIES ?? 4)));
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await grokCoachJson(prompt, apiKey, coachModel);
    } catch (e) {
      lastErr = e;
      if (attempt < maxAttempts) {
        const backoff = Math.min(12_000, 450 * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Allowed item.kind values mirrored from validateTutorTurn schema. */
const ALLOWED_ITEM_KINDS = new Set([
  'probe',
  'micro_lesson',
  'derivation',
  'splice',
  'question_ref',
  'review_recall',
  'park',
]);

const ALLOWED_STATE_UPDATE_KINDS = new Set([
  'concept_observed',
  'mistake_observed',
  'coverage_advance',
  'park_question',
  'schedule_review',
]);

/**
 * Best-effort scrub of a coach-emitted JSON before zod validation:
 * - Drop `item` entirely when its `kind` is unknown or required fields missing.
 * - Filter `stateUpdates` to entries whose `kind` we accept.
 * Keeps the wider turn intact so we don't fall back to a generic message just because
 * Grok invented one auxiliary field.
 */
function scrubRawTutorTurn(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  if (obj.item && typeof obj.item === 'object') {
    const it = obj.item as Record<string, unknown>;
    const kind = typeof it.kind === 'string' ? it.kind : '';
    if (!ALLOWED_ITEM_KINDS.has(kind)) {
      delete obj.item;
    } else {
      const required: Record<string, string[]> = {
        probe: ['prompt'],
        micro_lesson: ['explanation'],
        derivation: ['setup', 'missingLine'],
        splice: ['questionRef', 'presolved', 'gap'],
        question_ref: ['questionRef'],
        review_recall: ['conceptId', 'prompt'],
        park: ['questionRef', 'reason'],
      };
      const missing = (required[kind] ?? []).some((k) => typeof it[k] !== 'string' || (it[k] as string).length === 0);
      if (missing) delete obj.item;
    }
  }

  if (Array.isArray(obj.stateUpdates)) {
    const allowedObserved = new Set(['shaky', 'applied_correctly', 'failed']);
    const allowedEvidenceSource = new Set([
      'self_report',
      'calibration_probe',
      'attempt_step',
      'follow_up',
      'splice',
      'micro_lesson_recap',
    ]);
    const allowedOutcome = new Set([
      'applied_well',
      'applied_with_help',
      'failed',
      'declared_unknown',
      'partially_correct',
      'recall_only',
    ]);

    obj.stateUpdates = obj.stateUpdates
      .map((u) => {
        if (!u || typeof u !== 'object') return null;
        const v = { ...(u as Record<string, unknown>) };
        const k = typeof v.kind === 'string' ? v.kind : '';
        if (!ALLOWED_STATE_UPDATE_KINDS.has(k)) return null;

        if (k === 'concept_observed') {
          /** Grok sometimes ships 'untested' (we only allow the three lower); coerce or drop */
          if (v.observed === 'untested') v.observed = 'shaky';
          if (typeof v.observed !== 'string' || !allowedObserved.has(v.observed)) return null;

          /** evidence may arrive as a plain note string — wrap it. */
          if (typeof v.evidence === 'string') {
            v.evidence = { source: 'attempt_step', outcome: 'applied_with_help', note: v.evidence };
          }
          if (!v.evidence || typeof v.evidence !== 'object') {
            v.evidence = { source: 'follow_up', outcome: 'partially_correct', note: '(auto-filled)' };
          }
          const ev = v.evidence as Record<string, unknown>;
          if (typeof ev.source !== 'string' || !allowedEvidenceSource.has(ev.source as string)) ev.source = 'follow_up';
          if (typeof ev.outcome !== 'string' || !allowedOutcome.has(ev.outcome as string)) ev.outcome = 'partially_correct';
          if (typeof ev.note !== 'string') ev.note = '(auto-filled)';
        }
        return v;
      })
      .filter((u): u is Record<string, unknown> => u !== null);
  }
  return obj;
}

function coerceTurnAfterValidation(
  raw: unknown,
  candidates: ReturnType<typeof proposePickerCandidates>,
): TutorTurn | null {
  const cleaned = scrubRawTutorTurn(raw);
  const v = validateTutorTurn(cleaned);
  if (!v.ok) {
    const itemDump = (cleaned as { item?: unknown })?.item ? JSON.stringify((cleaned as { item: unknown }).item).slice(0, 400) : '(no item)';
    console.warn('[tutor-step] TutorTurn JSON failed schema check:', v.errors.slice(0, 500), 'item=', itemDump);
    return null;
  }
  const turn = v.value as TutorTurn;
  const knownIds = new Set(candidates.map((c) => c.id));
  if (turn.chosenCandidateId !== 'custom' && !knownIds.has(turn.chosenCandidateId)) {
    /** Map back to safest candidate — align declared mode when the ID was hallucinated off-list */
    const pinned = candidates[0];
    if (!pinned) return turn;
    return { ...turn, chosenCandidateId: pinned.id, mode: pinned.mode };
  }
  if (turn.chosenCandidateId !== 'custom') {
    const pinned = candidates.find((c) => c.id === turn.chosenCandidateId);
    if (pinned && pinned.mode !== turn.mode) {
      return { ...turn, mode: pinned.mode };
    }
  }
  return turn;
}

export async function executeTutorStep(
  db: TutorSqlDb,
  graph: GraphData,
  rawBody: TutorStepRequestBody,
  opts?: { grokApiKey?: string; coachModel?: string },
): Promise<{ state: UnifiedTutorStudentState; tutorTurn: TutorTurn }> {
  const studentId =
    typeof rawBody.studentId === 'string' && rawBody.studentId.trim().length > 0
      ? rawBody.studentId.trim()
      : 'anon';
  const chapterId = typeof rawBody.chapterId === 'string' ? rawBody.chapterId : '';
  if (!chapterId) throw new Error('chapterId is required');

  const chapterConceptIds = sliceConceptIdsForChapter(graph, chapterId);
  const state = loadUnifiedState(db, studentId);
  ensureChapterSession(state, chapterId, chapterConceptIds);

  if (typeof rawBody.mixedPractice === 'boolean') {
    state.sessionMode = rawBody.mixedPractice ? 'mixed_practice' : 'chapter';
  }

  const nowIso = new Date().toISOString();
  const lastMsg = typeof rawBody.lastStudentMessage === 'string' ? rawBody.lastStudentMessage.trim() : '';

  if (lastMsg.length > 0) {
    appendTranscript(db, studentId, chapterId, {
      role: 'student',
      content: lastMsg,
      at: nowIso,
    });
  }

  const cohort = rawBody.cohort;
  const candidates = proposePickerCandidates(graph, chapterId, state, {
    nowIso,
    allowCrossChapterDue: state.sessionMode === 'mixed_practice',
    ...(cohort
      ? {
          cohort,
          reviewBudget: rawBody.reviewBudget,
          prereqAnnotations: rawBody.prereqAnnotations,
          stretchPrior: rawBody.stretchPrior,
          allowLegacyCohortDefault: false,
        }
      : {
          // Isolated legacy fallback when no pilot cohort is in the request.
          allowLegacyCohortDefault: true,
        }),
  });

  const recent = transcriptSliceForPrompt(db, studentId, 120);
  const graphSlice = compactGraphSliceForChapter(graph, chapterId, state);

  const usedRefsOrdered = recentQuestionRefsFromCoachTranscript(db, studentId, 400);
  const usedQuestionIds = new Set(usedRefsOrdered);

  let preferQIntent = candidates.find((c) => c.mode === 'present_question')?.itemIntent;
  if (preferQIntent && usedQuestionIds.has(preferQIntent)) preferQIntent = undefined;

  const preferredQuestion = pickPreferredQuestion(graph, chapterId, preferQIntent, usedQuestionIds);

  const promptPayload = buildTutorStepPrompt({
    language: state.language,
    candidates,
    stateSlice: state,
    graphSlice,
    recentTurns: recent,
    lastStudentMessage: lastMsg || '(opening turn — acknowledge chapter entry gently)',
    preferredQuestion,
    questionIdsAlreadyShown: [...usedQuestionIds].slice(-40),
  });

  let tutorTurn: TutorTurn;
  if (!opts?.grokApiKey) {
    tutorTurn = fallbackTurnFromCandidates(candidates, 'no_api_key');
  } else {
    try {
      const raw = await grokCoachJsonWithBackoff(promptPayload, opts.grokApiKey, opts.coachModel ?? 'grok-4-1-fast-non-reasoning');
      const coerced = coerceTurnAfterValidation(raw, candidates);
      tutorTurn = coerced ?? fallbackTurnFromCandidates(candidates, 'bad_json');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[tutor-step] Grok path failed — using deterministic fallback:', msg.slice(0, 200));
      tutorTurn = fallbackTurnFromCandidates(candidates, 'upstream');
    }
  }

  /** Hard guard: LLM occasionally replays the same question_ref despite prompt */
  if (tutorTurn.item?.kind === 'question_ref') {
    const ref = tutorTurn.item.questionRef;
    if (usedQuestionIds.has(ref)) {
      const alt = pickPreferredQuestion(graph, chapterId, undefined, usedQuestionIds);
      if (alt && alt.id !== ref) {
        tutorTurn = {
          ...tutorTurn,
          chosenCandidateId: tutorTurn.chosenCandidateId ?? 'jee_question',
          mode: 'present_question',
          item: { kind: 'question_ref', questionRef: alt.id },
          metaNarration: [tutorTurn.metaNarration, 'Rotating to a different graph question so practice stays varied.']
            .filter(Boolean)
            .join(' ')
            .trim(),
        };
      }
    }
  }

  /** Holdout bank boundary — must reject before tutoring serves content. */
  if (tutorTurn.item?.kind === 'question_ref' && typeof rawBody.holdoutAssert === 'function') {
    rawBody.holdoutAssert(tutorTurn.item.questionRef);
  }

  /** scope + taught sets */
  const sliceSet = new Set<string>(chapterConceptIds);
  for (const c of candidates) sliceSet.add(c.targetConceptId);
  if (tutorTurn.chosenCandidateId === 'custom' && tutorTurn.customCandidate?.targetConcept)
    sliceSet.add(tutorTurn.customCandidate.targetConcept);

  /** If question_ref, include its concept ids as taught */
  const taught = new Set<string>();
  const matchCand = candidates.find((c) => c.id === tutorTurn.chosenCandidateId);
  if (matchCand) taught.add(matchCand.targetConceptId);
  if (tutorTurn.customCandidate?.targetConcept) taught.add(tutorTurn.customCandidate.targetConcept);
  if (tutorTurn.item?.kind === 'question_ref') {
    const ref = tutorTurn.item.questionRef;
    const q = graph.questions.find((qq) => qq.id === ref);
    for (const cid of q?.conceptIds ?? []) taught.add(cid);
  }

  const apply = filterAndApplyStateUpdates(state, tutorTurn.stateUpdates ?? [], {
    sliceConceptIds: sliceSet,
    taughtConceptIds: taught,
    nowIso,
  });
  if (apply.dropped.length > 0) {
    console.warn('[tutor-step] dropped state updates', apply.dropped);
  }

  if (tutorTurn.mode === 'present_question') {
    state.consecutiveFullQuestions = (state.consecutiveFullQuestions ?? 0) + 1;
  } else {
    state.consecutiveFullQuestions = 0;
  }

  appendTranscript(db, studentId, chapterId, {
    role: 'coach',
    content: tutorTurn.coachMessage,
    at: new Date().toISOString(),
    tutorTurn,
  });

  saveUnifiedState(db, state, true);

  return { state, tutorTurn };
}

function pickPreferredQuestion(
  graph: GraphData,
  chapterId: string,
  intentId: string | undefined,
  excludeIds?: Set<string>,
): QuestionNode | undefined {
  const chapterQs = graph.questions
    .filter((q) => q.chapterId === chapterId && !q.needsHumanReview)
    .slice()
    .sort((a, b) => a.difficulty - b.difficulty);
  if (chapterQs.length === 0) return undefined;
  if (intentId) {
    const match = chapterQs.find((q) => q.id === intentId) ?? graph.questions.find((q) => q.id === intentId);
    if (match && match.chapterId === chapterId && !excludeIds?.has(match.id)) return match;
  }
  const unseen = chapterQs.find((q) => !excludeIds?.has(q.id));
  return unseen ?? chapterQs[0];
}
