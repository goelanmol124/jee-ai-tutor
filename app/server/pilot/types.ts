/** W1 identity, consent, privacy, and persistence contracts. */

export type AgeBand = 'under_18' | '18_plus';

export type InviteKind = 'enrollment' | 'recovery' | 'child_assent';

export type InviteStatus = 'active' | 'deactivated' | 'consumed' | 'rotated';

export type EnrollmentState =
  | 'invite_issued'
  | 'awaiting_age_band'
  | 'adult_notice_pending'
  | 'adult_consent_pending'
  | 'parent_verification_pending'
  | 'parent_verification_blocked'
  | 'parent_permission_pending'
  | 'awaiting_child_assent'
  | 'active'
  | 'child_dissented'
  | 'withdrawn'
  | 'suspended_age_transition'
  | 'deactivated';

export type ConsentPurpose =
  | 'account_tutor_operation'
  | 'transient_photo_diagnosis'
  | 'raw_photo_research_evaluation'
  | 'coded_research_evaluation'
  | 'recontact';

export type ConsentDecision = 'granted' | 'denied' | 'withdrawn';

export type AssentDecision = 'assented' | 'dissented';

export type DataStoreName =
  | 'identity_consent'
  | 'learning_state'
  | 'conversations'
  | 'transient_photos'
  | 'evaluation_photos'
  | 'security_logs'
  | 'research_extracts';

export type AccessRole =
  | 'student'
  | 'adult_participant'
  | 'parent_guardian'
  | 'education_reviewer'
  | 'photo_annotator'
  | 'research_analyst'
  | 'support'
  | 'safety_admin'
  | 'engineer';

export type RightsRequestType =
  | 'export'
  | 'correction'
  | 'withdrawal'
  | 'deletion'
  | 'session_revocation'
  | 'parent_recovery';

export type RightsRequestStatus = 'pending' | 'completed' | 'rejected' | 'blocked';

/** Fields that must never be collected or persisted by W1 services. */
export const PROHIBITED_DATA_FIELDS = [
  'full_dob',
  'date_of_birth',
  'school_name',
  'address',
  'aadhaar',
  'government_id_copy',
  'precise_location',
  'contacts',
  'caste',
  'religion',
  'income',
  'face_biometric',
  'voice_biometric',
  'handwriting_biometric',
  'emotion_inference',
  'mental_health_inference',
] as const;

export type ProhibitedDataField = (typeof PROHIBITED_DATA_FIELDS)[number];

export type LaunchGateKey =
  | 'legal_entity'
  | 'indian_counsel'
  | 'parent_verification_provider'
  | 'ethics_approval'
  | 'model_zdr'
  | 'safeguarding_personnel';

export type LaunchGateStatus = {
  key: LaunchGateKey;
  configured: boolean;
  blockerMessage: string;
};

export type RetentionCategory =
  | 'operational_raw_photos'
  | 'evaluation_photos'
  | 'tutor_transcripts'
  | 'structured_learner_state'
  | 'identity_recovery'
  | 'consent_receipts'
  | 'security_logs'
  | 'encrypted_backups'
  | 'deletion_tombstones';

export type RetentionPolicy = {
  category: RetentionCategory;
  /** Human-readable rule from the decision memo. */
  rule: string;
  /** Milliseconds from anchor, or null when anchored to pilot closure / ethics decision. */
  maxAgeMs: number | null;
  store: DataStoreName;
};

/** Bounded parent view — must never include transcript/turn content. */
export type ParentProgressSummary = {
  studentId: string;
  accountStatus: EnrollmentState;
  consentStatus: Record<ConsentPurpose, ConsentDecision | 'absent'>;
  independentlyCompletedQuestions: number;
  questionsSuccessfullyRescued: number;
  repeatedErrorCategoriesDeclining: string[];
  delayedReviewRetention: number | null;
  pastSelfTrends: Array<{ label: string; direction: 'up' | 'down' | 'flat' }>;
};

export type SessionResolution = {
  sessionId: string;
  studentId: string;
  ageBand: AgeBand;
  enrollmentState: EnrollmentState;
};

export type ExportBundle = {
  studentId: string;
  exportedAt: string;
  identityConsentReceipts: unknown[];
  learningState: unknown;
  transcriptsWithinRetention: unknown[];
  photoRetentionStatus: unknown;
  processorCategories: string[];
  majorAdminAccesses: unknown[];
};

export type AccessGrant = {
  grantId: string;
  actorId: string;
  actorRole: AccessRole;
  studentId: string | null;
  resourceStore: DataStoreName;
  reasonCode: string;
  caseId: string | null;
  createdAt: string;
  expiresAt: string;
  fields: string[];
};
