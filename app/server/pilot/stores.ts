import type { PilotStoreBundle, PilotSqlDb } from './db.ts';
import type { AccessRole, DataStoreName } from './types.ts';

/** Which roles may read each store under ordinary (non-JIT) access. */
export const STORE_READ_ROLES: Record<DataStoreName, readonly AccessRole[]> = {
  identity_consent: ['student', 'adult_participant', 'parent_guardian', 'support', 'safety_admin'],
  learning_state: ['student', 'adult_participant', 'education_reviewer', 'safety_admin'],
  conversations: ['student', 'adult_participant', 'safety_admin'],
  transient_photos: ['safety_admin'],
  evaluation_photos: ['photo_annotator', 'safety_admin'],
  security_logs: ['safety_admin', 'support'],
  research_extracts: ['research_analyst', 'safety_admin'],
};

/** Parent/guardian never receives conversation/transcript store access. */
export function parentMayAccessStore(store: DataStoreName): boolean {
  return store === 'identity_consent' || store === 'learning_state';
}

export function roleMayReadStore(role: AccessRole, store: DataStoreName): boolean {
  if (role === 'engineer') return false;
  if (role === 'parent_guardian') return parentMayAccessStore(store);
  return STORE_READ_ROLES[store].includes(role);
}

export function dbForStore(bundle: PilotStoreBundle, store: DataStoreName): PilotSqlDb {
  switch (store) {
    case 'identity_consent':
      return bundle.identityConsent;
    case 'learning_state':
      return bundle.learningState;
    case 'conversations':
      return bundle.conversations;
    case 'transient_photos':
      return bundle.transientPhotos;
    case 'evaluation_photos':
      return bundle.evaluationPhotos;
    case 'security_logs':
      return bundle.securityLogs;
    case 'research_extracts':
      return bundle.researchExtracts;
    default: {
      const _exhaustive: never = store;
      throw new Error(`Unknown store: ${_exhaustive}`);
    }
  }
}

/** Opaque stu_* key is the only cross-store join key outside the identity vault. */
export function assertOpaqueStudentKey(studentId: string): void {
  if (!/^stu_[a-f0-9]{32}$/.test(studentId)) {
    throw new Error('Cross-store references must use opaque stu_* identifiers');
  }
}
