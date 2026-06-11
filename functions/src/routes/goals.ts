import { Router } from 'express';
import * as admin from 'firebase-admin';
import { AuthRequest } from '../auth';

const router = Router();

/** GET /goals?routineId=...  — omit routineId to get all goals */
router.get('/', async (req, res) => {
  const { uid } = req as unknown as AuthRequest;
  const { routineId } = req.query;

  let q: admin.firestore.Query = admin.firestore().collection(`users/${uid}/goals`);
  if (routineId) {
    q = q.where('routineId', '==', routineId as string);
  }

  const snap = await q.get();
  res.json(snap.docs.map(d => ({ ...d.data(), id: d.id })));
});

export default router;
