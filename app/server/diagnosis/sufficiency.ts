import type {
  CaptureAssessment,
  CaptureIssue,
  EvidenceSufficiencyTier,
  RawStagedDiagnosisInput,
} from './types';

const CAPTURE_FAILURE_KINDS = new Set([
  'missing_page',
  'unreadable_region',
  'blur',
  'glare',
  'crop',
  'wrong_orientation',
  'absent_work',
  'ocr_failure',
  'order_gap',
]);

/**
 * Assess capture sufficiency. Missing/unreadable/absent work is a capture
 * failure — never learner-failure evidence.
 */
export function assessCaptureSufficiency(input: RawStagedDiagnosisInput): CaptureAssessment {
  const pages = [...input.capture.pages].sort((a, b) => a.order - b.order);
  const orderedPageIds = pages.map((p) => p.pageId);
  const issues: CaptureIssue[] = [...(input.captureAssessment?.issues ?? [])];

  // Contiguous order gaps (should already be rejected by input validation, but
  // still surface for partial/legacy payloads).
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].order !== i + 1) {
      issues.push({
        kind: 'order_gap',
        request: 'Please reorder pages so they run 1…N with no gaps.',
      });
      break;
    }
  }

  for (const page of pages) {
    if (page.clientReadableHint === 'blurry') {
      issues.push({
        kind: 'blur',
        pageId: page.pageId,
        request: `Retake page ${page.order} with the camera steadier so the writing is sharp.`,
      });
    } else if (page.clientReadableHint === 'glare') {
      issues.push({
        kind: 'glare',
        pageId: page.pageId,
        request: `Retake page ${page.order} without glare on the ink.`,
      });
    } else if (page.clientReadableHint === 'cropped') {
      issues.push({
        kind: 'crop',
        pageId: page.pageId,
        request: `Retake page ${page.order} so all margins and steps are fully in frame.`,
      });
    }
  }

  // Explicit missing-page signals from upstream assessment
  const hasMissing = issues.some((i) => i.kind === 'missing_page');
  const hasUnreadable = issues.some((i) =>
    i.kind === 'unreadable_region' || i.kind === 'blur' || i.kind === 'glare' || i.kind === 'crop' || i.kind === 'ocr_failure',
  );
  const hasAbsentWork = issues.some((i) => i.kind === 'absent_work');

  const declaredTier = input.captureAssessment?.tier;
  let tier: EvidenceSufficiencyTier = declaredTier ?? 'moderate';

  if (hasMissing || hasAbsentWork) {
    tier = 'insufficient';
  } else if (hasUnreadable && (declaredTier === undefined || declaredTier === 'high' || declaredTier === 'moderate')) {
    tier = 'low';
  } else if (declaredTier) {
    tier = declaredTier;
  }

  // Empty page set or no image refs and no typed work → absent work
  const noImages = pages.every((p) => !p.imageRef);
  const noTyped = !(input.capture.typedWork && input.capture.typedWork.trim());
  if (pages.length === 0 || (noImages && noTyped && !hasAbsentWork)) {
    issues.push({
      kind: 'absent_work',
      request: 'Upload at least one page of working, or type one line of your first step.',
    });
    tier = 'insufficient';
  }

  const isCaptureFailure = issues.some((i) => CAPTURE_FAILURE_KINDS.has(i.kind)) || tier === 'insufficient';

  return {
    tier,
    issues,
    isCaptureFailure,
    orderedPageIds,
  };
}

export function preciseRequestFromIssues(issues: CaptureIssue[]): string {
  if (issues.length === 0) return 'Please send one clearer page of the missing step.';
  // Prefer the most specific single request
  const missing = issues.find((i) => i.kind === 'missing_page');
  if (missing) return missing.request;
  const unreadable = issues.find((i) =>
    i.kind === 'unreadable_region' || i.kind === 'blur' || i.kind === 'glare' || i.kind === 'crop',
  );
  if (unreadable) return unreadable.request;
  return issues[0].request;
}

export function tierAllowsDefinitive(tier: EvidenceSufficiencyTier): boolean {
  return tier === 'high';
}

export function tierAllowsTentative(tier: EvidenceSufficiencyTier): boolean {
  return tier === 'moderate' || tier === 'high';
}
