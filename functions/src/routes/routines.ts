import { Router } from 'express';
import * as admin from 'firebase-admin';
import { AuthRequest } from '../auth';

const router = Router();

router.get('/', async (req, res) => {
  const { uid } = req as unknown as AuthRequest;
  const snap = await admin.firestore().collection(`users/${uid}/routines`).get();
  const routines = snap.docs
    .map(d => ({ ...d.data(), id: d.id }))
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0));
  res.json(routines);
});

export default router;
