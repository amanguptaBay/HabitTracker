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

export interface RoutinesState {
  routines: Routine[];
  goals: Goal[];
  entries: Entry[];
}
