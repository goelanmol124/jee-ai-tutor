import type { PilotProfile } from '../domain/pilotExperience';

interface AiPrivacyBannerProps {
  ageBand: PilotProfile['ageBand'];
  compact?: boolean;
}

export function AiPrivacyBanner({ ageBand, compact }: AiPrivacyBannerProps) {
  const minor = ageBand === 'under_18';
  return (
    <div
      className={[
        'rounded-2xl border border-paper-300/70 bg-white/70 text-ink-600 leading-relaxed',
        compact ? 'px-3 py-2.5 text-[12px]' : 'px-4 py-3 text-[13px]',
      ].join(' ')}
      role="note"
    >
      <p className="font-medium text-ink-800 mb-1">AI tutor notice</p>
      <p>
        Coach replies are AI-generated. They can be wrong. Use{' '}
        <span className="font-medium text-ink-800">This looks wrong</span> anytime a reply misreads your work.
      </p>
      {minor ? (
        <p className="mt-1.5">
          If you are under 18, a parent or guardian must have given permission for this pilot.
          Your practice stays private by default — parents see a short progress summary, not your full chat.
        </p>
      ) : (
        <p className="mt-1.5">
          Your practice is private by default. Photos are kept only briefly for coaching, then deleted.
        </p>
      )}
    </div>
  );
}

interface ConsentGateProps {
  ageBand: PilotProfile['ageBand'];
  accepted: boolean;
  onAccept: () => void;
}

export function OnboardingConsentGate({ ageBand, accepted, onAccept }: ConsentGateProps) {
  if (accepted) return null;
  return (
    <div className="rounded-2xl border border-violet-200/80 bg-violet-50/70 px-4 py-4 space-y-3">
      <AiPrivacyBanner ageBand={ageBand} />
      <button
        type="button"
        onClick={onAccept}
        className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-full
                   bg-ink text-paper text-sm font-medium hover:bg-violet-900"
      >
        I understand — continue
      </button>
    </div>
  );
}
