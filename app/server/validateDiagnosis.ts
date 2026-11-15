import type {
  AttemptStepStatus,
  AttemptStepTrace,
  ConceptEvidence,
  ConceptEvidenceOutcome,
  DiagnosisResult,
  MistakeType,
  NextMoveKind,
  QuickCheck,
  QuickCheckOption,
  TutorCard,
  TutorCardKind,
  TutorTool,
} from '../src/domain/types';
import {
  compileStagedDiagnosis,
  scanAnswerLeakage,
  scrubOptionLeakage,
  stagedToDiagnosisResult,
  type RawStagedDiagnosisInput,
  type StagedDiagnosisBundle,
} from './diagnosis';

const NEXT_MOVES = new Set<NextMoveKind>(['try_again', 'see_fix', 'micro_drill', 'next_question', 'clarify']);

const VERDICTS = new Set<DiagnosisResult['verdict']>(['correct', 'partially_correct', 'needs_work', 'unclear']);
const MISTAKE_TYPES = new Set<MistakeType>(['conceptual_gap', 'wrong_understanding', 'procedure_error', 'silly_mistake', 'unclear_evidence']);
const TUTOR_TOOLS = new Set<TutorTool>([
  'diagnosis_card',
  'hint_ladder',
  'micro_lesson',
  'worked_example',
  'splice',
  'micro_drill',
  'full_drill',
  'flashcard',
  'check_card',
  'reflection_card',
]);
const CARD_KINDS = new Set<TutorCardKind>(['diagnosis', 'fix', 'next_action', 'check', 'reflection', 'clarification']);
const STEP_STATUSES = new Set<AttemptStepStatus>(['correct', 'ambiguous', 'broken', 'pending']);
const EVIDENCE_OUTCOMES = new Set<ConceptEvidenceOutcome>(['applied_well', 'fragile', 'missing', 'not_applicable']);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function reqStr(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v !== 'string' || !v.trim()) throw new Error(`Missing or invalid string: ${key}`);
  return v;
}

function optStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') throw new Error(`Invalid optional string: ${key}`);
  return v;
}

function numRange(v: unknown, lo: number, hi: number, ctx: string): number {
  if (typeof v !== 'number' || Number.isNaN(v)) throw new Error(`Invalid number: ${ctx}`);
  if (v < lo || v > hi) throw new Error(`Out of range [${lo}, ${hi}]: ${ctx}`);
  return v;
}

function reqStrArray(v: unknown, ctx: string): string[] {
  if (!Array.isArray(v)) throw new Error(`Expected array: ${ctx}`);
  return v.map((x, i) => {
    if (typeof x !== 'string') throw new Error(`Expected string in ${ctx}[${i}]`);
    return x;
  });
}

function parseCard(raw: unknown, i: number): TutorCard {
  if (!isObj(raw)) throw new Error(`Invalid card[${i}]`);
  const kind = raw.kind;
  if (!CARD_KINDS.has(kind as TutorCardKind)) throw new Error(`Invalid card kind at [${i}]`);
  const conceptIds = raw.conceptIds === undefined ? undefined : reqStrArray(raw.conceptIds, `cards[${i}].conceptIds`);
  return {
    id: reqStr(raw, 'id'),
    kind: kind as TutorCardKind,
    title: reqStr(raw, 'title'),
    body: reqStr(raw, 'body'),
    actionLabel: optStr(raw, 'actionLabel'),
    conceptIds,
  };
}

function parseAttemptStep(raw: unknown, i: number): AttemptStepTrace {
  if (!isObj(raw)) throw new Error(`Invalid attemptTrace[${i}]`);
  const status = raw.status;
  if (!STEP_STATUSES.has(status as AttemptStepStatus)) throw new Error(`Invalid attemptTrace[${i}].status`);
  const conceptIds = reqStrArray(raw.conceptIds ?? [], `attemptTrace[${i}].conceptIds`);
  return {
    id: reqStr(raw, 'id'),
    raw: typeof raw.raw === 'string' ? raw.raw : '',
    status: status as AttemptStepStatus,
    canonicalStepId: optStr(raw, 'canonicalStepId'),
    conceptIds,
    note: optStr(raw, 'note'),
    confidence: numRange(raw.confidence, 0, 1, `attemptTrace[${i}].confidence`),
  };
}

/**
 * Cheap "are these two option labels essentially the same?" check. We strip
 * whitespace, LaTeX delimiters, and a handful of common LaTeX command tokens
 * so that "\\frac{a+1+2t}{2}" and "(a+1+2t)/2" don't sneak past as different
 * options. This catches the most common LLM failure mode (paraphrased
 * equivalents). It does NOT do real math equivalence — that's what the prompt
 * rule is for.
 */
function normalizeOptionLabel(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, '')
    .replace(/\\(left|right|cdot|times|,|;|!|:|\s)/g, '')
    .replace(/\s+/g, '')
    .replace(/[{}]/g, '');
}

function parseQuickCheck(raw: unknown): QuickCheck | undefined {
  if (process.env.COACH_DISABLE_QUICKCHECKS === '1') return undefined;
  if (!isObj(raw) || raw === null) return undefined;
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  const optionsRaw = Array.isArray(raw.options) ? raw.options : [];
  if (!prompt || optionsRaw.length < 2) return undefined;
  const options: QuickCheckOption[] = [];
  for (const item of optionsRaw) {
    if (!isObj(item)) continue;
    const label = typeof item.label === 'string' ? item.label.trim() : '';
    const feedback = typeof item.feedback === 'string' ? item.feedback.trim() : '';
    if (!label) continue;
    options.push({
      label,
      correct: item.correct === true,
      feedback: feedback || (item.correct === true ? 'Yes — exactly that.' : 'Not quite — see the coach note above.'),
    });
  }
  if (options.length < 2) return undefined;
  // Drop trivially-equivalent options (same after stripping LaTeX/whitespace).
  const seen = new Set<string>();
  const deduped: QuickCheckOption[] = [];
  for (const opt of options) {
    const key = normalizeOptionLabel(opt.label);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(opt);
  }
  // If dedup leaves us with fewer than 2 distinct options, the quickCheck is
  // useless (and probably embarrassing). Drop the whole thing.
  if (deduped.length < 2) return undefined;
  // If the LLM forgot to mark any option as correct, the QC is untrustworthy
  // (we don't know which is right, and silently picking the first one would
  // teach the student a lie). Drop the whole QC.
  if (!deduped.some((option) => option.correct)) return undefined;
  return { prompt, options: deduped.slice(0, 4) };
}

function parseEvidence(raw: unknown, i: number): ConceptEvidence {
  if (!isObj(raw)) throw new Error(`Invalid conceptEvidence[${i}]`);
  const outcome = raw.outcome;
  if (!EVIDENCE_OUTCOMES.has(outcome as ConceptEvidenceOutcome)) {
    throw new Error(`Invalid conceptEvidence[${i}].outcome`);
  }
  return {
    conceptId: reqStr(raw, 'conceptId'),
    outcome: outcome as ConceptEvidenceOutcome,
    confidence: numRange(raw.confidence, 0, 1, `conceptEvidence[${i}].confidence`),
    reason: reqStr(raw, 'reason'),
  };
}

function scrubCoachFields(
  coachMessage: string | undefined,
  quickCheck: QuickCheck | undefined,
  forbiddenAnswerTokens: string[] = [],
): { coachMessage?: string; quickCheck?: QuickCheck; leaked: boolean } {
  let leaked = false;
  let msg = coachMessage;
  if (msg) {
    const scan = scanAnswerLeakage(msg, forbiddenAnswerTokens);
    leaked = leaked || scan.leaked;
    msg = scan.scrubbedText;
  }

  let qc = quickCheck;
  if (qc) {
    const promptScan = scanAnswerLeakage(qc.prompt, forbiddenAnswerTokens);
    leaked = leaked || promptScan.leaked;
    const options = qc.options.map((o) => {
      const labelScan = scanAnswerLeakage(o.label, forbiddenAnswerTokens);
      const fbScan = scanAnswerLeakage(o.feedback, forbiddenAnswerTokens);
      leaked = leaked || labelScan.leaked || fbScan.leaked;
      return {
        ...o,
        label: labelScan.scrubbedText,
        feedback: fbScan.scrubbedText,
      };
    });
    qc = { prompt: promptScan.scrubbedText, options };
  }

  return { coachMessage: msg, quickCheck: qc, leaked };
}

export interface ValidateDiagnosisOptions {
  /** Final answer / option tokens that must never appear in student-facing text. */
  forbiddenAnswerTokens?: string[];
  /**
   * When true, force unclear + empty beliefUpdates (capture failure path).
   * Used by staged pipeline adapters; safe default false for legacy callers.
   */
  captureFailure?: boolean;
}

/**
 * Structural validation for tutor JSON. Throws Error with a short message on failure.
 * For non-critical fields (verdict, mistakeType, recommendedTool, confidence) we coerce
 * to safe defaults rather than throwing, so a minor enum hiccup doesn't kill the bubble.
 */
export function validateDiagnosis(raw: unknown, opts: ValidateDiagnosisOptions = {}): DiagnosisResult {
  if (!isObj(raw)) throw new Error('Model returned non-object JSON');

  let verdict = VERDICTS.has(raw.verdict as DiagnosisResult['verdict'])
    ? (raw.verdict as DiagnosisResult['verdict'])
    : 'needs_work';

  let mistakeType = MISTAKE_TYPES.has(raw.mistakeType as MistakeType)
    ? (raw.mistakeType as MistakeType)
    : 'procedure_error';

  // Verdict ↔ mistakeType consistency. Empirically, the LLM keeps fabricating
  // "tiny notation slip" / "minor procedural slip" even on demonstrably clean
  // student work, then setting mistakeType="silly_mistake". This caused the UI
  // to flash "Caught a slip" when nothing was wrong. Hard rule:
  //   verdict === 'correct'  → mistakeType is ALWAYS 'unclear_evidence'.
  //                            Also wipe firstProblemStep + sillyMistakeTags so
  //                            downstream rendering can never show a fake slip.
  //   verdict === 'unclear'  → mistakeType is ALWAYS 'unclear_evidence'.
  // We accept the rare case where the student really did self-correct a tiny
  // slip mid-working — losing that nuance is a fair trade for never lying.
  if (opts.captureFailure) {
    verdict = 'unclear';
    mistakeType = 'unclear_evidence';
  }
  if (verdict === 'correct') {
    mistakeType = 'unclear_evidence';
    if (typeof raw.firstProblemStep === 'string') (raw as { firstProblemStep?: unknown }).firstProblemStep = undefined;
    if (Array.isArray(raw.sillyMistakeTags)) (raw as { sillyMistakeTags?: unknown }).sillyMistakeTags = [];
  }
  if (verdict === 'unclear') {
    mistakeType = 'unclear_evidence';
  }

  const recommendedTool = TUTOR_TOOLS.has(raw.recommendedTool as TutorTool)
    ? (raw.recommendedTool as TutorTool)
    : 'micro_lesson';

  const confidence = typeof raw.confidence === 'number' && raw.confidence >= 0 && raw.confidence <= 1
    ? raw.confidence
    : 0.5;

  // Background-plumbing fields. Drop bad entries silently — never fail the whole diagnosis
  // because of a malformed card / trace / belief update. The chat bubble must always reach the user.
  const cardsRaw = Array.isArray(raw.cards) ? raw.cards : [];
  const parsedCards: TutorCard[] = [];
  cardsRaw.forEach((c, i) => {
    try { parsedCards.push(parseCard(c, i)); } catch { /* drop bad card */ }
  });
  if (parsedCards.length === 0) {
    parsedCards.push({
      id: 'auto_diag',
      kind: 'diagnosis',
      title: 'Read the coach note',
      body: typeof raw.coachMessage === 'string' && raw.coachMessage.trim() ? raw.coachMessage.trim() : 'Coach feedback is in the chat bubble.',
    });
  }

  // State-update gating: unclear / capture failure must not carry negative belief updates
  const gateBeliefs = opts.captureFailure || verdict === 'unclear';
  const updatesRaw = gateBeliefs ? [] : (Array.isArray(raw.beliefUpdates) ? raw.beliefUpdates : []);
  const parsedUpdates = updatesRaw.flatMap((u, i) => {
    if (!isObj(u)) return [];
    try {
      const delta = numRange(u.delta, -0.25, 0.25, `beliefUpdates[${i}].delta`);
      return [{
        conceptId: reqStr(u, 'conceptId'),
        delta,
        reason: reqStr(u, 'reason'),
      }];
    } catch {
      return [];
    }
  });

  const traceRaw = Array.isArray(raw.attemptTrace) ? raw.attemptTrace : [];
  const parsedTrace: AttemptStepTrace[] = [];
  traceRaw.forEach((t, i) => {
    try { parsedTrace.push(parseAttemptStep(t, i)); } catch { /* drop */ }
  });

  const evidenceRaw = gateBeliefs ? [] : (Array.isArray(raw.conceptEvidence) ? raw.conceptEvidence : []);
  const parsedEvidence: ConceptEvidence[] = [];
  evidenceRaw.forEach((e, i) => {
    try { parsedEvidence.push(parseEvidence(e, i)); } catch { /* drop */ }
  });

  const needsClarification = raw.needsClarification === true || opts.captureFailure === true || verdict === 'unclear';

  const rawCoach = typeof raw.coachMessage === 'string' && raw.coachMessage.trim()
    ? scrubOptionLeakage(raw.coachMessage.trim())
    : undefined;
  const scrubbed = scrubCoachFields(rawCoach, parseQuickCheck(raw.quickCheck), opts.forbiddenAnswerTokens);
  // If leakage was detected even after scrub, force clarify — never ship a leaking definitive bubble
  let nextMoveRaw = typeof raw.nextMove === 'string' ? raw.nextMove : undefined;
  if (scrubbed.leaked) {
    nextMoveRaw = 'clarify';
  }
  const nextMove = nextMoveRaw && NEXT_MOVES.has(nextMoveRaw as NextMoveKind)
    ? (nextMoveRaw as NextMoveKind)
    : undefined;

  // Scrub card bodies too
  const scrubbedCards = parsedCards.map((card) => {
    const bodyScan = scanAnswerLeakage(card.body, opts.forbiddenAnswerTokens);
    return { ...card, body: bodyScan.scrubbedText };
  });

  return {
    verdict: scrubbed.leaked && verdict === 'correct' ? 'unclear' : verdict,
    mistakeType: scrubbed.leaked && verdict === 'correct' ? 'unclear_evidence' : mistakeType,
    firstProblemStep: optStr(raw, 'firstProblemStep'),
    conceptsPositive: reqStrArray(raw.conceptsPositive ?? [], 'conceptsPositive'),
    conceptsNegative: gateBeliefs ? [] : reqStrArray(raw.conceptsNegative ?? [], 'conceptsNegative'),
    sillyMistakeTags: reqStrArray(raw.sillyMistakeTags ?? [], 'sillyMistakeTags'),
    confidence,
    recommendedTool,
    attemptTrace: parsedTrace,
    conceptEvidence: parsedEvidence,
    cards: scrubbedCards,
    beliefUpdates: parsedUpdates,
    needsClarification: needsClarification || scrubbed.leaked,
    coachMessage: scrubbed.coachMessage,
    quickCheck: scrubbed.quickCheck,
    nextMove: scrubbed.leaked ? 'clarify' : nextMove,
  };
}

/**
 * Compile a staged W2 payload and adapt to DiagnosisResult.
 * Prefer this path when multi-page capture metadata is available.
 */
export function validateStagedDiagnosis(raw: RawStagedDiagnosisInput): {
  bundle: StagedDiagnosisBundle;
  result: DiagnosisResult;
} {
  const bundle = compileStagedDiagnosis(raw);
  const result = stagedToDiagnosisResult(bundle);
  // Re-run legacy validator for field normalization + leakage scrub
  const normalized = validateDiagnosis(result, {
    forbiddenAnswerTokens: raw.forbiddenAnswerTokens,
    captureFailure: bundle.captureAssessment.isCaptureFailure,
  });
  return { bundle, result: normalized };
}

export function unclearDiagnosisResult(message: string): DiagnosisResult {
  const scrubbed = scanAnswerLeakage(message).scrubbedText;
  return {
    verdict: 'unclear',
    mistakeType: 'unclear_evidence',
    firstProblemStep: scrubbed,
    conceptsPositive: [],
    conceptsNegative: [],
    sillyMistakeTags: [],
    confidence: 0.2,
    recommendedTool: 'diagnosis_card',
    attemptTrace: [],
    conceptEvidence: [],
    cards: [{
      id: 'unclear_photo',
      kind: 'clarification',
      title: 'Need a clearer look',
      body: scrubbed,
      actionLabel: 'Retake photo',
    }],
    beliefUpdates: [],
    needsClarification: true,
    coachMessage: scrubbed,
    nextMove: 'clarify',
  };
}
