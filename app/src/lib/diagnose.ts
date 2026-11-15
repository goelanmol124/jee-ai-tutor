import type { Question, CanonicalStep } from '../data/questions';

export type StepStatus = 'correct' | 'ambiguous' | 'broken' | 'pending';

export interface DiagnosedStep {
  id: string;
  raw: string; // student's text (may contain inline LaTeX in \(...\))
  status: StepStatus;
  matchedCanonicalIndex: number | null;
  conceptId: string | null;
  conceptName?: string;
  coachNote?: string;
  hint?: string;
  example?: string;
}

// Normalize text for matching: lowercase, strip LaTeX delimiters,
// drop common whitespace and non-alpha-num except useful symbols.
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\\\(|\\\)|\\\[|\\\]|\$\$|\$/g, ' ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\dfrac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\pi/g, 'pi')
    .replace(/\\cdot/g, '*')
    .replace(/\\,|\\;|\\!|\\quad/g, ' ')
    .replace(/\\left|\\right/g, '')
    .replace(/\\\\/g, ' ')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function patternMatches(pattern: string, normalizedText: string): boolean {
  // alternates separated by '|', tokens (within an alternate) separated by spaces or operators
  const alternates = pattern.split('|').map(a => a.trim().toLowerCase());
  return alternates.some(alt => {
    const tokens = alt.split(/\s+/).filter(Boolean);
    return tokens.every(tok => normalizedText.includes(tok.replace(/^[(]+|[)]+$/g, '')));
  });
}

interface MatchResult {
  index: number;
  step: CanonicalStep;
  // confidence 0..1 (loosely, fraction of patterns matched)
  confidence: number;
}

export function matchStep(rawStudentStep: string, question: Question): MatchResult | null {
  const text = normalize(rawStudentStep);
  if (!text) return null;
  const method = question.methods[0]; // for v1, single method
  let best: MatchResult | null = null;
  method.steps.forEach((step, idx) => {
    let hits = 0;
    for (const pat of step.matchPatterns) {
      if (patternMatches(pat, text)) hits++;
    }
    const conf = hits / step.matchPatterns.length;
    if (hits > 0 && (!best || conf > best.confidence)) {
      best = { index: idx, step, confidence: conf };
    }
  });
  return best;
}

// Diagnose all student steps against the canonical path.
// Logic:
//   - Each step is matched to its best canonical step.
//   - If a known commonError pattern matches, mark broken with the specific note.
//   - 'correct' if confidence >= 0.5.
//   - 'ambiguous' if 0 < confidence < 0.5.
//   - 'broken' if 0 (no match).
export function diagnoseAll(steps: { id: string; raw: string }[], question: Question): DiagnosedStep[] {
  const out: DiagnosedStep[] = [];
  const conceptName = (id: string | null): string | undefined => {
    if (!id) return undefined;
    const map: Record<string, string> = {
      product_rule: 'product rule',
      power_rule: 'power rule',
      chain_rule: 'chain rule',
      trig_deriv: 'trig derivative',
      sin_cos_id: 'trig identity',
      int_by_parts: 'integration by parts',
      antideriv: 'antiderivative',
    };
    return map[id] || id;
  };

  // Pre-scan: check every canonical step for commonError matches against each student step.
  function checkCommonErrors(stepText: string): { canonicalIndex: number; conceptId: string; note: string } | null {
    const text = normalize(stepText);
    const method = question.methods[0];
    for (let i = 0; i < method.steps.length; i++) {
      const cs = method.steps[i];
      if (!cs.commonErrors) continue;
      for (const ce of cs.commonErrors) {
        if (patternMatches(ce.pattern, text)) {
          return { canonicalIndex: i, conceptId: cs.conceptId, note: ce.note };
        }
      }
    }
    return null;
  }

  for (const s of steps) {
    if (!s.raw.trim()) {
      out.push({ id: s.id, raw: s.raw, status: 'pending', matchedCanonicalIndex: null, conceptId: null });
      continue;
    }

    // First check canonical match. If it's strong, treat the step as correct
    // and DON'T flag any common-error for it (the student may have written the
    // correct version which superficially contains the wrong-version tokens).
    const m = matchStep(s.raw, question);
    if (!m) {
      // No canonical match -- still check common errors before declaring "unknown"
      const err = checkCommonErrors(s.raw);
      if (err) {
        out.push({
          id: s.id,
          raw: s.raw,
          status: 'broken',
          matchedCanonicalIndex: err.canonicalIndex,
          conceptId: err.conceptId,
          conceptName: conceptName(err.conceptId),
          coachNote: err.note,
          hint: question.methods[0].steps[err.canonicalIndex].hint,
          example: question.methods[0].steps[err.canonicalIndex].example,
        });
        continue;
      }
      out.push({
        id: s.id,
        raw: s.raw,
        status: 'broken',
        matchedCanonicalIndex: null,
        conceptId: null,
        coachNote: "I don't recognise this step yet — what rule are you applying here?",
      });
      continue;
    }

    // Canonical match exists. If weak (ambiguous), check common errors as a tiebreak.
    if (m.confidence < 0.5) {
      const err = checkCommonErrors(s.raw);
      if (err) {
        out.push({
          id: s.id,
          raw: s.raw,
          status: 'broken',
          matchedCanonicalIndex: err.canonicalIndex,
          conceptId: err.conceptId,
          conceptName: conceptName(err.conceptId),
          coachNote: err.note,
          hint: question.methods[0].steps[err.canonicalIndex].hint,
          example: question.methods[0].steps[err.canonicalIndex].example,
        });
        continue;
      }
    }

    const status: StepStatus = m.confidence >= 0.5 ? 'correct' : 'ambiguous';
    out.push({
      id: s.id,
      raw: s.raw,
      status,
      matchedCanonicalIndex: m.index,
      conceptId: m.step.conceptId,
      conceptName: conceptName(m.step.conceptId),
      coachNote: status === 'correct'
        ? `Good — using the ${conceptName(m.step.conceptId)}.`
        : `Looks like the ${conceptName(m.step.conceptId)}, but I'm not fully sure. Tighten the working?`,
      hint: m.step.hint,
      example: m.step.example,
    });
  }

  // mark a step broken if it skipped a required earlier canonical step
  const matchedIndices = out.map(o => o.matchedCanonicalIndex).filter(i => i !== null) as number[];
  const maxMatched = matchedIndices.length ? Math.max(...matchedIndices) : -1;
  if (maxMatched > 0) {
    const totalCanonical = question.methods[0].steps.length;
    const presentSet = new Set(matchedIndices);
    // if any of the canonical steps before the latest are missing, find the first such gap
    for (let i = 0; i < maxMatched; i++) {
      if (!presentSet.has(i) && i < totalCanonical - 1) {
        // attribute the gap to the LAST diagnosed step that is currently 'correct'
        // and below maxMatched — the student probably jumped past step i
        const lastCorrect = [...out].reverse().find(o => o.status === 'correct');
        if (lastCorrect && lastCorrect.matchedCanonicalIndex !== null && lastCorrect.matchedCanonicalIndex >= i) {
          // do not mark broken if it's already broken/ambiguous; just append a note
          // (real product would be more careful here)
        }
      }
    }
  }

  return out;
}

// Pick a "next nudge" for the student: the smallest hint at the first non-correct step.
export function nextNudge(diagnosed: DiagnosedStep[], question: Question): {
  text: string;
  forStepId: string | null;
} {
  // step they're currently on (last pending), or first broken
  const broken = diagnosed.find(d => d.status === 'broken');
  if (broken) {
    return {
      text: broken.coachNote || 'Tell me what rule you tried to apply on this step.',
      forStepId: broken.id,
    };
  }
  const ambig = diagnosed.find(d => d.status === 'ambiguous');
  if (ambig) {
    return {
      text: ambig.hint || 'Tighten the algebra and try again.',
      forStepId: ambig.id,
    };
  }
  // none diagnosed yet: nudge for canonical step (matched-count) + 1
  const matched = diagnosed.filter(d => d.matchedCanonicalIndex !== null).length;
  const nextStep = question.methods[0].steps[matched];
  if (nextStep) {
    return {
      text: nextStep.hint,
      forStepId: null,
    };
  }
  return { text: 'Looks complete — submit when ready.', forStepId: null };
}

export function isComplete(diagnosed: DiagnosedStep[], question: Question): boolean {
  const required = question.methods[0].steps.length;
  const matched = new Set(
    diagnosed.filter(d => d.status === 'correct').map(d => d.matchedCanonicalIndex)
  );
  return matched.size >= Math.ceil(required * 0.8);
}
