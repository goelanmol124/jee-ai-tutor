/**
 * Emit the machine-readable pilot launch checklist with unresolved human blockers.
 *
 * Run:
 *   npx tsx scripts/pilot-launch-checklist.ts
 *   npx tsx scripts/pilot-launch-checklist.ts --out tmp/launch-checklist.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildLaunchChecklist } from '../server/pilot-study/launchChecklist';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const checklist = buildLaunchChecklist(
  {
    stratifiedAssignmentModule: true,
    blindedAnalysisManifest: true,
    holdoutBankBoundary: true,
    activeTimeDerivation: true,
    feasibilityGates: true,
    handwritingEvalSchema: true,
    pilotExecuted: false,
  },
  new Date().toISOString(),
);

const json = `${JSON.stringify(checklist, null, 2)}\n`;
const outPath = argValue('--out');
if (outPath) {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, json, 'utf8');
  console.log(`Wrote launch checklist to ${abs}`);
} else {
  process.stdout.write(json);
}

console.error(
  `softwareReady=${checklist.softwareReady} launchCleared=${checklist.launchCleared} unresolvedHuman=${checklist.unresolvedHumanBlockers.length}`,
);
