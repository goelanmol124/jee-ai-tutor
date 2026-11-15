import type { DiagnosisCaptureMetadata, DiagnosisPageInput } from './types';

export const MAX_DIAGNOSIS_PAGES = 8;
export const MAX_OCR_CHARS_PER_PAGE = 8_000;

export interface MultiPageInputValidation {
  ok: boolean;
  errors: string[];
  capture?: DiagnosisCaptureMetadata;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parsePage(raw: unknown, index: number): DiagnosisPageInput | string {
  if (!isObj(raw)) return `pages[${index}] must be an object`;
  const pageId = typeof raw.pageId === 'string' ? raw.pageId.trim() : '';
  if (!pageId) return `pages[${index}].pageId is required`;
  const order = typeof raw.order === 'number' && Number.isInteger(raw.order) ? raw.order : NaN;
  if (!Number.isFinite(order) || order < 1) return `pages[${index}].order must be a 1-based integer`;

  const page: DiagnosisPageInput = { pageId, order };
  if (typeof raw.imageRef === 'string') page.imageRef = raw.imageRef;
  if (typeof raw.widthPx === 'number') page.widthPx = raw.widthPx;
  if (typeof raw.heightPx === 'number') page.heightPx = raw.heightPx;
  if (typeof raw.orientationDeg === 'number') page.orientationDeg = raw.orientationDeg;
  if (
    raw.clientReadableHint === 'readable'
    || raw.clientReadableHint === 'blurry'
    || raw.clientReadableHint === 'glare'
    || raw.clientReadableHint === 'cropped'
    || raw.clientReadableHint === 'unknown'
  ) {
    page.clientReadableHint = raw.clientReadableHint;
  }
  return page;
}

/**
 * Validate ordered multi-page diagnosis input.
 * Preserves student order; rejects gaps, duplicates, and oversize OCR blobs.
 */
export function validateMultiPageInput(raw: unknown): MultiPageInputValidation {
  const errors: string[] = [];
  if (!isObj(raw)) return { ok: false, errors: ['capture must be an object'] };

  const attemptId = typeof raw.attemptId === 'string' ? raw.attemptId.trim() : '';
  const questionId = typeof raw.questionId === 'string' ? raw.questionId.trim() : '';
  const capturedAtIso = typeof raw.capturedAtIso === 'string' ? raw.capturedAtIso.trim() : '';
  if (!attemptId) errors.push('attemptId is required');
  if (!questionId) errors.push('questionId is required');
  if (!capturedAtIso) errors.push('capturedAtIso is required');

  const pagesRaw = Array.isArray(raw.pages) ? raw.pages : null;
  if (!pagesRaw || pagesRaw.length === 0) {
    errors.push('pages must be a non-empty array');
    return { ok: false, errors };
  }
  if (pagesRaw.length > MAX_DIAGNOSIS_PAGES) {
    errors.push(`pages exceeds max of ${MAX_DIAGNOSIS_PAGES}`);
  }

  const pages: DiagnosisPageInput[] = [];
  for (let i = 0; i < pagesRaw.length; i++) {
    const parsed = parsePage(pagesRaw[i], i);
    if (typeof parsed === 'string') errors.push(parsed);
    else pages.push(parsed);
  }

  const ids = new Set<string>();
  for (const p of pages) {
    if (ids.has(p.pageId)) errors.push(`duplicate pageId: ${p.pageId}`);
    ids.add(p.pageId);
  }

  const orders = pages.map((p) => p.order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push('page order must be contiguous starting at 1');
      break;
    }
  }
  const orderSet = new Set(pages.map((p) => p.order));
  if (orderSet.size !== pages.length) errors.push('duplicate page order values');

  const ocrTextByPage: Record<string, string> = {};
  if (raw.ocrTextByPage !== undefined) {
    if (!isObj(raw.ocrTextByPage)) {
      errors.push('ocrTextByPage must be an object');
    } else {
      for (const [pageId, text] of Object.entries(raw.ocrTextByPage)) {
        if (typeof text !== 'string') {
          errors.push(`ocrTextByPage[${pageId}] must be a string`);
          continue;
        }
        if (!ids.has(pageId) && pages.length > 0) {
          errors.push(`ocrTextByPage references unknown pageId: ${pageId}`);
        }
        if (text.length > MAX_OCR_CHARS_PER_PAGE) {
          errors.push(`ocrTextByPage[${pageId}] exceeds ${MAX_OCR_CHARS_PER_PAGE} chars`);
        }
        ocrTextByPage[pageId] = text;
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const sorted = [...pages].sort((a, b) => a.order - b.order);
  const capture: DiagnosisCaptureMetadata = {
    attemptId,
    questionId,
    capturedAtIso,
    pageCount: sorted.length,
    pages: sorted,
    typedWork: typeof raw.typedWork === 'string' ? raw.typedWork : undefined,
    ocrTextByPage: Object.keys(ocrTextByPage).length > 0 ? ocrTextByPage : undefined,
    deviceClass: typeof raw.deviceClass === 'string' ? raw.deviceClass : undefined,
    uploadPath:
      raw.uploadPath === 'camera' || raw.uploadPath === 'gallery' || raw.uploadPath === 'unknown'
        ? raw.uploadPath
        : undefined,
  };

  return { ok: true, errors: [], capture };
}

/** Sort pages by order; used by adapters that already trust ids. */
export function orderPages(pages: DiagnosisPageInput[]): DiagnosisPageInput[] {
  return [...pages].sort((a, b) => a.order - b.order);
}
