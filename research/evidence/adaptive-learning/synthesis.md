# Adaptive sequencing evidence for AdvancedLearning

Research completed 2026-07-18. This is a research artifact only; no product code was changed.

## Executive answer

The evidence supports an adaptive tutor that (1) estimates knowledge with uncertainty, (2) respects prerequisite structure, (3) chooses between diagnosis, instruction, supported practice, independent retrieval, and transfer, and (4) adapts assistance to prior knowledge and recent performance. It does **not** validate a universal numerical “80% known / 20% new” optimum.

For AdvancedLearning, the 80/20 rule is best treated as an initial policy prior and a pilot hypothesis, not a hard scientific law. The next-question policy should optimize expected **durable, transferable learning per unit of student effort**, subject to hard safety gates for critical prerequisites, evidence quality, excessive load, content validity, and repetition. The next-intervention policy should respond to the first causal break in the learner’s work and vary assistance on a continuum from worked example to completion/splice to independent problem.

The strongest directly relevant quantitative findings are:

- Rigorous U.S. K–12 intelligent tutoring studies show a positive but modest overall effect, `g = 0.271`; effects were smaller at end-of-year measurement (`g = 0.155`) than immediately after intervention (`g = 0.460`). This argues against assuming large, durable gains from “adaptivity” alone. [P10, PDF pp. 2, 20, 28–31, 34–42]
- Mastery-learning programs averaged `d = 0.52`, but effects were heterogeneous, larger on local than standardized tests, and self-paced programs slightly reduced completion. Mastery is a package of corrective feedback, additional opportunities, and progression rules—not merely a threshold. [P4, PDF pp. 8, 14–18, 22–29]
- Spaced retrieval beat massed retrieval after publication-bias correction, `g = 0.74`, but expanding schedules did not beat uniform schedules, `g = 0.034`, 95% CI `[-0.10, 0.17]`. [P5, PDF pp. 16, 18, 20–24]
- Interleaving had a moderate overall effect, `g = 0.42`, and a smaller mathematics effect, `g = 0.34`; it was most useful when categories were confusable and least reliable for text/word material. [P2, PDF pp. 2, 24–39, 54–57]
- Worked examples improved mathematics performance, `g = 0.48`, 95% CI `[0.36, 0.60]`, but heterogeneity was very high (`I² = 93.72%`). Correct examples outperformed conditions containing only/also incorrect examples in the moderator analysis; adding self-explanation prompts was not reliably beneficial in this synthesis. [P1, PDF pp. 1, 19, 21–28]
- Retrieval practice transferred beyond the practiced item by `d = 0.40`, but transfer depended on initial retrieval success, response congruency, and elaborated retrieval/feedback. Application/inference transfer was `d = 0.33`; the pooled problem-solving estimate was nonsignificant, `d = 0.29`, 95% CI `[-0.078, 0.65]`. [P7, PDF pp. 3–4, 46–76, 121–130]
- Computer/online scaffolding is generally beneficial, but the largest available estimate in the downloaded corpus (`g = 0.866`) is from higher education and is vulnerable to publication and generalizability limitations. The better-supported principle is contingent support followed by responsibility transfer, not any single hint format. [P3, PDF pp. 3, 9–15]

## What should govern the next-question policy

### 1. Use a hierarchy, not one weighted score

The policy should decide in this order:

1. **Eligibility and safety**
   - Content is verified, solvable, diagram-complete, and not recently duplicated.
   - No *critical* prerequisite has strong evidence of absence.
   - Estimated working-memory demand is compatible with current fatigue and support level.
2. **Learning objective for this turn**
   - Due retrieval for retention.
   - Diagnostic probe to reduce consequential uncertainty.
   - Repair of a causal prerequisite or recurring error.
   - Initial acquisition with high assistance.
   - Discrimination/interleaving among confusable methods.
   - Independent application or transfer.
   - Exam integration under authentic JEE conditions.
3. **Candidate value within that objective**
   - Expected durable gain.
   - Information gain.
   - Downstream graph unlock.
   - Transfer distance and exam relevance.
   - Time/load cost.
   - Repetition, frustration, and abandonment risk.

This keeps a high-scoring but pedagogically unsafe question from winning because unrelated positive terms offset a missing critical prerequisite.

### 2. Replace average prerequisite readiness with critical-path readiness

The current picker averages prerequisite beliefs. An average can conceal one indispensable near-zero prerequisite. Graph eligibility should distinguish:

- `critical`: failure makes the item non-productive without support;
- `supporting`: weakness raises load but does not block;
- `optional/alternative-path`: required only for a specific solution method.

Use a conjunctive floor for critical prerequisites and a graded score for supporting ones. Prerequisite edges themselves need confidence and validation status; graph structure is useful only when the edge is real. Knowledge-tracing reviews explicitly warn that prediction accuracy does not establish effective instructional use, and graph/RL sequencing evidence is often simulator-based. [P6, PDF pp. 3–4, 7–18; P8, PDF pp. 1, 6–8]

### 3. Treat 80/20 as a tunable prior

No selected review identifies 70–90% prerequisite mastery, 80/20 novelty, or the current 55–98% candidate pool as an optimal causal range. “Zone of proximal development” supports responsive assistance conceptually, but does not translate into a fixed known-prerequisite percentage. Scaffolding research defines the operational mechanism as contingency and transfer of responsibility. [P3, PDF pp. 3–5, 13–15]

Recommended interpretation:

- Start with the current stretch band as a **pilot prior**.
- Define stretch using predicted probability of success **at a specified assistance level**, not count of mastered prereq nodes.
- Learn separate bands for:
  - unsupported full JEE questions;
  - one-hint questions;
  - splice/completion items;
  - worked examples followed by completion;
  - retrieval reviews.
- Evaluate by delayed independent performance and continuation, not immediate correctness alone.

The policy should be able to choose an item outside the nominal 80/20 band when it has high diagnostic value, is a scheduled retrieval, or can be made tractable with an appropriate scaffold.

### 4. Interleave for discrimination, not by cadence alone

Interleaving is most defensible when the learner must choose among similar-looking methods or categories. It is not a universal instruction to switch topic after every full question. For a genuinely new procedure, a short blocked acquisition phase with worked examples/completion can be preferable; then interleave nearby confusable categories once basic execution exists. [P1, PDF pp. 3–8, 23–28; P2, PDF pp. 9–15, 24–39, 54–57]

For JEE:

- Cluster items by **decision boundary**: e.g. substitution vs integration by parts; SN1 vs SN2; energy vs momentum.
- Interleave within a cluster when the learner can execute each method but may misclassify which applies.
- Track whether the learner selected the method before seeing a hint.
- Do not call a generic “micro-lesson after one full question” interleaving; that is task switching unless the content is deliberately contrastive.

### 5. Make spacing a budgeted queue

Spacing and retrieval are robust, but a due date is not an emergency. “Always place any due review first” can create an unbounded queue and turn a tutor into a guilt machine. The research supports spaced retrieval, not strict obedience to a specific scheduler or expanding intervals. [P5, PDF pp. 1–4, 16–24]

Recommended queue policy:

- Estimate retrievability/stability and use a **due window**, not a single timestamp.
- Reserve a bounded share of session time for reviews.
- Prioritize reviews by expected forgetting cost, prerequisite centrality, recent lapse, JEE value, and time cost.
- Mix short recall with current-goal work.
- Pause new review obligations when projected future load exceeds the learner’s budget.
- Treat failed review as evidence requiring diagnosis; do not automatically reset every concept to the same one-day interval.

### 6. Optimize for delayed transfer

Immediate success is insufficient. Retrieval transfer is strongest when initial retrieval succeeds, answers/processes overlap meaningfully, and practice is elaborated with explanations or broad retrieval. Far transfer and novel problem solving remain much less certain. [P7, PDF pp. 46–76, 121–130]

Every concept should therefore progress through distinct evidence stages:

1. recognition/recall;
2. execution on a familiar surface;
3. method selection among alternatives;
4. application on a changed surface;
5. delayed independent transfer.

Only stages 4–5 should strongly support `applicationFlexibility = transfers`.

## What should govern the next-intervention policy

### Diagnose before escalating assistance

The policy should first decide whether the miss is:

- an execution slip despite a sound plan;
- recall failure;
- method-selection/discrimination failure;
- missing prerequisite;
- misconception;
- overload/fatigue;
- ambiguous or low-confidence evidence.

The same wrong answer should not trigger the same intervention. A sign slip may need a local correction and one verification step; an absent schema may need a worked example and completion; a method-choice error needs a contrastive case.

### Match assistance to prior knowledge and fade on evidence

Recommended assistance ladder:

1. goal/orientation cue;
2. principle or method-selection hint;
3. next-step cue;
4. partially worked splice/completion;
5. full worked example;
6. micro-lesson for the missing concept.

Move downward only after evidence of struggle; move upward toward independence after success. Worked examples are particularly useful during early acquisition because they reduce unproductive means–ends search and cognitive load, but independent performance must follow. [P1, PDF pp. 3–8, 23–28]

The K–12 ITS meta-analysis found on-demand hints associated with reliable gains while just-in-time automatic hints were nonsignificant; this is moderator evidence, not a randomized comparison, but it supports preserving learner agency and avoiding interruptions that pre-empt productive thought. [P10, PDF pp. 24–27, 30, 36–38, 41–42]

### Use worked examples as transitions, not destinations

The best default for a novel JEE procedure is:

`worked example → faded completion/splice → independent near-transfer → delayed mixed transfer`

Do not infer mastery from reading or explaining an example. The worked-example meta-analysis measured later performance and found a medium average benefit, not proof that any example format works. [P1, PDF pp. 19–28]

### Make productive difficulty conditional

Difficulty is desirable only when it engages the target process without overwhelming prerequisites or working memory. Spacing, retrieval, and interleaving can improve retention while feeling harder during practice; therefore, low fluency or lower immediate accuracy is not automatically a reason to simplify. Conversely, repeated failure with no informative progress is not “productive struggle.”

Operationally, stop or change intervention when:

- two attempts fail at the same causal step;
- latency rises sharply without productive work;
- hints are consumed without subsequent independent success;
- the learner’s plan degrades from conceptual to guessing;
- frustration/avoidance signals rise;
- the diagnosis itself is low-confidence.

## Mastery and knowledge tracing

### Mastery is a decision under asymmetric error costs

BKT threshold selection trades premature advancement (false positive) against extra practice after learning (false negative). Simulations suggest 95% can be conservative under the modeled parameter sets, but do not establish 95% as universally optimal. Model mismatch and heterogeneous learners change the trade-off. [P9, PDF pp. 1–7]

For JEE, the costs differ by node:

- A high-centrality algebra prerequisite should tolerate fewer false positives.
- A low-stakes isolated fact can tolerate faster advancement and rely on later retrieval.
- Near an exam, time cost rises and the policy may rationally accept more uncertainty.

Do not map `belief >= 0.72` directly to mastery across all concepts. Calibrate thresholds by evidence type, centrality, and the product’s chosen false-positive/false-negative cost ratio.

### Prediction is not policy validation

Knowledge-tracing models estimate future responses. A model with better AUC can still produce worse sequencing if its mastery state is miscalibrated, opaque, or optimized for the wrong outcome. The review explicitly notes that evaluation usually focuses on response prediction and does not directly establish practical effectiveness. No single KT model is best in every context. [P6, PDF pp. 3–4, 9–18]

For the pilot, an interpretable evidence model with calibration checks is preferable to a more complex deep model unless the latter improves delayed decisions in an online or counterfactual evaluation.

## Recommended state and evidence fields

### Per concept

- `p_mastery` and `calibration_uncertainty`;
- `knowledge_state_version` and model provenance;
- `last_independent_success_at`;
- `last_supported_success_at`;
- `last_failure_at`;
- `evidence_count_by_support_level`;
- `recall_strength` / estimated retrievability;
- `stability` / forgetting-rate estimate;
- `method_selection_state`;
- `application_flexibility`;
- `transfer_level_reached`;
- `misconception_ids`;
- `lapse_count`;
- `time_to_success_distribution`;
- `mastery_for_now_until` rather than permanent mastery.

### Per prerequisite edge

- `from`, `to`;
- `edge_type`: critical, supporting, optional, alternative-method;
- `confidence`;
- `source`: expert, empirical order data, LLM proposal, co-occurrence;
- `review_status`;
- `violation_count`: successful target attempts despite weak prerequisite;
- `last_validated_at`;
- `solution_path_id`, because prerequisites may vary by method.

### Per item

- empirical difficulty and uncertainty, not only author label;
- discrimination/information estimate;
- concept roles: target vs prerequisite vs incidental;
- critical-step map;
- estimated time;
- cognitive-load vector: element interactivity, reading load, algebra load, diagram load;
- confusability cluster and competing methods;
- surface-form family / near-duplicate group;
- transfer distance from recent items;
- required support level;
- available hint ladder and worked-example/splice forms;
- source/review/diagram validity;
- exposure count and last exposure;
- answer format and response-congruency relation to prior retrieval.

### Per evidence event

- item and concept IDs;
- timestamp and spacing since prior exposure;
- response correctness plus partial-credit structure;
- first causal error;
- evidence source: independent attempt, hint, worked example, splice, recall, self-report;
- support level before response;
- hint timing: requested or automatic;
- number and type of hints;
- method selected before support;
- response latency and active time;
- confidence/self-report;
- diagnosis confidence and image legibility;
- transfer distance;
- whether feedback was seen;
- immediate retry outcome;
- delayed outcome link;
- policy/action IDs for replay and off-policy evaluation.

### Per session / policy context

- fatigue and frustration estimates with uncertainty;
- recent success/failure and assistance streaks;
- review time budget and projected backlog;
- current goal: chapter learning, mixed retrieval, weak-area repair, mock/exam;
- remaining time;
- learner preference for challenge, hints, and review;
- abandonment/skip signals;
- recent topic and confusability diversity;
- policy version, candidate set, scores, hard-gate reasons, chosen action, and rationale.

## Actionable design rules

1. Never average away a missing critical prerequisite.
2. Separate target concepts from prerequisites; a new target is allowed to be unmastered.
3. Use the 80/20 band as an experimentable prior, not a hard truth.
4. Define stretch as success probability conditional on assistance level.
5. Let due reviews compete inside a bounded review budget.
6. Prefer retrieval to rereading, but supply feedback when retrieval fails.
7. Do not assume expanding intervals are superior to uniform spacing.
8. Use worked examples for acquisition, then fade to completion and independent attempts.
9. Interleave confusable methods after minimal component competence exists.
10. Track method selection separately from execution.
11. Require delayed independent transfer before marking flexible mastery.
12. Use a local correction for slips; do not punish them with a full lesson.
13. Preserve on-demand help and learner exits; avoid automatic help that interrupts useful thought.
14. Cap repeated same-surface practice and vary the surface when probing recurrence.
15. Treat long latency, repeated hint consumption, and guessing as possible overload—not automatically low mastery.
16. Calibrate knowledge-state probabilities against future independent attempts.
17. Evaluate the policy on delayed JEE-like transfer, learning time, continuation, and equity—not only immediate accuracy.
18. Log every candidate set and decision so picker changes can be replayed and compared.

## Implications for the current 80/20 picker and graph rule layer

Research implications, not code changes:

- `stretchFit()` currently peaks at exactly 80% and reaches zero outside a fixed triangular window. Evidence does not justify that shape or center. Learn it from pilot outcomes by item type and assistance level.
- The candidate pool admits 55–98% averaged prerequisite readiness. Use critical-edge gating plus calibrated success probability instead.
- The graph rule layer’s tractability check combines `prereqIds` and `conceptIds`; that can reject a question because its *target* concept is untested. Target novelty should be permitted when prerequisites and support make it learnable.
- The rule layer picks the easiest tractable question by author difficulty. It should use empirical item difficulty, information, transfer, recency, load, and content validity.
- “Any due review first” should become a budgeted priority with due windows and backlog control.
- “One concept beat after one full question” is not evidence-based interleaving. Interleave deliberately for discrimination or retention.
- `belief >= 0.72` and coverage percentages should not independently trigger broad mastery/advancement; require independent and transfer evidence.
- SM-2-style intervals are a serviceable baseline, not validated policy superiority. Store enough evidence to replace them with calibrated forgetting estimates.

## Lived-experience patterns (anecdotal, not causal evidence)

These reports are useful for failure-mode discovery only.

- Students and parents repeatedly describe adaptive systems becoming repetitive and punitive after small errors, with unskippable re-instruction and no way to contest a bad placement. Public reporting on i-Ready also documents intentional wrong answers to make the adaptive test easier—a direct warning that behavior is not pure knowledge evidence. [A1–A3]
- Teachers object to “personalization” at a coarse domain level when students with different specific gaps receive the same sequence. They also report loss of instructional time and black-box sequencing they cannot inspect or override. [A1, A3]
- Student-facing mastery systems can make one miss feel like lost progress. Khan Academy’s own transcript recommends breaking course mastery into smaller checkpoints; public reviews complain about demotion and repetition after isolated mistakes. [A4–A6]
- Spaced-repetition users describe review backlogs as anxiety/shame and ask for ways to postpone thousands of due cards. The recurring practical lesson is to bound new-item intake and review load. [A7–A9]
- A teacher forum on mixed-ability pacing emphasizes daily attainable progress for slower learners while allowing extension for advanced students, rather than forcing one pace. [A10]

Product implication: include a shame-free “different question / not now” path, bounded review debt, transparent brief rationales, and teacher/admin inspectability. Do not infer low mastery from disengaged, rushed, or intentionally gamed responses without corroboration.

## Claims not supported by this evidence

- That 80% known / 20% new is an optimal universal ratio.
- That fewer than 50% known prerequisites is a validated ZPD cutoff.
- That ZPD can be operationalized by counting graph nodes alone.
- That a single scalar belief per concept is sufficient.
- That any due review should always override the learner’s current goal.
- That expanding spacing intervals are generally superior to uniform intervals.
- That interleaving every one or three full questions is optimal.
- That self-explanation prompts always improve worked examples.
- That more difficult-feeling practice is necessarily more effective.
- That immediate mastery predicts durable JEE transfer.
- That improved next-response prediction proves a better instructional policy.
- That simulator superiority of graph/RL sequencing demonstrates real-student learning gains.
- That retrieval practice reliably produces far transfer to novel multistep JEE problems without aligned retrieval and elaboration.
- That the large historical “two sigma” tutoring claim is a realistic expected effect for this product.

## Consequential product decisions for the product owner

1. **What is the cost ratio for premature advancement versus extra practice?** This determines mastery thresholds by concept centrality; the research cannot choose the product’s value judgment.
2. **Should 80/20 remain a visible product principle or become only an internal, learnable prior?** The evidence supports adaptivity but not that exact ratio.
3. **What is the review budget?** Decide a default maximum share of session time or item count that due reviews may consume, and whether students can defer them without penalty.
4. **How much learner control should automatic hints have?** Decide whether on-demand hints are default and when the tutor may interrupt with a just-in-time scaffold.
5. **What delayed outcome defines pilot success?** Choose among 1/7/21-day independent recall, unseen JEE transfer, expected marks, or a weighted combination.
6. **Which graph edges require human review before they can hard-block a question?** An unvalidated LLM edge should not become a hard pedagogical gate.
7. **Should time-to-exam change false-positive tolerance and spacing load?** This materially changes policy objectives for Class 11, Class 12, and droppers.

## Evidence quality and limits

The downloaded corpus contains 10 full-text papers/reviews, all reviewed end to end. It covers meta-analyses, a knowledge-tracing survey, BKT threshold simulations, and graph-sequencing experiments. Major limitations are:

- much learning-science evidence uses laboratory or non-JEE tasks;
- the mastery meta-analysis is old and bundles multiple intervention components;
- scaffolding findings in the downloaded meta-analysis are higher-education-heavy;
- interleaving effects are strongly material-dependent;
- graph/RL sequencing evidence is simulator-dominant;
- knowledge-tracing research often optimizes response prediction rather than learning;
- recent K–12 ITS evidence is U.S.-specific and concentrated in elementary/middle grades;
- almost no evidence directly compares next-intervention policies for high-stakes Indian entrance-exam preparation.

See `sources.md` for DOI/URL, lawful full-text status, local PDF paths, and exact supporting pages/sections.
