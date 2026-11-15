import { describe, expect, it } from 'vitest';
import { SAMPLE_GRAPH } from './sampleGraph';
import { pickInitialQuestion } from '../services/questionPicker';

const conceptIds = new Set(SAMPLE_GRAPH.concepts.map((c) => c.id));
const chapterIds = new Set(SAMPLE_GRAPH.chapters.map((c) => c.id));

describe('sample graph integrity', () => {
  it('covers physics, chemistry and maths', () => {
    const subjects = new Set(SAMPLE_GRAPH.questions.map((q) => q.subject));
    expect([...subjects].sort()).toEqual(['chemistry', 'math', 'physics']);
  });

  it('references only known chapters and concepts', () => {
    for (const concept of SAMPLE_GRAPH.concepts) {
      expect(chapterIds.has(concept.chapterId), concept.id).toBe(true);
      for (const prereq of concept.prereqIds) expect(conceptIds.has(prereq), `${concept.id} → ${prereq}`).toBe(true);
    }
    for (const question of SAMPLE_GRAPH.questions) {
      expect(chapterIds.has(question.chapterId), question.id).toBe(true);
      for (const id of [...question.conceptIds, ...question.prereqIds]) expect(conceptIds.has(id), `${question.id}: ${id}`).toBe(true);
      for (const step of question.canonicalSteps) {
        for (const id of step.conceptIds) expect(conceptIds.has(id), `${step.id}: ${id}`).toBe(true);
      }
    }
  });

  it('has an acyclic prerequisite graph', () => {
    const prereqs = new Map(SAMPLE_GRAPH.concepts.map((c) => [c.id, c.prereqIds]));
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string): void => {
      if (state.get(id) === 'done') return;
      expect(state.get(id), `cycle through ${id}`).not.toBe('visiting');
      state.set(id, 'visiting');
      for (const p of prereqs.get(id) ?? []) visit(p);
      state.set(id, 'done');
    };
    for (const id of prereqs.keys()) visit(id);
  });

  it('gives every question checkable steps and a well-formed answer', () => {
    const ids = new Set<string>();
    for (const question of SAMPLE_GRAPH.questions) {
      expect(ids.has(question.id)).toBe(false);
      ids.add(question.id);
      expect(question.source).toMatch(/original sample/);
      expect(question.canonicalSteps.length).toBeGreaterThan(0);
      expect(question.answerChecks?.length, question.id).toBeGreaterThan(0);
      for (const step of question.canonicalSteps) expect(step.checks?.length, step.id).toBeGreaterThan(0);
      if (question.options) {
        expect(question.answerIndex, question.id).toBeGreaterThanOrEqual(0);
        expect(question.answerIndex!).toBeLessThan(question.options.length);
        expect(question.finalAnswer).toContain(`option ${question.answerIndex! + 1}`);
      }
    }
  });

  it('lets the 80/20 picker choose a question from the sample bank', () => {
    const chapters = SAMPLE_GRAPH.chapters.map((c) => c.id);
    const picked = pickInitialQuestion(SAMPLE_GRAPH, chapters, {});
    expect(picked).toBeDefined();
    expect(SAMPLE_GRAPH.questions.some((q) => q.id === picked!.id)).toBe(true);
  });
});
