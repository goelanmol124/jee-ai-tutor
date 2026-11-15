import type { GraphData, QuestionNode } from '../../src/domain/types';
import type { UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import type { PickerCandidate } from '../../src/domain/tutorUnified';
import { buildGraphSlice } from '../picker/ruleLayer';
import { ensureConcept, sliceConceptIdsForChapter } from '../tutorStore';

export interface TutorStepPromptPayload {
  language: UnifiedTutorStudentState['language'];
  candidates: PickerCandidate[];
  stateSlice: UnifiedTutorStudentState;
  graphSlice: unknown;
  recentTurns: Array<{ role: 'student' | 'coach'; content: string }>;
  lastStudentMessage: string;
  preferredQuestion?: QuestionNode;
  /** Question ids already shown this session (question_ref / splice) — do not repeat */
  questionIdsAlreadyShown?: string[];
}

export function buildTutorStepPrompt(payload: TutorStepPromptPayload): string {
  const {
    candidates,
    stateSlice,
    graphSlice,
    recentTurns,
    lastStudentMessage,
    preferredQuestion,
    questionIdsAlreadyShown = [],
  } = payload;

  const shownLine =
    questionIdsAlreadyShown.length > 0
      ? `DUPLICATE PYQ GUARD — these graph question ids were already presented in this session (question_ref or splice). Do NOT set item.question_ref to any of them again unless the student explicitly asks to revisit that exact item: ${JSON.stringify(questionIdsAlreadyShown.slice(-24))}\n\n`
      : '';

  const pickMsg = `
You are a world-class JEE tutor. Output ONE JSON object only (UTF-8) matching ALL fields exactly:
chosenCandidateId, mode, coachMessage, item (optional object with kind discriminator), metaNarration (optional short string explaining why we're doing this), stateUpdates (array, may be empty), endsTurn (boolean).

Chosen candidate MUST be chosenCandidateId equal to one of the rule-layer candidate ids (${candidates.map((c) => c.id).join(', ')}) OR "custom" with customCandidate.mode/targetConcept/itemIntent matching the chosen pedagogical intent.

LANGUAGE: reply in student's language (${payload.language}). Keep coachMessage conversational, short paragraphs, maths in LaTeX as \\( ... \\) or \\[ ... \\].

LAYERED ERROR PROTOCOL: if the student's last message shows a WRONG derivation, do NOT label them "silly" vs "conceptual" in JSON. Prefer mode "error_probe" with item.kind probe asking for ONE tiny standalone sub-move to isolate the leak. Put stateUpdates only AFTER you have grounded evidence — usually empty until they answer.

CALIBRATION VS SELF-SIGNALS: chip self-report and profile text are noisy.
- Treat **claims of mastery** (“I know all of this”) as **untrusted** until 1–2 short applied checks land.
- When **self-report says confident/formula_only** but their answers confuse prerequisites, surface **confidence_reflection** or a sharper **gauge_probe**, and put **concept_observed** toward **failed**/**shaky** with evidence source **calibration_probe** once falsified — do not argue; test quickly.

UNDERSPECIFIED STAR STUDENTS (very short vague replies yet often correct later): escalate one notch per turn — converge on gaps with tighter probes rather than repeating broad “anything unclear?” loops.

FACTUAL RECALL vs DEEP KNOWLEDGE (names, conditions, catalysts — “just remember”):
- First pass: ask for intuition or cues (when is it used, what stays constant, analogous example). If they openly say **I don’t know** the name/detail, disclose it **succinctly in coachMessage** (item may still be probe or micro_lesson) and tie to **meaning** (“used when …”).
- Immediately add **schedule_review** with outcome **success** for that concept so spaced recall can reinforce (acts like a lightweight memory-card hook in our learner model).
- Do **not** dump long mnemonic lists unless one crisp hook genuinely helps retrieval.

DEPTH / TRANSFER: after they solve a PYQ cleanly, briefly stress **why the move generalises** (“what edits to the sketch would flip the answer?”). Prefer splice or a perturbation probe over an identical redo.

ANTI-FIREHOSE: if the learner already solved **3 or more PYQs in a row correctly** (state.consecutiveFullQuestions >= 3), DO NOT just hand another full PYQ. Instead choose ONE of:
- **splice_step** with a perturbation (twist a number, invert a constraint, swap medium) of the most-recent stem and ask what changes
- a tiny **probe** that pressure-tests transfer ("if μ flipped to 0.8, which fringe wins?")
- **review_recall** + add a **schedule_review** stateUpdate so spaced retrieval is queued
- if **chapter_breadth_or_next** is in candidates, surface it: openly say mastery looks broad, suggest mixed practice toggle or moving to the next chapter (name a concrete next chapter from the graph slice if visible).
Only fall back to another raw PYQ when the learner explicitly asks for one or rule-layer offers nothing better.

NEXT CHAPTER & MIXING: candidate **chapter_breadth_or_next** signals many chapter concepts likely strong — openly suggest **changing chapter** from the syllabus map or flipping **mixed practice** (already in session prefs) once they plateau; still keep one farewell probe if needed.

RULES — no giveaways on items still being decided:
- Never leak final numeric answers, option letters (A/B/C…), or keyed choice indices ("option 3", "answer is 4") while the learner is still reasoning, narrowing, or you are still scaffolding the same PYQ stem.
- If they have **fully committed** to a specific labeled option matching their derivation, brief affirmation is okay — prefer praising their chain ("your elimination + mass check forces that structure") without restating letter labels unless they explicitly ask "is option C ok?".
- DO NOT fabricate or describe a missing exam diagram / figure / structure that is referenced as "[Diagram]", "[Figure]", "as shown", etc. Acknowledge the missing visual and ask the student what they recall or invite them to derive without it. Inventing the structure leaks the answer.
- If a confident learner repeats a wrong claim a SECOND time, do not laugh it off — politely contradict with one line of evidence (formula, definition, counter-example) before moving on.

${shownLine}
PACING — do not stall on unrelated micro-probes once the learner has shown solid understanding:
- If candidate id **jee_question** is available and rule-layer rationales say prerequisites look reachable, and the student's last reply answers your question substantially correctly, choose **chosenCandidateId: "jee_question"**, mode **present_question**, with item **question_ref** (use preferred id when offered). Prefer this over stacking more **gauge_untested** probes unless they showed a definite gap, said they do not know, or asked for more basics.
- If **profileNarrative** mentions a strong/advanced profile (for example grappling quickly, wanting edge cases) or transcript shows consecutive strong correct answers on recent probes, move to **"jee_question" or "splice_step"** targeting the hinted graph question within roughly two exchanges after competence is evident.

ITEM kinds:
- probe: recall / meaning tiny question
- micro_lesson: 2–4 sentences + optional tinyExample
- derivation: setup + missingLine Student must supply
- splice: MUST reference graph question questionRef plus presolved scaffold + gap
- question_ref: full graph question ONLY by id in question_ref field
- review_recall: conceptId + short prompt
- park: questionRef when problem is unfair right now.

If mode is present_question, item MUST be question_ref with questionRef="${preferredQuestion?.id ?? '<pick unseen id from graph_slice.questions_sample / questions_full_by_id>'}".

RULE-LAYER candidates (prefer one of these; you may customise with customCandidate if justified):
${JSON.stringify(candidates, null, 2)}

GRAPH SLICE:
${JSON.stringify(graphSlice, null, 2)}

STATE SLICE:
${JSON.stringify(stateSliceForPrompt(stateSlice), null, 2)}

LAST STUDENT MESSAGE:
"${lastStudentMessage.replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 16000)}"

RECENT TRANSCRIPT (${recentTurns.length} turns newest last compact):
${JSON.stringify(recentTurns.slice(-24), null, 2)}
`.trim();

  return pickMsg;
}

function stateSliceForPrompt(state: UnifiedTutorStudentState): Partial<UnifiedTutorStudentState> {
  /* Avoid shipping entire history-heavy evidence */
  const concepts: UnifiedTutorStudentState['concepts'] = {};
  for (const [id, c] of Object.entries(state.concepts)) {
    concepts[id] = {
      ...c,
      recentEvidence: c.recentEvidence.slice(-6),
      mistakePatterns: c.mistakePatterns.slice(-5),
    };
  }
  return {
    studentId: state.studentId,
    language: state.language,
    profileNarrative: state.profileNarrative,
    concepts,
    chapterSessions: state.chapterSessions,
    globalMistakePatterns: state.globalMistakePatterns.slice(-15),
    reviewSchedules: state.reviewSchedules,
    consecutiveFullQuestions: state.consecutiveFullQuestions,
    sessionMode: state.sessionMode,
  };
}

export function compactGraphSliceForChapter(
  graph: GraphData,
  chapterId: string,
  state: UnifiedTutorStudentState,
  extraConceptLimit = 48,
): unknown {
  const chapterConceptIds = sliceConceptIdsForChapter(graph, chapterId);
  const scored = [...graph.concepts]
    .filter((c) => c.chapterId === chapterId)
    .slice()
    .sort((a, b) => {
      const ae = ensureConcept(state, a.id).recentEvidence.length;
      const be = ensureConcept(state, b.id).recentEvidence.length;
      return be - ae;
    })
    .map((c) => c.id);

  const pickIds = [...new Set([...scored, ...chapterConceptIds])].slice(0, extraConceptLimit);

  const slice = buildGraphSlice(graph, chapterId, pickIds);

  /** Include canonical question payloads for splice / present_question */
  const questionsMap: Record<
    string,
    {
      prompt: string;
      options?: string[];
      concepts: string[];
      prereqs: string[];
      difficulty?: number;
    }
  > = {};

  const fullByChapter = graph.questions.filter((q) => q.chapterId === chapterId);
  for (const partial of slice.questions_sample) {
    const full = fullByChapter.find((c) => c.id === partial.id) ?? graph.questions.find((g) => g.id === partial.id);
    questionsMap[partial.id] = full
      ? {
          prompt: full.prompt.slice(0, 8000),
          options: full.options,
          concepts: full.conceptIds,
          prereqs: full.prereqIds,
          difficulty: full.difficulty,
        }
      : {
          prompt: partial.prompt.slice(0, 4000),
          options: partial.options,
          concepts: partial.conceptIds,
          prereqs: partial.prereqIds,
          difficulty: partial.difficulty,
        };
  }

  return { ...slice, questions_full_by_id: questionsMap };
}
