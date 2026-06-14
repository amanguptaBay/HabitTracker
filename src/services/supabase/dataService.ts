/**
 * Supabase data service — replaces firestoreService.ts.
 *
 * Key differences from Firestore:
 * - No uid param on any function: RLS uses auth.uid() from the JWT automatically.
 * - Real-time via Postgres CDC channels (refetch on change, same semantics as onSnapshot).
 * - Atomic timing ops via the append_timing_run RPC instead of arrayUnion + increment.
 */

import { supabase } from './client';
import {
  Goal, Routine, Entry, TimingSegment, TimingRun, ActiveTimer, UserSettings, DEFAULT_SETTINGS,
} from '../../types';

// ─── Real-time helper ─────────────────────────────────────────────────────────

function listen<T>(
  channelName: string,
  table: string,
  fetch: () => Promise<T[]>,
  cb: (data: T[]) => void,
  filter?: string,
): () => void {
  fetch().then(cb);

  const config: any = { event: '*', schema: 'public', table };
  if (filter) config.filter = filter;

  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', config, () => fetch().then(cb))
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

// ─── Routines ────────────────────────────────────────────────────────────────

const fetchRoutines = async (): Promise<Routine[]> => {
  const { data } = await supabase
    .from('routines').select('*').order('order');
  return (data ?? []).map(r => ({ ...r, goalIds: r.goal_ids ?? [] }));
};

export const listenRoutines = (cb: (data: Routine[]) => void) =>
  listen('routines-ch', 'routines', fetchRoutines, cb);

export const saveRoutine = async (_uid: string, routine: Routine) => {
  await supabase.from('routines').upsert({
    id: routine.id,
    name: routine.name,
    order: routine.order,
    goal_ids: routine.goalIds,
  });
};

export const removeRoutine = async (_uid: string, routine: Routine) => {
  await supabase.from('goals').delete().in('id', routine.goalIds);
  await supabase.from('routines').delete().eq('id', routine.id);
};

export const reorderRoutines = async (_uid: string, routines: Routine[]) => {
  await supabase.from('routines').upsert(
    routines.map(r => ({ id: r.id, name: r.name, order: r.order, goal_ids: r.goalIds }))
  );
};

// ─── Goals ───────────────────────────────────────────────────────────────────

const fetchGoals = async (): Promise<Goal[]> => {
  const { data } = await supabase.from('goals').select('*');
  return (data ?? []).map(g => ({
    id: g.id, routineId: g.routine_id, name: g.name,
    description: g.description, successCriteria: g.success_criteria, required: g.required,
  }));
};

export const listenGoals = (cb: (data: Goal[]) => void) =>
  listen('goals-ch', 'goals', fetchGoals, cb);

export const saveGoal = async (_uid: string, goal: Goal) => {
  await supabase.from('goals').upsert({
    id: goal.id,
    routine_id: goal.routineId,
    name: goal.name,
    description: goal.description ?? null,
    success_criteria: goal.successCriteria ?? null,
    required: goal.required,
  });
};

export const removeGoal = async (_uid: string, goalId: string) => {
  await supabase.from('goals').delete().eq('id', goalId);
};

export const updateGoalOrder = async (_uid: string, routineId: string, goalIds: string[]) => {
  await supabase.from('routines').update({ goal_ids: goalIds }).eq('id', routineId);
};

// ─── Entries ─────────────────────────────────────────────────────────────────

const fetchEntries = async (date: string): Promise<Entry[]> => {
  const { data } = await supabase
    .from('entries').select('*').eq('date', date);
  return (data ?? []).map(e => ({
    id: e.id, goalId: e.goal_id, routineId: e.routine_id,
    date: e.date, completed: e.completed, notes: e.notes,
  }));
};

export const listenEntries = (
  _uid: string, date: string, cb: (data: Entry[]) => void,
) => listen(`entries-${date}-ch`, 'entries', () => fetchEntries(date), cb);

export const upsertEntry = async (_uid: string, entry: Entry) => {
  await supabase.from('entries').upsert({
    id: entry.id,
    goal_id: entry.goalId,
    routine_id: entry.routineId,
    date: entry.date,
    completed: entry.completed ?? null,
    notes: entry.notes ?? null,
  });
};

// ─── Active timers ────────────────────────────────────────────────────────────

const fetchActiveTimers = async (): Promise<ActiveTimer[]> => {
  const { data } = await supabase.from('active_timers').select('*');
  return (data ?? []).map(t => ({
    targetId: t.target_id, targetType: t.target_type, startedAt: t.started_at,
  }));
};

export const listenActiveTimers = (cb: (data: ActiveTimer[]) => void) =>
  listen('timers-ch', 'active_timers', fetchActiveTimers, cb);

export const startActiveTimer = async (_uid: string, timer: ActiveTimer) => {
  await supabase.from('active_timers').upsert({
    target_id: timer.targetId,
    target_type: timer.targetType,
    started_at: timer.startedAt,
  });
};

export const stopActiveTimer = async (_uid: string, targetId: string) => {
  await supabase.from('active_timers').delete().eq('target_id', targetId);
};

// ─── Timing segments ──────────────────────────────────────────────────────────

const fetchTimingSegments = async (date: string): Promise<TimingSegment[]> => {
  const { data } = await supabase
    .from('timing_segments').select('*').eq('date', date);
  return (data ?? []).map(s => ({
    targetId: s.target_id, targetType: s.target_type,
    date: s.date, totalMs: s.total_ms, segments: s.segments ?? [],
  }));
};

export const listenTimingSegments = (
  _uid: string, date: string, cb: (data: TimingSegment[]) => void,
) => listen(`segments-${date}-ch`, 'timing_segments', () => fetchTimingSegments(date), cb);

export const upsertTimingSegment = async (
  _uid: string,
  date: string,
  targetId: string,
  targetType: 'goal' | 'routine',
  run: { startTime: string; endTime: string; durationMs: number },
) => {
  await supabase.rpc('append_timing_run', {
    p_target_id:   targetId,
    p_target_type: targetType,
    p_date:        date,
    p_start_time:  run.startTime,
    p_end_time:    run.endTime,
    p_duration_ms: run.durationMs,
  });
};

export const deleteTimingRun = async (
  _uid: string, date: string, targetId: string, run: TimingRun,
) => {
  const { data } = await supabase
    .from('timing_segments').select('segments, total_ms')
    .eq('target_id', targetId).eq('date', date).single();
  if (!data) return;

  const filtered = (data.segments as TimingRun[]).filter(
    s => s.startTime !== run.startTime || s.endTime !== run.endTime
  );
  await supabase.from('timing_segments')
    .update({ segments: filtered, total_ms: data.total_ms - run.durationMs })
    .eq('target_id', targetId).eq('date', date);
};

export const updateTimingRun = async (
  _uid: string, date: string, targetId: string, oldRun: TimingRun, newRun: TimingRun,
) => {
  const { data } = await supabase
    .from('timing_segments').select('segments, total_ms')
    .eq('target_id', targetId).eq('date', date).single();
  if (!data) return;

  const segments = (data.segments as TimingRun[]).map(
    s => (s.startTime === oldRun.startTime && s.endTime === oldRun.endTime) ? newRun : s
  );
  const total_ms = data.total_ms - oldRun.durationMs + newRun.durationMs;
  await supabase.from('timing_segments')
    .update({ segments, total_ms })
    .eq('target_id', targetId).eq('date', date);
};

export const fetchMonthTimingSegments = async (
  _uid: string, year: number, month: number,
): Promise<TimingSegment[]> => {
  const from = `${year}-${String(month).padStart(2, '0')}-01`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const to   = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
  const { data } = await supabase
    .from('timing_segments').select('*')
    .gte('date', from).lte('date', to);
  return (data ?? []).map(s => ({
    targetId: s.target_id, targetType: s.target_type,
    date: s.date, totalMs: s.total_ms, segments: s.segments ?? [],
  }));
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const fetchSettings = async (): Promise<UserSettings> => {
  const { data } = await supabase
    .from('user_settings').select('timezone').maybeSingle();
  return data ? { timezone: data.timezone } : DEFAULT_SETTINGS;
};

export const listenSettings = (_uid: string, cb: (s: UserSettings) => void) =>
  listen('settings-ch', 'user_settings', async () => [await fetchSettings()], (arr) => cb(arr[0]));

export const saveSettings = async (_uid: string, settings: UserSettings) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('user_settings').upsert({
    user_id: user.id,
    timezone: settings.timezone,
  });
};
