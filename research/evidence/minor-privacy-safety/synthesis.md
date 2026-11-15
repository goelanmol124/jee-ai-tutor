# Minor privacy, safety, and research controls for the private AI tutoring pilot

**Research cut-off:** 18 July 2026  
**Product context reviewed:** an invite-only, eight-week pilot for mixed Class 11, Class 12, and dropper cohorts; opaque student identities; persistent learning state; tutoring transcripts; and photos of handwritten Physics, Chemistry, and Mathematics work. The current plan also proposes a randomized delayed-start evaluation and a separately reviewed 180-image handwriting evaluation set.

> **Important:** This is engineering and product research, not legal advice. Indian counsel should confirm the operator's legal status, the exact consent mechanism, intermediary obligations, research-governance route, cross-border processing, and safeguarding/reporting procedure before recruitment. Binding product-policy choices identified at the end must be decided by the product owner.

## Executive decision

Do not treat the staged commencement of India's Digital Personal Data Protection Act, 2023 ("DPDP Act") as permission to launch a lightly controlled minors pilot.

The core DPDP processing duties, including consent, security, erasure, data-principal rights, and the child provisions in sections 3–17, are **not yet in force on 18 July 2026**. They are scheduled to commence 18 months after 13 November 2025, i.e. **13 May 2027**. The definitions and Board-establishment provisions are already in force. The 2025 Rules follow the same staging: Rules 3 and 5–16, including notice, safeguards, breach notification, verifiable parental consent, child exemptions, rights, transfers, and research standards, commence on **13 May 2027**. See G.S.R. 843(E), Gazette p.2, clauses (a)–(c), and DPDP Rules Rule 1(2)–(4), Gazette p.23.

Current obligations still include the Information Technology Act, 2000 and the SPDI Rules, 2011 where the operator is a body corporate and processes sensitive personal data or information; the CERT-In directions; POCSO reporting duties; contracts and provider terms; and, conditionally, the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021 as amended in February 2026.

The pilot should therefore launch to minors only if it already meets the future DPDP child baseline:

- parent permission that is verifiable and purpose-specific;
- age-appropriate student notice and affirmative assent;
- no targeted advertising, cross-service tracking, or manipulative engagement;
- default deletion of raw photos within 24 hours;
- separate, optional consent for a coded handwriting-evaluation dataset;
- a model route with zero-data-retention or equivalent contractual controls for images;
- least-privilege, audited admin access;
- deletion, export, and secure recovery;
- a six-hour CERT-In reporting runbook and child-safeguarding path;
- documented educational-safety tests and human escalation;
- independent ethics review or a written determination explaining the applicable review route.

## What data the pilot actually creates

The data map should distinguish these stores and never use a single unrestricted "student record":

1. **Identity and consent vault:** invite, opaque `stu_*` identifier, minor/adult flag, parent account, verification result, consent/assent versions, and recovery contacts.
2. **Learning record:** attempted question IDs, structured diagnosis, concept state, mistake patterns, review schedule, and product events.
3. **Conversation record:** student text and AI replies. This can reveal confidence, language ability, educational performance, and occasionally health, family, or safeguarding information.
4. **Transient photo path:** handwritten-work images, EXIF, OCR, vision-provider request, and derived diagnosis.
5. **Optional research photo corpus:** only specifically opted-in, coded images used for the 180-image evaluation; isolated from operational analytics.
6. **Operational and security logs:** request IDs, timing, error codes, authentication and admin-access events. These should not contain prompts, replies, image URLs, contact details, or session tokens.
7. **Research extracts:** coded outcomes for the delayed-start design. Direct identity, raw photos, and free-text transcripts should not be exported by default.

Full date of birth, school name, home address, Aadhaar number, government-ID images, precise location, contact list, faceprint, voiceprint, emotion score, mental-health inference, caste, religion, family income, and advertising identifiers are not needed for this pilot.

## Legal status as of 18 July 2026

### Current, binding or potentially binding now

- **SPDI Rules, 2011:** A body corporate handling SPDI must publish a privacy policy (Rule 4); obtain consent in writing through letter, fax, or email before collecting SPDI (Rule 5(1)); collect it only for a lawful, necessary purpose (Rule 5(2)); provide notice (Rule 5(3)); retain it no longer than necessary (Rule 5(4)); allow review/correction and withdrawal (Rules 5(6)–(7)); appoint a grievance officer and address grievances within one month (Rule 5(9)); control disclosure and transfers (Rules 6–7); and maintain reasonable security practices with annual/significant-change audits (Rule 8). Gazette pp.2–5.
- **Scope caution:** A normal worksheet image is not automatically "biometric information." Under SPDI Rule 2(1)(b), biometrics are technologies measuring/analyzing human-body characteristics for authentication. Handwriting becomes substantially riskier if used to authenticate, identify, infer health, or build a persistent behavioural signature. A face, contact detail, medical note, or financial detail accidentally captured in a photo is still personal information and may include SPDI.
- **IT Act section 43A:** negligent failure by a body corporate to maintain reasonable security for SPDI, causing wrongful loss or gain, can lead to compensation. Section 72A addresses disclosure of personal information in breach of lawful contract.
- **CERT-In directions:** covered service providers, intermediaries, data centres, body corporates, and government organisations must report listed cyber incidents within six hours of noticing or being notified of them; maintain a CERT-In point of contact; synchronize clocks; and keep ICT logs securely for a rolling 180 days within Indian jurisdiction. Direction paragraphs (i)–(iv), pp.1–3; reportable events are in Annexure I, pp.4–5. The evolving FAQ, Q24 and Q30, confirms that the clock starts on notice and an initial report can contain available information with supplementation later.
- **POCSO Act:** any person with apprehension or knowledge that an offence under POCSO is likely or has occurred must report to the Special Juvenile Police Unit or local police (section 19); failure to report is punishable subject to the statutory exceptions (section 21). This is relevant if a minor uploads sexual-abuse material or discloses such abuse.
- **IT intermediary/SGI rules, conditional:** If the operator is an "intermediary," the 2021 IT Rules' due-diligence and grievance duties need counsel review. The 2026 amendment took effect on 20 February 2026. New Rule 3(3) requires certain tools that facilitate synthetic audio, visual, or audiovisual content to prevent unlawful SGI and label permissible SGI with provenance. MeitY's FAQ says pure text output by itself is not SGI (FAQ Q14), so normal tutor text does not trigger the SGI label rule; generated diagrams, avatars, audio, or video may. The broader recommendation to identify every tutor response as AI-generated remains appropriate even where the SGI rule does not apply.

### Enacted but future operational duties

On 13 May 2027, unless changed:

- A child remains anyone under 18 (DPDP Act section 2(f), Gazette p.3).
- Consent must be free, specific, informed, unconditional, unambiguous, affirmative, and limited to data necessary for the specified purpose; withdrawal must be comparably easy (section 6, Gazette pp.5–6).
- The fiduciary remains responsible for processors, must use valid processor contracts, maintain accuracy where decisions affect a person, implement safeguards, notify breaches, and erase data when consent is withdrawn or purpose ends (section 8, Gazette pp.7–8).
- Before processing a child's data, the fiduciary must obtain verifiable parental consent; must not process in a manner likely to harm the child's well-being; and must not track or behaviourally monitor children or direct targeted advertising at them (section 9, Gazette p.8). Future penalties include up to ₹200 crore for breach of child obligations and up to ₹250 crore for safeguard failures (Schedule, Gazette p.19).
- Rule 10 requires due diligence that the person identifying as the parent is an identifiable adult, using reliable identity/age details or an authorised virtual token, including a Digital Locker route (Gazette pp.28–29).
- Rules 6–8 require defined security measures, breach notices, and one-year retention of security-related logs/personal data for specified purposes (Gazette pp.26–28). Rule 14 requires published rights and grievance routes; Rule 15 governs transfers; Rule 16 and the Second Schedule govern the research exemption (Gazette p.30 and pp.35–36).

### Important uncertainties

- The Board legally exists, but a May 2026 MeitY notice was still recruiting one Chairperson and four Members. Live searches found no later appointment notice by 18 July 2026. Absence of a search result is not proof of non-appointment.
- Do not assume the educational-institution exemption in Rule 12/Fourth Schedule covers a private direct-to-consumer AI tutor. "Educational institution" and the narrow permitted tracking/monitoring condition require counsel interpretation. Even if available, it does not eliminate section 9(2)'s well-being duty.
- Do not rely on the research exemption for operational tutoring. DPDP Act section 17(2)(b) excludes processing used to make decisions specific to the data principal. The tutor uses a student's data to make individualized instructional decisions. A separately coded, non-individual-decision research dataset may qualify later if Rule 16/Second Schedule is satisfied.
- SPDI's definition is narrower than all personal data. Nevertheless, the safest architecture treats every identifiable child photo, transcript, and learning profile as protected personal data.
- The exact legal sufficiency of email/OTP, e-sign, DigiLocker, or an in-person check for "verifiable" parent consent is a binding legal decision. Rule 10 verifies adult identity/age but does not clearly resolve proof of the adult-child relationship.

## Pilot-ready control matrix

Each item states its status on the research cut-off date.

### C-01 — Age routing and mixed cohorts

**Status:** current recommended control; future required for child obligations.

- Ask only the age band needed: `under 18` or `18+`; avoid storing full DOB.
- Adults consent for themselves. Under-18 users cannot activate from a child-only flow.
- At the 18th birthday or when the participant declares adulthood, suspend new processing until the participant receives the adult notice and gives their own consent; retire parent recovery authority.
- Verify with test cases for an adult, a 17-year-old, transition at 18, and conflicting parent/student declarations.

### C-02 — Verifiable parent permission and child assent

**Status:** DPDP future statutory requirement; ethics and risk-control launch requirement now.

- The parent starts from a pilot invitation, passes adult age/identity verification, declares parent/lawful-guardian status, sees the full parent notice, and affirmatively selects each purpose.
- Prefer an authorised age/identity token or DigiLocker-style verification result. Do not retain Aadhaar or government-ID images. If manual review is temporarily necessary, restrict it to trained staff and delete the image immediately after recording the verification result.
- Require a separate, simple student assent screen. For this expected 16–17 cohort, obtain written/electronic assent. Respect dissent even if a parent has consented.
- Record notice version, purposes, data categories, processor list, retention version, timestamp, verification method/result, and withdrawals. Email the receipt to the parent.

### C-03 — Granular purposes

**Status:** current required for SPDI; future required for all covered personal data; recommended for research ethics.

Use separate controls for:

1. account and tutor operation — required to participate;
2. transient photo diagnosis — required only when the student chooses photo input;
3. optional raw-photo research/evaluation retention — off by default;
4. optional use of coded transcripts/outcomes for the delayed-start evaluation — separate research permission;
5. optional recontact — separate and off by default.

No bundled "improve our services, research, marketing, and partners" consent. No advertising or data sale.

### C-04 — Notice and transparency

**Status:** current required for SPDI and conditionally under IT Rules; future DPDP requirement; recommended for every user.

- Present a standalone parent notice and a shorter Hindi/English child notice before data entry.
- Itemize data, purpose, recipients/model provider, country/region of processing, retention, human review, automated tutoring decisions, known accuracy limits, withdrawal, deletion/export, grievances, and safety-reporting limits.
- Label every tutor response and feedback screen as AI-generated. State that the tutor can be wrong and is not a human teacher, mental-health service, emergency service, or authoritative grader.
- On photo capture, show a just-in-time warning: include only the work; exclude faces, names, school IDs, addresses, QR codes, and unrelated surroundings.

### C-05 — Data minimization and purpose separation

**Status:** current required for SPDI; future DPDP requirement; recommended for all data.

- Use the opaque `stu_*` key outside the identity vault.
- Do not collect school name, exact address, precise location, contacts, social profile, Aadhaar, demographic advertising data, or full DOB.
- Keep operational tutoring, optional photo evaluation, security logs, and research extracts in different stores with separate service accounts.
- Prohibit secondary use for model training, marketing, admission prediction, grading, discipline, or profiling without a new review and consent.

### C-06 — Photo safety and retention

**Status:** current minimization/security requirement where SPDI is present; future erasure/safeguard requirement; product launch requirement.

- Strip EXIF and client filenames; enforce MIME signature, size/page limits, malware scanning, and ordered-page review.
- Use an on-device or trusted local detector to warn/block obvious faces and unrelated photos. Discard any detection vectors; never identify a face.
- Encrypt upload and transient object storage. Use unguessable single-use references, not public URLs.
- Normal tutor path: delete raw image, derived thumbnails, and provider-side copies within 24 hours; target minutes, not hours.
- Optional 180-image evaluation path: copy only after separate parent permission and student assent into a coded research store; retain until 90 days after the final locked evaluation, then hard-delete.
- Never use handwriting, face, voice, gaze, typing cadence, or inferred emotion for authentication, identity linkage, mental-health inference, or engagement scoring.

### C-07 — Retention schedule

**Status:** current required for SPDI; future DPDP requirement; recommended schedule pending approval.

- Raw operational image and caches: **24 hours maximum**.
- Separately consented handwriting evaluation image: **90 days after final evaluation**, then delete; no indefinite benchmark corpus.
- OCR text and diagnosis working buffer: **24 hours** unless converted to the structured learning record.
- Tutor transcript: **rolling 90 days**, then delete or transform to a reviewed, non-identifying research extract.
- Structured learning state: **active pilot plus 90 days**, then delete/export unless the user joins a later service under a new notice.
- Identity and recovery data: **active pilot plus 30 days** after closure.
- Consent/assent, protocol, and withdrawal records: **three years after study completion**, consistent with ICMR's child-research record recommendation; store receipts, not ID copies. Counsel/ethics committee may set a different period.
- Pseudonymous security, admin-access, and processing logs: **365 days**; keep the legally required 180-day rolling copy in India. Logs must not contain content.
- Backups: **30-day expiry**, encrypted; deletion completes when the last backup expires.
- Deletion/export request record and non-reversible tombstone: **three years**, with no deleted content.
- Incident evidence/POCSO material: only for the period directed by law enforcement, counsel, or the incident lead under a documented legal hold.

### C-08 — Access model

**Status:** current reasonable-security requirement; future DPDP safeguard; recommended implementation.

- Student: their own learning record and transcript.
- Adult participant: their own account, export, correction, and deletion.
- Parent/guardian: consent, account status, recovery, and a bounded progress/safety view. Full transcript visibility is a policy decision, not a default.
- Education reviewer: sampled coded sessions and derived diagnosis; no identity vault.
- Photo annotator: coded evaluation images only; no contact, parent, or transcript access.
- Research analyst: approved coded dataset only; no raw photos or free text by default.
- Support: metadata and recovery workflow; no content unless a time-limited, user-authorized escalation.
- Safety/admin: just-in-time content access, reason code, approval for raw image access, automatic expiry, and immutable audit.
- Engineer: no production content through normal database access.
- Model provider: only the minimum redacted prompt/image needed for the single inference.

Require MFA for staff, role review before launch and monthly, immediate offboarding, export alerts, and quarterly access certification.

### C-09 — Logging and redaction

**Status:** current CERT-In/security requirement; future DPDP safeguard; recommended design.

- Log event name, opaque account ID, request ID, model/version, policy/version, latency, token/image counts, status, and redacted error category.
- Never log parent/student contact details, session tokens, invite codes, raw prompts/replies, OCR text, image bytes/URLs, full IP beyond the security store, or provider credentials.
- Redact names, emails, phone numbers, Aadhaar-like numbers, school identifiers, addresses, and signed URLs before telemetry.
- Use separate content-review storage, not application logs. Every access records who, why, case ID, fields viewed, and action.
- Test redaction with handwritten and multilingual/Hinglish samples; do not claim perfect OCR redaction.

### C-10 — Processor and model-provider controls

**Status:** current disclosure/transfer/security requirement for SPDI; future processor-contract duty; launch requirement.

Before sending any minor's photo or transcript, obtain contractual answers to:

- Is API input/output used to train any model by default or through feedback?
- What is the exact abuse-monitoring and application-state retention for the chosen endpoint?
- Is zero-data-retention approved for this organisation/project and for image inputs?
- Which endpoints/features are not ZDR eligible?
- Can humans or subprocessors review content, including safety/CSAM review, and under what triggers?
- Where are content, service logs, support tickets, backups, and subprocessors located?
- What deletion API and evidence are available? Does deletion cover backups and safety queues?
- What are the DPA, confidentiality, transfer, audit, breach-notification, and subprocessor-change terms?
- Can the provider support rights requests, legal holds, and a 24-hour vendor incident SLA?
- Are model/version changes announced, pin-able, and testable?
- What safety filters apply to minors, and what is the false-positive/false-negative path?

Official examples show why marketing claims are insufficient. OpenAI states API data is not used for training by default, but standard abuse-monitoring logs may retain content up to 30 days; ZDR requires eligibility/approval and endpoint review. Anthropic offers approved commercial ZDR arrangements but may retain safety-classifier results. Google Cloud distinguishes Customer Data from Service Data and provides separate governance, region, audit, and safety controls. Verify the exact product configuration in writing.

**Decision rule:** no raw child image goes to a provider that cannot contractually meet the 24-hour limit. If ZDR/equivalent is unavailable, run OCR/vision locally and send only minimized, redacted text.

### C-11 — Deletion, correction, and export

**Status:** current correction/withdrawal duty for SPDI; future access/correction/erasure rights; recommended for all records now.

- Provide one parent/adult portal action for export, correction, withdrawal, and deletion; also provide a staffed email route.
- Verify the requester without collecting more data than the original account. Parent actions must map to the child account through the consent vault.
- Target acknowledgement in 48 hours and completion in 30 days. Explain any legal hold and the exact retained fields.
- Export identity/consent receipt, learning state, transcript still inside retention, photo-retention status, processor categories, and major admin accesses in machine-readable JSON plus readable HTML/PDF.
- Delete from live stores and processors, revoke sessions, queue backups, and send completion when backup expiry occurs.
- Research withdrawal removes coded-but-linkable records. Truly anonymized aggregate results already incorporated into statistics may not be practically reversible; disclose this before consent.

### C-12 — Account and parent recovery

**Status:** security best practice and future safeguard.

- Parent account controls recovery for a minor; the child does not need a personal email or phone.
- Use a short-lived, single-use link plus a second notification to the existing parent channel. Apply cooldown and staff review for a simultaneous contact-change/recovery request.
- Revoke old sessions and notify both parent and student after recovery. Do not reveal transcript content during identity verification.
- Avoid knowledge questions about school, family, or DOB.
- Provide a documented path for family separation, lost guardian access, disputed guardianship, and transition at 18. High-risk changes require human review.

### C-13 — Educational AI safety

**Status:** recommended; supports future child-well-being and accuracy duties.

- Ground tutoring in approved questions, canonical solutions, and chapter content; show source/version internally.
- Use deterministic calculators, symbolic checks, and answer validators where possible. Never mark a student's method wrong merely because it differs from the canonical path.
- For low confidence or unreadable handwriting, ask for one precise clarification. A photo failure must not become evidence of a concept failure.
- Avoid final-answer dumping. Ask for reasoning, use bounded hints, and explicitly correct contradictions.
- Do not grade, rank, discipline, diagnose, or make admission/high-stakes decisions.
- Do not simulate friendship, secrecy, romance, dependency, or a therapist relationship. Avoid streak pressure, late-night nudges, and emotionally manipulative praise.
- Test jailbreaks, sexual content, self-harm, hate, violence, cheating, prompt injection in photos, hallucinations, bias across English/Hindi/Hinglish, and accessibility.
- Publish known limitations. Give students a visible "this looks wrong" control that routes to human review without penalizing the learner.

### C-14 — Human review and admin operations

**Status:** recommended; supports accuracy, safety, and accountability.

- Human review is mandatory before any high-impact interpretation is shared outside the tutoring loop.
- Maker/reviewer sampling must use coded records. Random review and severe-trust-failure review should be stated in the notice.
- Severe categories include fabricated reading of handwriting, unsafe sexual content, self-harm mishandling, discriminatory response, exposure of another student's data, answer leakage that undermines learning, and repeated confidently wrong instruction.
- Require two qualified reviewers for the locked handwriting set, an adjudication process, disagreement metrics, and a documented threshold for pausing the model.
- Admin tools must not provide unrestricted browsing of all child transcripts/photos.

### C-15 — Incident response

**Status:** current legal/security requirement; future DPDP notification duty.

- Name an incident commander, privacy lead, safeguarding lead, vendor contact, and CERT-In point of contact before recruitment.
- Maintain synchronized clocks, Indian log storage, asset/vendor inventory, breach severity rubric, contact sheet, and a prefilled CERT-In form.
- For a suspected data breach: contain, preserve minimal evidence, rotate credentials, identify affected children/parents and processors, assess the CERT-In Annexure I category, and make the initial report within six hours when applicable. Do not wait for complete facts.
- Future-proof notices using DPDP Rule 7: plain description, timing/extent, likely consequences, mitigation, user actions, and contact; Board initial notice without delay and details within 72 hours once those provisions commence.
- Notify a parent and the child in age-appropriate language unless safeguarding advice says parent contact could increase danger.
- Run one tabletop covering a leaked raw-photo URL and one covering a compromised admin account before launch.

### C-16 — POCSO and safeguarding

**Status:** current statutory reporting risk and launch requirement.

- Publish that the tutor is not a confidential crisis service and explain the limits of confidentiality.
- Build a narrowly scoped safety escalation for credible sexual abuse/CSAM, immediate self-harm, or imminent violence. General academic anxiety must not trigger invasive surveillance.
- If suspected CSAM appears: block further distribution, restrict access to the minimum trained responders, do not create screenshots or training copies, preserve only as legally directed, and contact the safeguarding lead/counsel for immediate section 19 reporting to the SJPU/local police.
- Do not make the AI the final reporter or investigator. A trained human makes the legal/safeguarding determination on an urgent basis.
- Document when a parent should not be contacted because that adult may be implicated or contact could endanger the child.

### C-17 — Research ethics

**Status:** ethics best practice; ICMR is directly binding only in its covered biomedical/health contexts, so applicability to this educational study needs a written determination.

- The delayed-start stepped-wedge and 180-image annotation exercise are research-like activities involving minors, intervention, outcome measurement, and identifiable educational records.
- Obtain independent ethics committee/IRB review or a documented determination from a competent institution before recruitment. Do not self-label it "product analytics" to avoid review.
- Prepare protocol, risk/benefit assessment, parent information/consent, written adolescent assent, adult consent, withdrawal, adverse-event process, data-management plan, analysis plan, and publication plan.
- Participation must be voluntary and separated from access to ordinary learning support as far as feasible. Delayed-start students ultimately receive the intervention; avoid coercive incentives.
- Explain randomization, what the AI can and cannot do, human review, confidentiality limits, and whether deidentified results will be published.
- Use coded data, minimum sample access, predefined outcomes, and an analysis freeze. Do not use holdout questions for training.
- ICMR 2017 guidance, section 3, calls for parent/LAR consent and age-appropriate assent; it requires written assent for ages 12–18, respect for dissent, confidentiality review, and at least three-year archiving of study records. These are strong controls even if an educational EC concludes the ICMR document is not formally controlling.

## Consent flow to implement

1. **Adult receives invite.** They select "I am the learner and 18+" or "I am a parent/lawful guardian enrolling a learner under 18."
2. **Notice before collection.** Show the adult or parent notice before contact beyond the minimum invite/recovery channel.
3. **Parent verification.** Verify adult age/identity with a low-data authorised method; record result/token, not document image. Record parent/lawful-guardian declaration.
4. **Purpose choices.** Require tutor-operation permission; offer separate unchecked choices for coded research, raw-photo evaluation, and recontact.
5. **Child invite.** Parent creates a child alias/opaque account; no child phone/email is required.
6. **Child notice and assent.** The student sees a short English/Hindi explanation, chooses to participate, and can decline photo/research options without losing text tutoring where technically possible.
7. **Receipt.** Store and email the versioned receipt; expose withdrawal and retention dates in settings.
8. **Just-in-time photo notice.** Repeat the photo warning at every capture; allow review, reorder, replacement, and deletion before upload.
9. **Re-consent.** Trigger on new provider, new purpose, longer retention, material safety/admin-review change, or research protocol amendment.
10. **Transition/withdrawal.** At 18, obtain adult consent. On withdrawal, stop new processing, revoke access where necessary, delete operational data, and explain the treatment of already anonymized statistics.

## Public parent, student, and teacher concerns — separate from legal findings

This is a directional, non-representative review of public Reddit discourse research and app-store reviews. Reviews are self-selected, identities/claims are not verified, rankings change, and no legal conclusion should be drawn from them.

Recurring themes:

- **Wrong but plausible answers:** direct Google Play and Apple reviews for Answer.AI, Gauth, and other homework tools describe elementary/college math errors, wrong interpretations of photographed questions, failures on multipart questions, and useful-looking explanations attached to wrong results.
- **OCR/photo friction:** users report that unreadable or misinterpreted photos still consume a credit/attempt. This supports preflight image review and no concept penalty for a failed diagnosis.
- **Cheating and dependency:** some reviews explicitly value direct completion of schoolwork; others value step-by-step explanations. The product must preserve effort and understanding, not optimize answer throughput.
- **Ads, paywalls, and subscription distrust:** users object to frequent ads, energy/credit systems, automatic renewal, cancellation friction, and perceived quality differences between free and paid tiers. The private pilot should have no advertising, no dark patterns, and no hidden trial conversion.
- **Parent controls and accessibility:** Khan Academy reviews request simpler parent dashboards, child PINs, read-aloud support, and better Chromebook behavior.
- **Privacy-label inconsistency:** app-store disclosures range from "data not collected" to user content/contact identifiers linked to identity or used for tracking. These developer-declared labels are not independent audits.
- **Teacher ambivalence and enforcement anxiety:** a March 2026 study of 3,789 Reddit posts found teachers discussed both learning harms (55.2%) and learning help (32.2%) more often than students; a May 2026 large-scale study found students focused on grades, enforcement, false-positive AI detection, reputational harm, and procedural fairness, while teachers emphasized accuracy, integration, policy uncertainty, and workload.
- **Human oversight burden:** public teacher commentary warns that reviewing individual transcripts is time-consuming and that "human in the loop" is meaningless unless staffing, sampling, severity queues, and response times are specified.

Product response: show uncertainty, support easy error reporting, validate high-risk STEM steps, provide transparent parent controls, avoid AI-detection accusations, never infer cheating from model signals, and measure reviewer workload before scaling.

## Launch blockers

The minors pilot is blocked until all of the following are evidenced:

1. Named Indian operator/legal entity and counsel's applicability memo for SPDI, IT intermediary rules, cross-border processing, and DPDP transition.
2. Approved parent age/identity verification method and guardian declaration; no retained government-ID copies.
3. Versioned parent notice, adult notice, adolescent assent, and research consent with withdrawal.
4. Processor DPA and written retention/training/subprocessor answers; ZDR/equivalent enabled for the exact image endpoint or a local-only image path.
5. Verified raw-photo deletion within 24 hours across objects, caches, logs, provider systems, and backups; separate evaluation-store consent and expiry.
6. Identity/learning/photo/research/log separation; staff MFA; least privilege; just-in-time admin access; auditable raw-content review.
7. Working export, correction, withdrawal, deletion, and parent recovery with backup-expiry evidence.
8. CERT-In point of contact, six-hour runbook, Indian rolling logs, synchronized time, vendor escalation, and two completed tabletop exercises.
9. POCSO/safeguarding protocol reviewed by qualified Indian counsel/child-safety professional, with trained urgent responders.
10. Locked educational-safety evaluation with pass thresholds for correctness, hallucination, unreadable photos, bias, unsafe content, answer leakage, and prompt injection; named human pause authority.
11. Independent ethics approval/determination for delayed-start evaluation and handwriting corpus, plus protocol/data-management plan.
12. No ads, trackers, data sale, behavioural marketing, biometric identification, emotion inference, high-stakes grading, or unrestricted parent/admin transcript surveillance.
13. If generated audio/visual content is enabled, counsel-approved Rule 3(3) SGI prevention, prominent labelling, and provenance implementation.

## Binding decisions to escalate to product owner

1. Whether minors are admitted before 13 May 2027 or the first cohort is adult-only while controls are completed.
2. Operator/legal entity and whether the service claims intermediary safe harbour.
3. Parent-verification vendor/method and whether any manual ID review is permitted.
4. Whether a parent can see full transcripts, only progress summaries, or safety-triggered excerpts.
5. Final raw-image limit, evaluation-corpus expiry, transcript period, and research-record period.
6. Model provider/region and whether ZDR for images is mandatory; recommended answer is yes.
7. Exact research review body, publication intent, and whether data remains linkable after study completion.
8. Human-review sampling rate, reviewer staffing, severity SLA, and stop-launch thresholds.
9. Safeguarding rules for parent notification, self-harm, abuse disclosure, and POCSO reports.
10. Whether future image/audio generation is excluded from the pilot or shipped with SGI labelling/provenance.

## Bottom line

An invite-only label does not materially reduce the sensitivity of persistent child learning profiles and handwritten-work photos. The defensible pilot is one in which the parent is verifiably involved, the adolescent assents, raw images disappear by default, optional research data is isolated, vendors cannot retain/train on child content, staff access is exceptional and audited, tutoring errors are expected and reviewable, and incident/safeguarding decisions are owned by trained humans.
