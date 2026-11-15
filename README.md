# AdvancedLearning: an adaptive AI tutor for JEE preparation

AdvancedLearning is an **AI tutor for IIT JEE (Main and Advanced) preparation** in **physics, chemistry and maths**. It keeps a concept graph of what each student knows. It picks the next question so the student is stretched but not lost. When the student solves on paper, it reads the working step by step and finds **the exact step where the reasoning broke**. Then it teaches only that idea.

Most JEE prep apps are question banks with leaderboards: they mark answers right or wrong and rank students. This project builds the missing loop instead:

> **choose → attempt → understand → teach → verify → update → choose again**

The product's key metric is **JEE marks gained per hour spent in the app**. Engagement is not the goal.

> **Exam content is not included.** The full concept graph was built from past JEE papers, answer keys and coaching-video transcripts. That material may be copyrighted, so it stays out of this repository. The app ships with a small bank of **original sample questions** written for this repo (19 questions, 9 chapters, 30 concepts). You can point it at your own question bank; see [Using your own question bank](#using-your-own-question-bank).

---

## The pain points this MVP targets

These come from [`PLAN.md`](PLAN.md) §1 and [`PROJECT_REPLAN.md`](PROJECT_REPLAN.md) §2.

| # | Pain point | How the MVP addresses it |
|---|---|---|
| 1 | **"I don't know what to study next."** Students re-read chapters they already know and never find the precise gaps. Strong students lose time deciding; weak students loop. | A **concept graph** (concepts, prerequisite edges, question-to-concept links) plus a **belief per concept**. An **80/20 stretch picker** chooses the next question so about 80% of what it needs is already known (`src/services/questionPicker.ts`, `server/picker/`). Chapter self-ratings (*Confident / Know roughly / Formula only / New to me*) seed the priors but never count as proof. |
| 2 | **"It just says wrong."** Nobody tells the student *which step* broke, or whether it was a concept gap, a procedure error or a silly slip. | **Step-level diagnosis.** With an LLM key, the server reads a photo or typed working (`server/prompts/diagnoseAttempt.ts`). Without a key, a deterministic **offline diagnoser** (`src/services/offlineDiagnosis.ts`) walks the canonical steps, stops at the **first causal break**, and classifies it from authored "trap" patterns. Credit and blame go only to concepts on the path the student actually used. |
| 3 | **"I can't even start, so I close the app."** | Every question has escape routes besides **I solved it on paper**: **Let me type**, **Orient me** (names the concept and the angle, with no hint toward the answer) and **I'm stuck** (an honest stop, handled as data instead of failure). The coach replies one short message at a time with a one-tap **quick check**. |
| 4 | **Answer leakage and false praise erode trust.** | The prompts and validators block option letters and final values while the work is still in progress. Guessing without reasoning gets no verdict. Contradictions must be acknowledged. Tests cover the offline path too (`offlineDiagnosis.spec.ts` checks that no coach text contains the answer). |
| 5 | **Forgetting.** Concepts fixed once fade before the exam. | Spaced-review memory cards and a short **warm-up** with due recall before a session (`src/services/memoryCards.ts`, `src/views/Warmup.tsx`). |
| 6 | **Motivation is treated as a sticker.** | Honest counters and comparisons with the student's own past performance, not with others. Mistakes are reframed as "found a gap" or "caught a slip". Internal probabilities stay hidden (`src/views/You.tsx`, `Recap.tsx`). |

What the MVP does **not** do yet (see [Roadmap](#roadmap)): public sign-up, multi-device sync, a measured photo-diagnosis accuracy gate, or the full content bank.

---

## Quick start

Requirements: Node.js 20+ and npm.

```bash
cd app
npm install
npm run dev          # UI only: offline tutor, original sample questions
```

Open http://localhost:5173. Pick a few chapters, then solve. To see the step-level diagnosis without any API key:

1. Open the differentiation question (*If y = x² sin(2x), find dy/dx at x = π/4*). The picker may show another question first. Pick only *Differentiation* during onboarding, or tap **Skip** / **Next question** until it appears.
2. Choose **Let me type** and enter (one line per step):
   ```
   dy/dx = 2x sin(2x) + x^2 cos(2x)
   at x = pi/4 ...
   ```
3. The coach credits the product rule and flags the **chain-rule step** as a concept gap. It gives no answer and asks one quick check.

### With the LLM tutor (photo diagnosis, free-form coaching)

```bash
cp .env.example .env       # at the repo root; fill in ONE provider key
cd app
npm run dev:full           # Express API on :8787 + Vite on :5173
```

Providers:

- **OpenRouter** (`OPENROUTER_API_KEY`). Separate models can be set for each role (diagnose, coach, tutor, tool). The defaults are listed in `.env.example`.
- **xAI Grok** (`GROK_API_KEY` or `XAI_API_KEY`). Used when no OpenRouter key is set.

Keys are read only on the server. Never prefix a key with `VITE_`, because Vite exposes those variables to the browser. The client calls `GET /api/health` and switches to the LLM path automatically when the server has a key.

### Tests and build

```bash
cd app
npm test             # vitest: 26 files, server + client
npm run build        # tsc -b && vite build
```

---

## Architecture

```
app/
├── src/                         React 19 + Vite + Tailwind + KaTeX (mobile-first)
│   ├── views/                   Onboarding → Warmup → Solve → Recap, plus You
│   ├── services/
│   │   ├── questionPicker.ts    80/20 stretch ranking over the concept graph
│   │   ├── studentModel.ts      per-concept belief, attempts, review schedule
│   │   ├── offlineDiagnosis.ts  deterministic first-causal-break diagnoser
│   │   ├── tutorClient.ts       LLM path via /api/* or the offline fallback
│   │   └── memoryCards.ts       spaced-repetition cards
│   └── data/sampleGraph.ts      ORIGINAL sample questions, concepts, prerequisites
├── server/                      Express API (tsx)
│   ├── prompts/                 diagnosis / coach / tutor prompts (no-leak rules)
│   ├── validate*.ts             schema repair, leakage and contradiction guards
│   ├── diagnosis/               staged photo diagnosis: sufficiency, risk, verifier
│   ├── picker/ learner/         hierarchical picker, reversible evidence, prerequisites
│   ├── tutor/                   Graph Tutor step loop and guarded state updates
│   ├── pilot/ pilot-study/      invite identity, consent, retention, holdout bank
│   └── telemetry/               active-time accounting
└── scripts/                     sync-graph, coach harness (synthetic student personas)
scripts/graph_build/             Python pipeline: questions → concepts → graph snapshot
research/                        evidence syntheses behind the design decisions
```

**Data flow for one question.** The picker chooses a question from the graph and the student's beliefs. The student attempts it by photo, typing or picking an option (an option alone always needs one line of reasoning). The diagnosis step (LLM or offline) produces a step trace, the first causal break, concept evidence and one coach message. The policy then decides the next move: a quick check, a micro-lesson, a retry or the next question. Beliefs and review schedules update only from concepts on the path the student used. LLM output proposes structured evidence; it never writes probabilities directly.

Diagnosis and next-action policy are deliberately separate, so neither the image judge nor the LLM controls the whole learning sequence.

Design documents:

- [`PLAN.md`](PLAN.md): vision, the four pillars, pedagogy and the picker objective.
- [`UI.md`](UI.md): the "question is sacred" interaction design.
- [`PROJECT_REPLAN.md`](PROJECT_REPLAN.md): the private-pilot plan, launch gates and metrics.
- [`CHANGELOG.md`](CHANGELOG.md).

---

## Using your own question bank

The app reads a `GraphData` bundle (chapters, concepts, questions with canonical steps, and edges; see `src/domain/types.ts`). The lookup order is:

1. Server: `AL_GRAPH_PATH`, then `app/public/data/graph.json`, then the bundled sample.
2. Client: `/data/graph.json` (that is, `app/public/data/graph.json`), then the bundled sample.

`app/public/data/graph.json` is git-ignored. Build it from a local snapshot with:

```bash
cd app
npm run sync:graph -- ../graph_runs/snapshots/<version>
```

`scripts/graph_build/` is the Python pipeline that turns a folder of extracted questions into such a snapshot. The source papers, transcripts and snapshots are git-ignored and must be supplied locally. Use `AL_GRAPH_PATH=sample` or `VITE_GRAPH=sample` to force the sample bank.

To make the offline diagnoser work on your own questions, add `checks` (and optionally `traps` and `hint`) to each canonical step, and `answerChecks` and `answerIndex` to each question. Copy the format from `src/data/sampleGraph.ts`.

---

## Roadmap

From [`PROJECT_REPLAN.md`](PROJECT_REPLAN.md) §7:

- [x] Mobile-first Solve flow with photo, type, orient and stuck paths, and one coach message at a time
- [x] Concept graph, belief model, 80/20 picker, spaced review, warm-up and recap
- [x] LLM diagnosis with leakage, false-praise and contradiction guards; offline step-level diagnoser
- [x] Invite identity, consent and retention scaffolding; staged photo-diagnosis pipeline (server)
- [ ] Merge the Graph Tutor policy fully behind Solve, with server-side learner state as the single source of truth
- [ ] Transactional persistence (native SQLite in WAL mode, then Postgres) replacing whole-file `sql.js` writes
- [ ] Photo-diagnosis evaluation: 180 consented handwritten attempts, blind gate (≤2% false "correct", ≥85% first-break agreement)
- [ ] Licensed or original full content bank (`production_v2`) with diagram support
- [ ] Eight-week private pilot measuring holdout marks gained per active hour

---

Keywords: JEE preparation, IIT JEE, JEE Main, JEE Advanced, AI tutor, adaptive learning, intelligent tutoring system, knowledge tracing, spaced repetition, step-level feedback, handwritten math diagnosis, physics chemistry maths.
