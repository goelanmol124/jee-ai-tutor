/**
 * @deprecated Retired as a student-facing surface (PROJECT_REPLAN M4 / W4).
 * Graph-tutor mental model now lives behind the Solve experience.
 * Kept only for harness/debug reference — not mounted from App.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MixedMath } from '../components/Math';
import type { GraphData } from '../domain/types';
import type { ChapterTopicChip, TutorTurn } from '../domain/tutorUnified';
import {
  tutorChapterEntryGet,
  tutorChapterEntryPost,
  tutorStep,
} from '../services/tutorUnifiedClient';

function stableStudentId(): string {
  const k = 'al_tutor_student_id_v1';
  try {
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const neo = `stu_${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(k, neo);
    return neo;
  } catch {
    return `stu_${Math.random().toString(36).slice(2, 12)}`;
  }
}

const TIERS = [
  { id: 'confident' as const, label: 'Confident' },
  { id: 'roughly' as const, label: 'Know roughly' },
  { id: 'heard' as const, label: 'Heard of it' },
  { id: 'new' as const, label: 'New to me' },
];

function tutorMetaStudentVisible(meta?: string): string | undefined {
  const m = meta?.trim();
  if (!m) return undefined;
  if (/tutor_fallback:|Coach API key missing|first safe scaffolding only/i.test(m)) return undefined;
  return m;
}

function tutorCoachBubbleMarkdown(tt: TutorTurn): string {
  const vis = tutorMetaStudentVisible(tt.metaNarration);
  return tt.coachMessage + (vis ? `\n\n_${vis}_` : '');
}

interface Props {
  graph: GraphData;
  onBack: () => void;
}

export function TutorSession({ graph, onBack }: Props) {
  const studentId = useMemo(() => stableStudentId(), []);
  const [chapterId, setChapterId] = useState(graph.chapters[0]?.id ?? '');
  const [chips, setChips] = useState<ChapterTopicChip[]>([]);
  const [tierByChip, setTierByChip] = useState<Record<string, (typeof TIERS)[number]['id']>>({});
  const [freeText, setFreeText] = useState('');
  const [started, setStarted] = useState(false);
  const [mixedPractice, setMixedPractice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [turns, setTurns] = useState<Array<{ role: 'student' | 'coach'; text: string; tutorTurn?: TutorTurn }>>([]);
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const chapterTitle = graph.chapters.find((c) => c.id === chapterId)?.title ?? chapterId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!chapterId) return;
      setBusy(true);
      setError(undefined);
      try {
        const res = await tutorChapterEntryGet(chapterId);
        if (cancelled) return;
        if (!res.ok || !res.chips?.length) {
          setError(res.error ?? 'Could not load topic bundles.');
          return;
        }
        setChips(res.chips);
        const tiers: Record<string, (typeof TIERS)[number]['id']> = {};
        res.chips.forEach((c) => {
          tiers[c.subtopicId] = 'new';
        });
        setTierByChip(tiers);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chapterId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  async function boot() {
    setBusy(true);
    setError(undefined);
    try {
      const saved = await tutorChapterEntryPost({
        studentId,
        chapterId,
        chipAnswers: tierByChip,
        freeText: freeText.trim() || undefined,
      });
      if (!saved.ok) {
        setError(saved.error ?? 'Could not save your answers.');
        return;
      }
      const reply = await tutorStep({
        studentId,
        chapterId,
        mixedPractice,
      });
      if (!reply.ok || !reply.tutorTurn) {
        setError(reply.error ?? 'Coach unavailable.');
        return;
      }
      setTurns([
        {
          role: 'coach',
          text: tutorCoachBubbleMarkdown(reply.tutorTurn),
          tutorTurn: reply.tutorTurn,
        },
      ]);
      setStarted(true);
    } finally {
      setBusy(false);
    }
  }

  async function reply() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft('');
    setBusy(true);
    setTurns((prev) => [...prev, { role: 'student', text }]);
    try {
      const res = await tutorStep({
        studentId,
        chapterId,
        lastStudentMessage: text,
        mixedPractice,
      });
      if (!res.ok || !res.tutorTurn) {
        setTurns((prev) => [...prev, { role: 'coach', text: res.error ?? 'No reply.' }]);
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          role: 'coach',
          text: tutorCoachBubbleMarkdown(res.tutorTurn!),
          tutorTurn: res.tutorTurn,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function questionSnippet(id: string) {
    return graph.questions.find((q) => q.id === id)?.prompt ?? id;
  }

  function itemCard(tt?: TutorTurn) {
    if (!tt?.item) return null;
    const it = tt.item;
    if (it.kind === 'probe') {
      return (
        <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-sm text-ink leading-relaxed">
          <div className="text-[11px] uppercase tracking-wide text-violet-800 mb-1">Tiny check</div>
          <MixedMath>{it.prompt}</MixedMath>
        </div>
      );
    }
    if (it.kind === 'micro_lesson') {
      return (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-amber-900 mb-1">Micro-lesson</div>
          <MixedMath>{it.explanation}</MixedMath>
          {it.tinyExample ? (
            <div className="mt-2 pt-2 border-t border-amber-200">
              <MixedMath>{it.tinyExample}</MixedMath>
            </div>
          ) : null}
        </div>
      );
    }
    if (it.kind === 'question_ref') {
      return (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-emerald-900 mb-2">Practice item</div>
          <MixedMath>{questionSnippet(it.questionRef)}</MixedMath>
        </div>
      );
    }
    if (it.kind === 'derivation') {
      return (
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-sky-900 mb-2">Derivation lane</div>
          <MixedMath>{it.setup}</MixedMath>
          <p className="mt-2 text-[13px] text-ink-muted">You supply:</p>
          <MixedMath>{it.missingLine}</MixedMath>
        </div>
      );
    }
    if (it.kind === 'splice') {
      return (
        <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50/70 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-teal-900 mb-1">Worked slice</div>
          <MixedMath>{it.presolved}</MixedMath>
          <div className="mt-3 border-t border-teal-200 pt-2 text-[11px] uppercase tracking-wide text-teal-900">
            Gap for you {it.questionRef ? `(ref ${it.questionRef.slice(0, 8)}…)` : ''}
          </div>
          <MixedMath>{it.gap}</MixedMath>
        </div>
      );
    }
    if (it.kind === 'review_recall') {
      const label =
        graph.concepts.find((c) => c.id === it.conceptId)?.name?.slice(0, 80) ?? it.conceptId.slice(0, 48);
      return (
        <div className="mt-3 rounded-xl border border-indigo-200 bg-indigo-50/70 px-3 py-2 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-indigo-950 mb-1">Recall card · {label}</div>
          <MixedMath>{it.prompt}</MixedMath>
        </div>
      );
    }
    if (it.kind === 'park') {
      return (
        <div className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-ink">
          <div className="text-[11px] uppercase tracking-wide text-rose-950 mb-1">Parking this item</div>
          <p className="text-xs">{it.reason}</p>
        </div>
      );
    }
    return (
      <details className="mt-3 text-xs text-ink-muted">
        <summary className="cursor-pointer">Technical item</summary>
        <pre className="mt-2 whitespace-pre-wrap">{JSON.stringify(it, null, 2)}</pre>
      </details>
    );
  }

  return (
    <div className="paper-bg min-h-[100dvh] pb-28">
      <header className="sticky top-0 z-20 border-b border-ink/10 bg-[color-mix(in_srgb,var(--paper,#fcfbf7)_92%,white)] backdrop-blur">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">Rolling tutor beta</p>
            <h1 className="font-serif text-xl text-ink">{chapterTitle}</h1>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-emerald-900 underline underline-offset-4 decoration-dashed"
          >
            Back
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-xl space-y-4 px-4 py-4">
        <label className="block text-sm text-ink">
          Focus chapter
          <select
            className="mt-1 block w-full rounded-lg border border-ink/25 bg-white px-3 py-2 text-[15px] disabled:bg-paper-200"
            disabled={started}
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
          >
            {graph.chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>

        {!started ? (
          <section className="space-y-3">
            <p className="text-sm leading-relaxed text-ink-muted">
              No marks — just honesty. Pick how familiar each bundled topic feels before we weave real JEe prompts in.
            </p>
            {chips.map((chip) => (
              <div key={chip.subtopicId} className="rounded-2xl border border-ink/10 bg-[#fcfbf9] px-4 py-3 shadow-sm shadow-black/[0.04]">
                <p className="text-sm font-semibold text-ink">{chip.label}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {TIERS.map((tier) => {
                    const active = tierByChip[chip.subtopicId] === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs transition ${
                          active
                            ? 'border-emerald-800 bg-emerald-900 text-white'
                            : 'border-ink/20 bg-transparent text-ink-muted hover:border-ink/40 hover:bg-black/[0.04]'
                        }`}
                        onClick={() =>
                          setTierByChip((prev) => ({
                            ...prev,
                            [chip.subtopicId]: tier.id,
                          }))
                        }
                      >
                        {tier.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {!chips.length && !error ? (
              <p className="text-xs text-ink-muted">{busy ? 'Loading topic bundles…' : 'Pick a chapter to load bundles.'}</p>
            ) : null}
            <textarea
              className="w-full rounded-2xl border border-ink/20 bg-white px-3 py-2 text-sm"
              placeholder="Optional free text (struggles, goals, quirks)"
              rows={3}
              value={freeText}
              onChange={(event) => setFreeText(event.target.value)}
            />
            <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="mt-1 accent-emerald-800"
                checked={mixedPractice}
                onChange={(event) => setMixedPractice(event.target.checked)}
              />
              <span>
                <span className="font-medium">Mixed practice</span>
                — surface due recap items from other chapters before local picks when the tutor allows it.
              </span>
            </label>
            <button
              type="button"
              className="w-full rounded-xl bg-emerald-900 py-3 text-sm font-semibold text-white hover:bg-emerald-950 disabled:opacity-38"
              disabled={busy || !chips.length}
              onClick={() => void boot()}
            >
              {busy ? 'Starting…' : 'Open rolling session'}
            </button>
          </section>
        ) : (
          <section className="space-y-4">
            {turns.map((turn, index) =>
              turn.role === 'coach' ? (
                <article key={`c-${index}`} className="rounded-3xl border border-ink/10 bg-white px-4 py-3 shadow-inner shadow-black/[0.04]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">Coach</p>
                  <div className="prose prose-sm mt-2 max-w-none text-ink">
                    <MixedMath>{turn.text}</MixedMath>
                  </div>
                  {itemCard(turn.tutorTurn)}
                </article>
              ) : (
                <div key={`s-${index}`} className="flex justify-end">
                  <article className="max-w-[90%] rounded-3xl border border-violet-200 bg-violet-50 px-4 py-2 text-sm text-ink">
                    <MixedMath>{turn.text}</MixedMath>
                  </article>
                </div>
              ),
            )}
            <div ref={bottomRef} />
          </section>
        )}

        {error ? (
          <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>
        ) : null}
      </main>

      {started ? (
        <footer className="fixed bottom-0 left-0 right-0 border-t border-ink/10 bg-[#fcfbf7]/95 backdrop-blur">
          <div className="mx-auto flex max-w-xl gap-2 px-3 py-3">
            <input
              type="text"
              className="flex-1 rounded-full border border-ink/20 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-200"
              placeholder="Type anything — drafts welcome"
              value={draft}
              disabled={busy}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void reply();
                }
              }}
            />
            <button
              type="button"
              disabled={busy || !draft.trim()}
              onClick={() => void reply()}
              className="shrink-0 rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:bg-ink/25"
            >
              Send
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
