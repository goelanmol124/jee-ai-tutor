/**
 * Utility: build and freeze a versioned pilot analysis manifest.
 *
 * Run:
 *   npx tsx scripts/freeze-pilot-analysis-manifest.ts \
 *     --seed pilot-2026-q3 \
 *     --holdout holdout_v1 \
 *     --tutoring tutoring_v1 \
 *     --out tmp/analysis-manifest.json
 *
 * Does not imply the pilot has been run.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  buildDraftAnalysisManifest,
  freezeAnalysisManifest,
  manifestContentHash,
} from '../server/pilot-study/analysisManifest';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const seed = argValue('--seed') ?? 'pilot_assignment_seed_dev';
const holdout = argValue('--holdout') ?? 'holdout_bank_unspecified';
const tutoring = argValue('--tutoring') ?? 'tutoring_bank_unspecified';
const outPath = argValue('--out');
const frozenAt = argValue('--frozen-at') ?? new Date().toISOString();

const draft = buildDraftAnalysisManifest({
  assignmentSeed: seed,
  holdoutBankVersion: holdout,
  tutoringBankVersion: tutoring,
  notes: 'Frozen via freeze-pilot-analysis-manifest.ts; pilot not executed',
});
const frozen = freezeAnalysisManifest(draft, frozenAt);
const payload = {
  manifest: frozen,
  contentHash: manifestContentHash(frozen),
  pilotExecuted: false as const,
};

const json = `${JSON.stringify(payload, null, 2)}\n`;
if (outPath) {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, json, 'utf8');
  console.log(`Wrote frozen manifest to ${abs}`);
} else {
  process.stdout.write(json);
}
