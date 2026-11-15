# Measuring “JEE marks improved per active hour” in an 8-week private pilot

## Executive conclusion

Use a **stratified, individually randomized delayed-start trial**, not a conventional cluster stepped-wedge trial.

- Enrol 24–36 students and randomize 1:1 after baseline.
- The early-start arm receives AdvancedLearning in weeks 1–8.
- The delayed-start arm receives business-as-usual study in weeks 1–3, then AdvancedLearning in weeks 4–8.
- Keep weekly holdout tests independent of the product and score them on a pre-specified linked scale.
- Make the **week-3 baseline-adjusted intention-to-treat (ITT) difference in linked holdout score** the primary causal signal.
- Treat **linked holdout marks gained per instrumented active hour** as the north-star operational metric, but explicitly as **descriptive**, not causal.
- Continue both arms to week 8 to estimate feasibility, observed learning efficiency, model calibration, and the causal policy effect of three weeks of earlier access.

The pilot is suitable for feasibility testing and uncertainty estimation. It is not powered to establish a modest efficacy effect, validate subgroup effects, or prove that an hour in the product causes a particular number of JEE marks. At 80% power and two-sided alpha 0.05, an ideal balanced trial would detect only very large standardized effects: about 1.14 SD at N=24, 1.02 SD at N=30, and 0.93 SD at N=36 without baseline adjustment. With an optimistic baseline R² of 0.50, these fall to about 0.81, 0.72, and 0.66 SD; 15% attrition raises them to roughly 0.89, 0.81, and 0.72 SD.

## Why the north-star needs two estimands

The phrase “JEE marks improved per active hour” combines an outcome and a post-treatment exposure. It is useful operationally, but it is not by itself a defensible causal estimand.

Let:

- \(Y_{it}\): student \(i\)'s linked holdout mark at time \(t\), reported on a JEE-equivalent 0–300 scale only if the linking supports that interpretation;
- \(Y_{i0}\): pre-randomization baseline linked mark;
- \(H_{it}\): valid instrumented AdvancedLearning active hours accumulated from baseline through \(t\);
- \(Z_i\): randomized assignment to early start (1) or delayed start (0).

Define the observed student efficiency:

\[
E_{it} = \frac{Y_{it}-Y_{i0}}{H_{it}}
\]

This ratio is undefined when \(H_{it}=0\), unstable at very small denominators, and confounded because motivation, prior knowledge, available time, and difficulty all affect both hours and score growth. Comparing \(E\) between users or regressing gain on hours does not isolate the causal return to an hour.

The pilot should therefore report:

1. **Primary causal estimand:** week-3 ITT effect of early access on linked holdout score,
   \[
   \tau_3 = E[Y_{i3}(Z=1)-Y_{i3}(Z=0)]
   \]
   under randomization, no interference, valid outcome measurement, and appropriate handling of missing outcomes.
2. **Primary operational metric:** cohort aggregate observed efficiency,
   \[
   E^{agg}_t = \frac{\sum_{i:H_{it}\ge h_{min}}(Y_{it}-Y_{i0})}
   {\sum_{i:H_{it}\ge h_{min}}H_{it}}
   \]
   with \(h_{min}=0.5\) valid active hours and a student-cluster bootstrap interval. Report the median individual ratio and its interquartile range as a robustness summary.
3. **Exploratory randomized-offer efficiency:** at week 3,
   \[
   \frac{ITT\ effect\ on\ score}{ITT\ effect\ on\ active\ hours}
   \]
   This Wald/IV-style ratio can be interpreted as marks per hour induced by assignment only under strong exclusion, monotonicity, relevance, and no-interference assumptions. With 24–36 students it will be imprecise and must not be promoted as the primary result.

Do not assign zero efficiency to students with zero hours. “Undefined” is the correct value. Do not compare the early arm’s ratio with the delayed arm in weeks 1–3, because the delayed arm has no product-hour denominator.

## Evidence-to-design synthesis

### Pilot purpose and progression, not definitive efficacy

The CONSORT pilot extension distinguishes a feasibility pilot from a definitive efficacy trial and requires explicit feasibility objectives and progression criteria. The pilot should answer whether recruitment, randomized delay, independent weekly testing, telemetry, diary completion, and intervention delivery work well enough for a larger trial. Any efficacy estimate should be accompanied by its confidence interval and framed as preliminary. [S01]

### Delayed start is feasible; a classical stepped wedge is not

Stepped-wedge cluster randomized trials randomize clusters to sequences, expose all clusters eventually, and must account for secular time trends, within-cluster correlation, and possible time-varying treatment effects. With only 24–36 students, there are too few credible clusters for cluster-level randomization or robust intracluster-correlation estimation. Calling individual students “clusters” does not solve that problem. [S02]

A randomized delayed-start design provides a clean concurrent comparison before crossover while addressing the practical desire to give everyone access. It does not make post-crossover within-person changes causal: period, maturation, testing, and external preparation remain alternative explanations. Delayed-start literature also warns that a persistent difference after delayed initiation does not automatically prove disease modification or, by analogy, durable learning acceleration. [S03]

### Repeated forms require a defensible linking design

Weekly forms should be assembled to a common content blueprint and difficulty distribution. Merely labeling forms “equivalent” is insufficient. Small-sample equating is fragile, and estimating item parameters from 24–36 pilot students is not credible. Use externally pre-calibrated items when available. Otherwise conduct a separate calibration exercise before the pilot or report raw blueprint scores without claiming precise conversion to the 0–300 JEE scale. [S04, S05]

A practical design is:

- Freeze each student’s eligible syllabus at baseline.
- Sample only from that eligible content so grade-11 students are not penalized for untaught grade-12 material.
- Preserve a common set of anchor items or fixed external item parameters.
- Keep all scored holdout items unseen in the product before assessment.
- Counterbalance form order across randomized arms.
- Audit content, difficulty, discrimination, negative marking, subject mix, and expected information for every form.

If external IRT parameters do not exist, the primary score should be the blueprint-weighted percentage or raw JEE-style mark on the common core, with “JEE-equivalent 0–300” clearly labeled as a provisional projection rather than a validated score.

### Practice effects are expected

Retesting improves scores even without the intervention. A meta-analysis found meaningful practice effects and showed that effects vary with retest interval, test type, and number of administrations. A delayed-start control measured on the same schedule protects the week-3 ITT contrast from attributing common practice gains to the product, but it does not eliminate form-specific leakage or differential test preparation. [S06]

Mitigations:

- never reuse scored holdout items;
- do not reveal full item-level solutions until the primary comparison is complete;
- keep test schedule and feedback equal between arms;
- include form and week effects in analysis;
- use a content blueprint and external anchors;
- ask whether students saw or discussed any holdout item;
- report raw trajectories for both arms, including control-arm gains.

### Contamination is an interference problem

Contamination can dilute the ITT contrast when delayed students obtain the product, screenshots, explanations, or study materials from early students. The complex-intervention review recommends defining contamination, measuring it, and choosing design or analysis responses prospectively rather than after seeing results. [S07]

At enrolment, record school/coaching batch, household, and close study partners. Use unique accounts, prohibit credential sharing, log concurrent-device and unusual-location signals with consent, and ask a weekly neutral contamination question. Do not automatically exclude contaminated students from ITT analysis. Report:

- randomized assignment;
- access actually received;
- suspected sharing events;
- cross-arm study contacts;
- holdout-item exposure.

If multiple household or close study pairs enrol, the parent must decide between:

- **individual randomization with measured contamination** (more power; recommended default), or
- **randomizing connected groups together** (less contamination; materially fewer independent units and much lower power).

### Active time must be event-derived, not page-open time

Time-on-task is latent. Session duration changes substantially with the inactivity threshold, and no universal threshold works for every learning activity. Long reading or video viewing can look idle, while mechanical interaction can look active without learning. Sessionization research recommends domain- and event-sensitive definitions, and the PLOS study shows that self-reports of long tasks are noisy enough to require explicit measurement treatment. [S10, S18]

Instrument append-only events:

- `session_start`, `session_end`;
- authenticated `heartbeat` every 15 seconds while the tab is visible and the app is foregrounded;
- `focus`, `blur`, `visibility_change`;
- question shown, response submitted, hint opened, explanation viewed;
- video play, pause, seek, ended;
- tutor message sent and response rendered;
- content scroll/annotation interaction;
- explicit “still studying” confirmation for long passive content;
- client timestamp, server receipt timestamp, student ID, session ID, device ID, content ID, event version, and network/offline state.

Primary active-time algorithm:

1. Sort server-validated events by student and session.
2. Count intervals between successive qualifying events up to a **5-minute cap**.
3. Stop accrual immediately on hidden tab, window blur lasting over 30 seconds, explicit pause, logout, or session end.
4. For video, count playback only while visible, foregrounded, not paused, and playback speed is known; store watched seconds separately from wall-clock seconds.
5. For tutor/reading waits, count up to 5 minutes, with a “still studying” event allowing another capped interval.
6. Merge gaps shorter than 60 seconds; start a new session after a gap greater than 30 minutes.
7. Exclude onboarding, technical support, consent, surveys, holdout tests, and administrative pages.
8. Flag implausible activity such as over 12 active hours/day, overlapping devices, heartbeat-only sessions, or impossible video playback.

Freeze the algorithm and event schema before unblinding. Recompute active hours under 2-minute and 10-minute caps as sensitivity analyses. Dashboard both raw wall-clock and active time; never silently replace one with the other.

### Missing data must be prevented and analyzed by reason

The National Research Council report prioritizes prevention, retrieval of outcomes after intervention discontinuation, an estimand aligned with the scientific question, and sensitivity analysis for unverifiable missing-data assumptions. Missingness should not be handled by complete-case analysis alone or by setting missed tests to zero. [S08]

Use:

- independent reminders and flexible windows for holdout tests;
- outcome collection even after the student stops using the product;
- reason codes: illness/exam clash, withdrawal, technical failure, unreachable, intervention dissatisfaction, other;
- weekly telemetry completeness checks;
- device-side buffering and server acknowledgement;
- an ITT analysis using all observed repeated outcomes under a pre-specified missing-at-random model;
- multiple imputation as a supporting analysis when week-3 outcomes are missing;
- delta-adjusted pattern-mixture sensitivity analyses that shift missing early-arm outcomes downward and delayed-arm outcomes upward by 0.25 and 0.50 baseline SD;
- best/worst plausible bounds for the tiny sample.

Missing active-time telemetry is not zero time. The operational ratio requires at least 90% expected heartbeat coverage in counted sessions; otherwise flag the student-period as telemetry-incomplete and show a sensitivity range.

### Subgroups are descriptive only

Heterogeneous-effect analyses need adequate subgroup size, pre-specification, formal interaction tests, and multiplicity control. With 24–36 students split among grade 11, grade 12, and droppers, subgroup estimates will be unstable. Report subgroup point estimates and wide intervals as exploratory, without “works/does not work” labels. Do not interpret significance in one subgroup and non-significance in another as evidence of a subgroup difference. [S12]

Pre-specify only three moderators:

- cohort: grade 11 / grade 12 / dropper;
- baseline proficiency: continuous centered linked score;
- baseline external study hours: continuous.

Use shrinkage or partial pooling for plots if implemented, but do not use subgroup results as launch gates.

### Power and minimum detectable effects

Power is driven by independent units, allocation, outcome variance, attrition, baseline-outcome correlation, noncompliance, and repeated-measure correlation. Education power guidance recommends transparent assumptions and sensitivity analysis rather than a single optimistic number. [S09, S14]

Approximate individual-randomization MDEs for a two-sided 5% test and 80% power:

| Randomized N | No baseline adjustment | Baseline R²=.25 | Baseline R²=.50 | 15% attrition and R²=.50 |
|---:|---:|---:|---:|---:|
| 24 | 1.14 SD | 0.99 SD | 0.81 SD | 0.89 SD |
| 30 | 1.02 SD | 0.89 SD | 0.72 SD | 0.81 SD |
| 36 | 0.93 SD | 0.81 SD | 0.66 SD | 0.72 SD |

These normal-approximation values are optimistic because they omit small-sample degrees-of-freedom penalties, form-linking error, contamination, treatment noncompliance, and multiplicity. They should be used to set expectations, not to claim adequate power. The pilot should report confidence intervals and feasibility thresholds, not declare success solely from \(p<.05\).

### Product knowledge models need calibration, not only ranking metrics

Knowledge-model evaluation should distinguish prediction accuracy, discrimination, and calibration. RMSE and log loss depend on probability accuracy; AUC describes ranking but can be high while predicted probabilities are systematically wrong. Calibration should include an intercept, calibration slope, calibration-in-the-large, and a smoothed calibration curve with uncertainty. Avoid relying only on Hosmer–Lemeshow tests or a single expected calibration error. [S11, S15]

Evaluate predictions only on independent future interactions or holdout items, never on training observations. Pre-specify:

- log loss and Brier/RMSE;
- AUC with student-cluster bootstrap interval;
- calibration intercept and slope;
- reliability diagram with at least adaptively sized bins and a smooth curve;
- accuracy by probability band;
- cold-start versus established-student performance;
- drift by week and cohort.

The pilot is too small to refit a complex knowledge model and validate it on the same students. Freeze model parameters before the pilot or clearly label any refitting as exploratory and use leave-one-student-out or forward-chaining evaluation.

### Learning efficiency should preserve both gain and time

The adaptivity study operationalizes learning efficiency by combining learning gain and learning time and illustrates why both dimensions should remain visible. A single ratio can hide whether efficiency rose because learning improved or because measured time fell. [S13]

Every efficiency display should therefore include:

- numerator: linked gain, with uncertainty;
- denominator: valid active hours, with telemetry completeness;
- ratio: aggregate and individual distribution;
- a gain-versus-hours scatterplot;
- weekly marginal gain and hours separately;
- sensitivity to active-time cap and score-linking method.

## Feasible 8-week protocol

### 1. Objectives

Primary feasibility objectives:

1. recruit at least 24 and preferably 36 eligible students;
2. retain at least 85% for the week-3 causal endpoint and 80% through week 8;
3. obtain at least 90% weekly holdout completion;
4. obtain valid telemetry for at least 90% of expected active sessions;
5. keep confirmed delayed-arm product access below 10% before crossover;
6. demonstrate acceptable assessment reliability/linking and no material arm-by-form imbalance;
7. estimate variance, baseline correlation, contamination, and intrastudent correlation for a larger trial.

Secondary signal objectives:

- estimate the week-3 ITT score difference and uncertainty;
- estimate the week-8 effect of assignment to three weeks of earlier access;
- characterize observed marks gained per active hour after each arm starts;
- evaluate engagement, external-study substitution, safety, and knowledge-model calibration.

### 2. Population

Target 24–36 mixed JEE aspirants: approximately equal representation from grade 11, grade 12, and droppers where recruitment permits.

Inclusion:

- actively preparing for JEE;
- can complete all independent assessments;
- has a compatible device and connectivity;
- for minors, parent/guardian consent plus student assent;
- agrees not to share accounts or holdout content.

Exclusion:

- prior material exposure to the exact product build or pilot item bank;
- inability to receive the delayed intervention ethically or practically;
- same person enrolled under multiple accounts.

Record but do not exclude based on coaching enrolment, school board, language, socioeconomic indicators, disability accommodations, or baseline proficiency. Provide appropriate assessment accommodations and document any departure from standard timing.

### 3. Pre-pilot preparation

Before consent closes:

- preregister protocol, outcomes, score construction, randomization, analysis, stopping rules, and deviations process;
- freeze the product build except safety-critical fixes;
- freeze telemetry schema and active-time algorithm;
- freeze item bank, content blueprint, form assembly constraints, and scoring/linking parameters;
- independently label product and holdout items to prevent leakage;
- generate the allocation sequence by code unavailable to recruiters and assessors;
- train staff on consent, adverse-event escalation, technical support, and neutral follow-up;
- conduct a 3–5 student usability run-in whose data are excluded from trial estimates.

### 4. Baseline week

Day -7 to -1:

1. consent/assent and privacy notice;
2. demographics and cohort;
3. current syllabus coverage and frozen eligible-content map;
4. coaching/school schedule, planned study hours, usual sleep, device access;
5. prior JEE/mock scores with date and source;
6. baseline independent holdout form under remotely proctored or standardized conditions;
7. optional short parallel baseline form 3–4 days later to estimate test-retest noise and reduce regression-to-the-mean sensitivity;
8. seven-day external-study diary before randomization where feasible;
9. product literacy/onboarding assessment that reveals no treatment content.

Randomize only after the primary baseline test is locked.

### 5. Allocation

Recommended default:

- 1:1 early versus delayed start;
- stratify by grade 11 / grade 12 / dropper;
- within cohort, order by baseline score and form adjacent pairs;
- randomly allocate one member of each pair to each arm;
- use a reproducible seed and preserve the allocation file;
- conceal assignment until baseline data are finalized.

If a stratum has an odd count, use restricted randomization to minimize arm imbalance in cohort count, baseline score, and baseline external-study hours. Do not repeatedly rerandomize after outcomes are visible.

### 6. Intervention schedule

- **Early arm:** AdvancedLearning access from start of week 1 through end of week 8.
- **Delayed arm:** no AdvancedLearning access in weeks 1–3; access from start of week 4 through end of week 8.
- **Both arms:** continue ordinary school, coaching, books, videos, and tutoring. The study does not ask students to stop existing preparation.
- Assessments, reminders, incentives, and staff contact must be the same in both arms.

A three-week delay gives three concurrent randomized weekly contrasts. A two-week delay reduces withholding but weakens the causal window. Delays longer than three weeks increase causal information but may be harder to recruit and retain. This is a parent decision requiring ethical and operational sign-off.

### 7. Weekly measurement

At the end of each week:

- 15 scored items, five per subject, approximately 45 minutes;
- JEE-style marking (+4 correct, -1 incorrect, 0 unattempted) unless the bank is built for a different validated rule;
- fresh items sampled from a pre-specified **cohort-common eligible syllabus**; use student-personalized content only when fixed external item parameters make scores comparable;
- common blueprint and information target across arms and weeks;
- form order counterbalanced;
- no product access during the assessment;
- record start/end, response time, interruptions, device, proctor flags, and item exposure report;
- collect a five-minute external-study and contamination diary.

Use longer 30-item forms at baseline and week 8 if burden permits. Because 15-item weekly forms are noisy, the week-3 analysis should use the linked score and repeated weeks 1–3 as supporting information, not over-interpret a one-week raw change.

External-study diary fields:

- school/coaching class hours;
- homework/self-study hours outside AdvancedLearning;
- mock-test time;
- other app/video/tutor time;
- chapters studied;
- major exam/illness/disruption;
- cross-arm study or content sharing;
- confidence in estimate: exact log / calendar reconstruction / rough estimate.

Use bounded category prompts plus optional exact minutes to reduce false precision. Diary values are covariates and context, not grounds to exclude students.

### 8. Outcome definitions

Primary causal outcome:

- linked independent holdout score at end of week 3;
- baseline-adjusted ITT contrast, early minus delayed.

Key secondary outcomes:

- repeated linked scores in weeks 1–3;
- week-8 linked score, interpreted as effect of early-start sequence versus delayed-start sequence;
- raw marks and subject scores;
- active hours, sessions, active days, questions attempted, and mastery events;
- observed aggregate and individual efficiency after access begins;
- total study hours and displacement of external study;
- retention, adherence, technical failures, and contamination;
- model discrimination and calibration;
- student-reported workload, distress, sleep disruption, and satisfaction.

Operational north-star:

- numerator: linked independent holdout gain from baseline;
- denominator: valid product active hours excluding assessment/admin time;
- primary display: ratio of cohort sums;
- supporting displays: median individual ratio, gain-hours scatter, weekly marginal ratio, denominator coverage;
- minimum denominator for an individual ratio: 0.5 hours cumulatively and 0.25 hours in a weekly interval;
- negative gains remain negative and are never truncated to zero.

Do not use in-product question accuracy in the north-star numerator. It is adaptively selected and vulnerable to training leakage.

### 9. Analysis plan

Primary analysis:

\[
Y_{i,week3} = \alpha + \tau Z_i + \beta Y_{i,baseline}
+ \gamma_{allocation\ block(i)} + \delta_{form(i)} + \epsilon_i
\]

- estimate \(\tau\) by ITT; allocation-block indicators preserve the matched/blocked randomization, and cohort indicators replace them only if matching cannot be completed;
- use HC2 small-sample robust standard errors;
- report adjusted mean difference, 95% confidence interval, standardized effect, and exact/randomization-inference \(p\)-value respecting the allocation blocks;
- do not adjust the primary model for post-randomization active hours, usage, external study, contamination, or satisfaction.

Supporting repeated-measures model for weeks 1–3:

- student random intercept;
- fixed week effects;
- early-assignment-by-week interactions;
- baseline score, cohort, and form;
- small-sample degrees-of-freedom correction;
- arm-specific observed trajectories.

Week-8 model:

- same baseline-adjusted ITT structure;
- interpretation limited to assignment to **earlier access**, because both arms have received treatment by then.

Efficiency analyses:

- aggregate ratio with student-cluster bootstrap;
- individual ratios with median/IQR and winsorized sensitivity only as a secondary display;
- 2-, 5-, and 10-minute idle-cap sensitivity;
- raw and linked score numerator sensitivity;
- exploratory randomized-offer Wald ratio only if assignment changes active hours materially.

Do not:

- select the best-looking week;
- drop low users from ITT;
- control for product usage in the primary causal model;
- infer causality from within-person pre/post gains;
- fit separate underpowered models and compare significance across cohorts;
- treat every weekly item response as an independent student.

### 10. Missing data and protocol deviations

- retain all randomized students in ITT;
- pursue independent outcomes after product discontinuation;
- log deviations before viewing outcomes where possible;
- distinguish absent outcome, invalid test, technical telemetry loss, and true zero use;
- if any week-3 outcomes are missing, use the same ANCOVA estimand with pre-specified multiple imputation under MAR as the primary missing-outcome analysis;
- support it with the repeated-measures model, complete-case ANCOVA, and delta sensitivity;
- report complete-case analysis only as sensitivity;
- do not exclude contaminated students from ITT; add per-protocol and as-treated displays only as noncausal sensitivity analyses.

### 11. Ethics and privacy

BERA and Indian child-research guidance support voluntary informed consent, age-appropriate assent, special protection for minors, privacy, proportional data collection, and freedom to withdraw without penalty. [S16, S17]

Required safeguards:

- parent/guardian consent and student assent for minors; direct consent for adults;
- plain-language purpose, random delay, data collected, foreseeable burdens, confidentiality limits, incentives, and withdrawal route;
- no effect on school/coaching marks or access to ordinary study;
- compensation for assessment burden, not contingent on product usage or score improvement;
- collect no keystroke content, camera, microphone, precise location, contacts, or unrelated browsing unless separately justified and consented;
- pseudonymous study IDs; identity key stored separately;
- role-based access, encryption in transit/at rest, access log, retention/deletion dates;
- no public ranking or disclosure of scores to peers;
- safety contact and escalation for distress, excessive use, sleep loss, or academic pressure;
- report conflicts of interest and make clear that the product team is evaluating its own system;
- independent assessment administration and, if feasible, blinded scoring/analysis until the data lock.

This is methodological guidance, not a determination of whether formal ethics committee review is legally required. Obtain a local legal/ethics determination before enrolment, especially because minors and behavioral telemetry are involved.

### 12. Stopping and progression rules

Safety stop:

- any serious study-related adverse event;
- credible privacy/security breach involving identifiable student data;
- evidence that the assessment or product materially increases distress or unsafe study/sleep behavior;
- inability to preserve voluntary participation.

Measurement pause:

- holdout item leakage affecting more than 10% of a form;
- differential form difficulty over 0.30 baseline SD after linking checks;
- telemetry failure affecting more than 20% of user-days for two consecutive days;
- confirmed account sharing in more than 10% of delayed participants before crossover.

Futility is not based on efficacy \(p\)-values. Stop or redesign for operational futility if, after reasonable remediation:

- fewer than 24 students can be randomized;
- week-3 holdout completion is below 80%;
- valid telemetry is below 80%;
- early-arm median cumulative valid use is below 1 hour by week 3;
- contamination removes a credible concurrent contrast.

Progress to a larger efficacy trial only if:

- recruitment target is achieved on schedule;
- week-3 retention is at least 85%;
- assessment completion is at least 90%;
- telemetry validity is at least 90%;
- confirmed contamination is below 10%;
- no unresolved serious safety/privacy event occurs;
- the score-linking audit is acceptable;
- the ITT interval and variance estimate make a future adequately powered trial plausible.

Do not require a statistically significant efficacy result for progression.

### 13. Dashboard requirements

Access-controlled operational dashboard, refreshed at least daily:

1. **Recruitment/allocation:** screened, eligible, consented, randomized, counts by cohort and arm; no outcome-based arm comparison before data lock.
2. **Retention:** scheduled/completed/missed assessments by week and arm, reasons, withdrawal.
3. **Assessment quality:** form assignment, completion time, reliability/SEM, mean and SD, item exposure, leakage flags, missing items.
4. **Telemetry quality:** expected/received heartbeats, offline backlog, invalid intervals, device overlap, wall-clock versus active time, 2/5/10-minute sensitivity.
5. **Engagement:** active students, active days, hours, sessions, questions, hints, videos, tutor use; distributions, not only averages.
6. **External study:** coaching, self-study, mock, and other-app hours plus diary completeness.
7. **Contamination:** access attempts, sharing signals, self-reported cross-arm contact, holdout exposure.
8. **Safety/ethics:** distress flags, excessive daily use, support contacts, privacy incidents, consent withdrawals.
9. **Outcome (blinded until lock):** linked and raw score completeness, form diagnostics, pre-specified quality checks.
10. **Final analytical view:** arm trajectories, week-3 ITT estimate and CI, week-8 sequence effect, gain and hours separately, aggregate efficiency and sensitivity, calibration plots.

Every exported metric needs a data dictionary entry, formula, version, inclusion/exclusion rule, refresh time, and owner. Preserve an immutable analysis snapshot.

## Claims the pilot can and cannot support

### Causal, if assumptions hold

- “Randomized offer of immediate AdvancedLearning access changed the week-3 linked holdout score by X marks versus a three-week delayed offer.”
- “Assignment to three weeks of earlier access changed the week-8 linked holdout score by X marks versus delayed access.”
- “Randomized immediate offer changed product active time by X hours by week 3.”

These require successful randomization, no important interference, comparable outcome measurement, and defensible missing-data analysis.

### Descriptive or exploratory only

- “Observed users gained X linked marks per valid active hour.”
- “Students with more active hours gained more marks.”
- “Efficiency differed by grade, baseline level, chapter, or feature.”
- “Within-person scores rose after starting the product.”
- “The knowledge model was calibrated/AUC=X on these pilot observations.”
- “External study fell as product use increased.”
- “The Wald ratio was X marks per assignment-induced hour.”

### Not supported by this pilot

- a precise population-wide causal return per product hour;
- efficacy for all JEE aspirants;
- definitive subgroup effectiveness;
- superiority to a named coaching program or other app not randomized;
- durable JEE Main/Advanced exam-score effects;
- a validated 0–300 conversion without defensible external linking;
- a product mechanism claim based on feature usage;
- absence of harm from observing no serious event in 24–36 students.

## Decisions for the product owner

The evidence does not uniquely determine these choices. They should be explicit protocol decisions:

1. **Primary design:** recommended 3-week individually randomized delay; alternative 8-week parallel control gives a cleaner total-effect estimate but withholds access longer.
2. **Delay length:** recommend 3 weeks; 2 is easier ethically but gives only two concurrent measures; 4 improves information but increases contamination/attrition risk.
3. **Score claim:** either obtain external item parameters and defend linked JEE-equivalent marks, or rename the numerator “linked holdout points” and avoid a 0–300 claim.
4. **Assessment burden:** recommend 15-item weekly forms plus 30-item baseline/endline; choose a larger bank/form only if reliability simulations justify the burden.
5. **Baseline replication:** a second short baseline improves noise and regression-to-mean assessment but adds burden before treatment.
6. **Active-time idle cap:** recommend 5 minutes with 2/10-minute sensitivity; passive video/reading rules must be product-specific.
7. **Contamination unit:** individual randomization is the default; connected-group randomization should be chosen only if sharing risk outweighs the major loss of independent units.
8. **Primary feasibility gates:** confirm the proposed 85% retention, 90% assessment/telemetry, and under-10% contamination thresholds before recruitment.
9. **Use incentives:** pay for independent assessment completion, not hours or score gains; decide amount through local ethics review.
10. **Analysis access:** decide whether an independent analyst can receive blinded arm labels until code and exclusions are frozen.
11. **Pilot claim language:** decide now whether public reporting will call this a feasibility randomized pilot, not an efficacy trial.
12. **Future causal efficiency:** if causal marks-per-hour is strategically essential, plan a larger randomized dosage/encouragement trial; this pilot cannot resolve it.

## Source key

Detailed citations, legal full-text locations, reading status, and exact supporting sections are in `sources.md`.

- [S01] Eldridge et al., CONSORT pilot/feasibility extension.
- [S02] Hemming et al., stepped-wedge CONSORT extension.
- [S03] Spineli et al., delayed-start critical appraisal.
- [S04] Ryan and Brockmann, practitioner introduction to equating.
- [S05] Kim, small-sample equating/linking.
- [S06] Hausknecht et al., practice-effects meta-analysis.
- [S07] Magill et al., contamination scoping review.
- [S08] National Research Council, missing data.
- [S09] IES, power analysis in education research.
- [S10] Maslennikova et al., session time windows.
- [S11] Pelánek, student-model evaluation metrics.
- [S12] OPRE, subgroup analysis.
- [S13] Debeer et al., learning efficiency.
- [S14] 3ie, power calculations.
- [S15] Van Calster et al., calibration hierarchy.
- [S16] BERA, ethical guidelines.
- [S17] ICMR, ethics involving children.
- [S18] Hart et al., self-reported time on task.

