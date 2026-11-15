import { describe, expect, it } from 'vitest';
import {
  SESSION_DRAFT_KEY,
  buildSessionDraft,
  clearSessionDraft,
  loadSessionDraft,
  saveSessionDraft,
  shouldResumeDraft,
} from './sessionDraft';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() { return this.map.size; }
  clear() { this.map.clear(); }
  getItem(key: string) { return this.map.get(key) ?? null; }
  key(index: number) { return Array.from(this.map.keys())[index] ?? null; }
  removeItem(key: string) { this.map.delete(key); }
  setItem(key: string, value: string) { this.map.set(key, value); }
}

describe('sessionDraft', () => {
  it('persists and loads a draft', () => {
    const storage = new MemoryStorage();
    const draft = buildSessionDraft({
      questionId: 'q1',
      stage: 'capture',
      captureMode: 'photo',
      typedText: 'note',
      pages: [{
        id: 'pg1',
        pageNumber: 1,
        previewUrl: 'data:image/png;base64,xx',
        capturedAt: '2026-07-18T00:00:00.000Z',
      }],
      language: 'roman_hinglish',
    });
    saveSessionDraft(draft, storage);
    expect(storage.getItem(SESSION_DRAFT_KEY)).toBeTruthy();
    const loaded = loadSessionDraft(storage);
    expect(loaded?.questionId).toBe('q1');
    expect(loaded?.language).toBe('roman_hinglish');
    expect(loaded?.pages).toHaveLength(1);
    clearSessionDraft(storage);
    expect(loadSessionDraft(storage)).toBeNull();
  });

  it('resumes only matching incomplete drafts', () => {
    const draft = buildSessionDraft({
      questionId: 'q1',
      stage: 'readback',
      captureMode: 'photo',
      typedText: '',
      pages: [],
      language: 'english',
    });
    expect(shouldResumeDraft(draft, 'q1')).toBe(true);
    expect(shouldResumeDraft(draft, 'q2')).toBe(false);
    expect(shouldResumeDraft({ ...draft, stage: 'read' }, 'q1')).toBe(false);
  });
});
