import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  BookMarked,
  Brain,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Image as ImageIcon,
  Lightbulb,
  Loader2,
  PencilLine,
  RefreshCcw,
  Send,
  Shuffle,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import type { ConceptId } from '../data/concepts';
import { ChapterPickerSheet } from '../components/ChapterPickerSheet';
import { DisputeAction } from '../components/DisputeAction';
import { MemoryCardSheet } from '../components/MemoryCardSheet';
import { MixedMath } from '../components/Math';
import { MultiPageCapture } from '../components/MultiPageCapture';
import { PhotoReadbackPanel } from '../components/PhotoReadback';
import { AiPrivacyBanner } from '../components/PrivacyNotices';
import type {
  CapturePage,
  PhotoReadback,
  PreferredLanguage,
  SolveStage,
} from '../domain/pilotExperience';
import {
  coachFollowup,
  diagnoseAttempt,
  generateTutorTool,
  getTutorProviderAsync,
  type TutorProvider,
} from '../services/tutorClient';
import type { ExpandChapterHint } from '../services/chapterExpandHint';
import { attachStudentFacing, pilotPreparePhotoDiagnosis } from '../services/pilotApi';
import {
  addCapturePage,
  moveCapturePage,
  removeCapturePage,
  replaceCapturePage,
} from '../services/photoPages';
import {
  buildSessionDraft,
  clearSessionDraft,
  draftPages,
  loadSessionDraft,
  saveSessionDraft,
  shouldResumeDraft,
} from '../services/sessionDraft';
import { getKnownPrereqRatio } from '../services/graphSelectors';
import type { LearningStats } from '../services/studentModel';
import { countMemoryCardsDue, type MemoryCard, type MemoryCardGrade } from '../services/memoryCards';
import type {
  AttemptMcqContext,
  CoachConversationTurn,
  CoachFollowupResult,
  CoachFollowupStudentMessage,
  DiagnosisResult,
  GraphData,
  NextMoveKind,
  QuickCheck,
  QuestionNode,
  SessionResult,
  StudentState,
  TutorToolResult,
} from '../domain/types';

interface Props {
  graph: GraphData;
  coveredChapters: string[];
  question: QuestionNode;
  studentState: StudentState;
  beliefs: Record<ConceptId, number>;
  sessionTimeline: { questionId: string; status: 'good' | 'gap'; mode: string }[];
  stats: LearningStats;
  practicePulse: { solidToday: number; questionsToday: number };
  chapterExpandHint?: ExpandChapterHint;
  memoryCardsEnabled: boolean;
  memoryCards: MemoryCard[];
  language: PreferredLanguage;
  ageBand: 'under_18' | '18_plus';
  onMemoryGrade: (cardId: string, grade: MemoryCardGrade) => void;
  onRemoveMemoryCard: (cardId: string) => void;
  onConsumeChapterExpandHint?: () => void;
  onFinish: (r: SessionResult) => void;
  onOpenYou: () => void;
  onUpdateCoveredChapters: (chapterIds: string[]) => void;
}

/* ---------- chat thread reducer ---------- */

type StudentAttempt =
  // Initial-attempt shapes (the first message of the session).
  | { kind: 'photo'; thumbnailUrl: string; fileName?: string; pageCount?: number; pageUrls?: string[] }
  | { kind: 'typed'; text: string }
  | { kind: 'mcq'; index: number; label: string }
  | { kind: 'mcq_with_text'; index: number; label: string; text: string }
  | { kind: 'mcq_with_photo'; index: number; label: string; thumbnailUrl: string; pageCount?: number }
  | { kind: 'stuck'; note: string }
  | { kind: 'orient' }
  // Follow-up shapes (any subsequent reply in the same conversation).
  | { kind: 'reply_text'; text: string }
  | { kind: 'reply_qc'; pickedLabel: string; pickedCorrect: boolean }
  | { kind: 'reply_chip'; chipId: 'still_confused' | 'show_me_more' | 'why' | 'got_it'; label: string };

type Turn =
  | { id: string; role: 'student'; attempt: StudentAttempt }
  | { id: string; role: 'coach'; kind: 'thinking' }
  | { id: string; role: 'coach'; kind: 'diagnosis'; diagnosis: DiagnosisResult; quickCheckAnsweredIndex?: number }
  | { id: string; role: 'coach'; kind: 'followup'; reply: CoachFollowupResult; quickCheckAnsweredIndex?: number }
  | { id: string; role: 'coach'; kind: 'tool'; tool: TutorToolResult }
  | { id: string; role: 'coach'; kind: 'error'; message: string };

type ThreadAction =
  | { type: 'reset' }
  | { type: 'append'; turn: Turn }
  | { type: 'replaceLast'; turn: Turn }
  | { type: 'patchDiagnosisQc'; turnId: string; pickedIndex: number }
  | { type: 'patchFollowupQc'; turnId: string; pickedIndex: number };

function threadReducer(state: Turn[], action: ThreadAction): Turn[] {
  switch (action.type) {
    case 'reset':
      return [];
    case 'append':
      return [...state, action.turn];
    case 'replaceLast':
      if (state.length === 0) return [action.turn];
      return [...state.slice(0, -1), action.turn];
    case 'patchDiagnosisQc':
      return state.map((turn) =>
        turn.id === action.turnId && turn.role === 'coach' && turn.kind === 'diagnosis'
          ? { ...turn, quickCheckAnsweredIndex: action.pickedIndex }
          : turn,
      );
    case 'patchFollowupQc':
      return state.map((turn) =>
        turn.id === action.turnId && turn.role === 'coach' && turn.kind === 'followup'
          ? { ...turn, quickCheckAnsweredIndex: action.pickedIndex }
          : turn,
      );
  }
}

/**
 * Build the LLM-facing conversation transcript from the local thread state.
 * We only send what the LLM needs (text content + role); photos / chips become
 * short prose so the prompt stays cheap.
 */
function buildConversationHistory(thread: Turn[]): CoachConversationTurn[] {
  const out: CoachConversationTurn[] = [];
  for (const turn of thread) {
    if (turn.role === 'student') {
      const text = renderAttemptForLlm(turn.attempt);
      if (text) out.push({ role: 'student', content: text });
    } else if (turn.role === 'coach') {
      if (turn.kind === 'diagnosis') {
        out.push({ role: 'coach', content: turn.diagnosis.coachMessage ?? 'Coach gave an initial diagnosis.' });
      } else if (turn.kind === 'followup') {
        out.push({ role: 'coach', content: turn.reply.coachMessage });
      } else if (turn.kind === 'tool') {
        out.push({ role: 'coach', content: `Showed worked example: ${turn.tool.title}` });
      }
    }
  }
  return out;
}

function renderAttemptForLlm(attempt: StudentAttempt): string {
  switch (attempt.kind) {
    case 'photo':
      return attempt.pageCount && attempt.pageCount > 1
        ? `(uploaded ${attempt.pageCount} ordered pages of handwritten work)`
        : '(uploaded a photo of work)';
    case 'typed': return attempt.text;
    case 'mcq': return `Picked option ${String.fromCharCode(65 + attempt.index)}: ${attempt.label}`;
    case 'mcq_with_text': return `Picked option ${String.fromCharCode(65 + attempt.index)}: ${attempt.label}. Reasoning: ${attempt.text}`;
    case 'mcq_with_photo': return `Picked option ${String.fromCharCode(65 + attempt.index)}: ${attempt.label} (photo of work attached)`;
    case 'stuck': return `Tapped "I'm stuck". Note: ${attempt.note || '(none)'}`;
    case 'orient': return 'Tapped "Orient me" (no attempt yet, asking for a concept frame, NOT a hint toward the answer).';
    case 'reply_text': return attempt.text;
    case 'reply_qc': return `Tapped quick-check option "${attempt.pickedLabel}" (${attempt.pickedCorrect ? 'right' : 'wrong'})`;
    case 'reply_chip': return `Tapped chip: ${attempt.label}`;
  }
}

const turnId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

/* ---------- main component ---------- */

export function Solve(props: Props) {
  // Remount per question so draft resume initializes cleanly without reset effects.
  return <SolveSession key={props.question.id} {...props} />;
}

function SolveSession({
  graph,
  coveredChapters,
  question,
  studentState,
  beliefs,
  sessionTimeline,
  stats,
  practicePulse,
  chapterExpandHint,
  memoryCardsEnabled,
  memoryCards,
  language,
  ageBand,
  onMemoryGrade,
  onRemoveMemoryCard,
  onConsumeChapterExpandHint,
  onFinish,
  onOpenYou,
  onUpdateCoveredChapters,
}: Props) {
  const initialDraft = (() => {
    const draft = loadSessionDraft();
    return shouldResumeDraft(draft, question.id) ? draft : null;
  })();

  // Stage 0 = read question → capture → readback (photo) → live thread.
  const [stage, setStage] = useState<SolveStage>(() =>
    initialDraft ? (initialDraft.stage === 'live' ? 'capture' : initialDraft.stage) : 'read',
  );
  const [chapterPickerOpen, setChapterPickerOpen] = useState(false);
  const [memorySheetOpen, setMemorySheetOpen] = useState(false);
  const [chapterHintBannerDismissed, setChapterHintBannerDismissed] = useState(false);
  const [captureMode, setCaptureMode] = useState<'photo' | 'typed' | null>(
    () => initialDraft?.captureMode ?? null,
  );
  const [pages, setPages] = useState<CapturePage[]>(() =>
    initialDraft ? draftPages(initialDraft) : [],
  );
  const [recapturePageId, setRecapturePageId] = useState<string | null>(null);
  const [photoWarningDismissed, setPhotoWarningDismissed] = useState(false);
  const [readback, setReadback] = useState<PhotoReadback | null>(null);
  const [readbackCorrection, setReadbackCorrection] = useState(
    () => initialDraft?.readbackCorrection ?? '',
  );
  const [pendingDiagnosisId, setPendingDiagnosisId] = useState<string | undefined>();
  const [typedText, setTypedText] = useState(() => initialDraft?.typedText ?? '');
  const [mcqIndex, setMcqIndex] = useState<number | undefined>(() => initialDraft?.mcqIndex);
  const [thread, dispatch] = useReducer(threadReducer, []);
  const [isSending, setIsSending] = useState(false);
  const [isFollowupSending, setIsFollowupSending] = useState(false);
  const [isToolLoading, setIsToolLoading] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [questionExpanded, setQuestionExpanded] = useState(
    () => Boolean(initialDraft && initialDraft.stage !== 'read'),
  );
  const [tutorBackend, setTutorBackend] = useState<TutorProvider | 'checking'>('checking');
  const [resumeBanner, setResumeBanner] = useState(() => Boolean(initialDraft));
  const [startedAt] = useState(() => Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  /* offline draft persistence — resumable after interrupt */
  useEffect(() => {
    if (stage === 'read' && pages.length === 0 && !typedText.trim()) {
      clearSessionDraft();
      return;
    }
    if (stage === 'read') return;
    saveSessionDraft(
      buildSessionDraft({
        questionId: question.id,
        stage,
        captureMode,
        typedText,
        mcqIndex,
        pages,
        readbackCorrection,
        language,
      }),
    );
  }, [stage, captureMode, typedText, mcqIndex, pages, readbackCorrection, question.id, language]);

  /* tutor backend status */
  useEffect(() => {
    let cancelled = false;
    getTutorProviderAsync().then((p) => { if (!cancelled) setTutorBackend(p); });
    return () => { cancelled = true; };
  }, []);

  /* auto-scroll the chat thread.
   * If the latest turn is a coach diagnosis or tool, land on the TOP of that
   * bubble so the student sees the actual reply (not just the QuickCheck below).
   * Otherwise (student bubbles, thinking, qc follow-ups) scroll to the very end
   * so the latest content is visible above the sticky CTA. */
  useEffect(() => {
    const last = thread[thread.length - 1];
    const landOnLatestCoach =
      last && last.role === 'coach' && (last.kind === 'diagnosis' || last.kind === 'tool');
    if (landOnLatestCoach) {
      const node = document.querySelector<HTMLElement>(`[data-turn-id="${last.id}"]`);
      if (node) {
        node.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
    }
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread, stage]);

  const prereqMasteredPct = useMemo(
    () => Math.round(getKnownPrereqRatio(question, beliefs) * 100),
    [beliefs, question],
  );

  const memoryCardsDue = useMemo(
    () => (memoryCardsEnabled ? countMemoryCardsDue(memoryCards) : 0),
    [memoryCards, memoryCardsEnabled],
  );

  const lastDiagnosisTurn = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      const turn = thread[i];
      if (turn.role === 'coach' && turn.kind === 'diagnosis') return turn;
    }
    return undefined;
  }, [thread]);

  /** Latest follow-up reply (if any) — drives the "conversationDone" pulse + suggestedAction chip. */
  const lastFollowupTurn = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      const turn = thread[i];
      if (turn.role === 'coach' && turn.kind === 'followup') return turn;
    }
    return undefined;
  }, [thread]);

  const conversationDone = lastFollowupTurn?.kind === 'followup' && lastFollowupTurn.reply.conversationDone === true;
  const followupSuggestedAction = lastFollowupTurn?.kind === 'followup' ? lastFollowupTurn.reply.suggestedAction : null;

  const attemptCountThisQuestion = useMemo(
    () => thread.reduce((n, t) => n + (t.role === 'student' ? 1 : 0), 0),
    [thread],
  );

  const showChapterExpandBanner = Boolean(chapterExpandHint && !chapterHintBannerDismissed);

  function consumeChapterExpandHintIfNeeded() {
    if (!chapterExpandHint) return;
    onConsumeChapterExpandHint?.();
  }

  /* ---------- handlers ---------- */

  function onPickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const previewUrl = String(reader.result);
      if (recapturePageId) {
        setPages((prev) => replaceCapturePage(prev, recapturePageId, {
          previewUrl,
          file,
          fileName: file.name,
        }));
        setRecapturePageId(null);
      } else {
        setPages((prev) => addCapturePage(prev, { previewUrl, file, fileName: file.name }));
      }
    };
    reader.readAsDataURL(file);
  }

  function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) onPickFile(file);
    if (fileRef.current) fileRef.current.value = '';
  }

  function clearPages() {
    setPages([]);
    setRecapturePageId(null);
    if (fileRef.current) fileRef.current.value = '';
  }

  function pickCaptureMode(mode: 'photo' | 'typed') {
    setCaptureMode(mode);
    setStage('capture');
    setQuestionExpanded(true);
    setResumeBanner(false);
    if (mode === 'photo' && pages.length === 0) {
      setTimeout(() => fileRef.current?.click(), 50);
    }
  }

  /**
   * Zero-friction declarations the student can fire with one tap — no composer,
   * no textbox, no thinking required:
   *   - "orient":  "what is this question even about?" → coach replies with a
   *                concept frame + the angle to think from. NEVER reveals the
   *                first move; goal is to lower the activation cliff so trying
   *                feels safe.
   *   - "stuck":   honest "I have nothing to write". Coach gives ONE tiny first
   *                push (existing behaviour).
   * Both skip the capture stage entirely and go straight to the live thread,
   * because forcing the student through a textbox here is exactly the inertia
   * we are trying to remove.
   */
  async function sendDeclaration(kind: 'stuck' | 'orient') {
    if (isSending) return;
    const attempt: StudentAttempt =
      kind === 'orient' ? { kind: 'orient' } : { kind: 'stuck', note: "I'm stuck" };
    const mcq: AttemptMcqContext =
      kind === 'orient' ? { requestedOrient: true } : { declaredUnknown: true };
    setIsSending(true);
    dispatch({ type: 'append', turn: { id: turnId('s'), role: 'student', attempt } });
    setStage('live');
    setQuestionExpanded(false);
    dispatch({ type: 'append', turn: { id: turnId('thinking'), role: 'coach', kind: 'thinking' } });
    try {
      const result = await diagnoseAttempt({
        question,
        studentState,
        mcq,
      });
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('diag'), role: 'coach', kind: 'diagnosis', diagnosis: result },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Coach hit a snag — try again.';
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message },
      });
    } finally {
      setIsSending(false);
    }
  }

  function pickMcqOption(index: number) {
    setMcqIndex(index);
    // If they ONLY tap an option, capture mode "typed" so they can add reasoning.
    if (!captureMode) setCaptureMode('typed');
    setStage('capture');
    setQuestionExpanded(true);
  }

  function buildAttempt(): StudentAttempt | null {
    const text = typedText.trim();
    const hasPhoto = pages.length > 0;
    const firstPreview = pages[0]?.previewUrl;
    if (mcqIndex != null && hasPhoto && firstPreview) {
      return {
        kind: 'mcq_with_photo',
        index: mcqIndex,
        label: question.options?.[mcqIndex] ?? '',
        thumbnailUrl: firstPreview,
        pageCount: pages.length,
      };
    }
    if (mcqIndex != null && text) {
      return {
        kind: 'mcq_with_text',
        index: mcqIndex,
        label: question.options?.[mcqIndex] ?? '',
        text,
      };
    }
    if (mcqIndex != null) {
      return {
        kind: 'mcq',
        index: mcqIndex,
        label: question.options?.[mcqIndex] ?? '',
      };
    }
    if (hasPhoto && firstPreview) {
      return {
        kind: 'photo',
        thumbnailUrl: firstPreview,
        fileName: pages[0]?.fileName,
        pageCount: pages.length,
        pageUrls: pages.map((p) => p.previewUrl),
      };
    }
    if (text) return { kind: 'typed', text };
    return null;
  }

  function primaryImageFile(): File | undefined {
    return pages.find((p) => p.file)?.file;
  }

  function mcqPayload(): AttemptMcqContext | undefined {
    if (mcqIndex != null) {
      return {
        selectedIndex: mcqIndex,
        selectedLabel: question.options?.[mcqIndex],
      };
    }
    return undefined;
  }

  /** Photo path: readback/correction before consequential diagnosis. */
  async function goToPhotoReadback() {
    if (pages.length === 0 && !typedText.trim()) return;
    setIsSending(true);
    try {
      const prepared = await pilotPreparePhotoDiagnosis({
        question,
        pages,
        typedWork: typedText.trim() || undefined,
        readbackConfirmed: false,
      });
      if (!prepared.ok || !prepared.readback) {
        throw new Error(prepared.error ?? 'Could not prepare readback.');
      }
      setReadback(prepared.readback);
      setStage('readback');
      setQuestionExpanded(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare readback.';
      dispatch({ type: 'reset' });
      setStage('live');
      dispatch({
        type: 'append',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message },
      });
    } finally {
      setIsSending(false);
    }
  }

  async function confirmReadbackAndDiagnose() {
    if (!readback) return;
    setIsSending(true);
    const attempt = buildAttempt();
    if (attempt) {
      dispatch({ type: 'append', turn: { id: turnId('s'), role: 'student', attempt } });
    }
    setStage('live');
    setQuestionExpanded(false);
    dispatch({ type: 'append', turn: { id: turnId('thinking'), role: 'coach', kind: 'thinking' } });
    try {
      const prepared = await pilotPreparePhotoDiagnosis({
        question,
        pages,
        typedWork: typedText.trim() || undefined,
        correctionNote: readbackCorrection.trim() || undefined,
        readbackConfirmed: true,
      });
      setPendingDiagnosisId(prepared.diagnosisId);
      const imageFile = primaryImageFile();
      const result = await diagnoseAttempt({
        question,
        studentState,
        typedWork: readbackCorrection.trim() || typedText.trim() || undefined,
        imageFile,
        imageDataUrl: pages[0]?.previewUrl,
        mcq: mcqPayload(),
      });
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('diag'), role: 'coach', kind: 'diagnosis', diagnosis: result },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong reading your work.';
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message },
      });
    } finally {
      setIsSending(false);
      setPages([]);
      setTypedText('');
      setReadback(null);
      setReadbackCorrection('');
      setCaptureMode(null);
      clearSessionDraft();
    }
  }

  async function send() {
    // Photo (or photo+mcq) → readback gate first.
    if (captureMode === 'photo' || (pages.length > 0 && !typedText.trim() && mcqIndex == null)) {
      if (pages.length > 0) {
        await goToPhotoReadback();
        return;
      }
    }
    if (pages.length > 0 && (mcqIndex != null || typedText.trim())) {
      await goToPhotoReadback();
      return;
    }

    const attempt = buildAttempt();
    if (!attempt) return;
    setIsSending(true);
    dispatch({ type: 'append', turn: { id: turnId('s'), role: 'student', attempt } });
    setStage('live');
    setQuestionExpanded(false);
    dispatch({ type: 'append', turn: { id: turnId('thinking'), role: 'coach', kind: 'thinking' } });

    try {
      const result = await diagnoseAttempt({
        question,
        studentState,
        typedWork: typedText.trim() || undefined,
        mcq: mcqPayload(),
      });
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('diag'), role: 'coach', kind: 'diagnosis', diagnosis: result },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Something went wrong reading your work.';
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message },
      });
    } finally {
      setIsSending(false);
      setPages([]);
      setTypedText('');
      setCaptureMode(null);
      clearSessionDraft();
    }
  }

  /**
   * Student tapped a QuickCheck option. We mark the bubble as answered and
   * immediately kick off a real coach follow-up (LLM call) instead of
   * showing a canned "Yes — exactly that" line. The coach gets the pick + the
   * conversation history and decides what to ask / say next.
   */
  function pickQuickCheck(coachTurnId: string, qc: QuickCheck, optionIdx: number, source: 'diagnosis' | 'followup') {
    const option = qc.options[optionIdx];
    if (!option) return;
    if (source === 'diagnosis') {
      dispatch({ type: 'patchDiagnosisQc', turnId: coachTurnId, pickedIndex: optionIdx });
    } else {
      dispatch({ type: 'patchFollowupQc', turnId: coachTurnId, pickedIndex: optionIdx });
    }
    void sendFollowup({
      kind: 'qc_pick',
      quickCheckPrompt: qc.prompt,
      pickedLabel: option.label,
      pickedCorrect: option.correct,
    });
  }

  /**
   * Send a free-text reply, a chip tap, or a QuickCheck pick to the coach as a
   * follow-up turn. Adds a student bubble + "thinking" placeholder, then swaps
   * the placeholder for the real coach reply when the LLM call returns.
   */
  async function sendFollowup(message: CoachFollowupStudentMessage) {
    if (!lastDiagnosisTurn || lastDiagnosisTurn.kind !== 'diagnosis') return;
    if (isFollowupSending) return;
    setIsFollowupSending(true);

    // Append the student turn so it shows in the thread immediately.
    const attempt: StudentAttempt = (() => {
      if (message.kind === 'free_text') return { kind: 'reply_text', text: message.text };
      if (message.kind === 'qc_pick') {
        return { kind: 'reply_qc', pickedLabel: message.pickedLabel, pickedCorrect: message.pickedCorrect };
      }
      const labelMap: Record<typeof message.chipId, string> = {
        still_confused: 'I\'m still confused',
        show_me_more: 'Show me more',
        why: 'Why?',
        got_it: 'Got it',
      };
      return { kind: 'reply_chip', chipId: message.chipId, label: labelMap[message.chipId] };
    })();
    dispatch({ type: 'append', turn: { id: turnId('s'), role: 'student', attempt } });
    dispatch({ type: 'append', turn: { id: turnId('thinking'), role: 'coach', kind: 'thinking' } });

    try {
      const conversation = buildConversationHistory(thread);
      const reply = await coachFollowup({
        question,
        studentState,
        diagnosis: lastDiagnosisTurn.diagnosis,
        conversation,
        studentMessage: message,
      });
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('fu'), role: 'coach', kind: 'followup', reply },
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : 'Coach hit a snag — try saying it again.';
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message: messageText },
      });
    } finally {
      setIsFollowupSending(false);
    }
  }

  async function runTutorTool() {
    if (!lastDiagnosisTurn || lastDiagnosisTurn.kind !== 'diagnosis') return;
    setIsToolLoading(true);
    dispatch({
      type: 'append',
      turn: { id: turnId('tool_thinking'), role: 'coach', kind: 'thinking' },
    });
    try {
      const targetConceptIds = [
        ...lastDiagnosisTurn.diagnosis.conceptsNegative,
        ...lastDiagnosisTurn.diagnosis.conceptsPositive,
      ].slice(0, 3);
      const tool = await generateTutorTool({
        question,
        studentState,
        diagnosis: lastDiagnosisTurn.diagnosis,
        tool: lastDiagnosisTurn.diagnosis.recommendedTool,
        targetConceptIds,
      });
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('tool'), role: 'coach', kind: 'tool', tool },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load the next move.';
      dispatch({
        type: 'replaceLast',
        turn: { id: turnId('err'), role: 'coach', kind: 'error', message },
      });
    } finally {
      setIsToolLoading(false);
    }
  }

  function finishAndContinue() {
    if (!lastDiagnosisTurn || lastDiagnosisTurn.kind !== 'diagnosis') {
      // No diagnosis at all — just skip / move on.
      onFinish({
        questionId: question.id,
        closedGaps: [],
        confirmed: [],
        caughtSlips: [],
        hintsUsed: 0,
        durationMs: Date.now() - startedAt,
      });
      return;
    }
    const result = lastDiagnosisTurn.diagnosis;
    onFinish({
      questionId: question.id,
      closedGaps: result.conceptsNegative,
      confirmed: result.conceptsPositive,
      caughtSlips: result.sillyMistakeTags,
      hintsUsed: 0,
      durationMs: Date.now() - startedAt,
      diagnosis: result,
    });
  }

  function tryAgain() {
    // Keep the question, throw away the thread, return to read stage.
    dispatch({ type: 'reset' });
    setStage('read');
    setCaptureMode(null);
    clearPages();
    setTypedText('');
    setMcqIndex(undefined);
    setReadback(null);
    setReadbackCorrection('');
    setPendingDiagnosisId(undefined);
    clearSessionDraft();
  }

  function skipQuestion() {
    onFinish({
      questionId: question.id,
      closedGaps: [],
      confirmed: [],
      caughtSlips: [],
      hintsUsed: 0,
      durationMs: Date.now() - startedAt,
    });
  }

  /* ---------- render ---------- */

  const ctaMode =
    stage === 'live' && lastDiagnosisTurn
      ? 'live'
      : stage === 'readback'
        ? 'capture'
        : stage;

  return (
    <div className="solve-screen" data-cta-mode={ctaMode}>
      {/* === Top bar (very lean) === */}
      <TopBar
        sessionCount={sessionTimeline.length}
        language={language}
        backend={tutorBackend}
        pulseChaptersHint={showChapterExpandBanner}
        memoryCardsDue={memoryCardsDue}
        onOpenMemory={() => setMemorySheetOpen(true)}
        onOpenChapters={() => {
          consumeChapterExpandHintIfNeeded();
          setChapterPickerOpen(true);
        }}
        onOpenYou={onOpenYou}
        onSkip={skipQuestion}
      />

      <SolveLiveMetrics
        stats={stats}
        practicePulse={practicePulse}
        startedAt={startedAt}
        attemptCount={attemptCountThisQuestion}
      />

      <AnimatePresence>
        {chapterPickerOpen && (
          <ChapterPickerSheet
            key="chapter-picker"
            graph={graph}
            initialChapterIds={coveredChapters}
            onClose={() => setChapterPickerOpen(false)}
            onApply={(chapterIds) => {
              onUpdateCoveredChapters(chapterIds);
            }}
          />
        )}
      </AnimatePresence>

      <MemoryCardSheet
        open={memorySheetOpen}
        onClose={() => setMemorySheetOpen(false)}
        enabled={memoryCardsEnabled}
        cards={memoryCards}
        onOpenSettingsHint={onOpenYou}
        onGrade={(cardId, grade) => onMemoryGrade(cardId, grade)}
        onRemoveCard={onRemoveMemoryCard}
      />

      {/* === Pinned / collapsible question (only after stage 0) === */}
      {stage !== 'read' && (
        <PinnedQuestion
          question={question}
          expanded={questionExpanded}
          onToggle={() => setQuestionExpanded((value) => !value)}
        />
      )}

      <div className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 solve-thread">
        {resumeBanner && stage !== 'read' && (
          <div
            role="status"
            className="mt-3 rounded-2xl border border-leaf-200 bg-leaf-50/90 px-3.5 py-2.5 text-[13px] text-ink-700 flex items-start justify-between gap-3"
          >
            <span>Resumed your interrupted draft for this question.</span>
            <button
              type="button"
              className="text-[12px] font-medium text-leaf-900 shrink-0"
              onClick={() => setResumeBanner(false)}
            >
              Dismiss
            </button>
          </div>
        )}
        {stage === 'read' ? (
          <ReadStage
            graph={graph}
            question={question}
            mcqIndex={mcqIndex}
            ageBand={ageBand}
            onPickMcq={pickMcqOption}
            onChooseMode={pickCaptureMode}
            onDeclare={sendDeclaration}
            onTryDifferent={skipQuestion}
            prereqMasteredPct={prereqMasteredPct}
            chapterExpandHint={showChapterExpandBanner ? chapterExpandHint : undefined}
            onDismissChapterExpandHint={() => {
              setChapterHintBannerDismissed(true);
              consumeChapterExpandHintIfNeeded();
            }}
            onOpenChaptersFromHint={() => {
              consumeChapterExpandHintIfNeeded();
              setChapterPickerOpen(true);
            }}
          />
        ) : stage === 'readback' && readback ? (
          <div className="pt-4 pb-2">
            <PhotoReadbackPanel
              readback={readback}
              correction={readbackCorrection}
              onCorrectionChange={setReadbackCorrection}
              onConfirm={() => void confirmReadbackAndDiagnose()}
              onRecapture={() => {
                setStage('capture');
                setCaptureMode('photo');
                setQuestionExpanded(true);
              }}
              onBack={() => {
                setStage('capture');
                setCaptureMode('photo');
                setQuestionExpanded(true);
              }}
              busy={isSending}
            />
          </div>
        ) : (
          <ChatThread
            thread={thread}
            question={question}
            diagnosisId={pendingDiagnosisId}
            onQuickCheckPick={pickQuickCheck}
          />
        )}
        <div ref={threadEndRef} />
      </div>

      {/* === Sticky bottom action === */}
      {stage !== 'readback' && (
        <BottomCta
          stage={stage}
          captureMode={captureMode}
          pages={pages}
          typedText={typedText}
          onTypedChange={setTypedText}
          mcqIndex={mcqIndex}
          questionHasMcq={Boolean(question.options?.length)}
          canSend={Boolean(buildAttempt())}
          isSending={isSending}
          isFollowupSending={isFollowupSending}
          isToolLoading={isToolLoading}
          diagnosis={lastDiagnosisTurn?.kind === 'diagnosis' ? lastDiagnosisTurn.diagnosis : undefined}
          conversationDone={conversationDone}
          followupSuggestedAction={followupSuggestedAction}
          followupText={followupText}
          onFollowupTextChange={setFollowupText}
          onSendFollowupText={() => {
            const text = followupText.trim();
            if (!text) return;
            setFollowupText('');
            void sendFollowup({ kind: 'free_text', text });
          }}
          onSendFollowupChip={(chipId) => {
            void sendFollowup({ kind: 'chip', chipId });
          }}
          onSend={() => void send()}
          onCancel={() => {
            setCaptureMode(null);
            setStage('read');
            clearPages();
            setTypedText('');
            clearSessionDraft();
          }}
          onAddPage={() => {
            setRecapturePageId(null);
            fileRef.current?.click();
          }}
          onRemovePage={(id) => setPages((prev) => removeCapturePage(prev, id))}
          onMovePage={(id, dir) => setPages((prev) => moveCapturePage(prev, id, dir))}
          onRecapturePage={(id) => {
            setRecapturePageId(id);
            fileRef.current?.click();
          }}
          photoWarningVisible={captureMode === 'photo' && !photoWarningDismissed}
          onDismissPhotoWarning={() => setPhotoWarningDismissed(true)}
          onTryAgain={tryAgain}
          onContinue={finishAndContinue}
          onSeeFix={runTutorTool}
        />
      )}

      {/* hidden file picker — single input shared across UI */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileChange}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   Read stage — question + "How do you want to solve?"
   ────────────────────────────────────────────── */

function ReadStage({
  graph,
  question,
  mcqIndex,
  ageBand,
  onPickMcq,
  onChooseMode,
  onDeclare,
  onTryDifferent,
  prereqMasteredPct,
  chapterExpandHint,
  onDismissChapterExpandHint,
  onOpenChaptersFromHint,
}: {
  graph: GraphData;
  question: QuestionNode;
  mcqIndex?: number;
  ageBand: 'under_18' | '18_plus';
  onPickMcq: (index: number) => void;
  onChooseMode: (mode: 'photo' | 'typed') => void;
  onDeclare: (kind: 'stuck' | 'orient') => void;
  onTryDifferent: () => void;
  prereqMasteredPct: number;
  chapterExpandHint?: ExpandChapterHint;
  onDismissChapterExpandHint?: () => void;
  onOpenChaptersFromHint?: () => void;
}) {
  const hasOptions = Boolean(question.options?.length);

  // Concept pill: name 1-2 concepts above the question so the student doesn't
  // have to first decode "what topic is this even" before they can engage.
  const conceptNames = useMemo(() => {
    const map = new Map(graph.concepts.map((c) => [c.id, c.name]));
    const ids = question.conceptIds.length ? question.conceptIds : question.prereqIds;
    const names: string[] = [];
    for (const id of ids) {
      const name = map.get(id);
      if (name && !names.includes(name)) names.push(name);
      if (names.length === 2) break;
    }
    return names;
  }, [graph.concepts, question.conceptIds, question.prereqIds]);

  // The 80/20 rule (PLAN §7) treats <50% of prereqs known as out-of-stretch —
  // forcing the student to attempt now is the inertia trap. Offer an explicit,
  // shame-free swap instead of a silent "X% ready" label.
  const showStretchSwap = prereqMasteredPct > 0 && prereqMasteredPct < 50;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="pt-4 sm:pt-8 pb-6 space-y-6"
    >
      {chapterExpandHint && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-violet-200/80 bg-violet-50/90 px-4 py-3 relative"
          role="status"
        >
          <button
            type="button"
            className="absolute top-2 right-2 p-1 rounded-full text-ink-400 hover:bg-violet-100 hover:text-ink-600"
            aria-label="Dismiss suggestion"
            onClick={onDismissChapterExpandHint}
          >
            <X size={16} />
          </button>
          <div className="flex items-start gap-2 pr-8">
            <BookMarked size={18} className="text-violet-700 mt-0.5 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-serif text-ink text-[1.05rem] leading-snug">{chapterExpandHint.title}</p>
              <p className="text-sm text-ink-600 mt-1 leading-relaxed">{chapterExpandHint.body}</p>
              <button
                type="button"
                className="mt-3 text-sm font-medium text-violet-900 underline-offset-2 hover:underline"
                onClick={onOpenChaptersFromHint}
              >
                Open chapter picker
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-500 uppercase tracking-wider font-medium">
        <span className="px-2 py-0.5 rounded-full bg-violet-50 text-violet-900 border border-violet-100">
          {question.source}
        </span>
        {conceptNames.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-paper-100 text-ink-700 border border-paper-300/80 normal-case tracking-normal font-normal">
            {conceptNames.join(' · ')}
          </span>
        )}
      </div>

      {/* THE QUESTION — big, centred, always readable */}
      <div className="font-serif text-[1.45rem] sm:text-[1.7rem] text-ink leading-[1.55] question-math">
        <MixedMath>{question.prompt}</MixedMath>
      </div>

      {/* Soft "this is a stretch" swap — replaces the silent prereq% label so
          the student isn't forced into a question that's out of zone. Tapping
          it is shame-free: same as Skip, but framed as the system helping. */}
      {showStretchSwap && (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 flex items-start gap-2.5">
          <Compass size={18} className="text-amber-700 mt-0.5 shrink-0" aria-hidden />
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-ink-700 leading-snug">
              This one may stretch a few basics that are still cold. No pressure to grind through it — swap if you want something closer.
            </p>
            <button
              type="button"
              onClick={onTryDifferent}
              className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-amber-900 hover:text-amber-950 underline-offset-2 hover:underline"
            >
              <Shuffle size={13} /> Find me a closer one
            </button>
          </div>
        </div>
      )}
      {/* Keep prereqMasteredPct referenced for stretch gate without showing readiness %. */}
      <span className="sr-only">{prereqMasteredPct}</span>

      {/* MCQ options — large, tap-friendly */}
      {hasOptions && (
        <div className="space-y-2.5">
          {question.options!.map((option, index) => {
            const selected = mcqIndex === index;
            return (
              <button
                key={`${question.id}_o_${index}`}
                type="button"
                aria-pressed={selected}
                className="mcq-option"
                onClick={() => onPickMcq(index)}
              >
                <span className="marker">{String.fromCharCode(65 + index)}</span>
                <span className="flex-1 option-math">
                  <MixedMath>{option}</MixedMath>
                </span>
                {selected && <Check size={18} className="text-violet-700 mt-0.5 shrink-0" />}
              </button>
            );
          })}
          <p className="text-sm text-ink-500 text-center pt-2">
            Tap an option, then tell me <span className="text-ink-700 font-medium">why</span>.
          </p>
        </div>
      )}

      {/* If no MCQ → a small divider */}
      {!hasOptions && (
        <div className="flex items-center gap-3 py-2 text-sm text-ink-400">
          <span className="flex-1 h-px bg-paper-300/70" />
          <span>or</span>
          <span className="flex-1 h-px bg-paper-300/70" />
        </div>
      )}

      {/* Photo primary; Orient me / I'm stuck / type stay distinct escape doors. */}
      <div className="space-y-2.5 pt-1">
        <button type="button" className="choice-tile" onClick={() => onChooseMode('photo')}>
          <span className="ico"><Camera size={22} /></span>
          <span className="flex-1">
            <span className="block font-serif text-[1.1rem] text-ink">I solved it on paper</span>
            <span className="block text-sm text-ink-500 mt-0.5">Primary path · multi-page photos welcome</span>
          </span>
          <ArrowRight size={18} className="text-ink-400" />
        </button>
        <button
          type="button"
          className="choice-tile choice-tile--orient"
          onClick={() => onDeclare('orient')}
        >
          <span className="ico ico--orient"><Compass size={22} /></span>
          <span className="flex-1">
            <span className="block font-serif text-[1.1rem] text-ink">Orient me</span>
            <span className="block text-sm text-ink-500 mt-0.5">Concept frame only · not a solution hint</span>
          </span>
          <ArrowRight size={18} className="text-ink-400" />
        </button>
        <button type="button" className="choice-tile" onClick={() => onDeclare('stuck')}>
          <span className="ico"><Lightbulb size={22} /></span>
          <span className="flex-1">
            <span className="block font-serif text-[1.1rem] text-ink">I&apos;m stuck</span>
            <span className="block text-sm text-ink-500 mt-0.5">One tiny first push · different from Orient me</span>
          </span>
          <ArrowRight size={18} className="text-ink-400" />
        </button>
        <button type="button" className="choice-tile" onClick={() => onChooseMode('typed')}>
          <span className="ico"><PencilLine size={22} /></span>
          <span className="flex-1">
            <span className="block font-serif text-[1.1rem] text-ink">Let me type</span>
            <span className="block text-sm text-ink-500 mt-0.5">Unrestricted text · a few lines is enough</span>
          </span>
          <ArrowRight size={18} className="text-ink-400" />
        </button>
      </div>

      <AiPrivacyBanner ageBand={ageBand} compact />

      <p className="text-[13px] text-ink-400 text-center pt-2">
        Take your time. Sessions are interruptible — drafts resume if you leave mid-capture.
      </p>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Chat thread (after the student sends)
   ────────────────────────────────────────────── */

function ChatThread({
  thread,
  question,
  diagnosisId,
  onQuickCheckPick,
}: {
  thread: Turn[];
  question: QuestionNode;
  diagnosisId?: string;
  onQuickCheckPick: (coachTurnId: string, qc: QuickCheck, optionIndex: number, source: 'diagnosis' | 'followup') => void;
}) {
  return (
    <div className="space-y-4 pt-4 pb-2">
      <AnimatePresence initial={false}>
        {thread.map((turn) => {
          if (turn.role === 'student') return <StudentBubble key={turn.id} attempt={turn.attempt} question={question} />;
          if (turn.kind === 'thinking') return <ThinkingBubble key={turn.id} />;
          if (turn.kind === 'diagnosis')
            return (
              <DiagnosisBubble
                key={turn.id}
                turnId={turn.id}
                questionId={question.id}
                diagnosisId={diagnosisId}
                diagnosis={turn.diagnosis}
                pickedIndex={turn.quickCheckAnsweredIndex}
                onQuickCheckPick={(id, qc, idx) => onQuickCheckPick(id, qc, idx, 'diagnosis')}
              />
            );
          if (turn.kind === 'followup')
            return (
              <FollowupBubble
                key={turn.id}
                turnId={turn.id}
                reply={turn.reply}
                pickedIndex={turn.quickCheckAnsweredIndex}
                onQuickCheckPick={(id, qc, idx) => onQuickCheckPick(id, qc, idx, 'followup')}
              />
            );
          if (turn.kind === 'tool') return <ToolBubble key={turn.id} turnId={turn.id} tool={turn.tool} />;
          if (turn.kind === 'error') return <ErrorBubble key={turn.id} message={turn.message} />;
          return null;
        })}
      </AnimatePresence>
    </div>
  );
}

function StudentBubble({ attempt, question }: { attempt: StudentAttempt; question: QuestionNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end"
    >
      <div className="bubble-student">
        {attempt.kind === 'photo' && (
          <div>
            <div className="flex items-center gap-2 text-[12px] text-ink-500 mb-2">
              <ImageIcon size={13} /> Your working
              {attempt.pageCount && attempt.pageCount > 1 ? (
                <span className="tabular-nums">· {attempt.pageCount} pages</span>
              ) : null}
            </div>
            {attempt.pageUrls && attempt.pageUrls.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto max-w-[280px]">
                {attempt.pageUrls.map((url, i) => (
                  <img
                    key={`${url.slice(0, 24)}_${i}`}
                    src={url}
                    alt={`Page ${i + 1}`}
                    className="rounded-xl max-h-[180px] w-auto shrink-0"
                  />
                ))}
              </div>
            ) : (
              <img src={attempt.thumbnailUrl} alt="Your working" className="rounded-xl max-h-[240px] w-auto" />
            )}
          </div>
        )}
        {attempt.kind === 'typed' && <span className="bubble-math"><MixedMath>{attempt.text}</MixedMath></span>}
        {attempt.kind === 'mcq' && (
          <span>
            <span className="text-ink-500 text-[13px] block mb-1">My answer</span>
            <span className="font-medium">{String.fromCharCode(65 + attempt.index)}.</span>{' '}
            <span className="option-math"><MixedMath>{attempt.label}</MixedMath></span>
          </span>
        )}
        {attempt.kind === 'mcq_with_text' && (
          <div className="space-y-2">
            <div>
              <span className="text-ink-500 text-[13px] block mb-1">My answer</span>
              <span className="font-medium">{String.fromCharCode(65 + attempt.index)}.</span>{' '}
              <span className="option-math"><MixedMath>{attempt.label}</MixedMath></span>
            </div>
            <div className="bubble-math border-t border-paper-300/60 pt-2">
              <MixedMath>{attempt.text}</MixedMath>
            </div>
          </div>
        )}
        {attempt.kind === 'mcq_with_photo' && (
          <div className="space-y-2">
            <div>
              <span className="text-ink-500 text-[13px] block mb-1">My answer</span>
              <span className="font-medium">{String.fromCharCode(65 + attempt.index)}.</span>{' '}
              <span className="option-math"><MixedMath>{attempt.label}</MixedMath></span>
            </div>
            <img src={attempt.thumbnailUrl} alt="Your working" className="rounded-xl max-h-[200px] w-auto" />
          </div>
        )}
        {attempt.kind === 'stuck' && (
          <span className="text-ink-700 italic">{attempt.note}</span>
        )}
        {attempt.kind === 'orient' && (
          <span className="text-ink-700 italic inline-flex items-center gap-1.5">
            <Compass size={13} className="text-violet-700" /> Orient me
          </span>
        )}
        {attempt.kind === 'reply_text' && (
          <span className="bubble-math"><MixedMath>{attempt.text}</MixedMath></span>
        )}
        {attempt.kind === 'reply_qc' && (
          <span className="text-ink-700 inline-flex items-center gap-1.5">
            {attempt.pickedCorrect
              ? <Check size={14} className="text-leaf-700" />
              : <X size={14} className="text-amber-700" />}
            Picked: <span className="font-medium ml-0.5"><MixedMath>{attempt.pickedLabel}</MixedMath></span>
          </span>
        )}
        {attempt.kind === 'reply_chip' && (
          <span className="text-ink-700 italic">{attempt.label}</span>
        )}
      </div>
      {/* Avoid lint warning for unused param when question doesn't drive content */}
      <span className="hidden">{question.id}</span>
    </motion.div>
  );
}

function ThinkingBubble() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex">
      <div className="bubble-coach inline-flex items-center gap-2 py-3">
        <span className="text-[13px] text-violet-900/80 font-medium">Reading your work</span>
        <span className="typing-dots inline-flex"><span /><span /><span /></span>
      </div>
    </motion.div>
  );
}

function CoachBubbleSimple({
  children,
  accent = 'soft',
}: {
  children: React.ReactNode;
  accent?: 'soft' | 'positive' | 'caution';
}) {
  const cls =
    accent === 'positive'
      ? 'bubble-coach bg-leaf-50 border-leaf-300/50'
      : accent === 'caution'
        ? 'bubble-coach bg-amber-50 border-amber-300/50'
        : 'bubble-coach';
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex"
    >
      <div className={cls}>{children}</div>
    </motion.div>
  );
}

function DiagnosisBubble({
  turnId,
  questionId,
  diagnosisId,
  diagnosis,
  pickedIndex,
  onQuickCheckPick,
}: {
  turnId: string;
  questionId: string;
  diagnosisId?: string;
  diagnosis: DiagnosisResult;
  pickedIndex?: number;
  onQuickCheckPick: (diagnosisTurnId: string, qc: QuickCheck, optionIndex: number) => void;
}) {
  const studentFacing = attachStudentFacing(diagnosis, diagnosisId);
  const verdictAccent =
    studentFacing.certainty === 'definitive' && diagnosis.verdict === 'correct'
      ? 'positive'
      : studentFacing.certainty === 'uncertain' || diagnosis.needsClarification
        ? 'caution'
        : 'soft';

  // Build the message — prefer coachMessage, else fall back to first card body.
  const message = diagnosis.coachMessage?.trim()
    || diagnosis.cards[0]?.body
    || 'Let me show you the next move.';

  const tone = mistakeMicroTag(diagnosis);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-start scroll-mt-24"
      data-turn-id={turnId}
    >
      <CoachBubbleSimple accent={verdictAccent}>
        {tone && (
          <div className={[
            'mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide',
            verdictAccent === 'positive'
              ? 'text-leaf-700'
              : verdictAccent === 'caution'
                ? 'text-amber-800'
                : 'text-violet-900',
          ].join(' ')}>
            <Sparkles size={12} /> {tone}
          </div>
        )}
        <div className="bubble-math">
          <MixedMath>{message}</MixedMath>
        </div>
        <p className="mt-2 text-[12px] text-ink-500 italic">{studentFacing.invitation}</p>
      </CoachBubbleSimple>

      <DisputeAction
        diagnosisId={studentFacing.diagnosisId}
        questionId={questionId}
        certainty={studentFacing.certainty}
        evidenceAnchors={studentFacing.evidenceAnchors}
        evidenceSummary={studentFacing.evidenceSummary}
        firstBreakOrSound={studentFacing.firstBreakOrSound}
      />

      {diagnosis.quickCheck && diagnosis.quickCheck.options.length >= 2 && (
        <div className="mt-3 w-full max-w-[680px] space-y-3">
          <div className="px-1 text-[14px] text-ink-700 font-medium bubble-math">
            <MixedMath>{diagnosis.quickCheck.prompt}</MixedMath>
          </div>
          <div className="space-y-2">
            {diagnosis.quickCheck.options.map((option, index) => {
              const answered = pickedIndex != null;
              const isPicked = pickedIndex === index;
              const dataState = !answered
                ? undefined
                : isPicked
                  ? option.correct ? 'correct' : 'incorrect'
                  : option.correct ? 'correct' : 'dimmed';
              return (
                <button
                  key={`${turnId}_qc_${index}`}
                  className="qc-option"
                  data-state={dataState}
                  disabled={answered}
                  onClick={() => onQuickCheckPick(turnId, diagnosis.quickCheck!, index)}
                >
                  <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-paper-200 text-ink-700 text-[12px] font-semibold shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 option-math">
                    <MixedMath>{option.label}</MixedMath>
                  </span>
                  {answered && isPicked && option.correct && <Check size={16} className="text-leaf-700 mt-1" />}
                  {answered && isPicked && !option.correct && <X size={16} className="text-amber-700 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/**
 * Inline coach reply for a follow-up turn — smaller than DiagnosisBubble (no
 * verdict tag, no first-impression accent), renders an optional new QuickCheck.
 * If the model set conversationDone, we add a quiet "ready when you are" footer.
 */
function FollowupBubble({
  turnId,
  reply,
  pickedIndex,
  onQuickCheckPick,
}: {
  turnId: string;
  reply: CoachFollowupResult;
  pickedIndex?: number;
  onQuickCheckPick: (followupTurnId: string, qc: QuickCheck, optionIndex: number) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-start scroll-mt-24"
      data-turn-id={turnId}
    >
      <CoachBubbleSimple accent="soft">
        <div className="bubble-math">
          <MixedMath>{reply.coachMessage}</MixedMath>
        </div>
        {reply.conversationDone && (
          <div className="mt-2 text-[12px] text-ink-500 italic">
            Ready when you are — tap <span className="font-medium text-ink-700">Next question</span> below.
          </div>
        )}
      </CoachBubbleSimple>

      {reply.quickCheck && reply.quickCheck.options.length >= 2 && (
        <div className="mt-3 w-full max-w-[680px] space-y-3">
          <div className="px-1 text-[14px] text-ink-700 font-medium bubble-math">
            <MixedMath>{reply.quickCheck.prompt}</MixedMath>
          </div>
          <div className="space-y-2">
            {reply.quickCheck.options.map((option, index) => {
              const answered = pickedIndex != null;
              const isPicked = pickedIndex === index;
              const dataState = !answered
                ? undefined
                : isPicked
                  ? option.correct ? 'correct' : 'incorrect'
                  : option.correct ? 'correct' : 'dimmed';
              return (
                <button
                  key={`${turnId}_qc_${index}`}
                  className="qc-option"
                  data-state={dataState}
                  disabled={answered}
                  onClick={() => onQuickCheckPick(turnId, reply.quickCheck!, index)}
                >
                  <span className="mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-paper-200 text-ink-700 text-[12px] font-semibold shrink-0">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="flex-1 option-math">
                    <MixedMath>{option.label}</MixedMath>
                  </span>
                  {answered && isPicked && option.correct && <Check size={16} className="text-leaf-700 mt-1" />}
                  {answered && isPicked && !option.correct && <X size={16} className="text-amber-700 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function ToolBubble({ tool, turnId }: { tool: TutorToolResult; turnId?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex scroll-mt-24"
      data-turn-id={turnId}
    >
      <div className="bubble-coach space-y-3">
        <div className="text-[12px] uppercase tracking-wider text-violet-900/70 font-medium">
          {prettyTool(tool.tool)} · {tool.title}
        </div>
        {tool.intent && (
          <div className="bubble-math text-ink-700 text-[15px]">
            <MixedMath>{tool.intent}</MixedMath>
          </div>
        )}
        <div className="space-y-2">
          {tool.cards.map((card) => (
            <div key={card.id} className="rounded-2xl bg-white/70 border border-paper-300/60 p-3">
              <div className="text-[12px] text-ink-500 mb-1">{prettyKind(card.kind)} · <span className="font-medium text-ink">{card.title}</span></div>
              <div className="bubble-math text-ink leading-relaxed">
                <MixedMath>{card.body}</MixedMath>
              </div>
            </div>
          ))}
        </div>
        {tool.successCriteria && (
          <div className="text-[12px] text-ink-500 italic pt-1">
            ✓ When you can: <span className="not-italic">{tool.successCriteria}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ErrorBubble({ message }: { message: string }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex">
      <div className="bubble-coach bg-amber-50 border-amber-300/50">
        <div className="text-amber-900 text-[14px]">
          {message}
        </div>
      </div>
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   Live practice pulse (motivation without clutter)
   ────────────────────────────────────────────── */

function SolveLiveMetrics({
  stats,
  practicePulse,
  startedAt,
  attemptCount,
}: {
  stats: LearningStats;
  practicePulse: { solidToday: number; questionsToday: number };
  startedAt: number;
  attemptCount: number;
}) {
  const [nowMs, setNowMs] = useState(startedAt);
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 5000);
    return () => window.clearInterval(id);
  }, []);

  const elapsedMs = Math.max(0, nowMs - startedAt);
  const sessionMin = Math.max(0, Math.floor(elapsedMs / 60000));
  const sessionSec = Math.max(0, Math.floor((elapsedMs % 60000) / 1000));
  const minutesTodayLive = stats.studiedMinutesToday + sessionMin;
  const showTodaySessions =
    practicePulse.questionsToday > 0 || practicePulse.solidToday > 0;

  return (
    <div className="w-full border-b border-paper-300/30 bg-gradient-to-b from-paper/80 to-paper/40">
      <div
        className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex flex-wrap items-center gap-2 text-[11px] text-ink-600"
        aria-live="polite"
        aria-label="Practice stats"
      >
        <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50/70 px-2.5 py-1">
          <Clock size={11} className="text-violet-700 shrink-0" aria-hidden />
          <span>
            <span className="text-ink-500">Today </span>
            <span className="font-semibold text-ink-900 tabular-nums">{minutesTodayLive}m</span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-paper-300/80 bg-white/70 px-2.5 py-1">
          <Sparkles size={11} className="text-leaf-700 shrink-0" aria-hidden />
          <span className="font-semibold text-ink-900 tabular-nums">{stats.solved}</span>
          <span className="text-ink-500">solved</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-paper-300/80 bg-white/70 px-2.5 py-1">
          <span className="text-ink-500">Here </span>
          <span className="font-semibold text-ink-900 tabular-nums">
            {sessionMin >= 1 ? `${sessionMin}m` : `${sessionSec}s`}
          </span>
          <span className="text-ink-400">·</span>
          <span className="font-semibold text-ink-900 tabular-nums">{attemptCount}</span>
          <span className="text-ink-500">{attemptCount === 1 ? 'try' : 'tries'}</span>
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
  );
}

/* ──────────────────────────────────────────────
   Top bar + pinned-question
   ────────────────────────────────────────────── */

function TopBar({
  sessionCount,
  language,
  backend,
  pulseChaptersHint,
  memoryCardsDue,
  onOpenMemory,
  onOpenChapters,
  onOpenYou,
  onSkip,
}: {
  sessionCount: number;
  language: PreferredLanguage;
  backend: TutorProvider | 'checking';
  pulseChaptersHint?: boolean;
  memoryCardsDue: number;
  onOpenMemory: () => void;
  onOpenChapters: () => void;
  onOpenYou: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="w-full border-b border-paper-300/40 bg-paper/70 backdrop-blur-sm">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2 flex items-center justify-between text-[12px] text-ink-500 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
          <span className="font-medium text-ink-700 whitespace-nowrap">Q {sessionCount + 1}</span>
          <span className="hidden sm:inline text-[11px] text-ink-400 whitespace-nowrap">
            {language === 'roman_hinglish' ? 'Hinglish' : 'English'}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <span
            className={[
              'hidden sm:inline text-[10px] uppercase tracking-wider',
              backend === 'grok' ? 'text-leaf-700' : backend === 'checking' ? 'text-ink-400' : 'text-amber-700',
            ].join(' ')}
          >
            {backend === 'grok' ? 'Live coach' : backend === 'checking' ? '…' : 'Offline'}
          </span>
          <button
            type="button"
            onClick={onOpenChapters}
            className={[
              'relative p-1.5 rounded-full transition-colors',
              pulseChaptersHint
                ? 'text-violet-700 bg-violet-50 hover:bg-violet-100'
                : 'text-ink-500 hover:bg-paper-200 hover:text-violet-700',
            ].join(' ')}
            title="Chapters in scope"
            aria-label="Chapters in scope"
          >
            <BookMarked size={15} />
            {pulseChaptersHint && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-violet-600 ring-2 ring-white" aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenMemory}
            className="relative p-1.5 rounded-full text-ink-500 hover:bg-paper-200 hover:text-violet-700 transition-colors"
            title="Memory cards"
            aria-label="Memory cards"
          >
            <Brain size={15} />
            {memoryCardsDue > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-0.5 rounded-full bg-violet-600 text-white text-[9px] font-semibold flex items-center justify-center tabular-nums"
                aria-hidden
              >
                {memoryCardsDue > 9 ? '9+' : memoryCardsDue}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={onOpenYou}
            className="p-1.5 rounded-full text-ink-500 hover:bg-paper-200 hover:text-violet-700 transition-colors"
            title="Your progress"
            aria-label="Your progress"
          >
            <User size={15} />
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-ink-500 hover:text-violet-900 hover:bg-paper-200 transition-colors"
            title="Find a different question"
            aria-label="Find a different question"
          >
            <Shuffle size={12} />
            <span className="hidden sm:inline">Try a different one</span>
            <span className="sm:hidden">Skip</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function PinnedQuestion({
  question,
  expanded,
  onToggle,
}: {
  question: QuestionNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  // Truncate the prompt to ~80 chars for the collapsed view (math-aware: rough cut by length).
  const teaser = useMemo(() => collapsePrompt(question.prompt, 90), [question.prompt]);
  return (
    <div className="q-pin">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="w-full flex items-start gap-2 text-left text-ink-700 hover:text-ink"
          aria-expanded={expanded}
        >
          <span className="mt-1 text-[10px] uppercase tracking-wider font-medium text-ink-500 shrink-0">Q</span>
          <span className="flex-1 font-serif text-[17px] sm:text-[18px] leading-snug">
            {expanded ? <MixedMath>{question.prompt}</MixedMath> : <MixedMath>{teaser}</MixedMath>}
          </span>
          <span className="ml-2 mt-1 text-ink-400 shrink-0">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>
        {expanded && question.options && question.options.length > 0 && (
          <div className="mt-2 pl-5 text-[14px] text-ink-500 space-y-1">
            {question.options.map((option, index) => (
              <div key={`pin_o_${index}`} className="flex gap-2">
                <span className="text-ink-400">{String.fromCharCode(65 + index)}.</span>
                <span className="option-math"><MixedMath>{option}</MixedMath></span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────
   Sticky bottom CTA — context-aware
   ────────────────────────────────────────────── */

function BottomCta({
  stage,
  captureMode,
  pages,
  typedText,
  onTypedChange,
  mcqIndex,
  questionHasMcq,
  canSend,
  isSending,
  isFollowupSending,
  isToolLoading,
  diagnosis,
  conversationDone,
  followupSuggestedAction,
  followupText,
  onFollowupTextChange,
  onSendFollowupText,
  onSendFollowupChip,
  onSend,
  onCancel,
  onAddPage,
  onRemovePage,
  onMovePage,
  onRecapturePage,
  photoWarningVisible,
  onDismissPhotoWarning,
  onTryAgain,
  onContinue,
  onSeeFix,
}: {
  stage: SolveStage;
  captureMode: 'photo' | 'typed' | null;
  pages: CapturePage[];
  typedText: string;
  onTypedChange: (v: string) => void;
  mcqIndex?: number;
  questionHasMcq: boolean;
  canSend: boolean;
  isSending: boolean;
  isFollowupSending: boolean;
  isToolLoading: boolean;
  diagnosis?: DiagnosisResult;
  conversationDone: boolean;
  followupSuggestedAction: CoachFollowupResult['suggestedAction'] | undefined;
  followupText: string;
  onFollowupTextChange: (v: string) => void;
  onSendFollowupText: () => void;
  onSendFollowupChip: (chipId: 'still_confused' | 'show_me_more' | 'why' | 'got_it') => void;
  onSend: () => void;
  onCancel: () => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
  onMovePage: (pageId: string, direction: 'up' | 'down') => void;
  onRecapturePage: (pageId: string) => void;
  photoWarningVisible?: boolean;
  onDismissPhotoWarning?: () => void;
  onTryAgain: () => void;
  onContinue: () => void;
  onSeeFix: () => void;
}) {
  if (stage === 'read') {
    return (
      <div className="solve-cta">
        <div className="max-w-2xl mx-auto text-center text-[13px] text-ink-400">
          {questionHasMcq && mcqIndex != null
            ? 'Now tell me why you picked that option'
            : 'Pick how you want to send your work'}
        </div>
      </div>
    );
  }

  if (stage === 'readback') {
    return null;
  }

  if (stage === 'capture') {
    return (
      <div className="solve-cta">
        <div className="max-w-2xl mx-auto space-y-3">
          {captureMode === 'photo' && (
            <MultiPageCapture
              pages={pages}
              onAdd={onAddPage}
              onRemove={onRemovePage}
              onMove={onMovePage}
              onRecapture={onRecapturePage}
              extraText={typedText}
              onExtraText={onTypedChange}
              photoWarningVisible={photoWarningVisible}
              onDismissPhotoWarning={onDismissPhotoWarning}
            />
          )}
          {captureMode === 'typed' && (
            <TypedComposer
              value={typedText}
              onChange={onTypedChange}
              placeholder={
                mcqIndex != null
                  ? 'Why did you pick that option? One line is enough.'
                  : 'Type your reasoning — plain words are fine.'
              }
            />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-3 rounded-full text-ink-600 hover:bg-paper-200 text-sm font-medium"
            >
              Back
            </button>
            <PrimaryButton onClick={onSend} disabled={!canSend || isSending}>
              {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {isSending
                ? 'Working…'
                : captureMode === 'photo'
                  ? 'Check readback'
                  : 'Send to coach'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  // live stage
  // While the LLM is still thinking on the FIRST diagnosis, don't show buttons — they're
  // misleading (no verdict yet). Quiet status only.
  if (isSending && !diagnosis) {
    return (
      <div className="solve-cta">
        <div className="max-w-2xl mx-auto text-center text-[13px] text-ink-400">
          <Loader2 size={14} className="inline-block animate-spin mr-1.5 -mt-0.5" />
          Coach is reading your work…
        </div>
      </div>
    );
  }

  // Diagnosis exists → conversational mode. Persistent input + chip strip.
  // The student can type anything, tap a chip, or hit a primary action.
  // The diagnosis-recommended primary action becomes a chip too, not a giant button —
  // the centre of gravity moves to the conversation, not the "what next" pill.

  const next: NextMoveKind = diagnosis?.nextMove ?? defaultNextMove(diagnosis);
  // Tutor-tool action: shown as a chip if the diagnosis or follow-up suggests it.
  const stuckMode = diagnosis?.verdict === 'needs_work' && diagnosis.attemptTrace.length === 0;
  const showSeeFixChip = next === 'see_fix' || next === 'micro_drill' || followupSuggestedAction === 'see_fix';
  const seeFixLabel = next === 'micro_drill' ? 'Try a tiny one' : stuckMode ? 'Walk me through' : 'Show me the fix';
  const showTryAgainChip = next === 'try_again' || next === 'clarify' || followupSuggestedAction === 'try_again';
  const tryAgainLabel = next === 'clarify' ? 'Add clearer working' : 'Re-attempt';
  // "Next question" is ALWAYS available — pulses when the coach signalled wrap-up.
  const pulseNext = conversationDone || followupSuggestedAction === 'next_question' || next === 'next_question';

  const sendDisabled = !followupText.trim() || isFollowupSending;
  const chipsDisabled = isFollowupSending || isToolLoading;

  return (
    <div className="solve-cta">
      <div className="max-w-2xl mx-auto space-y-2">
        {/* Chip strip — soft conversational shortcuts + diagnosis-suggested actions */}
        <div className="flex flex-wrap items-center gap-1.5">
          <ConvChip onClick={() => onSendFollowupChip('still_confused')} disabled={chipsDisabled}>
            Still confused
          </ConvChip>
          <ConvChip onClick={() => onSendFollowupChip('why')} disabled={chipsDisabled}>
            Why?
          </ConvChip>
          <ConvChip onClick={() => onSendFollowupChip('show_me_more')} disabled={chipsDisabled}>
            Show me more
          </ConvChip>
          <ConvChip onClick={() => onSendFollowupChip('got_it')} disabled={chipsDisabled} accent="positive">
            <Check size={12} /> Got it
          </ConvChip>
          <span className="flex-1" aria-hidden />
          {showSeeFixChip && (
            <ConvChip onClick={onSeeFix} disabled={isToolLoading} accent="action">
              {isToolLoading
                ? <Loader2 size={12} className="animate-spin" />
                : <Sparkles size={12} />}
              {isToolLoading ? 'Loading' : seeFixLabel}
            </ConvChip>
          )}
          {showTryAgainChip && (
            <ConvChip onClick={onTryAgain} disabled={chipsDisabled}>
              {next === 'clarify' ? <Camera size={12} /> : <RefreshCcw size={12} />}
              {tryAgainLabel}
            </ConvChip>
          )}
          <ConvChip onClick={onContinue} disabled={false} accent="primary" pulse={pulseNext}>
            Next question <ArrowRight size={12} />
          </ConvChip>
        </div>

        {/* Persistent chat input — the heart of the conversation */}
        <div className="solve-reply-input">
          <textarea
            value={followupText}
            onChange={(e) => onFollowupTextChange(e.target.value)}
            placeholder={
              isFollowupSending
                ? 'Coach is thinking…'
                : 'Reply to coach — ask why, push back, or share where you got stuck…'
            }
            disabled={isFollowupSending}
            rows={1}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!sendDisabled) onSendFollowupText();
              }
            }}
            className="solve-reply-textarea"
          />
          <button
            type="button"
            onClick={onSendFollowupText}
            disabled={sendDisabled}
            className="solve-reply-send"
            aria-label="Send reply to coach"
          >
            {isFollowupSending
              ? <Loader2 size={16} className="animate-spin" />
              : <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Small pill button used in the conversational chip strip below the chat input.
 * Variants:
 *   - default: muted paper bg, used for soft conversational chips
 *   - positive: leaf-green tint, used for "Got it"
 *   - action: violet outline, used for "Show me the fix" tutor-tool open
 *   - primary: filled violet, used for "Next question". Pulses when the coach signals wrap-up.
 */
function ConvChip({
  children,
  onClick,
  disabled,
  accent = 'default',
  pulse,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: 'default' | 'positive' | 'action' | 'primary';
  pulse?: boolean;
}) {
  const cls = (() => {
    if (accent === 'primary') {
      return [
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium',
        'bg-violet-700 text-white border border-violet-800',
        'hover:bg-violet-800 disabled:opacity-50 disabled:cursor-not-allowed',
        pulse ? 'shadow-[0_0_0_0_rgba(124,58,237,0.6)] animate-pulse-soft' : '',
      ].join(' ');
    }
    if (accent === 'action') {
      return 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed';
    }
    if (accent === 'positive') {
      return 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium border border-leaf-300 bg-leaf-50 text-leaf-800 hover:bg-leaf-100 disabled:opacity-50 disabled:cursor-not-allowed';
    }
    return 'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[12.5px] font-medium border border-paper-300 bg-paper-100/80 text-ink-700 hover:bg-paper-200 disabled:opacity-50 disabled:cursor-not-allowed';
  })();
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls}>
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full sm:flex-1 sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-ink text-paper rounded-full hover:bg-violet-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-[15px] font-medium min-h-[52px] whitespace-nowrap"
    >
      {children}
    </button>
  );
}

function TypedComposer({
  value,
  onChange,
  placeholder,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${Math.min(180, ref.current.scrollHeight)}px`;
    }
  }, [value]);
  return (
    <div className="rounded-2xl border border-paper-300/70 bg-white px-4 py-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={compact ? 1 : 2}
        placeholder={placeholder}
        className="w-full bg-transparent text-[15px] text-ink placeholder-ink-400 leading-relaxed focus:outline-none resize-none"
        autoFocus
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            // bubble up via parent — simplest: trigger blur, parent send button is one tap away on mobile
            (e.currentTarget as HTMLTextAreaElement).blur();
          }
        }}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────
   helpers
   ────────────────────────────────────────────── */

function collapsePrompt(src: string, maxChars: number): string {
  if (src.length <= maxChars) return src;
  let cut = src.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace > maxChars * 0.6) cut = cut.slice(0, lastSpace);

  // If we ended inside an open \( or \[ delimiter, drop back to before that delimiter.
  const openInline = (cut.match(/\\\(/g) || []).length;
  const closeInline = (cut.match(/\\\)/g) || []).length;
  if (openInline > closeInline) {
    const safe = cut.lastIndexOf('\\(');
    if (safe > 0) cut = cut.slice(0, safe);
  }
  const openBlock = (cut.match(/\\\[/g) || []).length;
  const closeBlock = (cut.match(/\\\]/g) || []).length;
  if (openBlock > closeBlock) {
    const safe = cut.lastIndexOf('\\[');
    if (safe > 0) cut = cut.slice(0, safe);
  }

  // Balance bare $ ... $ math (the question dataset uses these). If we end with an odd
  // count of bare $ chars (ignoring escaped \$), drop everything from the last unmatched $.
  const dollarCount = (cut.match(/(^|[^\\])\$/g) || []).length;
  if (dollarCount % 2 === 1) {
    // find the last unescaped $ and cut just before it.
    let i = cut.length - 1;
    while (i >= 0) {
      if (cut[i] === '$' && cut[i - 1] !== '\\') break;
      i -= 1;
    }
    if (i > 0) cut = cut.slice(0, i);
  }
  return `${cut.trim()}…`;
}

function mistakeMicroTag(diagnosis: DiagnosisResult): string | undefined {
  if (diagnosis.verdict === 'correct') return 'Spot on';
  if (diagnosis.verdict === 'partially_correct') return 'Close — small fix';
  if (diagnosis.mistakeType === 'silly_mistake') return 'Just a slip';
  if (diagnosis.mistakeType === 'conceptual_gap') return 'Found the gap';
  if (diagnosis.mistakeType === 'wrong_understanding') return 'Different angle needed';
  if (diagnosis.mistakeType === 'procedure_error') return 'One step off';
  if (diagnosis.mistakeType === 'unclear_evidence') return 'Need a clearer look';
  return undefined;
}

function defaultNextMove(diagnosis?: DiagnosisResult): NextMoveKind {
  if (!diagnosis) return 'next_question';
  if (diagnosis.verdict === 'correct') return 'next_question';
  if (diagnosis.verdict === 'unclear' || diagnosis.needsClarification) return 'clarify';
  if (diagnosis.mistakeType === 'silly_mistake') return 'try_again';
  if (diagnosis.mistakeType === 'conceptual_gap' || diagnosis.mistakeType === 'wrong_understanding') return 'see_fix';
  return 'try_again';
}

function prettyTool(tool: TutorToolResult['tool']): string {
  return tool.replace(/_/g, ' ');
}

function prettyKind(kind: string): string {
  return kind.replace(/_/g, ' ');
}
