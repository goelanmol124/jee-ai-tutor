import { PROHIBITED_DATA_FIELDS, type ProhibitedDataField } from './types.ts';

export class ProhibitedDataError extends Error {
  readonly fields: ProhibitedDataField[];

  constructor(fields: ProhibitedDataField[]) {
    super(`Prohibited personal data fields rejected: ${fields.join(', ')}`);
    this.name = 'ProhibitedDataError';
    this.fields = fields;
  }
}

function normalizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/** Reject payloads that attempt to collect prohibited categories. */
export function assertNoProhibitedData(payload: Record<string, unknown>): void {
  const hits = new Set<ProhibitedDataField>();
  for (const rawKey of Object.keys(payload)) {
    const key = normalizeKey(rawKey) as ProhibitedDataField;
    if ((PROHIBITED_DATA_FIELDS as readonly string[]).includes(key)) {
      hits.add(key);
    }
  }
  // Common aliases
  if ('dob' in payload || 'birth_date' in payload || 'birthDate' in payload) {
    hits.add('full_dob');
  }
  if ('aadhar' in payload || 'aadhaar_number' in payload) {
    hits.add('aadhaar');
  }
  if (hits.size > 0) {
    throw new ProhibitedDataError([...hits]);
  }
}
