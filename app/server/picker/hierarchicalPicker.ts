import type { GraphData } from '../../src/domain/types';
import type { PickerCandidate, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import {
  DEFAULT_STRETCH_PRIOR,
  emptyReviewBudgetState,
  resolvePrereqEdges,
  type AnnotatedPrereqEdge,
  type LearnerCohort,
  type ReviewBudgetState,
  type StretchPriorConfig,
  type TurnObjective,
} from '../learner';
import { ensureChapterSession, ensureConcept, sliceConceptIdsForChapter } from '../tutorStore';
import { listEligibleQuestions } from './eligibility';
import { selectTurnObjective } from './objectives';
import { rankWithinObjective, type RankedCandidate } from './ranking';

export interface HierarchicalPickerOptions {
  nowIso?: string;
  allowCrossChapterDue?: boolean;
  /** Required on pilot paths. Omit only with allowLegacyCohortDefault. */
  cohort?: LearnerCohort;
  /**
   * Isolated legacy fallback: when true and cohort is omitted, use Class 11
   * defaults. Pilot session/tutor paths must pass an explicit cohort instead.
   */
  allowLegacyCohortDefault?: boolean;
  reviewBudget?: ReviewBudgetState;
  prereqAnnotations?: AnnotatedPrereqEdge[];
  stretchPrior?: StretchPriorConfig;
  usedQuestionIds?: Set<string>;
  maxCandidates?: number;
}

export interface HierarchicalPickerResult {
  candidates: PickerCandidate[];
  ranked: RankedCandidate[];
  objective: TurnObjective;
  objectiveRationale: string;
  reviewBudget: ReviewBudgetState;
  deferredReviews: string[];
  blockingPrereqIds: string[];
  policyVersion: 'w3_hierarchical_v1';
}

function nowOr(iso?: string): string {
  return iso ?? new Date().toISOString();
}

function needsAggressiveCalibrationForChapter(
  state: UnifiedTutorStudentState,
  chapterConceptIds: string[],
): boolean {
  for (const id of chapterConceptIds) {
    const c = state.concepts[id];
    if (!c || c.selfReport == null || c.selfReport === 'not_seen') return true;
  }
  return false;
}

function focalConceptIds(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
): string[] {
  const ids = sliceConceptIdsForChapter(graph, chapterId);
  const score = (id: string) => {
    const c = ensureConcept(state, id);
    let s = 0;
    if (c.observed === 'untested') s += 3;
    if (c.observed === 'failed') s += 2;
    if (c.observed === 'shaky') s += 1;
    if (c.selfReport === 'formula_only') s += 1;
    if (c.selfReport === 'not_seen') s += 2;
    return s;
  };
  return ids.slice().sort((a, b) => score(b) - score(a));
}

/**
 * Hierarchy: eligibility → critical prerequisite gate → objective → within-objective ranking.
 */
export function runHierarchicalPicker(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  opts: HierarchicalPickerOptions = {},
): HierarchicalPickerResult {
  const nowIso = nowOr(opts.nowIso);
  let cohort: LearnerCohort;
  if (opts.cohort) {
    cohort = opts.cohort;
  } else if (opts.allowLegacyCohortDefault) {
    // Legacy-only: Class 11 orientation defaults. Not used on pilot paths.
    cohort = 'class_11';
  } else {
    throw new Error(
      'cohort is required for hierarchical picker (pass explicit class_11|class_12|dropper, or allowLegacyCohortDefault for isolated legacy callers)',
    );
  }
  const concepts = sliceConceptIdsForChapter(graph, chapterId);
  ensureChapterSession(state, chapterId, concepts);

  const allEdges = resolvePrereqEdges(graph, opts.prereqAnnotations ?? []);
  const eligibleQuestions = listEligibleQuestions(graph, chapterId, state, allEdges, {
    usedQuestionIds: opts.usedQuestionIds,
  });

  const blockingPrereqIds = [
    ...new Set(eligibleQuestions.flatMap((q) => q.hardBlockingPrereqIds)),
  ];

  // If every question is critical-blocked, still surface the blocking ids for repair.
  if (blockingPrereqIds.length === 0) {
    for (const q of eligibleQuestions) {
      if (q.criticalBlocked) {
        blockingPrereqIds.push(...q.hardBlockingPrereqIds);
      }
    }
  }

  const untestedCount = concepts.filter(
    (id) => state.concepts[id]?.observed === 'untested' || !state.concepts[id],
  ).length;
  const untestedRatio = concepts.length ? untestedCount / concepts.length : 1;
  const needsOrientation = needsAggressiveCalibrationForChapter(state, concepts);
  const focal = focalConceptIds(graph, chapterId, state)[0] ?? concepts[0];
  const hasFormulaOnlyGap = Boolean(
    focal && ensureConcept(state, focal).selfReport === 'formula_only',
  );

  const objectiveDecision = selectTurnObjective(graph, state, {
    cohort,
    nowIso,
    reviewBudget: opts.reviewBudget ?? emptyReviewBudgetState(),
    chapterConceptIds: concepts,
    allowCrossChapterDue: opts.allowCrossChapterDue,
    eligibleQuestions,
    needsOrientation,
    untestedRatio,
    hasFormulaOnlyGap,
    consecutiveFullQuestions: state.consecutiveFullQuestions ?? 0,
    blockingPrereqIds,
  });

  let crossChapterDueConceptId: string | undefined;
  if (
    objectiveDecision.objective === 'due_review' &&
    opts.allowCrossChapterDue &&
    objectiveDecision.focalConceptId &&
    !concepts.includes(objectiveDecision.focalConceptId)
  ) {
    crossChapterDueConceptId = objectiveDecision.focalConceptId;
  }

  const ranked = rankWithinObjective({
    objective: objectiveDecision.objective,
    cohort,
    state,
    eligibleQuestions,
    allEdges,
    focalConceptId: objectiveDecision.focalConceptId ?? focal,
    stretchPrior: opts.stretchPrior ?? DEFAULT_STRETCH_PRIOR,
    crossChapterDueConceptId,
  });

  // Diversify: keep top N distinct modes/ids for the LLM adapter.
  const max = opts.maxCandidates ?? 3;
  const seen = new Set<string>();
  const picked: RankedCandidate[] = [];
  for (const c of ranked) {
    const key = `${c.mode}:${c.itemIntent}`;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(c);
    if (picked.length >= max) break;
  }

  // Pad with secondary ranks from adjacent objectives when thin.
  if (picked.length < max && objectiveDecision.objective !== 'diagnostic_probe') {
    const pad = rankWithinObjective({
      objective: needsOrientation ? 'diagnostic_probe' : 'independent_application',
      cohort,
      state,
      eligibleQuestions,
      allEdges,
      focalConceptId: focal,
      stretchPrior: opts.stretchPrior ?? DEFAULT_STRETCH_PRIOR,
      ignoreStretchBand: true,
    });
    for (const c of pad) {
      const key = `${c.mode}:${c.itemIntent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      picked.push(c);
      if (picked.length >= max) break;
    }
  }

  while (picked.length < max) {
    picked.push({
      id: 'gauge_fallback',
      mode: 'gauge_probe',
      targetConceptId: focal ?? 'concept_unknown',
      itemIntent: `fallback_probe_${picked.length}`,
      rationale: 'Low-pressure check so later picks are not guesses.',
      score: 0,
    });
  }

  const candidates: PickerCandidate[] = picked.map((c) => ({
    id: c.id,
    mode: c.mode,
    targetConceptId: c.targetConceptId,
    itemIntent: c.itemIntent,
    rationale: c.rationale,
  }));

  return {
    candidates,
    ranked: picked,
    objective: objectiveDecision.objective,
    objectiveRationale: objectiveDecision.rationale,
    reviewBudget: objectiveDecision.reviewBudget,
    deferredReviews: objectiveDecision.deferredReviews,
    blockingPrereqIds,
    policyVersion: 'w3_hierarchical_v1',
  };
}

/** Adapter: preserve proposePickerCandidates shape for tutor orchestrator. */
export function proposePickerCandidatesHierarchical(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  opts?: HierarchicalPickerOptions,
): PickerCandidate[] {
  return runHierarchicalPicker(graph, chapterId, state, opts).candidates;
}
