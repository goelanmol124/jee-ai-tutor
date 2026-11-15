import type { RawStagedDiagnosisInput } from '../types';

const baseCapture = {
  attemptId: 'att_test_1',
  questionId: 'q_quad_1',
  capturedAtIso: '2026-07-18T12:00:00.000Z',
};

/** Missing middle page — must route to recapture, never learner failure. */
export const missingPageFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    pageCount: 2,
    pages: [
      { pageId: 'p1', order: 1, imageRef: 'img:p1' },
      { pageId: 'p3', order: 2, imageRef: 'img:p3' },
    ],
  },
  captureAssessment: {
    tier: 'insufficient',
    issues: [
      {
        kind: 'missing_page',
        pageId: 'p2',
        request: 'Page 2 of your derivation is missing — please add that page only.',
      },
    ],
  },
  firstCausalError: {
    kind: 'inference',
    stepId: 's2',
    citation: { pageId: 'p2', stepId: 's2' },
    mistakeFamily: 'conceptual_gap',
    explanation: 'Should NOT survive compile — capture failure.',
    provisional: false,
  },
  response: {
    kind: 'response',
    action: 'definitive_diagnosis',
    coachMessage: 'You misunderstood the identity on page 2.',
    citations: [],
  },
  stateProposals: [
    {
      proposalId: 'sp1',
      conceptId: 'trig_identity',
      claim: 'persistent misconception',
      mode: 'needs_confirmation',
      eligible: true,
      blockingReasons: [],
    },
  ],
  forbiddenAnswerTokens: ['15\\pi', 'option C'],
};

/** Blurry / unreadable region. */
export const unreadablePageFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    attemptId: 'att_unreadable',
    pageCount: 1,
    pages: [
      {
        pageId: 'p1',
        order: 1,
        imageRef: 'img:blur',
        clientReadableHint: 'blurry',
      },
    ],
  },
  captureAssessment: {
    tier: 'low',
    issues: [
      {
        kind: 'unreadable_region',
        pageId: 'p1',
        regionId: 'r4',
        request: 'Retake the bottom of page 1 — the exponent on line 4 is unreadable.',
      },
    ],
  },
  response: {
    coachMessage: 'Your algebra is wrong at the exponent.',
  },
  stateProposals: [
    {
      proposalId: 'sp_bad',
      conceptId: 'exponents',
      claim: 'cannot handle exponents',
      mode: 'needs_confirmation',
      eligible: true,
      blockingReasons: [],
    },
  ],
};

/** Valid alternate method (completing the square vs quadratic formula). */
export const alternateMethodFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    attemptId: 'att_alt',
    pageCount: 1,
    pages: [{ pageId: 'p1', order: 1, imageRef: 'img:alt' }],
  },
  captureAssessment: { tier: 'high', issues: [] },
  stepGraph: {
    kind: 'observation',
    steps: [
      {
        stepId: 's1',
        citation: { pageId: 'p1', regionId: 'r1', stepId: 's1', quote: '(x+1)^2 = 4' },
        verbatim: '(x+1)^2 = 4',
        normalizedLatex: '(x+1)^2=4',
        status: 'correct',
        dependsOn: [],
        alternateMethod: true,
        methodLabel: 'completing_the_square',
      },
      {
        stepId: 's2',
        citation: { pageId: 'p1', regionId: 'r2', stepId: 's2' },
        verbatim: 'x+1 = ±2',
        status: 'correct',
        dependsOn: ['s1'],
        alternateMethod: true,
        methodLabel: 'completing_the_square',
      },
    ],
  },
  evidenceAlignment: {
    kind: 'observation',
    items: [
      {
        stepId: 's1',
        citation: { pageId: 'p1', regionId: 'r1', stepId: 's1' },
        groundingConfidence: 0.9,
        supported: true,
        reason: 'visible completing-the-square step',
      },
    ],
  },
  firstCausalError: {
    kind: 'inference',
    stepId: null,
    citation: null,
    mistakeFamily: 'conceptual_gap',
    explanation: 'Model wrongly flagged non-canonical path.',
    provisional: false,
  },
  response: {
    coachMessage: 'Clean completing-the-square path — want a quick why?',
    citations: [{ pageId: 'p1', regionId: 'r1', stepId: 's1' }],
  },
  verifier: {
    verdict: 'agree',
    citationsSupported: true,
    unsupportedClaims: [],
    answerLeakageDetected: false,
  },
  stateProposals: [
    {
      proposalId: 'sp_alt',
      conceptId: 'quadratics',
      claim: 'misconception: cannot use formula',
      mode: 'needs_confirmation',
      eligible: true,
      blockingReasons: [],
    },
  ],
};

/** Unsupported visual claim — model cites a step not on the page. */
export const unsupportedVisualClaimFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    attemptId: 'att_hallucination',
    pageCount: 1,
    pages: [{ pageId: 'p1', order: 1, imageRef: 'img:ok' }],
  },
  captureAssessment: { tier: 'high', issues: [] },
  evidenceAlignment: {
    kind: 'observation',
    items: [
      {
        stepId: 's_hallucinated',
        citation: { pageId: 'p1', regionId: 'r9', stepId: 's_hallucinated', quote: 'sin(A+B)=sinA+sinB' },
        groundingConfidence: 0.2,
        supported: false,
        reason: 'claimed identity not visible on page',
      },
    ],
  },
  firstCausalError: {
    kind: 'inference',
    stepId: 's_hallucinated',
    citation: { pageId: 'p1', regionId: 'r9', stepId: 's_hallucinated' },
    mistakeFamily: 'conceptual_gap',
    explanation: 'Misapplied angle-addition.',
    provisional: false,
  },
  response: {
    coachMessage: 'You wrote sin(A+B)=sinA+sinB — that identity is wrong.',
    citations: [{ pageId: 'p1', regionId: 'r9', stepId: 's_hallucinated' }],
  },
  verifier: {
    verdict: 'agree',
    citationsSupported: true,
    unsupportedClaims: [],
    answerLeakageDetected: false,
  },
};

/** Answer leakage in coach message. */
export const answerLeakageFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    attemptId: 'att_leak',
    pageCount: 1,
    pages: [{ pageId: 'p1', order: 1, imageRef: 'img:ok' }],
    typedWork: 'I got 15 pi',
  },
  captureAssessment: { tier: 'high', issues: [] },
  evidenceAlignment: {
    kind: 'observation',
    items: [
      {
        stepId: 's1',
        citation: { pageId: 'p1', stepId: 's1' },
        groundingConfidence: 0.9,
        supported: true,
        reason: 'visible',
      },
    ],
  },
  firstCausalError: {
    kind: 'inference',
    stepId: null,
    citation: null,
    mistakeFamily: 'none',
    explanation: 'clean',
    provisional: false,
  },
  response: {
    coachMessage: 'Spot on — the answer is 15π which matches option C.',
    citations: [{ pageId: 'p1', stepId: 's1' }],
  },
  verifier: {
    verdict: 'agree',
    citationsSupported: true,
    unsupportedClaims: [],
    answerLeakageDetected: false,
  },
  forbiddenAnswerTokens: ['15π', '15\\pi', '15pi'],
};

/** High-evidence path that still must not persist state from a single photo. */
export const stateGateFixture: RawStagedDiagnosisInput = {
  capture: {
    ...baseCapture,
    attemptId: 'att_state',
    pageCount: 1,
    pages: [{ pageId: 'p1', order: 1, imageRef: 'img:ok' }],
  },
  captureAssessment: { tier: 'high', issues: [] },
  stepGraph: {
    kind: 'observation',
    steps: [
      {
        stepId: 's1',
        citation: { pageId: 'p1', regionId: 'r1', stepId: 's1' },
        verbatim: 'sin(A+B)=sinA+sinB',
        status: 'broken',
        dependsOn: [],
      },
    ],
  },
  evidenceAlignment: {
    kind: 'observation',
    items: [
      {
        stepId: 's1',
        citation: { pageId: 'p1', regionId: 'r1', stepId: 's1' },
        groundingConfidence: 0.92,
        supported: true,
        reason: 'visible wrong identity',
      },
    ],
  },
  firstCausalError: {
    kind: 'inference',
    stepId: 's1',
    citation: { pageId: 'p1', regionId: 'r1', stepId: 's1' },
    mistakeFamily: 'wrong_understanding',
    explanation: 'Used sin(A+B)=sinA+sinB.',
    provisional: false,
  },
  response: {
    coachMessage: 'You expanded sin(A+B) as a sum of sines — check the angle-addition form.',
    citations: [{ pageId: 'p1', regionId: 'r1', stepId: 's1' }],
    nextMove: 'see_fix',
  },
  verifier: {
    verdict: 'agree',
    citationsSupported: true,
    unsupportedClaims: [],
    answerLeakageDetected: false,
  },
  stateProposals: [
    {
      proposalId: 'sp_mis',
      conceptId: 'angle_addition',
      claim: 'persistent misconception on sin(A+B)',
      mode: 'needs_confirmation',
      eligible: true,
      blockingReasons: [],
    },
  ],
};
