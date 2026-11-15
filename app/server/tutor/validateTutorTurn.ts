import { z } from 'zod';

const tutorCoachMode = z.enum([
  'chapter_intro',
  'gauge_probe',
  'teach_concept',
  'derive_formula',
  'splice_step',
  'present_question',
  'diagnose_attempt',
  'error_probe',
  'local_correction',
  'confidence_reflection',
  'meta_narrate',
  'park_and_pivot',
  'review_recall',
]);

const tutorItem = z.union([
  z.object({ kind: z.literal('probe'), prompt: z.string(), expectedAnswerShape: z.string().optional() }),
  z.object({ kind: z.literal('micro_lesson'), explanation: z.string(), tinyExample: z.string().optional() }),
  z.object({ kind: z.literal('derivation'), setup: z.string(), missingLine: z.string() }),
  z.object({
    kind: z.literal('splice'),
    questionRef: z.string(),
    presolved: z.string(),
    gap: z.string(),
  }),
  z.object({ kind: z.literal('question_ref'), questionRef: z.string() }),
  z.object({ kind: z.literal('review_recall'), conceptId: z.string(), prompt: z.string() }),
  z.object({ kind: z.literal('park'), questionRef: z.string(), reason: z.string() }),
]);

export const tutorStateUpdateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('concept_observed'),
    conceptId: z.string(),
    observed: z.enum(['shaky', 'applied_correctly', 'failed']),
    formulaQuoting: z.enum(['unknown', 'partial', 'correct']).optional(),
    formulaUnderstanding: z.enum(['unknown', 'shaky', 'derives_it']).optional(),
    applicationFlexibility: z.enum(['unknown', 'rigid', 'transfers']).optional(),
    confidence: z.enum(['low', 'medium', 'high']).optional(),
    evidence: z.object({
      source: z.enum(['self_report', 'calibration_probe', 'attempt_step', 'follow_up', 'splice', 'micro_lesson_recap']),
      outcome: z.enum([
        'applied_well',
        'applied_with_help',
        'failed',
        'declared_unknown',
        'partially_correct',
        'recall_only',
      ]),
      note: z.string(),
      questionId: z.string().optional(),
    }),
  }),
  z.object({
    kind: z.literal('mistake_observed'),
    conceptId: z.string(),
    candidate: z.object({
      category: z.enum([
        'arithmetic',
        'sign',
        'factor',
        'formula_recall',
        'formula_application',
        'planning',
        'misread',
        'unit',
        'identity_choice',
        'boundary',
        'domain',
      ]),
      specificInstance: z.string(),
      surfaceForm: z.string(),
    }),
    recoveredViaProbe: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('coverage_advance'),
    conceptId: z.string(),
    to: z.enum(['introduced', 'practiced', 'mastered_for_now']),
  }),
  z.object({
    kind: z.literal('park_question'),
    questionRef: z.string(),
    reason: z.string(),
    chapterId: z.string().optional(),
  }),
  z.object({
    kind: z.literal('schedule_review'),
    conceptId: z.string(),
    outcome: z.enum(['success', 'fail']),
  }),
]);

export const tutorTurnSchema = z.object({
  chosenCandidateId: z.union([z.string(), z.literal('custom')]),
  customCandidate: z
    .object({
      mode: tutorCoachMode,
      targetConcept: z.string(),
      itemIntent: z.string(),
    })
    .optional(),
  mode: tutorCoachMode,
  coachMessage: z.string(),
  item: tutorItem.optional(),
  metaNarration: z.string().optional(),
  stateUpdates: z.array(tutorStateUpdateSchema).default([]),
  endsTurn: z.boolean().default(true),
});

export type ValidatedTutorTurn = z.infer<typeof tutorTurnSchema>;

export function validateTutorTurn(raw: unknown): { ok: true; value: ValidatedTutorTurn } | { ok: false; errors: string } {
  const r = tutorTurnSchema.safeParse(raw);
  if (r.success) return { ok: true, value: r.data };
  const formatted = r.error.issues
    .slice(0, 8)
    .map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .join(' | ');
  return { ok: false, errors: formatted };
}
