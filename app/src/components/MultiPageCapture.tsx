import { Camera, ChevronDown, ChevronUp, Plus, RefreshCcw, X } from 'lucide-react';
import type { CapturePage } from '../domain/pilotExperience';

interface Props {
  pages: CapturePage[];
  onAdd: () => void;
  onRemove: (pageId: string) => void;
  onMove: (pageId: string, direction: 'up' | 'down') => void;
  onRecapture: (pageId: string) => void;
  extraText: string;
  onExtraText: (v: string) => void;
  photoWarningVisible?: boolean;
  onDismissPhotoWarning?: () => void;
}

export function MultiPageCapture({
  pages,
  onAdd,
  onRemove,
  onMove,
  onRecapture,
  extraText,
  onExtraText,
  photoWarningVisible,
  onDismissPhotoWarning,
}: Props) {
  return (
    <div className="space-y-3">
      {photoWarningVisible && (
        <div
          role="status"
          className="rounded-2xl border border-amber-200/90 bg-amber-50/95 px-3.5 py-3 text-[13px] text-ink-700 leading-relaxed"
        >
          <p className="font-medium text-ink-800 mb-1">Before you snap</p>
          <p>
            Photos of your work are read to help you, then deleted from our systems on a short retention clock.
            Avoid faces, names on sheets, or anyone else in frame.
          </p>
          {onDismissPhotoWarning && (
            <button
              type="button"
              className="mt-2 text-[12px] font-medium text-amber-900 underline-offset-2 hover:underline"
              onClick={onDismissPhotoWarning}
            >
              Got it
            </button>
          )}
        </div>
      )}

      {pages.length === 0 ? (
        <button
          type="button"
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-8 rounded-2xl border-2 border-dashed border-paper-300
                     text-ink-600 hover:border-violet-400 hover:text-violet-800 transition-colors"
        >
          <Camera size={20} />
          <span className="font-medium">Add page 1</span>
        </button>
      ) : (
        <ul className="space-y-2.5" aria-label="Captured pages in order">
          {pages.map((page, index) => (
            <li
              key={page.id}
              className="rounded-2xl border border-paper-300/70 bg-white/80 overflow-hidden"
            >
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-paper-300/50">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-violet-900">
                  Page {page.pageNumber}
                </span>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label={`Move page ${page.pageNumber} earlier`}
                    disabled={index === 0}
                    onClick={() => onMove(page.id, 'up')}
                    className="p-1.5 rounded-full text-ink-500 hover:bg-paper-200 disabled:opacity-30"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move page ${page.pageNumber} later`}
                    disabled={index === pages.length - 1}
                    onClick={() => onMove(page.id, 'down')}
                    className="p-1.5 rounded-full text-ink-500 hover:bg-paper-200 disabled:opacity-30"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Retake page ${page.pageNumber}`}
                    onClick={() => onRecapture(page.id)}
                    className="p-1.5 rounded-full text-ink-500 hover:bg-paper-200"
                  >
                    <RefreshCcw size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove page ${page.pageNumber}`}
                    onClick={() => onRemove(page.id)}
                    className="p-1.5 rounded-full text-ink-500 hover:bg-amber-50 hover:text-amber-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <img
                src={page.previewUrl}
                alt={`Page ${page.pageNumber} of your working`}
                className="w-full max-h-[220px] object-contain bg-paper-100"
              />
            </li>
          ))}
        </ul>
      )}

      {pages.length > 0 && (
        <button
          type="button"
          onClick={onAdd}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full border border-paper-300/80
                     text-sm font-medium text-ink-700 hover:border-violet-400 hover:text-violet-800"
        >
          <Plus size={16} />
          Add page {pages.length + 1}
        </button>
      )}

      <textarea
        value={extraText}
        onChange={(e) => onExtraText(e.target.value)}
        rows={2}
        placeholder="Optional note for the coach (any language)"
        className="w-full bg-transparent text-[14px] text-ink placeholder-ink-400 px-1 py-1 focus:outline-none resize-none"
      />
    </div>
  );
}
