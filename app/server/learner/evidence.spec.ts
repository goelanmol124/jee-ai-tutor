import { describe, expect, it } from 'vitest';
import {
  confirmProposal,
  evidenceCountsTowardMastery,
  hasConfirmedMasteryEvidence,
  proposeFromPhoto,
  reverseProposal,
  sanitizeEvidenceForConceptUpdate,
} from './evidence';
import type { LearnerEvidenceEvent } from './types';

describe('photo evidence and reversible state proposals', () => {
  it('never turns photo capture failure into concept-failure evidence', () => {
    const result = proposeFromPhoto({
      conceptId: 'c1',
      photoId: 'p1',
      captureFailed: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('photo_capture_failure_not_concept_evidence');
      expect(sanitizeEvidenceForConceptUpdate(result.event!)).toBeNull();
    }
  });

  it('one photo cannot establish mastery or a persistent misconception', () => {
    const mastery = proposeFromPhoto({
      conceptId: 'c1',
      photoId: 'p1',
      kind: 'mastery_hypothesis',
      diagnosisConfident: true,
    });
    expect(mastery.ok).toBe(true);
    if (mastery.ok) {
      expect(mastery.proposal.status).toBe('needs_confirmation');
      expect(mastery.proposal.reversible).toBe(true);
      expect(mastery.proposal.kind).toBe('mastery_hypothesis');
    }

    const misconception = proposeFromPhoto({
      conceptId: 'c1',
      photoId: 'p2',
      kind: 'misconception_hypothesis',
    });
    expect(misconception.ok).toBe(true);
    if (misconception.ok) {
      expect(misconception.proposal.status).toBe('needs_confirmation');
      expect(misconception.proposal.status).not.toBe('confirmed');
    }
  });

  it('promotes only via confirmation probe or delayed independent transfer', () => {
    const base = proposeFromPhoto({
      conceptId: 'c1',
      photoId: 'p1',
      kind: 'misconception_hypothesis',
    });
    expect(base.ok).toBe(true);
    if (!base.ok) return;

    const bad: LearnerEvidenceEvent = {
      id: 'e_bad',
      conceptId: 'c1',
      at: '2026-07-18T00:00:00.000Z',
      source: 'photo_observation',
      assistance: 'independent',
      outcome: 'success',
    };
    expect(confirmProposal(base.proposal, bad)).toMatchObject({
      error: 'confirmation_requires_probe_or_delayed_transfer',
    });

    const good: LearnerEvidenceEvent = {
      id: 'e_ok',
      conceptId: 'c1',
      at: '2026-07-18T00:00:00.000Z',
      source: 'confirmation_probe',
      assistance: 'independent',
      outcome: 'success',
    };
    const confirmed = confirmProposal(base.proposal, good);
    expect(confirmed).toMatchObject({ status: 'confirmed', reversible: true });

    const reversed = reverseProposal(base.proposal, {
      id: 'e_counter',
      conceptId: 'c1',
      at: '2026-07-19T00:00:00.000Z',
      source: 'delayed_independent_transfer',
      assistance: 'independent',
      outcome: 'success',
      delayed: true,
      transfer: true,
    });
    expect(reversed.status).toBe('reversed');
  });

  it('treats delayed independent transfer as the mastery target', () => {
    const supported: LearnerEvidenceEvent = {
      id: '1',
      conceptId: 'c1',
      at: 't',
      source: 'worked_example',
      assistance: 'worked_example',
      outcome: 'success',
    };
    expect(evidenceCountsTowardMastery(supported)).toBe(false);

    const delayed: LearnerEvidenceEvent = {
      id: '2',
      conceptId: 'c1',
      at: 't',
      source: 'delayed_independent_transfer',
      assistance: 'independent',
      outcome: 'success',
      delayed: true,
      transfer: true,
    };
    expect(evidenceCountsTowardMastery(delayed)).toBe(true);

    const events = [delayed, delayed];
    expect(hasConfirmedMasteryEvidence(events, 'c1', 'normal_prerequisite', 0.85)).toBe(true);
    expect(hasConfirmedMasteryEvidence(events, 'c1', 'critical_high_centrality', 0.95)).toBe(
      false,
    );
  });
});
