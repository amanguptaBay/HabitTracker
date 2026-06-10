import * as admin from 'firebase-admin';
import { Request, Response, NextFunction } from 'express';

export interface AuthRequest extends Request {
  uid: string;
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    (req as AuthRequest).uid = decoded.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
