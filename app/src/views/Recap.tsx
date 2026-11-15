import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { GraphData, SessionResult } from '../domain/types';
import type { ConceptId } from '../data/concepts';
import { BookMarked, ArrowRight, Sparkles } from 'lucide-react';
import type { ExpandChapterHint } from '../services/chapterExpandHint';

interface Props {
  graph: GraphData;
  result: SessionResult;
  beliefs: Record<ConceptId, number>;
  pastSelfDelta?: number;
  chapterExpandHint?: ExpandChapterHint;
  onContinue: () => void;
}

export function Recap({ graph, result, beliefs, pastSelfDelta, chapterExpandHint, onContinue }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2 | 3>(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 400);
    const t2 = setTimeout(() => setStage(2), 1100);
    const t3 = setTimeout(() => setStage(3), 1900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const closedConcepts = result.closedGaps.map(id => graph.concepts.find(c => c.id === id)).filter(Boolean);
  const confirmedCount = result.confirmed.length;
  const minutes = Math.max(1, Math.round(result.durationMs / 60000));
  const strongestConfirmed = result.confirmed
    .map((id) => graph.concepts.find((concept) => concept.id === id))
    .find(Boolean);

  void beliefs;

  return (
    <div className="min-h-screen flex flex-col justify-center max-w-2xl py-12">
      <div className="text-violet-700 text-xs uppercase tracking-wider mb-3 font-medium flex items-center gap-1">
        <Sparkles size={12} /> Session recap
      </div>
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="font-serif text-3xl sm:text-4xl text-ink leading-tight mb-8"
      >
        Nice work — {minutes} {minutes === 1 ? 'minute' : 'minutes'} well spent.
      </motion.h1>

      <div className="space-y-5 mb-10">
        {stage >= 1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="mt-1 w-2 h-2 rounded-full bg-leaf-500 flex-shrink-0" />
            <div>
              <div className="text-ink font-serif text-lg">
                Closed {closedConcepts.length} {closedConcepts.length === 1 ? 'gap' : 'gaps'}.
              </div>
              {closedConcepts.length > 0 && (
                <div className="text-ink-500 text-sm mt-1">
                  {closedConcepts.map(c => c!.name).join(', ')}.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {stage >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="mt-1 w-2 h-2 rounded-full bg-violet-700 flex-shrink-0" />
            <div>
              <div className="text-ink font-serif text-lg">
                Confirmed {confirmedCount} {confirmedCount === 1 ? 'concept' : 'concepts'}.
              </div>
              <div className="text-ink-500 text-sm mt-1">
                You can use these more safely in the next hard problem.
              </div>
            </div>
          </motion.div>
        )}

        {stage >= 3 && pastSelfDelta && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3"
          >
            <div className="mt-1 w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
            <div>
              <div className="text-ink font-serif text-lg">
                {pastSelfDelta}% faster than past you on similar problems.
              </div>
              <div className="text-ink-500 text-sm mt-1">
                You are moving a little faster on similar sums than before.
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {stage >= 3 && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="bg-paper-200/40 border border-paper-300/60 rounded-2xl p-5 mb-10"
        >
          <div className="text-ink-400 text-xs uppercase tracking-wider mb-2">Next session</div>
          <div className="font-serif text-ink text-lg leading-relaxed">
            Next, I’ll pick a question that uses{' '}
            <span className="text-violet-900 font-medium">{strongestConfirmed?.name ?? 'today’s strongest idea'}</span>
            {' '}without jumping too far ahead.
          </div>
        </motion.div>
      )}

      {stage >= 3 && chapterExpandHint && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex gap-3 rounded-2xl border border-paper-300/70 bg-paper-50/80 p-4 text-sm text-ink-600 leading-relaxed mb-10"
        >
          <BookMarked size={18} className="text-violet-700 shrink-0 mt-0.5" aria-hidden />
          <p>
            <span className="font-medium text-ink-800">{chapterExpandHint.title}</span>
            {' '}
            After you continue, tap the bookmark icon at the top to widen your syllabus.
          </p>
        </motion.div>
      )}

      {stage >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="flex flex-wrap items-center gap-3"
        >
          <button
            onClick={onContinue}
            className="group inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-full hover:bg-violet-900 transition-colors"
          >
            <span className="font-medium">Next problem</span>
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
          </button>
        </motion.div>
      )}
    </div>
  );
}
