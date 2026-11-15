import { describe, expect, it } from 'vitest';
import type { GraphData } from '../../src/domain/types';
import { defaultUnifiedState } from '../tutorStore';
import { proposePickerCandidates } from './ruleLayer';

function tinyGraph(): GraphData {
  return {
    chapters: [
      { id: 'ch-a', title: 'Chapter A', subject: 'math' },
      { id: 'ch-b', title: 'Chapter B', subject: 'math' },
    ],
    concepts: [
      {
        id: 'c-a1',
        name: 'Concept A1',
        chapterId: 'ch-a',
        subject: 'math',
        prereqIds: [],
        centrality: 1,
      },
      {
        id: 'c-b1',
        name: 'Concept B1',
        chapterId: 'ch-b',
        subject: 'math',
        prereqIds: [],
        centrality: 1,
      },
    ],
    edges: [],
    questions: [
      {
        id: 'q-a1',
        source: 'test',
        prompt: 'Solve',
        subject: 'math',
        chapterId: 'ch-a',
        conceptIds: ['c-a1'],
        prereqIds: [],
        canonicalSteps: [],
        difficulty: 2,
        mode: 'diagnose',
        examFeel: 2,
      },
    ],
  };
}

describe('proposePickerCandidates', () => {
  it('surfaces cross-chapter due recalls when mixed practice is enabled and budget allows', () => {
    const graph = tinyGraph();
    const state = defaultUnifiedState('student_test');
    state.sessionMode = 'mixed_practice';
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'untested',
      belief: 0.35,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };
    /** Due concept lives in another chapter */
    state.reviewSchedules = {
      'c-b1': { intervalDays: 5, ease: 2.5, dueAt: '2000-01-01T00:00:00.000Z', lapses: 0 },
    };

    const cands = proposePickerCandidates(graph, 'ch-a', state, {
      nowIso: '2026-05-01T00:00:00.000Z',
      allowCrossChapterDue: true,
      reviewBudget: {
        sessionItemCount: 10,
        reviewItemsUsed: 0,
        deferredReviewConceptIds: [],
      },
    });

    expect(cands[0]?.id).toBe('due_review_cross_chapter');
    expect(cands[0]?.targetConceptId).toBe('c-b1');
  });

  it('returns up to three distinct rationales for local chapter picks', () => {
    const graph = tinyGraph();
    const state = defaultUnifiedState('student_test');

    const cands = proposePickerCandidates(graph, 'ch-a', state, { nowIso: '2026-05-01T00:00:00.000Z' });
    expect(cands.length).toBeGreaterThanOrEqual(1);
    expect(cands.length).toBeLessThanOrEqual(3);
    for (const c of cands) {
      expect(c.rationale?.length ?? 0).toBeGreaterThan(5);
    }
  });

  it('skips gauge_untested bias when every chapter concept is self-marked beyond not_seen', () => {
    const graph = tinyGraph();
    const state = defaultUnifiedState('student_test');
    state.concepts['c-a1'] = {
      conceptId: 'c-a1',
      observed: 'untested',
      selfReport: 'seen',
      belief: 0.42,
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };

    const cands = proposePickerCandidates(graph, 'ch-a', state, { nowIso: '2026-05-01T00:00:00.000Z' });

    expect(cands.some((c) => c.id === 'gauge_untested')).toBe(false);
    expect(cands.some((c) => c.id === 'jee_question')).toBe(true);
  });
});
