import type { GraphData } from '../../src/domain/types';
import type { UnifiedSelfReport, UnifiedTutorStudentState } from '../../src/domain/tutorUnified';
import {
  appendTranscript,
  buildChapterTopicChips,
  ensureConcept,
  getChapterChipsJson,
  loadUnifiedState,
  saveUnifiedState,
  sliceConceptIdsForChapter,
  upsertChapterChipsJson,
  type TutorSqlDb,
} from '../tutorStore';

/** Map chips with self-report tiers from UI */
export function mapChipConfidenceToUnifiedSelfReport(
  tier: 'confident' | 'roughly' | 'heard' | 'new',
): UnifiedSelfReport {
  switch (tier) {
    case 'confident':
      return 'confident';
    case 'roughly':
      return 'seen';
    case 'heard':
      return 'seen';
    default:
      return 'not_seen';
  }
}

export function tutorGetChapterEntry(
  db: TutorSqlDb,
  graph: GraphData,
  chapterId: string,
): { chapterId: string; chips: ReturnType<typeof buildChapterTopicChips> } {
  const cachedJson = getChapterChipsJson(db, chapterId);

  let chips: ReturnType<typeof buildChapterTopicChips> = [];
  if (cachedJson) {
    try {
      chips = JSON.parse(cachedJson) as typeof chips;
    } catch {
      chips = [];
    }
  }

  if (!cachedJson || chips.length === 0) {
    const fresh = buildChapterTopicChips(graph, chapterId);
    upsertChapterChipsJson(db, chapterId, JSON.stringify(fresh), true);
    return { chapterId, chips: fresh };
  }

  return { chapterId, chips };
}

export interface ChapterEntryPostBody {
  studentId?: string;
  chapterId?: string;
  chipAnswers?: Record<string, 'confident' | 'roughly' | 'heard' | 'new'>;
  freeText?: string;
}

export function tutorPostChapterEntry(
  db: TutorSqlDb,
  graph: GraphData,
  body: ChapterEntryPostBody,
): { state: UnifiedTutorStudentState; chips: ReturnType<typeof buildChapterTopicChips> } {
  const chapterId = body.chapterId ?? '';
  if (!chapterId) throw new Error('chapterId required');
  const studentId =
    typeof body.studentId === 'string' && body.studentId.trim().length > 0 ? body.studentId.trim() : 'anon';

  const { chips } = tutorGetChapterEntry(db, graph, chapterId);
  let state = loadUnifiedState(db, studentId);

  const chapterConceptIds = new Set(sliceConceptIdsForChapter(graph, chapterId));

  for (const chip of chips) {
    const tier = body.chipAnswers?.[chip.subtopicId] ?? 'new';
    const self = mapChipConfidenceToUnifiedSelfReport(tier === 'heard' ? 'heard' : tier);
    for (const conceptId of chip.conceptIds) {
      if (!chapterConceptIds.has(conceptId)) continue;
      ensureConcept(state, conceptId).selfReport = self;
    }
  }

  if (typeof body.freeText === 'string' && body.freeText.trim().length > 0) {
    state.profileNarrative = `${state.profileNarrative}\n[chapter-entry] ${body.freeText.trim()}`.trim();
    appendTranscript(db, studentId, chapterId, {
      role: 'student',
      content: `(chapter entry notes) ${body.freeText.trim()}`,
      at: new Date().toISOString(),
    });
  }

  saveUnifiedState(db, state, true);
  return { state, chips };
}
