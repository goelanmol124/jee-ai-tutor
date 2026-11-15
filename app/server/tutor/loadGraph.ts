import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GraphData } from '../../src/domain/types';
import { SAMPLE_GRAPH } from '../../src/data/sampleGraph';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cache: GraphData | null = null;

/** Where a full (private) graph bundle is looked for, in priority order. */
export function graphCandidatePaths(env: NodeJS.ProcessEnv = process.env): string[] {
  if (env.AL_GRAPH_PATH?.trim() === 'sample') return [];
  return [
    env.AL_GRAPH_PATH ? path.resolve(env.AL_GRAPH_PATH) : undefined,
    path.resolve(__dirname, '../../public/data/graph.json'),
  ].filter((p): p is string => Boolean(p));
}

/**
 * Load the learning graph: `AL_GRAPH_PATH` → `public/data/graph.json` (both
 * git-ignored, built from your own question bank) → bundled original sample.
 * `AL_GRAPH_PATH=sample` forces the sample graph.
 */
export function loadGraphJson(): GraphData {
  if (cache) return cache;
  for (const candidate of graphCandidatePaths()) {
    if (!fs.existsSync(candidate)) continue;
    cache = JSON.parse(fs.readFileSync(candidate, 'utf8')) as GraphData;
    return cache;
  }
  cache = SAMPLE_GRAPH;
  return cache;
}

export function invalidateGraphJsonCache(): void {
  cache = null;
}
