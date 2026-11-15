import { describe, expect, it } from 'vitest';
import type { GraphData } from '../../src/domain/types';
import { defaultUnifiedState } from '../tutorStore';
import { runHierarchicalPicker } from './hierarchicalPicker';
import { proposePickerCandidates, proposePickerCandidatesDetailed } from './ruleLayer';

function fixtureGraph(): GraphData {
  return {
    chapters: [
      { id: 'ch-a', title: 'Chapter A', subject: 'math' },
      { id: 'ch-b', title: 'Chapter B', subject: 'math' },
    ],
    concepts: [
      {
        id: 'c-prereq',
        name: 'Prereq',
        chapterId: 'ch-a',
        subject: 'math',
        prereqIds: [],
        centrality: 0.95,
      },
      {
        id: 'c-a1',
        name: 'Concept A1',
        chapterId: 'ch-a',
        subject: 'math',
        prereqIds: ['c-prereq'],
        centrality: 0.5,
      },
      {
        id: 'c-b1',
        name: 'Concept B1',
        chapterId: 'ch-b',
        subject: 'math',
        prereqIds: [],
        centrality: 0.4,
      },
    ],
    edges: [{ from: 'c-prereq', to: 'c-a1', kind: 'prereq', weight: 1 }],
    questions: [
      {
        id: 'q-a1',
        source: 'test',
        prompt: 'Solve',
        subject: 'math',
        chapterId: 'ch-a',
        conceptIds: ['c-a1'],
        prereqIds: ['c-prereq'],
        canonicalSteps: [{ id: 's1', text: 'step', conceptIds: ['c-a1'] }],
        difficulty: 2,
        mode: 'diagnose',
        examFeel: 3,
      },
      {
        id: 'q-review-flagged',
        source: 'test',
        prompt: 'Flagged',
        subject: 'math',
        chapterId: 'ch-a',
        conceptIds: ['c-a1'],
        prereqIds: [],
        canonicalSteps: [],
        difficulty: 1,
        mode: 'diagnose',
        examFeel: 1,
        needsHumanReview: true,
      },
    ],
  };
}

describe('hierarchical picker', () => {
  it('runs eligibility → critical gate → objective → ranking', () => {
    const graph = fixtureGraph();
    const state = defaultUnifiedState('s');
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'untested',
      selfReport: 'seen',
      belief: 0.4,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };
    state.concepts['c-prereq'] = {
      conceptId: 'c-prereq',
      observed: 'applied_correctly',
      selfReport: 'confident',
      belief: 0.85,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };

    const result = runHierarchicalPicker(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'class_12',
    });

    expect(result.policyVersion).toBe('w3_hierarchical_v1');
    expect(result.objective).toBeTruthy();
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.candidates.length).toBeGreaterThanOrEqual(1);
    // Human-review question must not be selected as itemIntent.
    expect(result.candidates.every((c) => c.itemIntent !== 'q-review-flagged')).toBe(true);
  });

  it('forces critical_repair when a maker-approved critical prereq is absent', () => {
    const graph = fixtureGraph();
    const state = defaultUnifiedState('s');
    state.concepts['c-prereq'] = {
      conceptId: 'c-prereq',
      observed: 'failed',
      belief: 0.05,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'untested',
      selfReport: 'seen',
      belief: 0.4,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };

    const result = proposePickerCandidatesDetailed(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'class_12',
      prereqAnnotations: [
        {
          from: 'c-prereq',
          to: 'c-a1',
          edgeClass: 'critical',
          provenance: 'maker_approved',
          highCentrality: true,
        },
      ],
    });

    expect(result.objective).toBe('critical_repair');
    expect(result.blockingPrereqIds).toContain('c-prereq');
    expect(result.candidates[0]?.mode).toMatch(/teach_concept|splice_step/);
  });

  it('does not hard-block on llm-only critical annotations', () => {
    const graph = fixtureGraph();
    const state = defaultUnifiedState('s');
    state.concepts['c-prereq'] = {
      conceptId: 'c-prereq',
      observed: 'failed',
      belief: 0.05,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'untested',
      selfReport: 'seen',
      belief: 0.4,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };

    const result = proposePickerCandidatesDetailed(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'class_12',
      prereqAnnotations: [
        {
          from: 'c-prereq',
          to: 'c-a1',
          edgeClass: 'critical',
          provenance: 'llm_proposed',
        },
      ],
    });

    expect(result.blockingPrereqIds).not.toContain('c-prereq');
    expect(result.objective).not.toBe('critical_repair');
  });

  it('applies cohort-aware defaults (Class 11 orientation vs dropper exam mix)', () => {
    const graph = fixtureGraph();
    const fresh = defaultUnifiedState('s');

    const class11 = runHierarchicalPicker(graph, 'ch-a', structuredClone(fresh), {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'class_11',
    });
    expect(class11.objective).toBe('orientation');

    const dropperState = defaultUnifiedState('s');
    dropperState.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'shaky',
      selfReport: 'seen',
      belief: 0.5,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };
    dropperState.concepts['c-prereq'] = {
      conceptId: 'c-prereq',
      observed: 'applied_correctly',
      selfReport: 'confident',
      belief: 0.8,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    dropperState.consecutiveFullQuestions = 2;

    const dropper = runHierarchicalPicker(graph, 'ch-a', dropperState, {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'dropper',
    });
    expect(['exam_integration', 'discrimination', 'independent_application', 'critical_repair']).toContain(
      dropper.objective,
    );
  });

  it('defers due reviews when the 20% budget is exhausted (penalty-free)', () => {
    const graph = fixtureGraph();
    const state = defaultUnifiedState('s');
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'applied_correctly',
      selfReport: 'confident',
      belief: 0.8,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    state.concepts['c-prereq'] = {
      conceptId: 'c-prereq',
      observed: 'applied_correctly',
      selfReport: 'confident',
      belief: 0.85,
      confidence: 'high',
      recentEvidence: [],
      mistakePatterns: [],
    };
    state.reviewSchedules = {
      'c-a1': {
        intervalDays: 3,
        ease: 2.5,
        dueAt: '2026-07-01T00:00:00.000Z',
        lapses: 0,
      },
    };

    const result = runHierarchicalPicker(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
      cohort: 'class_12',
      reviewBudget: {
        sessionItemCount: 10,
        reviewItemsUsed: 2,
        deferredReviewConceptIds: [],
      },
    });

    expect(result.objective).not.toBe('due_review');
    expect(result.deferredReviews).toContain('c-a1');
    expect(state.reviewSchedules?.['c-a1']?.lapses).toBe(0);
  });

  it('keeps proposePickerCandidates adapter compatible', () => {
    const graph = fixtureGraph();
    const state = defaultUnifiedState('s');
    const cands = proposePickerCandidates(graph, 'ch-a', state, {
      nowIso: '2026-07-18T00:00:00.000Z',
    });
    expect(cands.length).toBeGreaterThanOrEqual(1);
    expect(cands.length).toBeLessThanOrEqual(3);
    for (const c of cands) {
      expect(c.mode).toBeTruthy();
      expect(c.targetConceptId).toBeTruthy();
      expect(c.rationale.length).toBeGreaterThan(5);
    }
  });
});
