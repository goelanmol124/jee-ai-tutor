/**
 * W3 learner-policy types. Kept local so domain contracts stay owned by other
 * workstreams; integration can promote these later.
 */

export type PrerequisiteClass =
  | 'critical'
  | 'supporting'
  | 'optional'
  | 'alternative_method';

/** Only maker / expert / empirical provenance may hard-gate. */
export type EdgeProvenance =
  | 'maker_approved'
  | 'expert_reviewed'
  | 'empirically_validated'
  | 'llm_proposed'
  | 'co_occurrence_only'
  | 'unknown';

export type AssistanceLevel =
  | 'independent'
  | 'one_hint'
  | 'splice'
  | 'worked_example_transition'
  | 'review';

export type LearnerCohort = 'class_11' | 'class_12' | 'dropper';

export type TurnObjective =
  | 'orientation'
  | 'due_review'
  | 'diagnostic_probe'
  | 'critical_repair'
  | 'acquisition'
  | 'discrimination'
  | 'independent_application'
  | 'exam_integration';

export interface AnnotatedPrereqEdge {
  /** Prerequisite concept */
  from: string;
  /** Dependent / target concept or question anchor concept */
  to: string;
  edgeClass: PrerequisiteClass;
  provenance: EdgeProvenance;
  confidence?: number;
  solutionPathId?: string;
  /** High-centrality flag for false-advancement cost */
  highCentrality?: boolean;
}

export interface StretchPriorConfig {
  /** Predicted success target per assistance level (80/20 prior defaults to 0.8). */
  targetSuccessByAssistance: Record<AssistanceLevel, number>;
  /** Half-width of the soft band around the target (legacy ~0.2 → ~0.4 full width). */
  bandHalfWidthByAssistance: Record<AssistanceLevel, number>;
}

export interface ReviewBudgetConfig {
  /** Default session share reserved for reviews (0.20). */
  defaultShare: number;
  /** Hard cap without explicit learner choice (0.30). */
  maxShare: number;
}

export interface ReviewBudgetState {
  sessionItemCount: number;
  reviewItemsUsed: number;
  /** Concepts the learner deferred; never increases lapse/penalty. */
  deferredReviewConceptIds: string[];
  /** Explicit choice to spend more than the 30% cap. */
  learnerChoseMoreReview?: boolean;
}

export interface DueWindow {
  opensAt: string;
  idealAt: string;
  /** Soft close — past this is still deferrable, not guilt debt. */
  closesAt?: string;
}

export type EvidenceAssistanceContext =
  | 'independent'
  | 'one_hint'
  | 'splice'
  | 'worked_example'
  | 'review_recall'
  | 'supported_other';

export type LearnerEvidenceSource =
  | 'independent_attempt'
  | 'hinted_attempt'
  | 'worked_example'
  | 'splice'
  | 'recall'
  | 'self_report'
  | 'photo_observation'
  | 'photo_failure'
  | 'confirmation_probe'
  | 'delayed_independent_transfer';

export type EvidenceOutcome =
  | 'success'
  | 'partial'
  | 'fail'
  | 'inconclusive'
  | 'capture_failure';

export interface LearnerEvidenceEvent {
  id: string;
  conceptId: string;
  at: string;
  source: LearnerEvidenceSource;
  assistance: EvidenceAssistanceContext;
  outcome: EvidenceOutcome;
  /** True when the attempt was delayed relative to last study of the concept. */
  delayed?: boolean;
  transfer?: boolean;
  photoId?: string;
  questionId?: string;
  note?: string;
}

export type StateProposalKind =
  | 'observation'
  | 'mastery_hypothesis'
  | 'misconception_hypothesis';

export type StateProposalStatus =
  | 'observation_only'
  | 'needs_confirmation'
  | 'confirmed'
  | 'reversed';

export interface LearnerStateProposal {
  id: string;
  conceptId: string;
  kind: StateProposalKind;
  status: StateProposalStatus;
  evidenceIds: string[];
  createdAt: string;
  reversible: true;
  photoIds: string[];
  rationale: string;
}

export type FalseAdvancementClass =
  | 'critical_high_centrality'
  | 'normal_prerequisite'
  | 'isolated_recall';

/** Cost of false advancement : cost of extra practice */
export type FalseAdvancementCostRatios = Record<FalseAdvancementClass, number>;
