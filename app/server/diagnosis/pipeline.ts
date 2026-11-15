import type {
  Citation,
  EvidenceAlignmentRecord,
  FirstCausalErrorRecord,
  NormalizedMathRecord,
  PedagogicalResponseRecord,
  RawStagedDiagnosisInput,
  StagedDiagnosisBundle,
  StepGraphRecord,
  VerbatimTranscriptionRecord,
} from './types';
import { DIAGNOSIS_SCHEMA_VERSION } from './types';
import { assessCaptureSufficiency, preciseRequestFromIssues } from './sufficiency';
import { runVerifierContract } from './verifier';
import { decideStateEligibility } from './stateEligibility';
import { buildRiskMetrics } from './risk';
import { scanAnswerLeakage } from './leakage';

function emptyTranscription(): VerbatimTranscriptionRecord {
  return { kind: 'observation', spans: [] };
}

function emptyMath(): NormalizedMathRecord {
  return { kind: 'observation', spans: [] };
}

function emptySteps(): StepGraphRecord {
  return { kind: 'observation', steps: [] };
}

function emptyAlignment(): EvidenceAlignmentRecord {
  return { kind: 'observation', items: [] };
}

function defaultFirstError(): FirstCausalErrorRecord {
  return {
    kind: 'inference',
    stepId: null,
    citation: null,
    mistakeFamily: 'unclear_evidence',
    explanation: 'Insufficient evidence for a causal error claim.',
    provisional: true,
  };
}

function collectCitations(input: RawStagedDiagnosisInput): Citation[] {
  const out: Citation[] = [];
  const push = (c?: Citation | null) => {
    if (c?.pageId) out.push(c);
  };
  for (const span of input.transcription?.spans ?? []) push(span.citation);
  for (const step of input.stepGraph?.steps ?? []) push(step.citation);
  for (const item of input.evidenceAlignment?.items ?? []) push(item.citation);
  push(input.firstCausalError?.citation ?? null);
  for (const c of input.response?.citations ?? []) push(c);
  return out;
}

/**
 * Compile a raw staged payload into a gated StagedDiagnosisBundle.
 * Pure / deterministic — no LLM calls. Routes are wired outside W2 ownership.
 */
export function compileStagedDiagnosis(raw: RawStagedDiagnosisInput): StagedDiagnosisBundle {
  const captureAssessment = assessCaptureSufficiency(raw);
  const transcription: VerbatimTranscriptionRecord = {
    kind: 'observation',
    spans: raw.transcription?.spans ?? [],
    pageNotes: raw.transcription?.pageNotes,
  };
  const normalizedMath: NormalizedMathRecord = {
    kind: 'observation',
    spans: raw.normalizedMath?.spans ?? [],
  };
  const stepGraph: StepGraphRecord = {
    kind: 'observation',
    steps: raw.stepGraph?.steps ?? [],
  };
  const evidenceAlignment: EvidenceAlignmentRecord = {
    kind: 'observation',
    items: raw.evidenceAlignment?.items ?? [],
  };

  const alternateMethodValid = stepGraph.steps.some((s) => s.alternateMethod === true);
  const hasBrokenAlternate = stepGraph.steps.some(
    (s) => s.alternateMethod === true && s.status === 'broken',
  );

  let firstCausalError: FirstCausalErrorRecord = {
    ...defaultFirstError(),
    ...(raw.firstCausalError ?? {}),
    kind: 'inference',
  };

  // Capture failures never become learner-failure inferences
  if (captureAssessment.isCaptureFailure || captureAssessment.tier === 'insufficient') {
    firstCausalError = {
      kind: 'inference',
      stepId: null,
      citation: null,
      mistakeFamily: 'unclear_evidence',
      explanation:
        'Capture/readability issue — not treated as student conceptual or procedural failure.',
      provisional: true,
    };
  } else if (alternateMethodValid && !hasBrokenAlternate && !raw.firstCausalError?.stepId) {
    firstCausalError = {
      kind: 'inference',
      stepId: null,
      citation: null,
      mistakeFamily: 'none',
      explanation: 'Work follows a valid alternate method with no causal break identified.',
      provisional: Boolean(raw.firstCausalError?.provisional ?? true),
    };
  }

  const draftMessage =
    typeof raw.response?.coachMessage === 'string' && raw.response.coachMessage.trim()
      ? raw.response.coachMessage.trim()
      : captureAssessment.isCaptureFailure
        ? preciseRequestFromIssues(captureAssessment.issues)
        : 'I need one clearer piece of your working before I can pinpoint the first break.';

  const leakage = scanAnswerLeakage(draftMessage, raw.forbiddenAnswerTokens ?? []);
  const claimedCitations = collectCitations(raw);

  const verifier = runVerifierContract({
    primary: {
      firstCausalError,
      evidenceAlignment,
      coachMessage: leakage.scrubbedText,
      claimedCitations,
    },
    independent: raw.verifier
      ? {
          verdict: raw.verifier.verdict,
          supportedCitationKeys: deriveSupportedKeys(raw),
          notes: raw.verifier.notes,
        }
      : undefined,
    forbiddenAnswerTokens: raw.forbiddenAnswerTokens,
  });

  // Merge leakage into verifier report
  const verifierFinal = {
    ...verifier,
    answerLeakageDetected: verifier.answerLeakageDetected || leakage.leaked,
  };

  const hasUnsupportedVisualClaim =
    evidenceAlignment.items.some((i) => !i.supported)
    || verifierFinal.unsupportedClaims.some((c) => c.startsWith('unsupported_visual_claim'));

  const risk = buildRiskMetrics({
    captureAssessment,
    verifier: raw.verifier ? verifierFinal : null,
    answerLeakage: leakage.leaked,
    hasUnsupportedVisualClaim,
  });

  // If no independent verifier was supplied, force non-definitive
  if (!raw.verifier && risk.allowedAction === 'definitive') {
    risk.allowedAction = 'tentative';
  }

  const outputMode = risk.allowedAction;

  const { eligibility, proposals } = decideStateEligibility({
    captureAssessment,
    verifier: raw.verifier ? verifierFinal : null,
    alternateMethodUncovered: alternateMethodUncovered(raw, alternateMethodValid),
    proposed: raw.stateProposals,
  });

  const response = buildResponse({
    outputMode,
    captureAssessment,
    draftMessage: leakage.scrubbedText,
    rawResponse: raw.response,
    firstCausalError,
    claimedCitations,
  });

  return {
    schemaVersion: DIAGNOSIS_SCHEMA_VERSION,
    capture: raw.capture,
    captureAssessment,
    transcription: transcription.spans.length ? transcription : emptyTranscription(),
    normalizedMath: normalizedMath.spans.length ? normalizedMath : emptyMath(),
    stepGraph: stepGraph.steps.length ? stepGraph : emptySteps(),
    evidenceAlignment: evidenceAlignment.items.length ? evidenceAlignment : emptyAlignment(),
    firstCausalError,
    response,
    stateEligibility: eligibility,
    observations: raw.observations ?? [],
    inferences: raw.inferences ?? [],
    stateProposals: proposals,
    verifier: verifierFinal,
    risk,
    outputMode,
  };
}

function deriveSupportedKeys(raw: RawStagedDiagnosisInput): string[] {
  if (raw.verifier && raw.verifier.citationsSupported === false) {
    return [];
  }
  const keys: string[] = [];
  for (const item of raw.evidenceAlignment?.items ?? []) {
    if (item.supported) {
      const c = item.citation;
      keys.push(`${c.pageId}|${c.regionId ?? ''}|${c.stepId ?? ''}`);
      keys.push(c.pageId);
    }
  }
  for (const step of raw.stepGraph?.steps ?? []) {
    if (step.status !== 'illegible' && step.status !== 'absent') {
      const c = step.citation;
      keys.push(`${c.pageId}|${c.regionId ?? ''}|${c.stepId ?? ''}`);
      keys.push(c.pageId);
    }
  }
  // If verifier explicitly agrees and claims citations supported, accept claimed citations
  if (raw.verifier?.verdict === 'agree' && raw.verifier.citationsSupported !== false) {
    for (const c of collectCitations(raw)) {
      keys.push(`${c.pageId}|${c.regionId ?? ''}|${c.stepId ?? ''}`);
      keys.push(c.pageId);
    }
  }
  return Array.from(new Set(keys));
}

function alternateMethodUncovered(
  raw: RawStagedDiagnosisInput,
  alternateMethodValid: boolean,
): boolean {
  if (!alternateMethodValid) return false;
  // Uncovered when inference claims wrong_understanding despite valid alternate
  const family = raw.firstCausalError?.mistakeFamily;
  return family === 'wrong_understanding' || family === 'conceptual_gap';
}

function buildResponse(args: {
  outputMode: StagedDiagnosisBundle['outputMode'];
  captureAssessment: StagedDiagnosisBundle['captureAssessment'];
  draftMessage: string;
  rawResponse?: Partial<PedagogicalResponseRecord>;
  firstCausalError: FirstCausalErrorRecord;
  claimedCitations: Citation[];
}): PedagogicalResponseRecord {
  const { outputMode, captureAssessment, draftMessage, rawResponse, claimedCitations } = args;
  const precise = preciseRequestFromIssues(captureAssessment.issues);

  if (outputMode === 'recapture') {
    return {
      kind: 'response',
      action: 'recapture',
      coachMessage: precise,
      preciseRequest: precise,
      nextMove: 'clarify',
      citations: claimedCitations.filter((c) =>
        captureAssessment.issues.some((i) => i.pageId === c.pageId),
      ),
    };
  }

  if (outputMode === 'clarify' || outputMode === 'blocked') {
    const msg =
      outputMode === 'blocked'
        ? 'I need to recheck this carefully — send one clearer line of the step you want reviewed.'
        : (rawResponse?.preciseRequest || precise || draftMessage);
    return {
      kind: 'response',
      action: 'clarify',
      coachMessage: msg,
      preciseRequest: rawResponse?.preciseRequest || precise,
      nextMove: 'clarify',
      citations: rawResponse?.citations ?? claimedCitations.slice(0, 2),
    };
  }

  if (outputMode === 'tentative') {
    return {
      kind: 'response',
      action: 'tentative_feedback',
      coachMessage: draftMessage,
      nextMove: rawResponse?.nextMove ?? 'try_again',
      citations: rawResponse?.citations ?? claimedCitations.slice(0, 3),
    };
  }

  // definitive
  return {
    kind: 'response',
    action: 'definitive_diagnosis',
    coachMessage: draftMessage,
    nextMove: rawResponse?.nextMove ?? 'see_fix',
    citations: rawResponse?.citations ?? claimedCitations,
  };
}
