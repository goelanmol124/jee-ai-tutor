import type { CapturePage, RecaptureHint } from '../domain/pilotExperience';

export function makePageId(): string {
  return `pg_${Math.random().toString(36).slice(2, 10)}`;
}

export function renumberPages(pages: CapturePage[]): CapturePage[] {
  return pages.map((page, index) => ({ ...page, pageNumber: index + 1 }));
}

export function addCapturePage(
  pages: CapturePage[],
  input: { previewUrl: string; file?: File; fileName?: string },
): CapturePage[] {
  const next: CapturePage = {
    id: makePageId(),
    pageNumber: pages.length + 1,
    previewUrl: input.previewUrl,
    file: input.file,
    fileName: input.fileName ?? input.file?.name,
    capturedAt: new Date().toISOString(),
  };
  return renumberPages([...pages, next]);
}

export function removeCapturePage(pages: CapturePage[], pageId: string): CapturePage[] {
  return renumberPages(pages.filter((p) => p.id !== pageId));
}

export function moveCapturePage(
  pages: CapturePage[],
  pageId: string,
  direction: 'up' | 'down',
): CapturePage[] {
  const index = pages.findIndex((p) => p.id === pageId);
  if (index < 0) return pages;
  const target = direction === 'up' ? index - 1 : index + 1;
  if (target < 0 || target >= pages.length) return pages;
  const next = [...pages];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return renumberPages(next);
}

export function replaceCapturePage(
  pages: CapturePage[],
  pageId: string,
  input: { previewUrl: string; file?: File; fileName?: string },
): CapturePage[] {
  return renumberPages(
    pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            previewUrl: input.previewUrl,
            file: input.file,
            fileName: input.fileName ?? input.file?.name,
            capturedAt: new Date().toISOString(),
          }
        : page,
    ),
  );
}

export function pagesToPersistable(pages: CapturePage[]): Array<{
  id: string;
  pageNumber: number;
  previewUrl: string;
  fileName?: string;
  capturedAt: string;
}> {
  return pages.map(({ id, pageNumber, previewUrl, fileName, capturedAt }) => ({
    id,
    pageNumber,
    previewUrl,
    fileName,
    capturedAt,
  }));
}

export function pagesFromPersisted(
  pages: Array<{
    id: string;
    pageNumber: number;
    previewUrl: string;
    fileName?: string;
    capturedAt: string;
  }>,
): CapturePage[] {
  return renumberPages(
    [...pages]
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .map((p) => ({
        id: p.id,
        pageNumber: p.pageNumber,
        previewUrl: p.previewUrl,
        fileName: p.fileName,
        capturedAt: p.capturedAt,
      })),
  );
}

export function recaptureHintCopy(hint: RecaptureHint): string {
  switch (hint) {
    case 'retake_page':
      return 'Retake this page so the writing is fully in frame.';
    case 'add_missing_page':
      return 'Add the missing page, then reorder if needed.';
    case 'brighter_lighting':
      return 'Retake with brighter, even lighting — avoid glare.';
    case 'flatten_page':
      return 'Flatten the page and retake so lines stay straight.';
    case 'crop_tighter':
      return 'Fill the frame with your working and retake.';
    case 'write_darker':
      return 'Rewrite a touch darker, then retake that page.';
  }
}
