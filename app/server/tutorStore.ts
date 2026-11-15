import type { GraphData } from '../src/domain/types';
import type {
  ChapterTopicChip,
  TutorTranscriptTurn,
  TutorTurn,
  UnifiedChapterSession,
  UnifiedConceptKnowledge,
  UnifiedTutorStudentState,
} from '../src/domain/tutorUnified';
import { deriveBeliefFromLayers } from './tutor/beliefDerive';
import { flushTutorDb } from './db/sqlite';

/** sql.js Database — minimal surface for our usage */
export type TutorSqlDb = {
  prepare: (sql: string) => {
    bind: (values?: unknown[]) => void;
    step: () => boolean;
    get: () => unknown[];
    getColumnNames: () => string[];
    free: () => void;
  };
  run: (sql: string, params?: unknown[]) => void;
};

export function defaultUnifiedState(studentId: string): UnifiedTutorStudentState {
  return {
    studentId,
    language: 'english',
    profileNarrative: '',
    concepts: {},
    chapterSessions: {},
    globalMistakePatterns: [],
    reviewSchedules: {},
    mistakePatternSchedules: {},
    consecutiveFullQuestions: 0,
    sessionMode: 'chapter',
  };
}

export function ensureConcept(state: UnifiedTutorStudentState, conceptId: string): UnifiedConceptKnowledge {
  if (!state.concepts[conceptId]) {
    state.concepts[conceptId] = {
      conceptId,
      observed: 'untested',
      belief: deriveBeliefFromLayers({
        observed: 'untested',
        confidence: 'medium',
        recentEvidence: [],
        mistakePatterns: [],
      }),
      confidence: 'medium',
      recentEvidence: [],
      mistakePatterns: [],
    };
  }
  return state.concepts[conceptId];
}

export function ensureChapterSession(
  state: UnifiedTutorStudentState,
  chapterId: string,
  chapterConceptIds: string[],
): UnifiedChapterSession {
  if (!state.chapterSessions[chapterId]) {
    state.chapterSessions[chapterId] = {
      chapterId,
      startedAt: new Date().toISOString(),
      conceptCoverage: chapterConceptIds.map((conceptId) => ({
        conceptId,
        state: 'not_touched',
      })),
      subtopicCoverage: [],
      parkedItems: [],
    };
  }
  const session = state.chapterSessions[chapterId];
  for (const cid of chapterConceptIds) {
    if (!session.conceptCoverage.some((e) => e.conceptId === cid)) {
      session.conceptCoverage.push({ conceptId: cid, state: 'not_touched' });
    }
  }
  return session;
}

export function sliceConceptIdsForChapter(graph: GraphData, chapterId: string): string[] {
  return graph.concepts.filter((c) => c.chapterId === chapterId).map((c) => c.id);
}

export function buildChapterTopicChips(graph: GraphData, chapterId: string): ChapterTopicChip[] {
  const concepts = graph.concepts
    .filter((c) => c.chapterId === chapterId)
    .slice()
    .sort((a, b) => (b.centrality ?? 0) - (a.centrality ?? 0));

  const n = concepts.length;
  if (n === 0) return [];

  const targetChips = Math.min(12, Math.max(6, Math.ceil(n / 4)));
  const per = Math.ceil(n / targetChips);
  const chips: ChapterTopicChip[] = [];
  let idx = 0;
  while (idx < n) {
    const batch = concepts.slice(idx, idx + per);
    idx += per;
    const label =
      batch.length === 1
        ? batch[0].name
        : `${batch[0].name.split(/[,(]/)[0]?.trim()} + ${batch.length - 1} more`;
    chips.push({
      subtopicId: `chip_${chips.length}_${chapterId}`,
      label: label.slice(0, 72),
      conceptIds: batch.map((c) => c.id),
    });
  }
  return chips;
}

export function loadUnifiedState(db: TutorSqlDb, studentId: string): UnifiedTutorStudentState {
  const stmt = db.prepare('SELECT state_json FROM tutor_student_state WHERE student_id = ?');
  stmt.bind([studentId]);
  if (!stmt.step()) {
    stmt.free();
    return defaultUnifiedState(studentId);
  }
  const row = stmt.get();
  stmt.free();
  const cell = row?.[0];
  if (typeof cell === 'string' && cell) {
    try {
      return JSON.parse(cell) as UnifiedTutorStudentState;
    } catch {
      return defaultUnifiedState(studentId);
    }
  }
  return defaultUnifiedState(studentId);
}

export function saveUnifiedState(db: TutorSqlDb, state: UnifiedTutorStudentState, flushDisk = true) {
  const now = new Date().toISOString();
  state.updatedAt = now;
  const json = JSON.stringify(state);
  db.run(
    `INSERT INTO tutor_student_state (student_id, state_json, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(student_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    [state.studentId, json, now],
  );
  if (flushDisk) flushTutorDb(db as unknown as { export: () => Uint8Array });
}

export function appendTranscript(
  db: TutorSqlDb,
  studentId: string,
  chapterId: string | undefined,
  turn: TutorTranscriptTurn,
  flushDisk = true,
) {
  db.run(
    `INSERT INTO tutor_transcript_turns (student_id, chapter_id, role, content, tutor_turn_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      studentId,
      chapterId ?? null,
      turn.role,
      turn.content,
      turn.tutorTurn ? JSON.stringify(turn.tutorTurn) : null,
      turn.at,
    ],
  );
  if (flushDisk) flushTutorDb(db as unknown as { export: () => Uint8Array });
}

export function upsertChapterChipsJson(db: TutorSqlDb, chapterId: string, chipsJson: string, flushDisk = true) {
  db.run(
    `INSERT INTO tutor_chapter_chips (chapter_id, chips_json) VALUES (?, ?)
     ON CONFLICT(chapter_id) DO UPDATE SET chips_json = excluded.chips_json`,
    [chapterId, chipsJson],
  );
  if (flushDisk) flushTutorDb(db as unknown as { export: () => Uint8Array });
}

export function getChapterChipsJson(db: TutorSqlDb, chapterId: string): string | null {
  const stmt = db.prepare('SELECT chips_json FROM tutor_chapter_chips WHERE chapter_id = ? LIMIT 1');
  stmt.bind([chapterId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.get();
  stmt.free();
  const v = row?.[0];
  return typeof v === 'string' ? v : null;
}

export function transcriptSliceForPrompt(
  db: TutorSqlDb,
  studentId: string,
  maxTurns: number,
): Array<{ role: 'student' | 'coach'; content: string }> {
  const stmt = db.prepare(
    `SELECT role, content FROM tutor_transcript_turns WHERE student_id = ? ORDER BY id DESC LIMIT ?`,
  );
  stmt.bind([studentId, maxTurns]);
  const rows: Array<{ role: 'student' | 'coach'; content: string }> = [];
  while (stmt.step()) {
    const r = stmt.get();
    const roleRaw = String(r?.[0] ?? '');
    const role: 'coach' | 'student' = roleRaw === 'coach' ? 'coach' : 'student';
    rows.push({ role, content: String(r?.[1] ?? '') });
  }
  stmt.free();
  return rows.reverse();
}

/** Question ids already surfaced via coach question_ref/splice items (this session). */
export function recentQuestionRefsFromCoachTranscript(db: TutorSqlDb, studentId: string, maxRows = 250): string[] {
  const stmt = db.prepare(
    `SELECT tutor_turn_json FROM tutor_transcript_turns
     WHERE student_id = ? AND role = 'coach' AND tutor_turn_json IS NOT NULL
     ORDER BY id DESC LIMIT ?`,
  );
  stmt.bind([studentId, maxRows]);
  const refs: string[] = [];
  while (stmt.step()) {
    const cell = stmt.get()?.[0];
    if (typeof cell !== 'string') continue;
    try {
      const t = JSON.parse(cell) as TutorTurn;
      const item = t.item;
      if (item?.kind === 'question_ref') refs.push(item.questionRef);
      else if (item?.kind === 'splice') refs.push(item.questionRef);
    } catch {
      /* malformed json — skip */
    }
  }
  stmt.free();
  return refs.reverse();
}
