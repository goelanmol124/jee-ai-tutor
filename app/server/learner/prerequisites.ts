import type { GraphData, GraphEdge, QuestionNode } from '../../src/domain/types';
import type { UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import type { AnnotatedPrereqEdge, EdgeProvenance, PrerequisiteClass } from './types';

const HARD_GATE_PROVENANCE: ReadonlySet<EdgeProvenance> = new Set([
  'maker_approved',
  'expert_reviewed',
  'empirically_validated',
]);

export function provenanceAllowsHardGate(provenance: EdgeProvenance): boolean {
  return HARD_GATE_PROVENANCE.has(provenance);
}

/**
 * Hard gates apply only to critical edges with maker/expert/empirical provenance.
 * LLM-only and co-occurrence-only edges are always soft.
 */
export function canHardGate(edge: AnnotatedPrereqEdge): boolean {
  if (edge.edgeClass !== 'critical') return false;
  if (edge.provenance === 'llm_proposed' || edge.provenance === 'co_occurrence_only') {
    return false;
  }
  return provenanceAllowsHardGate(edge.provenance);
}

export function defaultClassForGraphEdge(edge: GraphEdge): PrerequisiteClass {
  if (edge.kind === 'prereq') return 'supporting';
  return 'optional';
}

export function defaultProvenanceForGraphEdge(edge: GraphEdge): EdgeProvenance {
  if (edge.kind === 'co_occurs') return 'co_occurrence_only';
  return 'unknown';
}

/**
 * Merge graph edges + question prereq ids with optional annotations.
 * Unannotated prereq edges stay soft (supporting + unknown) so they never hard-block.
 */
export function resolvePrereqEdges(
  graph: GraphData,
  annotations: AnnotatedPrereqEdge[] = [],
): AnnotatedPrereqEdge[] {
  const byKey = new Map<string, AnnotatedPrereqEdge>();
  const keyOf = (from: string, to: string, path?: string) =>
    `${from}->${to}::${path ?? ''}`;

  for (const edge of graph.edges) {
    if (edge.kind !== 'prereq' && edge.kind !== 'co_occurs' && edge.kind !== 'related') {
      continue;
    }
    const annotated: AnnotatedPrereqEdge = {
      from: edge.from,
      to: edge.to,
      edgeClass: defaultClassForGraphEdge(edge),
      provenance: defaultProvenanceForGraphEdge(edge),
      confidence: edge.weight,
    };
    byKey.set(keyOf(annotated.from, annotated.to), annotated);
  }

  for (const q of graph.questions) {
    const targets = q.conceptIds.length ? q.conceptIds : [q.id];
    for (const prereqId of q.prereqIds) {
      for (const target of targets) {
        const k = keyOf(prereqId, target);
        if (!byKey.has(k)) {
          byKey.set(k, {
            from: prereqId,
            to: target,
            edgeClass: 'supporting',
            provenance: 'unknown',
          });
        }
      }
    }
  }

  for (const ann of annotations) {
    byKey.set(keyOf(ann.from, ann.to, ann.solutionPathId), { ...ann });
  }

  return [...byKey.values()];
}

export function edgesForQuestion(
  question: QuestionNode,
  allEdges: AnnotatedPrereqEdge[],
): AnnotatedPrereqEdge[] {
  const targets = new Set(question.conceptIds);
  const prereqIds = new Set(question.prereqIds);
  return allEdges.filter((e) => {
    if (targets.has(e.to) && (prereqIds.has(e.from) || targets.has(e.to))) return true;
    if (targets.has(e.to) && !targets.has(e.from)) return true;
    return false;
  });
}

export interface CriticalGateResult {
  blocked: boolean;
  hardBlockingPrereqIds: string[];
  softWeakPrereqIds: string[];
  reasons: string[];
}

function conceptAbsentEvidence(
  state: UnifiedTutorStudentState,
  conceptId: string,
): boolean {
  const c = state.concepts[conceptId];
  if (!c) return false;
  if (c.observed === 'failed') return true;
  if (c.selfReport === 'not_seen' && c.observed === 'untested' && (c.belief ?? 0) < 0.25) {
    return true;
  }
  if ((c.belief ?? 0) < 0.2 && c.observed !== 'applied_correctly') return true;
  return false;
}

function conceptWeakEvidence(
  state: UnifiedTutorStudentState,
  conceptId: string,
): boolean {
  const c = state.concepts[conceptId];
  if (!c) return true;
  if (c.observed === 'failed' || c.observed === 'shaky') return true;
  if ((c.belief ?? 0) < 0.45) return true;
  return false;
}

/**
 * Conjunctive critical-path gate: one hard-gated missing critical prereq blocks.
 * Soft edges only contribute weak signals.
 */
export function evaluateCriticalPrerequisiteGate(
  state: UnifiedTutorStudentState,
  edges: AnnotatedPrereqEdge[],
): CriticalGateResult {
  const hardBlockingPrereqIds: string[] = [];
  const softWeakPrereqIds: string[] = [];
  const reasons: string[] = [];

  for (const edge of edges) {
    if (canHardGate(edge) && conceptAbsentEvidence(state, edge.from)) {
      hardBlockingPrereqIds.push(edge.from);
      reasons.push(
        `hard_gate:${edge.from}->${edge.to}:critical:${edge.provenance}`,
      );
      continue;
    }
    if (
      (edge.edgeClass === 'critical' || edge.edgeClass === 'supporting') &&
      conceptWeakEvidence(state, edge.from)
    ) {
      softWeakPrereqIds.push(edge.from);
      if (!provenanceAllowsHardGate(edge.provenance) || edge.edgeClass !== 'critical') {
        reasons.push(`soft_signal:${edge.from}:${edge.edgeClass}:${edge.provenance}`);
      }
    }
  }

  return {
    blocked: hardBlockingPrereqIds.length > 0,
    hardBlockingPrereqIds: [...new Set(hardBlockingPrereqIds)],
    softWeakPrereqIds: [...new Set(softWeakPrereqIds)],
    reasons,
  };
}

/**
 * Predicted success at an assistance level — not an unweighted prereq count.
 * Critical hard edges dominate; supporting edges grade the remainder; scaffolds raise odds.
 */
export function predictSuccessAtAssistance(
  state: UnifiedTutorStudentState,
  edges: AnnotatedPrereqEdge[],
  assistance: import('./types').AssistanceLevel,
): number {
  const critical = edges.filter((e) => e.edgeClass === 'critical');
  const supporting = edges.filter((e) => e.edgeClass === 'supporting');
  const optional = edges.filter(
    (e) => e.edgeClass === 'optional' || e.edgeClass === 'alternative_method',
  );

  const beliefOf = (id: string) => {
    const b = state.concepts[id]?.belief;
    return typeof b === 'number' ? Math.min(1, Math.max(0, b)) : 0.35;
  };

  let base: number;
  if (critical.length > 0) {
    // Conjunctive floor on critical beliefs.
    base = Math.min(...critical.map((e) => beliefOf(e.from)));
  } else if (supporting.length > 0) {
    base = supporting.reduce((s, e) => s + beliefOf(e.from), 0) / supporting.length;
  } else {
    // No modeled prerequisites: approachable novelty near the 80/20 prior.
    base = 0.75;
  }

  if (supporting.length > 0 && critical.length > 0) {
    const supportAvg =
      supporting.reduce((s, e) => s + beliefOf(e.from), 0) / supporting.length;
    base = 0.75 * base + 0.25 * supportAvg;
  }

  if (optional.length > 0) {
    const optAvg = optional.reduce((s, e) => s + beliefOf(e.from), 0) / optional.length;
    base = 0.9 * base + 0.1 * optAvg;
  }

  const assistanceLift: Record<string, number> = {
    independent: 0,
    one_hint: 0.08,
    splice: 0.14,
    worked_example_transition: 0.2,
    review: 0.1,
  };

  return Math.min(0.99, Math.max(0.01, base + (assistanceLift[assistance] ?? 0)));
}
