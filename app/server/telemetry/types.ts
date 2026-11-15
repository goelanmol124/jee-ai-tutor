/** Contexts that never accrue product-active time. */
export type ExcludedActiveTimeContext =
  | 'consent'
  | 'onboarding'
  | 'support'
  | 'administration'
  | 'holdout_test';

export type ActiveTimeContext = 'product' | ExcludedActiveTimeContext;

export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'heartbeat'
  | 'focus'
  | 'blur'
  | 'visibility_change'
  | 'pause'
  | 'logout';

export interface TelemetryEvent {
  eventId: string;
  studentId: string;
  sessionId: string;
  type: TelemetryEventType;
  /** Client event time (ISO). */
  clientAt: string;
  /** Server receipt time (ISO); preferred for ordering when present. */
  serverReceivedAt?: string;
  /** Tab/app visible and foregrounded. */
  visible: boolean;
  context: ActiveTimeContext;
  eventVersion: 'foreground_heartbeat_v1';
}

export interface ActiveTimeSensitivityCaps {
  primaryMinutes: 5;
  sensitivityMinutes: readonly [2, 10];
}

export interface ActiveTimeDerivationInput {
  events: TelemetryEvent[];
  /** Override caps for tests; defaults match decision memo. */
  caps?: Partial<{
    primaryMinutes: number;
    sensitivityMinutes: readonly [number, number];
    heartbeatIntervalSeconds: number;
    hiddenCutoffSeconds: number;
  }>;
}

export interface SessionActiveTime {
  sessionId: string;
  studentId: string;
  /** Milliseconds under primary 5-minute cap. */
  activeMsPrimary: number;
  /** Sensitivity: 2-minute idle cap. */
  activeMsCap2Min: number;
  /** Sensitivity: 10-minute idle cap. */
  activeMsCap10Min: number;
  heartbeatCount: number;
  excludedEventCount: number;
  flags: string[];
}

export interface ActiveTimeDerivationResult {
  algorithmVersion: 'foreground_heartbeat_v1';
  heartbeatIntervalSeconds: 15;
  hiddenCutoffSeconds: 30;
  caps: ActiveTimeSensitivityCaps;
  sessions: SessionActiveTime[];
  totals: {
    activeMsPrimary: number;
    activeMsCap2Min: number;
    activeMsCap10Min: number;
    activeHoursPrimary: number;
    activeHoursCap2Min: number;
    activeHoursCap10Min: number;
  };
  /** Missing telemetry is never coerced to zero use. */
  telemetryStatus: 'complete' | 'incomplete' | 'missing';
  warnings: string[];
}
