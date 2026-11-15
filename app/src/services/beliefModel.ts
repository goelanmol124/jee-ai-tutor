import { CONCEPTS, MASTERY_THRESHOLD, type ConceptId } from '../data/concepts';
import type { BeliefUpdate, SessionResult } from '../domain/types';

export interface StudentBeliefSnapshot {
  beliefs: Record<ConceptId, number>;
  studentProfileText: string;
  sillyMistakePatterns: string[];
}

const VALID_CONCEPT_IDS = new Set(CONCEPTS.map((c) => c.id));

export function clampBelief(value: number): number {
  return Math.max(0.02, Math.min(0.99, value));
}

/**
 * Apply model-returned deltas; unknown concept ids are ignored.
 */
export function applyBeliefUpdates(
  beliefs: Record<ConceptId, number>,
  updates: BeliefUpdate[],
): Record<ConceptId, number> {
  const next = { ...beliefs };
  for (const u of updates) {
    if (!VALID_CONCEPT_IDS.has(u.conceptId)) continue;
    const prev = next[u.conceptId] ?? 0.05;
    next[u.conceptId] = clampBelief(prev + u.delta);
  }
  return next;
}

/**
 * Merge session recap into beliefs, silly-mistake list, and rolling profile text.
 * Matches prior App.tsx behaviour: prefer beliefUpdates; else bump confirmed / closedGaps.
 */
export function applySessionAfterDiagnosis(
  prev: StudentBeliefSnapshot,
  result: SessionResult,
): StudentBeliefSnapshot {
  let beliefs = { ...prev.beliefs };

  const updates = result.diagnosis?.beliefUpdates ?? [];
  if (updates.length > 0) {
    beliefs = applyBeliefUpdates(beliefs, updates);
  } else {
    for (const c of result.confirmed) {
      if (!VALID_CONCEPT_IDS.has(c)) continue;
      beliefs[c] = Math.min(0.99, (beliefs[c] ?? 0.05) + 0.18);
    }
    for (const c of result.closedGaps) {
      if (!VALID_CONCEPT_IDS.has(c)) continue;
      beliefs[c] = Math.max(beliefs[c] ?? 0.5, MASTERY_THRESHOLD + 0.05);
    }
  }

  const sillyMistakePatterns = Array.from(
    new Set([...prev.sillyMistakePatterns, ...result.caughtSlips, ...(result.diagnosis?.sillyMistakeTags ?? [])]),
  );

  const diagnosis = result.diagnosis;
  const profileSuffix = diagnosis
    ? ` Latest attempt: ${diagnosis.mistakeType.replaceAll('_', ' ')}; ${diagnosis.cards[0]?.body ?? 'diagnosed attempt.'}`
    : '';

  const studentProfileText = `${prev.studentProfileText}${profileSuffix}`.slice(-900);

  return {
    beliefs,
    sillyMistakePatterns,
    studentProfileText,
  };
}
