import type { GraphData } from '../../src/domain/types';
import type { UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import {
  cohortAllowsNonBlockingRepair,
  cohortObjectivePreference,
  deferReviewWithoutPenalty,
  evaluateReviewBudget,
  type DueWindow,
  type LearnerCohort,
  type ReviewBudgetState,
  type TurnObjective,
} from '../learner';
import type { EligibleQuestion } from './eligibility';

export interface ObjectiveContext {
  cohort: LearnerCohort;
  nowIso: string;
  reviewBudget: ReviewBudgetState;
  chapterConceptIds: string[];
  allowCrossChapterDue?: boolean;
  /** Due windows keyed by concept id; falls back to schedule.dueAt as ideal. */
  dueWindows?: Record<string, DueWindow>;
  eligibleQuestions: EligibleQuestion[];
  needsOrientation: boolean;
  untestedRatio: number;
  hasFormulaOnlyGap: boolean;
  consecutiveFullQuestions: number;
  blockingPrereqIds: string[];
}

export interface ObjectiveDecision {
  objective: TurnObjective;
  rationale: string;
  reviewBudget: ReviewBudgetState;
  focalConceptId?: string;
  deferredReviews: string[];
}

function inDueWindow(window: DueWindow, nowIso: string): boolean {
  if (nowIso < window.opensAt) return false;
  if (window.closesAt && nowIso > window.closesAt) {
    // Past soft close: still "due" but deferrable — treat as in window for consideration.
    return true;
  }
  return nowIso >= window.opensAt;
}

function dueConceptIds(
  graph: GraphData,
  state: UnifiedTutorStudentState,
  ctx: ObjectiveContext,
): string[] {
  const due: string[] = [];
  const deferred = new Set(ctx.reviewBudget.deferredReviewConceptIds);

  for (const [cid, sch] of Object.entries(state.reviewSchedules ?? {})) {
    if (!sch || deferred.has(cid)) continue;
    const win =
      ctx.dueWindows?.[cid] ??
      ({
        opensAt: sch.dueAt,
        idealAt: sch.dueAt,
      } satisfies DueWindow);
    if (!inDueWindow(win, ctx.nowIso)) continue;

    const inChapter = ctx.chapterConceptIds.includes(cid);
    if (inChapter) {
      due.push(cid);
      continue;
    }
    if (ctx.allowCrossChapterDue) {
      const ch = graph.concepts.find((c) => c.id === cid)?.chapterId;
      if (ch) due.push(cid);
    }
  }
  return due;
}

function pickPreferred(
  available: TurnObjective[],
  cohort: LearnerCohort,
): TurnObjective {
  const pref = cohortObjectivePreference(cohort);
  for (const p of pref) {
    if (available.includes(p)) return p;
  }
  return available[0] ?? 'diagnostic_probe';
}

/**
 * Stage 3: choose the turn objective after eligibility + critical gate.
 * Reviews compete inside a budgeted due-window queue; deferral is penalty-free.
 */
export function selectTurnObjective(
  graph: GraphData,
  state: UnifiedTutorStudentState,
  ctx: ObjectiveContext,
): ObjectiveDecision {
  const deferredReviews: string[] = [];
  let budget = ctx.reviewBudget;
  const due = dueConceptIds(graph, state, ctx);
  const reviewDecision = evaluateReviewBudget(budget);

  const available: TurnObjective[] = [];

  if (ctx.blockingPrereqIds.length > 0) {
    available.push('critical_repair');
  } else if (
    cohortAllowsNonBlockingRepair(ctx.cohort) &&
    ctx.eligibleQuestions.some((q) => q.softWeakPrereqIds.length > 0)
  ) {
    // Non-blocking repair is optional for Class 11 / dropper; Class 12 skips.
    available.push('critical_repair');
  }

  if (ctx.needsOrientation) {
    available.push('orientation');
  }

  if (due.length > 0) {
    if (reviewDecision.allow) {
      available.push('due_review');
    } else {
      for (const cid of due) {
        budget = deferReviewWithoutPenalty(budget, cid);
        deferredReviews.push(cid);
      }
    }
  }

  // Mixed-practice cross-chapter dues: when in budget, let them compete at the
  // top of the cohort preference list without becoming unbounded debt.
  const preferCrossChapterDue =
    Boolean(ctx.allowCrossChapterDue) &&
    reviewDecision.allow &&
    due.some((cid) => !ctx.chapterConceptIds.includes(cid));

  // Aggressive calibration only when chapter priors still say "not seen"/missing.
  // Self-marked beyond not_seen should not force endless gauge probes.
  if (ctx.needsOrientation && ctx.untestedRatio > 0.35) {
    available.push('diagnostic_probe');
  }

  if (ctx.hasFormulaOnlyGap) {
    available.push('acquisition');
  }

  const hasEligibleQ = ctx.eligibleQuestions.some((q) => q.eligible);
  if (hasEligibleQ) {
    if (ctx.cohort === 'dropper') {
      available.push('exam_integration', 'discrimination', 'independent_application');
    } else if (ctx.cohort === 'class_12') {
      available.push('independent_application', 'exam_integration');
    } else {
      // Class 11: foundations first; acquisition only when formula-only gap exists.
      available.push('independent_application');
    }
  }

  if (ctx.consecutiveFullQuestions >= 1 && ctx.cohort === 'dropper') {
    available.push('discrimination');
  }

  // Ensure at least one objective.
  if (available.length === 0) {
    available.push(ctx.needsOrientation ? 'orientation' : 'diagnostic_probe');
  }

  // Critical repair always wins when hard-blocking.
  let objective: TurnObjective;
  if (ctx.blockingPrereqIds.length > 0) {
    objective = 'critical_repair';
  } else if (preferCrossChapterDue && available.includes('due_review')) {
    objective = 'due_review';
  } else {
    objective = pickPreferred(available, ctx.cohort);
  }

  const focalConceptId =
    objective === 'critical_repair'
      ? ctx.blockingPrereqIds[0] ??
        ctx.eligibleQuestions.find((q) => q.softWeakPrereqIds[0])?.softWeakPrereqIds[0]
      : objective === 'due_review'
        ? due[0]
        : ctx.chapterConceptIds[0];

  return {
    objective,
    rationale: `objective=${objective};cohort=${ctx.cohort};review=${reviewDecision.reason}`,
    reviewBudget: budget,
    focalConceptId,
    deferredReviews,
  };
}
