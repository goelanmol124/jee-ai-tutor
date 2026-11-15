import { describe, expect, it } from 'vitest';
import { SAMPLE_GRAPH } from '../data/sampleGraph';
import type { QuestionNode } from '../domain/types';
import { diagnoseOffline, normalizeWork } from './offlineDiagnosis';

function q(id: string): QuestionNode {
  const found = SAMPLE_GRAPH.questions.find((question) => question.id === id);
  if (!found) throw new Error(`missing ${id}`);
  return found;
}

/** A typed solution built from the first accepted alternative of every step. */
function referenceWork(question: QuestionNode): string {
  const lines = question.canonicalSteps.map((step) => step.checks![0].split('&&').join(' '));
  lines.push(`answer ${question.answerChecks![0]}`);
  return lines.join('\n');
}

describe('normalizeWork', () => {
  it('folds unicode, LaTeX and spacing', () => {
    expect(normalizeWork(String.raw`α + β = 5`)).toBe('a+b=5');
    expect(normalizeWork(String.raw`\frac{5}{36}`)).toBe('5/36');
    expect(normalizeWork('3(x² + 1)² · 2x')).toBe('3(x^2+1)^2*2x');
    expect(normalizeWork('sin(π/2) = 1')).toBe('sin(pi/2)=1');
  });
});

describe('diagnoseOffline', () => {
  it('accepts the reference solution of every sample question', () => {
    for (const question of SAMPLE_GRAPH.questions) {
      const result = diagnoseOffline({
        question,
        typedWork: referenceWork(question),
        selectedIndex: question.answerIndex,
        graph: SAMPLE_GRAPH,
      });
      expect(result.verdict, question.id).toBe('correct');
      expect(result.nextMove).toBe('next_question');
    }
  });

  it('pinpoints the chain-rule gap as the first causal break', () => {
    const question = q('sample_m_diff_1');
    const result = diagnoseOffline({
      question,
      typedWork: 'dy/dx = 2x sin(2x) + x^2 cos(2x)\nat x = pi/4 this is pi/2',
      graph: SAMPLE_GRAPH,
    });
    expect(result.verdict).toBe('needs_work');
    expect(result.mistakeType).toBe('conceptual_gap');
    expect(result.conceptsNegative).toEqual(['m_chain_rule']);
    expect(result.conceptsPositive).toContain('m_product_rule');
    const broken = result.attemptTrace.filter((t) => t.status === 'broken');
    expect(broken).toHaveLength(1);
    expect(broken[0].canonicalStepId).toBe('sample_m_diff_1_step_2');
    expect(result.quickCheck?.options.filter((o) => o.correct)).toHaveLength(1);
  });

  it('separates a misunderstanding from a slip', () => {
    const misunderstanding = diagnoseOffline({
      question: q('sample_m_prob_1'),
      typedWork: 'total = 36\nsum 8: (2,6) (3,5) (4,4) so 3/36',
      graph: SAMPLE_GRAPH,
    });
    expect(misunderstanding.mistakeType).toBe('wrong_understanding');

    const slip = diagnoseOffline({
      question: q('sample_p_kin_1'),
      typedWork: 'v = 0 at top\n0 = 400 - 20h\nh = 25 m',
      selectedIndex: 2,
      graph: SAMPLE_GRAPH,
    });
    expect(slip.verdict).toBe('partially_correct');
    expect(slip.mistakeType).toBe('silly_mistake');
  });

  it('flags every authored trap at its own step', () => {
    for (const question of SAMPLE_GRAPH.questions) {
      question.canonicalSteps.forEach((step, index) => {
        for (const trap of step.traps ?? []) {
          const before = question.canonicalSteps.slice(0, index).map((s) => s.checks![0].split('&&').join(' '));
          const result = diagnoseOffline({
            question,
            typedWork: [...before, trap.checks[0].split('&&').join(' ')].join('\n'),
            graph: SAMPLE_GRAPH,
          });
          const label = `${step.id} trap ${trap.checks[0]}`;
          expect(result.mistakeType, label).toBe(trap.mistakeType);
          expect(result.attemptTrace[index].status, label).toBe('broken');
        }
      });
    }
  });

  it('never leaks the final answer in coach text for wrong work', () => {
    for (const question of SAMPLE_GRAPH.questions) {
      for (const step of question.canonicalSteps) {
        for (const trap of step.traps ?? []) {
          const result = diagnoseOffline({ question, typedWork: trap.checks[0], graph: SAMPLE_GRAPH });
          const visible = normalizeWork([result.coachMessage ?? '', ...result.cards.map((c) => c.body), result.firstProblemStep ?? ''].join(' '));
          for (const answer of question.answerChecks ?? []) {
            const a = normalizeWork(answer);
            if (a.length >= 3) expect(visible.includes(a), `${question.id} leaks ${a}`).toBe(false);
          }
        }
      }
    }
  });

  it('asks for evidence instead of guessing', () => {
    const question = q('sample_c_mole_1');
    expect(diagnoseOffline({ question, typedWork: '' }).nextMove).toBe('clarify');
    expect(diagnoseOffline({ question, typedWork: '', hasImage: true }).needsClarification).toBe(true);
    expect(diagnoseOffline({ question, typedWork: 'hmm not sure' }).verdict).toBe('unclear');
  });
});
