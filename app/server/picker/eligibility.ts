import type { GraphData, QuestionNode } from '../../src/domain/types';
import type { UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import {
  edgesForQuestion,
  evaluateCriticalPrerequisiteGate,
} from '../learner';
import type { AnnotatedPrereqEdge } from '../learner';

export interface ContentEligibilityOptions {
  usedQuestionIds?: Set<string>;
  requireCanonicalSteps?: boolean;
}

export interface EligibleQuestion {
  question: QuestionNode;
  eligible: boolean;
  reasons: string[];
  criticalBlocked: boolean;
  hardBlockingPrereqIds: string[];
  softWeakPrereqIds: string[];
}

function hasEssentialStem(q: QuestionNode): boolean {
  return typeof q.prompt === 'string' && q.prompt.trim().length > 0;
}

/**
 * Centralized content + evidence eligibility before critical gating / ranking.
 */
export function assessQuestionEligibility(
  question: QuestionNode,
  state: UnifiedTutorStudentState,
  allEdges: AnnotatedPrereqEdge[],
  opts: ContentEligibilityOptions = {},
): EligibleQuestion {
  const reasons: string[] = [];

  if (!hasEssentialStem(question)) {
    reasons.push('missing_stem');
  }
  if (opts.requireCanonicalSteps !== false && question.canonicalSteps.length === 0) {
    // Soft warning for pilot fixtures that omit steps; still allow unless flagged.
    reasons.push('missing_canonical_steps_soft');
  }
  if (question.needsHumanReview) {
    reasons.push('needs_human_review');
  }
  if (opts.usedQuestionIds?.has(question.id)) {
    reasons.push('recently_used');
  }

  const edges = edgesForQuestion(question, allEdges);
  const gate = evaluateCriticalPrerequisiteGate(state, edges);

  const hardIneligible =
    reasons.includes('missing_stem') ||
    reasons.includes('needs_human_review') ||
    reasons.includes('recently_used');

  return {
    question,
    eligible: !hardIneligible && !gate.blocked,
    reasons: [...reasons, ...gate.reasons],
    criticalBlocked: gate.blocked,
    hardBlockingPrereqIds: gate.hardBlockingPrereqIds,
    softWeakPrereqIds: gate.softWeakPrereqIds,
  };
}

export function listEligibleQuestions(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  allEdges: AnnotatedPrereqEdge[],
  opts: ContentEligibilityOptions = {},
): EligibleQuestion[] {
  return graph.questions
    .filter((q) => q.chapterId === chapterId)
    .map((q) => assessQuestionEligibility(q, state, allEdges, opts))
    .sort((a, b) => a.question.difficulty - b.question.difficulty);
}
