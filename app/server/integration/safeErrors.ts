/**
 * Structured API errors that never leak model content, credentials, or PII.
 */

export type SafeErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'enrollment_blocked'
  | 'launch_gate'
  | 'holdout_ineligible'
  | 'cohort_required'
  | 'integration_gap'
  | 'upstream_unavailable'
  | 'internal';

export class SafeApiError extends Error {
  readonly code: SafeErrorCode;
  readonly status: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: SafeErrorCode,
    message: string,
    status: number,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'SafeApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function safeErrorBody(error: unknown): {
  ok: false;
  error: string;
  code: SafeErrorCode;
  details?: Record<string, unknown>;
} {
  if (error instanceof SafeApiError) {
    return {
      ok: false,
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  // Never echo raw upstream / credential / content strings to clients.
  return {
    ok: false,
    error: 'Request could not be completed.',
    code: 'internal',
  };
}

export function logServerError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Truncate and avoid dumping request bodies or API keys.
  console.warn(`[${scope}]`, message.slice(0, 240));
}
