import { Request, Response, NextFunction } from 'express';
import { verifyCommunityMembership } from '../firebaseAdmin';

export async function requireCommunityTelemetryMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : '';
  if (!villageId) {
    res.status(400).json({ success: false, error: 'A villageId is required.' });
    return;
  }
  const authorization = req.header('authorization') || '';
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!idToken) {
    res.status(401).json({ success: false, error: 'Sign in with Firebase to read this community telemetry.' });
    return;
  }
  try {
    if (!(await verifyCommunityMembership(idToken, villageId))) {
      res.status(403).json({ success: false, error: 'Active community membership is required.' });
      return;
    }
    next();
  } catch (error) {
    if (error instanceof Error && error.message === 'FIREBASE_ADMIN_NOT_CONFIGURED') {
      res.status(503).json({ success: false, error: 'Server Firebase Admin credentials are required to check community access.' });
      return;
    }
    res.status(401).json({ success: false, error: 'Firebase sign-in could not be verified.' });
  }
}
