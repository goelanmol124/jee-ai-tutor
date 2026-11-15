import { describe, expect, it } from 'vitest';
import { deriveActiveTime } from './activeTime';
import type { TelemetryEvent } from './types';

const base = {
  studentId: 'stu1',
  sessionId: 'sess1',
  eventVersion: 'foreground_heartbeat_v1' as const,
};

function hb(
  id: string,
  iso: string,
  opts?: Partial<Pick<TelemetryEvent, 'visible' | 'context'>>,
): TelemetryEvent {
  return {
    ...base,
    eventId: id,
    type: 'heartbeat',
    clientAt: iso,
    serverReceivedAt: iso,
    visible: opts?.visible ?? true,
    context: opts?.context ?? 'product',
  };
}

describe('deriveActiveTime', () => {
  it('accrues 15-second heartbeat intervals under the primary cap', () => {
    const t0 = Date.parse('2026-07-18T10:00:00.000Z');
    const events: TelemetryEvent[] = [];
    for (let i = 0; i < 5; i++) {
      events.push(hb(`h${i}`, new Date(t0 + i * 15_000).toISOString()));
    }
    const result = deriveActiveTime({ events });
    // 4 intervals × 15s = 60s
    expect(result.totals.activeMsPrimary).toBe(60_000);
    expect(result.totals.activeMsCap2Min).toBe(60_000);
    expect(result.totals.activeMsCap10Min).toBe(60_000);
    expect(result.telemetryStatus).toBe('complete');
  });

  it('caps long gaps at 5 minutes primary and exposes 2/10-minute sensitivity', () => {
    const events = [
      hb('h0', '2026-07-18T10:00:00.000Z'),
      hb('h1', '2026-07-18T10:12:00.000Z'), // 12-minute gap
    ];
    const result = deriveActiveTime({ events });
    expect(result.totals.activeMsPrimary).toBe(5 * 60_000);
    expect(result.totals.activeMsCap2Min).toBe(2 * 60_000);
    expect(result.totals.activeMsCap10Min).toBe(10 * 60_000);
    expect(result.caps).toEqual({
      primaryMinutes: 5,
      sensitivityMinutes: [2, 10],
    });
  });

  it('stops accrual after more than 30 seconds hidden', () => {
    const events: TelemetryEvent[] = [
      hb('h0', '2026-07-18T10:00:00.000Z'),
      {
        ...base,
        eventId: 'blur1',
        type: 'blur',
        clientAt: '2026-07-18T10:00:05.000Z',
        serverReceivedAt: '2026-07-18T10:00:05.000Z',
        visible: false,
        context: 'product',
      },
      hb('h_hidden', '2026-07-18T10:00:40.000Z', { visible: false }),
      {
        ...base,
        eventId: 'focus1',
        type: 'focus',
        clientAt: '2026-07-18T10:01:00.000Z',
        serverReceivedAt: '2026-07-18T10:01:00.000Z',
        visible: true,
        context: 'product',
      },
      hb('h1', '2026-07-18T10:01:15.000Z'),
      hb('h2', '2026-07-18T10:01:30.000Z'),
    ];
    const result = deriveActiveTime({ events });
    // After >30s hidden, chain resets; only h1→h2 (15s) accrues.
    expect(result.totals.activeMsPrimary).toBe(15_000);
  });

  it('excludes holdout and onboarding contexts from active time', () => {
    const events = [
      hb('h0', '2026-07-18T10:00:00.000Z'),
      hb('h1', '2026-07-18T10:00:15.000Z', { context: 'holdout_test' }),
      hb('h2', '2026-07-18T10:00:30.000Z', { context: 'onboarding' }),
      hb('h3', '2026-07-18T10:00:45.000Z'),
      hb('h4', '2026-07-18T10:01:00.000Z'),
    ];
    const result = deriveActiveTime({ events });
    // Chain broken by excluded events; only h3→h4 remains.
    expect(result.totals.activeMsPrimary).toBe(15_000);
    expect(result.sessions[0]!.excludedEventCount).toBe(2);
  });

  it('never treats missing telemetry as zero use', () => {
    const result = deriveActiveTime({ events: [] });
    expect(result.telemetryStatus).toBe('missing');
    expect(result.warnings.some((w) => w.includes('not treated as zero'))).toBe(
      true,
    );
  });
});
