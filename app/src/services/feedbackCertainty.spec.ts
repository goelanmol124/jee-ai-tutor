import { describe, expect, it } from 'vitest';
import { certaintyFromDiagnosis, toStudentFacingDiagnosis } from './feedbackCertainty';
import type { DiagnosisResult } from '../domain/types';

function base(over: Partial<DiagnosisResult> = {}): DiagnosisResult {
  return {
    verdict: 'needs_work',
    mistakeType: 'conceptual_gap',
    conceptsPositive: [],
    conceptsNegative: ['c1'],
    sillyMistakeTags: [],
    confidence: 0.9,
    recommendedTool: 'micro_lesson',
    attemptTrace: [{
      id: 's1',
      raw: 'dy/dx = cos(2x)',
      status: 'broken',
      conceptIds: ['c1'],
      note: 'Missing chain-rule factor',
      confidence: 0.8,
    }],
    conceptEvidence: [{
      conceptId: 'c1',
      outcome: 'missing',
      confidence: 0.8,
      reason: 'Chain rule factor absent',
    }],
    cards: [],
    beliefUpdates: [],
    needsClarification: false,
    coachMessage: 'You dropped the factor of 2.',
    ...over,
  };
}

describe('feedbackCertainty', () => {
  it('marks unclear / clarification as uncertain', () => {
    expect(certaintyFromDiagnosis(base({ verdict: 'unclear', needsClarification: true }))).toBe('uncertain');
  });

  it('marks partially_correct as tentative', () => {
    expect(certaintyFromDiagnosis(base({ verdict: 'partially_correct' }))).toBe('tentative');
  });

  it('marks evidence-backed clear verdicts definitive', () => {
    expect(certaintyFromDiagnosis(base({ verdict: 'needs_work' }))).toBe('definitive');
  });

  it('never exposes raw confidence as mastery in student-facing payload', () => {
    const facing = toStudentFacingDiagnosis(base(), 'diag_1');
    expect(facing.diagnosisId).toBe('diag_1');
    expect(facing.evidenceAnchors.length).toBeGreaterThan(0);
    expect(JSON.stringify(facing)).not.toMatch(/"belief"|mastery|rank/i);
    expect(facing.certainty).toBe('definitive');
  });
});
