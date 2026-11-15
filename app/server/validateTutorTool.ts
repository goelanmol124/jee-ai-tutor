import type { BeliefUpdate, TutorCard, TutorCardKind, TutorTool, TutorToolResult } from '../src/domain/types';

const TUTOR_TOOLS = new Set<TutorTool>([
  'diagnosis_card',
  'hint_ladder',
  'micro_lesson',
  'worked_example',
  'splice',
  'micro_drill',
  'full_drill',
  'flashcard',
  'check_card',
  'reflection_card',
]);
const CARD_KINDS = new Set<TutorCardKind>(['diagnosis', 'fix', 'next_action', 'check', 'reflection', 'clarification']);

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(o: Record<string, unknown>, key: string, fallback = ''): string {
  const value = o[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseCard(raw: unknown, index: number): TutorCard {
  if (!isObj(raw)) {
    return {
      id: `tool_card_${index}`,
      kind: 'clarification',
      title: 'Try this',
      body: 'The tutor returned an unreadable card. Ask for the next action again.',
    };
  }
  const kind = CARD_KINDS.has(raw.kind as TutorCardKind) ? raw.kind as TutorCardKind : 'next_action';
  return {
    id: str(raw, 'id', `tool_card_${index}`),
    kind,
    title: str(raw, 'title', 'Try this'),
    body: str(raw, 'body', 'Take one smaller step on the same idea.'),
    actionLabel: str(raw, 'actionLabel') || undefined,
    conceptIds: strArray(raw.conceptIds),
  };
}

function parseUpdate(raw: unknown): BeliefUpdate | undefined {
  if (!isObj(raw)) return undefined;
  const conceptId = str(raw, 'conceptId');
  const delta = typeof raw.delta === 'number' ? Math.max(-0.05, Math.min(0.05, raw.delta)) : 0;
  const reason = str(raw, 'reason', 'Tutor tool completed.');
  if (!conceptId) return undefined;
  return { conceptId, delta, reason };
}

export function validateTutorTool(raw: unknown, fallbackTool: TutorTool, fallbackConceptIds: string[]): TutorToolResult {
  if (!isObj(raw)) return fallbackTutorTool('Tutor action', fallbackTool, fallbackConceptIds);
  const tool = TUTOR_TOOLS.has(raw.tool as TutorTool) ? raw.tool as TutorTool : fallbackTool;
  const cards = Array.isArray(raw.cards) ? raw.cards.map(parseCard) : [];
  const updates = Array.isArray(raw.suggestedBeliefUpdates)
    ? raw.suggestedBeliefUpdates.map(parseUpdate).filter((item): item is BeliefUpdate => Boolean(item))
    : undefined;
  return {
    tool,
    title: str(raw, 'title', 'Try this next'),
    intent: str(raw, 'intent', 'This action targets the fragile idea from the diagnosis.'),
    targetConceptIds: strArray(raw.targetConceptIds).length ? strArray(raw.targetConceptIds) : fallbackConceptIds,
    successCriteria: str(raw, 'successCriteria', 'You can complete the same move without help.'),
    cards: cards.length ? cards : fallbackTutorTool('Try this next', tool, fallbackConceptIds).cards,
    suggestedBeliefUpdates: updates,
  };
}

export function fallbackTutorTool(title: string, tool: TutorTool, targetConceptIds: string[]): TutorToolResult {
  return {
    tool,
    title,
    intent: 'Use one small action to convert the diagnosis into evidence.',
    targetConceptIds,
    successCriteria: 'You can state the idea and apply it once on a tiny example.',
    cards: [{
      id: 'fallback_tool_card',
      kind: 'next_action',
      title,
      body: 'Write the exact rule used in the fragile step, then solve one smaller version before returning to the full question.',
      actionLabel: 'Done',
      conceptIds: targetConceptIds,
    }],
  };
}
