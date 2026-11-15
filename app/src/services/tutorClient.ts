import { diagnoseOffline } from './offlineDiagnosis';
import { getLoadedGraph } from './graphStore';
import type {
  AttemptInput,
  CoachFollowupInput,
  CoachFollowupResult,
  DiagnosisResult,
  QuickCheck,
  TutorTool,
  TutorCard,
  TutorToolInput,
  TutorToolResult,
  QuestionNode,
} from '../domain/types';

export type TutorProvider = 'mock' | 'grok';

/** Resolved once; mirrors server capability so Grok is used when `GROK_API_KEY` is set without needing a matching Vite env. */
let cachedProvider: TutorProvider | null = null;
let resolveProviderPromise: Promise<TutorProvider> | null = null;

/**
 * Which backend will run diagnosis / tutor tools.
 * - `VITE_TUTOR_PROVIDER=mock` → always offline mock
 * - `VITE_TUTOR_PROVIDER=grok` → always call `/api/*` (fails loudly if server has no key)
 * - unset → GET `/api/health`: use Grok when `hasGrokKey`, else mock
 */
export async function getTutorProviderAsync(): Promise<TutorProvider> {
  if (cachedProvider !== null) return cachedProvider;
  if (!resolveProviderPromise) {
    resolveProviderPromise = (async (): Promise<TutorProvider> => {
      const env = import.meta.env.VITE_TUTOR_PROVIDER;
      if (env === 'mock') {
        cachedProvider = 'mock';
        return cachedProvider;
      }
      if (env === 'grok') {
        cachedProvider = 'grok';
        return cachedProvider;
      }
      try {
        const res = await fetch('/api/health');
        const data = (await res.json()) as { hasGrokKey?: boolean };
        cachedProvider = data.hasGrokKey ? 'grok' : 'mock';
      } catch {
        cachedProvider = 'mock';
      }
      return cachedProvider;
    })();
  }
  return resolveProviderPromise;
}

/** Warm the provider cache as soon as the app loads (optional). */
export function prefetchTutorProvider(): void {
  void getTutorProviderAsync();
}

/** Sync snapshot after first resolution; otherwise `mock` (UI should prefer async + loading state). */
export function getTutorProvider(): TutorProvider {
  return cachedProvider ?? 'mock';
}

function card(kind: TutorCard['kind'], title: string, body: string, actionLabel?: string, conceptIds?: string[]): TutorCard {
  return {
    id: `${kind}_${Math.random().toString(36).slice(2, 9)}`,
    kind,
    title,
    body,
    actionLabel,
    conceptIds,
  };
}

function mockOrientDiagnosis(question: QuestionNode): DiagnosisResult {
  const target = Array.from(new Set([...question.conceptIds, ...question.prereqIds])).slice(0, 2);
  const conceptLabel = target[0] ?? 'the topic';
  return {
    verdict: 'needs_work',
    mistakeType: 'conceptual_gap',
    firstProblemStep: undefined,
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: 0.6,
    recommendedTool: 'micro_lesson',
    attemptTrace: [],
    conceptEvidence: [],
    cards: [
      card(
        'clarification',
        'Orient',
        `Quick frame: this question is testing ${conceptLabel}. Once you spot that, the first move usually picks itself.`,
        undefined,
        target,
      ),
    ],
    beliefUpdates: [],
    needsClarification: false,
    coachMessage: `Quick frame — this is a ${conceptLabel} question. Spot the pattern first, then try one line and I'll catch it.`,
    nextMove: 'try_again',
  };
}

function mockDeclaredUnknownDiagnosis(question: QuestionNode): DiagnosisResult {
  const questionConceptIds = Array.from(new Set([...question.conceptIds, ...question.prereqIds]));
  const target = questionConceptIds.slice(0, 2);
  const quickCheck: QuickCheck = {
    prompt: 'Quick — which one is closest to where you got stuck?',
    options: [
      { label: 'I don\'t know the topic', correct: true, feedback: 'Got it — let\'s start with one small fact, not the full problem.' },
      { label: 'I forgot the formula', correct: false, feedback: 'Okay, then a 30-second flashcard will jog it back. Let\'s do that.' },
      { label: 'I can\'t even start', correct: false, feedback: 'No worries — first hint coming up. We start at the very edge.' },
    ],
  };
  return {
    verdict: 'needs_work',
    mistakeType: 'conceptual_gap',
    firstProblemStep: 'Not sure how to start yet.',
    conceptsPositive: [],
    conceptsNegative: target,
    sillyMistakeTags: [],
    confidence: 0.55,
    recommendedTool: 'hint_ladder',
    attemptTrace: [
      {
        id: 'trace_unknown',
        raw: "(Student: I don't know how to begin.)",
        status: 'pending',
        conceptIds: target,
        note: 'Start with the smallest checkable fact instead of a full solution.',
        confidence: 0.5,
      },
    ],
    conceptEvidence: target.map((conceptId) => ({
      conceptId,
      outcome: 'missing' as const,
      confidence: 0.7,
      reason: 'Student signalled uncertainty; begin with a definition or quick dimension check.',
    })),
    cards: [
      card(
        'clarification',
        'Honest stop',
        'Calling it honestly — that\'s useful data. We anchor on one small fact and build from there.',
        'Get a hint',
        target,
      ),
      card(
        'next_action',
        'First tiny step',
        'State only the units or definition of ONE item from the question. No matching yet.',
        'Open hint ladder',
        target,
      ),
    ],
    beliefUpdates: target.map((conceptId) => ({
      conceptId,
      delta: -0.06,
      reason: 'Self-reported uncertainty; gentle review of basic facts.',
    })),
    needsClarification: false,
    coachMessage: 'No problem — saying "I don\'t know" is the right move. Let\'s find the smallest piece you DO know and grow from there.',
    quickCheck,
    nextMove: 'see_fix',
  };
}

function mockMcqOnlyDiagnosis(input: AttemptInput): DiagnosisResult {
  const idx = input.mcq?.selectedIndex ?? 0;
  const opt = input.question.options?.[idx] ?? '';
  return {
    verdict: 'unclear',
    mistakeType: 'unclear_evidence',
    firstProblemStep: 'Need the reasoning behind the selected option.',
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: 0.45,
    recommendedTool: 'diagnosis_card',
    attemptTrace: [
      {
        id: 'trace_mcq',
        raw: `Selected option only: ${opt}`,
        status: 'pending',
        conceptIds: [],
        note: 'Add a line of working so feedback targets thinking, not guessing.',
        confidence: 0.4,
      },
    ],
    conceptEvidence: [],
    cards: [
      card(
        'clarification',
        'Add your working',
        'You picked an option — now show me one line of why. Even a quick photo of scratch is enough.',
        'Add working',
      ),
    ],
    beliefUpdates: [],
    needsClarification: true,
    coachMessage: 'You picked an answer, but I can\'t tell from just that whether you reasoned it or guessed. Snap your scratch or type one line — then I can really help.',
    nextMove: 'clarify',
  };
}

export async function mockDiagnoseAttempt(input: AttemptInput): Promise<DiagnosisResult> {
  await new Promise((resolve) => setTimeout(resolve, 650));

  const hasImage = Boolean(input.imageDataUrl || input.imageFile);
  if (input.mcq?.requestedOrient && !input.typedWork?.trim() && !hasImage) {
    return mockOrientDiagnosis(input.question);
  }
  if (input.mcq?.declaredUnknown && !input.typedWork?.trim() && !hasImage) {
    return mockDeclaredUnknownDiagnosis(input.question);
  }
  if (
    input.mcq?.selectedIndex != null &&
    !input.typedWork?.trim() &&
    !hasImage
  ) {
    return mockMcqOnlyDiagnosis(input);
  }

  return diagnoseOffline({
    question: input.question,
    typedWork: input.typedWork,
    selectedIndex: input.mcq?.selectedIndex,
    hasImage,
    graph: getLoadedGraph(),
  });
}

export async function diagnoseAttempt(input: AttemptInput): Promise<DiagnosisResult> {
  if ((await getTutorProviderAsync()) === 'mock') {
    return mockDiagnoseAttempt(input);
  }

  const form = new FormData();
  form.set('question', JSON.stringify(input.question));
  form.set('studentState', JSON.stringify(input.studentState));
  if (input.typedWork) form.set('typedWork', input.typedWork);
  if (input.imageFile) form.set('image', input.imageFile);
  if (input.imageDataUrl) form.set('imageDataUrl', input.imageDataUrl);
  if (input.mcq) form.set('mcq', JSON.stringify(input.mcq));

  const response = await fetch('/api/diagnose', {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined) as Partial<DiagnosisResult> | undefined;
    if (body?.verdict && Array.isArray(body.cards)) {
      return body as DiagnosisResult;
    }
    const reason = body?.firstProblemStep || body?.cards?.[0]?.body;
    throw new Error(reason ? `Diagnosis failed (${response.status}): ${reason}` : `Diagnosis failed (${response.status})`);
  }

  return response.json() as Promise<DiagnosisResult>;
}

function mockTutorTool(input: TutorToolInput): TutorToolResult {
  const targetConceptIds = input.targetConceptIds.length
    ? input.targetConceptIds
    : [...input.diagnosis.conceptsNegative, ...input.diagnosis.conceptsPositive].slice(0, 2);
  const titleByTool: Record<TutorTool, string> = {
    diagnosis_card: 'Read the diagnosis once',
    hint_ladder: 'Hint ladder',
    micro_lesson: 'One-minute lesson',
    worked_example: 'Worked sibling example',
    splice: 'Tiny splice',
    micro_drill: 'Two-step drill',
    full_drill: 'Full practice problem',
    flashcard: 'Recall card',
    check_card: 'Quick check habit',
    reflection_card: 'Make it reusable',
  };

  return {
    tool: input.tool,
    title: titleByTool[input.tool],
    intent: 'Turn the diagnosis into one small action before moving on.',
    targetConceptIds,
    successCriteria: 'You can complete the same fragile move once without a hint.',
    cards: [
      card('fix', titleByTool[input.tool], `Focus on ${targetConceptIds[0] ?? 'the fragile idea'} from this question. State the rule, then apply it to one smaller example.`, undefined, targetConceptIds),
      card('next_action', 'Try this now', 'Write only the next mathematical move, not the full solution. If it feels easy, return to the original problem.', 'Done', targetConceptIds),
    ],
  };
}

export async function generateTutorTool(input: TutorToolInput): Promise<TutorToolResult> {
  if ((await getTutorProviderAsync()) === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return mockTutorTool(input);
  }

  const response = await fetch('/api/tutor-tool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!response.ok && response.status !== 503) {
    throw new Error(`Tutor action failed (${response.status})`);
  }

  return response.json() as Promise<TutorToolResult>;
}

/* ──────────────────────────────────────────────
   Multi-turn coach follow-up
   ────────────────────────────────────────────── */

function mockCoachFollowup(input: CoachFollowupInput): CoachFollowupResult {
  const { studentMessage } = input;
  if (studentMessage.kind === 'chip' && studentMessage.chipId === 'got_it') {
    return {
      coachMessage: 'Awesome — you locked in the fix. Want to retry or move on?',
      conversationDone: true,
      suggestedAction: 'try_again',
    };
  }
  if (studentMessage.kind === 'chip' && studentMessage.chipId === 'still_confused') {
    return {
      coachMessage: 'No worries — let\'s slow down. Tell me which line in your work you thought was OK and I\'ll check it.',
      suggestedAction: null,
    };
  }
  if (studentMessage.kind === 'chip' && studentMessage.chipId === 'why') {
    return {
      coachMessage: input.diagnosis.cards.find((c) => c.kind === 'diagnosis')?.body
        ?? 'Because that step is where the idea was needed — redo just that move.',
      suggestedAction: null,
    };
  }
  if (studentMessage.kind === 'chip' && studentMessage.chipId === 'show_me_more') {
    return {
      coachMessage: input.diagnosis.cards.find((c) => c.kind === 'fix')?.body
        ?? 'Try the same move on a smaller example first, then come back to this one.',
      suggestedAction: null,
    };
  }
  if (studentMessage.kind === 'qc_pick') {
    return {
      coachMessage: studentMessage.pickedCorrect
        ? `Nice — ${studentMessage.pickedLabel} is the move. Now apply that back to the original step.`
        : `Not quite — ${studentMessage.pickedLabel} skips a piece. The check needed both halves of the formula. Want a hint?`,
      suggestedAction: studentMessage.pickedCorrect ? 'try_again' : null,
    };
  }
  return {
    coachMessage: 'Offline coach: tell me which line you are unsure about, or type your next step and diagnose again. (Set an API key on the server for free-form conversation.)',
  };
}

export async function coachFollowup(input: CoachFollowupInput): Promise<CoachFollowupResult> {
  if ((await getTutorProviderAsync()) === 'mock') {
    await new Promise((resolve) => setTimeout(resolve, 350));
    return mockCoachFollowup(input);
  }

  const response = await fetch('/api/coach-followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: input.question,
      studentState: input.studentState,
      diagnosis: input.diagnosis,
      conversation: input.conversation,
      studentMessage: input.studentMessage,
    }),
  });

  if (!response.ok && response.status !== 503) {
    // Server returns a fallback shape even on errors so we can still render something.
    const body = await response.json().catch(() => undefined) as Partial<CoachFollowupResult> | undefined;
    if (body?.coachMessage) return body as CoachFollowupResult;
    throw new Error(`Coach follow-up failed (${response.status})`);
  }

  return response.json() as Promise<CoachFollowupResult>;
}
