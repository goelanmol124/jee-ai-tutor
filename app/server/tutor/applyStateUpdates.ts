import { createHash } from 'node:crypto';
import type { TutorReviewSchedule, TutorStateUpdate, UnifiedMistakePattern, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import { deriveBeliefFromLayers } from './beliefDerive';
import { ensureConcept } from '../tutorStore';

export interface ApplyStateUpdateOpts {
  sliceConceptIds: Set<string>;
  taughtConceptIds: Set<string>;
  nowIso: string;
}

export function canonicalMistakeKey(category: string, specificInstance: string): string {
  return `${category}::${specificInstance.trim().toLowerCase()}`;
}

export function mistakePatternStableId(studentId: string, conceptId: string, canonicalKey: string): string {
  return createHash('sha256').update(`${studentId}|${conceptId}|${canonicalKey}`).digest('hex').slice(0, 16);
}

function sm2next(prev: TutorReviewSchedule | undefined, outcome: 'success' | 'fail'): TutorReviewSchedule {
  const ease = prev?.ease ?? 2.5;
  const lapses = prev?.lapses ?? 0;
  let interval = prev?.intervalDays ?? 1;
  let nextEase = ease;

  if (outcome === 'success') {
    interval = Math.max(1, interval * nextEase);
    nextEase = Math.min(3.0, ease + 0.05);
    return {
      intervalDays: interval,
      ease: nextEase,
      dueAt: addDays(new Date(), interval).toISOString(),
      lapses,
    };
  }

  return {
    intervalDays: 1,
    ease: Math.max(1.8, ease - 0.2),
    dueAt: addDays(new Date(), 1).toISOString(),
    lapses: lapses + 1,
  };
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + Math.round(days));
  return x;
}

function bumpMistake(
  state: UnifiedTutorStudentState,
  conceptId: string,
  row: Partial<UnifiedMistakePattern> & { id?: string },
) {
  ensureConcept(state, conceptId);
  const list = state.concepts[conceptId].mistakePatterns;
  let found = row.id ? list.find((m) => m.id === row.id) : undefined;
  const now = row.lastSeen ?? new Date().toISOString();
  if (!found && row.id) {
    const full: UnifiedMistakePattern = {
      id: row.id,
      category: row.category ?? 'formula_application',
      firstSeen: row.firstSeen ?? now,
      lastSeen: now,
      occurrences: row.occurrences ?? 1,
      recoveredViaProbe: row.recoveredViaProbe,
      specificInstance: row.specificInstance,
      surfaceForms: row.surfaceForms,
    };
    list.push(full);
    found = full;
  } else if (found) {
    found.occurrences += 1;
    found.lastSeen = now;
    if (row.recoveredViaProbe !== undefined) found.recoveredViaProbe = row.recoveredViaProbe;
  }

  const gfound = row.id ? state.globalMistakePatterns.find((m) => m.id === row.id) : undefined;
  if (!gfound && row.id && found) {
    state.globalMistakePatterns.push({ ...found });
  } else if (gfound) {
    gfound.occurrences += 1;
    gfound.lastSeen = now;
  }
}

export interface ApplyUpdatesResult {
  applied: TutorStateUpdate[];
  dropped: Array<{ update: TutorStateUpdate; reason: string }>;
}

function inScope(cid: string, opts: ApplyStateUpdateOpts): boolean {
  return opts.sliceConceptIds.has(cid) || opts.taughtConceptIds.has(cid);
}

export function filterAndApplyStateUpdates(
  state: UnifiedTutorStudentState,
  updates: TutorStateUpdate[],
  opts: ApplyStateUpdateOpts,
): ApplyUpdatesResult {
  const applied: TutorStateUpdate[] = [];
  const dropped: ApplyUpdatesResult['dropped'] = [];
  /** Pre-scan so concept_observed can downgrade even if ordering varies */
  const mistakeFormulaAppByConcept = new Set<string>();
  for (const u of updates) {
    if (u.kind === 'mistake_observed' && u.candidate.category === 'formula_application') {
      mistakeFormulaAppByConcept.add(u.conceptId);
    }
  }

  for (const u of updates) {
    if (!u || typeof u !== 'object') continue;

    if (u.kind === 'concept_observed') {
      if (!inScope(u.conceptId, opts)) {
        dropped.push({ update: u, reason: 'out_of_scope' });
        continue;
      }
      let observed = u.observed;
      if (mistakeFormulaAppByConcept.has(u.conceptId) && observed === 'applied_correctly') {
        observed = 'shaky';
      }
      const ck = ensureConcept(state, u.conceptId);
      ck.observed = observed;
      if (u.formulaQuoting !== undefined) ck.formulaQuoting = u.formulaQuoting;
      if (u.formulaUnderstanding !== undefined) ck.formulaUnderstanding = u.formulaUnderstanding;
      if (u.applicationFlexibility !== undefined) ck.applicationFlexibility = u.applicationFlexibility;
      if (u.confidence !== undefined) ck.confidence = u.confidence;
      ck.recentEvidence.push({ ...u.evidence, at: opts.nowIso });
      if (ck.recentEvidence.length > 30) ck.recentEvidence.splice(0, ck.recentEvidence.length - 30);
      ck.belief = deriveBeliefFromLayers(ck);
      state.reviewSchedules = state.reviewSchedules ?? {};
      const schedOutcome: 'success' | 'fail' = observed === 'applied_correctly' ? 'success' : 'fail';
      state.reviewSchedules[u.conceptId] = sm2next(state.reviewSchedules[u.conceptId], schedOutcome);
      ck.nextReviewAt = state.reviewSchedules[u.conceptId].dueAt;
      applied.push({ ...u, observed });
      continue;
    }

    if (u.kind === 'mistake_observed') {
      if (!inScope(u.conceptId, opts)) {
        dropped.push({ update: u, reason: 'out_of_scope' });
        continue;
      }
      const key = canonicalMistakeKey(u.candidate.category, u.candidate.specificInstance);
      const id = mistakePatternStableId(state.studentId, u.conceptId, key);
      const nowIso = opts.nowIso;
      bumpMistake(state, u.conceptId, {
        id,
        category: u.candidate.category,
        firstSeen: nowIso,
        lastSeen: nowIso,
        occurrences: 1,
        recoveredViaProbe: u.recoveredViaProbe,
        specificInstance: u.candidate.specificInstance,
        surfaceForms: [u.candidate.surfaceForm],
      });
      applied.push(u);
      state.reviewSchedules = state.reviewSchedules ?? {};
      state.reviewSchedules[u.conceptId] = sm2next(state.reviewSchedules[u.conceptId], 'fail');
      state.mistakePatternSchedules = state.mistakePatternSchedules ?? {};
      state.mistakePatternSchedules[id] = {
        intervalDays: 2,
        ease: 2.5,
        dueAt: addDays(new Date(), 2).toISOString(),
        lapses: (state.mistakePatternSchedules[id]?.lapses ?? 0) + 1,
      };
      continue;
    }

    if (u.kind === 'coverage_advance') {
      if (!inScope(u.conceptId, opts)) {
        dropped.push({ update: u, reason: 'out_of_scope' });
        continue;
      }
      for (const session of Object.values(state.chapterSessions)) {
        const row = session.conceptCoverage.find((c) => c.conceptId === u.conceptId);
        if (row) {
          row.state = u.to;
          row.lastTouchedAt = opts.nowIso;
        }
      }
      applied.push(u);
      continue;
    }

    if (u.kind === 'park_question') {
      for (const session of Object.values(state.chapterSessions)) {
        session.parkedItems.push({
          questionRef: u.questionRef,
          parkedAt: opts.nowIso,
          reason: u.reason,
          chapterId: u.chapterId,
        });
      }
      applied.push(u);
      continue;
    }

    if (u.kind === 'schedule_review') {
      if (!inScope(u.conceptId, opts)) {
        dropped.push({ update: u, reason: 'out_of_scope' });
        continue;
      }
      state.reviewSchedules = state.reviewSchedules ?? {};
      state.reviewSchedules[u.conceptId] = sm2next(state.reviewSchedules[u.conceptId], u.outcome);
      applied.push(u);
      continue;
    }

    dropped.push({ update: u, reason: 'unknown_kind' });
  }

  return { applied, dropped };
}
