# Evidence ledger

## Scope and reading method

This ledger supports `synthesis.md`. Sources were limited to open-access publisher copies, government/institutional repositories, author manuscripts, ERIC, PMC, or other lawful public copies. No shadow-library source was used.

The `papers\` directory contains 16 valid PDFs and two PMC HTML full texts. File signatures were checked; failed downloads and challenge/error pages were removed. The National Academies report is authoritative, but no complete offline copy is included; use the DOI/online chapter reader for that report.

### End-to-end reading requirement

The following eight full texts were read end to end:

1. Hausknecht et al. — practice-effects meta-analysis (`07-...pdf`)
2. Pelánek — student-model metrics (`11-...pdf`)
3. Debeer et al. — learning efficiency (`12-...pdf`)
4. Maslennikova et al. — session/time-window identification (`14-...pdf`)
5. BERA — ethical guidelines (`15-...pdf`)
6. Breck & Wakar/OPRE — subgroup analysis (`16-...pdf`)
7. Djimeu & Houndolo/3ie — power and MDE (`18-...pdf`)
8. Hart et al. — time-on-task estimation (`21-...pdf`)

The remaining core sources were read by complete relevant chapters/sections and checklist items. This distinction avoids implying that every long handbook or book was read cover to cover.

## Core methodological sources

### S01 — Pilot and feasibility trials

**Citation:** Eldridge SM, Chan CL, Campbell MJ, et al. “CONSORT 2010 statement: extension to randomised pilot and feasibility trials.” *BMJ*. 2016;355:i5239.

- DOI: https://doi.org/10.1136/bmj.i5239
- Open full text: https://www.bmj.com/content/355/bmj.i5239
- Local legal copy: `papers\01-eldridge-2016-consort-pilot-feasibility.pdf`
- Reading scope: complete checklist, methodological considerations, explanation/elaboration, and examples.
- Exact supporting sections:
  - **“Adapting the CONSORT statement for pilot trials”** — defines the scope of the extension.
  - **Box 1, “Methodological considerations and principles for pilot trials”** — feasibility purpose and interpretation.
  - **Table 2, Items 2a/2b and 6a/6c** — identify the study as a pilot and state specific feasibility objectives/outcomes.
  - **Table 2, Item 7a** and explanation — rationale for pilot sample size, not a definitive-effect calculation by default.
  - **Table 2, Item 14a** — criteria used to judge whether/how to proceed.
  - **Table 2, Items 20a–22** — limitations, generalisability, and interpretation consistent with pilot objectives.
  - **Table 2, Items 23–26** — registration, protocol, funding, and ethics/research-review information.
- Applied claim: define explicit feasibility objectives and progression criteria; do not treat a small pilot’s efficacy \(p\)-value as definitive.

### S02 — Stepped-wedge cluster randomized trials

**Citation:** Hemming K, Taljaard M, McKenzie JE, et al. “Reporting of stepped wedge cluster randomised trials: extension of the CONSORT 2010 statement with explanation and elaboration.” *BMJ*. 2018;363:k1614.

- DOI: https://doi.org/10.1136/bmj.k1614
- Open full text: https://www.bmj.com/content/363/bmj.k1614
- Local lawful author manuscript: `papers\03-hemming-2018-consort-stepped-wedge.pdf`
- Reading scope: design rationale, methodological considerations, checklist, and analysis/reporting explanations.
- Exact supporting sections:
  - **“What is a stepped wedge cluster randomised trial?”** — cluster sequences and staged crossover.
  - **“Key methodological considerations”** — secular trends, within-cluster dependence, treatment-effect changes over time, and recruitment/identification bias.
  - **Table 2, Item 3a** — identify the design and unit of randomization.
  - **Items 7a/7b** — sample-size assumptions including clusters, cluster size, ICC, and time structure.
  - **Items 8a–10** — sequence generation, concealment, and implementation.
  - **Item 12a** — analysis accounting for time and clustering.
  - **Items 20a/20b** — design-specific limitations and interpretation.
- Applied claim: a small set of individually enrolled students is not a defensible cluster stepped-wedge trial; a staged rollout must still model calendar time and treatment history.

### S03 — Delayed-start designs

**Citation:** Spineli LM, Jenz E, Großhennig A, Koch A. “Critical appraisal of arguments for the delayed-start design proposed as alternative to the parallel-group randomized clinical trial design in the field of rare disease.” *Orphanet Journal of Rare Diseases*. 2017;12:140.

- DOI: https://doi.org/10.1186/s13023-017-0692-3
- Open full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC5559817/
- Local legal HTML full text: `papers\04-spineli-2017-delayed-start-critical-appraisal.html`
- Reading scope: complete conceptual framework, assumptions, limitations, and examples.
- Exact supporting sections:
  - **“Background”** — rationale for a delayed-start comparison.
  - **“Results — Description of the delayed start design”** — randomized placebo-controlled phase followed by treatment in both groups.
  - **“Examples — Suitability of the delayed start design”** and **“Treatment-effect development over time”** — assumptions required for interpretation.
  - **“Discussion”** and **“Conclusions”** — operational, sample-size, and interpretive limitations.
- Applied claim: pre-crossover is a concurrent randomized comparison; after crossover, persistent group differences estimate assignment to treatment sequence/earlier access, not a simple current-treatment effect.
- Transfer caution: this is medical-trial literature. Its timing and estimand logic transfers; disease-modification claims do not.

### S04 — Repeated forms, linking, and equating

**Citation:** Ryan J, Brockmann F. *A Practitioner’s Introduction to Equating with Primers on Classical Test Theory and Item Response Theory*. CCSSO/TILSA, 2009.

- DOI: none.
- Institutional full text: https://files.eric.ed.gov/fulltext/ED544690.pdf
- ERIC record: https://eric.ed.gov/?id=ED544690
- Local legal copy: `papers\05-ryan-brockmann-2009-practitioner-equating.pdf`
- Reading scope: Chapters 1–5, emphasizing design, anchors, IRT, common-item linking, and quality control.
- Exact supporting sections:
  - **Chapter 1, “An Overview of Assessment, Linking, and Equating Concepts”** — distinguishes linking from stronger equating claims.
  - **Chapter 2, “Basic IRT Models”** and **“Parameter Invariance and Scale Indeterminacy”** — item parameters and scale identification.
  - **Chapter 3, “Basic Terms, Concepts, and Designs for Equating”** — equivalent groups, single-group counterbalancing, and anchor-test designs.
  - **Chapter 3, “Anchor Selection”** and **“Rules of Thumb”** — representativeness and quality of anchors.
  - **Chapter 4, “Equating through Common Items”**, **“Concurrent or Simultaneous Calibration,”** and **“Pre-Equating and Post-Equating.”**
  - **Chapter 5, “Changes in Test Specifications,” “Anchor Item Issues,” “Inferences Drawn from Equating,” and “Quality Control Issues.”**
- Applied claim: form equivalence is an empirical measurement claim, not a content-team label; anchors, specifications, administration, and documentation matter.

### S05 — Small-sample linking

**Citation:** Kim S, von Davier AA, Haberman S. “An Alternative to Equating With Small Samples in the Non-Equivalent Groups Anchor Test Design.” ETS Research Report RR-06-27, 2006.

- DOI: https://doi.org/10.1002/j.2333-8504.2006.tb02033.x
- Institutional full text: https://files.eric.ed.gov/fulltext/EJ1111469.pdf
- Local legal copy: `papers\06-kim-2006-small-sample-linking.pdf`
- Reading scope: introduction, both studies, discussion, limitations, and appendix.
- Exact supporting sections:
  - **“Small-Sample Equating”** — sampling-error problem.
  - **“Identity Function Versus the Weighted Function”** — shrinkage/weighting logic.
  - **“The Major Purpose of This Study”** — bias and sampling-error targets.
  - **“Study 1” and “Study 2”** — external versus internal anchor settings.
  - **“Discussion”** — when synthetic/identity information can outperform noisy conventional estimates.
  - **“Limitations and Future Research”** — limits to generalization.
- Applied claim: estimating a new weekly IRT/equating system from 24–36 students is too unstable; use external calibration or make a weaker linked/raw-score claim.

### S06 — Practice effects

**Citation:** Hausknecht JP, Halpert JA, Di Paolo NT, Moriarty Gerrard MO. “Retesting in selection: a meta-analysis of coaching and practice effects for tests of cognitive ability.” *Journal of Applied Psychology*. 2007;92(2):373–385.

- DOI: https://doi.org/10.1037/0021-9010.92.2.373
- Lawful author manuscript: https://ecommons.cornell.edu/server/api/core/bitstreams/4fbba765-0d9c-4940-8492-66fecaca5227/content
- Repository record: https://hdl.handle.net/1813/75249
- Local legal copy: `papers\07-hausknecht-2007-practice-effects-meta-analysis.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **“Effect of Retesting on Subsequent Test Performance”** — evidence that scores change with repetition.
  - **“Explanations for Practice Effects”** — repetition, coaching, instruction, and related mechanisms.
  - **“Study Context,” “Test Form,” “Cognitive Ability Dimension,” and “Regression to the Mean”** — moderators and alternative explanations.
  - **“Method” / “Meta-Analytic Procedure.”**
  - **“Overall Practice Effects” and “Moderators.”**
  - **“Discussion,” “Summary and Implications,” “Limitations,” and “Conclusion.”**
- Applied claim: repeated assessment alone can raise scores; concurrent same-schedule controls, fresh forms, and form/week effects are required.
- Transfer caution: the tests were cognitive/selection instruments, not JEE forms; direction and mechanisms are more transferable than the exact effect size.

### S07 — Treatment contamination

**Citation:** Magill N, Knight R, McCrone P, Ismail K, Landau S. “A scoping review of the problems and solutions associated with contamination in trials of complex interventions in mental health.” *BMC Medical Research Methodology*. 2019;19:4.

- DOI: https://doi.org/10.1186/s12874-018-0646-z
- Open full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC6323722/
- Local legal HTML full text: `papers\08-magill-2019-contamination-scoping-review.html`
- Reading scope: complete review.
- Exact supporting sections:
  - **“Background”** — contamination as control participants receiving intervention components.
  - **“Methods”** — review scope and extraction.
  - **“Results,” especially identified contamination processes and design/analysis responses.**
  - **“Discussion”** — trade-offs among individual randomization, cluster randomization, contamination measurement, and interpretation.
  - **“Conclusions”** — need to anticipate and report contamination.
- Applied claim: measure cross-arm access and sharing prospectively; retain participants in ITT; recognize the power cost of cluster-level prevention.
- Transfer caution: intervention setting is mental health, but the interference and design principles are general.

### S08 — Missing data

**Citation:** National Research Council. *The Prevention and Treatment of Missing Data in Clinical Trials*. Washington, DC: National Academies Press; 2010.

- DOI: https://doi.org/10.17226/12955
- Government/institutional online book: https://nap.nationalacademies.org/catalog/12955/the-prevention-and-treatment-of-missing-data-in-clinical-trials
- Local copy: not included; the NAP DOI reader is the authoritative lawful full text.
- Reading scope: executive summary and complete Chapters 2, 4, 5, and 6.
- Exact supporting sections:
  - **Chapter 2, “Trial Design Considerations”** — prevention and continued outcome collection.
  - **Chapter 4, “Drawing Inferences from Incomplete Data”** — estimand and assumptions.
  - **Chapter 5, “Methods for Analysis of Incomplete Data”** — likelihood, imputation, weighting, and model assumptions.
  - **Chapter 6, “Single Imputation Methods” and sensitivity-analysis recommendations** — why simplistic single imputation is inadequate and why unverifiable assumptions need sensitivity analysis.
  - **Recommendations 2, 3, 4, 9, 15, and 18** — prevention, follow-up, analysis plan, and sensitivity reporting.
- Applied claim: prevent missingness, collect outcomes after discontinuation, never convert missing outcomes to zero, and show sensitivity to assumptions.
- Transfer caution: clinical-trial examples are not educational, but estimand and missing-data principles are general.

### S09 — Education power analysis

**Citation:** Hedges LV, Rhoads C. *Statistical Power Analysis in Education Research*. NCSER 2010-3006. U.S. Department of Education, 2010; current IES-hosted copy.

- DOI: none listed.
- Government full text: https://ies.ed.gov/sites/default/files/ies/document/2024/10/Power%20Analysis%20in%20Education%20Research.pdf
- Local legal copy: `papers\10-ies-2024-power-analysis-education.pdf`
- Filename note: 2024 is the IES file-hosting path/update; the report itself is dated April 2010.
- Reading scope: abstract, design framework, individual/blocked/cluster designs, design effects, covariate adjustment, and examples.
- Exact supporting sections:
  - **“Statistical Power in Simple Experimental Designs.”**
  - **“Operational Effect Sizes and Design Effects.”**
  - **Sections on hierarchical and randomized-block designs.**
  - **Sections deriving dependence on ICC, number of clusters, cluster size, covariate multiple correlation, and treatment-effect heterogeneity.**
  - **Worked education-design examples.**
- Applied claim: power assumptions must reflect the actual randomization level, baseline correlation, clustering, attrition, and treatment-effect variability.

### S10 — Active-time sessionization

**Citation:** Maslennikova A, Rotelli D, Monreale A. “Session-Based Time-Window Identification in Virtual Learning Environments.” *Journal of Learning Analytics*. 2023;10(3):7–27.

- DOI: https://doi.org/10.18608/jla.2023.7911
- Open full text: https://files.eric.ed.gov/fulltext/EJ1411406.pdf
- Local legal copy: `papers\14-maslennikova-2023-session-time-windows.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **Abstract and “Notes for Research”** — arbitrary timeout thresholds versus data-driven session definitions.
  - **Section 1, “Introduction.”**
  - **Section 2, related work on sessions, time-on-task, and inactivity.**
  - **Sections defining session types and the inactivity/off-task algorithm.**
  - **Evaluation/use-case sections for choosing time windows.**
  - **Discussion, limitations, and conclusion.**
- Applied claim: no universal timeout is automatically valid; freeze a transparent primary rule and run threshold sensitivity analyses.

### S11 — Student-model evaluation metrics

**Citation:** Pelánek R. “Metrics for Evaluation of Student Models.” *Journal of Educational Data Mining*. 2015;7(2):1–19.

- DOI: none listed in the paper.
- Open full text: https://files.eric.ed.gov/fulltext/EJ1115277.pdf
- Local legal copy: `papers\11-pelanek-2015-student-model-metrics.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **Section 1, “Introduction”** — metric choice can change conclusions.
  - **Sections on answer-based metrics, likelihood/error metrics, and AUC.**
  - **Section 5.1, Brier score decomposition/calibration concepts.**
  - **Empirical comparison of metrics.**
  - **Discussion/recommendations** — criticism of MAE and cautious use of AUC.
- Applied claim: report probability accuracy/calibration as well as ranking; do not use AUC alone.

### S12 — Heterogeneous effects and subgroup analysis

**Citation:** Breck A, Wakar B. *Methods, Challenges, and Best Practices for Conducting Subgroup Analysis*. OPRE Report 2021-17. U.S. Administration for Children and Families, 2021.

- DOI: none.
- Government full text: https://acf.gov/sites/default/files/documents/opre/methods-challenges-best-practices-jan-2021.pdf
- Local legal copy: `papers\16-opre-2021-heterogeneous-effects.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **“Part I: Designing a Subgroup Analysis”** — theory, prespecification, subgroup definition, sample size, and statistical power.
  - **Sections on multiple comparisons and interaction tests.**
  - **“Part II: Implementing a Subgroup Analysis.”**
  - **“Part III: Presenting and Interpreting Subgroup Analysis Results.”**
  - **Best-practice checklists and worked examples.**
- Applied claim: use a formal interaction, not “significant here/not significant there”; pre-specify few moderators; treat tiny subgroups as exploratory.

### S13 — Learning-efficiency metrics

**Citation:** Debeer D, Vanbecelaere S, Van den Noortgate W, Reynvoet B, Depaepe F. “The effect of adaptivity in digital learning technologies: Modelling learning efficiency using data from an educational game.” *Journal of Computer Assisted Learning*. 2021.

- DOI: https://doi.org/10.1111/jcal.12473
- Lawful institutional manuscript: https://lirias.kuleuven.be/retrieve/6dacb562-59e3-4a48-b5f6-4d4d643b15d1
- Repository record: https://lirias.kuleuven.be/
- Local legal copy: `papers\12-debeer-2021-learning-efficiency.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **“Structured practitioner notes”** — distinction between effectiveness and efficiency.
  - **Theory section defining learning efficiency.**
  - **Methods/modeling section using progress over logged learning time.**
  - **Results comparing adaptive and non-adaptive conditions.**
  - **Discussion, limitations, and implications.**
- Applied claim: preserve learning gain and learning time as separate displayed quantities even when presenting an efficiency summary.
- Transfer caution: the modeled game context differs from high-stakes JEE preparation.

### S14 — MDE and sample-size calculations

**Citation:** Djimeu EW, Houndolo D-G. *Power Calculation for Causal Inference in Social Science: Sample Size and Minimum Detectable Effect Determination*. 3ie Working Paper 26, 2016.

- DOI: none listed.
- Institutional full text: https://www.3ieimpact.org/sites/default/files/2019-01/wp26-power-calculation.pdf
- Local legal copy: `papers\18-3ie-2016-power-mde-manual.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **Section 2, statistical power, Type I/II error, effect size, and MDE.**
  - **Sections for simple individual randomization.**
  - **Sections for stratified/block randomization and covariate adjustment.**
  - **Sections for cluster randomization and ICC/design effects.**
  - **Sections on noncompliance, attrition, take-up, and sensitivity assumptions.**
  - **Worked examples and appendices.**
- Applied claim: report scenario-based MDEs and their assumptions; a very small trial cannot rule out policy-relevant modest effects.

### S15 — Calibration of prediction models

**Citation:** Van Calster B, McLernon DJ, van Smeden M, Wynants L, Steyerberg EW. “Calibration: the Achilles heel of predictive analytics.” *BMC Medicine*. 2019;17:230.

- DOI: https://doi.org/10.1186/s12916-019-1466-7
- Open full text: https://pmc.ncbi.nlm.nih.gov/articles/PMC6878326/
- Local legal PDF: `papers\19-van-calster-2019-calibration-hierarchy.pdf`
- Reading scope: complete article.
- Exact supporting sections:
  - **“Background”** — calibration versus discrimination.
  - **“Discrimination is important, but are the risk estimates reliable?”**
  - **“How to assess calibration?”** — mean/calibration-in-the-large, weak, moderate, and strong calibration; intercept, slope, flexible curves, and limits of the Hosmer–Lemeshow test.
  - **“How to prevent or correct poor calibration?”**
  - **Conclusion.**
- Applied claim: report calibration intercept, slope, and curve with uncertainty; a good AUC does not establish accurate probabilities.
- Transfer caution: examples are clinical prediction; calibration mathematics transfers directly to mastery probabilities.

### S16 — Ethics in educational research

**Citation:** British Educational Research Association. *Ethical Guidelines for Educational Research*. 5th ed. London: BERA; 2024.

- DOI: none.
- Publisher page: https://www.bera.ac.uk/publication/ethical-guidelines-for-educational-research-fifth-edition-2024
- Open full text used: https://d213hxn09aifwh.cloudfront.net/files/Assessment-Regulations/HE_Ethical-Guidelines-for-Educational-Research-5th-edition.pdf
- Local legal copy: `papers\15-bera-2024-ethical-guidelines.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **“Responsibilities to Participants.”**
  - **“Consent.”**
  - **“Transparency.”**
  - **Sections on children, vulnerable participants, incentives, right to withdraw, and avoiding harm.**
  - **“Privacy and Data Storage.”**
  - **“Responsibilities for Publication and Dissemination.”**
  - **“Responsibilities to Sponsors, Clients and Stakeholders.”**
- Applied claim: voluntary consent/assent, understandable information, withdrawal, proportional incentives, privacy, and conflict transparency are protocol requirements.

### S17 — Indian guidance for research involving children

**Citation:** Indian Council of Medical Research. *National Ethical Guidelines for Bio-Medical Research Involving Children*. New Delhi: ICMR; 2017.

- DOI: none.
- ICMR ethics portal: https://ethics.ncdirindia.org/ICMR_Ethical_Guidelines.aspx
- Lawful institutional mirror used: https://aiimsraipur.edu.in/upload/research/ethics_committee/National_Ethical_Guidelines_for_BioMedical_Research_Involving_Children%20(2017).pdf
- Local legal copy: `papers\20-icmr-2017-ethics-children.pdf`
- Reading scope: general principles and complete sections on permission, assent, risk, privacy, and review.
- Exact supporting sections:
  - **“General Principles.”**
  - **Sections on parental/legally acceptable representative permission.**
  - **“Assent” and age/development-appropriate information.**
  - **Risk categories and risk minimization.**
  - **Privacy and confidentiality.**
  - **Compensation, inducement, and research-related harm.**
  - **Role of the Ethics Committee.**
- Applied claim: because the cohort may include minors, obtain guardian permission and child assent, minimize risk/data, and secure local ethics/legal determination.
- Scope caution: the document governs biomedical research involving children. This pilot is educational/behavioral, so local applicability must be determined rather than assumed.

### S18 — Long-duration time-on-task estimation

**Citation:** Hart K, Warren CM, Edwards J. “Time-on-task estimation for tasks lasting hours spread over multiple days.” *PLOS ONE*. 2025;20(9):e0330758.

- DOI: https://doi.org/10.1371/journal.pone.0330758
- Open full text: https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0330758
- Local legal copy: `papers\21-hart-2025-self-reported-time-on-task.pdf`
- Reading status: **read end to end**.
- Exact supporting sections:
  - **Introduction** — why time on long, distributed tasks is hard to estimate.
  - **Methods, task/log construction and time-on-task estimators.**
  - **Comparison with self-reported time.**
  - **Results on estimator behavior.**
  - **Discussion and limitations.**
- Applied claim: self-reported external-study time is contextual and error-prone; product time should be event-derived, with diaries used as a separate measure.
- Transfer caution: the task is programming, not exam preparation.

## Additional authoritative contextual sources

### A01 — Evidence base for education technology

**Citation:** Escueta M, Quan V, Nickow AJ, Oreopoulos P. “Education Technology: An Evidence-Based Review.” NBER Working Paper 23744, 2017; subsequently *Journal of Economic Literature*.

- NBER DOI: https://doi.org/10.3386/w23744
- Lawful J-PAL-hosted manuscript: https://www.povertyactionlab.org/sites/default/files/research-paper/NBER-23744-EdTech-Review.pdf
- Local legal copy: `papers\17-escueta-2017-edtech-evidence-review.pdf`
- Exact supporting sections:
  - **Introduction and evaluation framework.**
  - **Computer-assisted learning evidence.**
  - **Behavioral interventions and implementation.**
  - **Discussion/conclusion on heterogeneity and evidence gaps.**
- Use: broader context that engagement and access do not substitute for independent learning outcomes and implementation conditions matter.

## Download inventory

Valid offline files:

- `papers\01-eldridge-2016-consort-pilot-feasibility.pdf`
- `papers\03-hemming-2018-consort-stepped-wedge.pdf`
- `papers\04-spineli-2017-delayed-start-critical-appraisal.html`
- `papers\05-ryan-brockmann-2009-practitioner-equating.pdf`
- `papers\06-kim-2006-small-sample-linking.pdf`
- `papers\07-hausknecht-2007-practice-effects-meta-analysis.pdf`
- `papers\08-magill-2019-contamination-scoping-review.html`
- `papers\10-ies-2024-power-analysis-education.pdf`
- `papers\11-pelanek-2015-student-model-metrics.pdf`
- `papers\12-debeer-2021-learning-efficiency.pdf`
- `papers\14-maslennikova-2023-session-time-windows.pdf`
- `papers\15-bera-2024-ethical-guidelines.pdf`
- `papers\16-opre-2021-heterogeneous-effects.pdf`
- `papers\17-escueta-2017-edtech-evidence-review.pdf`
- `papers\18-3ie-2016-power-mde-manual.pdf`
- `papers\19-van-calster-2019-calibration-hierarchy.pdf`
- `papers\20-icmr-2017-ethics-children.pdf`
- `papers\21-hart-2025-self-reported-time-on-task.pdf`

## Practitioner discussions — anecdotal/operational, not causal evidence

These sources were reviewed for implementation patterns. They are not used as proof that the patterns improve learning.

### P01 — ASSISTments E-TRIALS

- URL: https://www.assistments.org/e-trials
- Relevant page sections: description of small-scale randomized trials, automatic online delivery, and packaged learning/clickstream data.
- Practitioner takeaway: assignment, content condition, and event logging can be integrated into an education platform; de-identification and independent research workflow should be designed up front.
- Evidence limitation: platform description and selected examples; not a methodological standard and not evidence for this pilot’s expected effect.

### P02 — E-TRIALS support-comparison workflow

- URL: https://www.etrialstestbed.org/run-a-study/develop/support-comparison-study
- Relevant page sections: auto-deployment, student random assignment, hint/explanation conditions, and clickstream retrieval.
- Practitioner takeaway: pre-build conditions, automate assignment, and separate intervention content from outcome analysis.
- Evidence limitation: operating documentation for a specific platform.

### P03 — Subject session logs

- URL: https://support.subject.com/en/articles/12478107-time-tracking-session-logs
- Relevant page sections: definitions of **Active Time**, **Review Time**, **Idle Time**, 15-minute “Are you still here?” prompt, one-hour logout, and session buckets.
- Practitioner takeaway: products often expose separate active/idle/review time and use explicit inactivity prompts.
- Evidence limitation: vendor documentation provides no validation that its 15-minute threshold estimates learning time accurately. It motivated sensitivity analysis, not the proposed 5-minute cap.

### P04 — GrowthBook experimentation guide

- URL: https://www.growthbook.io/blog/what-is-a-b-testing
- Relevant page sections: primary, secondary, and guardrail metrics; edtech privacy/ethical cautions; stop conditions for user harm.
- Practitioner takeaway: freeze one decision metric and a small number of guardrails before launch.
- Evidence limitation: general experimentation vendor guidance, not peer-reviewed educational methodology.

### P05 — Harvest student time tracking

- URL: https://www.getharvest.com/time-tracking/time-tracking-for-students
- Relevant page sections: manual timer, task categories, reporting, reminders, and time-blocking.
- Practitioner takeaway: diaries should offer category structure and reminders; students may find retrospective allocation useful.
- Evidence limitation: marketing material; claims of improved outcomes are not accepted as evidence. Manual tracking is treated as a noisy external-study measure.

### P06 — Chrome idle API documentation

- URL: https://developer.chrome.com/docs/extensions/mv2/reference/idle
- Relevant page sections: `queryState`, `setDetectionInterval`, and `onStateChanged`.
- Practitioner takeaway: device idle state can supplement app focus/visibility events if permission and privacy review allow.
- Evidence limitation: technical API behavior, not a measure of cognitive engagement. System-wide idle permission may be disproportionate for this pilot and is not required by the recommended protocol.

## Citation and interpretation cautions

1. Clinical-trial reports inform randomization, missing data, contamination, and delayed-start estimands; their substantive disease claims do not transfer to education.
2. Practice-effect estimates from employment/cognitive tests should not be inserted numerically into JEE power calculations without JEE-specific validation.
3. Small-sample linking literature shows risk; it does not make 24–36 students adequate for fresh IRT calibration.
4. Time-on-task is an operational construct. Interaction events, self-reports, and cognitive engagement are not interchangeable.
5. The proposed MDEs in `synthesis.md` are transparent normal approximations, not outputs reported by any cited source.
6. “JEE marks” should be used only if the holdout scale is defensibly linked. Otherwise use “linked holdout points.”
7. Ethical sources do not replace local legal advice or a formal ethics determination.

