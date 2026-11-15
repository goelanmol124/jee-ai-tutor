/**
 * Coach conversation harness.
 *
 * Pits Grok (playing a student persona) against our own coach endpoints
 * (/api/diagnose + /api/coach-followup). Saves a human-readable markdown
 * transcript per (persona × question) pair so we can read 10 conversations
 * end-to-end and judge whether the coach actually helps — or whether it's
 * giving generic, prereq-assuming advice.
 *
 * Run:
 *   npx tsx scripts/coachHarness.ts                          # default mix (Solve/diagnose)
 *   npx tsx scripts/coachHarness.ts --tutor                     # rolling /api/tutor/step loop
 *   npx tsx scripts/coachHarness.ts --tutor --batch 20 --turns 20 --concurrency 10
 *   npx tsx scripts/coachHarness.ts --tutor --mixed-practice
 *   npx tsx scripts/coachHarness.ts --tutor --chapter <chapterId>
 *   npx tsx scripts/coachHarness.ts --persona tutor-fake-confident    # tutor persona filter
 *   npx tsx scripts/coachHarness.ts --persona stuck-11th               # diagnose-mode persona filter
 *   npx tsx scripts/coachHarness.ts --questions 3            # questions per persona
 *   npx tsx scripts/coachHarness.ts --turns 6                # diagnose follow-ups / tutor loops
 *   npx tsx scripts/coachHarness.ts --base http://localhost:8787
 *
 * Requires: server running with GROK_API_KEY available.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import type {
  AttemptMcqContext,
  CoachConversationTurn,
  CoachFollowupResult,
  CoachFollowupStudentMessage,
  DiagnosisResult,
  GraphData,
  QuestionNode,
  StudentState,
} from '../src/domain/types';
import type { TutorTurn } from '../src/domain/tutorUnified';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

/* ─────────────────── personas ─────────────────── */

interface Persona {
  id: string;
  /** Plain-English background pasted into the student-LLM prompt. */
  profile: string;
  /** Hinglish or English by default? */
  language: 'english' | 'hinglish';
  /** How many follow-up turns the student is willing to do before giving up. */
  patience: number;
  /** How they typically open the first attempt. */
  openingStyle:
    | 'partial_correct'    // try the problem, almost-correct working
    | 'wrong_method'       // confidently apply the wrong formula
    | 'mcq_blind_guess'    // only pick an MCQ option, no reasoning
    | 'declared_stuck'     // tap the "I'm stuck" button
    | 'one_word'           // type "?" or "idk"
    | 'misread_question';  // misinterpret what's being asked
}

const PERSONAS: Persona[] = [
  {
    id: 'avg-11th-english',
    profile:
      'You are an 11th-class JEE aspirant from a metro city, decent in English, average in physics/math. You know the basic formulas (e.g., F=ma, lens formula, sum/product of roots) but get confused on derivations and second-order ideas (e.g., when to half an angle, sign conventions, when a formula assumes constant K). You make occasional silly slips and sometimes mix up symbols.',
    language: 'english',
    patience: 5,
    openingStyle: 'partial_correct',
  },
  {
    id: 'weak-12th-hinglish',
    profile:
      'You are a 12th-class JEE student from a Tier-2 city in UP. You write in Hinglish (mix of Hindi-in-Roman + English math words). You memorise formulas without truly understanding why, and you struggle when a problem requires reasoning across two chapters. When confused, you ask things like "yaar yeh kyun hua?" or "sir samajh nahi aaya". You often skip steps in your work.',
    language: 'hinglish',
    patience: 6,
    openingStyle: 'wrong_method',
  },
  {
    id: 'dropper-confident',
    profile:
      'You are a JEE dropper (1 year gap), confident, English-speaking. You attempt problems quickly. You know advanced techniques like Lagrange, complex roots, etc. but sometimes overthink and miss basic constraints (e.g., domain conditions, sign of discriminant). You often think you got it right when you actually slipped.',
    language: 'english',
    patience: 4,
    openingStyle: 'partial_correct',
  },
  {
    id: 'stuck-blank-11th',
    profile:
      'You are an 11th-class student who literally has not read this chapter yet. The question feels alien. You do not know the relevant formula. You will tap "I am stuck" and then need genuine, step-by-step scaffolding. You ask "what does this even mean?" type questions. English is OK.',
    language: 'english',
    patience: 7,
    openingStyle: 'declared_stuck',
  },
  {
    id: 'mcq-guesser',
    profile:
      'You are a 12th-class student under exam pressure. You skim the question, recognise it loosely as something you have seen, and pick an MCQ option based on dimensional analysis or "the answer with sqrt looks right". You write nothing. When pushed for reasoning, you admit you guessed.',
    language: 'english',
    patience: 4,
    openingStyle: 'mcq_blind_guess',
  },
  {
    id: 'misread-question',
    profile:
      'You are an average student who tends to misread the question — you solve a slightly different problem (e.g., maximum instead of minimum, ratio inverted, wrong variable). Your math is correct but for the wrong question. When the coach points it out you initially defend your reading.',
    language: 'english',
    patience: 5,
    openingStyle: 'misread_question',
  },
];

/** Graph-tutor harness personas (first chapter, deepening, anxiety, formula-only crunch). */
const TUTOR_SCENARIO_PERSONAS: Persona[] = [
  {
    id: 'tutor-first-time-chapter',
    profile:
      'You have genuinely not studied this chapter in class yet — it feels intimidating. Ask what the jargon means. Say when you dont know formulas. Admit blank moments.',
    language: 'english',
    patience: 6,
    openingStyle: 'declared_stuck',
  },
  {
    id: 'tutor-formula-only-crunch',
    profile:
      'You memorised formulas ("just plug") but intuition is shallow. Under pressure you apply the closest-looking identity even when mismatched.',
    language: 'english',
    patience: 5,
    openingStyle: 'wrong_method',
  },
  {
    id: 'tutor-anxious-checker',
    profile:
      'You second-guess constantly, ask tiny confirmation questions, and worry you wasted the tutor time.',
    language: 'english',
    patience: 5,
    openingStyle: 'partial_correct',
  },
  {
    id: 'tutor-strong-deepening',
    profile:
      'You grasp most JEE setups quickly — you challenge for edge cases or faster methods. Admit only real gaps.',
    language: 'english',
    patience: 4,
    openingStyle: 'partial_correct',
  },
  {
    id: 'tutor-slow-socratic-builder',
    profile:
      'You learn best slow: one tiny idea per step. Prefer Socratic pings over long lectures; ask “why would that happen?” Admit confusion quickly; no performance pride.',
    language: 'english',
    patience: 8,
    openingStyle: 'declared_stuck',
  },
  {
    id: 'tutor-underspecified-hotshot',
    profile:
      'You actually understand a lot internally but TYPE very little — clipped SMS style (often <12 words): “yeah standard setup”, “obvious symmetry”, etc. Occasionally drop a fuller reply when pinned on a contradiction. Dont spell out reasoning unless pressured.',
    language: 'english',
    patience: 5,
    openingStyle: 'one_word',
  },
  {
    id: 'tutor-fake-confident',
    profile:
      'CRITICAL ROLE: you LOUDLY claim mastery ("yeah easy", "studied this yesterday") but the underlying physics/math is WRONG in a load-bearing way EVERY answer. Pick at least ONE deliberate slip per reply: invert a formula (use lambda*a/D instead of lambda*D/a), swap definitions (call primary carbon what is actually quaternary), drop a factor of 2, mis-state the name of a reagent / law / constant, or pick the wrong principle (e.g. apply Rayleigh where Bragg belongs). Sound utterly confident — never say "I think". When the coach probes the slip, first DEFEND your wrong answer ("nah pretty sure that\'s right"), then on a sharper probe waffle ("hmm maybe... actually wait"). Only on the THIRD challenge do you finally admit the gap. Keep tone breezy, do not say "I am pretending" or break character.',
    language: 'english',
    patience: 8,
    openingStyle: 'partial_correct',
  },
  {
    id: 'tutor-transfer-pressure',
    profile:
      'After each solve you PUSH for perturbations: tweak numbers, invert diagram, twist constraints. Demand “different surface same engine” probes. Complain if repeats feel pattern-matching not thinking.',
    language: 'english',
    patience: 5,
    openingStyle: 'partial_correct',
  },
  {
    id: 'tutor-ready-next-chapter',
    profile:
      'You have solid chapter coverage — you casually ask whats next syllabus-wise when pace feels easy. Dont be rude just curious whether to drill here or leap forward.',
    language: 'english',
    patience: 5,
    openingStyle: 'partial_correct',
  },
  {
    id: 'tutor-reagent-memory-gap',
    profile:
      'You reason ok on mechanisms/logic but DRAW A BLANK on names (reagents, litmus, named tests). Honestly say idk vocab at least half the times; want crisp disclosure after one failed recall try plus a tiny mnemonic or schedule hook.',
    language: 'english',
    patience: 6,
    openingStyle: 'wrong_method',
  },
  {
    id: 'tutor-mixed-drill-loving',
    profile:
      'You ask for scrambled multi-topic JEe-style hybrids once basics feel warmed up. Mention enjoying cross-linking formulas across subtopics.',
    language: 'english',
    patience: 5,
    openingStyle: 'partial_correct',
  },
];

/* ─────────────────── question selection ─────────────────── */

function loadGraph(): GraphData {
  const file = path.resolve(__dirname, '../public/data/graph.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as GraphData;
}

/**
 * Pick a small diverse set of questions: medium difficulty (2-4), mix of subjects,
 * MCQ + non-MCQ. Stable sort so multiple harness runs can be diffed.
 */
function pickQuestions(graph: GraphData, n: number): QuestionNode[] {
  const candidates = graph.questions
    .filter((q) => q.difficulty >= 2 && q.difficulty <= 4)
    .filter((q) => (q.prompt?.length ?? 0) < 1200)
    .filter((q) => !q.needsHumanReview);
  // round-robin by subject so we don't get all chemistry
  const buckets: Record<string, QuestionNode[]> = { math: [], physics: [], chemistry: [] };
  for (const q of candidates) buckets[q.subject]?.push(q);
  for (const k of Object.keys(buckets)) buckets[k].sort((a, b) => a.id.localeCompare(b.id));
  const out: QuestionNode[] = [];
  let i = 0;
  while (out.length < n) {
    const subjects = ['math', 'physics', 'chemistry'];
    const s = subjects[i % subjects.length];
    const q = buckets[s].shift();
    if (q) out.push(q);
    i += 1;
    if (i > 200) break;
  }
  return out;
}

/* ─────────────────── empty student state (no priors) ─────────────────── */

function blankStudentState(): StudentState {
  return {
    conceptStates: {},
    profileText: 'Test harness student',
    sillyMistakePatterns: [],
    coveredChapterIds: [],
    attemptedQuestionIds: [],
  };
}

/* ─────────────────── grok-as-student ─────────────────── */

const STUDENT_MODEL = process.env.HARNESS_STUDENT_MODEL || 'grok-4-1-fast-non-reasoning';

interface StudentTurn {
  /** Free text the student would type in the chat box. */
  text: string;
  /** Optional chip tap. If set, the harness will send a chip message instead of free text. */
  chip?: 'still_confused' | 'show_me_more' | 'why' | 'got_it';
  /** True if the student wants to end (e.g. "I think I get it" + tap got_it). */
  done?: boolean;
}

async function callGrok(prompt: string, model = STUDENT_MODEL): Promise<string> {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  if (!apiKey) throw new Error('GROK_API_KEY missing');
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Grok ${res.status}: ${text.slice(0, 500)}`);
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  return json.choices?.[0]?.message?.content ?? '';
}

function tryParseStudentJson(raw: string): StudentTurn {
  // The student model is asked to emit JSON, but we tolerate mistakes.
  const fenceless = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(fenceless);
    if (parsed && typeof parsed === 'object') {
      const text = typeof parsed.text === 'string' ? parsed.text : '';
      const chip = parsed.chip && ['still_confused', 'show_me_more', 'why', 'got_it'].includes(parsed.chip)
        ? parsed.chip as StudentTurn['chip']
        : undefined;
      const done = parsed.done === true || chip === 'got_it';
      return { text, chip, done };
    }
  } catch {
    // fall through
  }
  // Plain text: assume free-text reply.
  return { text: fenceless };
}

/**
 * Build an opening attempt message that the student would type before
 * the FIRST diagnosis. Returns:
 *   - typedWork string for /api/diagnose
 *   - mcq context (optional)
 */
async function buildOpeningAttempt(
  persona: Persona,
  question: QuestionNode,
): Promise<{ typedWork?: string; mcq?: AttemptMcqContext; describe: string }> {
  const optionsBlock = question.options?.length
    ? `\nOptions:\n${question.options.map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`
    : '';

  if (persona.openingStyle === 'declared_stuck') {
    return { mcq: { declaredUnknown: true }, describe: 'Tapped "I\'m stuck"' };
  }

  if (persona.openingStyle === 'one_word') {
    return { typedWork: '?', describe: 'Typed "?"' };
  }

  // Use Grok to actually compose what THIS persona would type.
  const styleHint = (() => {
    switch (persona.openingStyle) {
      case 'partial_correct':
        return 'Write the working you would attempt. Get most of it right but slip on ONE meaningful step (sign error, dropped factor of 2, half-angle confusion, missed domain check, or similar realistic mistake). 2-4 short lines max.';
      case 'wrong_method':
        return 'Apply a wrong but plausible-looking method or formula confidently. 2-4 short lines.';
      case 'mcq_blind_guess':
        return 'Pick the MCQ option that "looks right" by pattern (sqrt, units, etc.). Do NOT write any reasoning beyond a fragment like "guess" or leave empty. 1 short line at most.';
      case 'misread_question':
        return 'Misread ONE thing in the question (max → min, ratio of A:B as B:A, find x → find y, similar). Then solve the misread version correctly. 2-4 lines.';
      default:
        return 'Write a realistic 2-4 line attempt.';
    }
  })();

  const langHint = persona.language === 'hinglish'
    ? 'Write in Hinglish (mix Hindi-in-Roman with English math). Use words like "yaar", "matlab", "phir", "samajh nahi", "isliye". Do NOT use Devanagari script.'
    : 'Write in plain English (Indian student tone OK, but no Hindi words).';

  const prompt = `You are simulating a JEE student.

PERSONA: ${persona.profile}

LANGUAGE: ${langHint}

THE QUESTION:
${question.prompt}${optionsBlock}

YOUR TASK: ${styleHint}
- This is the very FIRST thing you type into the tutor before any feedback.
- Write LIKE A STUDENT TYPING IN A CHAT BOX. Lowercase OK. No headings. No "Step 1". No markdown. No latex backslashes — just write "phi/2" or "sqrt(2gh)" the way a student types it.
- Keep math informal: "lambda", "phi/2", "I_0/4", "cos^2(phi/2)".
- Do not reveal you are an AI. Do not mention "persona" or "JEE coach".
- Output STRICT JSON: { "text": "...", "mcqIndex": <integer or null> }
  - "mcqIndex" should be the 0-based index of the option you'd pick (only if the question has options); else null.
  - "text" is the free-text reasoning. Can be empty string for blind guess.`;

  const raw = await callGrok(prompt);
  const fenceless = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  let parsed: { text?: string; mcqIndex?: number | null } = {};
  try { parsed = JSON.parse(fenceless); } catch { parsed = { text: fenceless.slice(0, 400) }; }
  const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
  const idx = typeof parsed.mcqIndex === 'number' ? parsed.mcqIndex : undefined;
  const mcq = (question.options?.length && idx != null && idx >= 0 && idx < question.options.length)
    ? { selectedIndex: idx, selectedLabel: question.options[idx] }
    : undefined;
  const describe = mcq
    ? `Picked ${String.fromCharCode(65 + mcq.selectedIndex!)} + reasoning`
    : (text ? 'Typed reasoning' : '(empty)');
  return { typedWork: text || undefined, mcq, describe };
}

/**
 * Given the conversation so far + the coach's latest reply, simulate the
 * persona's next student turn (free text or chip).
 */
async function simulateStudentReply(
  persona: Persona,
  question: QuestionNode,
  conversation: CoachConversationTurn[],
  lastCoach: { coachMessage: string; quickCheckPrompt?: string; quickCheckOptions?: string[] },
  turnIndex: number,
): Promise<StudentTurn> {
  const optionsBlock = question.options?.length
    ? `\nQuestion options:\n${question.options.map((o, i) => `  ${String.fromCharCode(65 + i)}. ${o}`).join('\n')}`
    : '';
  const transcript = conversation.map((t) => `${t.role === 'student' ? 'YOU' : 'COACH'}: ${t.content}`).join('\n');
  const qcBlock = lastCoach.quickCheckPrompt
    ? `\nThe coach also showed this quick-check:\n  Q: ${lastCoach.quickCheckPrompt}\n  Options: ${(lastCoach.quickCheckOptions ?? []).map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join('  ')}`
    : '';

  const langHint = persona.language === 'hinglish'
    ? 'Reply in Hinglish (Hindi-in-Roman + English math).'
    : 'Reply in plain English.';

  const prompt = `You are simulating a JEE student in a back-and-forth with a tutor.

PERSONA: ${persona.profile}
LANGUAGE RULE: ${langHint}
TURN NUMBER: ${turnIndex} of about ${persona.patience}

THE ORIGINAL QUESTION:
${question.prompt}${optionsBlock}

CONVERSATION SO FAR:
${transcript}

THE COACH JUST SAID:
${lastCoach.coachMessage}${qcBlock}

YOUR JOB: react like a real student would. Be HONEST about what you do and don't understand. Specifically:
- If the coach gave a hint that USES words/formulas you don't know (per your persona) — say so explicitly. Don't pretend.
- If the coach asks a question whose prereq you don't know — say "I don't even know X" instead of guessing.
- If the coach is being too vague, push back: "what does that mean?" / "kya matlab hai iska?".
- If the coach actually unblocks you, try the next step yourself and share the working.
- If you genuinely understood and want to move on, signal it with chip "got_it".
- If you tapped a quick-check, the harness will pick the option for you — but you can also reply via free text.
- Avoid being a yes-man. Real students push back, get frustrated, or admit confusion.

OUTPUT STRICT JSON (no markdown fence):
{
  "text": "what you would type into the chat (can be empty if using a chip)",
  "chip": "still_confused" | "show_me_more" | "why" | "got_it" | null,
  "done": true | false
}

Use "chip" only when one of the four canned options matches your reaction perfectly. Otherwise leave it null and just type a real reply.`;

  const raw = await callGrok(prompt);
  return tryParseStudentJson(raw);
}

function tryParseTutorStudentReply(raw: string): { text: string; done: boolean } {
  const fenceless = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(fenceless) as { text?: unknown; done?: unknown };
    if (parsed && typeof parsed === 'object') {
      return {
        text: typeof parsed.text === 'string' ? parsed.text : fenceless.slice(0, 800),
        done: parsed.done === true,
      };
    }
  } catch {
    /* ignore */
  }
  return { text: fenceless.slice(0, 800), done: false };
}

async function simulateTutorStudentReply(
  persona: Persona,
  transcriptSoFar: string[],
  tutorTurn: TutorTurn,
  turnIndex: number,
  opts?: { maxCoachTurns?: number },
): Promise<{ text: string; done: boolean }> {
  const langHint =
    persona.language === 'hinglish'
      ? 'Reply in Hinglish (Hindi-in-Roman + English math words).'
      : 'Reply in plain English.';
  const itemShape = tutorTurn.item ? JSON.stringify(tutorTurn.item, null, 2).slice(0, 2600) : '(none)';
  const tail = Math.max(48, Math.min(90, (opts?.maxCoachTurns ?? 12) * 3));
  const transcriptBlob = transcriptSoFar.slice(-tail).join('\n');
  const metaLine = tutorTurn.metaNarration ?? '(none)';
  const cap = opts?.maxCoachTurns ?? persona.patience;
  const prompt = `You are simulating a JEE student in a rolling tutoring chat.

PERSONA: ${persona.profile}
LANGUAGE: ${langHint}
SESSION: this is student reply #${turnIndex} after a coach message. The session may run up to ~${cap} coach turns — stay engaged across multiple problems, probes, and follow-ups.
STAY IN CHARACTER: do not end early. Only output "done": true if you are at the last ~2 exchanges of a long session (turn ${Math.max(cap - 1, 1)}+) and feel finished, or the coach clearly wraps up.

TRANSCRIPT SO FAR:
${transcriptBlob}

COACH MESSAGE JUST NOW:
${tutorTurn.coachMessage}

META (why the tutor says it is doing this):
${metaLine}

STRUCTURED ITEM (may be probe / lesson / splice / exam question scaffold):
${itemShape}

React like an honest teenager in chat: short paragraphs, imperfect typing, informal math spelling.
When you nail a PYQ or probe, express it briefly — then invite the next step ("ok whats next", "another one?") unless the coach is clearly closing.
Do not mention that you are an AI or simulation.

OUTPUT STRICT JSON (no markdown fence):
{"text":"<what they type>","done":false}`;

  const raw = await callGrok(prompt);
  return tryParseTutorStudentReply(raw);
}

/* ─────────────────── coach endpoint calls ─────────────────── */

async function callDiagnose(
  base: string,
  question: QuestionNode,
  studentState: StudentState,
  attempt: { typedWork?: string; mcq?: AttemptMcqContext },
): Promise<DiagnosisResult> {
  const form = new FormData();
  form.set('question', JSON.stringify(question));
  form.set('studentState', JSON.stringify(studentState));
  if (attempt.typedWork) form.set('typedWork', attempt.typedWork);
  if (attempt.mcq) form.set('mcq', JSON.stringify(attempt.mcq));
  const res = await fetch(`${base}/api/diagnose`, { method: 'POST', body: form });
  const body = (await res.json()) as DiagnosisResult;
  if (!res.ok && !(body?.verdict && Array.isArray(body?.cards))) {
    throw new Error(`diagnose failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body as DiagnosisResult;
}

async function callFollowup(
  base: string,
  question: QuestionNode,
  studentState: StudentState,
  diagnosis: DiagnosisResult,
  conversation: CoachConversationTurn[],
  studentMessage: CoachFollowupStudentMessage,
): Promise<CoachFollowupResult> {
  const res = await fetch(`${base}/api/coach-followup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, studentState, diagnosis, conversation, studentMessage }),
  });
  const body = (await res.json()) as CoachFollowupResult;
  if (!res.ok && !body?.coachMessage) {
    throw new Error(`followup failed (${res.status}): ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body as CoachFollowupResult;
}

interface TutorChip {
  subtopicId: string;
  label?: string;
  conceptIds?: string[];
}

interface TutorHarnessJob {
  persona: Persona;
  chapterId: string;
  chapterTitle: string;
}

function stableChapters(graph: GraphData): Array<{ id: string; title: string }> {
  return graph.chapters.slice().sort((a, b) => a.id.localeCompare(b.id));
}

/** Build N parallel tutor sessions: rotate chapters (sorted by id) unless `fixedChapterId` pins one. */
function buildTutorHarnessJobs(
  graph: GraphData,
  personas: Persona[],
  batchSize: number,
  fixedChapterId?: string,
): TutorHarnessJob[] {
  const chapters = stableChapters(graph);
  if (chapters.length === 0) return [];
  const out: TutorHarnessJob[] = [];
  for (let i = 0; i < batchSize; i += 1) {
    const persona = personas[i % personas.length]!;
    if (fixedChapterId) {
      const title =
        graph.chapters.find((c) => c.id === fixedChapterId)?.title ?? fixedChapterId;
      out.push({ persona, chapterId: fixedChapterId, chapterTitle: title });
    } else {
      const ch = chapters[i % chapters.length]!;
      out.push({ persona, chapterId: ch.id, chapterTitle: ch.title });
    }
  }
  return out;
}

async function callTutorChapterEntryGet(
  base: string,
  chapterId: string,
): Promise<{ ok: boolean; chips?: TutorChip[]; error?: string }> {
  const res = await fetch(
    `${base}/api/tutor/chapter-entry?chapterId=${encodeURIComponent(chapterId)}`,
  );
  const body = (await res.json()) as { ok?: boolean; chips?: TutorChip[]; error?: string };
  return {
    ok: res.ok && body.ok !== false,
    chips: body.chips,
    error: body.error,
  };
}

async function callTutorChapterEntryPost(
  base: string,
  body: {
    studentId: string;
    chapterId: string;
    chipAnswers: Record<string, 'confident' | 'roughly' | 'heard' | 'new'>;
    freeText?: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${base}/api/tutor/chapter-entry`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { ok?: boolean; error?: string };
  return {
    ok: res.ok && j.ok !== false,
    error: j.error,
  };
}

async function callTutorStep(
  base: string,
  payload: { studentId: string; chapterId: string; lastStudentMessage?: string; mixedPractice?: boolean },
): Promise<{ ok: boolean; tutorTurn?: TutorTurn; error?: string }> {
  const res = await fetch(`${base}/api/tutor/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const j = (await res.json()) as { ok?: boolean; tutorTurn?: TutorTurn; error?: string };
  return {
    ok: res.ok && j.ok !== false && !!j.tutorTurn,
    tutorTurn: j.tutorTurn,
    error: j.error,
  };
}

async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next;
      next += 1;
      results[i] = await worker(items[i]!, i);
    }
  }
  const n = Math.min(concurrency, Math.max(items.length, 1));
  await Promise.all(Array.from({ length: n }, runOne));
  return results;
}

async function runOneTutorConversation(
  base: string,
  persona: Persona,
  chapterId: string,
  chapterTitle: string,
  maxCoachTurns: number,
  mixedPractice: boolean,
  runKey = '',
): Promise<TranscriptEntry[]> {
  const transcript: TranscriptEntry[] = [];
  const slug = `${persona.id}__tutor__${chapterId}`;
  const rk = runKey ? `_r${runKey}` : '';
  const studentId = `hv_${slug}${rk}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`.slice(
    0,
    96,
  );

  transcript.push({
    role: 'meta',
    text:
      `MODE: graph tutor — /api/tutor/step\nPersona: ${persona.id}\nChapter: ${chapterTitle} (${chapterId})\nMixedPractice: ${mixedPractice}\nstudentId: ${studentId}`,
  });

  const chipsRes = await callTutorChapterEntryGet(base, chapterId);
  if (!chipsRes.ok || !chipsRes.chips?.length) {
    transcript.push({
      role: 'meta',
      text: `tutor chapter-entry GET failed: ${chipsRes.error ?? 'no chips'}`,
    });
    return transcript;
  }

  /** Match persona to chapter-chip priors — real UI would tap per chip */
  const defaultChipTier: 'heard' | 'new' =
    persona.id === 'tutor-first-time-chapter' ? 'new' : 'heard';
  const chipAnswers = Object.fromEntries(
    chipsRes.chips.map((c) => [c.subtopicId, defaultChipTier]),
  );

  const entryPost = await callTutorChapterEntryPost(base, {
    studentId,
    chapterId,
    chipAnswers,
    freeText: `[harness] persona=${persona.id}`,
  });
  if (!entryPost.ok) {
    transcript.push({ role: 'meta', text: `tutor chapter-entry POST failed: ${entryPost.error ?? '-'}` });
    return transcript;
  }

  const lines: string[] = [];
  let pendingStudent = '';

  for (let coachTurn = 0; coachTurn < maxCoachTurns; coachTurn += 1) {
    const outgoingStudent = pendingStudent.trim();
    pendingStudent = '';
    let step: Awaited<ReturnType<typeof callTutorStep>>;
    try {
      step = await callTutorStep(base, {
        studentId,
        chapterId,
        mixedPractice,
        lastStudentMessage: outgoingStudent.length > 0 ? outgoingStudent : undefined,
      });
    } catch (err) {
      transcript.push({ role: 'meta', text: `tutor step HTTP error: ${(err as Error).message}` });
      break;
    }

    if (!step.ok || !step.tutorTurn) {
      transcript.push({
        role: 'coach',
        text: `[tutor-step error] ${step.error ?? 'missing tutorTurn'}`,
      });
      break;
    }

    const tt = step.tutorTurn;
    const bubble =
      `${tt.coachMessage}${tt.metaNarration ? `\n\n_(meta: ${tt.metaNarration})_` : ''}\n` +
      `[mode=${tt.mode} candidate=${tt.chosenCandidateId}]`;
    transcript.push({ role: 'coach', text: bubble, json: tt });

    lines.push(`COACH: ${tt.coachMessage}`);
    if (coachTurn >= maxCoachTurns - 1) break;

    let sim: { text: string; done: boolean };
    try {
      sim = await simulateTutorStudentReply(persona, lines, tt, coachTurn + 1, {
        maxCoachTurns,
      });
    } catch (err) {
      transcript.push({ role: 'meta', text: `tutor student-LLM error: ${(err as Error).message}` });
      break;
    }

    transcript.push({ role: 'student', text: sim.text || '(empty)' });
    lines.push(`YOU: ${sim.text}`);
    if (sim.done) {
      transcript.push({ role: 'meta', text: '(stopped: student signaled done)' });
      break;
    }
    pendingStudent = sim.text;
  }

  return transcript;
}

/* ─────────────────── one full conversation ─────────────────── */

interface TranscriptEntry {
  role: 'meta' | 'student' | 'coach';
  text: string;
  json?: unknown;
}

async function runOneConversation(
  base: string,
  persona: Persona,
  question: QuestionNode,
  maxFollowups: number,
): Promise<TranscriptEntry[]> {
  const transcript: TranscriptEntry[] = [];
  const studentState = blankStudentState();

  transcript.push({
    role: 'meta',
    text: `Persona: ${persona.id} (${persona.language}, opening: ${persona.openingStyle})\nQuestion: ${question.id} [${question.subject}, diff ${question.difficulty}]\nPrompt: ${question.prompt}\n${question.options?.length ? `Options: ${question.options.map((o, i) => `(${String.fromCharCode(65 + i)}) ${o}`).join('  ')}` : ''}`,
  });

  // 1) opening attempt
  const opening = await buildOpeningAttempt(persona, question);
  transcript.push({
    role: 'student',
    text: `[opening: ${opening.describe}]${opening.typedWork ? `\n${opening.typedWork}` : ''}${opening.mcq ? `\nPicked: ${String.fromCharCode(65 + opening.mcq.selectedIndex!)}` : ''}`,
  });

  // 2) initial diagnosis
  const diagnosis = await callDiagnose(base, question, studentState, opening);
  transcript.push({
    role: 'coach',
    text: `[diagnosis] verdict=${diagnosis.verdict} mistakeType=${diagnosis.mistakeType} nextMove=${diagnosis.nextMove ?? '-'}\n${diagnosis.coachMessage ?? '(no coachMessage)'}${
      diagnosis.quickCheck
        ? `\n  ↪ QuickCheck: ${diagnosis.quickCheck.prompt}\n     ${diagnosis.quickCheck.options.map((o, i) => `(${String.fromCharCode(65 + i)}${o.correct ? '✓' : ''}) ${o.label}`).join('\n     ')}`
        : ''
    }`,
    json: diagnosis,
  });

  // 3) build local conversation history (what we send back to the LLM each turn)
  const conversation: CoachConversationTurn[] = [];
  conversation.push({
    role: 'student',
    content: opening.typedWork ?? (opening.mcq ? `Picked option ${String.fromCharCode(65 + opening.mcq.selectedIndex!)}: ${opening.mcq.selectedLabel}` : '(stuck)'),
  });
  conversation.push({ role: 'coach', content: diagnosis.coachMessage ?? '' });

  let lastCoachReply = {
    coachMessage: diagnosis.coachMessage ?? '',
    quickCheckPrompt: diagnosis.quickCheck?.prompt,
    quickCheckOptions: diagnosis.quickCheck?.options.map((o) => o.label),
  };
  let lastQc = diagnosis.quickCheck;

  // 4) follow-up loop
  for (let turn = 1; turn <= maxFollowups; turn += 1) {
    let studentTurn: StudentTurn;
    try {
      studentTurn = await simulateStudentReply(persona, question, conversation, lastCoachReply, turn);
    } catch (err) {
      transcript.push({ role: 'meta', text: `student-LLM error: ${(err as Error).message}` });
      break;
    }

    // The harness chooses how to dispatch the student turn:
    //  - chip → send as chip
    //  - matches a QC option exactly (case-insensitive) → send as qc_pick
    //  - else free text
    let studentMessage: CoachFollowupStudentMessage;
    let humanForTranscript: string;
    if (studentTurn.chip) {
      studentMessage = { kind: 'chip', chipId: studentTurn.chip };
      humanForTranscript = `[chip: ${studentTurn.chip}]${studentTurn.text ? ` "${studentTurn.text}"` : ''}`;
    } else if (lastQc && studentTurn.text) {
      const t = studentTurn.text.trim().toLowerCase();
      const match = lastQc.options.findIndex((o) => o.label.trim().toLowerCase() === t);
      if (match !== -1) {
        const opt = lastQc.options[match];
        studentMessage = {
          kind: 'qc_pick',
          quickCheckPrompt: lastQc.prompt,
          pickedLabel: opt.label,
          pickedCorrect: opt.correct,
        };
        humanForTranscript = `[QC pick] ${opt.label} (${opt.correct ? 'correct' : 'wrong'})`;
      } else {
        studentMessage = { kind: 'free_text', text: studentTurn.text };
        humanForTranscript = studentTurn.text;
      }
    } else {
      studentMessage = { kind: 'free_text', text: studentTurn.text || '(no reply)' };
      humanForTranscript = studentTurn.text || '(empty)';
    }

    transcript.push({ role: 'student', text: humanForTranscript });
    conversation.push({
      role: 'student',
      content:
        studentMessage.kind === 'free_text'
          ? studentMessage.text
          : studentMessage.kind === 'qc_pick'
            ? `Picked QC option "${studentMessage.pickedLabel}" (${studentMessage.pickedCorrect ? 'correct' : 'wrong'})`
            : `Tapped chip: ${studentMessage.chipId}`,
    });

    let reply: CoachFollowupResult;
    try {
      reply = await callFollowup(base, question, studentState, diagnosis, conversation, studentMessage);
    } catch (err) {
      transcript.push({ role: 'meta', text: `coach error: ${(err as Error).message}` });
      break;
    }

    transcript.push({
      role: 'coach',
      text: `[followup ${turn}] done=${reply.conversationDone ?? false} sug=${reply.suggestedAction ?? '-'}\n${reply.coachMessage}${
        reply.quickCheck
          ? `\n  ↪ QuickCheck: ${reply.quickCheck.prompt}\n     ${reply.quickCheck.options.map((o, i) => `(${String.fromCharCode(65 + i)}${o.correct ? '✓' : ''}) ${o.label}`).join('\n     ')}`
          : ''
      }`,
      json: reply,
    });
    conversation.push({ role: 'coach', content: reply.coachMessage });
    lastCoachReply = {
      coachMessage: reply.coachMessage,
      quickCheckPrompt: reply.quickCheck?.prompt,
      quickCheckOptions: reply.quickCheck?.options.map((o) => o.label),
    };
    lastQc = reply.quickCheck;

    if (studentTurn.done || reply.conversationDone) {
      transcript.push({ role: 'meta', text: `(stopped: ${studentTurn.done ? 'student got_it' : 'coach signalled done'})` });
      break;
    }
    if (turn >= persona.patience) {
      transcript.push({ role: 'meta', text: '(stopped: patience exhausted)' });
      break;
    }
  }

  return transcript;
}

/* ─────────────────── transcript writer ─────────────────── */

function transcriptToMarkdown(entries: TranscriptEntry[]): string {
  const lines: string[] = [];
  for (const e of entries) {
    if (e.role === 'meta') {
      lines.push('---');
      lines.push(e.text);
      lines.push('---');
    } else if (e.role === 'student') {
      lines.push('');
      lines.push(`### 🧑‍🎓 STUDENT`);
      lines.push(e.text);
    } else if (e.role === 'coach') {
      lines.push('');
      lines.push(`### 🎓 COACH`);
      lines.push(e.text);
    }
  }
  return lines.join('\n') + '\n';
}

/* ─────────────────── auto-grader (lint over transcripts) ─────────────────── */

interface LintFinding {
  severity: 'error' | 'warn';
  rule: string;
  detail: string;
  excerpt: string;
}

/**
 * Looks at a single conversation transcript and a parsed list of all coach
 * JSON replies, then flags any rule violations we can detect mechanically.
 * The list of rules is intentionally narrow — we only flag things we are
 * highly confident are bugs. Soft / subjective issues are left to the human reader.
 */
function gradeConversation(
  entries: TranscriptEntry[],
  question: QuestionNode,
): LintFinding[] {
  const findings: LintFinding[] = [];
  const coachJsons = entries
    .filter((e) => e.role === 'coach' && e.json && typeof e.json === 'object')
    .map((e) => e.json as Record<string, unknown>);

  const optionLetters = (question.options ?? []).map((_, i) => String.fromCharCode(65 + i));
  const finalAnswer = (question.finalAnswer ?? '').trim();
  const finalAnswerCleaned = finalAnswer.replace(/[\\$()\s]/g, '').toLowerCase();

  for (let i = 0; i < coachJsons.length; i += 1) {
    const j = coachJsons[i];
    const isFirst = i === 0; // first coach reply = diagnosis (has verdict)
    const verdict = typeof j.verdict === 'string' ? j.verdict : undefined;
    const mistakeType = typeof j.mistakeType === 'string' ? j.mistakeType : undefined;
    const coachMessage = (typeof j.coachMessage === 'string' ? j.coachMessage : '').trim();
    const lower = coachMessage.toLowerCase();

    // Rule A: verdict='correct' must NOT carry a "real" mistake
    if (isFirst && verdict === 'correct' && mistakeType && mistakeType !== 'unclear_evidence') {
      findings.push({
        severity: 'error',
        rule: 'verdict-correct-mistakeType-mismatch',
        detail: `verdict='correct' but mistakeType='${mistakeType}'`,
        excerpt: coachMessage.slice(0, 120),
      });
    }

    // Rule B: option letter leak — phrases like "option C", "matches option B".
    if (verdict === 'correct' || verdict === undefined) {
      for (const letter of optionLetters) {
        const pat = new RegExp(`\\boption\\s+${letter}\\b|\\bmatches\\s+option|\\bpicked\\s+option\\s+${letter}\\b`, 'i');
        if (pat.test(coachMessage)) {
          findings.push({
            severity: 'error',
            rule: 'option-letter-leak',
            detail: `coach named option ${letter}`,
            excerpt: coachMessage.slice(0, 140),
          });
          break;
        }
      }
    }

    // Rule C: final-answer leak — match finalAnswer text against coachMessage when verdict='correct'.
    if ((verdict === 'correct' || verdict === undefined) && finalAnswerCleaned.length >= 3) {
      const cleaned = coachMessage.replace(/[\\$()\s]/g, '').toLowerCase();
      // Only flag if the cleaned final answer appears AND a confirming phrase nearby.
      if (
        cleaned.includes(finalAnswerCleaned)
        && /\b(lands?|got|gives|equals|matches|is|=|spot on|nailed)\b/i.test(coachMessage)
      ) {
        findings.push({
          severity: 'warn',
          rule: 'final-answer-leak',
          detail: `coachMessage seems to contain the final answer "${finalAnswer}"`,
          excerpt: coachMessage.slice(0, 160),
        });
      }
    }

    // Rule D: fabricated slip language even though verdict='correct'.
    if (verdict === 'correct' && /\b(tiny slip|small (?:slip|mistake|notation)|notation slip|minor (?:procedural )?slip)\b/i.test(lower)) {
      findings.push({
        severity: 'error',
        rule: 'fabricated-slip',
        detail: 'verdict=correct but coach says "tiny slip"/"small mistake"',
        excerpt: coachMessage.slice(0, 160),
      });
    }

    // Rule E: escalation + quickCheck in the same bubble.
    if (j.suggestedAction === 'see_fix' && j.quickCheck && j.quickCheck !== null) {
      findings.push({
        severity: 'error',
        rule: 'escalation-with-qc',
        detail: 'suggestedAction=see_fix but quickCheck is non-null',
        excerpt: coachMessage.slice(0, 140),
      });
    }

    // Rule F: hallucinated QC — no option marked correct.
    if (j.quickCheck && typeof j.quickCheck === 'object') {
      const qc = j.quickCheck as { options?: Array<{ correct?: unknown; label?: unknown }> };
      const opts = Array.isArray(qc.options) ? qc.options : [];
      const hasCorrect = opts.some((o) => o.correct === true);
      if (opts.length >= 2 && !hasCorrect) {
        findings.push({
          severity: 'error',
          rule: 'qc-no-correct-option',
          detail: 'quickCheck has no option marked correct: true',
          excerpt: opts.map((o) => `[${o.label}]`).join(' '),
        });
      }
    }

    // Rule G: language drift — Hinglish words in a clearly-English thread.
    // Heuristic: look at the most recent student message before this coach turn;
    // if it is pure ASCII English and the coach reply contains common Hinglish
    // tokens, flag it.
    const studentEntriesBefore = entries
      .slice(0, entries.indexOf(entries.find((e) => e.json === j)!))
      .filter((e) => e.role === 'student');
    const lastStudent = studentEntriesBefore[studentEntriesBefore.length - 1]?.text ?? '';
    const HINGLISH_TOKENS = ['yaar', 'matlab', 'isliye', 'kya', 'kyun', 'kaise', 'samajh', 'hai', 'nahi', 'achha', 'theek', 'phir', 'mujhe', 'karo'];
    const studentLower = lastStudent.toLowerCase();
    const studentIsEnglish = !HINGLISH_TOKENS.some((tok) => new RegExp(`\\b${tok}\\b`, 'i').test(studentLower));
    if (studentIsEnglish) {
      const drift = HINGLISH_TOKENS.find((tok) => new RegExp(`\\b${tok}\\b`, 'i').test(coachMessage));
      if (drift) {
        findings.push({
          severity: 'warn',
          rule: 'language-drift',
          detail: `student in English but coach used Hinglish word "${drift}"`,
          excerpt: coachMessage.slice(0, 160),
        });
      }
    }
  }

  return findings;
}

function gradeTutorConversation(entries: TranscriptEntry[]): LintFinding[] {
  const findings: LintFinding[] = [];

  for (let gi = 0; gi < entries.length; gi += 1) {
    const e = entries[gi];
    if (e.role !== 'coach' || !e.json || typeof e.json !== 'object') continue;
    const jUnknown = e.json as Record<string, unknown>;
    if (typeof jUnknown.chosenCandidateId !== 'string') continue;

    const j = e.json as TutorTurn;
    const coachMessage = (j.coachMessage ?? '').trim();
    if (!coachMessage) {
      findings.push({
        severity: 'error',
        rule: 'tutor-empty-coach-message',
        detail: 'TutorTurn.coachMessage is empty.',
        excerpt: '',
      });
    }

    const metaN = (j.metaNarration ?? '').trim();
    if (
      metaN.includes('tutor_fallback:') ||
      metaN.includes('Coach API key missing') ||
      metaN.includes('first safe scaffolding only')
    ) {
      findings.push({
        severity: 'error',
        rule: 'tutor-coach-degraded',
        detail: `Tutor degraded to deterministic fallback (${metaN.slice(0, 120)}).`,
        excerpt: coachMessage.slice(0, 160),
      });
    }

    if (j.mode === 'present_question' && !(j.metaNarration ?? '').trim()) {
      findings.push({
        severity: 'warn',
        rule: 'tutor-meta-missing-before-question',
        detail:
          'Mode is present_question but metaNarration is empty — include a short rationale when surfacing heavy items.',
        excerpt: coachMessage.slice(0, 160),
      });
    }

    const studentTexts = entries.slice(0, gi).filter((x) => x.role === 'student');
    const lastStudent = studentTexts[studentTexts.length - 1]?.text ?? '';

    const HINGLISH_TOKENS = [
      'yaar',
      'matlab',
      'isliye',
      'kya',
      'kyun',
      'kaise',
      'samajh',
      'hai',
      'nahi',
      'achha',
      'theek',
      'phir',
      'mujhe',
      'karo',
    ];
    const studentLower = lastStudent.toLowerCase();
    const studentIsEnglish = !HINGLISH_TOKENS.some((tok) =>
      new RegExp(`\\b${tok}\\b`, 'i').test(studentLower));

    if (studentIsEnglish) {
      const drift = HINGLISH_TOKENS.find((tok) =>
        new RegExp(`\\b${tok}\\b`, 'i').test(coachMessage));
      if (drift) {
        findings.push({
          severity: 'warn',
          rule: 'tutor-language-drift',
          detail: `student in English but coach used Hinglish token "${drift}"`,
          excerpt: coachMessage.slice(0, 160),
        });
      }
    }
  }

  return findings;
}

interface ConversationSummary {
  slug: string;
  numTurns: number;
  findings: LintFinding[];
}

function summariseRun(summaries: ConversationSummary[]): string {
  const lines: string[] = [];
  let totalErrors = 0;
  let totalWarns = 0;
  const ruleCounts: Record<string, number> = {};
  for (const s of summaries) {
    for (const f of s.findings) {
      if (f.severity === 'error') totalErrors += 1; else totalWarns += 1;
      ruleCounts[f.rule] = (ruleCounts[f.rule] ?? 0) + 1;
    }
  }
  lines.push(`## Auto-grader summary`);
  lines.push('');
  lines.push(`- conversations: ${summaries.length}`);
  lines.push(`- total errors: ${totalErrors}`);
  lines.push(`- total warnings: ${totalWarns}`);
  lines.push('');
  lines.push('### By rule');
  for (const [rule, count] of Object.entries(ruleCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`- \`${rule}\`: ${count}`);
  }
  lines.push('');
  lines.push('### Per-conversation findings');
  for (const s of summaries) {
    if (s.findings.length === 0) {
      lines.push(`- ✅ ${s.slug} (${s.numTurns} coach turns) — clean`);
    } else {
      lines.push(`- ❌ ${s.slug} (${s.numTurns} coach turns)`);
      for (const f of s.findings) {
        lines.push(`  - [${f.severity}] \`${f.rule}\`: ${f.detail} — _${f.excerpt.slice(0, 100).replace(/\n/g, ' ')}_`);
      }
    }
  }
  return lines.join('\n');
}

/* ─────────────────── main ─────────────────── */

interface CliArgs {
  base: string;
  questions: number;
  turns: number;
  personaFilter?: string;
  outDir: string;
  tutorMode: boolean;
  tutorChapter?: string;
  tutorConcurrency: number;
  tutorMixedPractice: boolean;
  /** When set, run this many tutor sessions in parallel (chapter rotation unless --chapter pins). */
  tutorBatch?: number;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const has = (flag: string) => argv.includes(flag);
  return {
    base: get('--base') || 'http://localhost:8787',
    questions: Number(get('--questions') || 2),
    turns: Number(get('--turns') || 6),
    personaFilter: get('--persona'),
    outDir: get('--out') || path.resolve(__dirname, '../../tmp/coach-harness'),
    tutorMode: has('--tutor'),
    tutorChapter: get('--chapter'),
    tutorConcurrency: Math.max(1, Number(get('--concurrency') || 2)),
    tutorMixedPractice: has('--mixed-practice'),
    tutorBatch: (() => {
      const raw = get('--batch');
      if (raw == null) return undefined;
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
    })(),
  };
}

async function main() {
  const args = parseArgs();
  fs.mkdirSync(args.outDir, { recursive: true });

  const graph = loadGraph();

  if (args.tutorMode) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const chapterId = args.tutorChapter ?? graph.chapters[0]?.id ?? '';
    const chapterTitle =
      graph.chapters.find((c) => c.id === chapterId)?.title ?? chapterId ?? 'unknown';
    if (!chapterId) {
      console.error('No chapters in graph — cannot run --tutor.');
      process.exit(1);
    }

    const personaPool = args.personaFilter
      ? TUTOR_SCENARIO_PERSONAS.filter((p) => p.id === args.personaFilter)
      : TUTOR_SCENARIO_PERSONAS;
    if (!personaPool.length) {
      console.error('No tutor personas match --persona filter.');
      process.exit(1);
    }

    const jobs: TutorHarnessJob[] =
      args.tutorBatch != null
        ? buildTutorHarnessJobs(graph, personaPool, args.tutorBatch, args.tutorChapter)
        : personaPool.map((p) => ({ persona: p, chapterId, chapterTitle }));

    const summary: string[] = [];
    summary.push(`# Tutor harness run — ${stamp}`);
    summary.push('');
    summary.push(
      `base=${args.base} mode=tutor jobs=${jobs.length} coachTurnCap=${args.turns} concurrency=${args.tutorConcurrency}`,
    );
    summary.push(
      args.tutorBatch != null
        ? `(batch mode — chapter pinned: ${args.tutorChapter ?? 'rotation'})`
        : `chapter=${chapterId}`,
    );
    summary.push(`mixedPractice=${args.tutorMixedPractice}`);
    summary.push('');

    const conversationSummaries: ConversationSummary[] = [];

    const results = await runPool(jobs, args.tutorConcurrency, async (job, idx) => {
      const slugSuffix = args.tutorBatch != null ? `__b${idx}` : '';
      const slug = `${job.persona.id}__tutor__${job.chapterId}${slugSuffix}`;
      console.log(`\n=== ${slug} ===`);
      let entries: TranscriptEntry[];
      try {
        entries = await runOneTutorConversation(
          args.base,
          job.persona,
          job.chapterId,
          job.chapterTitle,
          args.turns,
          args.tutorMixedPractice,
          args.tutorBatch != null ? String(idx) : '',
        );
      } catch (err) {
        console.error('  failed:', (err as Error).message);
        entries = [{ role: 'meta', text: `harness error: ${(err as Error).message}` }];
      }

      const md = transcriptToMarkdown(entries);
      const file = path.join(args.outDir, `${stamp}__${slug}.md`);
      fs.writeFileSync(file, md, 'utf-8');

      const findings = gradeTutorConversation(entries);

      const errCount = findings.filter((f) => f.severity === 'error').length;
      const warnCount = findings.filter((f) => f.severity === 'warn').length;
      console.log(`  wrote ${file}  (errors=${errCount} warns=${warnCount})`);

      summary.push(`- [${slug}](./${path.basename(file)}) — errors=${errCount} warns=${warnCount}`);
      const numCoachTurns = entries.filter((e) => e.role === 'coach').length;
      return { slug, numTurns: numCoachTurns, findings };
    });

    conversationSummaries.push(...results);

    const indexPath = path.join(args.outDir, `${stamp}__index.md`);
    const graderPath = path.join(args.outDir, `${stamp}__grader.md`);
    const graderMd = summariseRun(conversationSummaries);
    fs.writeFileSync(indexPath, summary.join('\n') + '\n\n' + graderMd, 'utf-8');
    fs.writeFileSync(graderPath, graderMd, 'utf-8');
    console.log(`\nIndex:   ${indexPath}`);
    console.log(`Grader:  ${graderPath}`);
    console.log('\n' + graderMd.split('\n').slice(0, 14).join('\n'));
    return;
  }

  const questions = pickQuestions(graph, args.questions * 3); // wider pool, we'll use first n per persona
  const personas = args.personaFilter
    ? PERSONAS.filter((p) => p.id === args.personaFilter)
    : PERSONAS;

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summary: string[] = [];
  summary.push(`# Coach harness run — ${stamp}`);
  summary.push('');
  summary.push(`base=${args.base}  questions/persona=${args.questions}  max-followups=${args.turns}`);
  summary.push('');

  const conversationSummaries: ConversationSummary[] = [];
  for (const persona of personas) {
    const qs = questions.slice(0, args.questions);
    for (const q of qs) {
      const slug = `${persona.id}__${q.id}__${q.subject}_d${q.difficulty}`;
      console.log(`\n=== ${slug} ===`);
      let entries: TranscriptEntry[];
      try {
        entries = await runOneConversation(args.base, persona, q, args.turns);
      } catch (err) {
        console.error('  failed:', (err as Error).message);
        entries = [{ role: 'meta', text: `harness error: ${(err as Error).message}` }];
      }
      const md = transcriptToMarkdown(entries);
      const file = path.join(args.outDir, `${stamp}__${slug}.md`);
      fs.writeFileSync(file, md, 'utf-8');
      const findings = gradeConversation(entries, q);
      const numTurns = entries.filter((e) => e.role === 'coach').length;
      conversationSummaries.push({ slug, numTurns, findings });
      const errCount = findings.filter((f) => f.severity === 'error').length;
      const warnCount = findings.filter((f) => f.severity === 'warn').length;
      console.log(`  wrote ${file}  (errors=${errCount} warns=${warnCount})`);
      summary.push(`- [${slug}](./${path.basename(file)}) — errors=${errCount} warns=${warnCount}`);
    }
  }

  const indexPath = path.join(args.outDir, `${stamp}__index.md`);
  const graderPath = path.join(args.outDir, `${stamp}__grader.md`);
  const graderMd = summariseRun(conversationSummaries);
  fs.writeFileSync(indexPath, summary.join('\n') + '\n\n' + graderMd, 'utf-8');
  fs.writeFileSync(graderPath, graderMd, 'utf-8');
  console.log(`\nIndex:   ${indexPath}`);
  console.log(`Grader:  ${graderPath}`);
  console.log('\n' + graderMd.split('\n').slice(0, 14).join('\n'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
