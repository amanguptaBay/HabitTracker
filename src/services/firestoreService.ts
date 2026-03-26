/**
 * Firestore service layer.
 *
 * Schema (all nested under /users/{uid}):
 *   routines/{routineId}
 *   goals/{goalId}
 *   entries/{entryId}
 *   timingSegments/{segmentId}
 *   activeTimers/{targetId}   ← document ID IS the targetId (one per target)
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  query,
  where,
  Unsubscribe,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase';
import { Goal, Routine, Entry, TimingSegment, ActiveTimer, UserSettings, DEFAULT_SETTINGS } from '../types';

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
  const q = query(col(uid, 'timingSegments'), where('date', '==', date));
  return onSnapshot(q, (snap) =>
    cb(snap.docs.map((d) => ({ ...(d.data() as TimingSegment), id: d.id })))
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

export const saveTimingSegment = (uid: string, segment: TimingSegment) =>
  setDoc(ref(uid, 'timingSegments', segment.id), strip(segment));

export const mergeTimingSegments = async (
  uid: string,
  keep: TimingSegment,   // merged result
  drop: string           // id of segment to delete
) => {
  const batch = writeBatch(db);
  batch.set(ref(uid, 'timingSegments', keep.id), strip(keep));
  batch.delete(ref(uid, 'timingSegments', drop));
  await batch.commit();
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
