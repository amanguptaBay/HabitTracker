export interface Goal {
  id: string;
  routineId: string;
  name: string;
  description?: string;
  successCriteria?: string;
  required: boolean;
}

export interface Routine {
  id: string;
  name: string;
  order: number;
  goalIds: string[];
}

export interface Entry {
  id: string;
  goalId: string;
  routineId: string;
  date: string; // YYYY-MM-DD
  completed: boolean | null; // null = no response, true = done, false = intentionally failed
  notes?: string;
}

export interface TimingRun {
  startTime: string;   // ISO 8601
  endTime: string;     // ISO 8601
  durationMs: number;
}

/**
 * One document per (targetId × date).
 * Path: users/{uid}/dates/{date}/timingSegments/{targetId}
 * totalMs is the accumulated duration across all runs for that target on that date.
 */
export interface TimingSegment {
  targetId: string;
  targetType: 'goal' | 'routine';
  date: string;        // YYYY-MM-DD (denormalised for convenience)
  totalMs: number;
  segments: TimingRun[];
}

export interface ActiveTimer {
  targetId: string;
  targetType: 'goal' | 'routine';
  startedAt: string;         // ISO 8601 — when the current run started
}

export interface UserSettings {
  /** IANA timezone string. Day rolls over at midnight in this timezone. */
  timezone: string;
}

// Auto-detect device timezone, fall back to UTC
export const DEFAULT_SETTINGS: UserSettings = {
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
};

export interface RoutinesState {
  routines: Routine[];
  goals: Goal[];
  entries: Entry[];
  activeTimers: ActiveTimer[];
}
