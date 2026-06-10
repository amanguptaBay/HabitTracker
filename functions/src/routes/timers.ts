import { Router } from 'express';
import * as admin from 'firebase-admin';
import { AuthRequest } from '../auth';
import { splitByLogicalDay } from '../date';

const router = Router();

/** GET /timers — list all currently active timers */
router.get('/', async (req, res) => {
  const { uid } = req as AuthRequest;
  const snap = await admin.firestore().collection(`users/${uid}/activeTimers`).get();
  res.json(snap.docs.map(d => d.data()));
});

/**
 * POST /timers/:targetId
 * Body: { "targetType": "goal" | "routine" }
 * Returns 409 if a timer is already running for this target.
 */
router.post('/:targetId', async (req, res) => {
  const { uid }      = req as unknown as AuthRequest;
  const { targetId } = req.params;
  const { targetType } = req.body as { targetType: unknown };

  if (targetType !== 'goal' && targetType !== 'routine') {
    res.status(400).json({ error: '"targetType" must be "goal" or "routine"' });
    return;
  }

  const timerRef = admin.firestore().doc(`users/${uid}/activeTimers/${targetId}`);
  const existing = await timerRef.get();
  if (existing.exists) {
    res.status(409).json({ error: 'Timer already running for this target', timer: existing.data() });
    return;
  }

  const timer = { targetId, targetType, startedAt: new Date().toISOString() };
  await timerRef.set(timer);
  res.status(201).json(timer);
});

/**
 * DELETE /timers/:targetId
 * Stops the timer, writes timing segments (handles midnight splits), returns the result.
 */
router.delete('/:targetId', async (req, res) => {
  const { uid }      = req as unknown as AuthRequest;
  const { targetId } = req.params;

  const timerRef = admin.firestore().doc(`users/${uid}/activeTimers/${targetId}`);
  const timerSnap = await timerRef.get();
  if (!timerSnap.exists) {
    res.status(404).json({ error: 'No active timer for this target' });
    return;
  }

  const timer = timerSnap.data() as { targetId: string; targetType: string; startedAt: string };
  const endTime = new Date().toISOString();

  // Read user's timezone so midnight-split is correct
  const settingsSnap = await admin.firestore().doc(`users/${uid}/settings/preferences`).get();
  const timezone = settingsSnap.exists ? (settingsSnap.data()!.timezone as string) ?? 'UTC' : 'UTC';

  // Delete active timer first so the mobile app stops showing it immediately
  await timerRef.delete();

  // Split the run across logical day boundaries and accumulate into TimingSegments
  const chunks = splitByLogicalDay(timer.startedAt, endTime, timezone);
  await Promise.all(chunks.map(chunk => {
    const segRef = admin.firestore()
      .doc(`users/${uid}/dates/${chunk.date}/timingSegments/${targetId}`);
    return segRef.set({
      targetId,
      targetType: timer.targetType,
      date: chunk.date,
      totalMs:  admin.firestore.FieldValue.increment(chunk.durationMs),
      segments: admin.firestore.FieldValue.arrayUnion({
        startTime:  chunk.startTime,
        endTime:    chunk.endTime,
        durationMs: chunk.durationMs,
      }),
    }, { merge: true });
  }));

  res.json({
    stopped:   true,
    targetId,
    startedAt: timer.startedAt,
    endTime,
    segments:  chunks.map(c => ({ date: c.date, durationMs: c.durationMs })),
  });
});

export default router;
