import type { GraphData, ConceptNode, QuestionNode } from '../../src/domain/types';
import type { PickerCandidate, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import type { AnnotatedPrereqEdge, LearnerCohort, ReviewBudgetState, StretchPriorConfig } from '../learner';
import {
  proposePickerCandidatesHierarchical,
  runHierarchicalPicker,
  type HierarchicalPickerOptions,
  type HierarchicalPickerResult,
} from './hierarchicalPicker';

export type { HierarchicalPickerOptions, HierarchicalPickerResult };

export interface ProposePickerCandidatesOptions {
  nowIso?: string;
  allowCrossChapterDue?: boolean;
  cohort?: LearnerCohort;
  /** See HierarchicalPickerOptions.allowLegacyCohortDefault */
  allowLegacyCohortDefault?: boolean;
  reviewBudget?: ReviewBudgetState;
  prereqAnnotations?: AnnotatedPrereqEdge[];
  stretchPrior?: StretchPriorConfig;
  usedQuestionIds?: Set<string>;
  maxCandidates?: number;
}

/**
 * Hybrid rule layer — proposes up to 3 candidates with rationales.
 * Implemented as the W3 hierarchical picker (eligibility → critical gate →
 * objective → within-objective ranking). Signature stays compatible with the
 * tutor orchestrator.
 */
/**
 * Legacy entry: when cohort is omitted, isolate Class 11 default here only.
 * Pilot paths must call with an explicit cohort (or runHierarchicalPicker).
 */
export function proposePickerCandidates(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  opts?: ProposePickerCandidatesOptions,
): PickerCandidate[] {
  const legacyOpts: HierarchicalPickerOptions = {
    ...(opts ?? {}),
    allowLegacyCohortDefault: opts?.cohort ? opts.allowLegacyCohortDefault : true,
  };
  return proposePickerCandidatesHierarchical(graph, chapterId, state, legacyOpts);
}

/** Full hierarchical result — requires explicit cohort unless allowLegacyCohortDefault. */
export function proposePickerCandidatesDetailed(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  opts?: ProposePickerCandidatesOptions,
): HierarchicalPickerResult {
  return runHierarchicalPicker(graph, chapterId, state, opts);
}

export function buildGraphSlice(
  graph: GraphData,
  chapterId: string,
  conceptIds: string[],
): {
  chapters: Pick<GraphData['chapters'][0], 'id' | 'title' | 'subject'>[];
  concepts: ConceptNode[];
  edges: GraphData['edges'];
  questions_sample: QuestionNode[];
} {
  const ch = graph.chapters.find((c) => c.id === chapterId);
  const concepts = graph.concepts.filter((c) => conceptIds.includes(c.id));
  const edges = graph.edges.filter((e) => conceptIds.includes(e.from) && conceptIds.includes(e.to));
  const qs = graph.questions.filter((q) => q.chapterId === chapterId).slice(0, 8);
  return {
    chapters: ch ? [{ id: ch.id, title: ch.title, subject: ch.subject }] : [],
    concepts,
    edges,
    questions_sample: qs,
  };
}
