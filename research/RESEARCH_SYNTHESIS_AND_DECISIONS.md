# AdvancedLearning — Research Synthesis and Binding Decisions

Date: 18 July 2026

This memo is the decision layer between research and implementation.
It incorporates five full-text evidence reviews:

- `evidence/adaptive-learning/`
- `evidence/handwriting-diagnosis/`
- `evidence/JEE-learner-UX/`
- `evidence/pilot-measurement/`
- `evidence/minor-privacy-safety/`

The maker's product assumptions remain accepted. Research is used to choose safe,
testable implementation details—not to reopen the product thesis.

## 1. Product policy

### 1.1 The 80/20 principle

- Keep 80/20 as the initial internal policy prior.
- Do not show a precise percentage to students or market it as a universal law.
- Interpret it as predicted success at a specified assistance level, not an
  unweighted count of prerequisite nodes.
- Learn separate stretch bands for independent questions, one-hint questions,
  splices, worked-example transitions, and review.
- A diagnostic probe, due review, or scaffolded item may intentionally sit outside
  the nominal band.

### 1.2 Picker hierarchy

Use a hierarchy rather than one compensating weighted score:

1. content and evidence eligibility;
2. critical-prerequisite gate;
3. objective for this turn;
4. candidate ranking within the objective.

Classify prerequisite edges as:

- `critical`
- `supporting`
- `optional`
- `alternative_method`

Only expert-reviewed, maker-approved, or empirically validated edges may hard-block
an item. LLM/co-occurrence-only edges remain soft signals.

False advancement is costlier than extra practice:

- critical high-centrality prerequisite: 4:1;
- normal prerequisite: 2:1;
- isolated recall fact: 1:1.

These ratios initialize policy thresholds and are recalibrated from delayed
independent attempts.

### 1.3 Assistance and learner agency

- Orientation is available immediately; help does not require a polished attempt.
- Evidence is required before the system judges correctness or changes mastery.
- Hints are learner-requested by default.
- Automatic escalation is allowed only after an explicit stuck signal, two failed
  attempts at the same causal step, or an opted-in inactivity check.
- Use the acquisition path:
  `worked example → faded splice → independent near transfer → delayed mixed transfer`.
- Do not infer mastery from reading, explanation consumption, or supported success.

### 1.4 Reviews and interleaving

- Reviews receive 20% of a normal session by default and never more than 30%
  without explicit learner choice.
- Reviews use due windows, not guilt-producing overdue debt.
- Students can defer review without penalty.
- Interleave to discriminate between confusable methods, not on a fixed cadence.
- Class 11 defaults emphasize orientation and critical foundations.
- Class 12 defaults protect current work while repairing only blocking backlog.
- Dropper defaults emphasize error-led mixed practice and exam integration.
- All cohorts use one experience and may override defaults.

## 2. Handwriting diagnosis policy

### 2.1 Diagnosis is a staged evidence pipeline

Treat these as separate, versioned stages:

`capture → page order → verbatim transcription → math normalization → step graph
→ evidence alignment → first causal error → pedagogical response → state eligibility`

Every material claim cites page, region, and step. Store:

- observed visual evidence;
- inferred diagnosis;
- persistent learner-state claim;

as separate records.

### 2.2 Action-specific risk budgets

Targets are evaluated with confidence intervals on frozen blind sets:

- insufficient evidence incorrectly accepted as readable: below 5%;
- false praise of materially wrong work: below 1%;
- false correction of correct work: below 2%;
- wrong first-causal-error localization among accepted definitive diagnoses:
  below 10%;
- unsupported persistent learner-state update: below 0.5%;
- answer leakage on an active problem: zero.

The evaluation set may increase beyond the earlier 180 attempts. Use:

- at least 100 development/stress bundles;
- at least 300 independently adjudicated blind accepted/abstention bundles;
- writer-disjoint and question-family-disjoint splits;
- explicit English and Roman-Hinglish quotas;
- subject, cohort, page-count, image-quality, alternate-method, and error-family slices.

### 2.3 Coverage and abstention

- At least 70% of sufficient natural attempts should receive a definitive,
  evidence-linked diagnosis.
- At least 90% should receive a useful next action, including precise recapture or
  clarification.
- Low evidence requests the smallest corrective capture.
- Moderate evidence may produce tentative, non-state-changing feedback.
- Definitive diagnosis requires calibrated evidence and an independent verifier.
- Persistent state change has the strictest gate.

Never convert unreadability, a missing page, absent work, or OCR failure into
student-failure evidence.

### 2.4 Learner-state updates

One photo may add a reversible observation or `needs_confirmation` hypothesis.
It may not independently establish mastery or a persistent misconception.

Promotion requires:

- a successful targeted confirmation probe; or
- repeated independent evidence from a later item.

Severe misconception claims remain provisional until asynchronous human review.
Correct later work adds counterevidence and can reverse prior state.

### 2.5 Human review

Review:

- every dispute;
- every severe misconception candidate;
- every model/verifier disagreement;
- every out-of-distribution or safeguarding case;
- every severe trust failure;
- a random 20% of accepted definitive diagnoses during the pilot.

Academic review target: within 24 hours. Safeguarding escalation: immediate.
Review must not block a safe tentative tutor response.

Use only internally consented or clearly commercially permissible data for release
evaluation. Research-only datasets with incompatible/unclear licenses may inform
design but may not become runtime benchmarks or training data.

## 3. JEE learner experience

### 3.1 Canonical interaction

- One mixed product with cohort-aware defaults.
- The question remains the dominant object.
- Photo is the primary path; paper remains the workspace.
- After capture, show the recognized question/work and allow correction before a
  consequential diagnosis.
- Keep distinct **Orient me** and **I'm stuck** actions and permit switching.
- Preserve unrestricted text beside structured shortcuts.
- Sessions are interruptible and resumable after network loss or app closure.
- A short rescue session counts as successful use.

### 3.2 Language

- Ask preferred language during onboarding: English or Roman Hinglish.
- Allow change at any time.
- Mirror lightly; keep technical terms and mathematical notation precise.
- No forced slang, fake friendship, teacher cosplay, or caricatured Hinglish.

### 3.3 Parent and learner privacy

- Learner activity is private by default.
- Parents see consent/account status and a bounded progress summary.
- Parents do not receive full transcripts.
- Safety-triggered excerpts require the safeguarding protocol.
- No school/coaching sharing without a new explicit consent and review.

### 3.4 Notifications and progress

- Notifications are fully opt-in by purpose and time window.
- No late-night default, streak loss, competitor copy, rank countdown, or red
  backlog debt.
- One parked-question reminder is permitted only when explicitly enabled.
- Primary progress surfaces:
  - independently completed questions;
  - questions successfully rescued;
  - repeated-error categories declining;
  - delayed review retention;
  - past-self trends.
- Do not show hidden probabilities, fabricated rank, or watched-content mastery.
- Monetization is out of scope for the pilot; there is no paywall after upload.

## 4. Pilot measurement

### 4.1 Design

- 24–36 students.
- Individually randomized, stratified delayed start.
- Early arm: weeks 1–8.
- Delayed arm: ordinary study in weeks 1–3, product in weeks 4–8.
- Stratify by Class 11, Class 12, and dropper; block on baseline score.
- Randomize connected household/study pairs together only when contamination risk
  clearly outweighs the loss of independent units.

### 4.2 Outcomes

Primary causal outcome:

- week-3 baseline-adjusted intention-to-treat difference in independent linked
  holdout points.

Operational north star:

- observed linked holdout gain per valid product-active hour;
- explicitly descriptive, not causal.

Use “linked holdout points” unless externally calibrated item parameters justify
a JEE-equivalent score.

Assessment:

- 30-item baseline and endline;
- 15 fresh items weekly;
- common blueprint, anchor/linking plan, counterbalanced forms;
- a short second baseline where burden permits;
- no holdout item appears in tutoring.

### 4.3 Active time

- visible foreground heartbeat every 15 seconds;
- 5-minute interval cap;
- stop after hidden/blurred for more than 30 seconds;
- sensitivity analyses at 2 and 10 minutes;
- exclude consent, onboarding, support, administration, and holdout tests;
- never treat missing telemetry as zero use.

### 4.4 Pilot claims and gates

Call this a randomized feasibility pilot, not an efficacy trial.

Progression gates:

- at least 24 randomized;
- week-3 retention at least 85%;
- holdout completion at least 90%;
- valid telemetry at least 90%;
- confirmed delayed-arm contamination below 10%;
- no unresolved serious privacy/safety incident;
- acceptable assessment linking and reliability.

Use independent or blinded analysis labels until analysis code and exclusions are
frozen where feasible. Compensate assessment completion, never usage or score gain.

## 5. Privacy, minors, and safety

These are launch blockers even where future DPDP child provisions have not yet
commenced. This is an engineering policy, not legal advice.

### 5.1 Admission

Minors may join only after:

- verifiable parent/lawful-guardian permission;
- age-appropriate student assent;
- the student may dissent despite parent permission;
- independent ethics approval or written competent determination;
- Indian counsel confirms the operator, SPDI, CERT-In, intermediary, cross-border,
  and safeguarding position.

The code supports the flow, but the human operator must supply the legal entity,
verification provider/method, counsel, ethics body, and trained safeguarding roles.

### 5.2 Data separation

Separate stores and access roles for:

- identity/consent;
- learning state;
- conversations;
- transient photos;
- optional evaluation photos;
- content-free security logs;
- coded research extracts.

Do not collect full DOB, school name, address, Aadhaar, government-ID copies,
precise location, contacts, caste, religion, income, face/voice/handwriting
biometrics, or emotion/mental-health inference.

### 5.3 Retention

- operational raw photos, thumbnails, OCR buffers, and provider copies:
  delete within 24 hours, target minutes;
- separately consented evaluation photos:
  delete 90 days after final locked evaluation;
- tutor transcripts:
  rolling 90 days;
- structured learner state:
  pilot plus 90 days;
- identity/recovery:
  pilot plus 30 days;
- consent/assent/protocol/withdrawal receipts:
  three years, subject to counsel/ethics decision;
- content-free security/access logs:
  365 days, with required rolling Indian storage;
- encrypted backups:
  30-day expiry.

### 5.4 Provider and access controls

- Zero-data-retention or contractually equivalent handling is mandatory for child
  images.
- If unavailable, keep vision local and send only minimized redacted text.
- No provider training on pilot content.
- Staff MFA and least privilege are mandatory.
- Engineers do not browse production content.
- Raw-content access is just-in-time, reason-coded, expiring, and audited.
- Implement export, correction, withdrawal, deletion, session revocation, and
  parent recovery before recruitment.

### 5.5 Safeguarding and incidents

- Exclude generated audio/visual content from the pilot.
- Label AI responses and expose a first-class **This looks wrong** action.
- No advertising, trackers, data sale, behavioral marketing, biometric
  identification, emotion inference, high-stakes grading, or transcript
  surveillance.
- Name incident, privacy, vendor, CERT-In, and safeguarding leads.
- Maintain the six-hour CERT-In runbook and Indian log requirement.
- Complete leaked-photo and compromised-admin tabletop exercises.
- A trained human—not the model—owns self-harm, abuse, POCSO, and imminent-danger
  decisions.

## 6. Architecture consequences

Implementation must provide:

1. hierarchical picker with critical-edge gating;
2. evidence provenance and reversible learner-state events;
3. ordered multi-page capture with readback/correction;
4. separate diagnosis, verifier, policy, and state-eligibility stages;
5. action-specific calibration and risk–coverage evaluation;
6. invite, session-token, parent consent, child assent, and age-transition flows;
7. purpose-separated storage and automated retention jobs;
8. event-derived active-time telemetry;
9. admin review queues without unrestricted transcript browsing;
10. versioned model/prompt/rubric/parser/policy manifests;
11. content eligibility and diagram completeness gates;
12. offline-first draft/resume behavior;
13. a randomized delayed-start pilot module and independent holdout bank boundary.

## 7. Human decisions that remain external blockers

This memo fixes all software/product policy needed for implementation.
These real-world facts cannot be invented in code:

- named Indian operator/legal entity;
- Indian counsel and applicability memo;
- parent-verification provider/method;
- model-provider ZDR/DPA confirmation;
- independent ethics body/determination;
- trained academic reviewers and safeguarding personnel;
- holdout item-calibration source;
- pilot recruitment and compensation amount.

Implement these as explicit configuration and launch-checklist gates. Do not hide
missing human inputs behind development defaults.
