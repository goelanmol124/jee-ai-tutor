import type { ParentProgressSummary as Summary } from '../domain/pilotExperience';

interface Props {
  summary: Summary;
}

export function ParentProgressSummaryView({ summary }: Props) {
  return (
    <section
      aria-label="Parent progress summary"
      className="rounded-2xl border border-paper-300/70 bg-white/80 overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-paper-300/50">
        <h2 className="font-serif text-lg text-ink">For parents</h2>
        <p className="text-[13px] text-ink-500 mt-0.5 leading-relaxed">
          Bounded summary only — no full conversation transcript, no rank, no readiness score.
        </p>
      </div>
      <dl className="divide-y divide-paper-300/40">
        <Row label="Student" value={summary.studentNickname} />
        <Row label="Consent" value={consentLabel(summary.consentStatus)} />
        <Row label="Independent finishes" value={String(summary.independentlyCompleted)} />
        <Row label="Successfully rescued" value={String(summary.successfullyRescued)} />
        <Row
          label="Repeated-error trend"
          value={summary.repeatedErrorCategoriesDeclining ? 'Improving' : 'Still gathering'}
        />
        <Row label="Delayed review" value={summary.delayedReviewRetentionNote} />
        <Row label="Past-self trend" value={summary.pastSelfTrendNote} />
      </dl>
      <p className="px-4 py-3 text-[11px] text-ink-400 leading-relaxed border-t border-paper-300/40">
        Transcript available: never on this surface. Safety escalations follow a separate protocol.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 px-4 py-3">
      <dt className="text-[13px] text-ink-500">{label}</dt>
      <dd className="text-[14px] text-ink font-medium sm:text-right sm:max-w-[60%] leading-snug">{value}</dd>
    </div>
  );
}

function consentLabel(status: Summary['consentStatus']): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'active':
      return 'Active';
    case 'withdrawn':
      return 'Withdrawn';
  }
}
