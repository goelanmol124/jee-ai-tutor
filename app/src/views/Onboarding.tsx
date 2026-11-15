import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { OnboardingConsentGate } from '../components/PrivacyNotices';
import type { GraphData } from '../domain/types';
import type {
  PilotCohort,
  PilotProfile,
  PreferredLanguage,
  TopicPriorAnswer,
} from '../domain/pilotExperience';
import {
  COHORT_LABELS,
  LANGUAGE_LABELS,
  SELF_REPORT_TIERS,
  defaultTopicPriorsFromChapters,
  pilotJoin,
} from '../services/pilotApi';
import { getRecommendedStartChapters } from '../services/chapterPrefs';

export interface OnboardingResult {
  coveredChapters: string[];
  profile: PilotProfile;
}

interface Props {
  graph: GraphData;
  onComplete: (result: OnboardingResult) => void;
}

type Step = 'identity' | 'scope' | 'priors' | 'consent';

export function Onboarding({ graph, onComplete }: Props) {
  const recommended = getRecommendedStartChapters(graph);
  const [step, setStep] = useState<Step>('identity');
  const [nickname, setNickname] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [cohort, setCohort] = useState<PilotCohort>('class_12');
  const [language, setLanguage] = useState<PreferredLanguage>('english');
  const [ageBand, setAgeBand] = useState<PilotProfile['ageBand']>('under_18');
  const [picked, setPicked] = useState<Set<string>>(() => new Set(recommended));
  const [priors, setPriors] = useState<TopicPriorAnswer[]>(() =>
    defaultTopicPriorsFromChapters(
      graph.chapters.filter((c) => recommended.includes(c.id)),
    ),
  );
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const subjects: { name: string; key: 'math' | 'physics' | 'chemistry' }[] = [
    { name: 'Math', key: 'math' },
    { name: 'Physics', key: 'physics' },
    { name: 'Chemistry', key: 'chemistry' },
  ];

  const scopeHint = useMemo(() => {
    if (cohort === 'dropper') return 'Droppers default to the full catalog — trim chapters anytime.';
    if (cohort === 'class_11') return 'We’ll bias toward Class 11 defaults; you can override.';
    return 'We’ll bias toward Class 12 defaults; you can override.';
  }, [cohort]);

  function toggleChapter(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function syncPriorsFromPicked(chapterIds: string[]) {
    const chapters = graph.chapters.filter((c) => chapterIds.includes(c.id));
    setPriors((prev) => {
      const byId = new Map(prev.map((p) => [p.subtopicId, p]));
      return defaultTopicPriorsFromChapters(chapters).map((p) => byId.get(p.subtopicId) ?? p);
    });
  }

  function setPriorTier(subtopicId: string, tier: TopicPriorAnswer['tier']) {
    setPriors((prev) =>
      prev.map((p) => (p.subtopicId === subtopicId ? { ...p, tier } : p)),
    );
  }

  async function finish() {
    const covered = Array.from(picked.size ? picked : new Set(recommended));
    setBusy(true);
    setError(undefined);
    try {
      const join = await pilotJoin({
        inviteCode: inviteCode.trim() || 'pilot-local',
        nickname: nickname.trim() || 'Student',
        cohort,
        language,
        ageBand,
        acceptNotices: consentAccepted,
        grantPhotoDiagnosis: consentAccepted,
      });
      if (!join.ok) {
        setError(join.error ?? join.code ?? 'Could not start.');
        return;
      }
      if (join.blockers?.length) {
        // Minors remain blocked until real parent verification — surface clearly.
        setError(join.blockers[0]);
        if (ageBand === 'under_18' && !join.processingAllowed) {
          // Still persist profile for recovery, but do not enter Solve as active.
          // Fall through only for adults; minors stop here.
          return;
        }
      }
      const now = new Date().toISOString();
      onComplete({
        coveredChapters: covered,
        profile: {
          nickname: nickname.trim() || 'Student',
          cohort,
          language,
          coveredChapters: covered,
          topicPriors: priors,
          studentId: join.studentId,
          ageBand,
          aiNoticeAcceptedAt: now,
          privacyNoticeAcceptedAt: now,
        },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 sm:py-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="max-w-2xl"
      >
        <p className="text-violet-700 text-sm font-medium tracking-wide uppercase mb-3">
          Before you start
        </p>
        <h1 className="font-serif text-3xl sm:text-5xl text-ink leading-tight mb-4">
          One calm place to solve.
        </h1>
        <p className="text-ink-500 font-serif text-lg mb-10 leading-relaxed">
          Tell us your cohort and language. Topic chips are priors only — never proof of mastery.
        </p>

        {step === 'identity' && (
          <div className="space-y-8">
            <Field label="First name or nickname">
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="nickname"
                placeholder="e.g. Aarav"
                className="w-full rounded-2xl border border-paper-300/80 bg-white/80 px-4 py-3 text-[15px]
                           text-ink placeholder-ink-400 focus:outline-none focus:border-violet-400"
              />
            </Field>
            <Field label="Invite code">
              <input
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="From your pilot invite"
                className="w-full rounded-2xl border border-paper-300/80 bg-white/80 px-4 py-3 text-[15px]
                           text-ink placeholder-ink-400 focus:outline-none focus:border-violet-400"
              />
            </Field>

            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-3 font-medium">Cohort</p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(COHORT_LABELS) as PilotCohort[]).map((id) => (
                  <Chip key={id} active={cohort === id} onClick={() => setCohort(id)}>
                    {COHORT_LABELS[id]}
                  </Chip>
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-2">{scopeHint}</p>
            </div>

            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-3 font-medium">
                Preferred language
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(LANGUAGE_LABELS) as PreferredLanguage[]).map((id) => (
                  <Chip key={id} active={language === id} onClick={() => setLanguage(id)}>
                    {LANGUAGE_LABELS[id]}
                  </Chip>
                ))}
              </div>
              <p className="text-[13px] text-ink-500 mt-2">
                We mirror lightly. Math notation stays precise — no forced slang.
              </p>
            </div>

            <div>
              <p className="text-ink-500 text-xs uppercase tracking-wider mb-3 font-medium">
                Age band
              </p>
              <div className="flex flex-wrap gap-2">
                <Chip active={ageBand === 'under_18'} onClick={() => setAgeBand('under_18')}>
                  Under 18
                </Chip>
                <Chip active={ageBand === '18_plus'} onClick={() => setAgeBand('18_plus')}>
                  18 or older
                </Chip>
              </div>
            </div>

            <NavButtons
              onNext={() => {
                if (cohort === 'dropper' && picked.size < graph.chapters.length) {
                  const all = new Set(graph.chapters.map((c) => c.id));
                  setPicked(all);
                  syncPriorsFromPicked(Array.from(all).slice(0, 8));
                }
                setStep('scope');
              }}
            />
          </div>
        )}

        {step === 'scope' && (
          <div className="space-y-7">
            <p className="text-ink-600 text-[15px] leading-relaxed">
              Chapters in scope right now. Change anytime from You.
            </p>
            {subjects.map((s) => {
              const chapters = graph.chapters.filter((c) => c.subject === s.key);
              if (chapters.length === 0) return null;
              return (
                <div key={s.key}>
                  <p className="text-ink-500 text-xs uppercase tracking-wider mb-3 font-medium">
                    {s.name}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {chapters.map((ch) => (
                      <Chip key={ch.id} active={picked.has(ch.id)} onClick={() => toggleChapter(ch.id)}>
                        {ch.title}
                      </Chip>
                    ))}
                  </div>
                </div>
              );
            })}
            <NavButtons
              onBack={() => setStep('identity')}
              onNext={() => {
                const ids = Array.from(picked.size ? picked : new Set(recommended));
                syncPriorsFromPicked(ids.slice(0, 8));
                setStep('priors');
              }}
              nextDisabled={picked.size === 0}
            />
          </div>
        )}

        {step === 'priors' && (
          <div className="space-y-6">
            <p className="text-ink-600 text-[15px] leading-relaxed">
              Honest priors for a few topics. <span className="font-medium text-ink">Formula only</span> stays
              distinct — it does not mark you as having mastered anything.
            </p>
            <div className="space-y-4">
              {priors.map((prior) => (
                <div
                  key={prior.subtopicId}
                  className="rounded-2xl border border-paper-300/70 bg-white/70 px-4 py-3"
                >
                  <p className="font-serif text-[1.05rem] text-ink mb-2.5">{prior.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {SELF_REPORT_TIERS.map((tier) => (
                      <Chip
                        key={tier.id}
                        active={prior.tier === tier.id}
                        onClick={() => setPriorTier(prior.subtopicId, tier.id)}
                      >
                        {tier.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <NavButtons onBack={() => setStep('scope')} onNext={() => setStep('consent')} />
          </div>
        )}

        {step === 'consent' && (
          <div className="space-y-6">
            <OnboardingConsentGate
              ageBand={ageBand}
              accepted={consentAccepted}
              onAccept={() => setConsentAccepted(true)}
            />
            {error && <p className="text-[13px] text-amber-900">{error}</p>}
            <NavButtons
              onBack={() => setStep('priors')}
              onNext={() => void finish()}
              nextLabel={busy ? 'Starting…' : 'Begin'}
              nextDisabled={!consentAccepted || busy}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-ink-500 text-xs uppercase tracking-wider mb-2 font-medium block">{label}</span>
      {children}
    </label>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-4 py-2 rounded-full text-sm transition-all duration-150 border',
        active
          ? 'bg-violet-700 text-white border-violet-700 shadow-sm'
          : 'bg-paper-50 text-ink-700 border-ink-300/60 hover:border-violet-500 hover:text-violet-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function NavButtons({
  onBack,
  onNext,
  nextLabel = 'Continue',
  nextDisabled,
}: {
  onBack?: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-3 rounded-full text-ink-600 hover:bg-paper-200 text-sm font-medium"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="group inline-flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-full
                   hover:bg-violet-900 transition-colors duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="font-medium">{nextLabel}</span>
        <ArrowRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
      </button>
    </div>
  );
}
