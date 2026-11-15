import { useState } from 'react';
import { Flag } from 'lucide-react';
import type { FeedbackCertainty } from '../domain/pilotExperience';
import { certaintyHint, certaintyLabel } from '../services/feedbackCertainty';
import { pilotDispute } from '../services/pilotApi';

interface Props {
  diagnosisId: string;
  questionId: string;
  certainty: FeedbackCertainty;
  evidenceAnchors: Array<{ label: string; detail: string }>;
  evidenceSummary: string;
  firstBreakOrSound: string;
}

export function DisputeAction({
  diagnosisId,
  questionId,
  certainty,
  evidenceAnchors,
  evidenceSummary,
  firstBreakOrSound,
}: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function submit() {
    if (status === 'sending') return;
    setStatus('sending');
    const res = await pilotDispute({
      diagnosisId,
      questionId,
      note: note.trim() || 'Student marked coach read as wrong.',
      createdAt: new Date().toISOString(),
    });
    setStatus(res.ok ? 'sent' : 'error');
    if (res.ok) setOpen(false);
  }

  return (
    <div className="mt-3 w-full max-w-[680px] space-y-2">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span
          className={[
            'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide',
            certainty === 'uncertain'
              ? 'bg-amber-100 text-amber-900'
              : certainty === 'tentative'
                ? 'bg-violet-100 text-violet-900'
                : 'bg-leaf-100 text-leaf-700',
          ].join(' ')}
        >
          {certaintyLabel(certainty)}
        </span>
        <span className="text-[12px] text-ink-500">{certaintyHint(certainty)}</span>
      </div>

      <div className="rounded-2xl border border-paper-300/60 bg-white/60 px-3 py-2.5 text-[13px] text-ink-600 space-y-1.5">
        <p>{evidenceSummary}</p>
        <p className="text-ink-700">{firstBreakOrSound}</p>
        {evidenceAnchors.length > 0 && (
          <ul className="pt-1 space-y-1">
            {evidenceAnchors.map((a) => (
              <li key={`${a.label}_${a.detail.slice(0, 24)}`} className="flex gap-2">
                <span className="text-ink-400 shrink-0">{a.label}</span>
                <span>{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {status === 'sent' ? (
        <p className="text-[12px] text-leaf-800 px-1">Thanks — flagged for review. Keep going; this won’t punish you.</p>
      ) : open ? (
        <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 px-3 py-3 space-y-2">
          <p className="text-[13px] text-ink-700 font-medium">What looks wrong?</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional — e.g. misread a step, wrong concept…"
            className="w-full bg-white/80 rounded-xl border border-amber-200/80 px-2.5 py-2 text-[13px]
                       text-ink focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-[13px] text-ink-600 hover:bg-amber-100/80 rounded-full"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={status === 'sending'}
              className="px-3 py-2 text-[13px] font-medium text-amber-950 bg-amber-200/80 hover:bg-amber-200 rounded-full disabled:opacity-50"
            >
              {status === 'sending' ? 'Sending…' : 'Submit dispute'}
            </button>
          </div>
          {status === 'error' && (
            <p className="text-[12px] text-amber-900">Couldn’t send — try again in a moment.</p>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-600 hover:text-violet-800 px-1"
        >
          <Flag size={13} aria-hidden />
          This looks wrong
        </button>
      )}
    </div>
  );
}
