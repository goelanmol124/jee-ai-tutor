# AdvancedLearning — Plan

A working document describing what we are building, why, and how.
Tone: crisp, conversational, decision-oriented. Updated as we go.

---

## 1. Motivation

Most JEE prep apps are MCQ banks with leaderboards. They throw questions at students, mark them right or wrong, and rank them. They don't actually understand what the student knows or where the student's thinking broke down.

We believe past knowledge compounds. Students with a strong base learn faster, and students with a shaky base struggle on the same material the strong student finds easy. The same chapters get repeated again and again, but the *specific* failure points are different per student and rarely diagnosed. So most students spend a lot of time re-reading things they already know, and very little time fixing the precise gaps that hold them back. This is true for both brilliant and poor students in different manners. Poor student is in a vicious loop and a brilliant student finds it slow to find what to study next or what is pending. This is often for case when student has read a chapter or reviewed it but don't have trust or is not able to solve questions. 

We want to build a tutor that:

- Knows what the student actually knows, concept by concept.
- Picks the next thing to learn so it stretches them just enough — not boring, not overwhelming.
- Reads the student's step-by-step working and pinpoints whether the issue was a concept gap, a procedural weakness, or a silly mistake.
- Keeps them coming back, because the system feels useful from minute one.
- Maintains a state of user, understanding their common errors.
- Chooses Delivery Method of information which is optimal and first dig a bit deeper to understand the true flaw and reason of error by student. The digging should be a part of learning as well. 
- It should have an ability to decide what to do next most optimally, not require student to ask or search

If we do this well, a student spends their study hours on what actually moves their JEE rank, and feels they are learning every session.

Our Product Key Metric: No of marks in JEE improved per hour spent in our app by a student

---

## 2. Vision

A JEE Mains and Advanced tutor built on a **concept graph**. Every past JEE question is decomposed into the concepts it uses. We track each student's belief in each concept. We pick the next question or lesson so that roughly ~80% of what it needs is already known and ~20% is new (closest to this ratio). The student solves the problem naturally on paper and snaps a photo. We use an LLM to diagnose the exact step that broke and act on it. Spaced repetition keeps things in memory. Motivation is treated as part of the system, not a UI sticker.

---

Only Vision and Motivation are hard constraints. Everything else in the plan document can be changed with no problem. It is okay to ignore other constraints. 

## 3. Core beliefs and assumptions

These are the assumptions the whole product rests on. Each is a place the system can quietly fail; we list them so we can revisit them.

1. **Past knowledge compounds.** A strong base accelerates new learning. (Well-supported in education research, and the basis of our 80/20 rule.)
2. **The student's goal is JEE rank.** This defines what "best next concept" even means. Without it, the picker has no objective.
3. **Concepts can be cleanly extracted and named.** We use an LLM to auto-generate and curate an ontology from the question bank, rather than relying on massive manual data entry.
4. **A single number per concept + a natural language profile is enough.** Simplification, fine for v1. The LLM can read the profile to adapt its teaching style.
5. **Step-level diagnosis from photos of handwritten work is reliable enough to build around.** Latest multimodal LLMs are very strong at reading messy handwriting and understanding math logic. We should trust them more than old OCR-style systems, while still using confidence checks when the image or reasoning is ambiguous.
6. **Visible progress drives retention.** Mostly true, varies by person.
7. **The student attempts honestly and doesn't game the system.** True for the early audience. Worth designing against later, not now.

---

## 4. The four pillars

The product is four things working together. If any one is missing, the whole thing collapses.

### 4.1 Concept graph from JEE papers

- Take every past JEE question.
- Use an LLM to write the ideal step-by-step solution, grounded against trusted coaching solutions (either through youtube transcript, solution pdf, and in worst case manual annotator) or official answer keys where available.
- For each step, identify the core concept used.
- Map each extracted concept against an **ontology**. We use an LLM to auto-generate the initial ontology. As new questions are processed, the LLM can propose new nodes if a concept is truly missing.
- Add **prereq edges** between concepts (see §7).
- Map concepts to chapters (so chapter-based entry works).
- Don't try to enumerate every possible solution path upfront (see §9). Store a strong canonical solution and let the LLM evaluate reasonable alternative methods at runtime. Major solutions to be enumerated

This graph is the foundation. Everything else stands on it.

### 4.2 Belief per student per concept

- One number per concept per student: probability mastered, in [0, 1].
- A **Natural Language Student Profile** updated by the LLM (e.g., "Struggles with chain rule in trigonometry").
- Updated on every attempt (see §8).
- This is what lets us answer "what does this student know right now?" at any moment.

We have function that informs us of expected JEE marks based on belief per concept for a student. We don't show students their belief per concept or internal graph or any internal working. But a proxy for improvement is shown.

### 4.3 The 80/20 stretch rule

- Pick the next question or concept so roughly 80% of what it needs is already known and 20% is new.
- Soft target — anywhere in 70–90% counts.
- Too easy → boredom. Too hard → demoralisation and dropout.
- This single rule drives onboarding, daily picks, spaced repetition — all of it.
- It is essentially Vygotsky's zone of proximal development, applied through our graph.

### 4.4 Step-level diagnosis of subjective work

- Student solves the problem on paper and snaps a photo, or speaks their logic.
- **LLM-as-Judge:** Instead of a rigid pipeline aligning strings to pre-computed paths, we pass the student's image/text directly to a multimodal LLM.
- The LLM identifies the exact step where understanding broke, even if the student used an unconventional method. If confidence is low, ask for a clearer photo or one clarifying step instead of pretending certainty. It should dig a bit to understand the precise reason of failure. 
- It also classifies the mistake type: **conceptual gap**, **wrong understanding**, **procedure error**, **silly mistake**, or **unclear evidence**. The mistake types here are just indicative and can change.
- This is how we go from "got it wrong" to "didn't apply the product rule when both terms were functions of x" or "you chose the right method but dropped a minus sign" or "I knew this but did not thought to apply here".
- **v1 input must be frictionless:** Photo of handwritten work is the primary input. Typing math on a phone is a churn factory. If we want them to stick to it, taking a picture is the easiest, highest-magic experience.

---

## 5. Cognitive operations and the pedagogy toolbox

Different concepts ask the brain to do different things. So we don't have one teaching style — we have a small toolbox the agent picks from per concept and per session. This is also used while designing solutions. This is used for diagnosis as well to understand what broke. 

### 5.1 Cognitive operations the brain runs

- **Recall** — pull a fact from memory ("what's sin 30°").
- **Recognise** — see a pattern and label it ("this is a quadratic in disguise").
- **Apply** — run a known procedure ("use the chain rule here").
- **Deduce** — combine knowns to derive something new.
- **Plan** — sequence steps to reach a goal.
- **Analogise** — map a known structure onto a new context.

### 5.2 Delivery modes are tutor tools, not vibes

An LLM can teach well, but only if we give it the right job. "Explain this" is too vague. Each delivery mode should be a **tool with a clear input, output shape, and success condition**. The product picks the tool; the LLM fills it with good teaching. Don't over-engineer this with brittle taxonomies.

The LLM is given:

- Student profile: numeric belief scores + natural language weaknesses, any internal summary.
- Target concept and prereqs.
- Current question, canonical solution, and student's submitted work if any.
- Recent mistakes and recent wins.
- Desired difficulty: easy win, normal stretch, or hard challenge.

The LLM returns (per the conversational solve flow described in §14):

- **`coachMessage`** — ONE short chat bubble (≤ 4 sentences) naming what worked and the exact step that broke. This is what the student reads first.
- **`quickCheck`** — ONE 2-4 option inline micro-question on the single fragile idea. Each option carries a one-line `feedback`. This is the teaching moment, not the bubble.
- **`nextMove`** — what the bottom CTA should say (`try_again` | `see_fix` | `micro_drill` | `next_question` | `clarify`).
- **`cards` / `attemptTrace` / `conceptEvidence` / `beliefUpdates`** — plumbing for the belief graph and analytics. Kept tight, not surfaced as walls of text.
- Confidence and whether extra evidence is needed (`needsClarification`).

The UI never renders a generated blob of text. Every coach turn is one small, named artifact: a bubble, a micro-question, a sticky CTA. Optional follow-ups (worked example, micro-drill, hint ladder, splice) are launched on demand from the same bottom CTA, and they too return as small per-step cards stacked into the same chat thread.

### 5.3 The teaching tools (optional and extendable)

- **Diagnosis card** — used after an attempt. Output: verdict, first wrong step, mistake type, concept gap if any, one-sentence correction, belief updates. This is the default post-submit tool.
- **Hint ladder** — used while the student is stuck. Output: 3–5 hints, each more explicit than the last. First hint should preserve agency; final hint can almost reveal the step.
- **Micro-lesson** — used when a concept is genuinely missing. Output: 60–120 seconds of teaching: definition, why it matters, one tiny example, one trap.
- **Worked example** — used for a new procedure. Output: full solution with short reasoning per step, not a wall of algebra. Best when the student has enough prereqs but has not seen the pattern.
- **Splice** — used to test one fragile step. Output: a half-solved problem where the student completes the exact missing move. This is the best tool after a diagnosis because it converts "I understood the explanation" into evidence.
- **Micro-drill** — used for repetition. Output: 2–4 very small questions targeting one concept, with instant feedback. Better than jumping straight back to a full JEE problem.
- **Full drill** — used for integration. Output: one real JEE-style problem that combines the target concept with already-mastered prereqs.
- **Flashcard** — used for recall maintenance. Output: front/back card, expected answer, common wrong answer. Best for formulas, facts, standard patterns, and traps.
- **Check card** — used when the student knew the method but made a silly mistake. Output: the exact slip, a quick self-check habit, and one tiny similar step to verify. This should feel lightweight, not like being punished with a lesson.
- **Reflection card** — used after a meaningful mistake or win. Output: one sentence that turns the specific episode into a reusable rule: "When I see ___, I should check ___." Keeps learning sticky without becoming motivational fluff.
- **Analogy Card** - Often the same concepts is used in different domains. Ability to use same concepts in different domains and extra context allow students to make new and stronger neural connections.

### 5.4 How the agent picks the tool (Just Suggestive. To be improved with iterations)

Default loop:

1. Student attempts a question.
2. Run **Diagnosis card**.
3. If the issue is tiny, give a **Hint ladder** or correction and let them continue.
4. If it is a silly mistake, give a **Check card** and one fast verification step.
5. If the issue is conceptual, run a **Micro-lesson** or **Worked example**.
6. Immediately follow with a **Splice** or **Micro-drill** on the same idea.
7. Only then return to a **Full drill**.

Rough selection rules:

- Belief very low + concept is prerequisite → **Micro-lesson**, then **Micro-drill**.
- Belief low + procedure is unfamiliar → **Worked example**, then **Splice**.
- Belief medium + one recurring mistake → **Diagnosis card**, then **Splice**.
- Belief medium/high + student is stuck → **Hint ladder**, not full explanation.
- Belief high + concept is due for review → **Flashcard** or **Full drill**.
- Correct method + arithmetic/sign/copying slip → **Check card**, not a concept lesson.
- After any emotionally painful miss → **Reflection card** plus one easy recovery item.

Same content, different tool, very different effect on retention. For v1, the app does not need every tool to be fancy. The important part is that the LLM is prompted to produce a specific teaching artifact, and the student always gets one easy next action.

For meaningful mistakes, the delivery should usually follow: specific personal moment → general rule → tiny transfer attempt. The episode makes it memorable; the rule and transfer attempt make it reusable for unseen JEE problems.

### 5.5 Coverage of delivery methods

Keep the original teaching modes, but express them as student-facing cards/actions:

- **Tell** → **Micro-lesson.** Short direct explanation when a missing idea blocks progress.
- **Show** → **Worked example.** Demonstrate a procedure when seeing the pattern matters more than hearing the definition.
- **Ask** → **Hint ladder.** Socratic nudges when the student is close and should still do the thinking.
- **Drill** → **Micro-drill** or **Full drill.** Micro-drill for one weak move; full drill for integrated JEE practice.
- **Flash** → **Flashcard.** Fast recall and spaced repetition.
- **Splice** → **Splice.** Half-solved problem to test the exact fragile step.

Two extra cards sit around these modes:

- **Diagnosis card** comes before teaching. It decides what actually failed.
- **Check card** handles silly mistakes. It builds a checking habit without pretending the student lacks the concept.
- **Reflection card** comes after important moments. It turns a mistake or insight into one memorable rule of thumb.

Implementation note: prompts should ask for these card types clearly, but the plan should not freeze the exact prompt or JSON schema yet. That belongs in the product/prompt layer after we have a few real examples.

---

## 6. The scoring function (merely indicative, can change during implementation)

Picking the next item is a search problem. For each candidate question or concept `q`, compute:

```
score(q) =
    w_stretch    * stretch_fit(q)        // how close to 80/20
  + w_info       * info_gain(q)          // how much it tells us about the student
  + w_unlock     * downstream_unlock(q)  // how many future concepts it enables
  + w_examfeel   * exam_feel(q)          // is it a real JEE-style problem
  + w_review     * review_due(q)         // spaced repetition pressure
  - w_load       * cognitive_load(q)     // current session fatigue
```

The scores to obtained by relevant calculations on student profile and graph. 

### 6.1 Component definitions

- **`stretch_fit(q)`** — peaks when ~80% of `q`'s prereqs are above belief threshold and ~20% are not. Triangular or Gaussian centred at 0.2 unknown.
- **`info_gain(q)`** — how much answering this would reduce uncertainty in our belief over the concepts it touches. High for questions that touch many high-uncertainty concepts.
- **`downstream_unlock(q)`** — how many future concepts become reachable (under the 80/20 rule) if `q`'s concepts move to mastered.
- **`exam_feel(q)`** — is this a full JEE-style problem (high) or a base-building micro-drill (low). Used for visible-progress balance.
- **`review_due(q)`** — spaced repetition pressure for concepts in `q`.
- **`cognitive_load(q)`** — heuristic on length and difficulty, weighted up if the student is deep into a session and tiring. Repeated silly mistakes are a signal to reduce load briefly or insert a check habit, not necessarily to lower concept difficulty.

### 6.2 The delayed-reward problem

Building base layers gives delayed payoff. The student doesn't *feel* progress when we shore up prereqs. But we can't only ship them "feels like progress" questions either; the base stays weak.

Solution: **mix within a session**. Even on a base-building day, alternate base-building items with one exam-feel item every few questions. Frame the base work as "warming up the engine for the next real problem". Honest, and feels right.

### 6.3 v1 picker flow

For v1, keep the picker simple:

1. Hard-filter by chapter, difficulty band, due reviews, and the 70–90% known range.
2. Score candidates with the hand-set weights above.
3. Take the top 10–20.
4. Let the LLM rerank that short list using the student's natural language profile and recent session context.

This keeps the system explainable and cheap, while still letting the LLM notice human details a formula will miss.

---

## 7. 80% known — operational definition

The fuzzy phrase needs a sharp meaning.

> "80% known" means: of the prereq concepts of this target, roughly 80% are above the belief threshold.

Soft target — anywhere in 70–90% counts.

### 7.1 Where prereqs come from

Two layered sources:

1. **Graph proximity (cheap, noisy).** Concepts that frequently co-occur with the target across many questions are *candidate* prereqs. Cheap to compute from the graph.
2. **One-time LLM pass (more accurate).** For each concept, ask the LLM "what must someone already know to learn this?" once. Store the edges. Human reviews high-traffic ones.

Use both. Prefer the LLM list when they disagree.

### 7.2 Conceptual proximity

There is a second flavour of 80/20: the new concept is a close cousin of one already known (e.g., logarithmic differentiation when basic differentiation is mastered). Treat this as a separate signal that feeds `stretch_fit`. Not all stretch is "more prereqs"; some is "neighbouring concept".

---

## 8. Belief — operational definition

Per concept, store one number: probability mastered, in [0, 1].

### 8.1 Priors

- Concepts in chapters the student said they've covered: prior 0.3.
- Other concepts: prior 0.05.

### 8.2 Updates

On each attempt:

- Right → push toward 1 (e.g., new = old + α(1 − old), α small).
- Wrong → push toward 0 (e.g., new = old · (1 − β), β small).
- Silly mistake with correct method → do not punish the main concept much. Track the slip separately (sign error, arithmetic, copying, units, premature simplification, skipped condition).

### 8.3 Practical rules layered on top

- **5 in a row right → freeze as mastered.** Stop scheduling unless a downstream failure suggests rot.
- **4 out of 5 right → low priority.** Mostly there, deprioritise versus actual gaps.

Don't reach for Bayesian Knowledge Tracing yet. The above is enough to drive the picker.

### 8.4 Step-level credit assignment

When a student attempts a question, give belief credit (positive or negative) only to the concepts on the path they actually used. The LLM judge tells us exactly which concepts were successfully applied and which failed.

If the student used the right concept and procedure but made a silly mistake, give positive or neutral credit to the concept and record a separate **silly-mistake pattern**. Repeated slips are real learning data, but they should drive check habits and targeted micro-drills, not false "you don't know the concept" updates.

### 8.5 The Natural Language Profile (LLM-driven)

Alongside the numeric `[0,1]` scores, we maintain a **Natural Language Student Profile** (e.g., *"Strong at integration mechanics, but forgets to apply the chain rule when nested functions are involved"*). It should also track recurring silly-mistake patterns, like *"often drops minus signs in coordinate geometry"* or *"forgets domain restrictions after squaring both sides"*. The LLM updates this profile periodically. This gives the tutor a much more human, nuanced understanding of the student than numbers alone, and requires zero complex engineering to maintain.

---

## 9. Multiple solution paths per question

Every question can have multiple valid methods. We do not need to pre-compute every possible path. Store the question and one canonical solution to anchor correctness.

When a student submits their work, the LLM should recognize reasonable alternative methods and evaluate the method the student actually used. If the method is valid, grade it as valid even if it differs from the canonical solution. If it is unclear, ask for one clarifying step.

For belief updates, the diagnosis should map the student's method back to the closest concepts in the ontology. We do not need perfect path storage for v1; we need enough concept attribution to update belief and choose the next useful action.

---

## 10. Onboarding — first useful win

> Goal: from no prior to first useful feedback in under 3 minutes.

The first iteration should avoid decision paralysis. The product should take responsibility for the first move while still giving the student an escape hatch.

First open:

1. Primary action: **Choose for me.** The graph picks a high-confidence, approachable starting area. This is the default because most students are already overloaded by "which chapter/book/test should I do?"
2. Secondary action: **Pick a chapter.** Only for students who know today's target.
3. Tertiary action: **I'm stuck.** Still starts from an anchor problem and photo diagnosis; later we can add custom doubt upload, but v1 should not become a general chat/PDF solver.
4. Give one approachable question immediately, opened in the conversational Solve view (§14): just the question, three engage tiles, MCQ (if any).
5. Let them solve on paper and snap a photo (or type one line).
6. Coach replies with ONE chat bubble + one inline quick-check, then a sticky CTA for the next move.

After that first win, run a light prior-setting sprint if they continue: 3–5 questions that span nearby concepts, hit high-coverage concepts, and vary gently in difficulty. Do not make this feel like a placement test. Each question gets normal feedback, normal hints, and normal warmth.

When the student opens the app later:

- If there is meaningful review due or a recent stumble from a previous day, start with the 3–5 card warm-up.
- If they already studied today, or there is not enough history for a useful warm-up, open directly to the next graph-picked question in the Solve view.
- Always allow escape: skip warm-up, see map, or redirect by chapter. The system leads, but the student can steer.

Chapter-based entry remains useful, but it is no longer the default burden. The graph should proactively choose until the student overrides it.

---

## 11. Spaced repetition and the daily Anki warm-up

### 11.1 Spaced repetition

- Mandatory.
- A scheduling layer on top of the belief model. Each concept has a next-review time that grows with each successful recall and shrinks on failure.
- Standard SM-2-style interval doubling is fine for v1.

### 11.2 Daily Anki warm-up

- On app open after the student has enough history: 3–5 cards. Two minutes.
- Sources, in order:
  1. Review-due concepts (spaced repetition).
  2. Recent stumbles.
  3. One easy freebie to start the streak.
- Then transition into the main session. The warm-up should feel like momentum, not a gate; if the student came to solve a specific problem, let them jump in.
- Doubles as the daily motivation hit — every session starts with a small win.

---

## 12. Motivation as a first-class layer

Pedagogy and motivation are equal partners. If they don't open the app tomorrow, none of the rest matters.

Mechanisms, in order of importance:

- **Daily warm-up (above).** Guaranteed quick win.
- **Visible map.** Show the concept graph filling up with colour as the student progresses. Spatial progress lands harder than numeric progress. But this should not reveal internal structure. This is merely aesthetic. This should not even reveal how is system made. 
- **Compare to past self, not others initially.** "You solved this 30% faster than last week on similar problems." Leaderboards later as stage unlocks and that too something not harsh, something motivating.
- **Reframe failure.** "Found a gap" or "caught a slip" instead of "wrong". Coach voice — pleased to spot something to fix.
- **Concrete counters.** "47 past JEE Mains questions solved", "18 concepts mastered this week". Honest, countable, no fake predictions.
- **Streaks.** Cheap, works. (Not just daily streak but more types of streaks)

The deeper point: motivation is a feedback loop in the same model. Right belief → right difficulty → small win → motivation up → more time spent → more belief growth. Treat it as part of the system, not a sticker.

---

## 13. Input modalities (Frictionless First)

If we want users to stick to the app in iteration 1, the input must be zero-friction. Typing math on a phone is tedious. The Solve view (§14) reduces input to **three named paths**, presented as three big choice tiles, never visible together with anything else:

1. **"I solved on paper" → photo (default for v1).** One tap opens the camera. The student snaps their rough work and that's the whole interaction. The LLM reads handwriting, names the broken step, and replies in one bubble. This is the magic moment.
2. **"Let me type" → plain text.** A single auto-grow textarea. Students who are on a laptop or who prefer typing can write a few lines of natural-language reasoning. KaTeX inline if they want, plain English if they don't.
3. **"I'm stuck" → honest stop.** No guessing. The coach acknowledges the stop and starts at the very edge of the student's current knowledge with a hint or a tiny micro-lesson.

MCQ options live above these three tiles. Picking an MCQ option does NOT count as engagement on its own — the coach asks for one line of "why" before replying, so the bubble is reasoning-aware, not guess-aware.

Voice input is deferred to a later iteration. Step-by-step typed math (the old `MathInput` step list) is also retired in v2 because it added too much UI for too little payoff on mobile.

---

## 14. UX principles (v2 — conversational solve loop)

The earlier "two-column notebook + coach rail" canvas was scrapped because it forced a 11th-class JEE student to scan four panels at once, parse five tiny labels, and decide between four input modes before they had even read the question. The replacement is a **chat-thread solve view** built on these principles:

- **One thought at a time.** The student sees ONE artifact at a time: the question, then their reply, then the coach's bubble, then maybe one inline quick-check. Nothing else competes.
- **Question is sacred.** Stage 0 of every problem is just the question — large, serif, generously spaced. No "diagnose mode" tags, no streak ribbons, no prereq strips. The only path forward is to engage. Once they engage, the question collapses to a one-line pin at the top with a tap-to-expand.
- **Three engage paths, never four.** "I solved on paper" (photo), "Let me type" (text), "I'm stuck" (honest stop). MCQ options sit above and act as a fourth shortcut, but always need ONE line of "why" before the coach replies.
- **Coach speaks like a bhaiya, not a system.** Each diagnosis is ONE short bubble (≤ 4 sentences). Plain language. The model fields `coachMessage` (the bubble), `quickCheck` (one inline 2-4 option follow-up), and `nextMove` (try-again | see-fix | micro-drill | next-question | clarify) drive the UI directly. Old fields (`cards`, `attemptTrace`, `conceptEvidence`, `beliefUpdates`) stay as plumbing for the belief graph but are never rendered as walls of text.
- **Force engagement before feedback.** The coach bubble cannot appear until the student picks a path and submits SOMETHING — a photo, one typed line, or an honest "I'm stuck". This is the natural enforcement that the question gets read.
- **Quick-check converts diagnosis into evidence.** Right under the coach's bubble, ONE 2-4 option micro-question on the single fragile idea (not the whole problem). Big tap targets, immediate feedback bubble. This is where actual learning happens — not in a wall of explanation.
- **One sticky bottom CTA, always.** The bottom of the screen always shows the obvious next move: "Try again", "Show me the fix", "Next question". The student never has to hunt for what to do next. A small "Save & next →" link is always available as an escape hatch.
- **Mobile-first, single column.** The desktop layout is exactly the same as mobile — a centred 640-px column with chat bubbles. No two-column shenanigans. Laptop users get a calmer, more-focused screen as a side-effect.
- **Type sizes that respect the eye.** Body 17 px, question 23-28 px, math KaTeX +20 % in the question and +10 % in bubbles. Min tap target 52 px. Min touch CTA 56 px.
- **Coach colour palette is one accent.** Soft violet for the coach bubble, paper-white for the student bubble, leaf-green for "correct", amber for "let's clarify". No multi-colour rainbow.
- **Speed > pretty.** The diagnose / tutor-tool calls run on `grok-4-1-fast-non-reasoning` so the coach reply lands in 1-2 seconds instead of 8-12 seconds. We accept slightly less elaborate answers in exchange for a thread that feels alive.

Detailed component code lives in [`app/src/views/Solve.tsx`](app/src/views/Solve.tsx) and the Solve-specific styles in [`app/src/index.css`](app/src/index.css). The conversational fields are defined in [`app/src/domain/types.ts`](app/src/domain/types.ts) (`coachMessage`, `quickCheck`, `nextMove`).

---

## 15. What's in for v1, what's out

### In

- Concept graph + LLM-curated ontology.
- Prereq edges (graph proximity + one-time LLM pass).
- Dynamic LLM evaluation of alternative solution paths (no exhaustive path hardcoding).
- Belief per concept (simple update + Natural Language Profile + silly-mistake patterns + 5-in-a-row freeze).
- Scoring function heuristic + LLM reranking.
- Structured tutor tools (Diagnosis card, Hint ladder, Micro-lesson, Worked example, Splice, Micro-drill, Full drill, Flashcard, Check card, Reflection card).
- Spaced repetition + Anki warm-up.
- Step-level diagnosis via LLM-as-judge on **photos of handwritten work** (lowest friction), including classification of concept gaps vs silly mistakes.
- Motivation layer (graph fill, past-self comparison, streaks, "found a gap" / "caught a slip" framing).
- Quick onboarding that already feels like learning.
- Clean, frictionless UX.

---

## 16. Build order

1. **Handwriting vision + LLM-as-judge pipeline.** This is the core magic and lowest friction input. Prove the LLM can read student rough work and diagnose the error reliably.
2. **Curate the concept ontology.** Use an LLM to auto-generate the ~1,500–3,000 nodes from the NCERT syllabus. Don't do it manually.
3. **Tag every past JEE question** against the ontology using the LLM.
4. **Build prereq edges.** One-time LLM pass per concept.
5. **Belief model + question picker.** Implement simple numeric belief + Natural Language Profile + LLM reranking for the next question.
6. **Spaced repetition scheduler + Anki warm-up.**
7. **Motivation surface** — graph fill visualisation, streaks, past-self comparisons.
8. **Structured tutor tools.** Prompt-engineer each teaching artifact so the LLM returns useful cards/actions, not vague explanations. Build the first few cards earlier if needed for the handwriting prototype.
9. **Voice input** integration.

Concept granularity (how exactly we break a question into concepts) is a parallel piece of work. The whole graph quality rides on it, but it should not block proving the photo → diagnosis → tiny next action loop.

---

## 17. Data pipeline (offline, one-time per question)

Although ground-truth quality is "out" of the runtime product, it matters at ingestion. For each past JEE question:

1. Collect candidate solutions from multiple sources (YouTube transcripts of solution videos, structured solution PDFs, etc.).
2. Have an LLM cross-check them and produce one canonical step-by-step ideal solution.
3. For each step, tag the concept against the ontology.
4. Human review on a sample to keep the LLM honest.
5. Store: question, canonical steps, concepts, prereqs, difficulty.

Once this is done well, the runtime product treats the database as ground truth and never has to cross-check again.

---

## 18. Open questions (Resolved via LLM-first approach)

- **Concept granularity.** *Resolution:* Let the LLM define it. Prompt it to extract "the specific named technique a teacher would point out" and let embeddings/clustering handle slight variations.
- **Step alignment.** *Resolution:* LLM-as-judge. We pass the student's image/text directly to the LLM. No rigid edit-distance algorithms or pre-computed paths needed.
- **Initial weights** for the scoring function. *Resolution:* Keep it simple. Equal weights to filter top 20 candidates, then let the LLM pick the best one based on the student's natural language profile.
- **Prior calibration.** Are 0.3 / 0.05 priors right? Watch early users, adjust. The LLM profile will compensate for slightly wrong numeric priors anyway.
- **Belief update step sizes** (α, β) — same as above.
- **Anti-gaming.** Eventually students will figure out how to look better than they are. Not a v1 problem, but note it.

---

## 19. Glossary

- **Concept** — a single named idea, technique, or fact in the JEE syllabus. The unit of belief and the node of the graph.
- **Ontology** — the curated list of concepts, auto-generated and maintained by the LLM.
- **Prereq edge** — directed edge in the graph: A → B means knowing A is required before B.
- **Belief** — probability the student has mastered a concept, in [0, 1], supplemented by a Natural Language Profile.
- **80/20 stretch** — the rule that the next item should be ~80% known prereqs, ~20% new.
- **Path** — one valid sequence of concepts from question to answer. Evaluated dynamically by the LLM.
- **LLM-as-Judge** — passing student input (image/text) to a multimodal LLM to diagnose errors without rigid string alignment.
- **Silly mistake** — an execution slip despite knowing the main idea: arithmetic, sign, copying, units, skipped condition, or careless simplification. Track separately from concept mastery.
- **Tutor tool** — a structured teaching artifact the LLM produces, such as a diagnosis card, hint ladder, micro-lesson, splice, check card, or flashcard.
