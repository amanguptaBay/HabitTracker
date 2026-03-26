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

export interface TimingSegment {
  id: string;
  targetId: string;          // goalId OR routineId — exclusively one
  targetType: 'goal' | 'routine';
  date: string;              // YYYY-MM-DD
  startTime: string;         // ISO 8601
  endTime: string;           // ISO 8601
  durationMs: number;
}

export interface ActiveTimer {
  targetId: string;
  targetType: 'goal' | 'routine';
  startedAt: string;         // ISO 8601 — when the current run started
}

export interface UserSettings {
  /** Hour (0-23) at which the logical day resets. Default 0 = midnight. */
  dayStartHour: number;
  /** Minute (0-59) offset within that hour. Default 0. */
  dayStartMinute: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  dayStartHour: 0,
  dayStartMinute: 0,
};

export interface RoutinesState {
  routines: Routine[];
  goals: Goal[];
  entries: Entry[];
  timingSegments: TimingSegment[];
  activeTimers: ActiveTimer[];
}
