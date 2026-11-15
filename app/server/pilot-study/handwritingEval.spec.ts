import { describe, expect, it } from 'vitest';
import {
  checkWriterQuestionFamilyDisjointness,
  createEmptyHandwritingEvalSchema,
  inventoryHandwritingEval,
  type HandwritingBundleMeta,
} from './handwritingEval';

function bundle(
  partial: Partial<HandwritingBundleMeta> &
    Pick<HandwritingBundleMeta, 'bundleId' | 'split' | 'writerId' | 'questionFamilyId'>,
): HandwritingBundleMeta {
  return {
    subject: 'mathematics',
    cohort: 'class_11',
    pageCount: '1',
    imageQuality: 'clean',
    language: 'english',
    errorFamily: 'none',
    alternateMethod: false,
    raterIds: ['r1', 'r2'],
    adjudicatorId: null,
    adjudicationStatus: partial.split === 'blind' ? 'adjudicated' : 'not_required',
    acceptedOrAbstentionLabel: 'accepted_definitive',
    ...partial,
  };
}

describe('handwriting evaluation schema', () => {
  it('encodes decision-memo targets of 100 / 300 and risk budgets', () => {
    const schema = createEmptyHandwritingEvalSchema();
    expect(schema.targets.minDevelopmentStressBundles).toBe(100);
    expect(schema.targets.minBlindAdjudicatedBundles).toBe(300);
    expect(schema.riskBudgets.falsePraise).toBe(0.01);
    expect(schema.requiredSlices).toContain('language');
  });

  it('detects writer and question-family leakage across splits', () => {
    const bundles = [
      bundle({
        bundleId: 'd1',
        split: 'development_stress',
        writerId: 'w1',
        questionFamilyId: 'qf1',
      }),
      bundle({
        bundleId: 'b1',
        split: 'blind',
        writerId: 'w1',
        questionFamilyId: 'qf2',
      }),
      bundle({
        bundleId: 'b2',
        split: 'blind',
        writerId: 'w2',
        questionFamilyId: 'qf1',
      }),
    ];
    const report = checkWriterQuestionFamilyDisjointness(bundles);
    expect(report.writerDisjoint).toBe(false);
    expect(report.questionFamilyDisjoint).toBe(false);
    expect(report.sharedWriterIds).toEqual(['w1']);
    expect(report.sharedQuestionFamilyIds).toEqual(['qf1']);
  });

  it('does not claim blind-gate readiness without inventory', () => {
    const schema = createEmptyHandwritingEvalSchema();
    schema.bundles = [
      bundle({
        bundleId: 'd1',
        split: 'development_stress',
        writerId: 'w1',
        questionFamilyId: 'qf1',
        subject: 'physics',
        language: 'roman_hinglish',
        cohort: 'dropper',
      }),
    ];
    const inventory = inventoryHandwritingEval(schema);
    expect(inventory.meetsDevelopmentStressTarget).toBe(false);
    expect(inventory.meetsBlindTarget).toBe(false);
    expect(inventory.readyForBlindGateClaim).toBe(false);
    expect(inventory.warnings.length).toBeGreaterThan(0);
  });

  it('passes inventory targets when metadata meets 100/300 and disjointness', () => {
    const schema = createEmptyHandwritingEvalSchema();
    const bundles: HandwritingBundleMeta[] = [];
    for (let i = 0; i < 100; i++) {
      bundles.push(
        bundle({
          bundleId: `d${i}`,
          split: 'development_stress',
          writerId: `dw${i}`,
          questionFamilyId: `dqf${i}`,
          subject: (['physics', 'chemistry', 'mathematics'] as const)[i % 3]!,
          cohort: (['class_11', 'class_12', 'dropper'] as const)[i % 3]!,
          language: i % 2 === 0 ? 'english' : 'roman_hinglish',
        }),
      );
    }
    for (let i = 0; i < 300; i++) {
      bundles.push(
        bundle({
          bundleId: `b${i}`,
          split: 'blind',
          writerId: `bw${i}`,
          questionFamilyId: `bqf${i}`,
          subject: (['physics', 'chemistry', 'mathematics'] as const)[i % 3]!,
          cohort: (['class_11', 'class_12', 'dropper'] as const)[i % 3]!,
          language: i % 2 === 0 ? 'english' : 'roman_hinglish',
          adjudicationStatus: 'adjudicated',
        }),
      );
    }
    schema.bundles = bundles;
    const inventory = inventoryHandwritingEval(schema);
    expect(inventory.developmentStressCount).toBe(100);
    expect(inventory.blindCount).toBe(300);
    expect(inventory.disjointness.writerDisjoint).toBe(true);
    expect(inventory.disjointness.questionFamilyDisjoint).toBe(true);
    expect(inventory.readyForBlindGateClaim).toBe(true);
  });
});
