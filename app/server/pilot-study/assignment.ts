import { createSeededRng, seedFromString } from './rng';
import type {
  AssignmentRecord,
  EligibleStudent,
  PilotArm,
  PilotStratum,
  StratifiedAssignmentResult,
} from './types';

const STRATA: PilotStratum[] = ['class_11', 'class_12', 'dropper'];

const MIN_N = 24;
const MAX_N = 36;

export interface AssignOptions {
  seed: string;
  /** ISO timestamp stamped on the result; defaults to a fixed value only in tests. */
  randomizedAt?: string;
}

function emptyStratumCounts(): StratifiedAssignmentResult['stratumCounts'] {
  return {
    class_11: { early: 0, delayed: 0, total: 0 },
    class_12: { early: 0, delayed: 0, total: 0 },
    dropper: { early: 0, delayed: 0, total: 0 },
  };
}

/**
 * Individually randomized stratified delayed-start assignment.
 *
 * Within each Class 11 / Class 12 / dropper stratum:
 * 1. sort by baseline score (then studentId for ties);
 * 2. form adjacent pairs (baseline blocks);
 * 3. randomly assign one member of each pair to early, the other to delayed.
 *
 * Connected groups sharing `connectedGroupId` receive the same arm (pair-level
 * when contamination risk warrants it).
 */
export function assignStratifiedDelayedStart(
  students: EligibleStudent[],
  options: AssignOptions,
): StratifiedAssignmentResult {
  const warnings: string[] = [];
  if (students.length < MIN_N) {
    warnings.push(`n=${students.length} below recommended minimum ${MIN_N}`);
  }
  if (students.length > MAX_N) {
    warnings.push(`n=${students.length} above recommended maximum ${MAX_N}`);
  }

  const ids = new Set<string>();
  for (const s of students) {
    if (ids.has(s.studentId)) {
      throw new Error(`Duplicate studentId in assignment cohort: ${s.studentId}`);
    }
    ids.add(s.studentId);
  }

  const rng = createSeededRng(seedFromString(options.seed));
  const assignments: AssignmentRecord[] = [];
  const stratumCounts = emptyStratumCounts();

  // Resolve connected groups first: one random arm for the whole group.
  const groupArm = new Map<string, PilotArm>();
  for (const s of students) {
    if (!s.connectedGroupId) continue;
    if (!groupArm.has(s.connectedGroupId)) {
      groupArm.set(s.connectedGroupId, rng() < 0.5 ? 'early' : 'delayed');
    }
  }

  for (const stratum of STRATA) {
    const cohort = students
      .filter((s) => s.stratum === stratum)
      .slice()
      .sort((a, b) => {
        if (a.baselineScore !== b.baselineScore) {
          return a.baselineScore - b.baselineScore;
        }
        return a.studentId.localeCompare(b.studentId);
      });

    let blockIndex = 0;
    let i = 0;
    while (i < cohort.length) {
      const a = cohort[i]!;
      const b = cohort[i + 1];

      if (!b) {
        // Odd remainder: restricted randomization favoring balance within stratum.
        const earlySoFar = assignments.filter(
          (r) => r.stratum === stratum && r.arm === 'early',
        ).length;
        const delayedSoFar = assignments.filter(
          (r) => r.stratum === stratum && r.arm === 'delayed',
        ).length;
        let arm: PilotArm;
        if (a.connectedGroupId && groupArm.has(a.connectedGroupId)) {
          arm = groupArm.get(a.connectedGroupId)!;
        } else if (earlySoFar < delayedSoFar) {
          arm = 'early';
        } else if (delayedSoFar < earlySoFar) {
          arm = 'delayed';
        } else {
          arm = rng() < 0.5 ? 'early' : 'delayed';
        }
        const blockId = `${stratum}_block_${blockIndex}_singleton`;
        assignments.push({
          studentId: a.studentId,
          stratum,
          baselineScore: a.baselineScore,
          arm,
          allocationBlockId: blockId,
          connectedGroupId: a.connectedGroupId,
        });
        warnings.push(
          `Odd stratum count for ${stratum}: ${a.studentId} assigned via restricted singleton rule`,
        );
        i += 1;
        blockIndex += 1;
        continue;
      }

      const blockId = `${stratum}_block_${blockIndex}`;
      const aGroup = a.connectedGroupId;
      const bGroup = b.connectedGroupId;

      let armA: PilotArm;
      let armB: PilotArm;

      if (aGroup && bGroup && aGroup === bGroup) {
        // Same connected group in one baseline pair — both share group arm.
        armA = groupArm.get(aGroup)!;
        armB = armA;
        warnings.push(
          `Connected group ${aGroup} spans a baseline pair in ${stratum}; both assigned ${armA}`,
        );
      } else if (aGroup && groupArm.has(aGroup) && bGroup && groupArm.has(bGroup)) {
        armA = groupArm.get(aGroup)!;
        armB = groupArm.get(bGroup)!;
        if (armA === armB) {
          // Force opposite arms when possible to preserve blocking intent.
          warnings.push(
            `Connected groups ${aGroup}/${bGroup} drew same arm; preserving group arms`,
          );
        }
      } else if (aGroup && groupArm.has(aGroup)) {
        armA = groupArm.get(aGroup)!;
        armB = armA === 'early' ? 'delayed' : 'early';
        if (bGroup) groupArm.set(bGroup, armB);
      } else if (bGroup && groupArm.has(bGroup)) {
        armB = groupArm.get(bGroup)!;
        armA = armB === 'early' ? 'delayed' : 'early';
        if (aGroup) groupArm.set(aGroup, armA);
      } else {
        const flip = rng() < 0.5;
        armA = flip ? 'early' : 'delayed';
        armB = flip ? 'delayed' : 'early';
        if (aGroup) groupArm.set(aGroup, armA);
        if (bGroup) groupArm.set(bGroup, armB);
      }

      assignments.push({
        studentId: a.studentId,
        stratum,
        baselineScore: a.baselineScore,
        arm: armA,
        allocationBlockId: blockId,
        connectedGroupId: a.connectedGroupId,
      });
      assignments.push({
        studentId: b.studentId,
        stratum,
        baselineScore: b.baselineScore,
        arm: armB,
        allocationBlockId: blockId,
        connectedGroupId: b.connectedGroupId,
      });

      i += 2;
      blockIndex += 1;
    }
  }

  for (const rec of assignments) {
    const bucket = stratumCounts[rec.stratum];
    bucket.total += 1;
    if (rec.arm === 'early') bucket.early += 1;
    else bucket.delayed += 1;
  }

  // Stable order: stratum then baseline then id.
  assignments.sort((a, b) => {
    const si = STRATA.indexOf(a.stratum) - STRATA.indexOf(b.stratum);
    if (si !== 0) return si;
    if (a.baselineScore !== b.baselineScore) return a.baselineScore - b.baselineScore;
    return a.studentId.localeCompare(b.studentId);
  });

  return {
    protocolVersion: 'pilot_delayed_start_v1',
    seed: options.seed,
    randomizedAt: options.randomizedAt ?? new Date(0).toISOString(),
    nRandomized: assignments.length,
    assignments,
    stratumCounts,
    warnings,
  };
}

export function armAccessWindow(
  arm: PilotArm,
): { productAccessWeekStart: number; productAccessWeekEnd: number } {
  if (arm === 'early') {
    return { productAccessWeekStart: 1, productAccessWeekEnd: 8 };
  }
  return { productAccessWeekStart: 4, productAccessWeekEnd: 8 };
}

export function hasProductAccessAtWeek(arm: PilotArm, week: number): boolean {
  const w = armAccessWindow(arm);
  return week >= w.productAccessWeekStart && week <= w.productAccessWeekEnd;
}
