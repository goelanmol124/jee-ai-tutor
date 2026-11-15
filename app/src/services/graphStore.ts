import { SAMPLE_GRAPH } from '../data/sampleGraph';
import type { GraphData } from '../domain/types';

let loadedGraph: GraphData | undefined;

/** The graph most recently returned by `loadGraph()` (sample graph until then). */
export function getLoadedGraph(): GraphData {
  return loadedGraph ?? SAMPLE_GRAPH;
}

/** Bundled original sample content (no exam questions). */
export function loadSampleGraph(): GraphData {
  return SAMPLE_GRAPH;
}

function isUsableGraph(value: unknown): value is GraphData {
  const graph = value as Partial<GraphData>;
  return Array.isArray(graph.chapters)
    && Array.isArray(graph.concepts)
    && Array.isArray(graph.questions)
    && graph.concepts.length > 0
    && graph.questions.length > 0;
}

/**
 * Load the learning graph. A full graph built from your own question bank can be
 * dropped at `public/data/graph.json` (git-ignored, see `npm run sync:graph`);
 * otherwise the bundled original sample graph is used.
 */
export async function loadGraph(): Promise<GraphData> {
  loadedGraph = await fetchLocalGraph() ?? SAMPLE_GRAPH;
  return loadedGraph;
}

async function fetchLocalGraph(): Promise<GraphData | undefined> {
  if (import.meta.env.VITE_GRAPH === 'sample') return undefined;
  try {
    const response = await fetch('/data/graph.json', { cache: 'no-cache' });
    if (!response.ok) return undefined;
    // Dev servers may answer unknown paths with index.html.
    if (!(response.headers.get('content-type') ?? '').includes('json')) return undefined;
    const graph = await response.json() as unknown;
    return isUsableGraph(graph) ? graph : undefined;
  } catch {
    return undefined;
  }
}

export { pickInitialQuestion } from './questionPicker';

