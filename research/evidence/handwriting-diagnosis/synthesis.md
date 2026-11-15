# Evidence synthesis: diagnosing photographed handwritten mathematics

Date: 2026-07-18  
Scope: AdvancedLearning research only. No product code was modified.  
Companion bibliography: `sources.md`  
Downloaded lawful full texts: `papers/`

## Executive conclusion

Photographed-work diagnosis is not one model task. It is a chain:

`capture → page/order recovery → verbatim transcription → mathematical structure → step/evidence alignment → first-error diagnosis → pedagogical response → learner-state decision`

The literature consistently shows that a correct final score can conceal an upstream transcription or grounding failure. Conversely, a model can transcribe correctly and still apply a rubric incorrectly. AdvancedLearning should therefore evaluate and gate each stage separately, preserve page/region evidence, and allow diagnosis only when the necessary upstream evidence is sufficient.

The strongest measured findings are:

- **Visual/math recognition is still a binding failure mode.** MathWriting documents the ambiguity and two-dimensional structure of mathematical handwriting; FERMAT reports a marked model degradation when the same solutions are handwritten rather than typed; EDU-CIRCUIT-HW finds that transcription errors propagate to grading and that error impact—not merely symbol error count—matters (`papers/gervais-2024-mathwriting.pdf`, pp. 1–7; `papers/nath-2025-fermat.pdf`, pp. 14784–14792; `papers/sun-2026-edu-circuit-hw.pdf`, pp. 15282–15289).
- **Rubrics materially help but do not solve vision or reasoning.** In the small Caraeni et al. study, a question-specific rubric/reference improved agreement substantially, while handwriting, long solutions, valid alternatives, and reasoning remained failure sources (`papers/caraeni-2025-gpt4-handwritten-grading.pdf`, pp. 2–3, Tables 1–2). Levine et al. similarly find separate transcription, rubric-interpretation, and mathematical-reasoning errors in authentic university submissions (`papers/levine-2026-automated-handwritten-grading.pdf`, pp. 5–7, Table 1).
- **Error localization is much harder than answer correctness.** FERMAT separates detection, localization, and correction; ErrorRadar and ScratchMath show sizeable gaps between coarse correctness and identifying/explaining the first causal error (`papers/nath-2025-fermat.pdf`, pp. 14787–14792; `papers/yan-2026-errorradar.pdf`, pp. 24298–24304; `papers/song-2026-scratchmath.pdf`, pp. 8–13).
- **Multi-page answers require evidence-page evaluation.** MP-DocVQA reports cases where a model outputs the correct answer while selecting the wrong answer page; this indicates dataset bias or ungrounded inference and motivates a joint answer-plus-evidence criterion (`papers/tito-2023-multipage-docvqa.pdf`, pp. 7–8, Figure 5).
- **Raw model confidence is not a safety guarantee.** Guo et al. show modern networks are miscalibrated and calibrate on held-out data; SelectiveNet formalizes risk as a function of retained coverage. TRON and FESTA offer black-box sampling ideas for MLLMs, but their assumptions and evaluated settings do not justify importing a universal threshold into handwritten grading (`papers/guo-2017-calibration.pdf`, pp. 1–8; `papers/geifman-2019-selectivenet.pdf`, pp. 1–8; `papers/wang-2025-sample-then-identify.pdf`, pp. 1–9; `papers/bhattacharya-2026-festa.pdf`, pp. 1–10).
- **Fluent hallucinations and “yes” bias need direct tests.** POPE shows that instruction and co-occurrence priors affect visual hallucination and that accuracy alone masks affirmative bias. Levine et al. observed models hallucinating correct text that was not on a student page (`papers/li-2023-pope-hallucination.pdf`, pp. 4–10; `papers/levine-2026-automated-handwritten-grading.pdf`, pp. 6–7).
- **Reliability must be designed, not assumed.** Hallgren warns that agreement percentage alone ignores chance and that statistic choice depends on label type/design; Watari et al. measured a Cohen’s kappa increase from 0.49 to 0.82 after structured rubric moderation (`papers/hallgren-2012-interrater-reliability.pdf`, pp. 24–34; `papers/yamada-2022-rubric-moderation.pdf`, pp. 83–87).
- **Students do not treat AI consistency as equivalent to human judgment.** In Riahi et al.’s small mixed-method study (n=27), students valued structured, consistent AI comments but raised concerns about fairness, missing context, and wanted meaningful human oversight (`papers/saxena-2026-humanizing-ai-grading.pdf`, pp. 3–8).

The safe product direction is therefore **selective, evidence-linked assistance**, not autonomous diagnosis from every upload. A photographed solution may generate a tentative user-facing observation at one threshold; updating a persistent learner model is a separate, higher-consequence decision requiring stronger evidence and a policy decision from the parent agent/product owner.

## What the evidence does and does not establish

### Directly measured

1. Handwriting and image quality reduce recognition/diagnosis performance in controlled handwritten and authentic course datasets.
2. Rubric/reference context improves aggregate grading agreement in tested settings.
3. Model failures occur at transcription, mathematical reasoning, equivalence recognition, and rubric application.
4. First-error localization and error explanation remain difficult even for frontier multimodal systems.
5. Correct outputs can be supported by the wrong page, and models can invent visual content.
6. Held-out calibration and risk–coverage analysis are necessary for selective prediction.
7. Independent rating plus rubric moderation can substantially improve human inter-rater reliability.
8. Some students value AI consistency but still want contextual human oversight.

### Inferences requiring AdvancedLearning validation

1. The exact performance of any current API model on JEE-style, multilingual, multi-page Indian student work.
2. A universal “confidence score” that transfers across subjects, camera conditions, model updates, and prompt versions.
3. The coverage at which diagnosis is safe enough for learner-state updates.
4. Whether repeated model sampling, perturbation consistency, or conformal methods will be affordable and effective for free-form handwritten diagnosis.
5. Whether a 180-attempt launch evaluation is large enough for rare but severe false-praise or unreadable-image failures.

## Recommended photo evaluation set

### 1. Define the unit as an attempt bundle, not a single crop

Each evaluation case should contain:

- all ordered page images exactly as captured;
- capture metadata that is privacy-safe and needed for slicing (device class, image dimensions, orientation, upload path);
- the question/rubric/reference solution version;
- a page/block/step map;
- the student’s final answer, if present;
- independent annotations and adjudication history;
- the expected system action: diagnose, ask a clarification, request recapture, or abstain.

Report results at four nested units: **page, step, rubric item, and complete attempt**. A system that is accurate on 95% of steps can still fail many long attempts; attempt-level “no material error” is the launch-relevant unit.

### 2. Use a stratified natural set plus a separate stress set

Do not mix authentic prevalence estimates with synthetic difficulty manipulations.

**Natural set:** prospectively collected, consented attempts reflecting intended use. Sample or report separately by:

- subject: physics, chemistry, mathematics;
- grade/exam style and chapter;
- response type: numeric, symbolic derivation, proof/explanation, diagram/graph/table, mixed prose/math;
- number of pages and number of student steps;
- valid-alternative solution path vs reference-like path;
- handwriting density and use of margins/arrows/cross-outs;
- English, Hindi/English code-switching, and notation-only work where applicable;
- camera quality: clean, moderate blur, glare/shadow, skew/perspective, low contrast, crop loss;
- correctness state: fully correct, first error early/middle/late, multiple independent errors, incomplete, off-topic;
- evidence sufficiency: sufficient, ambiguous, unreadable, missing page/question/rubric.

**Stress set:** controlled perturbations for causality and regression:

- blur, compression, rotation, perspective, shadow, glare, low resolution, crop;
- page duplication, omission, reversal, and distractor page;
- visually confusable tokens (`1/l`, `0/O`, minus/dash, decimal point, radical extent, exponents/subscripts);
- contradictory typed metadata vs image;
- confident student assertions that a wrong step is correct;
- an unanswerable or under-specified question;
- correct final answer following invalid reasoning and wrong final answer following mostly valid reasoning.

Measured basis: FERMAT’s controlled perturbations and handwriting ablation; EDU-CIRCUIT-HW’s error-impact analysis; Levine’s blur/rotation/transcription cases; POPE’s adversarial/co-occurrence sampling. The proposed factorial application to AdvancedLearning is an inference to validate.

### 3. Split to prevent leakage

- Hold out by **student/writer**, not only by image.
- Also group related question templates and duplicate solution paths.
- Freeze a blind launch set before prompt/model tuning.
- Keep a rolling shadow set of newly consented production-like examples.
- Never select the “best” prompt on the final launch set.

### 4. Size the safety slices from the claim

The current launch-set count must be justified against the rare-event claim, not chosen only as an overall total.

- If `n` relevant cases show zero failures, the simple one-sided 95% “rule of three” upper bound is approximately `3/n`.
- Demonstrating an unreadable-routing miss rate below 5% with zero observed misses requires about 60 genuinely unreadable/insufficient cases—not 60 total uploads.
- Demonstrating a harmful accepted-diagnosis rate below 1% with zero observed events requires about 300 accepted, independently adjudicated diagnoses.
- Estimating 95% sensitivity with a roughly ±5 percentage-point normal-approximation margin requires about 73 positive insufficient-evidence cases; tighter bounds need more.

These are statistical planning inferences, not guarantees, and clustering by student/question will reduce effective sample size. The product owner must decide the tolerated upper bound and confidence level before the final sample size is fixed.

## Recommended annotation protocol

### 1. Separate observation from interpretation

Use layers that can disagree independently:

1. **Capture sufficiency:** all pages present, ordered, oriented, uncropped, and readable for the task.
2. **Verbatim visual transcription:** preserve what is visible, including crossed-out work, arrows, margins, line breaks, illegible spans (`[ILLEGIBLE]`), and uncertainty alternatives; do not silently correct math.
3. **Mathematical normalization:** canonical symbols/LaTeX and expression tree, linked back to visual spans.
4. **Step graph:** step boundaries and dependencies; allow non-linear arrows/branches, not only a flat line sequence.
5. **Rubric alignment:** which rubric item/evidence requirement each student step addresses.
6. **Diagnosis:** correctness per step, first causal error, downstream consequential errors, error family, and repair.
7. **Evidence sufficiency/action:** answerable, needs clarification, recapture, missing context, or abstain.
8. **Learner-state eligibility:** a separate adjudicated label; never implied merely by a diagnosis label.

This decomposition follows EDU-CIRCUIT-HW’s near-verbatim transcription principle and the observed separation between transcription and rubric errors. The exact schema is an AdvancedLearning design inference.

### 2. Make “first causal error” operational

Define it as:

> The earliest student-authored step that is not justified by the preceding visible work and whose correction would change or unblock the subsequent valid solution path.

Annotation rules:

- Do not label a visually uncertain token as a conceptual error; mark evidence insufficiency first.
- Distinguish **first causal error**, **first rubric loss**, and **final-answer error**.
- If two independent branches fail, annotate both and identify the first in reading/dependency order.
- If a later line correctly repairs an earlier slip, retain the slip but mark it self-corrected.
- If the work omits steps but the conclusion is valid, annotate missing justification separately from incorrect reasoning.
- Allow multiple mathematically equivalent solutions and require annotators to state why a non-reference path is valid.

### 3. Use qualified independent raters and moderation

- Two independent subject-matter raters per launch/evaluation case, blinded to model output.
- A third adjudicator for disagreements, but preserve pre-adjudication labels for reliability reporting.
- Calibration round on a diverse pilot batch; discuss disagreements; revise definitions; repeat until stable; then freeze the rubric for the blind set.
- Re-open the rubric only under a versioned change process and re-annotate an anchor set.
- Record whether a disagreement was visual, mathematical, rubric-based, or pedagogical.

Watari et al.’s measured kappa improvement after moderation supports the process; its clinical-exam setting means the exact effect size should not be assumed here.

### 4. Report the correct reliability statistic

- Binary/nominal labels: Cohen’s kappa for two raters or an appropriate multi-rater coefficient, plus raw agreement and class-specific positive/negative agreement.
- Ordered severity/partial-credit labels: weighted kappa with the weighting scheme stated.
- Continuous total scores: ICC with the exact form stated (model, consistency vs absolute agreement, single vs average rater).
- First-step localization: exact agreement and within-one-step agreement; a distance-aware score may supplement but not replace exact.
- Multi-label error categories: per-label agreement and macro summary.
- All major estimates: confidence intervals, label prevalence, number of raters/cases, and both pre- and post-adjudication results.

Do not use correlation as agreement, and do not report only percent agreement. Apply Hallgren’s 2013 erratum when selecting software (`papers/hallgren-2013-erratum.pdf`, p. 95).

## Recommended metrics and gates

No single aggregate accuracy should be a launch gate. Use the following scorecard, always sliced by subject, page count, visual quality, solution length, error class, and model/prompt version.

### Capture and page handling

- page-presence, page-order, rotation, duplicate-page, and crop-loss detection;
- insufficient-evidence sensitivity and specificity;
- false-readable rate: insufficient uploads incorrectly accepted;
- recapture success rate after one guided retry;
- percentage of attempts with complete supporting-page citation.

The internal “route ≥95% insufficient uploads” target should be defined as **sensitivity among independently labeled insufficient uploads**, with a confidence interval. Also report false-recapture rate among sufficient uploads.

### Transcription and structure

- symbol/token error rate and exact-expression match;
- high-impact error rate: transcription errors that change correctness, rubric evidence, or diagnosis;
- block/line-order accuracy;
- step-boundary F1;
- structure exact match for fractions, radicals, superscripts/subscripts, matrices, aligned derivations, diagrams, and tables;
- error rate on crossed-out vs active work.

Measured basis: MathWriting uses exact expression and symbol-level recognition measures; EDU-CIRCUIT-HW shows impact-weighted error analysis is more useful to grading than raw SER alone. A generic character-error rate can look good while a lost minus sign causes a wrong diagnosis.

### Diagnosis and grading

- correctness detection: balanced accuracy, class precision/recall/F1, and confusion matrix;
- first-causal-error exact step accuracy and ±1-step accuracy;
- error-family macro-F1;
- rubric-item precision/recall/F1 and exact attempt-level score agreement;
- weighted kappa for ordinal rubric outcomes; ICC/MAE for total scores where appropriate;
- equivalent-solution false-rejection rate;
- unsupported-diagnosis rate: diagnosis lacks a correct page/region/step citation;
- false-praise rate: incorrect or unsupported work is positively validated;
- false-correction rate: correct work is told it is wrong;
- complete-attempt safe accuracy: all material findings correct, grounded, and no unsafe omission.

Given educational harm asymmetry, false praise and false correction should be reported separately, not averaged away.

### Calibration and selective prediction

- reliability diagram;
- Brier score or negative log-likelihood for probabilistic labels;
- ECE as a summary, with binning specified and accompanied by the diagram;
- risk–coverage curve and area under the risk–coverage curve;
- selective risk at predeclared coverage points;
- coverage at predeclared maximum risk;
- subgroup risk–coverage curves;
- bootstrap confidence intervals clustered by student/question;
- out-of-distribution/shadow-set degradation.

Guo et al. note that ECE can hide localized behavior and depends on binning. SelectiveNet’s core lesson is that a rejector is evaluated jointly by error and coverage, not by accuracy after silently discarding cases.

### Human and operational metrics

- expert baseline and inter-rater disagreement;
- adjudication time and model-assisted review time;
- rate and outcome of student/teacher corrections;
- reversal rate after human review;
- latency and inference cost, including repeated sampling;
- percentage of model versions passing unchanged regression gates.

## Confidence and threshold design

### 1. Do not use the model’s verbal confidence

“I am 95% confident” is generated text unless it is tied to a validated scoring mechanism. Store separate confidence/evidence variables:

- `capture_sufficiency_confidence`;
- `transcription_confidence` per span/step;
- `evidence_grounding_confidence`;
- `diagnosis_confidence`;
- `rubric_score_confidence`;
- `learner_state_eligibility` (a policy outcome, not a probability).

The weakest necessary upstream component should constrain the downstream action. High diagnosis self-confidence cannot override an unreadable exponent or a missing page.

### 2. Calibrate per frozen system version

Fit thresholds only on a held-out calibration set for the exact:

- model/provider/model snapshot;
- prompt and system policy;
- image preprocessing/cropping;
- decoding and sampling settings;
- rubric/reference version;
- output parser/schema;
- subject/grade slice where sufficient data exist.

Temperature scaling is a strong simple baseline for conventional logits, but many hosted MLLMs do not expose meaningful logits for free-form answers. In that case, train/calibrate a separate verifier or use structured repeated judgments, then evaluate its risk–coverage curve. TRON/FESTA support investigation of black-box sampling, but their reported domains do not prove safety for free-form handwritten diagnosis.

### 3. Use action-specific thresholds

Recommended ordering:

1. **Low evidence:** request a specific recapture or missing page; do not diagnose.
2. **Readable but ambiguous:** ask a bounded clarification (“Is the exponent on page 2 line 4 a 2 or a 7?”).
3. **Moderate evidence:** provide tentative, non-state-changing feedback with the cited step and invite correction.
4. **High, calibrated evidence:** provide a diagnosis linked to page/region/step.
5. **Learner-state update:** require a stricter gate than user-facing feedback and, for consequential misconception claims, confirmation from another independent signal.

The numeric cutoffs cannot be chosen from the reviewed papers. The product owner must set:

- maximum acceptable false-praise and false-correction risk;
- desired coverage;
- whether risks differ by action (hint vs score vs persistent learner state);
- minimum evidence needed for repeated vs one-off learner-state changes.

Then select thresholds on held-out data to meet those constraints with confidence intervals. Do not choose `0.8` or `0.9` because it sounds conservative.

### 4. Prefer asymmetric severity-weighted risk

At minimum distinguish:

- harmless wording issue;
- wrong step location but correct error family;
- wrong diagnosis that prompts unneeded remediation;
- false praise of a misconception;
- false negative on unreadable/missing evidence;
- persistent learner-state corruption.

A threshold that optimizes aggregate F1 can still accept rare severe failures. Report severe-event upper bounds separately.

## Safe abstention behavior

An abstention should be useful, specific, and honest:

- state exactly what evidence is missing or ambiguous;
- cite the affected page/region/step;
- request the minimum corrective action;
- preserve already readable pages rather than requiring full re-upload;
- never fill a visual gap with a plausible equation;
- never convert “cannot verify” into “incorrect”;
- never praise correctness when the relevant visual evidence is uncertain;
- offer typed input or a quick confirmation for a single ambiguous token;
- route repeated or consequential ambiguity to a human/review path.

Examples:

- Good: “I can read pages 1 and 3, but page 2 is missing; I can’t locate the first error without the middle derivation.”
- Good: “The exponent in line 4 could be 2 or 7. Please tap the correct one or retake that region.”
- Unsafe: “Your algebra looks correct” when the middle line is blurred.
- Unsafe: silently assuming the cropped term and continuing.

POPE’s finding that visual-language models can be biased toward affirmative answers supports explicit no-evidence/no-claim tests. The exact UX wording is a product inference and should be user-tested.

## Multi-page capture and reasoning

### Capture contract

- Capture an ordered bundle with visible page numbers/progress.
- Show thumbnails before submission and allow reorder/delete/reshoot.
- Detect likely duplicates, gaps, upside-down pages, blur, glare, perspective, and cropped margins.
- Keep original images; preprocessing outputs are derivatives, not replacements.
- Permit targeted recapture of one page or region.
- Ask whether crossed-out pages/work should be included when ambiguous.

### Reasoning contract

- Assign immutable page/block/line IDs.
- Transcribe and assess each page independently before cross-page synthesis.
- Build a dependency map across pages; do not concatenate into an untraceable text blob.
- Every material diagnosis must cite the supporting page and span.
- Require a joint pass: correct diagnosis **and** correct evidence page/region.
- Abstain if a required intermediate page is missing even when the final answer is visible.

### Multi-page stress tests

- same pages in correct vs reversed order;
- one missing middle page;
- duplicated page;
- an unrelated distractor page;
- answer evidence at first, middle, and last positions;
- cross-page variable-definition changes;
- two questions interleaved on the same pages;
- correct answer obtainable from question priors but unsupported by the uploaded work.

MP-DocVQA’s correct-answer/wrong-page phenomenon is direct evidence that answer accuracy alone is insufficient. Applying its methods to handwritten derivations is analogical and must be validated locally.

## Model, prompt, rubric, and data versioning

Every diagnosis record and evaluation row should be reproducible from:

- provider and exact model identifier/snapshot date;
- API capability/version and region where relevant;
- system/developer/user prompt templates and cryptographic hashes;
- decoding parameters, seed if supported, number of samples, and tool calls;
- image originals’ hashes, preprocessing version, crops, order, and compression;
- question, reference solution, accepted-alternative set, and rubric versions;
- output JSON schema/parser/validator versions;
- verifier/calibrator and confidence-threshold versions;
- calibration/evaluation dataset release and split IDs;
- code/build identifier for orchestration;
- timestamp, latency, token/image usage, and cost;
- final action and any human/student correction.

Required process:

1. Freeze a “system release” as the tuple above.
2. Replay the complete blind/regression set before deployment.
3. Treat provider model alias changes as a new release unless the provider guarantees immutability.
4. Preserve prior outputs and compare paired regressions, including confidence and coverage shifts.
5. Recalibrate after any material model, prompt, preprocessing, rubric, or parser change.
6. Keep immutable provenance on learner-state evidence so a later model defect can be audited and reversed.

## When photographed evidence may update learner state

### Evidence hierarchy

Keep three distinct records:

1. **Observed:** “The uploaded page shows `sin(A+B)=sin A+sin B` at page 1, step 3,” with image provenance and uncertainty.
2. **Inferred:** “This may indicate misuse of angle-addition identities.”
3. **State claim:** “Learner has misconception X,” with confidence, scope, supporting events, counterevidence, and expiry/review status.

Do not collapse these layers. A recognizer error must be correctable without rewriting history as if the learner made it.

### Candidate eligibility rules

A photo-derived event should be ineligible for persistent learner-state change when:

- capture is incomplete or materially unreadable;
- transcription ambiguity can change the diagnosis;
- supporting page/step provenance is missing;
- the solution follows a valid alternative not covered by the rubric;
- human raters themselves do not reach adequate agreement;
- the case is out of the calibrated distribution;
- the model abstains or independent checks disagree;
- the only evidence is absence of written steps;
- a student/teacher disputes the interpretation and review is unresolved.

Potentially eligible evidence should require:

- sufficient capture and complete page ordering;
- a stable, evidence-linked transcription;
- a calibrated diagnosis above the action-specific threshold;
- a relevant, versioned rubric and accepted-alternative check;
- no severe disagreement across independent verifier/sample/human signals;
- a reversible event record;
- preferably a confirming response, subsequent probe, or repeated independent observation for a misconception-level state.

### Conservative update semantics

- One upload may add an **observation** or a short-lived “needs confirmation” hypothesis.
- Repeated independent evidence or a targeted follow-up probe may promote the hypothesis.
- Correct later work should provide counterevidence and allow decay/reversal.
- Capture/recognition failure should update system-quality telemetry, never learner mastery.
- Missing work is not evidence of inability.
- Student corrections should be retained as provenance and trigger re-evaluation.

This is a recommended evidence architecture, not a final product policy. The product owner must decide whether any single high-confidence photo diagnosis can alter mastery, how many independent confirmations are required, and which state changes require human review.

## Human-in-the-loop design

Human review should not be a generic fallback queue. Route cases with a reason:

- unreadable/ambiguous token;
- valid-alternative uncertainty;
- conflicting rubric/model signals;
- severe potential misconception;
- low-frequency/out-of-distribution notation;
- student dispute;
- calibration drift or model-release audit sample.

Review UI should show the original image first, then page/step citations, verbatim transcription, normalized math, diagnosis, rubric item, and uncertainty. Avoid anchoring reviewers by optionally collecting an independent verdict before revealing the model’s.

Sample accepted high-confidence cases as well as abstentions; otherwise silent confident errors remain invisible. Riahi et al.’s student responses and the public GradeLab discussion both indicate that human oversight also preserves contextual and instructional insight, not merely correction capacity.

## Practitioner/student anecdotes: separate interpretation

The public discussions reviewed converge on four concerns:

1. A photographed problem may be solved correctly **after being recognized incorrectly**.
2. Fluent OCR may substitute a plausible number or symbol, making failure harder to notice than obvious gibberish.
3. Mathematical layout and page/line numbering can collapse even when most characters are right.
4. Users expect a visible correction/appeal path and distrust consequential automated judgments without human context.

Photomath’s own support flow asks users to compare the recognized equation to the image and edit it before trusting the solution, while its camera guidance emphasizes autofocus and sharp capture. These are useful UX precedents, not efficacy studies.

Reports of AI false praise/sycophancy are salient enough to justify a dedicated false-praise suite, especially tests where a student confidently asserts that a wrong step is correct. However, prevalence cannot be inferred from social media. See `sources.md`, “Public practitioner/student discussions and product support.”

## Minimum pre-launch research deliverables

1. A versioned natural photo set and separate perturbation stress set.
2. A frozen annotation manual with example boundary cases.
3. Pre-adjudication reliability report and moderation log.
4. Stage-wise metrics plus complete-attempt safe accuracy.
5. Risk–coverage curves and confidence intervals for every consequential action.
6. Dedicated unreadable, missing-page, hallucination, valid-alternative, and false-praise suites.
7. Human baseline and review workflow timing.
8. A versioned release manifest capable of exact replay.
9. A learner-state provenance/reversal design.
10. Parent-approved risk budgets and learner-state policy.

## Decision questions escalated to product owner

The evidence does not answer these product-policy questions; they should not be silently chosen during implementation:

1. What is the maximum tolerated rate (with what confidence level) of:
   - false-readable acceptance,
   - false praise,
   - false correction,
   - wrong first-error localization,
   - learner-state corruption?
2. Which actions have different risk budgets: recapture request, tentative hint, definitive diagnosis, rubric score, and persistent learner-state update?
3. May one photo ever update persistent mastery/misconception state, or is a confirming probe/repeated event mandatory?
4. Which cases require human review: all state updates, only severe misconception claims, disputes, or sampled audits?
5. What minimum coverage is acceptable after abstention, and what latency/cost budget is available for repeated sampling or independent verification?
6. Is evaluation/training use of noncommercial/share-alike or unclear-license datasets acceptable, or must the project rely only on internally consented/commercially cleared data?
7. Are multilingual/code-switched and accessibility cases in the launch population? If yes, they require explicit sample and rater quotas rather than post-launch extrapolation.
8. Is the current planned evaluation size a fixed constraint or may it be increased to support the chosen rare-event claims?

## Bottom line

The research supports proceeding only with an evidence-linked, selectively predictive system that can say “I cannot verify this” and request the smallest useful recapture or clarification. It does **not** support trusting a model’s fluent explanation, aggregate grade accuracy, or self-reported confidence as sufficient proof of a learner misconception.
