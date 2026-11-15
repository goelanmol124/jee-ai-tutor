import type { CoachFollowupResult, QuickCheck, QuickCheckOption } from '../src/domain/types';

/**
 * Strip option-letter leakage from any coach-facing text.
 * Catches "match option A", "lands on option B", "option C is right",
 * "to match option D", and similar variants. Replaces with a softer
 * phrasing that focuses on the reasoning rather than the option.
 *
 * This is a hard server-side safety net — the prompt rule should be the
 * primary defence, but the model occasionally slips through and we'd rather
 * mangle one sentence than ship "the answer is option C" to the student.
 */
export function scrubOptionLeakage(text: string): string {
  if (!text) return text;
  return text
    // "match option X" / "matches option X" / "to match option X"
    .replace(/\b(?:to\s+)?match(?:es|ing|ed)?\s+option\s+[a-d]\b/gi, 'land on the right form')
    // "lands on option X" / "land at option X" / "lands at option X"
    .replace(/\blands?\s+(?:on|at|to)\s+option\s+[a-d]\b/gi, 'lines up with the right form')
    // "picked option X is right/correct"
    .replace(/\b(?:option|choice)\s+[a-d]\s+is\s+(?:right|correct|the\s+answer)\b/gi, 'your reasoning lines up')
    // "you've got option X" / "you have option X"
    .replace(/\b(?:you(?:'ve|\s+have))\s+got(?:ten)?\s+option\s+[a-d]\b/gi, 'you got there')
    // bare "option X" reference
    .replace(/\b(?:that|this|it)(?:'s|\s+is)\s+option\s+[a-d]\b/gi, 'your reasoning is on the right track')
    .replace(/\boption\s+[a-d]\s*$/gi, 'the right form');
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Strip whitespace + LaTeX delimiters so paraphrased equivalents collide on
 * dedupe. (Same heuristic as validateDiagnosis.normalizeOptionLabel.)
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
  if (raw === null || raw === undefined) return undefined;
  if (!isObj(raw)) return undefined;
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
      feedback: feedback || (item.correct === true ? 'Yes — that one.' : 'Not quite — see the coach note above.'),
    });
  }
  if (options.length < 2) return undefined;
  const seen = new Set<string>();
  const deduped: QuickCheckOption[] = [];
  for (const opt of options) {
    const key = normalizeOptionLabel(opt.label);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(opt);
  }
  if (deduped.length < 2) return undefined;
  // Drop QC entirely if no option is marked correct — silently picking option A
  // would teach the student a lie if A happens to be wrong.
  if (!deduped.some((o) => o.correct)) return undefined;
  return { prompt, options: deduped.slice(0, 4) };
}

const ACTIONS = new Set<NonNullable<CoachFollowupResult['suggestedAction']>>([
  'see_fix',
  'try_again',
  'next_question',
]);

/**
 * Forgiving validator for the coach follow-up turn. Drops bad fields rather than throwing
 * so a malformed sub-field never silences the whole reply.
 */
export function validateCoachFollowup(raw: unknown): CoachFollowupResult {
  if (!isObj(raw)) {
    return {
      coachMessage: 'Hmm — let me try that again. Can you tell me which step you got stuck on?',
    };
  }

  const coachMessage = scrubOptionLeakage(
    typeof raw.coachMessage === 'string' && raw.coachMessage.trim()
      ? raw.coachMessage.trim()
      : 'Got it — want to try the next step?',
  );

  let quickCheck = parseQuickCheck(raw.quickCheck);
  const conversationDone = raw.conversationDone === true;

  const suggestedActionRaw = typeof raw.suggestedAction === 'string' ? raw.suggestedAction : null;
  const suggestedAction = suggestedActionRaw && ACTIONS.has(suggestedActionRaw as NonNullable<CoachFollowupResult['suggestedAction']>)
    ? (suggestedActionRaw as NonNullable<CoachFollowupResult['suggestedAction']>)
    : null;

  // If the coach decided to escalate to the worked-example tool, asking another
  // micro-question in the same bubble is exactly the "drowning student gets a
  // new puzzle" failure mode. Strip the QC server-side so the prompt rule can't
  // be violated by the LLM.
  if (suggestedAction === 'see_fix') quickCheck = undefined;
  // If the coach declared the conversation done, an open QC keeps the student
  // tethered with no obvious next move. Drop it.
  if (conversationDone) quickCheck = undefined;

  return {
    coachMessage,
    quickCheck,
    conversationDone,
    suggestedAction,
  };
}

export function fallbackCoachFollowup(message: string): CoachFollowupResult {
  return {
    coachMessage: message,
    suggestedAction: null,
    conversationDone: false,
  };
}
