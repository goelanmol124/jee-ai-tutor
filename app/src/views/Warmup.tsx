import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MixedMath, PureMath } from '../components/Math';
import { Flame, ChevronRight } from 'lucide-react';
import type { WarmupCard } from '../domain/types';

interface Props {
  cards: WarmupCard[];
  onDone: (grades: Array<{ conceptId: string; grade: 'hard' | 'good' | 'easy' }>) => void;
  onSkip: () => void;
  streakDays: number;
}

const SOURCE_LABEL: Record<string, string> = {
  review_due: 'Due for revision',
  recent_stumble: 'From a recent mistake',
  freebie: 'Quick recall',
  shaky: 'Needs more practice',
};

export function Warmup({ cards, onDone, onSkip, streakDays }: Props) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Array<{ conceptId: string; grade: 'hard' | 'good' | 'easy' }>>([]);

  const total = cards.length;
  const card = cards[idx];

  function flip() { setRevealed(true); }
  function grade(g: 'easy' | 'good' | 'hard') {
    const nextGrades = card ? [...grades, { conceptId: card.conceptId, grade: g }] : grades;
    setGrades(nextGrades);
    if (idx + 1 >= total) {
      setTimeout(() => onDone(nextGrades), 350);
    } else {
      setRevealed(false);
      setIdx(idx + 1);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' && !revealed) { e.preventDefault(); flip(); return; }
      if (revealed) {
        if (e.key === '1' || e.key.toLowerCase() === 'h') grade('hard');
        if (e.key === '2' || e.key.toLowerCase() === 'g') grade('good');
        if (e.key === '3' || e.key.toLowerCase() === 'e') grade('easy');
      }
      if (e.key === 'Escape') onSkip();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, idx]);

  if (!card) {
    return (
      <div className="min-h-screen flex flex-col justify-center max-w-xl">
        <div className="text-violet-700 text-xs uppercase tracking-wider mb-2">Warm-up</div>
        <h1 className="font-serif text-3xl text-ink mb-4">No review due yet.</h1>
        <p className="text-ink-500 mb-8">We will build your review queue as you solve more questions.</p>
        <button onClick={onSkip} className="inline-flex w-fit items-center gap-2 px-6 py-3 bg-ink text-paper rounded-full hover:bg-violet-900 transition-colors">
          Start solving
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2 text-ink-500 text-sm">
          <Flame size={14} className="text-amber-700" />
          <span>{streakDays} day streak</span>
          <span className="mx-2 text-ink-300">·</span>
          <span>Warm-up · {idx + 1} of {total}</span>
        </div>
        <button onClick={onSkip} className="text-ink-400 text-sm hover:text-ink-700 transition-colors">
          Skip
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center px-2 sm:px-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="w-full max-w-xl bg-white rounded-3xl p-8 sm:p-12 shadow-page border border-paper-300/40"
          >
            <p className="text-violet-700 text-xs uppercase tracking-wider mb-6 font-medium">
              {SOURCE_LABEL[card.source]}
            </p>
            <div className="font-serif text-2xl sm:text-3xl text-ink leading-relaxed min-h-[80px]">
              {card.prompt.includes('\\(') || card.prompt.startsWith('\\')
                ? <PureMath tex={card.prompt.replace(/\\\(|\\\)/g, '')} display />
                : <MixedMath>{card.prompt}</MixedMath>}
            </div>
            <div className="mt-8 border-t border-paper-300/60 pt-8 min-h-[70px]">
              {!revealed ? (
                <button
                  onClick={flip}
                  className="text-ink-500 text-sm hover:text-violet-700 transition-colors text-left w-full"
                >
                  <span className="sm:hidden">Tap to show answer</span>
                  <span className="hidden sm:inline">
                    Press <kbd className="kbd">space</kbd> or tap — show answer
                  </span>
                </button>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="font-serif text-2xl sm:text-3xl text-leaf-700">
                  {card.answer.includes('\\') ? <PureMath tex={card.answer} display /> : <MixedMath>{card.answer}</MixedMath>}
                </motion.div>
              )}
            </div>

            {revealed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-8 flex flex-col sm:flex-row gap-2"
              >
                <button onClick={() => grade('hard')} className="flex-1 px-4 py-3 rounded-xl border border-amber-700/40 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium">
                  Hard <span className="text-ink-400 ml-1 text-xs">1</span>
                </button>
                <button onClick={() => grade('good')} className="flex-1 px-4 py-3 rounded-xl border border-violet-700/40 bg-violet-50 text-violet-900 hover:bg-violet-100 transition-colors text-sm font-medium">
                  Good <span className="text-ink-400 ml-1 text-xs">2</span>
                </button>
                <button onClick={() => grade('easy')} className="flex-1 px-4 py-3 rounded-xl border border-leaf-700/40 bg-leaf-50 text-leaf-700 hover:bg-leaf-100 transition-colors text-sm font-medium">
                  Easy <span className="text-ink-400 ml-1 text-xs">3</span>
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="py-6 flex items-center justify-center gap-1.5">
        {cards.map((_, i) => (
          <div
            key={i}
            className={`h-1 rounded-full transition-all ${
              i === idx ? 'w-8 bg-violet-700' :
              i < idx ? 'w-3 bg-violet-300' : 'w-3 bg-paper-300'
            }`}
          />
        ))}
      </footer>

      <style>{`
        .kbd {
          display: inline-block;
          padding: 1px 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.75rem;
          background: #F2EDE0;
          border: 1px solid #E8E1CE;
          border-radius: 4px;
          color: #2C3142;
          margin: 0 2px;
        }
      `}</style>
    </div>
  );
}

// quiet helper: silence unused imports
void ChevronRight;
