import { useEffect, useMemo, useState } from 'react';
import { Onboarding, type OnboardingResult } from './views/Onboarding';
import { Warmup } from './views/Warmup';
import { Solve } from './views/Solve';
import { Recap } from './views/Recap';
import { You } from './views/You';
import type { GraphData, SessionResult } from './domain/types';
import type { MemoryCardGrade } from './services/memoryCards';
import { loadGraph, pickInitialQuestion } from './services/graphStore';
import { getExpandChapterHint, markExpandChapterHintShown } from './services/chapterExpandHint';
import {
  applySessionResult,
  applyWarmupGrade,
  applyCoveredChaptersChange,
  applyMemoryCardReviewToState,
  beliefsFromConceptStates,
  buildStudentStateForTutor,
  buildWarmupCards,
  ensureStateMatchesGraph,
  learningStats,
  makeInitialStudentState,
  removeMemoryCardFromState,
  setMemoryDeckEnabled,
  shouldStartWithWarmup,
  updatePilotLanguage,
  type SingleUserLearningState,
  STORAGE_KEY,
} from './services/studentModel';
import { clearSessionDraft } from './services/sessionDraft';
import type { PreferredLanguage } from './domain/pilotExperience';

export type View =
  | 'onboarding'
  | 'warmup'
  | 'canvas'
  | 'recap'
  | 'you';

export interface AppState {
  view: View;
  hasOnboarded: boolean;
  learning?: SingleUserLearningState;
  pastSelfDelta?: number;
  lastSession?: SessionResult;
}

const initialState: AppState = {
  view: 'onboarding',
  hasOnboarded: false,
};

function startupView(graph: GraphData, learning: SingleUserLearningState): View {
  return shouldStartWithWarmup(graph, learning) ? 'warmup' : 'canvas';
}

export default function App() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [graphError, setGraphError] = useState<string | undefined>();
  const [state, setState] = useState<AppState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as AppState & { view?: string };
        if (parsed.hasOnboarded) {
          // Retire legacy 'tutor' view — Solve is the only student-facing experience.
          const rawView = String(parsed.view ?? 'canvas');
          const allowed = ['warmup', 'canvas', 'recap', 'you'] as const;
          const view: View = (allowed as readonly string[]).includes(rawView)
            ? (rawView as typeof allowed[number])
            : 'canvas';
          return {
            ...initialState,
            ...parsed,
            view,
          };
        }
      }
    } catch { /* ignore */ }
    return initialState;
  });

  useEffect(() => {
    let cancelled = false;
    loadGraph()
      .then((loaded) => {
        if (cancelled) return;
        setGraph(loaded);
        setState((current) => current.learning
          ? (() => {
            const learning = ensureStateMatchesGraph(current.learning!, loaded);
            const view = current.view === 'onboarding' ? startupView(loaded, learning) : current.view;
            return { ...current, learning, view };
          })()
          : current);
      })
      .catch((error: unknown) => {
        if (!cancelled) setGraphError(error instanceof Error ? error.message : 'Could not load graph.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
  }, [state]);

  function go(view: View) {
    setState(s => ({ ...s, view }));
  }

  function completeOnboarding(result: OnboardingResult) {
    if (!graph) return;
    setState(s => ({
      ...s,
      hasOnboarded: true,
      learning: makeInitialStudentState(graph, result.coveredChapters, result.profile),
      view: 'canvas',
    }));
  }

  function finishWarmup(grades?: Array<{ conceptId: string; grade: 'hard' | 'good' | 'easy' }>) {
    if (grades?.length) {
      setState(s => {
        if (!s.learning) return { ...s, view: 'canvas' };
        const learning = grades.reduce(
          (current, item) => applyWarmupGrade(current, item.conceptId, item.grade),
          s.learning,
        );
        return { ...s, learning, view: 'canvas' };
      });
      return;
    }
    setState(s => ({ ...s, view: 'canvas' }));
  }

  function finishSession(result: SessionResult) {
    if (!graph) return;
    clearSessionDraft();
    setState(s => {
      if (!s.learning) return s;
      const learning = applySessionResult(s.learning, graph, result);

      return {
        ...s,
        view: 'recap',
        learning,
        lastSession: result,
        pastSelfDelta: undefined,
      };
    });
  }

  function dismissRecap() {
    setState(s => ({ ...s, view: 'canvas' }));
  }

  function resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    clearSessionDraft();
    setState(initialState);
  }

  function updateCoveredChapters(coveredChapters: string[]) {
    if (!graph) return;
    setState((s) => {
      if (!s.learning) return s;
      return {
        ...s,
        learning: applyCoveredChaptersChange(s.learning, graph, coveredChapters),
      };
    });
  }

  function setLanguage(language: PreferredLanguage) {
    setState((s) => {
      if (!s.learning) return s;
      return { ...s, learning: updatePilotLanguage(s.learning, language) };
    });
  }

  function consumeChapterExpandHint() {
    setState((s) => {
      if (!s.learning) return s;
      return { ...s, learning: markExpandChapterHintShown(s.learning) };
    });
  }

  function setPracticeMemoryDeck(enabled: boolean) {
    setState((s) => {
      if (!s.learning) return s;
      return { ...s, learning: setMemoryDeckEnabled(s.learning, enabled) };
    });
  }

  function gradeMemoryCard(cardId: string, grade: MemoryCardGrade) {
    setState((s) => {
      if (!s.learning) return s;
      return { ...s, learning: applyMemoryCardReviewToState(s.learning, cardId, grade) };
    });
  }

  function removePracticeMemoryCard(cardId: string) {
    setState((s) => {
      if (!s.learning) return s;
      return { ...s, learning: removeMemoryCardFromState(s.learning, cardId) };
    });
  }

  const learning = state.learning;
  const beliefs = useMemo(() => learning ? beliefsFromConceptStates(learning.conceptStates) : {}, [learning]);
  const question = graph && learning
    ? pickInitialQuestion(graph, learning.coveredChapters, beliefs, {
      conceptStates: learning.conceptStates,
      attemptedQuestionIds: learning.attemptHistory.map((attempt) => attempt.questionId),
    })
    : undefined;
  const studentState = learning ? buildStudentStateForTutor(learning) : undefined;
  const warmupCards = graph && learning ? buildWarmupCards(graph, learning) : [];
  const stats = graph && learning ? learningStats(graph, learning) : undefined;
  const practicePulse = useMemo(() => {
    if (!learning) return undefined;
    const today = new Date().toDateString();
    const attemptsToday = learning.attemptHistory.filter(
      (a) => new Date(a.completedAt).toDateString() === today,
    );
    return {
      solidToday: attemptsToday.filter((a) => a.status === 'good').length,
      questionsToday: attemptsToday.length,
      rescuedToday: attemptsToday.filter((a) => a.status === 'gap').length,
    };
  }, [learning]);
  const chapterExpandHint = graph && learning ? getExpandChapterHint(graph, learning) : undefined;
  const sessionTimeline = learning?.attemptHistory.map((attempt) => ({
    questionId: attempt.questionId,
    status: attempt.status === 'gap' ? 'gap' as const : 'good' as const,
    mode: attempt.mode,
  })) ?? [];
  if (!graph) {
    return (
      <div className="paper-bg min-h-screen text-ink flex items-center justify-center px-6">
        <div className="max-w-md">
          <div className="text-violet-700 text-xs uppercase tracking-wider mb-2">AdvancedLearning</div>
          <h1 className="font-serif text-3xl mb-3">Loading the learning graph.</h1>
          <p className="text-ink-500 text-sm leading-relaxed">
            {graphError ?? 'Preparing questions, concepts, and prerequisite structure.'}
          </p>
        </div>
      </div>
    );
  }

  // Solve and You are full-bleed with their own max-w-2xl rails; other views use the wide column.
  const containerCls = state.view === 'canvas' || state.view === 'you'
    ? 'w-full'
    : 'mx-auto w-full max-w-[1100px] px-4 sm:px-8';

  return (
    <div className="paper-bg min-h-screen text-ink">
      <main className={containerCls}>
        {state.view === 'onboarding' && (
          <Onboarding graph={graph} onComplete={completeOnboarding} />
        )}
        {state.view === 'warmup' && learning && (
          <Warmup cards={warmupCards} onDone={finishWarmup} onSkip={() => finishWarmup()} streakDays={learning.streakDays} />
        )}
        {state.view === 'canvas' && question && studentState && learning && stats && practicePulse && (
          <Solve
            graph={graph}
            coveredChapters={learning.coveredChapters}
            question={question}
            studentState={studentState}
            beliefs={beliefs}
            sessionTimeline={sessionTimeline}
            stats={stats}
            practicePulse={practicePulse}
            chapterExpandHint={chapterExpandHint}
            memoryCardsEnabled={learning.memoryCardsEnabled ?? true}
            memoryCards={learning.memoryCards ?? []}
            language={learning.pilotProfile?.language ?? 'english'}
            ageBand={learning.pilotProfile?.ageBand ?? 'under_18'}
            onMemoryGrade={gradeMemoryCard}
            onRemoveMemoryCard={removePracticeMemoryCard}
            onConsumeChapterExpandHint={consumeChapterExpandHint}
            onFinish={finishSession}
            onOpenYou={() => go('you')}
            onUpdateCoveredChapters={updateCoveredChapters}
          />
        )}
        {state.view === 'recap' && state.lastSession && learning && (
          <Recap
            graph={graph}
            result={state.lastSession}
            beliefs={beliefs}
            pastSelfDelta={state.pastSelfDelta}
            chapterExpandHint={chapterExpandHint}
            onContinue={dismissRecap}
          />
        )}
        {state.view === 'you' && learning && stats && practicePulse && (
          <You
            graph={graph}
            stats={stats}
            practicePulse={practicePulse}
            memoryDeckEnabled={learning.memoryCardsEnabled ?? true}
            pilotProfile={learning.pilotProfile}
            onToggleMemoryDeck={setPracticeMemoryDeck}
            onLanguageChange={setLanguage}
            onReset={resetAll}
            onBackToPractice={() => go('canvas')}
          />
        )}
      </main>
    </div>
  );
}
