import { queryAll, queryOne, type PilotSqlDb } from './db.ts';
import { newOpaqueId, nowIso } from './ids.ts';
import {
  assertLaunchGatesOrThrow,
  requireParentVerificationConfigured,
  type PilotLaunchConfig,
  LaunchGateError,
} from './launchGates.ts';
import { setEnrollmentState, getEnrollmentState } from './identity.ts';
import type {
  AssentDecision,
  ConsentDecision,
  ConsentPurpose,
  EnrollmentState,
} from './types.ts';

export const REQUIRED_PARTICIPATION_PURPOSE: ConsentPurpose = 'account_tutor_operation';

export const OPTIONAL_PURPOSES: ConsentPurpose[] = [
  'transient_photo_diagnosis',
  'raw_photo_research_evaluation',
  'coded_research_evaluation',
  'recontact',
];

export const ALL_PURPOSES: ConsentPurpose[] = [
  REQUIRED_PARTICIPATION_PURPOSE,
  ...OPTIONAL_PURPOSES,
];

export type PurposeDecision = {
  purpose: ConsentPurpose;
  decision: Exclude<ConsentDecision, 'withdrawn'>;
};

export type RecordConsentInput = {
  studentId: string;
  actorRole: 'adult_participant' | 'parent_guardian';
  noticeVersion: string;
  retentionVersion: string;
  dataCategories: string[];
  processorList: string[];
  purposes: PurposeDecision[];
  verificationMethod?: string;
  verificationResult?: string;
};

/**
 * Record parent verification result token only — never government-ID images.
 * Requires an explicit configured provider; does not fabricate verification.
 */
export function recordParentVerification(
  db: PilotSqlDb,
  studentId: string,
  input: {
    verificationResultToken: string;
    guardianDeclaration: 'parent' | 'lawful_guardian';
  },
  launchConfig: PilotLaunchConfig = {},
): EnrollmentState {
  assertLaunchGatesOrThrow(launchConfig);
  let provider: string;
  try {
    provider = requireParentVerificationConfigured(launchConfig);
  } catch (err) {
    setEnrollmentState(db, studentId, 'parent_verification_blocked', {
      reason: err instanceof LaunchGateError ? err.message : 'verification provider missing',
    });
    throw err;
  }

  const state = getEnrollmentState(db, studentId);
  if (state !== 'parent_verification_pending' && state !== 'parent_verification_blocked') {
    throw new Error(`Cannot verify parent from state ${state}`);
  }

  const now = nowIso();
  db.run(
    `UPDATE pilot_parent_accounts SET
      verification_status = ?,
      verification_method = ?,
      verification_result_token = ?,
      guardian_declaration = ?,
      updated_at = ?
     WHERE student_id = ?`,
    ['verified', provider, input.verificationResultToken, input.guardianDeclaration, now, studentId],
  );
  setEnrollmentState(db, studentId, 'parent_permission_pending');
  return 'parent_permission_pending';
}

function validatePurposeSet(purposes: PurposeDecision[], actorRole: RecordConsentInput['actorRole']): void {
  const map = new Map(purposes.map((p) => [p.purpose, p.decision]));
  if (!map.has(REQUIRED_PARTICIPATION_PURPOSE)) {
    throw new Error('account_tutor_operation purpose decision is required');
  }
  if (map.get(REQUIRED_PARTICIPATION_PURPOSE) !== 'granted') {
    throw new Error('Participation requires granting account_tutor_operation');
  }
  // Optional purposes must be explicit; silent defaults are not allowed for research/photo retention
  for (const purpose of OPTIONAL_PURPOSES) {
    if (!map.has(purpose)) {
      throw new Error(`Missing explicit decision for purpose ${purpose}`);
    }
  }
  if (actorRole === 'parent_guardian' || actorRole === 'adult_participant') {
    return;
  }
  throw new Error('Invalid consent actor');
}

export function recordGranularConsent(db: PilotSqlDb, input: RecordConsentInput): {
  receiptId: string;
  enrollmentState: EnrollmentState;
} {
  validatePurposeSet(input.purposes, input.actorRole);
  const state = getEnrollmentState(db, input.studentId);
  if (!state) throw new Error('Unknown student');

  if (input.actorRole === 'parent_guardian') {
    if (state !== 'parent_permission_pending') {
      throw new Error(`Parent permission not expected in state ${state}`);
    }
    const parent = queryOne(
      db,
      `SELECT verification_status FROM pilot_parent_accounts WHERE student_id = ?`,
      [input.studentId],
    );
    if (!parent || String(parent.verification_status) !== 'verified') {
      throw new Error('Parent must be verified before permission');
    }
  } else if (input.actorRole === 'adult_participant') {
    if (state !== 'adult_consent_pending' && state !== 'adult_notice_pending' && state !== 'suspended_age_transition') {
      throw new Error(`Adult consent not expected in state ${state}`);
    }
  }

  const receiptId = newOpaqueId('rcpt');
  const now = nowIso();
  for (const purpose of input.purposes) {
    db.run(
      `INSERT INTO pilot_consent_records (
        consent_id, student_id, actor_role, purpose, decision, notice_version,
        retention_version, data_categories_json, processor_list_json, recorded_at,
        verification_method, verification_result, receipt_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newOpaqueId('cns'),
        input.studentId,
        input.actorRole,
        purpose.purpose,
        purpose.decision,
        input.noticeVersion,
        input.retentionVersion,
        JSON.stringify(input.dataCategories),
        JSON.stringify(input.processorList),
        now,
        input.verificationMethod ?? null,
        input.verificationResult ?? null,
        receiptId,
      ],
    );
  }

  let next: EnrollmentState;
  if (input.actorRole === 'parent_guardian') {
    next = 'awaiting_child_assent';
  } else {
    next = 'active';
  }
  setEnrollmentState(db, input.studentId, next, { receiptId });
  return { receiptId, enrollmentState: next };
}

/** Advance adult from notice_pending to consent_pending after notice acknowledgement. */
export function acknowledgeAdultNotice(db: PilotSqlDb, studentId: string, noticeVersion: string): EnrollmentState {
  const state = getEnrollmentState(db, studentId);
  if (state !== 'adult_notice_pending' && state !== 'suspended_age_transition') {
    throw new Error(`Adult notice not expected in state ${state}`);
  }
  setEnrollmentState(db, studentId, 'adult_consent_pending', { noticeVersion });
  return 'adult_consent_pending';
}

/**
 * Child assent. Dissent is respected even when parent permission was granted.
 */
export function recordChildAssent(
  db: PilotSqlDb,
  studentId: string,
  decision: AssentDecision,
  noticeVersion: string,
): EnrollmentState {
  const state = getEnrollmentState(db, studentId);
  if (state !== 'awaiting_child_assent') {
    throw new Error(`Child assent not expected in state ${state}`);
  }
  const now = nowIso();
  db.run(
    `INSERT INTO pilot_assent_records (assent_id, student_id, decision, notice_version, recorded_at)
     VALUES (?, ?, ?, ?, ?)`,
    [newOpaqueId('ast'), studentId, decision, noticeVersion, now],
  );
  const next: EnrollmentState = decision === 'assented' ? 'active' : 'child_dissented';
  setEnrollmentState(db, studentId, next);
  return next;
}

export function latestPurposeDecision(
  db: PilotSqlDb,
  studentId: string,
  purpose: ConsentPurpose,
): ConsentDecision | 'absent' {
  const row = queryOne(
    db,
    `SELECT decision FROM pilot_consent_records
     WHERE student_id = ? AND purpose = ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [studentId, purpose],
  );
  if (!row) return 'absent';
  return String(row.decision) as ConsentDecision;
}

export function getConsentStatusMap(
  db: PilotSqlDb,
  studentId: string,
): Record<ConsentPurpose, ConsentDecision | 'absent'> {
  const out = {} as Record<ConsentPurpose, ConsentDecision | 'absent'>;
  for (const purpose of ALL_PURPOSES) {
    out[purpose] = latestPurposeDecision(db, studentId, purpose);
  }
  return out;
}

export function withdrawPurpose(
  db: PilotSqlDb,
  studentId: string,
  purpose: ConsentPurpose,
  actorRole: 'adult_participant' | 'parent_guardian' | 'student' | 'support',
): void {
  const current = latestPurposeDecision(db, studentId, purpose);
  if (current === 'absent' || current === 'withdrawn') {
    throw new Error(`No active consent for ${purpose}`);
  }
  const prior = queryOne(
    db,
    `SELECT * FROM pilot_consent_records
     WHERE student_id = ? AND purpose = ?
     ORDER BY recorded_at DESC LIMIT 1`,
    [studentId, purpose],
  );
  if (!prior) throw new Error('Consent record missing');
  const now = nowIso();
  db.run(
    `UPDATE pilot_consent_records SET withdrawn_at = ?, decision = 'withdrawn'
     WHERE consent_id = ?`,
    [now, prior.consent_id],
  );
  db.run(
    `INSERT INTO pilot_consent_records (
      consent_id, student_id, actor_role, purpose, decision, notice_version,
      retention_version, data_categories_json, processor_list_json, recorded_at, receipt_id
    ) VALUES (?, ?, ?, ?, 'withdrawn', ?, ?, ?, ?, ?, ?)`,
    [
      newOpaqueId('cns'),
      studentId,
      actorRole,
      purpose,
      prior.notice_version,
      prior.retention_version,
      prior.data_categories_json,
      prior.processor_list_json,
      now,
      newOpaqueId('rcpt'),
    ],
  );

  if (purpose === REQUIRED_PARTICIPATION_PURPOSE) {
    setEnrollmentState(db, studentId, 'withdrawn');
  }
}

export function listConsentReceipts(db: PilotSqlDb, studentId: string): Record<string, unknown>[] {
  return queryAll(
    db,
    `SELECT * FROM pilot_consent_records WHERE student_id = ? ORDER BY recorded_at ASC`,
    [studentId],
  );
}

export function isProcessingAllowed(db: PilotSqlDb, studentId: string): boolean {
  const state = getEnrollmentState(db, studentId);
  if (state !== 'active') return false;
  return latestPurposeDecision(db, studentId, REQUIRED_PARTICIPATION_PURPOSE) === 'granted';
}

export function isPhotoDiagnosisAllowed(db: PilotSqlDb, studentId: string): boolean {
  return (
    isProcessingAllowed(db, studentId) &&
    latestPurposeDecision(db, studentId, 'transient_photo_diagnosis') === 'granted'
  );
}

export function isResearchPhotoRetentionAllowed(db: PilotSqlDb, studentId: string): boolean {
  return (
    isProcessingAllowed(db, studentId) &&
    latestPurposeDecision(db, studentId, 'raw_photo_research_evaluation') === 'granted'
  );
}
