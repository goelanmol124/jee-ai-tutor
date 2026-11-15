/** Shared JSON salvage for LLM JSON outputs (latex backslashes etc.) */

export function repairJsonBackslashes(raw: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (c === '"' && raw[i - 1] !== '\\') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString && c === '\\') {
      const next = raw[i + 1];
      const validJsonEscape =
        next === '"' ||
        next === '\\' ||
        next === '/' ||
        next === 'b' ||
        next === 'f' ||
        next === 'n' ||
        next === 'r' ||
        next === 't' ||
        next === 'u';
      if (!validJsonEscape) {
        out += '\\\\';
        continue;
      }
    }
    out += c;
  }
  return out;
}

export function closeTruncatedJson(raw: string): string {
  const closers: string[] = [];
  let inString = false;
  let escapeNext = false;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (inString) {
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      if (c === '\\') {
        escapeNext = true;
        continue;
      }
      if (c === '"') {
        inString = false;
        continue;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') closers.push('}');
    else if (c === '[') closers.push(']');
    else if (c === '}' || c === ']') closers.pop();
  }
  let patched = raw;
  if (inString) patched += '"';
  patched = patched.replace(/,\s*$/u, '');
  while (closers.length > 0) {
    patched += closers.pop() ?? '';
  }
  return patched;
}

export function parseLlmJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(repairJsonBackslashes(raw));
  } catch {
    /* fall through */
  }
  try {
    return JSON.parse(repairJsonBackslashes(closeTruncatedJson(raw)));
  } catch {
    /* fall through */
  }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  const slice = first >= 0 && last > first ? raw.slice(first, last + 1) : raw;
  return JSON.parse(repairJsonBackslashes(closeTruncatedJson(slice)));
}
