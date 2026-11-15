# Sources: multimodal diagnosis of handwritten mathematical work

Research completed 2026-07-18. This bibliography distinguishes downloaded primary literature, benchmark/data documentation, and public anecdotes. All downloaded papers came from arXiv, ACL Anthology, PMLR, an author-hosted copy, TQMP, or J-STAGE. No shadow-library source was used.

## Reading method and corpus

The review read 12 papers end to end (including appendices where present) and consulted another 6 downloaded papers for targeted sections. “End to end” below means the complete locally downloaded full text was read, not merely the abstract or search snippet.

### End-to-end full-text papers

1. Gervais, P., Fadeeva, A., & Maksai, A. (2025; arXiv versions 2024–2025). “MathWriting: A Dataset for Handwritten Mathematical Expression Recognition.” DOI: https://doi.org/10.1145/3711896.3737436. Open author preprint: https://arxiv.org/abs/2404.10690. Local: `papers/gervais-2024-mathwriting.pdf`. Read: pp. 1–17, including dataset construction, normalization, experiments, limitations, and appendices. Key locations: pp. 1–2 (2-D structure and dataset license), pp. 3–6 (splits, metrics, baselines), pp. 6–7 (ambiguity and document limitation), pp. 9–12 (noise and label issues).

2. Caraeni, A., Scarlatos, A., & Lan, A. (2025). “Evaluating GPT-4 at Grading Handwritten Solutions in Math Exams.” LAK 2025. Open preprint: https://arxiv.org/abs/2411.05231. Local: `papers/caraeni-2025-gpt4-handwritten-grading.pdf`. Read: pp. 1–3. Key locations: p. 2, Tables 1–2 (rubric/reference effects and question-level variance); pp. 2–3 (handwriting, long-solution, reasoning, and rubric failures).

3. Levine, J., Aenlle, M., Zilles, C., West, M., & Silva, M. (2026). “Automated Grading of Handwritten Mathematics Using Vision-Capable LLMs.” AIED 2026 author copy: https://zilles.cs.illinois.edu/papers/Levine_Automated_Grading_of_Handwritten_Mathematics_Using_Vision_Capable_LLMs_AIED_2026.pdf. Local: `papers/levine-2026-automated-handwritten-grading.pdf`. Read: pp. 1–9. Key locations: pp. 3–5 (authentic course data and rubric-item metrics), pp. 5–7/Table 1 (error breakdown), pp. 6–7 (blur, rotation, hallucinated correct text, equivalent-expression failures).

4. Tito, R., Karatzas, D., & Valveny, E. (2023). “Hierarchical Multimodal Transformers for Multi-Page DocVQA.” arXiv: https://arxiv.org/abs/2212.05935. Local: `papers/tito-2023-multipage-docvqa.pdf`. Read: pp. 1–14. Key locations: pp. 1–3 (multi-page challenge and MP-DocVQA construction), pp. 5–8/Tables 2–3 (answer and answer-page metrics), pp. 7–8/Figure 5 (correct answers with wrong evidence page), pp. 10–14 (construction and page-position analyses).

5. Guo, C., Pleiss, G., Sun, Y., & Weinberger, K. Q. (2017). “On Calibration of Modern Neural Networks.” ICML/PMLR 70. Full text: https://proceedings.mlr.press/v70/guo17a.html. Local: `papers/guo-2017-calibration.pdf`. Read: pp. 1–10. Key locations: pp. 1–3 (miscalibration, reliability diagrams, ECE/MCE), pp. 4–7 (held-out calibration and temperature scaling), pp. 7–8 (results and limits).

6. Geifman, Y., & El-Yaniv, R. (2019). “SelectiveNet: A Deep Neural Network with an Integrated Reject Option.” ICML/PMLR 97. Full text: https://proceedings.mlr.press/v97/geifman19a.html. Local: `papers/geifman-2019-selectivenet.pdf`. Read: pp. 1–9. Key locations: pp. 1–3 (risk, coverage, reject option), pp. 3–6 (coverage calibration and experiments), pp. 6–8 (risk–coverage results).

7. Wang, Q., Geng, T., Wang, Z., Wang, T., Fu, B., & Zheng, F. (2025). “Sample Then Identify: A General Framework for Risk Control and Assessment in Multimodal Large Language Models.” ICLR 2025. OpenReview/arXiv: https://arxiv.org/abs/2410.08174. Local: `papers/wang-2025-sample-then-identify.pdf`. Read: pp. 1–18. Key locations: pp. 1–4 (TRON and black-box conformal construction), pp. 5–9 (risk-control results and marginal-vs-conditional caveat), pp. 12–18 (assumptions, proofs, generalization).

8. Li, Y., Du, Y., Zhou, K., Wang, J., Zhao, W. X., & Wen, J. R. (2023). “Evaluating Object Hallucination in Large Vision-Language Models.” EMNLP 2023. DOI: https://doi.org/10.18653/v1/2023.emnlp-main.20. Open preprint: https://arxiv.org/abs/2305.10355. Local: `papers/li-2023-pope-hallucination.pdf`. Read: pp. 1–14. Key locations: pp. 1–3 (hallucination framing), pp. 4–6 (instruction and co-occurrence effects), pp. 7–10 (POPE, yes-bias, metrics), pp. 10–11 (limitations).

9. Hallgren, K. A. (2012). “Computing Inter-Rater Reliability for Observational Data: An Overview and Tutorial.” *Tutorials in Quantitative Methods for Psychology*, 8(1), 23–34. DOI: https://doi.org/10.20982/tqmp.08.1.p023. Full text: https://tqmp.org/RegularArticles/vol08-1/p023/p023.pdf. Local: `papers/hallgren-2012-interrater-reliability.pdf`. Read: pp. 23–34. Key locations: pp. 24–26 (design and common mistakes), pp. 27–29 (kappa variants and prevalence/bias), pp. 29–32 (ICC choice), pp. 32–34 (reporting).

10. Hallgren, K. A. (2013). Erratum to Hallgren (2012). DOI: https://doi.org/10.20982/tqmp.09.2.p095. Full text: https://www.tqmp.org/RegularArticles/vol09-2/p095/p095.pdf. Local: `papers/hallgren-2013-erratum.pdf`. Read: p. 95. Important correction: SPSS 17 computed Cohen’s original kappa, not the Siegel–Castellan variant; the unmaintained R `concord` implementation should not be used.

11. Watari, T., Koyama, S., Kato, Y., Paku, Y., Kanada, Y., & Sakurai, H. (2022). “Effect of Moderation on Rubric Criteria for Inter-Rater Reliability in an Objective Structured Clinical Examination with Real Patients.” *Fujita Medical Journal*, 8(3), 83–87. DOI: https://doi.org/10.20407/fmj.2021-010. Full text: https://www.jstage.jst.go.jp/article/fmj/8/3/8_2021-010/_article/-char/en. Local: `papers/yamada-2022-rubric-moderation.pdf` (filename retained although first author is Watari). Read: pp. 83–87. Key locations: pp. 83–84 (design), pp. 84–86 (moderation procedure and kappa 0.49→0.82), pp. 86–87 (limitations).

12. Riahi, B., Storozhevykh, V., & Cateté, V. (2026). “Humanizing AI Grading: Student-Centered Insights on Fairness, Trust, Consistency and Transparency.” Open preprint: https://arxiv.org/abs/2602.07754. Local: `papers/saxena-2026-humanizing-ai-grading.pdf` (filename retained from an early metadata mismatch; actual authors are Riahi et al.). Read: pp. 1–13. Key locations: pp. 3–4 (IRB/consent and method), pp. 4–7 (n=27 results and themes), p. 8 (limitations).

### Downloaded papers consulted in targeted depth

13. Nath, O., Bathina, H., Khan, M. S. U. R., & Khapra, M. M. (2025). “Can Vision-Language Models Evaluate Handwritten Math?” ACL 2025, pp. 14784–14814. DOI: https://doi.org/10.18653/v1/2025.acl-long.720. Full text: https://aclanthology.org/2025.acl-long.720.pdf. Local: `papers/nath-2025-fermat.pdf`. Read in depth: main paper pp. 14784–14792 and targeted appendices on prompts/annotation. Key locations: pp. 14785–14787 (2,244 samples and perturbation taxonomy), pp. 14787–14790 (tasks/metrics/results), pp. 14790–14792 (handwriting ablation and limitations).

14. Yan, Y. et al. (2026; initial preprint 2024). “ErrorRadar: Benchmarking Complex Mathematical Reasoning of Multimodal Large Language Models Via Error Detection.” Findings of ACL 2026, pp. 24297–24334. Full text: https://aclanthology.org/2026.findings-acl.1217.pdf. Local: `papers/yan-2026-errorradar.pdf`. Read in depth: main paper pp. 24297–24304 and targeted annotation/benchmark appendices. Key locations: pp. 24298–24300 (first-error and category tasks), pp. 24300–24301 (expert cross-checking), pp. 24301–24304 (model/human results and limits).

15. Song, D. et al. (2026). “Can MLLMs Read Students’ Minds? Unpacking Multimodal Error Analysis in Handwritten Math.” Open preprint: https://arxiv.org/abs/2603.24961. Local: `papers/song-2026-scratchmath.pdf`. Read: pp. 1–15. Key locations: pp. 4–7 (taxonomy and annotation), pp. 8–12 (model results/failure analysis), pp. 12–13 (generality limits).

16. Sun, W. et al. (2026). “EDU-CIRCUIT-HW: Evaluating Multimodal Large Language Models on Real-World University-Level STEM Student Handwritten Solutions.” Findings of ACL 2026, pp. 15281–15314. Full text: https://aclanthology.org/2026.findings-acl.751.pdf. Dataset DOI: https://doi.org/10.35090/gatech/81252. Local: `papers/sun-2026-edu-circuit-hw.pdf`. Read in depth: main paper pp. 15281–15290 and targeted data/licensing appendices. Key locations: pp. 15282–15284 (authentic dataset and verbatim transcription), pp. 15285–15288 (SER, error-impact and grading), pp. 15287–15289 (human-in-loop regrading).

17. Bhattacharya, D., Kulkarni, A., & Ganapathy, S. (2025/2026). “FESTA: Functionally Equivalent Sampling for Trust Assessment of Multimodal LLMs.” Findings of EMNLP 2025. Open preprint: https://arxiv.org/abs/2509.16648. Local: `papers/bhattacharya-2026-festa.pdf`. Read: pp. 1–19. Key locations: pp. 1–5 (low-uncertainty hallucination and equivalent/complementary sampling), pp. 6–9 (AUROC results), pp. 9–10 (MCQ-only and computational limitations).

18. Yuan, Y. et al. (2022). “Syntax-Aware Network for Handwritten Mathematical Expression Recognition.” CVPR 2022. Open preprint: https://arxiv.org/abs/2203.01601. Local: `papers/yuan-2022-syntax-aware-hmer.pdf`. Consulted: dataset, evaluation, and limitations sections. HME100K details: 99,109 camera-captured expressions, 74,502 train / 24,607 test, 245 symbol classes, realistic blur/background/illumination variation.

## Benchmark and dataset documentation, with licensing constraints

Licensing notes are operational cautions, not legal advice. Repository licenses often cover code but not third-party images or underlying question text.

- **MathWriting** — 230k human inks plus 396k synthetic; online strokes can be rasterized for offline use. Dataset license: CC BY-NC-SA 4.0; Wikipedia-derived LaTeX also carries CC BY-SA obligations. Sources: paper pp. 1–2; https://github.com/google-research/google-research/blob/master/mathwriting/archive_readme.md. **Constraint:** noncommercial and share-alike; it cannot simply become a proprietary commercial training corpus.

- **CROHME 2011–2023** — online/offline expression benchmark, but mostly isolated formulas copied from prompts rather than authentic full student solutions. Dataset pages state CC BY-NC-SA 3.0 and research/noncommercial use. Sources: https://tc11.cvc.uab.es/datasets/CROHME-2014_2 and https://tc11.cvc.uab.es/datasets/ICDAR2019-CROHME-TDF_1. **Constraint:** noncommercial/share-alike and component copyrights.

- **HME100K** — 99,109 camera-captured real-scene formula images from many writers; official portal: https://ai.100tal.com/dataset; repository description: https://github.com/Phymond/HME100K. **Constraint:** the official page asserts copyright but does not expose a standard open-data license. Treat download availability as insufficient for product training or redistribution; obtain written permission.

- **FERMAT** — 2,244 handwritten, intentionally perturbed Grade 7–12 solutions, 43 transcribers, varied paper/lighting. Dataset: https://huggingface.co/datasets/ai4bharat/FERMAT; code: https://github.com/AI4Bharat/FERMAT. **Constraint:** Hugging Face access is gated; the paper promises “permissible licenses” and the code is MIT, but that does not establish a clear dataset license. Do not ingest into product training until the accepted access terms and per-asset rights are recorded.

- **ScratchMath** — 1,720 authentic Chinese primary/middle-school scratchwork samples; CC BY-NC-SA 4.0. Sources: https://github.com/ai-for-edu/ScratchMath and https://huggingface.co/datasets/songdj/ScratchMath. **Constraint:** noncommercial/share-alike; single platform, Chinese-only, and low-quality images were filtered out, limiting transfer to rough JEE photos.

- **ErrorRadar** — 2,500 K–12 instances with real common wrong answers, but the image is in the question while student steps are structured text rather than handwritten work. Dataset: https://huggingface.co/datasets/ErrorRadar/ErrorRadar. **Constraint:** no explicit dataset license was found; source material comes from an educational organization. Evaluation use requires rights confirmation.

- **EDU-CIRCUIT-HW** — 1,334 authentic submissions from 29 students, with 513 expert-verified near-verbatim transcriptions. Dataset DOI: https://doi.org/10.35090/gatech/81252. **Constraint:** no clear open license was found in the reviewed materials. Original textbook problem statements/figures are deliberately not redistributed; only IDs, author-created solutions/rubrics, and permitted student artifacts are included. Do not assume questions can be copied.

- **MP-DocVQA** — 46,176 questions, 47,952 pages, 5,928 documents, up to 20 pages. Dataset card labels it MIT: https://huggingface.co/datasets/rubentito/mp-docvqa. Source documents derive from the UCSF Industry Documents Library. **Constraint:** preserve source-document provenance and review the portal/source terms; the dataset card’s MIT metadata may not extinguish rights in every source image.

- **MathVista** — 6,141 visual-math examples from 31 datasets. New contributions are CC BY-SA 4.0, with an additional prohibition on use as a training set; underlying images/questions retain original rights. Sources: https://github.com/lupantech/MathVista and https://huggingface.co/datasets/AI4Math/MathVista. **Constraint:** evaluation only unless every upstream right and extra term is satisfied.

- **MathVerse** — 2,612 diagram problems transformed into six modality variants (~15k instances); project/repository states MIT: https://github.com/ZrrSkywalker/MathVerse. **Constraint:** verify upstream rights for source problems/images even if repository code/data packaging is MIT.

## Public practitioner/student discussions and product support

These are anecdotes and support guidance, not controlled evidence. They are useful for failure-mode discovery and wording, not prevalence estimates.

1. Hacker News discussion of a blurry photographed worksheet: the model factored recognized numbers correctly but failed to read “77,” misidentified which item was unreadable, and shifted numbering. https://news.ycombinator.com/item?id=48358011. Signal: OCR failure can corrupt structure and provenance even when downstream math is correct.

2. Hacker News “How to transcribe 1000s of handwritten notes”: practitioners report impressive OCR alongside plausible but wrong substitutions for numbers, dates, names, and handwritten mathematics; several warn that fluent output hides the need to check the image. https://news.ycombinator.com/item?id=40530719. Signal: plausible transcription is more dangerous than an obvious OCR failure.

3. Hacker News “Axiom — structural OCR for handwritten STEM notes”: a practitioner reports characters often survive while equation alignment, derivation grouping, numbering, and tables collapse. https://news.ycombinator.com/item?id=47215149. Signal: line/block structure needs its own metric; character accuracy is insufficient.

4. Hacker News “GradeLab — AI That Grades Handwritten Exams”: a commenter objects that teachers learn what students are doing through grading, highlighting a human-in-the-loop purpose beyond score correction. https://news.ycombinator.com/item?id=44850475. Signal: review sampling should support instructional insight, not only exception handling.

5. Photomath support explicitly tells users to compare the recognized equation with the photographed one and edit it before trusting a wrong result. https://support.google.com/photomath/answer/14332812. Its camera guidance says autofocus and sharp capture are prerequisites. https://support.google.com/photomath/answer/14334396. Signal: preview/confirmation and capture-quality UX are established practitioner mitigations.

6. Hacker News discussion of AI-detector false positives includes a student report of being failed after a detector score and debate over false discovery rates. https://news.ycombinator.com/item?id=35535174 and https://news.ycombinator.com/item?id=41904121. Signal: low base rates can make “positive” automated judgments untrustworthy; consequential decisions need review and an appeal/correction path. This is AI-detection, not math diagnosis, so transfer is inferential.

7. LinkedIn practitioner discussion from an AI-math-tutoring builder frames praise of wrong arithmetic as an anti-sycophancy safety issue and describes separating correctness judgment from pedagogical response. https://www.linkedin.com/posts/giannimazza_towards-understanding-sycophancy-in-language-activity-7408785882109071360-oeyo. Signal: false praise is a salient practitioner concern. The claimed architecture/performance is not independently verified.

8. Riahi et al. is measured evidence rather than social media, but its open-ended student responses echo the anecdotes: students valued AI clarity/structure yet preferred human contextual judgment and oversight (`papers/saxena-2026-humanizing-ai-grading.pdf`, pp. 4–7).

## Evidence-quality cautions

- FERMAT uses intentionally perturbed correct solutions transcribed by annotators; it is controlled and useful, but not equivalent to authentic JEE rough work.
- ErrorRadar uses real wrong answers but structured textual reasoning rather than photographed student scratchwork.
- ScratchMath is authentic but filtered out illegible/blurred examples, is Chinese-only, and skews heavily primary-school.
- EDU-CIRCUIT-HW is authentic and unusually strong for upstream recognition analysis, but comes from 29 students in one US circuits course.
- Caraeni et al. has only 18 students and 90 question-level samples.
- Levine et al. is larger and authentic but covers five question templates in two university courses; its reported rubric-item accuracy is not attempt-level diagnostic correctness.
- MP-DocVQA is about industry documents, not linked handwritten reasoning across pages. Multi-page recommendations derived from it are analogical.
- Guo et al. and SelectiveNet establish calibration/selective-prediction principles for conventional neural models, not free-form proprietary MLLMs. Applying their exact methods to API outputs requires new validation.
- TRON gives marginal risk guarantees under exchangeability, not per-example guarantees, and was evaluated mainly on VideoQA.
- FESTA is promising black-box evidence but presently MCQ-only, inference-heavy, and computationally expensive.
- Public discussions reveal plausible failure modes but cannot estimate rates or establish causal claims.
