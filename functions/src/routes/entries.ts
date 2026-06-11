import { Router } from 'express';
import * as admin from 'firebase-admin';
import { AuthRequest } from '../auth';
import { getLogicalDate } from '../date';

const router = Router();

/** Read the user's stored timezone, falling back to UTC. */
async function getUserTimezone(uid: string): Promise<string> {
  const snap = await admin.firestore().doc(`users/${uid}/settings/preferences`).get();
  return snap.exists ? (snap.data()!.timezone as string) ?? 'UTC' : 'UTC';
}

/** Resolve the ?date= query param, defaulting to today in the user's timezone. */
async function resolveDate(uid: string, dateParam?: string): Promise<string> {
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) return dateParam;
  const tz = await getUserTimezone(uid);
  return getLogicalDate(tz);
}

/** GET /entries?date=YYYY-MM-DD */
router.get('/', async (req, res) => {
  const { uid } = req as unknown as AuthRequest;
  const date = await resolveDate(uid, req.query.date as string | undefined);
  const snap = await admin.firestore()
    .collection(`users/${uid}/entries`)
    .where('date', '==', date)
    .get();
  res.json(snap.docs.map(d => ({ ...d.data(), id: d.id })));
});

/**
 * PUT /entries/:goalId?date=YYYY-MM-DD
 * Body: { "completed": true | false | null }
 */
router.put('/:goalId', async (req, res) => {
  const { uid }    = req as unknown as AuthRequest;
  const { goalId } = req.params;
  const { completed } = req.body as { completed: unknown };

  if (completed !== true && completed !== false && completed !== null) {
    res.status(400).json({ error: '"completed" must be true, false, or null' });
    return;
  }

  const goalSnap = await admin.firestore().doc(`users/${uid}/goals/${goalId}`).get();
  if (!goalSnap.exists) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }
  const { routineId } = goalSnap.data() as { routineId: string };

  const date    = await resolveDate(uid, req.query.date as string | undefined);
  const entryId = `entry-${goalId}-${date}`;

  const entry = { id: entryId, goalId, routineId, date, completed };
  await admin.firestore()
    .doc(`users/${uid}/entries/${entryId}`)
    .set(entry, { merge: true });

  res.json(entry);
});

export default router;
