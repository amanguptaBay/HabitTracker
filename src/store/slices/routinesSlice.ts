import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RoutinesState, Entry } from '../../types';

const today = new Date().toISOString().split('T')[0];

const initialState: RoutinesState = {
  routines: [
    {
      id: 'routine-morning',
      name: 'Morning',
      order: 0,
      goalIds: ['goal-morning-brush'],
    },
    {
      id: 'routine-night',
      name: 'Night',
      order: 1,
      goalIds: ['goal-night-brush', 'goal-night-meditation', 'goal-night-no-screens'],
    },
  ],
  goals: [
    {
      id: 'goal-morning-brush',
      routineId: 'routine-morning',
      name: 'Brush Teeth',
      successCriteria: 'Brushed teeth',
      required: true,
      timeTracked: false,
    },
    {
      id: 'goal-night-brush',
      routineId: 'routine-night',
      name: 'Brush Teeth',
      successCriteria: 'Brushed teeth',
      required: true,
      timeTracked: false,
    },
    {
      id: 'goal-night-meditation',
      routineId: 'routine-night',
      name: 'Meditation',
      successCriteria: 'Completed meditation session',
      required: true,
      timeTracked: true,
    },
    {
      id: 'goal-night-no-screens',
      routineId: 'routine-night',
      name: '90 Min No Screens',
      successCriteria: '90 minutes without screens before bed',
      required: false,
      timeTracked: false,
    },
  ],
  entries: [
    {
      id: `entry-morning-brush-${today}`,
      goalId: 'goal-morning-brush',
      routineId: 'routine-morning',
      date: today,
      completed: null,
      timeSpent: 0,
    },
    {
      id: `entry-night-brush-${today}`,
      goalId: 'goal-night-brush',
      routineId: 'routine-night',
      date: today,
      completed: null,
      timeSpent: 0,
    },
    {
      id: `entry-night-meditation-${today}`,
      goalId: 'goal-night-meditation',
      routineId: 'routine-night',
      date: today,
      completed: null,
      timeSpent: 0,
    },
    {
      id: `entry-night-no-screens-${today}`,
      goalId: 'goal-night-no-screens',
      routineId: 'routine-night',
      date: today,
      completed: null,
      timeSpent: 0,
    },
  ],
};

const routinesSlice = createSlice({
  name: 'routines',
  initialState,
  reducers: {
    setGoalStatus(
      state,
      action: PayloadAction<{ goalId: string; date: string; status: boolean | null }>
    ) {
      const { goalId, date, status } = action.payload;
      const entry = state.entries.find(
        (e) => e.goalId === goalId && e.date === date
      );
      if (entry) {
        entry.completed = status;
      }
    },
  },
});

export const { setGoalStatus } = routinesSlice.actions;
export default routinesSlice.reducer;
