import type {
  ActiveTimeDerivationInput,
  ActiveTimeDerivationResult,
  ActiveTimeSensitivityCaps,
  SessionActiveTime,
  TelemetryEvent,
} from './types';

const EXCLUDED = new Set([
  'consent',
  'onboarding',
  'support',
  'administration',
  'holdout_test',
]);

const DEFAULT_CAPS: ActiveTimeSensitivityCaps = {
  primaryMinutes: 5,
  sensitivityMinutes: [2, 10],
};

function eventTimeMs(event: TelemetryEvent): number {
  const iso = event.serverReceivedAt ?? event.clientAt;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`Invalid telemetry timestamp on ${event.eventId}`);
  }
  return ms;
}

function isExcludedContext(event: TelemetryEvent): boolean {
  return EXCLUDED.has(event.context);
}

function isStopEvent(event: TelemetryEvent): boolean {
  return (
    event.type === 'session_end' ||
    event.type === 'logout' ||
    event.type === 'pause'
  );
}

function isQualifyingHeartbeat(event: TelemetryEvent, hardStopped: boolean): boolean {
  return (
    !hardStopped &&
    event.type === 'heartbeat' &&
    event.context === 'product' &&
    event.visible
  );
}

function accrueSession(
  sessionId: string,
  studentId: string,
  events: TelemetryEvent[],
  primaryMinutes: number,
  sens2: number,
  sens10: number,
  hiddenCutoffSeconds: number,
): SessionActiveTime {
  const sorted = events
    .slice()
    .sort((a, b) => eventTimeMs(a) - eventTimeMs(b) || a.eventId.localeCompare(b.eventId));

  let prevQualifyingTs: number | null = null;
  let hiddenSince: number | null = null;
  let hardStopped = false;
  let activeMsPrimary = 0;
  let activeMsCap2Min = 0;
  let activeMsCap10Min = 0;
  let heartbeatCount = 0;
  let excludedEventCount = 0;
  const flags: string[] = [];

  for (const event of sorted) {
    const ts = eventTimeMs(event);
    if (isExcludedContext(event)) excludedEventCount += 1;
    if (event.type === 'heartbeat') heartbeatCount += 1;

    if (hardStopped) continue;

    if (isStopEvent(event)) {
      hardStopped = true;
      prevQualifyingTs = null;
      continue;
    }

    // Track hidden/blur duration from explicit visibility signals.
    let visiblyForeground = event.visible;
    if (event.type === 'blur') visiblyForeground = false;
    if (event.type === 'focus') visiblyForeground = true;

    if (!visiblyForeground) {
      if (hiddenSince === null) hiddenSince = ts;
      if (ts - hiddenSince > hiddenCutoffSeconds * 1000) {
        // Stop accrual after >30s hidden; do not bridge later heartbeats across the gap.
        prevQualifyingTs = null;
      }
    } else {
      hiddenSince = null;
    }

    const hiddenTooLong =
      hiddenSince !== null && ts - hiddenSince > hiddenCutoffSeconds * 1000;

    if (isExcludedContext(event)) {
      // Excluded contexts never qualify and break the qualifying chain.
      prevQualifyingTs = null;
      continue;
    }

    if (isQualifyingHeartbeat(event, hardStopped || hiddenTooLong)) {
      if (prevQualifyingTs !== null) {
        const delta = ts - prevQualifyingTs;
        if (delta > 0) {
          activeMsPrimary += Math.min(delta, primaryMinutes * 60_000);
          activeMsCap2Min += Math.min(delta, sens2 * 60_000);
          activeMsCap10Min += Math.min(delta, sens10 * 60_000);
        }
      }
      prevQualifyingTs = ts;
    }
  }

  if (heartbeatCount === 0) flags.push('no_heartbeats');
  if (excludedEventCount === sorted.length && sorted.length > 0) {
    flags.push('session_fully_excluded_context');
  }

  return {
    sessionId,
    studentId,
    activeMsPrimary,
    activeMsCap2Min,
    activeMsCap10Min,
    heartbeatCount,
    excludedEventCount,
    flags,
  };
}

/**
 * Foreground heartbeat active-time derivation.
 *
 * Decision-memo rules:
 * - visible foreground heartbeat every 15 seconds
 * - 5-minute interval cap (primary); 2- and 10-minute sensitivity outputs
 * - stop after hidden/blurred for more than 30 seconds
 * - exclude consent, onboarding, support, administration, holdout tests
 * - never treat missing telemetry as zero use
 */
export function deriveActiveTime(
  input: ActiveTimeDerivationInput,
): ActiveTimeDerivationResult {
  const primaryMinutes = input.caps?.primaryMinutes ?? DEFAULT_CAPS.primaryMinutes;
  const sensitivityMinutes =
    input.caps?.sensitivityMinutes ?? DEFAULT_CAPS.sensitivityMinutes;
  const heartbeatIntervalSeconds = input.caps?.heartbeatIntervalSeconds ?? 15;
  const hiddenCutoffSeconds = input.caps?.hiddenCutoffSeconds ?? 30;
  const [sens2, sens10] = sensitivityMinutes;

  const warnings: string[] = [];

  if (input.events.length === 0) {
    return {
      algorithmVersion: 'foreground_heartbeat_v1',
      heartbeatIntervalSeconds: 15,
      hiddenCutoffSeconds: 30,
      caps: {
        primaryMinutes: 5,
        sensitivityMinutes: [2, 10],
      },
      sessions: [],
      totals: {
        activeMsPrimary: 0,
        activeMsCap2Min: 0,
        activeMsCap10Min: 0,
        activeHoursPrimary: 0,
        activeHoursCap2Min: 0,
        activeHoursCap10Min: 0,
      },
      telemetryStatus: 'missing',
      warnings: [
        'No telemetry events; active time is undefined — not treated as zero use',
      ],
    };
  }

  const bySession = new Map<string, TelemetryEvent[]>();
  for (const event of input.events) {
    const list = bySession.get(event.sessionId) ?? [];
    list.push(event);
    bySession.set(event.sessionId, list);
  }

  const sessions: SessionActiveTime[] = [];
  for (const [sessionId, events] of [...bySession.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    sessions.push(
      accrueSession(
        sessionId,
        events[0]!.studentId,
        events,
        primaryMinutes,
        sens2,
        sens10,
        hiddenCutoffSeconds,
      ),
    );
  }

  const activeMsPrimary = sessions.reduce((s, x) => s + x.activeMsPrimary, 0);
  const activeMsCap2Min = sessions.reduce((s, x) => s + x.activeMsCap2Min, 0);
  const activeMsCap10Min = sessions.reduce((s, x) => s + x.activeMsCap10Min, 0);

  const productHeartbeats = input.events.filter(
    (e) => e.type === 'heartbeat' && e.context === 'product',
  );
  let telemetryStatus: ActiveTimeDerivationResult['telemetryStatus'] = 'complete';
  if (productHeartbeats.length === 0) {
    telemetryStatus = 'incomplete';
    warnings.push(
      'No product heartbeats observed; do not interpret totals as confirmed zero use',
    );
  }

  const visibleBeats = productHeartbeats
    .filter((e) => e.visible)
    .slice()
    .sort((a, b) => eventTimeMs(a) - eventTimeMs(b));
  for (let i = 1; i < visibleBeats.length; i++) {
    const gap = eventTimeMs(visibleBeats[i]!) - eventTimeMs(visibleBeats[i - 1]!);
    if (gap > heartbeatIntervalSeconds * 1000 * 3) {
      telemetryStatus = 'incomplete';
      warnings.push('Heartbeat coverage gap exceeds 3× expected interval');
      break;
    }
  }

  return {
    algorithmVersion: 'foreground_heartbeat_v1',
    heartbeatIntervalSeconds: 15,
    hiddenCutoffSeconds: 30,
    caps: {
      primaryMinutes: 5,
      sensitivityMinutes: [2, 10],
    },
    sessions,
    totals: {
      activeMsPrimary,
      activeMsCap2Min,
      activeMsCap10Min,
      activeHoursPrimary: activeMsPrimary / 3_600_000,
      activeHoursCap2Min: activeMsCap2Min / 3_600_000,
      activeHoursCap10Min: activeMsCap10Min / 3_600_000,
    },
    telemetryStatus,
    warnings,
  };
}
