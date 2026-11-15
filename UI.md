# UI vision — AdvancedLearning

A working document for how the product looks and feels. Companion to [PLAN.md](PLAN.md).
Tone: same as PLAN.md — crisp, decision-oriented. Updated as we build.

A live prototype of this vision lives in [`app/`](app/) — run `npm run dev` from there.

---

## 1. Guiding metaphor

A **notebook page with a quiet tutor in the margin.**

Each line of the student's work is a step. The coach underlines the broken step and writes a small note next to it — the way a good teacher would mark up homework.

Three lines in PLAN.md force this shape:

- §4.4 — step-level diagnosis is the differentiator. So the UI must be built around steps, not chats or quizzes.
- §14 — "one main view: a question, a place to write, the agent's response."
- §12 — "spatial progress lands harder than numeric." So the map is a real screen.

Everything else falls out of these.

---

## 2. Five surfaces, no more

The whole product is five screens. If we're tempted to add a sixth, we should fight it.

- **Working Canvas** (~85% of session time) — solve a problem step-by-step with coach feedback.
- **Daily Warm-up** (~5%) — five Anki cards, two minutes, guaranteed quick win (PLAN §11.2).
- **Onboarding** (one-time) — 5–8 questions that *feel like learning*, not a survey (PLAN §10).
- **Concept Map** (~5%) — spatial progress, two views.
- **Session Recap** (~5%) — sixty-second close-out after each session.

No history tab, no settings tab, no chat tab.

---

## 3. The Working Canvas (the heart)

This is where almost all the time is spent. It is intentionally a single, calm screen.

### Anatomy (top to bottom)

- **Mode tag** (top-left, pill) — `Building base` / `Polishing` / `Diagnosing`. Tiny but always present. Tells the student *why* this question was picked. This is the honesty that prevents "why am I getting easy questions?" frustration.
- **Session timeline** — small dot strip showing problems done in this session. Current is a larger violet dot.
- **Honest counters** (top-right, subtle) — streak, problems solved, concepts mastered this week, link to map. Always present, never a tab.
- **Question** — JEE source label in small caps, then the question itself rendered in large serif with proper KaTeX math.
- **Prereq strip** — five small dots (one per prereq concept), color = belief. "5 of 5 prereqs in hand" or "3 of 5 in hand · 2 new" sentence beside it. Honest signal of how stretched this question is.
- **Working area** (notebook) — numbered steps, each on its own line, written in serif. Student can write prose mixed with inline LaTeX (`differentiating gives \(2x\sin(2x)\)`). Each step has a left-border colored by diagnosis status.
- **Action row** — `Submit working`, `Hint`, `Show me`, with keyboard hints next to each.
- **Coach rail** (right, desktop) — diagnostic notes anchored to specific steps, plus the active coach message.

### Diagnosis as visual language

Hard rule: no red X. Failure is reframed (PLAN §12).

- **Correct step** → soft-green left border (`leaf-500`). Coach note: "Good — using the chain rule."
- **Ambiguous step** → warm amber border. Coach note: "Looks like the chain rule, but I'm not fully sure. Tighten the working?"
- **Broken step** → coach-violet border. Coach note (margin): "You wrote d/dx sin(2x) = cos(2x), but you're missing the chain-rule factor. The inner function 2x has derivative 2."

The coach speaks in margin notes anchored to specific steps. **No chat thread. No bubbles.**

### Submit

`Submit working` (`Cmd/Ctrl + Enter`) runs full diagnosis and:

- If complete (≥80% of canonical steps matched correctly) → smooth fade to a "Solved." overlay showing the canonical answer in large serif, then transitions to **Session Recap**.
- Otherwise → coach surfaces the specific gap as a margin note, no shame.

### Coach is invoked, not pushy

- `Tab` → smallest-possible hint at the next gap.
- `Shift + Tab` → worked example for that specific sub-step (modal).
- `Esc` → dismiss coach.
- The coach never appears uninvited mid-step except for the diagnosis underline at submit.

---

## 4. Coach voice and presence

Three rules:

1. **No avatar face.** Cute, breaks the calm. Coach has a single accent colour (ink-violet `#6B4FA0`) and a sparkle glyph at most.
2. **Margin, status line, popovers — never a chat thread.**
3. **Tone matches PLAN §12:** "Found a gap: chain rule when both factors are functions of x. Want to nail it?" Then offers a Splice (PLAN §5.2). Warm, honest, never fake-praising.

---

## 5. Concept Map — two views

PLAN §12 calls for a "visible map filling up with colour." One view is not enough — students need both an emotional view and a functional view.

### Sky view (emotional, opened weekly)

- Concepts as stars over a dark navy canvas.
- Mastered → glow steadily. Current focus area → twinkles. Untouched → dim.
- Chapters cluster naturally as constellations, with faint chapter labels.
- Concepts of the same chapter linked by faint constellation lines whose opacity tracks belief.
- This is the screenshot students share.

### Chapter strip (functional, every session)

- Horizontal bands per chapter. Each is a row of small dots.
- Dot fill = belief (green / amber / faded). Dot size = concept centrality (proxy for downstream-unlock weight from PLAN §6.1).
- "4/12" mastery count on the right of each row.
- Hover/tap for concept name + last belief.
- Scannable in five seconds; lives at the bottom of recap and on the map screen.

Why two: the sky view is the campaign poster, the chapter strip is the working dashboard.

---

## 6. Daily Warm-up

Single full-screen card, Anki style. Don't reinvent — Anki nailed this.

- 5 cards, ~2 minutes.
- Top-left: streak + card index. Top-right: skip.
- `Space` → reveal answer. `1` / `2` / `3` (or `H` / `G` / `E`) → grade hard / good / easy.
- Cards come from (in order): review-due (SM-2 layer), recent stumbles, one easy freebie (PLAN §11.2).
- At the end: smooth transition into the Working Canvas with the day's first question. No celebration screen — the Canvas is the reward.

---

## 7. Onboarding (PLAN §10)

Critical: **does not look like a form or a quiz.**

1. Single screen: chip multi-select of chapters covered. One sentence: "Let's start where you've already worked." Submit.
2. Lands directly in the Working Canvas with question 1 of the diagnostic 5–8.
3. **No "Question 1 of 8" progress bar.** That breaks the "useful from minute one" promise.
4. Coach is warmer than usual. Normal hints are available.
5. After question 8, soft transition: "Got a read on you. Here's where I'd start." → opens the map briefly with current beliefs sketched in → first real session begins.

---

## 8. Session Recap

After every session (60 seconds, skippable):

- "Nice work — N minutes well spent."
- Bullet 1: "Closed N gaps." with the actual concept names.
- Bullet 2: "Confirmed N concepts. That base is now load-bearing."
- Bullet 3: past-self comparison ("24% faster than past you on similar problems.") — PLAN §12.
- A small forward hook ("Tomorrow we'll start hitting integration by parts — your derivative chain is solid enough.")
- Two buttons: `Next problem` (primary), `See map`.

No score, no rank, no "you scored 8/10". Bullets animate in one by one.

---

## 9. Math input — the technical UX hinge

This is the make-or-break piece.

- **Desktop:** inline LaTeX with live render (KaTeX in v0, MathLive in v1). Power users type fast. Beginners can use a small floating math palette toggled with `\`.
- **Phone:** custom slide-up math keyboard, tabbed `Numbers · Algebra · Calculus · Trig · Sets · Matrix`. Long-press for variants.
- **Both:** prose and math can mix on a single step line — that's how a real notebook works.

Voice (v2) and handwriting vision (v3) per PLAN §13 are explicitly deferred.

---

## 10. Visual tone

- **Background:** off-white in light (`#FAF7F0`), deep navy in dark (`#0F172A`). Never pure white/black — calm, not clinical.
- **Whitespace:** generous. Math is the hero, give it room.
- **Palette:** soft leaf-green for progress, warm amber for gap, ink-violet for coach. **No harsh red anywhere.**
- **Typography:** Newsreader serif for question text and student work (textbook feel), Inter for UI chrome, Latin Modern Math via KaTeX.
- **Animation:** purposeful only. Three places allowed: (1) concept dot lighting on the chapter strip after a session, (2) gentle underline appearing on a diagnosed step, (3) smooth page transitions warm-up → canvas → recap. Everything else static.

---

## 11. Keyboard map (desktop)

| Key | Action |
|---|---|
| `Enter` | New step |
| `Cmd/Ctrl + Enter` | Submit working for diagnosis |
| `Tab` | Smallest possible hint |
| `Shift + Tab` | Worked example for current sub-step |
| `Esc` | Dismiss coach |
| `↑ / ↓` | Navigate between past steps |
| `Cmd/Ctrl + K` | Toggle map |
| `\` | Enter inline-math input mode |
| `Space` | (Warm-up) reveal card |
| `1 / 2 / 3` | (Warm-up) grade hard / good / easy |

---

## 12. Phone gestures (mirror of keyboard)

- Tap-and-hold on a step → coach popover with diagnosis detail.
- Swipe right on a step → request hint (= `Tab`).
- Swipe left → dismiss coach (= `Esc`).
- Long-press the mode tag → "why this question?" — coach explains in one sentence.
- Bottom-tab nav: `Today · Map · You`. Three tabs ever.

---

## 13. What we deliberately do NOT show

- Leaderboards, percentiles vs others (PLAN §12).
- JEE rank predictions (PLAN §15 Out).
- A red X or "Wrong!" — failure is reframed (PLAN §12).
- Chat-style assistant UI.
- Progress bar during onboarding.
- A general settings page in v1 (one settings row in `You`, that's it).
- A separate "history" tab — chapter strip + session timeline already cover it.

---

## 14. Build implications worth flagging

- **Step-level diagnosis must return per-step structured output** (status + bound concept + 1-line note + hint + worked-example hook) — not a markdown blob — for the margin notes to work cleanly. The prototype's `lib/diagnose.ts` shows the contract.
- **Concept centrality** (`downstream_unlock` from PLAN §6.1) must be precomputed so the chapter strip can size dots without runtime work.
- **MathLive** is the safest live-render dependency for v1; budget time to build a custom phone math keyboard on top of it.
- **Common-error patterns per canonical step** turn out to matter a lot for the diagnosis quality. The prototype shows one example: catching "d/dx sin(2x) = cos(2x)" (missing chain-rule factor) and naming the gap precisely.

---

## 15. Open UX questions

- How does the canvas handle a student who **scratches and restarts**? (Current prototype keeps every step in the trace; production may want a softer "reconsidering" affordance.)
- How does the coach surface multiple alternative methods (PLAN §9) without cluttering the rail?
- How do we visualise **path the student took** in the chapter strip recap, vs the canonical path?
- What does the "why this question?" popover say when the picker chose an unusual question? Two sentences max.

---

## 16. The prototype

A working prototype implements every surface in this document. See [`app/`](app/). Mock data: a single derivative problem (`y = x²·sin(2x)` at `x = π/4`), 50-concept ontology slice, 5 warm-up cards, beliefs derived from chosen chapters with realistic noise. The diagnosis engine is heuristic-only (token matching with common-error patterns), but demonstrates the per-step structured output contract.
