import { applyPilot001Migration, PILOT_MIGRATION_ID } from './pilot_001_identity_consent.ts';
import {
  applyPilot002ConversationsMigration,
  applyPilot002LearningMigration,
  applyPilot002PhotosMigration,
  applyPilot002ResearchMigration,
  applyPilot002SecurityLogsMigration,
  PILOT_MIGRATION_002_ID,
} from './pilot_002_separated_stores.ts';
import {
  applyPilot003IdentityMigration,
  applyPilot003LearningMigration,
  applyPilot003ResearchMigration,
  PILOT_MIGRATION_003_ID,
} from './pilot_003_integration_spine.ts';

export {
  applyPilot001Migration,
  applyPilot002ConversationsMigration,
  applyPilot002LearningMigration,
  applyPilot002PhotosMigration,
  applyPilot002ResearchMigration,
  applyPilot002SecurityLogsMigration,
  applyPilot003IdentityMigration,
  applyPilot003LearningMigration,
  applyPilot003ResearchMigration,
  PILOT_MIGRATION_ID,
  PILOT_MIGRATION_002_ID,
  PILOT_MIGRATION_003_ID,
};

export type MigratableDb = {
  run: (sql: string, params?: unknown[]) => void;
};

/** Apply identity/consent vault migrations. */
export function applyIdentityConsentMigrations(db: MigratableDb): void {
  applyPilot001Migration(db);
  applyPilot003IdentityMigration(db);
}

/** Apply all separated-store migrations to their respective databases. */
export function applySeparatedStoreMigrations(stores: {
  learning: MigratableDb;
  conversations: MigratableDb;
  photos: MigratableDb;
  research: MigratableDb;
  securityLogs: MigratableDb;
}): void {
  applyPilot002LearningMigration(stores.learning);
  applyPilot002ConversationsMigration(stores.conversations);
  applyPilot002PhotosMigration(stores.photos);
  applyPilot002ResearchMigration(stores.research);
  applyPilot002SecurityLogsMigration(stores.securityLogs);
  applyPilot003LearningMigration(stores.learning);
  applyPilot003ResearchMigration(stores.research);
}
