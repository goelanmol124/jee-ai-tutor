import { describe, expect, it } from 'vitest';
import type { GraphData } from '../../src/domain/types';
import { defaultUnifiedState } from '../tutorStore';
import {
  canHardGate,
  evaluateCriticalPrerequisiteGate,
  predictSuccessAtAssistance,
  provenanceAllowsHardGate,
  resolvePrereqEdges,
} from './prerequisites';
import type { AnnotatedPrereqEdge } from './types';

function graphWithPrereq(): GraphData {
  return {
    chapters: [{ id: 'ch', title: 'Ch', subject: 'math' }],
    concepts: [
      {
        id: 'prereq',
        name: 'Prereq',
        chapterId: 'ch',
        subject: 'math',
        prereqIds: [],
        centrality: 0.9,
      },
      {
        id: 'target',
        name: 'Target',
        chapterId: 'ch',
        subject: 'math',
        prereqIds: ['prereq'],
        centrality: 0.5,
      },
    ],
    edges: [{ from: 'prereq', to: 'target', kind: 'prereq', weight: 1 }],
    questions: [
      {
        id: 'q1',
        source: 'test',
        prompt: 'Q',
        subject: 'math',
        chapterId: 'ch',
        conceptIds: ['target'],
        prereqIds: ['prereq'],
        canonicalSteps: [{ id: 's1', text: 'step', conceptIds: ['target'] }],
        difficulty: 2,
        mode: 'diagnose',
        examFeel: 2,
      },
    ],
  };
}

describe('prerequisite provenance gating', () => {
  it('allows hard gates only for maker/expert/empirical provenance', () => {
    expect(provenanceAllowsHardGate('maker_approved')).toBe(true);
    expect(provenanceAllowsHardGate('expert_reviewed')).toBe(true);
    expect(provenanceAllowsHardGate('empirically_validated')).toBe(true);
    expect(provenanceAllowsHardGate('llm_proposed')).toBe(false);
    expect(provenanceAllowsHardGate('co_occurrence_only')).toBe(false);
    expect(provenanceAllowsHardGate('unknown')).toBe(false);
  });

  it('never hard-gates llm or co-occurrence edges even if marked critical', () => {
    const llm: AnnotatedPrereqEdge = {
      from: 'a',
      to: 'b',
      edgeClass: 'critical',
      provenance: 'llm_proposed',
    };
    const co: AnnotatedPrereqEdge = {
      from: 'a',
      to: 'b',
      edgeClass: 'critical',
      provenance: 'co_occurrence_only',
    };
    expect(canHardGate(llm)).toBe(false);
    expect(canHardGate(co)).toBe(false);
  });

  it('hard-blocks only critical maker-approved edges with absent evidence', () => {
    const state = defaultUnifiedState('s');
    state.concepts['prereq'] = {
      conceptId: 'prereq',
      observed: 'failed',
      belief: 0.05,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };

    const softOnly = evaluateCriticalPrerequisiteGate(state, [
      {
        from: 'prereq',
        to: 'target',
        edgeClass: 'critical',
        provenance: 'llm_proposed',
      },
    ]);
    expect(softOnly.blocked).toBe(false);

    const hard = evaluateCriticalPrerequisiteGate(state, [
      {
        from: 'prereq',
        to: 'target',
        edgeClass: 'critical',
        provenance: 'maker_approved',
      },
    ]);
    expect(hard.blocked).toBe(true);
    expect(hard.hardBlockingPrereqIds).toContain('prereq');
  });

  it('does not hard-block supporting or optional classes', () => {
    const state = defaultUnifiedState('s');
    state.concepts['prereq'] = {
      conceptId: 'prereq',
      observed: 'failed',
      belief: 0.05,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    for (const edgeClass of ['supporting', 'optional', 'alternative_method'] as const) {
      const result = evaluateCriticalPrerequisiteGate(state, [
        {
          from: 'prereq',
          to: 'target',
          edgeClass,
          provenance: 'expert_reviewed',
        },
      ]);
      expect(result.blocked).toBe(false);
    }
  });

  it('resolves unannotated graph prereqs as soft (unknown provenance)', () => {
    const edges = resolvePrereqEdges(graphWithPrereq(), []);
    const prereqEdge = edges.find((e) => e.from === 'prereq' && e.to === 'target');
    expect(prereqEdge?.edgeClass).toBe('supporting');
    expect(prereqEdge?.provenance).toBe('unknown');
    expect(canHardGate(prereqEdge!)).toBe(false);
  });

  it('predicts success from beliefs at assistance level, not prereq counts', () => {
    const state = defaultUnifiedState('s');
    state.concepts['prereq'] = {
      conceptId: 'prereq',
      observed: 'applied_correctly',
      belief: 0.85,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    const edges: AnnotatedPrereqEdge[] = [
      {
        from: 'prereq',
        to: 'target',
        edgeClass: 'critical',
        provenance: 'maker_approved',
      },
    ];
    const independent = predictSuccessAtAssistance(state, edges, 'independent');
    const scaffolded = predictSuccessAtAssistance(state, edges, 'worked_example_transition');
    expect(scaffolded).toBeGreaterThan(independent);
    expect(independent).toBeGreaterThan(0.7);
  });
});
