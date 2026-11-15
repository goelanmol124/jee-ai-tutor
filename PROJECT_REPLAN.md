# AdvancedLearning — Private Pilot Replan

This document turns the creator's product thesis into one executable product plan.
It does not reopen the thesis. The concept graph, student model, 80/20 stretch
policy, photo-based diagnosis, adaptive pedagogy, spaced repetition, and
motivation loop are treated as correct.

The implementation question is now: how do we make those ideas operate as one
reliable product for real JEE students?

## 1. Decisions now locked

- **Next milestone:** private pilot with real students.
- **Pilot cohort:** mixed Class 11, Class 12, and droppers.
- **Content scope:** every usable question and chapter available in the repository,
  not a one-chapter demo.
- **Primary evidence input:** a photo of handwritten work. This is a pilot launch
  gate, not a post-pilot enhancement.
- **Identity:** lightweight invite-based identity with server persistence.
- **Product architecture:** preserve the main `Solve` experience as the interaction
  shell, but replace its legacy local decision state with the Graph Tutor's richer
  server-side learner model and rule-layer decision machinery.

## 2. The single product spine

The canonical product is:

> **Solve UI outside, Graph Tutor brain inside.**

`Solve.tsx` is closer to the correct student experience. It protects attention,
makes the question readable, supports photo/text/MCQ/stuck/orient entry, keeps
the question available without dominating the screen, and allows structured
shortcuts alongside free conversation.

The Graph Tutor is closer to the correct product intelligence. It has:

- server-persisted learner state;
- explicit self-report versus observed evidence;
- concept-level evidence history;
- formula recall, understanding, and transfer distinctions;
- recurring mistake patterns;
- chapter coverage and parked questions;
- spaced-review schedules;
- a rule layer that proposes pedagogical candidates;
- an LLM that chooses and realizes one candidate;
- guarded state updates and duplicate-question prevention.

Neither current surface should ship unchanged.

### 2.1 Why the original notebook/canvas approach failed

The original two-column notebook and coach-rail design asked a student to:

- read a dense question;
- understand internal modes and prerequisite indicators;
- type structured mathematical steps on a phone;
- watch several regions for feedback;
- decide among several tools before the system had established what was wrong.

It reflected the internal model well but transferred too much system complexity
to the learner. It also assumed the student could already articulate structured
working. The creator later identified the actual failure: when a student does not
know how to start, the screen creates pressure to close the app.

### 2.2 What the current Solve flow fixed

Keep:

- one-column mobile-first reading;
- the question as the first and dominant artifact;
- photo as the primary action;
- MCQ selection requiring reasoning before evaluation;
- separate **Orient me** and **I'm stuck** intents;
- one short coach response at a time;
- quick checks and free-text follow-ups;
- a persistent but non-blocking path to the next question;
- answer-leakage and false-praise guards;
- language mirroring.

Replace:

- local-only student state;
- legacy `StudentState` and direct belief deltas;
- question selection computed independently of the Graph Tutor;
- diagnosis-driven next-action defaults that do not consult the full learner history;
- duplicated conversation and transcript state.

### 2.3 What the current Graph Tutor contributed

Keep:

- `UnifiedTutorStudentState` as the canonical learner model;
- chapter-entry topic chips as priors, never proof;
- `proposePickerCandidates` as the deterministic policy boundary;
- explicit modes for gauge, teach, derive, splice, full question, error probe,
  correction, reflection, parking, and review;
- server-side transcript, mistake, review, and coverage persistence;
- filtering of state updates against the graph slice and taught concepts;
- harness personas and transcript review.

Retire:

- `TutorSession.tsx` as a separate student-facing product;
- the floating **Graph tutor** beta entry;
- the generic raw chat layout;
- separate student identifiers and state histories;
- visible development meta-narration;
- long chains of broad probes when enough evidence exists to teach or present a
  real question;
- generic deterministic fallbacks that pretend a meaningful pedagogical turn
  occurred.

## 3. Canonical student experience

### 3.1 First entry

1. Student opens an invite link.
2. Enters a first name or nickname and invite code.
3. Server returns a stable student ID; the device stores only the opaque ID.
4. Student selects Class 11, Class 12, or dropper and can adjust subjects/chapters
   currently in scope.
5. The system proposes a few chapter topic bundles:
   **Confident / Know roughly / Formula only / New to me**.
6. These answers initialize priors. They do not mark concepts mastered.
7. The picker chooses an approachable real JEE question with high information
   value and confidence-building potential.

The cohort choice controls default scope and analytics, not permanent access.
Add a reviewed chapter-to-Class-11/Class-12 mapping to the chapter catalog.
Droppers default to the full catalog; every student can override chapter scope.
Preserve **Formula only** distinctly as `formula_only` through chapter entry,
storage, and the unified state rather than collapsing it into `seen`.

### 3.2 Every question

1. Show the question alone, with readable options when applicable.
2. Provide one dominant action: **I solved it on paper**.
3. Keep three secondary escape doors:
   - **Let me type**
   - **What is this about?**
   - **I'm stuck**
4. After engagement, collapse the question into a readable pinned reference.
5. Run photo/text diagnosis.
6. Render one coach message naming:
   - what evidence is genuinely present;
   - the first causal break or the fact that the work is sound;
   - one immediate invitation.
7. The policy chooses the next action using the full learner state:
   - ask one discriminating error probe;
   - locally correct a small slip;
   - give a micro-lesson;
   - show a worked slice;
   - ask for a splice;
   - schedule recall;
   - return to the same problem;
   - move to a new problem.
8. Keep free text available throughout. Structured chips accelerate common replies
   but never terminate conversation by themselves.
9. End only when the tutor has useful evidence, the learner chooses to leave, or
   the policy explicitly parks the item.

### 3.3 Across sessions

- Start with due recall or a recent unresolved gap when useful.
- Otherwise open directly on the next graph-selected question.
- Interleave foundation work with real exam-feel questions.
- Avoid repeated questions unless explicitly scheduled as review.
- Preserve parked questions and return after prerequisites improve.
- Show honest counters and past-self progress; keep internal probabilities,
  graph mechanics, and evaluator terminology hidden.

## 4. Target architecture

### 4.1 One learner model

`UnifiedTutorStudentState` becomes authoritative.

It retains:

- self-report priors;
- observed state;
- derived belief;
- confidence;
- recent evidence;
- formula quoting and understanding;
- application flexibility;
- mistake patterns;
- chapter/subtopic coverage;
- parked items;
- review schedules;
- language/profile narrative;
- session mode and recent full-question count.

The current `SingleUserLearningState`, legacy `StudentState`, local belief updates,
and local attempt history become adapters during migration and are then removed.

Belief remains derived server-side from evidence. LLM responses propose structured
evidence; they do not write arbitrary probabilities.

### 4.2 One session orchestrator

Create a server-side orchestrator that owns:

1. session start;
2. due-review decision;
3. question/action candidate generation;
4. preferred question selection;
5. diagnosis ingestion;
6. optional error probing;
7. state update;
8. next-action selection;
9. transcript and event persistence.

Keep diagnosis and next-action selection as separate operations:

- **Diagnosis** interprets the submitted work.
- **Policy** decides what to do with that evidence in the context of history.

This separation prevents the image judge from controlling the entire learning
sequence and makes both stages independently testable.

Store every accepted diagnosis server-side and pass only its opaque diagnosis ID
into the policy step. Never accept client-authored diagnosis evidence or apply the
same diagnosis twice.

All selectable content passes through one centralized eligibility boundary before
either question picker can see it. Eligibility requires a valid stem, canonical
steps, concept links, acceptable source/review status, and any essential diagram
asset. This closes current paths where a review-flagged question can re-enter
through fallback selection.

### 4.3 Pilot API

- `POST /api/auth/join`
  - invite code + nickname + cohort;
  - returns stable opaque student ID plus a separate unguessable session token.
- `GET /api/student`
  - returns safe profile/session summary.
- `POST /api/session/start`
  - chooses due review, continuation, or next question.
- `POST /api/attempt/diagnose`
  - multipart photo or typed reasoning;
  - returns a stored diagnosis ID plus structured student-facing feedback.
- `POST /api/tutor/step`
  - accepts a trusted diagnosis ID, probe reply, or free text;
  - applies valid evidence and chooses one pedagogical turn.
- `POST /api/session/next`
  - finalizes the current item and chooses the next one.
- `POST /api/session/end`
  - creates recap and closes active-time accounting.

The React client renders this state machine. It does not own learning policy.

### 4.4 Persistence

Replace whole-file `sql.js` export-on-write before pilot.

Use a storage adapter and a transactional database implementation with:

- students and invite codes;
- learner-state snapshots;
- append-only evidence;
- transcript turns;
- attempts and diagnoses;
- mistake patterns;
- review schedules;
- active sessions;
- product events;
- prompt/model/version metadata.

A native SQLite database in WAL mode is sufficient for a small single-instance
pilot if all writes are transactional and backed up. The adapter must allow a
later move to Postgres without changing tutor logic.

The migration needs versioned schema migrations, a backup of the old database,
copy/import validation, row-count checks, atomic cutover, and a rollback path.
Exclude `anon`, synthetic harness identities, and test transcripts from pilot
student migration.

### 4.5 Identity

- Invite code identifies the pilot enrollment.
- Server creates `stu_*` opaque identity.
- Device stores an unguessable session token, not a trusted bearer student ID.
- Every request resolves the token to a student server-side.
- Re-entering a rotatable/revocable recovery invite can restore the account.
- One canonical storage key replaces the existing independent IDs.
- Admin tools can deactivate invites without deleting learning evidence.

No passwords, OAuth, social login, or multi-device merge are needed for this pilot.

## 5. Full-content workstream

The current canonical snapshot `production_v1` contains:

- 1,403 concepts;
- 1,413 aliases;
- 617 concept edges;
- 600 questions;
- 602 methods;
- 2,978 solution steps;
- 2,083 question-concept links.

This is a serious base, but 600 questions across 133 chapter clusters is too thin
for repeated use if distributed evenly. It represents eight finalized April slots,
not the complete JEE PCM archive. The pilot promise is therefore **all
repository-available, pilot-eligible content**, not all historical JEE content.

### 5.1 Build `production_v2`

1. Inventory every archived JEE slot and every usable source record, including
   the known missing-source gap for 2026-04-08 Shift 1.
2. Promote remaining heuristic slots through canonical record synthesis and the
   `final75` verification/finalization pipeline.
3. Run the existing context-aware solution pipeline on every record not already
   represented.
4. Validate schema, answer agreement, concept registration, topic/subtopic,
   diagram sufficiency, and source quality.
5. Repair style/schema issues with the cheap model.
6. Escalate disputed answers and essential-diagram cases.
7. Run concept resolution and LLM-assisted merge over the complete set.
8. Rebuild prerequisites and derived metrics.
9. Generate a coverage report by subject, chapter, subtopic, difficulty,
   answer type, diagram dependence, and human-review status.
10. Ingest diagram assets and preserve `diagram_context` in typed graph data.
11. Export an immutable `production_v2` snapshot.
12. Sync the exact snapshot into the app through one typed adapter.

### 5.2 Content release gate

- Every graph question used in the pilot has canonical steps and concept links.
- No item marked `needsHumanReview` is selected automatically.
- Diagram-essential questions are used only when the diagram is available and
  both the student UI and diagnosis model receive it.
- No broken/missing stem is selectable.
- Duplicate and near-duplicate questions are grouped for repeat control.
- Every chapter is visible, but the picker reports and respects local question
  depth to avoid immediate repetition.
- Thin chapters can use verified splice, derivation, and recall items generated
  from canonical steps; these items must be cached and validated before reuse.

## 6. Photo diagnosis workstream — hard launch gate

The existing multimodal path is promising but has not been measured on a
representative set of real JEE rough work.

### 6.1 Evaluation set

Collect at least 180 consented handwritten attempts:

- 60 each from Physics, Chemistry, and Mathematics;
- balanced across Class 11, Class 12, and droppers;
- correct, partially correct, conceptual failure, wrong understanding,
  procedural error, recall failure, execution slip, and unreadable cases;
- single-page and multi-page;
- different lighting, camera angle, ink, handwriting density, crossed-out work,
  English, and Hinglish annotations.

Use 60 for prompt/development iteration and keep 120 blind until the gate run.

Add ordered multi-image capture before evaluating multi-page attempts. The UI
must let the student review, reorder, replace, or remove pages; the server must
enforce page count and payload limits and preserve page order in the multimodal
request. The current single-image upload is not sufficient.

Two qualified reviewers annotate:

- transcription of relevant steps;
- method/path used;
- first causal break;
- mistake category;
- concepts positively demonstrated;
- concepts needing further evidence;
- whether clarification is required;
- allowed next actions.

Disagreements are adjudicated by the maker.

### 6.2 Required metrics

Pilot does not open until the blind set meets all of:

- schema-valid responses: **≥ 99.5%** after one repair;
- final-answer or option leakage while work remains active: **0**;
- false “correct” on materially wrong work: **≤ 2%**;
- invented error on correct work: **≤ 3%**;
- exact or adjudicated-equivalent first causal break: **≥ 85%**;
- correct mistake family: **≥ 85%**;
- unreadable/insufficient evidence routed to clarification: **≥ 95%**;
- no belief-changing negative evidence when confidence is below threshold;
- median response latency **≤ 5 seconds**, p95 **≤ 12 seconds** on pilot hosting.

Any failure becomes a named regression case in the permanent harness.

### 6.3 Safe behavior

- Low-confidence diagnosis asks for one precise missing piece.
- The coach never fabricates unreadable lines.
- A photo failure does not become concept-failure evidence.
- Correct methods differing from the canonical path remain valid.
- Contradictions are acknowledged and corrected explicitly.
- Raw image retention is opt-in, time-limited, access-controlled, and separated
  from normal product analytics.

## 7. Implementation milestones

Workstreams that do not depend on each other should run in parallel.

### M0 — Freeze contracts and measurement (3–4 days)

- Freeze canonical product flow and state vocabulary.
- Define evidence, diagnosis, tutor-turn, session, and event schemas.
- Define prompt/model/version fields.
- Define pilot metrics and active-time calculation.
- Add visibility-aware active-time heartbeats and an idle cutoff; do not use
  wall-clock time from question open to session end.
- Build one end-to-end fixture covering photo → diagnosis → probe → update → next.
- Recruit the offline handwriting-evaluation pool, obtain consent, and confirm
  maker/reviewer availability before M6 begins.

**Gate:** one reviewed contract used by server, UI, harness, and analytics.

### M1 — Identity and transactional persistence (4–6 days)

- Add invites and stable student identity.
- Introduce storage adapter.
- Migrate from `sql.js` to transactional persistence.
- Persist evidence, attempts, diagnoses, sessions, events, and state snapshots.
- Add backup and recovery procedure.

**Gate:** restart/reconnect does not lose or duplicate a student's state.

### M2 — Unified learner state (5–7 days)

- Make `UnifiedTutorStudentState` canonical.
- Write migration adapter from local legacy state.
- Route diagnosis evidence through guarded server updates.
- Reconcile review schedules and mistake patterns.
- Remove client-authored belief deltas.

**Gate:** the same evidence sequence produces the same state before and after
server restart.

### M3 — Unified orchestration API (7–10 days)

- Add session start/next/end.
- Connect diagnosis to the Graph Tutor policy.
- Use full question ranking for `present_question`.
- Keep error probes, teaching tools, and review as alternative policy actions.
- Add idempotency keys and duplicate-turn protection.
- Replace generic fallback turns with honest retry/recovery UI.

**Gate:** all synthetic personas complete 30-turn sessions without state
corruption, duplicated questions, answer leakage, or silent degraded coaching.

### M4 — Merge intelligence into Solve (6–8 days)

- Keep Solve's staged question/capture/live presentation.
- Replace local thread authority with server session state.
- Render every Graph Tutor item type in the Solve thread.
- Integrate chapter calibration into first entry and chapter changes.
- Remove the floating Graph Tutor beta and retire `TutorSession.tsx`.
- Preserve structured chips plus unrestricted text.

**Gate:** there is only one student-facing solve experience and one learner ID.

### M5 — Full content `production_v2` (parallel, 1–2 weeks)

- Promote heuristic slots to canonical finalized records, then process all
  repository-available records.
- Rebuild and validate the graph.
- Generate coverage and review reports.
- Add typed diagram metadata/assets, question rendering, and diagram forwarding
  into diagnosis.
- Add the centralized pilot-eligibility filter used by every picker/fallback.
- Sync through the app graph adapter.
- Stress question rotation by chapter and cohort.

**Gate:** every auto-selectable item passes content gates and no session exhausts
a chapter without an intentional cross-chapter or generated-item transition.

### M6 — Photo evaluation and repair (parallel, 2–3 weeks)

- Add ordered multi-page capture and upload first.
- Build the photo evaluation harness.
- Collect and annotate the development/blind sets.
- Iterate prompt, validator, and clarification behavior.
- Run blind gate and freeze the passing prompt/model pair.

**Gate:** all metrics in §6.2 pass.

### M7 — Product hardening (5–7 days)

- Structured event logging and latency/error dashboards.
- Admin view for invites, active sessions, failed diagnoses, fallbacks,
  content-review flags, and photo-eval sampling.
- Rate limits, payload limits, MIME checks, timeout/retry policy.
- Privacy consent and retention controls.
- Deployment, health checks, backup restore drill, and rollback.

**Gate:** a forced upstream failure, server restart, and bad upload each recover
without corrupting learner state.

### M8 — Private pilot (8 weeks)

- 24–36 students: balanced across 11th, 12th, and droppers.
- All repository-available, pilot-eligible PCM content available.
- Suggested use: 3–5 sessions per week.
- Weekly equivalent-form holdout checks.
- Weekly review of diagnosis disagreements and conversation failures.
- No prompt/model changes mid-week; version changes are cohort-stamped.
- Maker reviews all severe trust failures and a random sample of normal sessions.

**Gate:** complete the pilot with attributable learning and trust measurements,
not merely engagement data.

## 8. Pilot measurement

### 8.1 Primary metric

**Difference in JEE holdout marks gained per active hour in AdvancedLearning.**

Measure:

1. baseline subject/chapter holdout before meaningful exposure;
2. equivalent, unseen holdout items weekly;
3. active learning time excluding idle/background time;
4. marks delta divided by cumulative active hours;
5. external coaching/self-study exposure;
6. results segmented by cohort, subject, starting level, and intervention type.

Questions used for learning never appear in holdout measurement.

Use a randomized delayed-start stepped-wedge inside each cohort: one group starts
immediately, the other starts after a short baseline period, then everyone
receives the product. Estimate difference-in-differences during the staggered
window. Without this comparison, report only **observed** holdout gain per
app-active hour, not attributable improvement.

### 8.2 Learning-loop metrics

- first-attempt to usable evidence rate;
- first causal-break agreement on reviewed samples;
- transfer success on unseen related questions;
- belief prediction calibration against future independent attempts;
- recovery after a diagnosed gap;
- repeat-error rate for tracked mistake patterns;
- review retention after 1, 3, 7, and 21 days;
- proportion of sessions staying inside the target stretch band.

### 8.3 Product and trust metrics

- question-open to engagement rate;
- photo-submit completion rate;
- clarification rate and successful clarification rate;
- next-action acceptance;
- abandonment by screen/turn;
- D1, D7, and D28 return;
- explicit “coach misunderstood me” reports;
- false praise, false correction, answer leakage, repeated-question, and degraded
  fallback incidents;
- median and p95 response latency.

## 9. Harness and review strategy

Use three layers:

1. **Unit/contract tests**
   - state updates, belief derivation, review scheduling, candidate generation,
     identity, migrations, duplicate guards, and idempotency.
2. **Synthetic conversations**
   - long sessions across smart, weak, average-English, Hinglish, anxious,
     formula-only, fake-confident, vague-but-strong, slow-learning, and transfer
     personas.
3. **Human-reviewed real evidence**
   - handwritten photo set and sampled pilot conversations.

Automated rules are release gates for mechanical failures. They do not replace
manual inspection of whether the tutor was genuinely useful.

Every production issue becomes:

- a minimal saved fixture;
- a named automated rule when mechanically testable;
- a prompt/validator/state fix;
- a rerun against the full regression set;
- a documented before/after example.

## 10. Explicit deferrals

These do not block the private pilot:

- public signup and OAuth;
- payments;
- multi-device synchronization;
- parent/teacher dashboards;
- leaderboards;
- voice input;
- generic PDF/doubt solving;
- elaborate sky-map visualization;
- social features;
- LLM reranking after deterministic top-N selection;
- model experimentation unrelated to a measured failure.

The functional chapter map, warm-up, recap, honest counters, and lightweight
student progress view remain in scope because they support the learning loop.

## 11. Immediate execution order

Start now in this order:

1. Freeze the unified API and canonical state contracts.
2. Add invite identity and transactional storage.
3. Wire diagnosis evidence into the unified state.
4. Put Graph Tutor policy behind the Solve flow.
5. Start full-corpus `production_v2` processing in parallel.
6. Start real handwriting collection and annotation in parallel.
7. Retire duplicate tutor paths once migration tests pass.
8. Pass content, photo, harness, persistence, and recovery gates.
9. Open the eight-week private pilot.

No new standalone prototype should be built. Every next change must strengthen
the one loop:

**choose → attempt → understand → teach → verify → update → choose again.**
