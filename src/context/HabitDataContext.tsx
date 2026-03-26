/**
 * HabitDataContext
 *
 * Single source of truth for all habit data.
 * - Auth   : anonymous sign-in, exposes uid
 * - Remote : Firestore real-time listeners populate local state
 * - Local  : activeTimers are ephemeral (never persisted)
 * - Writes : all mutations go straight to Firestore; listeners reflect changes back
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Goal, Routine, Entry, TimingSegment, ActiveTimer } from '../types';
import { ensureSignedIn, subscribeToAuth } from '../services/auth';
import {
  listenRoutines,
  listenGoals,
  listenEntries,
  listenTimingSegments,
  saveRoutine,
  removeRoutine,
  reorderRoutines,
  saveGoal,
  removeGoal,
  updateGoalOrder,
  upsertEntry,
  saveTimingSegment,
  mergeTimingSegments,
} from '../services/firestoreService';

// ─── Types ───────────────────────────────────────────────────────────────────

interface HabitDataCtx {
  // Meta
  uid: string | null;
  loading: boolean;

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

  // Timer mutations
  startTimer:     (targetId: string, targetType: 'goal' | 'routine') => void;
  stopTimer:      (targetId: string) => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const Ctx = createContext<HabitDataCtx | null>(null);

export function useHabitData(): HabitDataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useHabitData must be used inside <HabitDataProvider>');
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const today = () => new Date().toISOString().split('T')[0];
const nowIso = () => new Date().toISOString();

function uid7() {
  return Math.random().toString(36).slice(2, 9);
}

const MERGE_GAP_MS = 60_000; // merge segments with < 1 min gap

// ─── Provider ────────────────────────────────────────────────────────────────

export function HabitDataProvider({ children }: { children: React.ReactNode }) {
  const [uid, setUid]                       = useState<string | null>(null);
  const [loading, setLoading]               = useState(true);
  const [routines, setRoutines]             = useState<Routine[]>([]);
  const [goals, setGoals]                   = useState<Goal[]>([]);
  const [entries, setEntries]               = useState<Entry[]>([]);
  const [timingSegments, setTimingSegments] = useState<TimingSegment[]>([]);
  const [activeTimers, setActiveTimers]     = useState<ActiveTimer[]>([]);

  // Keep a ref to timingSegments so stopTimer closures don't go stale
  const segmentsRef = useRef<TimingSegment[]>([]);
  segmentsRef.current = timingSegments;

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToAuth(async (user) => {
      if (user) {
        setUid(user.uid);
      } else {
        // No user yet — sign in anonymously
        try {
          const id = await ensureSignedIn();
          setUid(id);
        } catch (e) {
          console.error('Anonymous sign-in failed', e);
        }
      }
    });
    return unsub;
  }, []);

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;

    const date = today();
    const unsubs = [
      listenRoutines(uid, (data) => {
        setRoutines(data.slice().sort((a, b) => a.order - b.order));
        setLoading(false);
      }),
      listenGoals(uid, setGoals),
      listenEntries(uid, date, setEntries),
      listenTimingSegments(uid, date, setTimingSegments),
    ];

    return () => unsubs.forEach((u) => u());
  }, [uid]);

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

    // Seed a today entry so it's immediately interactive
    const entryId = `entry-${goal.id}-${today()}`;
    await upsertEntry(uid, {
      id: entryId,
      goalId: goal.id,
      routineId: goal.routineId,
      date: today(),
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

  // ── Timer mutations (local only) ──────────────────────────────────────────

  const startTimer = useCallback((targetId: string, targetType: 'goal' | 'routine') => {
    setActiveTimers((prev) => {
      // Only one timer per target
      const filtered = prev.filter((t) => t.targetId !== targetId);
      return [...filtered, { targetId, targetType, startedAt: nowIso() }];
    });
  }, []);

  const stopTimer = useCallback(async (targetId: string) => {
    if (!uid) return;

    const timer = activeTimers.find((t) => t.targetId === targetId);
    if (!timer) return;

    const endTime    = nowIso();
    const startTime  = timer.startedAt;
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    const date       = today();

    // Remove from active timers immediately
    setActiveTimers((prev) => prev.filter((t) => t.targetId !== targetId));

    // Check if we can merge with the last segment for this target today
    const existing = segmentsRef.current
      .filter((s) => s.targetId === targetId && s.date === date)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

    const last = existing[0];
    const gapMs = last
      ? new Date(startTime).getTime() - new Date(last.endTime).getTime()
      : Infinity;

    if (last && gapMs < MERGE_GAP_MS) {
      // Merge: extend the last segment
      const merged: TimingSegment = {
        ...last,
        endTime,
        durationMs: last.durationMs + gapMs + durationMs,
      };
      await mergeTimingSegments(uid, merged, ''); // empty drop id = just update keep
    } else {
      // New segment
      const segment: TimingSegment = {
        id: `seg-${uid7()}`,
        targetId,
        targetType: timer.targetType,
        date,
        startTime,
        endTime,
        durationMs,
      };
      await saveTimingSegment(uid, segment);
    }
  }, [uid, activeTimers]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Ctx.Provider value={{
      uid, loading,
      routines, goals, entries, timingSegments, activeTimers,
      addRoutine, updateRoutine, deleteRoutine, reorderAll,
      addGoal, updateGoal, deleteGoal, moveGoal,
      setGoalStatus,
      startTimer, stopTimer,
    }}>
      {children}
    </Ctx.Provider>
  );
}
