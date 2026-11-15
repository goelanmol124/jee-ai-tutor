import type { TutorCoachMode, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import {
  cohortDefaultAssistance,
  edgesForQuestion,
  predictSuccessAtAssistance,
  stretchFitForAssistance,
  type AnnotatedPrereqEdge,
  type AssistanceLevel,
  type LearnerCohort,
  type StretchPriorConfig,
  type TurnObjective,
} from '../learner';
import type { EligibleQuestion } from './eligibility';

export interface RankedCandidate {
  id: string;
  mode: TutorCoachMode;
  targetConceptId: string;
  itemIntent: string;
  rationale: string;
  score: number;
  predictedSuccess?: number;
  stretchFit?: number;
  assistance?: AssistanceLevel;
}

function assistanceForObjective(
  objective: TurnObjective,
  cohort: LearnerCohort,
): AssistanceLevel {
  switch (objective) {
    case 'due_review':
      return 'review';
    case 'acquisition':
    case 'orientation':
      return 'worked_example_transition';
    case 'critical_repair':
      return 'splice';
    case 'diagnostic_probe':
      return 'one_hint';
    case 'exam_integration':
    case 'independent_application':
      return 'independent';
    case 'discrimination':
      return cohortDefaultAssistance(cohort) === 'independent' ? 'independent' : 'one_hint';
    default:
      return cohortDefaultAssistance(cohort);
  }
}

function modeForObjective(objective: TurnObjective): TutorCoachMode {
  switch (objective) {
    case 'orientation':
      return 'chapter_intro';
    case 'due_review':
      return 'review_recall';
    case 'diagnostic_probe':
      return 'gauge_probe';
    case 'critical_repair':
      return 'teach_concept';
    case 'acquisition':
      return 'derive_formula';
    case 'discrimination':
      return 'meta_narrate';
    case 'independent_application':
    case 'exam_integration':
      return 'present_question';
    default:
      return 'gauge_probe';
  }
}

export interface RankWithinObjectiveArgs {
  objective: TurnObjective;
  cohort: LearnerCohort;
  state: UnifiedTutorStudentState;
  eligibleQuestions: EligibleQuestion[];
  allEdges: AnnotatedPrereqEdge[];
  focalConceptId?: string;
  stretchPrior?: StretchPriorConfig;
  /** When true, allow items outside the nominal stretch band (diagnostics / due review). */
  ignoreStretchBand?: boolean;
  crossChapterDueConceptId?: string;
}

/**
 * Stage 4: rank candidates inside the chosen objective.
 * Stretch uses predicted success at the objective's assistance level.
 */
export function rankWithinObjective(args: RankWithinObjectiveArgs): RankedCandidate[] {
  const {
    objective,
    cohort,
    state,
    eligibleQuestions,
    allEdges,
    focalConceptId,
    stretchPrior,
  } = args;

  const assistance = assistanceForObjective(objective, cohort);
  const ignoreBand =
    args.ignoreStretchBand ??
    (objective === 'due_review' ||
      objective === 'diagnostic_probe' ||
      objective === 'critical_repair' ||
      objective === 'orientation');

  const out: RankedCandidate[] = [];

  if (objective === 'due_review' && (focalConceptId || args.crossChapterDueConceptId)) {
    const cid = args.crossChapterDueConceptId ?? focalConceptId!;
    out.push({
      id: args.crossChapterDueConceptId ? 'due_review_cross_chapter' : 'due_review',
      mode: 'review_recall',
      targetConceptId: cid,
      itemIntent: args.crossChapterDueConceptId
        ? `cross_chapter_recall`
        : 'short_recall_probe',
      rationale: args.crossChapterDueConceptId
        ? 'Due-window recall outside the active chapter (budgeted).'
        : 'A concept you practiced is inside its due window for a quick recap.',
      score: 1,
      assistance: 'review',
    });
  }

  if (objective === 'orientation') {
    out.push({
      id: 'chapter_intro',
      mode: 'chapter_intro',
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'warm_welcome_probe',
      rationale: 'Orient before harder work — foundations first.',
      score: 1,
      assistance,
    });
  }

  if (objective === 'diagnostic_probe') {
    out.push({
      id: 'gauge_untested',
      mode: 'gauge_probe',
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'meaning_or_recognition_probe',
      rationale: 'Reduce uncertainty with a low-stakes check before stretch work.',
      score: 1,
      assistance,
    });
  }

  if (objective === 'critical_repair') {
    out.push({
      id: 'critical_repair',
      mode: modeForObjective(objective),
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'repair_blocking_prerequisite',
      rationale: 'Hard-gated critical prerequisite needs repair before advancing.',
      score: 1,
      assistance,
    });
    out.push({
      id: 'splice_step',
      mode: 'splice_step',
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'faded_splice_repair',
      rationale: 'Scaffolded splice while the critical prerequisite is repaired.',
      score: 0.85,
      assistance: 'splice',
    });
  }

  if (objective === 'acquisition') {
    out.push({
      id: 'derive_gap',
      mode: 'derive_formula',
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'why_formula_works',
      rationale: 'Acquisition path: derive before unsupported application.',
      score: 1,
      assistance,
    });
  }

  if (
    objective === 'independent_application' ||
    objective === 'exam_integration' ||
    objective === 'discrimination'
  ) {
    for (const eq of eligibleQuestions.filter((q) => q.eligible)) {
      const edges = edgesForQuestion(eq.question, allEdges);
      const predicted = predictSuccessAtAssistance(state, edges, assistance);
      const fit = stretchFitForAssistance(predicted, assistance, stretchPrior);
      // Stretch is a scored prior, not a hard filter — diagnostics / due review
      // intentionally ignore the band; other objectives soft-penalize misses.

      const info =
        eq.question.conceptIds.reduce((s, id) => {
          const b = state.concepts[id]?.belief ?? 0.35;
          return s + b * (1 - b);
        }, 0) / Math.max(1, eq.question.conceptIds.length);

      const unlock = eq.softWeakPrereqIds.length === 0 ? 0.1 : 0;
      const exam = (eq.question.examFeel ?? 0) / 5;
      const stretchComponent = ignoreBand ? 0.55 : 0.45 * Math.max(fit, 0.05);
      const score =
        stretchComponent + 0.25 * predicted + 0.2 * info + 0.1 * exam + unlock;

      out.push({
        // Stable primary id for adapter compatibility; uniqueness via itemIntent.
        id: out.some((c) => c.id === 'jee_question')
          ? `jee_${eq.question.id}`
          : 'jee_question',
        mode: 'present_question',
        targetConceptId: eq.question.conceptIds[0] ?? focalConceptId ?? eq.question.id,
        itemIntent: eq.question.id,
        rationale:
          objective === 'exam_integration'
            ? `Exam-integration PYQ; predicted success ${(predicted * 100).toFixed(0)}% at ${assistance}.`
            : `Reachable PYQ; predicted success ${(predicted * 100).toFixed(0)}% at ${assistance}.`,
        score,
        predictedSuccess: predicted,
        stretchFit: fit,
        assistance,
      });
    }

    if (objective === 'discrimination') {
      out.push({
        id: 'discrimination_meta',
        mode: 'meta_narrate',
        targetConceptId: focalConceptId ?? 'concept_unknown',
        itemIntent: 'contrast_confusable_methods',
        rationale: 'Interleave confusable methods after component competence exists.',
        score: 0.7,
        assistance,
      });
    }
  }

  // Fallbacks so the adapter always has material.
  if (out.length === 0) {
    out.push({
      id: 'gauge_fallback',
      mode: 'gauge_probe',
      targetConceptId: focalConceptId ?? 'concept_unknown',
      itemIntent: 'fallback_probe',
      rationale: 'Low-pressure check so later picks are not guesses.',
      score: 0.1,
      assistance: 'one_hint',
    });
  }

  return out.sort((a, b) => b.score - a.score);
}
