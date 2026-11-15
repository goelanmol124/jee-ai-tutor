/**
 * Zero answer-leakage policy for active problems.
 * Structural scrub + detection for coach-facing text.
 */

export interface LeakageScanResult {
  leaked: boolean;
  reasons: string[];
  scrubbedText: string;
}

const OPTION_LEAK_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /\b(?:to\s+)?match(?:es|ing|ed)?\s+option\s+[a-d]\b/gi, replacement: 'land on the right form' },
  { re: /\blands?\s+(?:on|at|to)\s+option\s+[a-d]\b/gi, replacement: 'lines up with the right form' },
  { re: /\b(?:option|choice)\s+[a-d]\s+is\s+(?:right|correct|the\s+answer)\b/gi, replacement: 'your reasoning lines up' },
  { re: /\b(?:you(?:'ve|\s+have))\s+got(?:ten)?\s+option\s+[a-d]\b/gi, replacement: 'you got there' },
  { re: /\b(?:that|this|it)(?:'s|\s+is)\s+option\s+[a-d]\b/gi, replacement: 'your reasoning is on the right track' },
  { re: /\bthe\s+answer\s+is\s+option\s+[a-d]\b/gi, replacement: 'your path is on track' },
  { re: /\bcorrect\s+option\s+is\s+[a-d]\b/gi, replacement: 'your reasoning is on track' },
  { re: /\boption\s+[a-d]\s*$/gi, replacement: 'the right form' },
];

const ANSWER_PHRASE_RE =
  /\b(?:the\s+)?(?:final\s+)?answer\s+is\s+[^=\n]{1,40}/i;

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\\(|\\\)|\\\[|\\\]|\$/g, '')
    .replace(/\s+/g, '')
    .replace(/[{}]/g, '');
}

/**
 * Scrub option-letter leakage (compatible with validateCoachFollowup heuristics).
 */
export function scrubOptionLeakage(text: string): string {
  if (!text) return text;
  let out = text;
  for (const { re, replacement } of OPTION_LEAK_PATTERNS) {
    out = out.replace(re, replacement);
  }
  return out;
}

/**
 * Detect and scrub answer leakage against optional forbidden tokens
 * (final numeric/symbolic answers, option labels).
 */
export function scanAnswerLeakage(
  text: string,
  forbiddenAnswerTokens: string[] = [],
): LeakageScanResult {
  const reasons: string[] = [];
  let scrubbed = scrubOptionLeakage(text);

  if (ANSWER_PHRASE_RE.test(text)) {
    reasons.push('answer_is_phrase');
    scrubbed = scrubbed.replace(ANSWER_PHRASE_RE, 'the next step is yours to finish');
  }

  // Bare "option X" confirmatory patterns left after scrub
  if (/\boption\s+[a-d]\b/i.test(scrubbed)) {
    reasons.push('option_letter_reference');
    scrubbed = scrubbed.replace(/\boption\s+[a-d]\b/gi, 'the right form');
  }

  const hay = normalizeToken(scrubbed);
  for (const token of forbiddenAnswerTokens) {
    const t = token.trim();
    if (!t || t.length < 1) continue;
    const norm = normalizeToken(t);
    if (norm.length < 1) continue;
    // Avoid ultra-short tokens (single letters) unless they look like full answers
    if (norm.length <= 1) continue;
    if (hay.includes(norm)) {
      reasons.push(`forbidden_token:${t}`);
      // Soft-redact occurrences case-insensitively in original-ish form
      const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      scrubbed = scrubbed.replace(new RegExp(escaped, 'gi'), '[redacted]');
    }
  }

  return {
    leaked: reasons.length > 0,
    reasons,
    scrubbedText: scrubbed,
  };
}

/** True when any student-facing field leaks answers. */
export function anyAnswerLeakage(
  fields: Array<string | undefined | null>,
  forbiddenAnswerTokens: string[] = [],
): { leaked: boolean; reasons: string[]; scrubbed: string[] } {
  const reasons: string[] = [];
  const scrubbed: string[] = [];
  for (const field of fields) {
    if (!field) {
      scrubbed.push('');
      continue;
    }
    const scan = scanAnswerLeakage(field, forbiddenAnswerTokens);
    if (scan.leaked) reasons.push(...scan.reasons);
    scrubbed.push(scan.scrubbedText);
  }
  return { leaked: reasons.length > 0, reasons, scrubbed };
}
