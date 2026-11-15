import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { MixedMath } from './Math';

interface MathInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;          // Cmd/Ctrl + Enter
  onNewStep: () => void;         // Enter
  onHint: () => void;            // Tab
  onWorkedExample: () => void;   // Shift + Tab
  placeholder?: string;
  autoFocus?: boolean;
  /** When true, show a KaTeX preview only if the text looks like LaTeX (delimiters, environments). */
  previewOnlyForLatex?: boolean;
  showPreview?: boolean;
}

function looksLikeLatex(s: string): boolean {
  return /\\[\(\[]|\\begin\{|\$/.test(s);
}

// Plain-language friendly: tutor reads intent; optional \( … \) if you want formatted math.
export function MathInput({
  value, onChange, onSubmit, onNewStep, onHint, onWorkedExample,
  placeholder, autoFocus = true, showPreview = true, previewOnlyForLatex = true,
}: MathInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
    }
  }, [autoFocus]);

  // auto-grow
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onNewStep();
      return;
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      onHint();
      return;
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      onWorkedExample();
      return;
    }
  }

  return (
    <div className="w-full">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={
          placeholder ??
          'Your next step in plain words is enough — e.g. “product rule on x² sin 2x, then chain on sin”'
        }
        rows={1}
        spellCheck={false}
        className="w-full resize-none overflow-hidden bg-transparent
                   text-ink/90 placeholder-ink-400/70 font-serif text-[1.05rem] leading-7
                   focus:outline-none border-0 px-0 py-2"
      />
      {showPreview && value.trim() && (previewOnlyForLatex ? looksLikeLatex(value) : focused) && (
        <div className="text-sm text-ink-500 pl-3 border-l-2 border-ink-300/50 mt-1 mb-2 font-serif">
          <MixedMath>{value}</MixedMath>
        </div>
      )}
    </div>
  );
}
