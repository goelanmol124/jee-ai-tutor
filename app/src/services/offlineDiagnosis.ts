/**
 * Offline, deterministic step-level diagnosis.
 *
 * Works without any LLM key: it walks the question's canonical steps in order,
 * looks for evidence of each step in the student's typed working, and stops at
 * the FIRST causal break. Known wrong moves ("traps") let it say *why* the step
 * broke — concept gap vs. procedure error vs. silly slip — instead of only
 * "wrong". It never reveals the final answer.
 *
 * The LLM path (server `/api/diagnose`) replaces this when an API key is set;
 * this module keeps the core learning loop usable, testable and free.
 */
import type {
  AttemptStepTrace,
  BeliefUpdate,
  CanonicalStepNode,
  ConceptEvidence,
  ConceptNode,
  DiagnosisResult,
  GraphData,
  MistakeType,
  NextMoveKind,
  QuestionNode,
  QuickCheck,
  StepTrap,
  TutorCard,
  TutorTool,
} from '../domain/types';

export interface OfflineDiagnosisInput {
  question: QuestionNode;
  typedWork?: string;
  /** Zero-based MCQ option chosen by the student, if any. */
  selectedIndex?: number;
  hasImage?: boolean;
  /** Used to name concepts and build quick-check distractors. Optional. */
  graph?: Pick<GraphData, 'concepts'>;
}

/** Normalise math-ish text so token matching survives spacing / unicode / LaTeX. */
export function normalizeWork(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/\\d?frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1/$2');
  s = s
    .replace(/\\(cdot|times)/g, '*')
    .replace(/\\(left|right)/g, '')
    .replace(/\\rightarrow|\\to/g, '->')
    .replace(/[×·∙]/g, '*')
    .replace(/[−–—]/g, '-')
    .replace(/→/g, '->')
    .replace(/π/g, 'pi')
    .replace(/α|alpha/g, 'a')
    .replace(/β|beta/g, 'b')
    .replace(/μ|mu/g, 'u')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/√/g, 'sqrt')
    .replace(/°|\^\\circ|\\circ|degrees?/g, '');
  s = s.replace(/[\\{}$\s]/g, '');
  return s;
}

function matchesAlternative(text: string, alternative: string): boolean {
  return alternative
    .split('&&')
    .map((token) => normalizeWork(token))
    .filter(Boolean)
    .every((token) => text.includes(token));
}

export function matchesAny(text: string, alternatives: string[] | undefined): boolean {
  if (!alternatives?.length) return false;
  return alternatives.some((alt) => matchesAlternative(text, alt));
}

function findTrap(text: string, step: CanonicalStepNode): StepTrap | undefined {
  return step.traps?.find((trap) => matchesAny(text, trap.checks));
}

function splitLines(typedWork: string): string[] {
  return typedWork
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

function lineFor(lines: string[], alternatives: string[] | undefined): string | undefined {
  if (!alternatives?.length) return undefined;
  return lines.find((line) => matchesAny(normalizeWork(line), alternatives));
}

let cardSeq = 0;
function card(kind: TutorCard['kind'], title: string, body: string, conceptIds?: string[], actionLabel?: string): TutorCard {
  cardSeq += 1;
  return { id: `${kind}_offline_${cardSeq}`, kind, title, body, conceptIds, actionLabel };
}

function conceptName(graph: OfflineDiagnosisInput['graph'], id: string): string {
  return graph?.concepts.find((concept) => concept.id === id)?.name ?? id.replace(/^[a-z]_/, '').replace(/_/g, ' ');
}

/** One 3-option check: "which idea fixes this step?" — converts the diagnosis into evidence. */
export function buildConceptQuickCheck(
  question: QuestionNode,
  step: CanonicalStepNode,
  graph?: OfflineDiagnosisInput['graph'],
): QuickCheck | undefined {
  const targetId = step.conceptIds[0];
  if (!targetId || !graph) return undefined;
  const target = graph.concepts.find((concept) => concept.id === targetId);
  if (!target) return undefined;
  const exclude = new Set([...question.conceptIds, ...question.prereqIds]);
  const distractors: ConceptNode[] = graph.concepts
    .filter((concept) => concept.subject === target.subject && !exclude.has(concept.id))
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 2);
  if (distractors.length === 0) return undefined;
  const why = target.statement ?? target.whenToUse ?? '';
  const options = [
    { label: target.name, correct: true, feedback: `Yes — ${why}`.trim() },
    ...distractors.map((concept) => ({
      label: concept.name,
      correct: false,
      feedback: `Not here. This step needs ${target.name.toLowerCase()}${why ? `: ${why}` : '.'}`,
    })),
  ];
  // Deterministic rotation so the right answer is not always first.
  const shift = question.id.length % options.length;
  return {
    prompt: 'Quick check — which idea does the broken step need?',
    options: [...options.slice(shift), ...options.slice(0, shift)],
  };
}

const TOOL_BY_MISTAKE: Record<MistakeType, TutorTool> = {
  conceptual_gap: 'micro_lesson',
  wrong_understanding: 'splice',
  procedure_error: 'hint_ladder',
  silly_mistake: 'check_card',
  unclear_evidence: 'diagnosis_card',
};

const NEXT_BY_MISTAKE: Record<MistakeType, NextMoveKind> = {
  conceptual_gap: 'see_fix',
  wrong_understanding: 'see_fix',
  procedure_error: 'try_again',
  silly_mistake: 'try_again',
  unclear_evidence: 'clarify',
};

const TITLE_BY_MISTAKE: Record<MistakeType, string> = {
  conceptual_gap: 'Found a concept gap',
  wrong_understanding: 'Found a misunderstanding',
  procedure_error: 'Procedure wobble',
  silly_mistake: 'Caught a slip',
  unclear_evidence: 'Need a clearer look',
};

function clarification(message: string, trace: AttemptStepTrace[] = []): DiagnosisResult {
  return {
    verdict: 'unclear',
    mistakeType: 'unclear_evidence',
    firstProblemStep: undefined,
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: 0.4,
    recommendedTool: 'diagnosis_card',
    attemptTrace: trace,
    conceptEvidence: [],
    cards: [card('clarification', 'Need a clearer look', message, undefined, 'Add working')],
    beliefUpdates: [],
    needsClarification: true,
    coachMessage: message,
    nextMove: 'clarify',
  };
}

type StepOutcome =
  | { kind: 'matched'; line?: string }
  | { kind: 'trap'; trap: StepTrap; line?: string }
  | { kind: 'missing' }
  | { kind: 'unchecked' };

export function diagnoseOffline(input: OfflineDiagnosisInput): DiagnosisResult {
  const { question, graph } = input;
  const typed = input.typedWork?.trim() ?? '';

  if (!typed) {
    return clarification(input.hasImage
      ? 'Offline mode can\'t read photos. Type the two or three key lines of your working (or set an API key on the server for photo diagnosis).'
      : 'Show me one or two lines of your working so I can find exactly where it went right or wrong.');
  }

  const lines = splitLines(typed);
  const full = normalizeWork(typed);
  const lastLine = normalizeWork(lines[lines.length - 1] ?? '');
  const steps = question.canonicalSteps;

  const mcqCorrect = input.selectedIndex != null && question.answerIndex != null
    ? input.selectedIndex === question.answerIndex
    : undefined;
  const textCorrect = matchesAny(lastLine, question.answerChecks) ? true : undefined;
  const finalCorrect: boolean | undefined = mcqCorrect ?? textCorrect;

  const outcomes: StepOutcome[] = steps.map((step) => {
    if (!step.checks?.length) return { kind: 'unchecked' };
    if (matchesAny(full, step.checks)) return { kind: 'matched', line: lineFor(lines, step.checks) };
    const trap = findTrap(full, step);
    if (trap) return { kind: 'trap', trap, line: lineFor(lines, trap.checks) };
    return { kind: 'missing' };
  });

  // First causal break = first trap, or first missing step that nothing later "recovers".
  let breakIndex = -1;
  for (let i = 0; i < outcomes.length; i++) {
    const outcome = outcomes[i];
    if (outcome.kind === 'trap') { breakIndex = i; break; }
    if (outcome.kind === 'missing') {
      const laterTrap = outcomes.slice(i + 1).some((o) => o.kind === 'trap');
      const recovered = outcomes.slice(i + 1).some((o) => o.kind === 'matched') || finalCorrect === true;
      if (!laterTrap && !recovered) { breakIndex = i; break; }
    }
  }

  const anyEvidence = outcomes.some((o) => o.kind === 'matched' || o.kind === 'trap');
  if (!anyEvidence && finalCorrect === undefined) {
    return clarification(
      'I couldn\'t match your lines to a solution path yet. Write the first relation you used (formula or rule) on its own line.',
    );
  }

  const stepsBefore = breakIndex >= 0 ? steps.slice(0, breakIndex) : steps;
  const conceptsPositive = Array.from(new Set(
    stepsBefore
      .filter((_, i) => outcomes[i].kind === 'matched')
      .flatMap((step) => step.conceptIds),
  ));

  const attemptTrace: AttemptStepTrace[] = steps.map((step, i) => {
    const outcome = outcomes[i];
    const isBreak = i === breakIndex;
    const status: AttemptStepTrace['status'] = isBreak
      ? 'broken'
      : outcome.kind === 'matched'
        ? 'correct'
        : breakIndex >= 0 && i > breakIndex
          ? 'pending'
          : 'ambiguous';
    const raw = (outcome.kind === 'matched' || outcome.kind === 'trap') && outcome.line
      ? outcome.line
      : '(not shown)';
    return {
      id: `trace_${i + 1}`,
      raw,
      status,
      canonicalStepId: step.id,
      conceptIds: step.conceptIds,
      note: isBreak
        ? (outcome.kind === 'trap' ? outcome.trap.note : step.hint)
        : status === 'ambiguous' ? 'Not written down — fine if you did it in your head.' : undefined,
      confidence: outcome.kind === 'matched' || outcome.kind === 'trap' ? 0.8 : 0.5,
    };
  });

  // ── Case 1: a causal break was found ──
  if (breakIndex >= 0) {
    const step = steps[breakIndex];
    const outcome = outcomes[breakIndex];
    const mistakeType: MistakeType = outcome.kind === 'trap' ? outcome.trap.mistakeType : 'procedure_error';
    const conceptsNegative = step.conceptIds;
    const body = outcome.kind === 'trap'
      ? outcome.trap.note
      : `Your work is on track until this point, but the next move is missing. ${step.hint ?? ''}`.trim();
    const quickCheck = mistakeType === 'conceptual_gap' || mistakeType === 'wrong_understanding'
      ? buildConceptQuickCheck(question, step, graph)
      : undefined;
    const goodPart = conceptsPositive.length
      ? `Good: ${conceptsPositive.map((id) => conceptName(graph, id)).join(', ')} looked right. `
      : '';
    const conceptEvidence: ConceptEvidence[] = [
      ...conceptsPositive.map((conceptId) => ({
        conceptId, outcome: 'applied_well' as const, confidence: 0.75, reason: 'Matched a canonical step in the typed work.',
      })),
      ...conceptsNegative.map((conceptId) => ({
        conceptId,
        outcome: (mistakeType === 'silly_mistake' ? 'fragile' : 'missing') as ConceptEvidence['outcome'],
        confidence: outcome.kind === 'trap' ? 0.8 : 0.55,
        reason: outcome.kind === 'trap' ? 'Known wrong move detected at this step.' : 'Step not found in the work.',
      })),
    ];
    const negativeDelta = mistakeType === 'silly_mistake' ? -0.03 : outcome.kind === 'trap' ? -0.12 : -0.06;
    const beliefUpdates: BeliefUpdate[] = [
      ...conceptsPositive.map((conceptId) => ({ conceptId, delta: 0.06, reason: 'Applied correctly before the break.' })),
      ...conceptsNegative.map((conceptId) => ({ conceptId, delta: negativeDelta, reason: TITLE_BY_MISTAKE[mistakeType] })),
    ];
    return {
      verdict: mistakeType === 'silly_mistake' ? 'partially_correct' : 'needs_work',
      mistakeType,
      // Never echo canonical step text here: it can contain the answer.
      firstProblemStep: (outcome.kind === 'trap' && outcome.line) || step.hint || 'The next step is missing.',
      conceptsPositive,
      conceptsNegative,
      sillyMistakeTags: mistakeType === 'silly_mistake' ? ['execution_slip'] : [],
      confidence: outcome.kind === 'trap' ? 0.8 : 0.55,
      recommendedTool: TOOL_BY_MISTAKE[mistakeType],
      attemptTrace,
      conceptEvidence,
      cards: [
        card('diagnosis', TITLE_BY_MISTAKE[mistakeType], body, conceptsNegative),
        card('fix', 'Fix this one move', step.hint ?? 'Redo only this step, then carry on.', conceptsNegative),
      ],
      beliefUpdates,
      needsClarification: false,
      coachMessage: `${goodPart}${body}`.trim(),
      quickCheck,
      nextMove: NEXT_BY_MISTAKE[mistakeType],
    };
  }

  // ── Case 2: method sound, final answer wrong → execution slip ──
  if (finalCorrect === false) {
    const allConcepts = Array.from(new Set(steps.flatMap((step) => step.conceptIds)));
    return {
      verdict: 'partially_correct',
      mistakeType: 'silly_mistake',
      firstProblemStep: lines[lines.length - 1],
      conceptsPositive: allConcepts,
      conceptsNegative: [],
      sillyMistakeTags: ['final_step_arithmetic'],
      confidence: 0.7,
      recommendedTool: 'check_card',
      attemptTrace,
      conceptEvidence: allConcepts.map((conceptId) => ({
        conceptId, outcome: 'applied_well' as const, confidence: 0.7, reason: 'Method steps present.',
      })),
      cards: [
        card('diagnosis', 'Caught a slip', 'Every idea is in place — the slip is in the arithmetic or option choice at the end. Re-check the last line.'),
        card('check', 'Habit', 'Before locking an answer: re-substitute, check units, re-read what was asked.'),
      ],
      beliefUpdates: allConcepts.map((conceptId) => ({ conceptId, delta: 0.05, reason: 'Method correct; slip at the end.' })),
      needsClarification: false,
      coachMessage: 'Your method is right all the way through — this is a slip, not a concept gap. Re-check the arithmetic in your last line.',
      nextMove: 'try_again',
    };
  }

  // ── Case 3: correct ──
  const shown = outcomes.filter((o) => o.kind === 'matched').length;
  const checked = outcomes.filter((o) => o.kind !== 'unchecked').length;
  const fullyShown = shown === checked;
  const credited = fullyShown ? Array.from(new Set(steps.flatMap((step) => step.conceptIds))) : conceptsPositive;
  return {
    verdict: 'correct',
    mistakeType: 'unclear_evidence',
    conceptsPositive: credited,
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: fullyShown ? 0.85 : 0.6,
    recommendedTool: 'reflection_card',
    attemptTrace,
    conceptEvidence: credited.map((conceptId) => ({
      conceptId, outcome: 'applied_well' as const, confidence: fullyShown ? 0.8 : 0.6, reason: 'Step evidenced in typed work.',
    })),
    cards: [
      card('diagnosis', 'Solid', fullyShown
        ? 'Every step is there and it holds together.'
        : 'Right result. Some steps were not written down, so only the visible ones get credit.'),
    ],
    beliefUpdates: credited.map((conceptId) => ({ conceptId, delta: fullyShown ? 0.1 : 0.05, reason: 'Applied correctly.' })),
    needsClarification: false,
    coachMessage: fullyShown
      ? 'Clean — every step is there. Ready for the next one?'
      : 'That works. Next time write the in-between step too, so I can give you full credit for it.',
    nextMove: 'next_question',
  };
}
