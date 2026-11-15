# Changelog

All notable changes to the AdvancedLearning application will be documented in this file.

## [0.1.0] - 2026-11-15 — MVP

### Added
- **Original sample content** (`app/src/data/sampleGraph.ts`): 19 questions across 9 physics, chemistry and maths chapters, plus 30 concepts with prerequisite edges. Every question was written for this repository; no exam content ships.
- **Offline step-level diagnoser** (`app/src/services/offlineDiagnosis.ts`): finds the first causal break in typed working and classifies it as a concept gap, a misunderstanding, a procedure error or a slip, without any LLM key. Includes a quick-check generator and no-leak tests.
- Graph loading fallback: `AL_GRAPH_PATH`, then the local `public/data/graph.json`, then the bundled sample (`AL_GRAPH_PATH=sample` / `VITE_GRAPH=sample` force the sample).
- Root README, `.env.example` and a `.gitignore` that keeps exam papers, transcripts, graph runs and runtime data out of git.

### Changed
- The offline coach follow-up reuses the diagnosis cards instead of the canned optics text.

## [Unreleased] - 2026-04-30

### Changed
- **Pedagogy & Coach AI**
  - **Blind Guesser Handling**: Completely blocked the coach from confirming if a guess is right/wrong if no substantive reasoning is provided. Forces the student to explain their thought process first (`diagnoseAttempt.ts`).
  - **Prerequisite Escalation Strictness**: If a student is fundamentally stuck (>= 2 times admitting they don't know a basic concept), the coach will now strictly stop teaching, suggest `see_fix`, and is explicitly banned from asking another follow-up math question in the same breath (`coachFollowup.ts`).
  - **Answer Leakage**: Re-hardened prompts to ensure the LLM never accidentally names the option letter or numerical answer, even when praising a correct step.
  - **MistakeType Consistency**: The validator now ensures `mistakeType` aligns perfectly with `verdict`. If `verdict='correct'` and there's no actual slip, it prevents `mistakeType='silly_mistake'` from leaking into the UI.
  - **Contradiction Guard**: Added rules to force the coach to openly own up to contradictions (e.g. if it previously said the sign was wrong, but now realizes it was correct).
  - **Redundant Quick-Checks**: Quick checks can no longer merely parrot the sentence immediately preceding them.

### Added
- **Automated Testing**
  - Built `coachHarness.ts` to simulate diverse JEE student personas (e.g., `avg-11th-english`, `weak-12th-hinglish`, `mcq-guesser`) and interact with the coach APIs to generate conversational transcripts for offline analysis.

### Fixed
- **KaTeX Rendering**: Improved the `Math.tsx` component to handle mixed prose and bare LaTeX commands emitted by the LLM by intelligently auto-wrapping unclosed math tokens.
- **Hinglish/English Mixing**: Strengthened language mirroring rules to prevent the coach from unexpectedly switching to Hinglish when the student inputs pure English.
