import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GraphData, GraphEdge, QuestionNode, Subject } from '../src/domain/types';

type AnyRow = Record<string, unknown>;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appRoot, '..');
const snapshotsRoot = path.join(repoRoot, 'graph_runs', 'snapshots');
const outPath = path.join(appRoot, 'public', 'data', 'graph.json');

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readJsonl(filePath: string): AnyRow[] {
  if (!existsSync(filePath)) return [];
  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as AnyRow);
}

function safeId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80) || 'general';
}

function toSubject(value: unknown): Subject {
  const raw = asString(value).toLowerCase();
  if (raw === 'mathematics' || raw === 'math') return 'math';
  if (raw === 'physics') return 'physics';
  if (raw === 'chemistry') return 'chemistry';
  return 'math';
}

function toDifficulty(value: unknown): QuestionNode['difficulty'] {
  const raw = asString(value).toLowerCase();
  if (raw === 'easy') return 2;
  if (raw === 'medium') return 3;
  if (raw === 'hard') return 4;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return Math.max(1, Math.min(5, Math.round(numeric))) as QuestionNode['difficulty'];
  return 3;
}

function selectSnapshot(): string {
  const cliArg = process.argv[2];
  const explicit = cliArg || process.env.AL_GRAPH_SNAPSHOT;
  if (explicit) {
    const full = path.isAbsolute(explicit) ? explicit : path.resolve(repoRoot, explicit);
    if (!existsSync(full)) throw new Error(`Snapshot not found: ${full}`);
    return full;
  }

  const candidates = readdirSync(snapshotsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(snapshotsRoot, entry.name))
    .filter((dir) => existsSync(path.join(dir, 'manifest.json')))
    .map((dir) => {
      const manifest = JSON.parse(readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as {
        build_timestamp?: number;
        stats?: Record<string, number>;
      };
      return { dir, manifest };
    })
    .filter(({ manifest }) => (manifest.stats?.questions_jsonl ?? 0) > 0 && (manifest.stats?.concepts_jsonl ?? 0) > 0)
    .sort((a, b) => (b.manifest.build_timestamp ?? 0) - (a.manifest.build_timestamp ?? 0));

  if (!candidates[0]) throw new Error(`No populated graph snapshots found in ${snapshotsRoot}`);
  return candidates[0].dir;
}

function finalAnswerText(row: AnyRow): string | undefined {
  const parsed = parseJson<Record<string, unknown>>(row.processed_final_answer_json, {});
  const structured = asString(parsed.structured_final_answer);
  if (structured) return structured;
  const detail = parsed.structured_final_answer_detail as Record<string, unknown> | undefined;
  const detailValue = detail ? asString(detail.value_latex) : '';
  if (detailValue) return detailValue;
  const processed = parsed.processed_final_answer as Record<string, unknown> | undefined;
  const processedValue = processed ? asString(processed.value_latex) : '';
  return processedValue || undefined;
}

function buildGraph(snapshotDir: string): GraphData {
  const manifest = JSON.parse(readFileSync(path.join(snapshotDir, 'manifest.json'), 'utf8')) as {
    version?: string;
  };
  const conceptsRows = readJsonl(path.join(snapshotDir, 'concepts.jsonl'));
  const questionRows = readJsonl(path.join(snapshotDir, 'questions.jsonl'));
  const stepRows = readJsonl(path.join(snapshotDir, 'question_steps.jsonl'));
  const questionConceptRows = readJsonl(path.join(snapshotDir, 'question_concepts.jsonl'));
  const derivedRows = readJsonl(path.join(snapshotDir, 'derived_metrics.jsonl'));
  const edgeRows = readJsonl(path.join(snapshotDir, 'concept_edges.jsonl'));

  const chapterMap = new Map<string, { id: string; title: string; subject: Subject }>();
  for (const concept of conceptsRows) {
    const subject = toSubject(concept.subject);
    const title = asString(concept.primary_topic, 'General');
    const id = `${subject}_${safeId(title)}`;
    chapterMap.set(id, { id, title, subject });
  }
  for (const question of questionRows) {
    const subject = toSubject(question.subject);
    const title = asString(question.topic, 'General');
    const id = `${subject}_${safeId(title)}`;
    chapterMap.set(id, { id, title, subject });
  }

  const derivedByConcept = new Map<string, AnyRow>();
  const questionLoad = new Map<string, number>();
  let maxCentrality = 1;
  for (const row of derivedRows) {
    if (row.kind === 'concept') {
      const id = asString(row.concept_id);
      derivedByConcept.set(id, row);
      maxCentrality = Math.max(maxCentrality, asNumber(row.downstream_count) + asNumber(row.mention_count));
    }
    if (row.kind === 'question') {
      questionLoad.set(asString(row.question_id), asNumber(row.load_score, 0.5));
    }
  }

  const prereqsByConcept = new Map<string, Set<string>>();
  const edges: GraphEdge[] = [];
  for (const row of edgeRows) {
    const from = asString(row.source_concept_id);
    const to = asString(row.target_concept_id);
    if (!from || !to) continue;
    const rawKind = asString(row.edge_type);
    const kind: GraphEdge['kind'] = rawKind === 'prerequisite_of'
      ? 'prereq'
      : rawKind === 'often_cooccurs_with'
        ? 'co_occurs'
        : 'related';
    edges.push({ from, to, kind, weight: asNumber(row.confidence, 0.5) });
    if (kind === 'prereq') {
      if (!prereqsByConcept.has(to)) prereqsByConcept.set(to, new Set());
      prereqsByConcept.get(to)!.add(from);
    }
  }

  const concepts = conceptsRows.map((row) => {
    const id = asString(row.concept_id);
    const subject = toSubject(row.subject);
    const chapterTitle = asString(row.primary_topic, 'General');
    const derived = derivedByConcept.get(id);
    const centrality = Math.max(0.05, Math.min(1, (
      asNumber(derived?.downstream_count) + asNumber(derived?.mention_count, 1)
    ) / maxCentrality));
    return {
      id,
      name: asString(row.canonical_name, id),
      chapterId: `${subject}_${safeId(chapterTitle)}`,
      subject,
      prereqIds: Array.from(prereqsByConcept.get(id) ?? []),
      centrality,
      definition: asString(row.definition) || undefined,
      statement: asString(row.statement) || undefined,
      whenToUse: asString(row.when_to_use) || undefined,
      confidence: asString(row.confidence) || undefined,
    };
  });

  const conceptIdSet = new Set(concepts.map((concept) => concept.id));
  const questionConcepts = new Map<string, string[]>();
  const stepConcepts = new Map<string, string[]>();
  for (const row of questionConceptRows) {
    const questionId = asString(row.question_id);
    const conceptId = asString(row.concept_id);
    if (!questionId || !conceptId || !conceptIdSet.has(conceptId)) continue;
    if (!questionConcepts.has(questionId)) questionConcepts.set(questionId, []);
    questionConcepts.get(questionId)!.push(conceptId);
    const stepIds = Array.isArray(row.step_ids) ? row.step_ids.map(String) : [];
    for (const stepId of stepIds) {
      if (!stepConcepts.has(stepId)) stepConcepts.set(stepId, []);
      stepConcepts.get(stepId)!.push(conceptId);
    }
  }

  const stepsByQuestion = new Map<string, AnyRow[]>();
  for (const step of stepRows) {
    const questionId = asString(step.question_id);
    if (!stepsByQuestion.has(questionId)) stepsByQuestion.set(questionId, []);
    stepsByQuestion.get(questionId)!.push(step);
  }

  const questions = questionRows.map((row) => {
    const subject = toSubject(row.subject);
    const chapterTitle = asString(row.topic, 'General');
    const id = asString(row.question_id);
    const conceptIds = Array.from(new Set(questionConcepts.get(id) ?? []));
    const prereqIds = Array.from(new Set([
      ...conceptIds.flatMap((conceptId) => Array.from(prereqsByConcept.get(conceptId) ?? [])),
      ...conceptIds,
    ])).filter((conceptId) => conceptIdSet.has(conceptId));
    const options = Array.isArray(row.canonical_options_json)
      ? row.canonical_options_json.map((option) => asString((option as AnyRow).text_latex)).filter(Boolean)
      : [];
    const steps = (stepsByQuestion.get(id) ?? [])
      .sort((a, b) => asNumber(a.step_number) - asNumber(b.step_number))
      .map((step) => {
        const stepId = asString(step.step_id);
        return {
          id: stepId,
          text: [asString(step.expression), asString(step.thought)].filter(Boolean).join('\n'),
          conceptIds: Array.from(new Set(stepConcepts.get(stepId) ?? [])).filter((conceptId) => conceptIdSet.has(conceptId)),
        };
      });

    const source = [
      asString(row.exam_date) || asString(row.slot_id, 'JEE question'),
      asString(row.final_slot_id),
    ].filter(Boolean).join(' · ');

    return {
      id,
      source,
      prompt: asString(row.canonical_question_latex, 'Question text unavailable.'),
      options: options.length ? options : undefined,
      subject,
      chapterId: `${subject}_${safeId(chapterTitle)}`,
      conceptIds,
      prereqIds,
      canonicalSteps: steps,
      finalAnswer: finalAnswerText(row),
      difficulty: toDifficulty(row.difficulty),
      mode: 'build' as const,
      examFeel: 1,
      finalAnswerDetail: asString(row.processed_final_answer_json) || undefined,
      estimatedTimeSeconds: asNumber(row.estimated_time_seconds) || undefined,
      answerType: asString(row.answer_type) || undefined,
      needsHumanReview: Boolean(row.needs_human_review),
    };
  });

  return {
    version: manifest.version ?? path.basename(snapshotDir),
    generatedAt: new Date().toISOString(),
    source: 'snapshot',
    chapters: Array.from(chapterMap.values()).sort((a, b) => a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title)),
    concepts,
    questions,
    edges,
  };
}

const snapshotDir = selectSnapshot();
const graph = buildGraph(snapshotDir);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');

console.log(`Synced graph snapshot ${graph.version} -> ${path.relative(repoRoot, outPath)}`);
console.log(`Graph: ${graph.chapters.length} chapters, ${graph.concepts.length} concepts, ${graph.questions.length} questions, ${graph.edges.length} edges`);
