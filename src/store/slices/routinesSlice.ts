import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RoutinesState, Goal, Routine } from '../../types';

const today = new Date().toISOString().split('T')[0];

const initialState: RoutinesState = {
  routines: [
    { id: 'routine-morning', name: 'Morning', order: 0, goalIds: ['goal-morning-brush'] },
    { id: 'routine-night', name: 'Night', order: 1, goalIds: ['goal-night-brush', 'goal-night-meditation', 'goal-night-no-screens'] },
  ],
  goals: [
    { id: 'goal-morning-brush', routineId: 'routine-morning', name: 'Brush Teeth', successCriteria: 'Brushed teeth', required: true, timeTracked: false },
    { id: 'goal-night-brush', routineId: 'routine-night', name: 'Brush Teeth', successCriteria: 'Brushed teeth', required: true, timeTracked: false },
    { id: 'goal-night-meditation', routineId: 'routine-night', name: 'Meditation', successCriteria: 'Completed meditation session', required: true, timeTracked: true },
    { id: 'goal-night-no-screens', routineId: 'routine-night', name: '90 Min No Screens', successCriteria: '90 minutes without screens before bed', required: false, timeTracked: false },
  ],
  entries: [
    { id: `entry-morning-brush-${today}`, goalId: 'goal-morning-brush', routineId: 'routine-morning', date: today, completed: null, timeSpent: 0 },
    { id: `entry-night-brush-${today}`, goalId: 'goal-night-brush', routineId: 'routine-night', date: today, completed: null, timeSpent: 0 },
    { id: `entry-night-meditation-${today}`, goalId: 'goal-night-meditation', routineId: 'routine-night', date: today, completed: null, timeSpent: 0 },
    { id: `entry-night-no-screens-${today}`, goalId: 'goal-night-no-screens', routineId: 'routine-night', date: today, completed: null, timeSpent: 0 },
  ],
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const routinesSlice = createSlice({
  name: 'routines',
  initialState,
  reducers: {
    // ── Entry tracking ──────────────────────────────────────────────
    setGoalStatus(state, action: PayloadAction<{ goalId: string; date: string; status: boolean | null }>) {
      const { goalId, date, status } = action.payload;
      const entry = state.entries.find((e) => e.goalId === goalId && e.date === date);
      if (entry) entry.completed = status;
    },

    // ── Routine CRUD ────────────────────────────────────────────────
    addRoutine(state, action: PayloadAction<{ name: string }>) {
      const id = `routine-${uid()}`;
      const maxOrder = state.routines.reduce((m, r) => Math.max(m, r.order), -1);
      state.routines.push({ id, name: action.payload.name, order: maxOrder + 1, goalIds: [] });
    },

    updateRoutine(state, action: PayloadAction<{ id: string; name: string }>) {
      const routine = state.routines.find((r) => r.id === action.payload.id);
      if (routine) routine.name = action.payload.name;
    },

    deleteRoutine(state, action: PayloadAction<string>) {
      const routine = state.routines.find((r) => r.id === action.payload);
      if (!routine) return;
      // Remove all goals + their entries
      routine.goalIds.forEach((goalId) => {
        state.goals = state.goals.filter((g) => g.id !== goalId);
        state.entries = state.entries.filter((e) => e.goalId !== goalId);
      });
      state.routines = state.routines.filter((r) => r.id !== action.payload);
    },

    reorderRoutines(state, action: PayloadAction<string[]>) {
      // payload: ordered array of routine ids
      action.payload.forEach((id, index) => {
        const routine = state.routines.find((r) => r.id === id);
        if (routine) routine.order = index;
      });
    },

    // ── Goal CRUD ───────────────────────────────────────────────────
    addGoal(state, action: PayloadAction<Omit<Goal, 'id'>>) {
      const id = `goal-${uid()}`;
      const goal: Goal = { ...action.payload, id };
      state.goals.push(goal);
      const routine = state.routines.find((r) => r.id === goal.routineId);
      if (routine) routine.goalIds.push(id);
    },

    updateGoal(state, action: PayloadAction<Goal>) {
      const { id, routineId } = action.payload;
      const idx = state.goals.findIndex((g) => g.id === id);
      if (idx === -1) return;

      const oldRoutineId = state.goals[idx].routineId;
      state.goals[idx] = action.payload;

      // If routine changed, move goalId between routines
      if (oldRoutineId !== routineId) {
        const oldRoutine = state.routines.find((r) => r.id === oldRoutineId);
        const newRoutine = state.routines.find((r) => r.id === routineId);
        if (oldRoutine) oldRoutine.goalIds = oldRoutine.goalIds.filter((gid) => gid !== id);
        if (newRoutine) newRoutine.goalIds.push(id);
        // Update entries to reflect new routineId
        state.entries.filter((e) => e.goalId === id).forEach((e) => { e.routineId = routineId; });
      }
    },

    deleteGoal(state, action: PayloadAction<string>) {
      const goal = state.goals.find((g) => g.id === action.payload);
      if (!goal) return;
      state.goals = state.goals.filter((g) => g.id !== action.payload);
      state.entries = state.entries.filter((e) => e.goalId !== action.payload);
      const routine = state.routines.find((r) => r.id === goal.routineId);
      if (routine) routine.goalIds = routine.goalIds.filter((id) => id !== action.payload);
    },

    reorderGoals(state, action: PayloadAction<{ routineId: string; goalIds: string[] }>) {
      const routine = state.routines.find((r) => r.id === action.payload.routineId);
      if (routine) routine.goalIds = action.payload.goalIds;
    },

    moveGoal(state, action: PayloadAction<{ goalId: string; toRoutineId: string }>) {
      const { goalId, toRoutineId } = action.payload;
      const goal = state.goals.find((g) => g.id === goalId);
      if (!goal || goal.routineId === toRoutineId) return;

      const fromRoutine = state.routines.find((r) => r.id === goal.routineId);
      const toRoutine = state.routines.find((r) => r.id === toRoutineId);
      if (fromRoutine) fromRoutine.goalIds = fromRoutine.goalIds.filter((id) => id !== goalId);
      if (toRoutine) toRoutine.goalIds.push(goalId);
      goal.routineId = toRoutineId;
      state.entries.filter((e) => e.goalId === goalId).forEach((e) => { e.routineId = toRoutineId; });
    },

    // Single atomic action for applying a full drag-reorder result from the flat list.
    // routineOrder: new ordered routine IDs; routineGoals: map of routineId → ordered goalIds
    applyDragResult(
      state,
      action: PayloadAction<{ routineOrder: string[]; routineGoals: Record<string, string[]> }>
    ) {
      const { routineOrder, routineGoals } = action.payload;

      // Re-index routine order
      routineOrder.forEach((id, index) => {
        const r = state.routines.find((r) => r.id === id);
        if (r) r.order = index;
      });

      // Apply new goalIds per routine, and fix any cross-routine moves
      for (const [routineId, goalIds] of Object.entries(routineGoals)) {
        const routine = state.routines.find((r) => r.id === routineId);
        if (routine) routine.goalIds = goalIds;
        goalIds.forEach((goalId) => {
          const goal = state.goals.find((g) => g.id === goalId);
          if (goal && goal.routineId !== routineId) {
            goal.routineId = routineId;
            state.entries
              .filter((e) => e.goalId === goalId)
              .forEach((e) => { e.routineId = routineId; });
          }
        });
      }
    },
  },
});

export const {
  setGoalStatus,
  addRoutine,
  updateRoutine,
  deleteRoutine,
  reorderRoutines,
  addGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
  moveGoal,
  applyDragResult,
} = routinesSlice.actions;

export default routinesSlice.reducer;
