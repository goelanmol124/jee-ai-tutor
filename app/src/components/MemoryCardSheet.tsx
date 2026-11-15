import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Trash2, X } from 'lucide-react';
import { MixedMath } from './Math';
import type { MemoryCard, MemoryCardGrade } from '../services/memoryCards';

interface Props {
  open: boolean;
  onClose: () => void;
  enabled: boolean;
  cards: MemoryCard[];
  /** When deck is disabled, clicking “Turn on” in settings is described here */
  onOpenSettingsHint?: () => void;
  onGrade: (cardId: string, grade: MemoryCardGrade) => void;
  onRemoveCard: (cardId: string) => void;
}

export function MemoryCardSheet({
  open,
  onClose,
  enabled,
  cards,
  onOpenSettingsHint,
  onGrade,
  onRemoveCard,
}: Props) {
  const [revealedId, setRevealedId] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const now = useMemo(() => new Date(), [open]);

  const dueCards = useMemo(() => {
    const t = now.getTime();
    return [...cards].filter((c) => new Date(c.nextDueAt).getTime() <= t).sort(
      (a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime(),
    );
  }, [cards, now]);

  const activeCard = dueCards[0];

  useEffect(() => {
    if (!open) {
      setRevealedId(null);
      return;
    }
    if (activeCard) setRevealedId(null);
  }, [open, activeCard?.id]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-[2px] px-0 sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-sheet-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="w-full sm:max-w-lg bg-paper rounded-t-3xl sm:rounded-3xl border border-paper-300/70 shadow-soft max-h-[min(92vh,680px)] overflow-hidden flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-paper-300/50">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Brain size={22} className="text-violet-700 shrink-0" aria-hidden />
                  <p id="memory-sheet-title" className="font-serif text-xl text-ink">
                    Memory cards
                  </p>
                </div>
                <p className="text-ink-500 text-sm leading-relaxed">
                  Quick recall cues from slips you flagged in practice. Your taps here never change your topic scores—only how often each card returns.
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

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {!enabled && (
                <div className="rounded-2xl bg-violet-50/80 border border-violet-200/60 p-4 text-[15px] text-ink-700 leading-relaxed">
                  <p className="mb-3">
                    Turn on “Practice memory cards” in <span className="font-medium text-ink">You</span> to collect cards from gaps the coach sees. Until then nothing is queued.
                  </p>
                  {onOpenSettingsHint && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenSettingsHint();
                        onClose();
                      }}
                      className="text-sm font-medium text-violet-800 underline underline-offset-2 hover:text-violet-950"
                    >
                      Open You
                    </button>
                  )}
                </div>
              )}

              {enabled && cards.length === 0 && (
                <p className="text-ink-600 text-[15px] leading-relaxed">
                  No cards yet. Finish a question where the diagnosis finds a gap—those concepts show up here automatically.
                </p>
              )}

              {enabled && cards.length > 0 && !activeCard && (
                <div className="space-y-2">
                  <p className="text-ink-700 text-[15px] leading-relaxed">
                    You are caught up on due reviews. Come back later or keep practicing—a card comes back only on its spaced schedule unless you stumble on it again.
                  </p>
                  <p className="text-ink-500 text-sm">
                    {cards.length} card{cards.length === 1 ? '' : 's'} in deck · next spaced due soon
                  </p>
                </div>
              )}

              {enabled && activeCard && (
                <div className="space-y-5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-400 font-medium">
                    Think of your answer · tap card to reveal · then rate recall
                  </div>

                  <button
                    type="button"
                    onClick={() => setRevealedId((prev) => (prev === activeCard.id ? null : activeCard.id))}
                    className={[
                      'w-full text-left rounded-2xl border p-5 transition-colors min-h-[120px]',
                      revealedId === activeCard.id
                        ? 'bg-white border-violet-200/70'
                        : 'bg-paper-50 border-paper-300/70 hover:bg-violet-50/40 hover:border-violet-200/50',
                    ].join(' ')}
                  >
                    <div className="text-[13px] text-violet-800 font-medium mb-2">Cue</div>
                    <div className="bubble-math text-ink text-[17px] leading-snug font-serif">
                      <MixedMath>{activeCard.prompt}</MixedMath>
                    </div>

                    <AnimatePresence initial={false}>
                      {revealedId === activeCard.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4 pt-4 border-t border-paper-300/60"
                        >
                          <div className="text-[13px] text-leaf-800 font-medium mb-2">Answer</div>
                          <div className="bubble-math text-ink-700 text-[16px] leading-relaxed">
                            <MixedMath>{activeCard.answer}</MixedMath>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="mt-3 text-[11px] text-ink-400 pt-2">
                      {revealedId === activeCard.id ? 'Tap cue again to hide answer' : 'Tap to reveal answer'}
                    </div>
                  </button>

                  <div className="space-y-2">
                    <p className="text-[12px] text-ink-500">Without changing your tutor score—how did recall feel?</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        disabled={revealedId !== activeCard.id}
                        onClick={() => onGrade(activeCard.id, 'easy')}
                        className="rounded-2xl py-3 px-3 text-[14px] font-medium bg-leaf-100/70 text-leaf-900 border border-leaf-200/60 hover:bg-leaf-100 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Remembered easily
                      </button>
                      <button
                        type="button"
                        disabled={revealedId !== activeCard.id}
                        onClick={() => onGrade(activeCard.id, 'moderate')}
                        className="rounded-2xl py-3 px-3 text-[14px] font-medium bg-paper-100 text-ink-800 border border-paper-300/70 hover:bg-paper-200/70 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Moderate
                      </button>
                      <button
                        type="button"
                        disabled={revealedId !== activeCard.id}
                        onClick={() => onGrade(activeCard.id, 'hard')}
                        className="rounded-2xl py-3 px-3 text-[14px] font-medium bg-amber-50 text-amber-950 border border-amber-200/70 hover:bg-amber-100/70 disabled:opacity-40 disabled:pointer-events-none"
                      >
                        Did not recall
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveCard(activeCard.id)}
                    className="w-full inline-flex items-center justify-center gap-2 text-[13px] text-ink-400 hover:text-ink-700 py-2 rounded-xl hover:bg-paper-200/50 transition-colors"
                  >
                    <Trash2 size={15} aria-hidden /> Remove card from deck
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
