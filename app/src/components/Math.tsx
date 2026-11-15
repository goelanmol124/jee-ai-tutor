import { useMemo } from 'react';
import katex from 'katex';
// Side-effect import: registers the \ce{...} chemistry macro into katex's global parser.
// Needed for chemistry questions like "\\ce{C5H12}" to render instead of showing raw text.
import 'katex/contrib/mhchem/mhchem.js';

interface InlineMathProps {
  // Source string. Supports \( ... \) for inline math and \[ ... \] for display math.
  // $...$ and $$...$$ are normalized to those delimiters. LaTeX tabular is rendered as HTML.
  // Anything outside delimiters renders as plain text.
  children: string;
  className?: string;
  // If true, render on its own line at larger size.
  display?: boolean;
}

// Render KaTeX safely.
function renderTex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      output: 'html',
    });
  } catch {
    return tex;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * If a string contains LaTeX commands like \cos, \frac, \alpha but NO \(...\) / \[...\] / $...$
 * delimiters, the LLM probably forgot to wrap the math. Best-effort: wrap the longest
 * contiguous "math-ish" segments in \( ... \) so KaTeX can render them.
 *
 * Two cases handled:
 *   (a) Whole string is math-ish (a chemistry formula, an option label, a single equation).
 *       Wrap the whole string.
 *   (b) Math-ish tokens appear in the middle of prose (e.g. "alkane formula C_nH_{2n+2}, so…").
 *       Wrap those tokens individually so the surrounding prose stays prose.
 */
function autoWrapBareLatex(src: string): string {
  if (src.includes('$')) return src;

  // If the string contains NO existing math delimiters, handle the whole string.
  const hasInline = src.includes('\\(');
  const hasDisplay = src.includes('\\[');

  if (!hasInline && !hasDisplay) {
    const hasCommand = /\\[a-zA-Z]+/.test(src);
    const hasSubSup = /[A-Za-z\d]_(\{[^}]+\}|[A-Za-z\d])|[A-Za-z\d]\^(\{[^}]+\}|[A-Za-z\d])/.test(src);
    if (!hasCommand && !hasSubSup) return src;
    if (src.length <= 40) return `\\(${src.trim()}\\)`;
    return wrapMathTokensInProse(src);
  }

  // Mixed string: some math is already wrapped, but the model may have left
  // bare LaTeX outside the delimiters (e.g. "If \frac{3}{4} I_\max , then \( \cos^2(\phi/2) \) = ?").
  // Walk the string, leaving math regions untouched and wrapping bare math tokens in
  // the prose regions in between.
  let out = '';
  let i = 0;
  while (i < src.length) {
    const inlineStart = src.indexOf('\\(', i);
    const displayStart = src.indexOf('\\[', i);
    let nextStart: number;
    let endToken: string;
    if (inlineStart === -1 && displayStart === -1) {
      out += wrapMathTokensInProse(src.slice(i));
      break;
    }
    if (inlineStart === -1) {
      nextStart = displayStart;
      endToken = '\\]';
    } else if (displayStart === -1) {
      nextStart = inlineStart;
      endToken = '\\)';
    } else if (inlineStart < displayStart) {
      nextStart = inlineStart;
      endToken = '\\)';
    } else {
      nextStart = displayStart;
      endToken = '\\]';
    }
    if (nextStart > i) out += wrapMathTokensInProse(src.slice(i, nextStart));
    const endIdx = src.indexOf(endToken, nextStart + 2);
    if (endIdx === -1) {
      // Unclosed — let parseMixed handle the recovery, but pass through unchanged.
      out += src.slice(nextStart);
      break;
    }
    out += src.slice(nextStart, endIdx + 2);
    i = endIdx + 2;
  }
  return out;
}

/**
 * Walk a prose chunk and wrap bare math-ish tokens in \( ... \). Used by
 * autoWrapBareLatex for the prose-between-math regions in a partially-wrapped string.
 *
 * Strategy: find each individual math-ish seed (backslash command or sub/sup token),
 * wrap it. Then a post-pass merges adjacent wrapped tokens that are separated by
 * only whitespace + math operators — so `\frac{3}{4} I_\max` becomes a SINGLE
 * math region instead of two.
 */
function wrapMathTokensInProse(prose: string): string {
  if (!prose) return prose;
  const hasCommand = /\\[a-zA-Z]+/.test(prose);
  const hasSubSup = /[A-Za-z\d]_(\{[^}]+\}|[A-Za-z\d])|[A-Za-z\d]\^(\{[^}]+\}|[A-Za-z\d])/.test(prose);
  if (!hasCommand && !hasSubSup) return prose;
  const trimmed = prose.trim();
  if (trimmed.length <= 40) {
    const lead = prose.slice(0, prose.indexOf(trimmed));
    const tail = prose.slice(prose.indexOf(trimmed) + trimmed.length);
    return `${lead}\\(${trimmed}\\)${tail}`;
  }
  // Pass 1: wrap each math seed (with adjacent non-space chars eaten by \S*).
  const tokenRe = /\S*(?:\\[a-zA-Z]+(?:\{[^}]*\})*|[A-Za-z\d](?:_(?:\{[^}]+\}|[A-Za-z\d])|\^(?:\{[^}]+\}|[A-Za-z\d])))+\S*/g;
  let out = prose.replace(tokenRe, (match) => {
    if (match.includes('\\(') || match.includes('\\[')) return match;
    return `\\(${match}\\)`;
  });
  // Pass 2: merge adjacent wrapped math separated only by space + a math operator.
  // E.g. "\(\frac{3}{4}\) \(I_\max\)" → "\(\frac{3}{4} I_\max\)".
  out = out.replace(/\\\)(\s*[+\-=*\/]?\s*)\\\(/g, '$1');
  return out;
}

/** Convert $$...$$ / $...$ to \[...\] / \(...\) so the existing parser handles math reliably. */
function dollarsToParen(src: string): string {
  let out = '';
  let i = 0;
  while (i < src.length) {
    if (src[i] === '\\') {
      out += src[i];
      i += 1;
      if (i < src.length) {
        out += src[i];
        i += 1;
      }
      continue;
    }
    if (src[i] === '$' && src[i + 1] === '$') {
      const end = src.indexOf('$$', i + 2);
      if (end === -1) {
        out += src.slice(i);
        break;
      }
      out += `\\[${src.slice(i + 2, end)}\\]`;
      i = end + 2;
      continue;
    }
    if (src[i] === '$') {
      const end = src.indexOf('$', i + 1);
      if (end === -1) {
        out += src.slice(i);
        break;
      }
      out += `\\(${src.slice(i + 1, end)}\\)`;
      i = end + 1;
      continue;
    }
    out += src[i];
    i += 1;
  }
  return out;
}

/** Convert \\begin{tabular}…\\end{tabular} cells to HTML; KaTeX does not render tabular. */
function renderCellHtml(cell: string): string {
  const trimmed = cell.trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/(\$[^$]+\$)/g).filter((p) => p.length > 0);
  return parts
    .map((p) => {
      if (p.startsWith('$') && p.endsWith('$')) {
        const tex = p.slice(1, -1).trim();
        return renderTex(tex, false);
      }
      return escapeHtml(p);
    })
    .join('');
}

function tabularBodyToHtml(body: string): string {
  const rows = body
    .split(/\\\\/)
    .map((r) => r.replace(/^\s*\\hline\s*|\s*\\hline\s*$/g, '').trim())
    .filter((r) => r.length > 0);
  if (rows.length === 0) return '';
  const trs = rows.map((row) => {
    const cells = row.split('&').map((c) => c.trim());
    return `<tr>${cells.map((c) => `<td>${renderCellHtml(c)}</td>`).join('')}</tr>`;
  });
  return `<table class="latex-tabular" role="table"><tbody>${trs.join('')}</tbody></table>`;
}

type MathSegment = { kind: 'text'; text: string } | { kind: 'table'; html: string };

function segmentMixedMath(src: string): MathSegment[] {
  const segments: MathSegment[] = [];
  const re = /\\begin\{tabular\}\{[^}]*\}([\s\S]*?)\\end\{tabular\}/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) segments.push({ kind: 'text', text: src.slice(last, m.index) });
    segments.push({ kind: 'table', html: tabularBodyToHtml(m[1] ?? '') });
    last = m.index + m[0].length;
  }
  if (last < src.length) segments.push({ kind: 'text', text: src.slice(last) });
  if (segments.length === 0) segments.push({ kind: 'text', text: src });
  return segments;
}

// Parse a string with mixed prose + inline (\(...\)) / display (\[...\]) math.
function parseMixed(src: string): { type: 'text' | 'math'; content: string; display: boolean }[] {
  const parts: { type: 'text' | 'math'; content: string; display: boolean }[] = [];
  let i = 0;
  while (i < src.length) {
    const inlineStart = src.indexOf('\\(', i);
    const displayStart = src.indexOf('\\[', i);
    let nextStart: number;
    let isDisplay: boolean;
    if (inlineStart === -1 && displayStart === -1) {
      parts.push({ type: 'text', content: src.slice(i), display: false });
      break;
    }
    if (inlineStart === -1) {
      nextStart = displayStart;
      isDisplay = true;
    } else if (displayStart === -1) {
      nextStart = inlineStart;
      isDisplay = false;
    } else if (inlineStart < displayStart) {
      nextStart = inlineStart;
      isDisplay = false;
    } else {
      nextStart = displayStart;
      isDisplay = true;
    }

    if (nextStart > i) parts.push({ type: 'text', content: src.slice(i, nextStart), display: false });
    const endToken = isDisplay ? '\\]' : '\\)';
    const endIdx = src.indexOf(endToken, nextStart + 2);
    if (endIdx === -1) {
      // The model forgot to close the math delimiter. Best-effort: figure out
      // where the math expression ended by looking for the first chunk that
      // is clearly prose again (a word ≥ 3 letters that's not a known LaTeX
      // command or chemistry token). Render the prefix as math and the rest
      // as plain text.
      const tail = src.slice(nextStart + 2);
      const wordBreak = tail.search(/\s[A-Za-z]{3,}/);
      const mathRaw = wordBreak === -1 ? tail : tail.slice(0, wordBreak);
      const proseTail = wordBreak === -1 ? '' : tail.slice(wordBreak);
      // Strip stray quotes / closing parens the model dropped in there.
      const mathClean = mathRaw.replace(/["']/g, '').replace(/\s*\)+\s*$/u, '').trim();
      if (mathClean) parts.push({ type: 'math', content: mathClean, display: isDisplay });
      if (proseTail) parts.push({ type: 'text', content: proseTail, display: false });
      break;
    }
    parts.push({
      type: 'math',
      content: src.slice(nextStart + 2, endIdx),
      display: isDisplay,
    });
    i = endIdx + 2;
  }
  return parts;
}

function renderMixedHtml(children: string, display: boolean): string {
  const normalized = dollarsToParen(autoWrapBareLatex(children));
  if (display && !normalized.includes('\\(') && !normalized.includes('\\[')) {
    return renderTex(normalized, true);
  }
  const parts = parseMixed(normalized);
  return parts
    .map((p) => {
      if (p.type === 'text') {
        const safe = p.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return safe;
      }
      return renderTex(p.content, p.display);
    })
    .join('');
}

export function MixedMath({ children, className, display = false }: InlineMathProps) {
  const segments = useMemo(() => segmentMixedMath(children), [children]);
  const hasBlock = segments.some((s) => s.kind === 'table');
  const Tag = hasBlock ? 'div' : 'span';

  const nodes = useMemo(() => {
    return segments.map((seg, index) => {
      if (seg.kind === 'table') {
        return (
          <span
            key={`t_${index}`}
            className="block my-3 max-w-full overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: seg.html }}
          />
        );
      }
      const html = renderMixedHtml(seg.text, display);
      return <span key={`x_${index}`} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }, [segments, display]);

  return <Tag className={className}>{nodes}</Tag>;
}

// Pure math (no prose). Useful for the question banner and answers.
export function PureMath({ tex, display = false, className }: { tex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => renderTex(tex, display), [tex, display]);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
