/**
 * HabitDataContext
 *
 * Single source of truth for all habit data.
 * - Auth   : Firebase auth state drives uid
 * - Remote : Firestore real-time listeners (onSnapshot) populate all state
 * - Writes : all mutations write to Firestore; listeners reflect changes back
 * - Timers : activeTimers persisted in Firestore — syncs across devices/tabs
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Goal, Routine, Entry, TimingSegment, ActiveTimer, UserSettings, DEFAULT_SETTINGS } from '../types'; // TimingSegment used in state type
import { subscribeToAuth } from '../services/auth';
import {
  listenRoutines,
  listenGoals,
  listenEntries,
  listenTimingSegments,
  listenActiveTimers,
  listenSettings,
  saveSettings,
  startActiveTimer,
  stopActiveTimer,
  deleteTimingRun,
  updateTimingRun,
  saveRoutine,
  removeRoutine,
  reorderRoutines,
  saveGoal,
  removeGoal,
  updateGoalOrder,
  upsertEntry,
  upsertTimingSegment,
} from '../services/firestoreService';
import { getLogicalDate, splitByLogicalDay } from '../utils/date';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HabitDataCtx {
  // Meta
  uid: string | null;
  loading: boolean;
  settings: UserSettings;
  logicalToday: string;
  viewingDate: string;
  setViewingDate: (date: string) => void;

  // Data
  routines: Routine[];
  goals: Goal[];
  entries: Entry[];
  timingSegments: TimingSegment[];
  activeTimers: ActiveTimer[];

  // Routine mutations
  addRoutine:     (routine: Routine) => Promise<void>;
  updateRoutine:  (routine: Routine) => Promise<void>;
  deleteRoutine:  (routine: Routine) => Promise<void>;
  reorderAll:     (routines: Routine[]) => Promise<void>;

  // Goal mutations
  addGoal:        (goal: Goal) => Promise<void>;
  updateGoal:     (goal: Goal) => Promise<void>;
  deleteGoal:     (goalId: string, routineId: string) => Promise<void>;
  moveGoal:       (goalId: string, fromRoutineId: string, toRoutineId: string, newOrder: string[]) => Promise<void>;

  // Entry mutations
  setGoalStatus:  (goalId: string, routineId: string, date: string, status: boolean | null) => Promise<void>;

  // Settings mutations
  updateSettings: (s: Partial<UserSettings>) => Promise<void>;

  // Timer mutations
  startTimer:        (targetId: string, targetType: 'goal' | 'routine') => Promise<void>;
  stopTimer:         (targetId: string) => Promise<void>;
  deleteRun:         (date: string, targetId: string, run: import('../types').TimingRun) => Promise<void>;
  updateRun:         (date: string, targetId: string, oldRun: import('../types').TimingRun, newRun: import('../types').TimingRun) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<HabitDataCtx | null>(null);

export function useHabitData(): HabitDataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHabitData must be used inside <HabitDataProvider>');
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

// ─── Provider ────────────────────────────────────────────────────────────────

export function HabitDataProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid]                       = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [settings, setSettings]             = useState<UserSettings>(DEFAULT_SETTINGS);
  const [routines, setRoutines]             = useState<Routine[]>([]);
  const [goals, setGoals]                   = useState<Goal[]>([]);
  const [entries, setEntries]               = useState<Entry[]>([]);
  const [timingSegments, setTimingSegments] = useState<TimingSegment[]>([]);
  const [activeTimers, setActiveTimers]     = useState<ActiveTimer[]>([]);

  // Keep ref so callbacks always see current settings without stale closures
  const settingsRef = useRef<UserSettings>(DEFAULT_SETTINGS);
  settingsRef.current = settings;

  // Derived: logical date string for today in the user's timezone
  const logicalToday = getLogicalDate(settings.timezone);

  // Which date the home screen is currently browsing (defaults to today)
  const [viewingDate, setViewingDate] = useState<string>(logicalToday);

  // When the logical day rolls over, snap back to the new today
  const prevLogicalToday = useRef(logicalToday);
  useEffect(() => {
    if (prevLogicalToday.current !== logicalToday) {
      prevLogicalToday.current = logicalToday;
      setViewingDate(logicalToday);
    }
  }, [logicalToday]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setUid(user?.uid ?? null);
      if (!user) setLoading(false); // not signed in — nothing to load
    });
    return unsub;
  }, []);

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    // Settings must resolve before we know the logical date, so subscribe first.
    // Entry/segment listeners re-attach when logicalToday changes (see next effect).
    const unsubs = [
      listenSettings(uid, (s) => setSettings(s)),
      listenRoutines(uid, (data) => {
        setRoutines(data.slice().sort((a, b) => a.order - b.order));
        setLoading(false);
      }),
      listenGoals(uid, setGoals),
      listenActiveTimers(uid, setActiveTimers),
    ];

    return () => unsubs.forEach((u) => u());
  }, [uid]);

  // Re-subscribe entries + segments whenever the viewed date changes
  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      listenEntries(uid, viewingDate, setEntries),
      listenTimingSegments(uid, viewingDate, setTimingSegments),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, viewingDate]);

  // ── Routine mutations ─────────────────────────────────────────────────────

  const addRoutine = useCallback(async (routine: Routine) => {
    if (!uid) return;
    await saveRoutine(uid, routine);
  }, [uid]);

  const updateRoutine = useCallback(async (routine: Routine) => {
    if (!uid) return;
    await saveRoutine(uid, routine);
  }, [uid]);

  const deleteRoutine = useCallback(async (routine: Routine) => {
    if (!uid) return;
    await removeRoutine(uid, routine, goals);
  }, [uid, goals]);

  const reorderAll = useCallback(async (updated: Routine[]) => {
    if (!uid) return;
    await reorderRoutines(uid, updated);
  }, [uid]);

  // ── Goal mutations ────────────────────────────────────────────────────────

  const addGoal = useCallback(async (goal: Goal) => {
    if (!uid) return;
    await saveGoal(uid, goal);

    // Append goalId to parent routine's goalIds array
    const routine = routines.find((r) => r.id === goal.routineId);
    if (routine) {
      await updateGoalOrder(uid, routine.id, [...routine.goalIds, goal.id]);
    }

    // Seed an entry for the current logical day so it's immediately interactive
    const date    = getLogicalDate(settingsRef.current.timezone);
    const entryId = `entry-${goal.id}-${date}`;
    await upsertEntry(uid, {
      id: entryId,
      goalId: goal.id,
      routineId: goal.routineId,
      date,
      completed: null,
    });
  }, [uid, routines]);

  const updateGoal = useCallback(async (goal: Goal) => {
    if (!uid) return;
    await saveGoal(uid, goal);
  }, [uid]);

  const deleteGoal = useCallback(async (goalId: string, routineId: string) => {
    if (!uid) return;
    await removeGoal(uid, goalId);
    const routine = routines.find((r) => r.id === routineId);
    if (routine) {
      await updateGoalOrder(
        uid,
        routineId,
        routine.goalIds.filter((id) => id !== goalId)
      );
    }
  }, [uid, routines]);

  const moveGoal = useCallback(async (
    goalId: string,
    fromRoutineId: string,
    toRoutineId: string,
    newGoalIds: string[]
  ) => {
    if (!uid) return;
    // Update the goal's routineId
    const goal = goals.find((g) => g.id === goalId);
    if (goal) await saveGoal(uid, { ...goal, routineId: toRoutineId });

    if (fromRoutineId === toRoutineId) {
      await updateGoalOrder(uid, fromRoutineId, newGoalIds);
    } else {
      const fromRoutine = routines.find((r) => r.id === fromRoutineId);
      const toRoutine   = routines.find((r) => r.id === toRoutineId);
      if (fromRoutine) {
        await updateGoalOrder(uid, fromRoutineId, fromRoutine.goalIds.filter((id) => id !== goalId));
      }
      if (toRoutine) {
        await updateGoalOrder(uid, toRoutineId, newGoalIds);
      }
    }
  }, [uid, goals, routines]);

  // ── Entry mutations ───────────────────────────────────────────────────────

  const setGoalStatus = useCallback(async (
    goalId: string,
    routineId: string,
    date: string,
    status: boolean | null
  ) => {
    if (!uid) return;
    const existing = entries.find((e) => e.goalId === goalId && e.date === date);
    const entry: Entry = existing ?? {
      id: `entry-${goalId}-${date}`,
      goalId,
      routineId,
      date,
      completed: null,
    };
    await upsertEntry(uid, { ...entry, completed: status });
  }, [uid, entries]);

  // ── Settings mutation ─────────────────────────────────────────────────────

  const updateSettings = useCallback(async (partial: Partial<UserSettings>) => {
    if (!uid) return;
    const next = { ...settingsRef.current, ...partial };
    await saveSettings(uid, next);
  }, [uid]);

  // ── Timer mutations — Firestore-backed ───────────────────────────────────

  const startTimer = useCallback(async (targetId: string, targetType: 'goal' | 'routine') => {
    if (!uid) return;
    // Writing to Firestore triggers onSnapshot → setActiveTimers automatically
    await startActiveTimer(uid, { targetId, targetType, startedAt: nowIso() });
  }, [uid]);

  const stopTimer = useCallback(async (targetId: string) => {
    if (!uid) return;

    const timer = activeTimers.find((t) => t.targetId === targetId);
    if (!timer) return;

    const endTime = nowIso();
    const { timezone } = settingsRef.current;

    // Delete from Firestore first — onSnapshot clears it from UI immediately
    await stopActiveTimer(uid, targetId);

    // Split across midnight boundaries (usually just one chunk)
    const chunks = splitByLogicalDay(timer.startedAt, endTime, timezone);
    for (const chunk of chunks) {
      await upsertTimingSegment(uid, chunk.date, targetId, timer.targetType, chunk);
    }
  }, [uid, activeTimers]);

  const deleteRun = useCallback(async (
    date: string,
    targetId: string,
    run: import('../types').TimingRun,
  ) => {
    if (!uid) return;
    await deleteTimingRun(uid, date, targetId, run);
  }, [uid]);

  const updateRun = useCallback(async (
    date: string,
    targetId: string,
    oldRun: import('../types').TimingRun,
    newRun: import('../types').TimingRun,
  ) => {
    if (!uid) return;
    await updateTimingRun(uid, date, targetId, oldRun, newRun);
  }, [uid]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Ctx.Provider value={{
      uid, loading,
      settings, logicalToday, viewingDate, setViewingDate,
      routines, goals, entries, timingSegments, activeTimers,
      addRoutine, updateRoutine, deleteRoutine, reorderAll,
      addGoal, updateGoal, deleteGoal, moveGoal,
      setGoalStatus,
      updateSettings,
      startTimer, stopTimer, deleteRun, updateRun,
    }}>
      {children}
    </Ctx.Provider>
  );
}
