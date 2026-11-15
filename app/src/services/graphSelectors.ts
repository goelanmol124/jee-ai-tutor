import { MASTERY_THRESHOLD, SHAKY_THRESHOLD } from '../data/concepts';
import type { GraphData, QuestionNode } from '../domain/types';

export type ConceptBeliefStatus = 'mastered' | 'shaky' | 'gap';

export function getConcept(graph: GraphData, conceptId: string) {
  return graph.concepts.find((c) => c.id === conceptId);
}

/** Concepts explicitly tagged on the question (from ingestion). */
export function getQuestionConceptIds(question: QuestionNode): string[] {
  return question.conceptIds;
}

/**
 * All prerequisite concepts reachable backward via ConceptNode.prereqIds (transitive).
 */
export function getPrereqAncestors(graph: GraphData, conceptId: string): Set<string> {
  const seen = new Set<string>();
  const stack = [...(getConcept(graph, conceptId)?.prereqIds ?? [])];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = getConcept(graph, id);
    if (node) stack.push(...node.prereqIds);
  }
  return seen;
}

/**
 * Ratio of question prereqs at or above mastery threshold (PLAN “80% known” proxy).
 */
export function getKnownPrereqRatio(
  question: QuestionNode,
  beliefs: Record<string, number>,
  masteryThreshold = MASTERY_THRESHOLD,
): number {
  const ids = question.prereqIds;
  if (ids.length === 0) return 1;
  let known = 0;
  for (const id of ids) {
    if ((beliefs[id] ?? 0) >= masteryThreshold) known++;
  }
  return known / ids.length;
}

export function conceptBeliefStatus(belief: number): ConceptBeliefStatus {
  if (belief >= MASTERY_THRESHOLD) return 'mastered';
  if (belief >= SHAKY_THRESHOLD) return 'shaky';
  return 'gap';
}

/** Map every concept id to mastered / shaky / gap for UI strips and maps. */
export function getConceptStatuses(
  graph: GraphData,
  beliefs: Record<string, number>,
): Record<string, ConceptBeliefStatus> {
  const out: Record<string, ConceptBeliefStatus> = {};
  for (const c of graph.concepts) {
    out[c.id] = conceptBeliefStatus(beliefs[c.id] ?? 0);
  }
  return out;
}
