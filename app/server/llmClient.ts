/**
 * LLM provider routing: OpenRouter preferred when OPENROUTER_API_KEY is set,
 * otherwise direct xAI (GROK_API_KEY / XAI_API_KEY).
 *
 * Role split defaults refreshed against OpenRouter catalog (Jul 2026):
 * - diagnose: GPT-5.4 mini — current strong mid multimodal (~$0.75/$4.50)
 * - coach / tutor-step: Claude Sonnet 5 — latest Sonnet, intro ~$2/$10
 * - tools: Gemini 2.5 Flash-Lite — cheapest multimodal content (~$0.10/$0.40)
 *
 * Gemini 3.5 Flash exists but is ~5× cost of 2.5 Flash for similar Flash-tier use;
 * keep 2.5 Flash-Lite for bulk tools. Larger frontier models are overkill here.
 */

export type LlmProvider = 'openrouter' | 'xai';

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const XAI_BASE = 'https://api.x.ai/v1';

const DEFAULT_XAI_MODEL = 'grok-4-1-fast-non-reasoning';
const DEFAULT_XAI_DIAGNOSE = 'grok-4.20-0309-non-reasoning';
const DEFAULT_XAI_COACH = 'grok-4.20-0309-non-reasoning';
const DEFAULT_XAI_TUTOR = 'grok-4-1-fast-non-reasoning';

const OR_DIAGNOSE = 'openai/gpt-5.4-mini';
const OR_COACH = 'anthropic/claude-sonnet-5';
const OR_TUTOR = 'anthropic/claude-sonnet-5';
const OR_TOOL = 'google/gemini-2.5-flash-lite';

export function getLlmProvider(): LlmProvider {
  if (process.env.OPENROUTER_API_KEY?.trim()) return 'openrouter';
  return 'xai';
}

export function getApiKey(): string | undefined {
  const openrouter = process.env.OPENROUTER_API_KEY?.trim();
  if (openrouter) return openrouter;
  return process.env.GROK_API_KEY?.trim() || process.env.XAI_API_KEY?.trim() || undefined;
}

export function getChatCompletionsUrl(): string {
  return getLlmProvider() === 'openrouter'
    ? `${OPENROUTER_BASE}/chat/completions`
    : `${XAI_BASE}/chat/completions`;
}

function mapXaiIdToOpenRouter(model: string): string {
  const trimmed = model.trim();
  if (trimmed.includes('/')) return trimmed;
  if (
    trimmed.startsWith('grok-4-1-fast')
    || trimmed.startsWith('grok-4.1-fast')
    || trimmed === 'grok-4'
  ) {
    return OR_TOOL;
  }
  if (trimmed.startsWith('grok-4.20')) return 'x-ai/grok-4.20';
  if (trimmed.startsWith('grok-4.3')) return 'x-ai/grok-4.3';
  if (trimmed.startsWith('grok-4.5')) return 'x-ai/grok-4.5';
  return trimmed;
}

function resolveModel(
  envKeys: string[],
  openrouterDefault: string,
  xaiDefault: string,
): string {
  let fromEnv: string | undefined;
  for (const key of envKeys) {
    const v = process.env[key]?.trim();
    if (v) {
      fromEnv = v;
      break;
    }
  }
  if (getLlmProvider() === 'openrouter') {
    return fromEnv ? mapXaiIdToOpenRouter(fromEnv) : openrouterDefault;
  }
  return fromEnv || xaiDefault;
}

/** Tutor-tool / generic JSON content (cheap). */
export function getGrokModel(): string {
  return resolveModel(
    ['OPENROUTER_TOOL_MODEL', 'GROK_MODEL', 'OPENROUTER_MODEL'],
    OR_TOOL,
    DEFAULT_XAI_MODEL,
  );
}

export function getToolModel(): string {
  return getGrokModel();
}

/** Photo/typed diagnosis — multimodal STEM. */
export function getDiagnoseModel(): string {
  return resolveModel(
    ['OPENROUTER_DIAGNOSE_MODEL', 'GROK_DIAGNOSE_MODEL'],
    OR_DIAGNOSE,
    DEFAULT_XAI_DIAGNOSE,
  );
}

/** Conversational coach follow-ups — instruction discipline. */
export function getCoachModel(): string {
  return resolveModel(
    ['OPENROUTER_COACH_MODEL', 'GROK_COACH_MODEL'],
    OR_COACH,
    DEFAULT_XAI_COACH,
  );
}

/** Graph tutor `/api/tutor/step` — structured pedagogy turns. */
export function getTutorModel(): string {
  return resolveModel(
    ['OPENROUTER_TUTOR_MODEL', 'GROK_TUTOR_MODEL'],
    OR_TUTOR,
    DEFAULT_XAI_TUTOR,
  );
}

export function llmAuthHeaders(apiKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (getLlmProvider() === 'openrouter') {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER?.trim() || 'http://localhost:5173';
    headers['X-Title'] = process.env.OPENROUTER_APP_TITLE?.trim() || 'AdvancedLearning';
  }
  return headers;
}

export type ChatCompletionBody = {
  model: string;
  messages: Array<{ role: string; content: unknown }>;
  response_format?: { type: string };
  temperature?: number;
  max_tokens?: number;
};

export async function chatCompletions(
  apiKey: string,
  body: ChatCompletionBody,
  opts?: { signal?: AbortSignal },
): Promise<Response> {
  return fetch(getChatCompletionsUrl(), {
    method: 'POST',
    headers: llmAuthHeaders(apiKey),
    body: JSON.stringify(body),
    signal: opts?.signal,
  });
}

export function providerLabel(): string {
  return getLlmProvider() === 'openrouter' ? 'OpenRouter' : 'Grok';
}

export function modelRoleSummary(): Record<string, string> {
  return {
    diagnose: getDiagnoseModel(),
    coach: getCoachModel(),
    tool: getToolModel(),
    tutor: getTutorModel(),
  };
}
