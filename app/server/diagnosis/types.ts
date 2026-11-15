/**
 * Evidence-grounded photo diagnosis contracts (W2).
 *
 * Staged pipeline:
 * capture → page order → verbatim transcription → math normalization →
 * step graph → evidence alignment → first causal error → pedagogical response →
 * state eligibility
 *
 * Observation, inference, and persistent-state proposals stay separate records.
 */

export const DIAGNOSIS_SCHEMA_VERSION = 'w2.diagnosis.v1' as const;

/** Ordered multi-page capture page. */
export interface DiagnosisPageInput {
  /** Stable page id within the attempt (e.g. "p1"). */
  pageId: string;
  /** 1-based display order after student reorder. */
  order: number;
  /** Optional opaque image reference / hash; raw bytes stay outside this module. */
  imageRef?: string;
  /** Optional width/height for quality slicing. */
  widthPx?: number;
  heightPx?: number;
  /** Capture-time orientation hint in degrees. */
  orientationDeg?: number;
  /** Client-reported readability hint; server still decides sufficiency. */
  clientReadableHint?: 'readable' | 'blurry' | 'glare' | 'cropped' | 'unknown';
}

export interface DiagnosisCaptureMetadata {
  attemptId: string;
  questionId: string;
  capturedAtIso: string;
  pageCount: number;
  pages: DiagnosisPageInput[];
  /** Typed work / student note, if any (never treated as image OCR). */
  typedWork?: string;
  /** Optional OCR/VLM text extracted from images — untrusted. */
  ocrTextByPage?: Record<string, string>;
  deviceClass?: string;
  uploadPath?: 'camera' | 'gallery' | 'unknown';
}

/** Bounding region on a page (normalized 0–1 or pixel units). */
export interface PageRegion {
  pageId: string;
  /** Optional block/line id within the page. */
  regionId: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  unit?: 'normalized' | 'px';
}

export interface Citation {
  pageId: string;
  regionId?: string;
  stepId?: string;
  /** Short quote of visible work; must not invent unreadable content. */
  quote?: string;
}

export type EvidenceSufficiencyTier =
  | 'insufficient'
  | 'low'
  | 'moderate'
  | 'high';

export type CaptureIssueKind =
  | 'missing_page'
  | 'unreadable_region'
  | 'blur'
  | 'glare'
  | 'crop'
  | 'wrong_orientation'
  | 'duplicate_page'
  | 'order_gap'
  | 'absent_work'
  | 'ocr_failure';

export interface CaptureIssue {
  kind: CaptureIssueKind;
  pageId?: string;
  regionId?: string;
  /** Precise student-facing request; never a learner-failure claim. */
  request: string;
}

export interface CaptureAssessment {
  tier: EvidenceSufficiencyTier;
  issues: CaptureIssue[];
  /** True when missing/unreadable/absent work — must not become learner failure. */
  isCaptureFailure: boolean;
  orderedPageIds: string[];
}

export interface TranscriptionSpan {
  spanId: string;
  citation: Citation;
  /** Verbatim visible text; use [ILLEGIBLE] for unreadable spans. */
  verbatim: string;
  confidence: number;
  crossedOut?: boolean;
  alternatives?: string[];
}

export interface VerbatimTranscriptionRecord {
  kind: 'observation';
  spans: TranscriptionSpan[];
  /** Entire-page notes that are still observations only. */
  pageNotes?: Array<{ pageId: string; note: string }>;
}

export interface NormalizedMathSpan {
  spanId: string;
  sourceSpanId: string;
  latex: string;
  confidence: number;
  citation: Citation;
}

export interface NormalizedMathRecord {
  kind: 'observation';
  spans: NormalizedMathSpan[];
}

export type StepNodeStatus =
  | 'observed'
  | 'correct'
  | 'ambiguous'
  | 'broken'
  | 'pending'
  | 'illegible'
  | 'absent';

export interface StepNode {
  stepId: string;
  citation: Citation;
  verbatim?: string;
  normalizedLatex?: string;
  status: StepNodeStatus;
  /** Dependency edges to prior steps (supports non-linear graphs). */
  dependsOn: string[];
  /** True when this path is a valid alternate method. */
  alternateMethod?: boolean;
  methodLabel?: string;
}

export interface StepGraphRecord {
  kind: 'observation';
  steps: StepNode[];
}

export interface EvidenceAlignmentItem {
  stepId: string;
  rubricItemId?: string;
  citation: Citation;
  /** Grounding confidence for the visual claim. */
  groundingConfidence: number;
  supported: boolean;
  reason: string;
}

export interface EvidenceAlignmentRecord {
  kind: 'observation';
  items: EvidenceAlignmentItem[];
}

export type MistakeFamily =
  | 'conceptual_gap'
  | 'wrong_understanding'
  | 'procedure_error'
  | 'silly_mistake'
  | 'unclear_evidence'
  | 'none';

export interface FirstCausalErrorRecord {
  kind: 'inference';
  /** Null when no causal error is established (correct, unclear, or abstain). */
  stepId: string | null;
  citation: Citation | null;
  mistakeFamily: MistakeFamily;
  explanation: string;
  /** True when localization is provisional / not verifier-confirmed. */
  provisional: boolean;
}

export type PedagogicalAction =
  | 'recapture'
  | 'clarify'
  | 'tentative_feedback'
  | 'definitive_diagnosis'
  | 'abstain';

export interface PedagogicalResponseRecord {
  kind: 'response';
  action: PedagogicalAction;
  coachMessage: string;
  /** Precise missing piece when action is recapture/clarify. */
  preciseRequest?: string;
  nextMove?: 'try_again' | 'see_fix' | 'micro_drill' | 'next_question' | 'clarify';
  citations: Citation[];
}

export type StateEligibilityDecision =
  | 'ineligible_capture_failure'
  | 'ineligible_insufficient_evidence'
  | 'ineligible_missing_citation'
  | 'ineligible_verifier_disagree'
  | 'ineligible_alternate_method_uncovered'
  | 'ineligible_absent_work'
  | 'observation_only'
  | 'needs_confirmation'
  | 'eligible_after_probe'
  | 'blocked_no_persistent_from_single_photo';

export interface StateEligibilityRecord {
  kind: 'state_eligibility';
  decision: StateEligibilityDecision;
  /** Never mastery / persistent misconception from a single photo. */
  mayProposePersistentChange: false;
  mayAddReversibleObservation: boolean;
  mayAddNeedsConfirmation: boolean;
  reason: string;
}

export type ObservationClaimKind =
  | 'visible_text'
  | 'normalized_math'
  | 'step_boundary'
  | 'page_presence';

export interface ObservationClaim {
  claimId: string;
  kind: ObservationClaimKind;
  citation: Citation;
  text: string;
  confidence: number;
}

export interface InferenceClaim {
  claimId: string;
  kind: 'diagnosis' | 'mistake_family' | 'method_validity';
  citation: Citation | null;
  text: string;
  confidence: number;
  dependsOnObservationIds: string[];
}

export interface PersistentStateProposal {
  proposalId: string;
  conceptId: string;
  claim: string;
  /** Single-photo proposals are always reversible / needs_confirmation. */
  mode: 'needs_confirmation' | 'observation';
  eligible: boolean;
  blockingReasons: string[];
}

/** Independent verifier judgment for definitive / state-changing output. */
export type VerifierVerdict =
  | 'agree'
  | 'disagree'
  | 'abstain'
  | 'insufficient_evidence';

export interface VerifierReport {
  verdict: VerifierVerdict;
  /** Whether citations are visually supported. */
  citationsSupported: boolean;
  unsupportedClaims: string[];
  answerLeakageDetected: boolean;
  notes?: string;
}

export type DiagnosisOutputMode =
  | 'recapture'
  | 'clarify'
  | 'tentative'
  | 'definitive'
  | 'blocked';

export interface DiagnosisRiskMetrics {
  /** Evaluation targets from research policy (not runtime invent-thresholds). */
  targets: ActionRiskBudgets;
  /** Observed structural signals for this attempt. */
  observed: {
    evidenceTier: EvidenceSufficiencyTier;
    hasUnsupportedVisualClaim: boolean;
    answerLeakage: boolean;
    verifierAgree: boolean;
    captureFailure: boolean;
  };
  /** Action allowed after gates. */
  allowedAction: DiagnosisOutputMode;
}

/** Fixed evaluation risk budgets from RESEARCH_SYNTHESIS_AND_DECISIONS §2.2. */
export interface ActionRiskBudgets {
  insufficientAcceptedAsReadableMax: number;
  falsePraiseMax: number;
  falseCorrectionMax: number;
  wrongFirstCausalErrorMax: number;
  unsupportedStateUpdateMax: number;
  answerLeakageMax: number;
  definitiveCoverageMin: number;
  usefulNextActionMin: number;
}

export const DEFAULT_ACTION_RISK_BUDGETS: ActionRiskBudgets = {
  insufficientAcceptedAsReadableMax: 0.05,
  falsePraiseMax: 0.01,
  falseCorrectionMax: 0.02,
  wrongFirstCausalErrorMax: 0.1,
  unsupportedStateUpdateMax: 0.005,
  answerLeakageMax: 0,
  definitiveCoverageMin: 0.7,
  usefulNextActionMin: 0.9,
};

/** Full staged diagnosis bundle produced by the W2 core. */
export interface StagedDiagnosisBundle {
  schemaVersion: typeof DIAGNOSIS_SCHEMA_VERSION;
  capture: DiagnosisCaptureMetadata;
  captureAssessment: CaptureAssessment;
  transcription: VerbatimTranscriptionRecord;
  normalizedMath: NormalizedMathRecord;
  stepGraph: StepGraphRecord;
  evidenceAlignment: EvidenceAlignmentRecord;
  firstCausalError: FirstCausalErrorRecord;
  response: PedagogicalResponseRecord;
  stateEligibility: StateEligibilityRecord;
  observations: ObservationClaim[];
  inferences: InferenceClaim[];
  stateProposals: PersistentStateProposal[];
  verifier: VerifierReport | null;
  risk: DiagnosisRiskMetrics;
  outputMode: DiagnosisOutputMode;
}

/** Model/raw stage payload before gating (may be incomplete). */
export interface RawStagedDiagnosisInput {
  capture: DiagnosisCaptureMetadata;
  captureAssessment?: Partial<CaptureAssessment> & { tier?: EvidenceSufficiencyTier };
  transcription?: Partial<VerbatimTranscriptionRecord>;
  normalizedMath?: Partial<NormalizedMathRecord>;
  stepGraph?: Partial<StepGraphRecord>;
  evidenceAlignment?: Partial<EvidenceAlignmentRecord>;
  firstCausalError?: Partial<FirstCausalErrorRecord>;
  response?: Partial<PedagogicalResponseRecord>;
  observations?: ObservationClaim[];
  inferences?: InferenceClaim[];
  stateProposals?: PersistentStateProposal[];
  verifier?: VerifierReport | null;
  /** Final answer / option keys that must never appear in student-facing text. */
  forbiddenAnswerTokens?: string[];
}
