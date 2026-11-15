import type { GraphData } from '../domain/types';

/** Chapters that tend to have approachable first questions in this bank. */
export function getRecommendedStartChapters(graph: GraphData): string[] {
  const counts = new Map<string, { count: number; easy: number }>();
  for (const question of graph.questions) {
    const prev = counts.get(question.chapterId) ?? { count: 0, easy: 0 };
    counts.set(question.chapterId, {
      count: prev.count + 1,
      easy: prev.easy + (question.difficulty <= 3 && !question.needsHumanReview ? 1 : 0),
    });
  }
  const ranked = graph.chapters
    .map((chapter) => ({
      id: chapter.id,
      score: (counts.get(chapter.id)?.easy ?? 0) * 2 + (counts.get(chapter.id)?.count ?? 0),
    }))
    .filter((chapter) => chapter.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((chapter) => chapter.id);
  return ranked.slice(0, 4).length ? ranked.slice(0, 4) : graph.chapters.slice(0, 4).map((chapter) => chapter.id);
}
