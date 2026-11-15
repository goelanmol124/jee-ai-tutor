import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import { buildDiagnosePrompt } from './prompts/diagnoseAttempt';
import { buildTutorToolPrompt } from './prompts/tutorTool';
import { buildCoachFollowupPrompt } from './prompts/coachFollowup';
import { unclearDiagnosisResult, validateDiagnosis } from './validateDiagnosis';
import { fallbackTutorTool, validateTutorTool } from './validateTutorTool';
import { fallbackCoachFollowup, validateCoachFollowup } from './validateCoachFollowup';
import { parseLlmJson } from './jsonRepair';
import { getTutorDb } from './db/sqlite';
import { loadGraphJson } from './tutor/loadGraph';
import type { TutorSqlDb } from './tutorStore';
import type { TutorStepRequestBody } from './tutor/handleTutorStep';
import { executeTutorStep } from './tutor/handleTutorStep';
import { tutorGetChapterEntry, tutorPostChapterEntry } from './tutor/chapterEntry';
import { mountPilotRoutes } from './integration/routes.ts';
import {
  getHoldoutBank,
  getPilotStores,
  getStudentCohort,
  getStudentProfile,
} from './integration/pilotRuntime.ts';
import { requireActiveProcessing, requireSession } from './integration/joinService.ts';
import { assertTutoringEligible } from './pilot-study/index.ts';
import { logServerError, safeErrorBody, SafeApiError } from './integration/safeErrors.ts';
import {
  chatCompletions,
  getApiKey,
  getCoachModel,
  getDiagnoseModel,
  getLlmProvider,
  getToolModel,
  getTutorModel,
  modelRoleSummary,
  providerLabel,
} from './llmClient.ts';
import type {
  AttemptMcqContext,
  CoachConversationTurn,
  CoachFollowupStudentMessage,
  DiagnosisResult,
  QuestionNode,
  StudentState,
  TutorTool,
} from '../src/domain/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const port = Number(process.env.AL_SERVER_PORT ?? 8787);

app.use(express.json({ limit: '2mb' }));

function asDataUrl(file: Express.Multer.File): string {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (typeof raw !== 'string') {
    if (typeof raw === 'object' && raw !== null) return raw as T;
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
app.get('/api/health', (_req, res) => {
  const roles = modelRoleSummary();
  res.json({
    ok: true,
    provider: getLlmProvider(),
    hasGrokKey: Boolean(getApiKey()),
    hasApiKey: Boolean(getApiKey()),
    models: roles,
    // Back-compat fields
    model: roles.tool,
    diagnoseModel: roles.diagnose,
    coachModel: roles.coach,
    tutorModel: roles.tutor,
  });
});

/** Pilot spine: join/session, diagnosis boundary, dispute, parent, telemetry, checklist. */
mountPilotRoutes(app);

// Eager pilot store init (migrations + separated DBs). Failures stay visible.
void getPilotStores().catch((err) => {
  logServerError('pilot-stores-init', err);
});

app.post('/api/diagnose', upload.single('image'), async (req, res) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    res.status(503).json(unclearDiagnosisResult('LLM API key is not configured. Set OPENROUTER_API_KEY or GROK_API_KEY/XAI_API_KEY.'));
    return;
  }

  const question = safeJsonParse<QuestionNode | null>(req.body.question, null);
  const studentState = safeJsonParse<StudentState | null>(req.body.studentState, null);
  const typedWork = typeof req.body.typedWork === 'string' ? req.body.typedWork : undefined;
  const imageDataUrl = req.file ? asDataUrl(req.file) : (typeof req.body.imageDataUrl === 'string' ? req.body.imageDataUrl : undefined);
  const mcq = safeJsonParse<AttemptMcqContext | undefined>(req.body.mcq, undefined);

  if (!question || !studentState) {
    console.warn('[diagnose] bad request: missing question or student state', {
      hasQuestion: Boolean(question),
      hasStudentState: Boolean(studentState),
      bodyKeys: Object.keys(req.body ?? {}),
    });
    res.status(400).json(unclearDiagnosisResult('The diagnosis request was missing question or student state data.'));
    return;
  }

  try {
    const model = getDiagnoseModel();
    console.info(`[diagnose] calling ${providerLabel()}`, {
      provider: getLlmProvider(),
      model,
      role: 'diagnose',
      questionId: question.id,
      hasTypedWork: Boolean(typedWork?.trim()),
      hasImage: Boolean(imageDataUrl),
      mcq,
    });
    const prompt = buildDiagnosePrompt(question, studentState, typedWork, mcq);
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }];
    if (imageDataUrl) {
      content.push({ type: 'image_url', image_url: { url: imageDataUrl } });
    }

    const response = await chatCompletions(apiKey, {
      model,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      // Need enough for the verbose JSON shape (cards + traces + beliefs + quickCheck + LaTeX).
      max_tokens: 4000,
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[diagnose] ${providerLabel()} request failed`, {
        status: response.status,
        model,
        body: body.slice(0, 600),
      });
      res.status(response.status).json(unclearDiagnosisResult(`${providerLabel()} request failed (${response.status}). ${body.slice(0, 180)}`));
      return;
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      res.status(502).json(unclearDiagnosisResult(`${providerLabel()} returned an empty diagnosis.`));
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseLlmJson(text);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'parse error';
      console.warn('[diagnose] JSON parse failed', {
        message: msg,
        head: text.slice(0, 1200),
        tail: text.slice(-300),
      });
      throw parseErr;
    }
    res.json(validateDiagnosis(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown diagnosis error';
    res.status(500).json(unclearDiagnosisResult(message));
  }
});

async function callGrokJson(prompt: string): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('LLM API key is not configured on the server.');

  const response = await chatCompletions(apiKey, {
    model: getToolModel(),
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.25,
    max_tokens: 3500,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${providerLabel()} request failed (${response.status}). ${body.slice(0, 180)}`);
  }

  const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error(`${providerLabel()} returned an empty response.`);
  return parseLlmJson(text);
}

app.post('/api/tutor-tool', async (req, res) => {
  const question = safeJsonParse<QuestionNode | null>(req.body.question, null);
  const studentState = safeJsonParse<StudentState | null>(req.body.studentState, null);
  const diagnosis = safeJsonParse<DiagnosisResult | null>(req.body.diagnosis, null);
  const tool = typeof req.body.tool === 'string' ? req.body.tool as TutorTool : 'micro_lesson';
  const targetConceptIds = Array.isArray(req.body.targetConceptIds)
    ? req.body.targetConceptIds.filter((item: unknown): item is string => typeof item === 'string')
    : [];

  if (!question || !studentState || !diagnosis) {
    res.status(400).json(fallbackTutorTool('Need the current question first', tool, targetConceptIds));
    return;
  }

  if (!getApiKey()) {
    res.status(503).json(fallbackTutorTool('Try this next', tool, targetConceptIds));
    return;
  }

  try {
    const prompt = buildTutorToolPrompt(question, studentState, diagnosis, tool, targetConceptIds);
    const parsed = await callGrokJson(prompt);
    res.json(validateTutorTool(parsed, tool, targetConceptIds));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tutor tool generation failed.';
    res.status(500).json({
      ...fallbackTutorTool('Could not generate tutor action', tool, targetConceptIds),
      intent: message,
    });
  }
});

app.post('/api/coach-followup', async (req, res) => {
  const apiKey = getApiKey();
  const question = safeJsonParse<QuestionNode | null>(req.body.question, null);
  const studentState = safeJsonParse<StudentState | null>(req.body.studentState, null);
  const diagnosis = safeJsonParse<DiagnosisResult | null>(req.body.diagnosis, null);
  const conversation = safeJsonParse<CoachConversationTurn[]>(req.body.conversation, []);
  const studentMessage = safeJsonParse<CoachFollowupStudentMessage | null>(req.body.studentMessage, null);

  if (!question || !studentState || !diagnosis || !studentMessage) {
    res.status(400).json(fallbackCoachFollowup('I lost the thread — try sending that again with a fresh question.'));
    return;
  }
  if (!apiKey) {
    res.status(503).json(fallbackCoachFollowup('Coach is offline (no API key on the server).'));
    return;
  }

  try {
    const model = getCoachModel();
    console.info(`[coach-followup] calling ${providerLabel()}`, {
      provider: getLlmProvider(),
      model,
      role: 'coach',
      questionId: question.id,
      messageKind: studentMessage.kind,
      conversationTurns: conversation.length,
    });
    const prompt = buildCoachFollowupPrompt(question, studentState, diagnosis, conversation, studentMessage);

    const response = await chatCompletions(apiKey, {
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      // Follow-ups are smaller than diagnosis — but keep room for an optional QC.
      max_tokens: 1500,
    });

    if (!response.ok) {
      const body = await response.text();
      console.warn(`[coach-followup] ${providerLabel()} request failed`, { status: response.status, body: body.slice(0, 400) });
      res.status(response.status).json(fallbackCoachFollowup(`Coach hiccup (${response.status}). Try again in a sec.`));
      return;
    }

    const json = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content;
    if (!text) {
      res.status(502).json(fallbackCoachFollowup('Coach went quiet — try sending that again.'));
      return;
    }

    let parsed: unknown;
    try {
      parsed = parseLlmJson(text);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : 'parse error';
      console.warn('[coach-followup] JSON parse failed', { message: msg, head: text.slice(0, 600), tail: text.slice(-200) });
      res.status(502).json(fallbackCoachFollowup('Coach said something I could not parse — try again.'));
      return;
    }
    res.json(validateCoachFollowup(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown coach error';
    res.status(500).json(fallbackCoachFollowup(message));
  }
});

app.post('/api/tutor/chapter-entry', async (req, res) => {
  try {
    const db = await getTutorDb();
    const graph = loadGraphJson();
    const result = tutorPostChapterEntry(db as unknown as TutorSqlDb, graph, req.body);
    res.json({ ok: true, chips: result.chips, unifiedState: result.state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chapter-entry failed';
    res.status(400).json({ ok: false, error: message });
  }
});

app.get('/api/tutor/chapter-entry', async (req, res) => {
  try {
    const chapterId = typeof req.query.chapterId === 'string' ? req.query.chapterId : '';
    if (!chapterId) {
      res.status(400).json({ ok: false, error: 'chapterId required' });
      return;
    }
    const db = await getTutorDb();
    const graph = loadGraphJson();
    const data = tutorGetChapterEntry(db as unknown as TutorSqlDb, graph, chapterId);
    res.json({ ok: true, ...data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'chapter-entry get failed';
    res.status(500).json({ ok: false, error: message });
  }
});

app.post('/api/tutor/step', async (req, res) => {
  try {
    const db = await getTutorDb();
    const graph = loadGraphJson();
    const grokApiKey = getApiKey();
    const body = { ...(req.body as TutorStepRequestBody) };

    // When a pilot session token is present, enforce enrollment + explicit cohort + holdout.
    const sessionHeader =
      req.header('authorization')?.replace(/^Bearer\s+/i, '')
      || req.header('x-session-token')
      || (typeof (req.body as { sessionToken?: unknown })?.sessionToken === 'string'
        ? (req.body as { sessionToken: string }).sessionToken
        : undefined);

    if (sessionHeader) {
      const stores = await getPilotStores();
      const session = requireSession(stores, sessionHeader);
      requireActiveProcessing(stores, session.studentId);
      const cohort = getStudentCohort(stores, session.studentId);
      if (!cohort) {
        throw new SafeApiError(
          'cohort_required',
          'Explicit cohort is required before tutoring.',
          400,
        );
      }
      body.studentId = session.studentId;
      body.cohort = cohort;
      const profile = getStudentProfile(stores, session.studentId);
      if (profile.language === 'english' || profile.language === 'roman_hinglish') {
        // Language is applied via unified state on chapter entry; cohort drives picker.
      }
      const bank = getHoldoutBank();
      body.holdoutAssert = (questionId: string) => assertTutoringEligible(bank, questionId);
    }

    const { state, tutorTurn } = await executeTutorStep(
      db as unknown as TutorSqlDb,
      graph,
      body,
      { grokApiKey: grokApiKey ?? undefined, coachModel: getTutorModel() },
    );
    res.json({ ok: true, tutorTurn, unifiedState: state });
  } catch (error) {
    logServerError('tutor-step', error);
    if (error instanceof SafeApiError) {
      res.status(error.status).json(safeErrorBody(error));
      return;
    }
    const name = error instanceof Error ? error.name : '';
    if (name === 'HoldoutLeakError') {
      res.status(403).json({
        ok: false,
        code: 'holdout_ineligible',
        error: 'This item is reserved for assessment and cannot be used in tutoring.',
      });
      return;
    }
    res.status(400).json({ ok: false, error: 'tutor-step failed', code: 'bad_request' });
  }
});

app.listen(port, () => {
  console.log(`AdvancedLearning tutor proxy listening on http://localhost:${port}`);
  /** Windows + non-TTY parents (e.g. `concurrently`) can close stdin; without this, Node may exit right after listen. */
  try {
    process.stdin.resume();
  } catch {
    /* ignore */
  }
});
