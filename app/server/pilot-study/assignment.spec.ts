import { describe, expect, it } from 'vitest';
import {
  assignStratifiedDelayedStart,
  hasProductAccessAtWeek,
} from './assignment';
import type { EligibleStudent, PilotStratum } from './types';

function makeCohort(n: number): EligibleStudent[] {
  const strata: PilotStratum[] = ['class_11', 'class_12', 'dropper'];
  const students: EligibleStudent[] = [];
  for (let i = 0; i < n; i++) {
    students.push({
      studentId: `s${String(i).padStart(2, '0')}`,
      stratum: strata[i % 3]!,
      baselineScore: 40 + (i % 10) * 3 + Math.floor(i / 3),
    });
  }
  return students;
}

describe('assignStratifiedDelayedStart', () => {
  it('is deterministic for the same seed', () => {
    const cohort = makeCohort(30);
    const a = assignStratifiedDelayedStart(cohort, {
      seed: 'pilot-seed-1',
      randomizedAt: '2026-07-01T00:00:00.000Z',
    });
    const b = assignStratifiedDelayedStart(cohort, {
      seed: 'pilot-seed-1',
      randomizedAt: '2026-07-01T00:00:00.000Z',
    });
    expect(a.assignments).toEqual(b.assignments);
    expect(a.nRandomized).toBe(30);
  });

  it('changes with a different seed', () => {
    const cohort = makeCohort(30);
    const a = assignStratifiedDelayedStart(cohort, { seed: 'seed-a' });
    const b = assignStratifiedDelayedStart(cohort, { seed: 'seed-b' });
    const armsA = a.assignments.map((x) => x.arm).join('');
    const armsB = b.assignments.map((x) => x.arm).join('');
    expect(armsA).not.toEqual(armsB);
  });

  it('forms baseline blocks and balances arms within pairs', () => {
    const cohort = makeCohort(24);
    const result = assignStratifiedDelayedStart(cohort, { seed: 'blocks' });
    const byBlock = new Map<string, typeof result.assignments>();
    for (const rec of result.assignments) {
      if (rec.allocationBlockId.endsWith('_singleton')) continue;
      const list = byBlock.get(rec.allocationBlockId) ?? [];
      list.push(rec);
      byBlock.set(rec.allocationBlockId, list);
    }
    for (const [, members] of byBlock) {
      expect(members).toHaveLength(2);
      const arms = new Set(members.map((m) => m.arm));
      expect(arms.size).toBe(2);
      const scores = members.map((m) => m.baselineScore).sort((x, y) => x - y);
      // Adjacent after within-stratum sort: close in ordered list.
      expect(scores[1]! - scores[0]!).toBeLessThan(50);
    }
  });

  it('stratifies across class_11, class_12, and dropper', () => {
    const result = assignStratifiedDelayedStart(makeCohort(30), { seed: 'strata' });
    expect(result.stratumCounts.class_11.total).toBeGreaterThan(0);
    expect(result.stratumCounts.class_12.total).toBeGreaterThan(0);
    expect(result.stratumCounts.dropper.total).toBeGreaterThan(0);
    for (const stratum of ['class_11', 'class_12', 'dropper'] as const) {
      const c = result.stratumCounts[stratum];
      expect(c.early + c.delayed).toBe(c.total);
    }
  });

  it('warns when n is outside 24–36', () => {
    const small = assignStratifiedDelayedStart(makeCohort(12), { seed: 'small' });
    expect(small.warnings.some((w) => w.includes('below'))).toBe(true);
    const large = assignStratifiedDelayedStart(makeCohort(40), { seed: 'large' });
    expect(large.warnings.some((w) => w.includes('above'))).toBe(true);
  });

  it('assigns connected groups the same arm', () => {
    const students: EligibleStudent[] = [
      { studentId: 'a', stratum: 'class_11', baselineScore: 10, connectedGroupId: 'home1' },
      { studentId: 'b', stratum: 'class_11', baselineScore: 11, connectedGroupId: 'home1' },
      { studentId: 'c', stratum: 'class_12', baselineScore: 20 },
      { studentId: 'd', stratum: 'class_12', baselineScore: 21 },
    ];
    // pad to avoid only tiny n noise
    for (let i = 0; i < 20; i++) {
      students.push({
        studentId: `p${i}`,
        stratum: 'dropper',
        baselineScore: 30 + i,
      });
    }
    const result = assignStratifiedDelayedStart(students, { seed: 'connected' });
    const a = result.assignments.find((x) => x.studentId === 'a')!;
    const b = result.assignments.find((x) => x.studentId === 'b')!;
    expect(a.arm).toBe(b.arm);
  });
});

describe('hasProductAccessAtWeek', () => {
  it('encodes early weeks 1–8 and delayed weeks 4–8', () => {
    expect(hasProductAccessAtWeek('early', 1)).toBe(true);
    expect(hasProductAccessAtWeek('early', 8)).toBe(true);
    expect(hasProductAccessAtWeek('delayed', 1)).toBe(false);
    expect(hasProductAccessAtWeek('delayed', 3)).toBe(false);
    expect(hasProductAccessAtWeek('delayed', 4)).toBe(true);
    expect(hasProductAccessAtWeek('delayed', 8)).toBe(true);
  });
});
