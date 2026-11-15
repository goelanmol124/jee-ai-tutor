import { describe, expect, it } from 'vitest';
import {
  addCapturePage,
  moveCapturePage,
  removeCapturePage,
  renumberPages,
  replaceCapturePage,
} from './photoPages';
import type { CapturePage } from '../domain/pilotExperience';

function page(partial: Partial<CapturePage> & { id: string; pageNumber: number }): CapturePage {
  return {
    previewUrl: `data:image/png;base64,${partial.id}`,
    capturedAt: '2026-07-18T00:00:00.000Z',
    ...partial,
  };
}

describe('photoPages', () => {
  it('adds pages with sequential numbering', () => {
    let pages: CapturePage[] = [];
    pages = addCapturePage(pages, { previewUrl: 'a' });
    pages = addCapturePage(pages, { previewUrl: 'b' });
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(pages[1].previewUrl).toBe('b');
  });

  it('reorders, removes, and renumbers', () => {
    let pages = [
      page({ id: 'a', pageNumber: 1, previewUrl: 'a' }),
      page({ id: 'b', pageNumber: 2, previewUrl: 'b' }),
      page({ id: 'c', pageNumber: 3, previewUrl: 'c' }),
    ];
    pages = moveCapturePage(pages, 'c', 'up');
    expect(pages.map((p) => p.id)).toEqual(['a', 'c', 'b']);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2, 3]);
    pages = removeCapturePage(pages, 'a');
    expect(pages.map((p) => p.id)).toEqual(['c', 'b']);
    expect(pages.map((p) => p.pageNumber)).toEqual([1, 2]);
  });

  it('replaces a page for precise recapture', () => {
    let pages = [page({ id: 'a', pageNumber: 1, previewUrl: 'old' })];
    pages = replaceCapturePage(pages, 'a', { previewUrl: 'new', fileName: 'retake.jpg' });
    expect(pages[0].previewUrl).toBe('new');
    expect(pages[0].fileName).toBe('retake.jpg');
    expect(renumberPages(pages)[0].pageNumber).toBe(1);
  });
});
