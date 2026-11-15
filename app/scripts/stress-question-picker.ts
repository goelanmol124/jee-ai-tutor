import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GraphData, QuestionNode, StudentConceptState, Subject } from '../src/domain/types';
import { rankQuestionCandidates } from '../src/services/questionPicker';
import { beliefsFromConceptStates, makeInitialStudentState } from '../src/services/studentModel';

type Outcome = 'good' | 'gap' | 'mixed';

type Scenario = {
  name: string;
  intent: string;
  coveredChapterIds: string[];
  fatigue?: number;
  picks?: number;
  outcomes?: Outcome[];
  mutateStates?: (states: Record<string, StudentConceptState>, graph: GraphData) => void;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const graphPath = path.resolve(__dirname, '../public/data/graph.json');
const graph = JSON.parse(readFileSync(graphPath, 'utf8')) as GraphData;
const chapterById = new Map(graph.chapters.map((chapter) => [chapter.id, chapter]));

function chapterName(chapterId: string): string {
  return chapterById.get(chapterId)?.title ?? chapterId;
}

function chapterIdsByTitle(titlePart: string): string[] {
  const needle = titlePart.toLowerCase();
  return graph.chapters
    .filter((chapter) => chapter.title.toLowerCase().includes(needle))
    .map((chapter) => chapter.id);
}

function firstChapterId(titlePart: string): string | undefined {
  return chapterIdsByTitle(titlePart)[0];
}

function topChapterIds(subject: Subject, count: number): string[] {
  const counts = new Map<string, number>();
  for (const question of graph.questions) {
    if (question.subject !== subject) continue;
    counts.set(question.chapterId, (counts.get(question.chapterId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([chapterId]) => chapterId);
}

function usableQuestions() {
  return graph.questions.filter((question) => question.canonicalSteps.length > 0 && question.conceptIds.length > 0);
}

function poolSnapshot(coveredChapterIds: string[], attemptedQuestionIds: string[]) {
  const attempted = new Set(attemptedQuestionIds);
  const preferredSubjects = new Set(
    coveredChapterIds
      .map((chapterId) => chapterById.get(chapterId)?.subject)
      .filter((subject): subject is Subject => Boolean(subject)),
  );
  const base = usableQuestions();
  const preferred = base.filter((question) => coveredChapterIds.includes(question.chapterId));
  const sameSubject = base.filter((question) => preferredSubjects.has(question.subject));
  return {
    preferred: preferred.length,
    preferredUnseen: preferred.filter((question) => !attempted.has(question.id)).length,
    sameSubject: sameSubject.length,
    sameSubjectUnseen: sameSubject.filter((question) => !attempted.has(question.id)).length,
    globalUnseen: base.filter((question) => !attempted.has(question.id)).length,
  };
}

function adjustBelief(state: StudentConceptState, delta: number): StudentConceptState {
  return {
    ...state,
    belief: Math.max(0.02, Math.min(0.99, state.belief + delta)),
    attempts: (state.attempts ?? 0) + 1,
    lastSeenAt: '2026-04-30T00:00:00.000Z',
  };
}

function applyOutcome(states: Record<string, StudentConceptState>, question: QuestionNode, outcome: Outcome) {
  const targetDelta = outcome === 'good' ? 0.16 : outcome === 'mixed' ? 0.05 : -0.08;
  const prereqDelta = outcome === 'good' ? 0.05 : outcome === 'mixed' ? 0.02 : -0.03;
  for (const conceptId of question.prereqIds) {
    const current = states[conceptId];
    if (current) states[conceptId] = adjustBelief(current, prereqDelta);
  }
  for (const conceptId of question.conceptIds) {
    const current = states[conceptId];
    if (!current) continue;
    states[conceptId] = {
      ...adjustBelief(current, targetDelta),
      nextReviewAt: outcome === 'gap' ? '2026-04-30T00:00:00.000Z' : current.nextReviewAt,
      reviewIntervalDays: outcome === 'gap' ? 1 : current.reviewIntervalDays,
    };
  }
}

function markDue(states: Record<string, StudentConceptState>, graphData: GraphData, chapterIds: string[]) {
  for (const concept of graphData.concepts) {
    if (!chapterIds.includes(concept.chapterId)) continue;
    const current = states[concept.id];
    if (!current) continue;
    states[concept.id] = {
      ...current,
      belief: Math.max(current.belief, 0.42),
      nextReviewAt: '2026-04-30T00:00:00.000Z',
      reviewIntervalDays: 1,
    };
  }
}

function liftChapter(states: Record<string, StudentConceptState>, graphData: GraphData, chapterIds: string[], belief: number) {
  for (const concept of graphData.concepts) {
    if (!chapterIds.includes(concept.chapterId)) continue;
    const current = states[concept.id];
    if (current) states[concept.id] = { ...current, belief };
  }
}

function compactAlternatives(ranked: ReturnType<typeof rankQuestionCandidates>): string {
  return ranked.slice(1, 4).map((item) => `${chapterName(item.question.chapterId)}:${item.question.difficulty}`).join(' | ');
}

function simulateScenario(scenario: Scenario) {
  const state = makeInitialStudentState(graph, scenario.coveredChapterIds);
  scenario.mutateStates?.(state.conceptStates, graph);

  const attemptedQuestionIds: string[] = [];
  const rows = [];
  const picks = scenario.picks ?? 12;
  const outcomes = scenario.outcomes ?? ['mixed', 'good', 'gap', 'good'];

  for (let i = 0; i < picks; i += 1) {
    const beliefs = beliefsFromConceptStates(state.conceptStates);
    const ranked = rankQuestionCandidates(graph, scenario.coveredChapterIds, beliefs, {
      attemptedQuestionIds,
      conceptStates: state.conceptStates,
      fatigue: scenario.fatigue,
      now: new Date('2026-04-30T00:00:00.000Z'),
    });
    const top = ranked[0];
    if (!top) break;

    const outcome = outcomes[i % outcomes.length];
    attemptedQuestionIds.push(top.question.id);
    rows.push({
      n: i + 1,
      outcome,
      id: top.question.id.slice(0, 8),
      subject: top.question.subject,
      chapter: chapterName(top.question.chapterId),
      diff: top.question.difficulty,
      score: top.score.toFixed(2),
      ready: top.knownPrereqRatio.toFixed(2),
      weak: top.weakTarget.toFixed(2),
      review: top.reviewDue.toFixed(2),
      load: top.cognitiveLoad.toFixed(2),
      alt: compactAlternatives(ranked),
    });
    applyOutcome(state.conceptStates, top.question, outcome);
  }

  const uniqueChapters = new Set(rows.map((row) => row.chapter));
  const subjects = new Set(rows.map((row) => row.subject));
  const initialPool = poolSnapshot(scenario.coveredChapterIds, []);
  const finalPool = poolSnapshot(scenario.coveredChapterIds, attemptedQuestionIds);
  console.log(`\n=== ${scenario.name} ===`);
  console.log(scenario.intent);
  console.log(`covered=${scenario.coveredChapterIds.map(chapterName).join(', ') || '(none)'}`);
  console.log('pool start/end', initialPool, finalPool);
  console.table(rows);
  console.log(`summary: picks=${rows.length}, uniqueChapters=${uniqueChapters.size}, subjects=${[...subjects].join(', ')}`);
}

const mathCore11 = [
  firstChapterId('Quadratic Equations'),
  firstChapterId('Straight Lines'),
  firstChapterId('Limits'),
].filter((id): id is string => Boolean(id));
const physicsCore11 = [
  firstChapterId('Units and Measurements'),
  firstChapterId('Kinematics'),
  firstChapterId('Laws of Motion'),
  firstChapterId('Work, Energy and Power'),
].filter((id): id is string => Boolean(id));
const chemCore11 = [
  firstChapterId('Atomic Structure'),
  firstChapterId('Chemical Bonding'),
  firstChapterId('Thermodynamics'),
].filter((id): id is string => Boolean(id));
const math12 = [
  firstChapterId('Limits, Continuity and Differentiability'),
  firstChapterId('Differentiation'),
  firstChapterId('Definite Integrals'),
  firstChapterId('Matrices'),
].filter((id): id is string => Boolean(id));
const physics12 = [
  firstChapterId('Current Electricity'),
  firstChapterId('Electrostatics'),
  firstChapterId('Ray Optics'),
].filter((id): id is string => Boolean(id));
const chem12 = [
  firstChapterId('Electrochemistry'),
  firstChapterId('Coordination Compounds'),
  firstChapterId('Aromatic Compounds'),
].filter((id): id is string => Boolean(id));
const topMath = topChapterIds('math', 8);
const topPhysics = topChapterIds('physics', 5);
const topChemistry = topChapterIds('chemistry', 5);

const scenarios: Scenario[] = [
  {
    name: '11th student after first two months',
    intent: 'Should stay mostly in foundational 11th PCM and not jump to obscure high-load questions.',
    coveredChapterIds: [...mathCore11, ...physicsCore11, ...chemCore11],
    outcomes: ['mixed', 'gap', 'good', 'mixed'],
  },
  {
    name: '12th student current-school mode',
    intent: 'Should favor current 12th chapters while mixing subjects and avoiding repeated chapter tunnels.',
    coveredChapterIds: [...math12, ...physics12, ...chem12],
    outcomes: ['good', 'mixed', 'good', 'gap'],
  },
  {
    name: 'Dropper broad revision with due weak areas',
    intent: 'Should pick review-worthy weak areas, but still keep variety across a long mixed syllabus.',
    coveredChapterIds: [...topMath, ...topPhysics, ...topChemistry],
    outcomes: ['good', 'good', 'mixed', 'gap'],
    mutateStates: (states, graphData) => {
      liftChapter(states, graphData, [...topMath, ...topPhysics, ...topChemistry], 0.62);
      markDue(states, graphData, [topMath[0], topPhysics[0], topChemistry[0]].filter(Boolean));
    },
  },
  {
    name: 'Dropper fatigued evening session',
    intent: 'Same broad prep, but fatigue should pull difficulty down when comparable options exist.',
    coveredChapterIds: [...topMath, ...topPhysics, ...topChemistry],
    fatigue: 1,
    outcomes: ['mixed', 'good', 'gap', 'mixed'],
    mutateStates: (states, graphData) => liftChapter(states, graphData, [...topMath, ...topPhysics, ...topChemistry], 0.55),
  },
  {
    name: 'Sparse chapter edge case',
    intent: 'If the chosen chapter runs out, fallback should stay in the same subject before going global.',
    coveredChapterIds: [firstChapterId('Differentiation')].filter((id): id is string => Boolean(id)),
    outcomes: ['good'],
  },
  {
    name: 'No preference cold start edge case',
    intent: 'Should still avoid repeats/human-review picks and reveal whether global defaults are sensible.',
    coveredChapterIds: [],
    outcomes: ['mixed', 'mixed', 'gap', 'good'],
  },
];

console.log(`Graph ${graph.version}: ${graph.questions.length} questions, ${graph.concepts.length} concepts, ${graph.chapters.length} chapters`);
for (const scenario of scenarios) simulateScenario(scenario);
