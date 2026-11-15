import { useEffect, useState } from 'react';
import type { GraphData } from '../domain/types';
import type { ParentProgressSummary, PilotProfile, PreferredLanguage } from '../domain/pilotExperience';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Brain,
  Clock,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import type { LearningStats } from '../services/studentModel';
import { LANGUAGE_LABELS, pilotParentSummary } from '../services/pilotApi';
import { ParentProgressSummaryView } from '../components/ParentProgressSummary';
import { AiPrivacyBanner } from '../components/PrivacyNotices';

interface Props {
  graph: GraphData;
  stats: LearningStats;
  memoryDeckEnabled: boolean;
  practicePulse: { solidToday: number; questionsToday: number; rescuedToday?: number };
  pilotProfile?: PilotProfile;
  onToggleMemoryDeck: (enabled: boolean) => void;
  onLanguageChange: (language: PreferredLanguage) => void;
  onReset: () => void;
  onBackToPractice: () => void;
}

export function You({
  graph,
  stats,
  memoryDeckEnabled,
  practicePulse,
  pilotProfile,
  onToggleMemoryDeck,
  onLanguageChange,
  onReset,
  onBackToPractice,
}: Props) {
  const graphLabel = graph.source === 'snapshot'
    ? `Question bank ${graph.version ?? 'snapshot'}`
    : 'Original sample bank (no exam content)';

  const showTodaySessions =
    practicePulse.questionsToday > 0 || practicePulse.solidToday > 0;

  const language = pilotProfile?.language ?? 'english';
  const ageBand = pilotProfile?.ageBand ?? 'under_18';

  return (
    <div className="solve-screen">
      <header className="w-full border-b border-paper-300/40 bg-paper/70 backdrop-blur-sm shrink-0">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-[12px] text-ink-500 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            <button
              type="button"
              onClick={onBackToPractice}
              aria-label="Back to practice"
              className="inline-flex items-center gap-1 font-medium text-ink-700 hover:text-violet-700 transition-colors -ml-0.5"
            >
              <ArrowLeft size={14} strokeWidth={2} aria-hidden />
              <span className="whitespace-nowrap">Practice</span>
            </button>
            {pilotProfile?.cohort && (
              <span className="text-ink-400 whitespace-nowrap capitalize">
                {pilotProfile.cohort.replace('_', ' ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <span
              className="p-1.5 rounded-full text-violet-700 bg-violet-50"
              aria-label="Your progress — current page"
              aria-current="page"
            >
              <User size={15} aria-hidden />
            </span>
          </div>
        </div>
      </header>

      <div className="w-full border-b border-paper-300/30 bg-gradient-to-b from-paper/80 to-paper/40 shrink-0">
        <div
          className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-600"
          aria-live="polite"
          aria-label="Practice stats"
        >
          <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50/70 px-2.5 py-1">
            <Clock size={11} className="text-violet-700 shrink-0" aria-hidden />
            <span>
              <span className="text-ink-500">Today </span>
              <span className="font-semibold text-ink-900 tabular-nums">{stats.studiedMinutesToday}m</span>
            </span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-paper-300/80 bg-white/70 px-2.5 py-1">
            <Sparkles size={11} className="text-leaf-700 shrink-0" aria-hidden />
            <span className="font-semibold text-ink-900 tabular-nums">{stats.solved}</span>
            <span className="text-ink-500">independent</span>
          </span>
          {showTodaySessions && (
            <span className="inline-flex items-center gap-1 rounded-full border border-paper-300/80 bg-white/70 px-2.5 py-1">
              <span className="font-semibold text-ink-900 tabular-nums">{practicePulse.solidToday}</span>
              <span className="text-ink-500">solid</span>
              <span className="text-ink-400">·</span>
              <span className="font-semibold text-ink-900 tabular-nums">{practicePulse.questionsToday}</span>
              <span className="text-ink-500">today</span>
            </span>
          )}
        </div>
      </div>

      <div className="q-pin">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex items-start gap-2">
            <span className="mt-1 text-[10px] uppercase tracking-wider font-medium text-ink-500 shrink-0">
              You
            </span>
            <div className="flex-1 min-w-0">
              <h1 className="font-serif text-[17px] sm:text-[18px] leading-snug text-ink-700">
                {pilotProfile?.nickname ? `${pilotProfile.nickname}'s space` : 'Your progress'}
              </h1>
              <p className="text-ink-500 text-[13px] sm:text-sm mt-1 leading-relaxed">
                Honest practice counts — no streak pressure, no fabricated readiness or rank.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-4 space-y-8 solve-thread">
        <p className="text-ink-400 text-xs leading-relaxed">{graphLabel} · {graph.concepts.length} topics · {graph.questions.length} questions</p>

        <AiPrivacyBanner ageBand={ageBand} />

        <div>
          <p className="text-ink-500 text-xs uppercase tracking-wider mb-2 font-medium">Language</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LANGUAGE_LABELS) as PreferredLanguage[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onLanguageChange(id)}
                className={[
                  'px-4 py-2 rounded-full text-sm border transition-colors',
                  language === id
                    ? 'bg-violet-700 text-white border-violet-700'
                    : 'bg-paper-50 text-ink-700 border-ink-300/60 hover:border-violet-500',
                ].join(' ')}
              >
                {LANGUAGE_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Stat icon={<BookOpenCheck size={16} className="text-violet-700" />} value={stats.solved} label="independent finishes" />
          <Stat icon={<Sparkles size={16} className="text-leaf-700" />} value={stats.gapsClosed} label="rescued / gaps closed" />
        </div>

        <div className="rounded-2xl bg-white/70 border border-paper-300/60 overflow-hidden divide-y divide-paper-300/40">
          <Counter label="Questions finished in this app" value={String(stats.solved)} />
          <Counter label="Weak spots improved" value={String(stats.gapsClosed)} />
          <Counter label="Active minutes today" value={`${stats.studiedMinutesToday} min`} />
          <Counter label="Hints taken today" value={String(stats.hintsUsedToday)} />
        </div>

        {pilotProfile && <ParentSummaryLoader key={pilotProfile.studentId ?? pilotProfile.nickname} profile={pilotProfile} />}

        <div className="rounded-2xl bg-white/70 border border-paper-300/60 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-2 min-w-0">
            <Brain size={18} className="text-violet-700 mt-0.5 shrink-0" aria-hidden />
            <div>
              <div className="text-sm font-medium text-ink">Memory mini-cards</div>
              <p className="text-xs text-ink-500 mt-0.5 leading-relaxed">
                Short recalls saved after tough moments ({stats.memoryDeckSize} in deck
                {stats.memoryDeckOn ? ` · ${stats.memoryCardsDue} due` : ''}).
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={memoryDeckEnabled}
            onClick={() => onToggleMemoryDeck(!memoryDeckEnabled)}
            className={[
              'relative shrink-0 h-7 w-12 rounded-full transition-colors',
              memoryDeckEnabled ? 'bg-violet-600' : 'bg-paper-300',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
                memoryDeckEnabled ? 'translate-x-5' : 'translate-x-0',
              ].join(' ')}
            />
            <span className="sr-only">{memoryDeckEnabled ? 'Disable' : 'Enable'} memory mini-cards</span>
          </button>
        </div>

        <div className="pt-2 border-t border-dashed border-paper-300/60">
          <button
            type="button"
            onClick={onReset}
            className="text-ink-400 text-sm hover:text-violet-700 transition-colors inline-flex items-center gap-1.5"
          >
            <RotateCcw size={13} aria-hidden /> Clear progress and start onboarding again
          </button>
        </div>
      </div>

      <div className="solve-cta mt-auto shrink-0">
        <div className="max-w-2xl mx-auto">
          <button
            type="button"
            onClick={onBackToPractice}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-ink text-paper rounded-full hover:bg-violet-900 transition-colors text-[15px] font-medium min-h-[52px]"
          >
            Continue practice
            <ArrowRight size={18} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function ParentSummaryLoader({ profile }: { profile: PilotProfile }) {
  const [summary, setSummary] = useState<ParentProgressSummary | null>(null);
  useEffect(() => {
    let cancelled = false;
    void pilotParentSummary(profile).then((next) => {
      if (!cancelled) setSummary(next);
    });
    return () => { cancelled = true; };
  }, [profile]);
  if (!summary) return null;
  return <ParentProgressSummaryView summary={summary} />;
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/80 border border-paper-300/60 p-4">
      <div className="mb-1">{icon}</div>
      <div className="font-serif text-2xl text-ink tabular-nums">{value}</div>
      <div className="text-ink-500 text-xs">{label}</div>
    </div>
  );
}

function Counter({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <span className="text-ink-500 text-sm">{label}</span>
      <span className="font-serif text-ink text-lg tabular-nums shrink-0">{value}</span>
    </div>
  );
}
