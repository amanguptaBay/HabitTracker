/**
 * Firestore service layer.
 *
 * Schema (all nested under /users/{uid}):
 *   routines/{routineId}
 *   goals/{goalId}
 *   entries/{entryId}
 *   dates/{date}/timingSegments/{targetId}  ← one doc per target per day; accumulates runs
 *   activeTimers/{targetId}                 ← document ID IS the targetId (one per target)
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  increment,
  query,
  where,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Goal, Routine, Entry, TimingSegment, TimingRun, ActiveTimer, UserSettings, DEFAULT_SETTINGS } from '../types';

// ─── Collection helpers ──────────────────────────────────────────────────────

const col = (uid: string, name: string) =>
  collection(db, 'users', uid, name);

const ref = (uid: string, name: string, id: string) =>
  doc(db, 'users', uid, name, id);

// ─── Real-time listeners ─────────────────────────────────────────────────────

export function listenRoutines(uid: string, cb: (data: Routine[]) => void): Unsubscribe {
  return onSnapshot(col(uid, 'routines'), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Routine), id: d.id })))
  );
}

export function listenGoals(uid: string, cb: (data: Goal[]) => void): Unsubscribe {
  return onSnapshot(col(uid, 'goals'), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Goal), id: d.id })))
  );
}

export function listenEntries(
  uid: string,
  date: string,
  cb: (data: Entry[]) => void
): Unsubscribe {
  const q = query(col(uid, 'entries'), where('date', '==', date));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as Entry), id: d.id })))
  );
}

export function listenTimingSegments(
  uid: string,
  date: string,
  cb: (data: TimingSegment[]) => void
): Unsubscribe {
  // Path: users/{uid}/dates/{date}/timingSegments — one doc per targetId
  const segCol = collection(db, 'users', uid, 'dates', date, 'timingSegments');
  return onSnapshot(segCol, (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as TimingSegment), targetId: d.id })))
  );
}

// ─── Active timers ───────────────────────────────────────────────────────────

/** Real-time listener — fires immediately with current timers, then on every change. */
export function listenActiveTimers(uid: string, cb: (data: ActiveTimer[]) => void): Unsubscribe {
  return onSnapshot(col(uid, 'activeTimers'), (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as ActiveTimer) })))
  );
}

/** Start a timer: write a document keyed by targetId so there's exactly one per target. */
export const startActiveTimer = (uid: string, timer: ActiveTimer) =>
  setDoc(ref(uid, 'activeTimers', timer.targetId), strip(timer));

/** Stop a timer: remove the document. Caller is responsible for writing the segment. */
export const stopActiveTimer = (uid: string, targetId: string) =>
  deleteDoc(ref(uid, 'activeTimers', targetId));

// ─── Routines ────────────────────────────────────────────────────────────────

export const saveRoutine = (uid: string, routine: Routine) =>
  setDoc(ref(uid, 'routines', routine.id), strip(routine));

export const removeRoutine = async (uid: string, routine: Routine, goals: Goal[]) => {
  const batch = writeBatch(db);
  // Delete all goals that belong to this routine
  routine.goalIds.forEach((goalId) => {
    batch.delete(ref(uid, 'goals', goalId));
  });
  batch.delete(ref(uid, 'routines', routine.id));
  await batch.commit();
};

export const reorderRoutines = async (uid: string, routines: Routine[]) => {
  const batch = writeBatch(db);
  routines.forEach((r) => batch.update(ref(uid, 'routines', r.id), { order: r.order }));
  await batch.commit();
};

// ─── Goals ───────────────────────────────────────────────────────────────────

export const saveGoal = (uid: string, goal: Goal) =>
  setDoc(ref(uid, 'goals', goal.id), strip(goal));

export const removeGoal = (uid: string, goalId: string) =>
  deleteDoc(ref(uid, 'goals', goalId));

export const updateGoalOrder = async (uid: string, routineId: string, goalIds: string[]) =>
  updateDoc(ref(uid, 'routines', routineId), { goalIds });

// ─── Entries ─────────────────────────────────────────────────────────────────

export const upsertEntry = (uid: string, entry: Entry) =>
  setDoc(ref(uid, 'entries', entry.id), strip(entry), { merge: true });

// ─── Timing segments ─────────────────────────────────────────────────────────

/**
 * One-time fetch of every timing-segment doc for a given calendar month.
 * Fans out one getDocs per date in parallel — no index needed.
 */
export async function fetchMonthTimingSegments(
  uid: string,
  year: number,
  month: number, // 1-based
): Promise<TimingSegment[]> {
  const daysInMonth = new Date(year, month, 0).getDate(); // month is 1-based, day 0 = last day
  const pad = (n: number) => String(n).padStart(2, '0');
  const dates = Array.from({ length: daysInMonth }, (_, i) =>
    `${year}-${pad(month)}-${pad(i + 1)}`
  );
  const snaps = await Promise.all(
    dates.map((date) =>
      getDocs(collection(db, 'users', uid, 'dates', date, 'timingSegments'))
    )
  );
  return snaps.flatMap((snap) =>
    snap.docs.map((d) => ({ ...(d.data() as TimingSegment), targetId: d.id }))
  );
}

/**
 * Upsert a timing run into the per-(target × date) document.
 * Uses increment + arrayUnion so concurrent writes accumulate safely.
 * Path: users/{uid}/dates/{date}/timingSegments/{targetId}
 */
export const upsertTimingSegment = (
  uid: string,
  date: string,
  targetId: string,
  targetType: 'goal' | 'routine',
  run: TimingRun,
) => {
  const segRef = doc(db, 'users', uid, 'dates', date, 'timingSegments', targetId);
  // Store only the 3 fields that define a run — date is already in the doc path.
  // Keeping date OUT of the run object means arrayRemove can match exactly.
  const runPayload: TimingRun = {
    startTime:  run.startTime,
    endTime:    run.endTime,
    durationMs: run.durationMs,
  };
  return setDoc(segRef, {
    targetId,
    targetType,
    date,
    totalMs:  increment(runPayload.durationMs),
    segments: arrayUnion(runPayload),
  }, { merge: true });
};

/**
 * Remove one specific run from a timing segment document and decrement totalMs.
 * Uses arrayRemove — Firestore matches the exact object by value equality.
 */
export const deleteTimingRun = (
  uid: string,
  date: string,
  targetId: string,
  run: TimingRun,
) => {
  const segRef = doc(db, 'users', uid, 'dates', date, 'timingSegments', targetId);
  const path = `users/${uid}/dates/${date}/timingSegments/${targetId}`;
  console.log('[firestoreService] deleteTimingRun path:', path);
  console.log('[firestoreService] arrayRemove payload:', JSON.stringify(run));
  return updateDoc(segRef, {
    segments: arrayRemove(run),
    totalMs:  increment(-run.durationMs),
  });
};

// ─── User settings ───────────────────────────────────────────────────────────

const settingsRef = (uid: string) =>
  doc(db, 'users', uid, 'settings', 'preferences');

export function listenSettings(uid: string, cb: (s: UserSettings) => void): Unsubscribe {
  return onSnapshot(settingsRef(uid), (snap) => {
    cb(snap.exists() ? (snap.data() as UserSettings) : DEFAULT_SETTINGS);
  });
}

export const saveSettings = (uid: string, settings: UserSettings) =>
  setDoc(settingsRef(uid), settings);

// ─── Utilities ───────────────────────────────────────────────────────────────

/** Strip undefined fields — Firestore rejects them. */
function strip<T extends DocumentData>(obj: T): DocumentData {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  );
}
