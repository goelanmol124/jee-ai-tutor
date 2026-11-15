import { describe, expect, it } from 'vitest';
import { validateTutorTurn } from './validateTutorTurn';

describe('validateTutorTurn', () => {
  it('accepts minimal valid tutor JSON', () => {
    const parsed = validateTutorTurn({
      chosenCandidateId: 'custom',
      customCandidate: {
        mode: 'gauge_probe',
        targetConcept: 'c1',
        itemIntent: 'warm',
      },
      mode: 'gauge_probe',
      coachMessage: 'Quick check — what jumps out?',
      metaNarration: 'Sizing you up gently before heavier work.',
      item: { kind: 'probe', prompt: 'Say one formula you recognise here.' },
      stateUpdates: [],
      endsTurn: true,
    });
    expect(parsed.ok).toBe(true);
  });

  it('rejects missing mode', () => {
    const parsed = validateTutorTurn({
      chosenCandidateId: 'x',
      coachMessage: 'hi',
      stateUpdates: [],
      endsTurn: true,
    });
    expect(parsed.ok).toBe(false);
  });

  it('defaults missing stateUpdates and endsTurn when Grok omits them', () => {
    const parsed = validateTutorTurn({
      chosenCandidateId: 'jee_question',
      mode: 'present_question',
      coachMessage: 'Try this.',
    });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.stateUpdates).toEqual([]);
      expect(parsed.value.endsTurn).toBe(true);
    }
  });
});
