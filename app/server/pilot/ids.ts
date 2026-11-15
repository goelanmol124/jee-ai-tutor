import { createHash, randomBytes } from 'node:crypto';

export function newStudentId(): string {
  return `stu_${randomBytes(16).toString('hex')}`;
}

export function newOpaqueId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('hex')}`;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function newInviteCode(): string {
  return randomBytes(18).toString('base64url');
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function nowIso(): string {
  return new Date().toISOString();
}
