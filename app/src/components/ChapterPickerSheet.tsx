import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { GraphData } from '../domain/types';
import { getRecommendedStartChapters } from '../services/chapterPrefs';

interface Props {
  graph: GraphData;
  initialChapterIds: string[];
  onClose: () => void;
  onApply: (chapterIds: string[]) => void;
}

const SUBJECTS: { name: string; key: 'math' | 'physics' | 'chemistry' }[] = [
  { name: 'Math', key: 'math' },
  { name: 'Physics', key: 'physics' },
  { name: 'Chemistry', key: 'chemistry' },
];

export function ChapterPickerSheet({ graph, initialChapterIds, onClose, onApply }: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initialChapterIds));

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const suggested = getRecommendedStartChapters(graph);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px] px-0 sm:px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="chapter-sheet-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: 48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="w-full sm:max-w-lg bg-paper rounded-t-3xl sm:rounded-3xl border border-paper-300/70 shadow-soft max-h-[min(88vh,720px)] overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
          <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-paper-300/50">
            <div>
              <p id="chapter-sheet-title" className="font-serif text-xl text-ink">
                Chapters in scope
              </p>
              <p className="text-ink-500 text-sm mt-1 leading-relaxed">
                Questions favour these units. Pick one or more.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-full text-ink-400 hover:bg-paper-200 hover:text-ink-700 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4 space-y-6 flex-1">
            {SUBJECTS.map((s) => {
              const chapters = graph.chapters.filter((c) => c.subject === s.key);
              if (chapters.length === 0) return null;
              return (
                <div key={s.key}>
                  <p className="text-ink-500 text-xs uppercase tracking-wider mb-3 font-medium">{s.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {chapters.map((ch) => {
                      const on = picked.has(ch.id);
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => toggle(ch.id)}
                          className={[
                            'px-3.5 py-1.5 rounded-full text-sm transition-all duration-150 border',
                            on
                              ? 'bg-violet-700 text-white border-violet-700 shadow-sm'
                              : 'bg-paper-50 text-ink-700 border-ink-300/60 hover:border-violet-500 hover:text-violet-700',
                          ].join(' ')}
                        >
                          {ch.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-5 py-4 border-t border-paper-300/50 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between sm:items-center bg-paper-50/80">
            <button
              type="button"
              onClick={() => setPicked(new Set(suggested))}
              className="text-sm text-violet-700 hover:underline py-2 text-center sm:text-left"
            >
              Use suggested chapters
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-full text-sm font-medium text-ink-600 hover:bg-paper-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={picked.size === 0}
                onClick={() => {
                  onApply(Array.from(picked));
                  onClose();
                }}
                className="px-5 py-2.5 rounded-full text-sm font-medium bg-ink text-paper hover:bg-violet-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
      </motion.div>
    </motion.div>
  );
}
