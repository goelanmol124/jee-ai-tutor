import { RefreshCcw } from 'lucide-react';
import type { PhotoReadback as PhotoReadbackModel } from '../domain/pilotExperience';
import { recaptureHintCopy } from '../services/photoPages';

interface Props {
  readback: PhotoReadbackModel;
  correction: string;
  onCorrectionChange: (v: string) => void;
  onConfirm: () => void;
  onRecapture: () => void;
  onBack: () => void;
  busy?: boolean;
}

export function PhotoReadbackPanel({
  readback,
  correction,
  onCorrectionChange,
  onConfirm,
  onRecapture,
  onBack,
  busy,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-violet-100 bg-violet-50/60 px-3.5 py-3">
        <p className="text-[12px] uppercase tracking-wider font-semibold text-violet-900 mb-1.5">
          Check before I diagnose
        </p>
        <p className="text-[14px] text-ink-700 leading-relaxed">
          {readback.transcribedWork}
        </p>
        {readback.recognizedQuestionHint && (
          <p className="text-[12px] text-ink-500 mt-2">{readback.recognizedQuestionHint}</p>
        )}
        {readback.pageSummaries.length > 0 && (
          <ul className="mt-2 space-y-1 text-[12px] text-ink-600">
            {readback.pageSummaries.map((p) => (
              <li key={p.pageNumber}>{p.note}</li>
            ))}
          </ul>
        )}
      </div>

      <label className="block">
        <span className="text-[12px] font-medium text-ink-600">Correct what I misread</span>
        <textarea
          value={correction}
          onChange={(e) => onCorrectionChange(e.target.value)}
          rows={3}
          placeholder="Fix any wrong transcription here before diagnosis…"
          className="mt-1.5 w-full rounded-2xl border border-paper-300/80 bg-white/80 px-3 py-2.5 text-[14px]
                     text-ink placeholder-ink-400 focus:outline-none focus:border-violet-400 resize-none"
        />
      </label>

      {readback.suggestedRecapture && (
        <p className="text-[13px] text-amber-900 bg-amber-50/90 border border-amber-200/80 rounded-2xl px-3 py-2.5 leading-relaxed">
          {recaptureHintCopy(readback.suggestedRecapture)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-3 rounded-full text-ink-600 hover:bg-paper-200 text-sm font-medium"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onRecapture}
          className="inline-flex items-center gap-1.5 px-4 py-3 rounded-full border border-paper-300/80
                     text-sm font-medium text-ink-700 hover:border-violet-400"
        >
          <RefreshCcw size={14} />
          Recapture
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full
                     bg-ink text-paper text-sm font-medium hover:bg-violet-900 disabled:opacity-50"
        >
          {busy ? 'Sending…' : 'Looks right — diagnose'}
        </button>
      </div>
    </div>
  );
}
