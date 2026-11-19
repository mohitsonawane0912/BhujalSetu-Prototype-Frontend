import { Router, Request, Response } from 'express';
import { requireNodeDeviceAuth } from '../middleware/auth';
import { NodeTelemetrySchema } from '../nodeTelemetrySchema';
import { NodeTelemetryRepository } from '../nodeTelemetryRepository';
import { requireCommunityTelemetryMembership } from '../middleware/communityAuth';

const router = Router();

router.post('/v1/telemetry', requireNodeDeviceAuth, async (req: Request, res: Response) => {
  const parsed = NodeTelemetrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: 'Telemetry validation failed',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }
  if (parsed.data.dataSource !== 'measured' && process.env.NODE_ENV !== 'test') {
    res.status(400).json({ success: false, error: 'Only measured node packets are accepted by the live sensor dashboard.' });
    return;
  }

  try {
    const record = await NodeTelemetryRepository.save(parsed.data);

    res.status(201).json({
      success: true,
      dataSource: record.dataSource,
      nodeId: record.nodeId,
      telemetryId: record.id,
      capturedAt: record.capturedAt,
      receivedAt: record.receivedAt,
    });
  } catch (error) {
    console.error('[API] Node telemetry persistence failed:', error);
    res.status(503).json({ success: false, error: 'PostgreSQL database is unavailable or disconnected; sample was not accepted.' });
  }
});

router.get('/v1/telemetry', requireCommunityTelemetryMembership, async (req: Request, res: Response) => {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : '';
  const requestedLimit = Number(req.query.limit ?? 60);
  if (!villageId || !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 500) {
    res.status(400).json({ success: false, error: 'Provide villageId and limit from 1 to 500.' });
    return;
  }
  try {
    const records = await NodeTelemetryRepository.list(villageId, requestedLimit);
    res.json({ success: true, records });
  } catch (error) {
    console.error('[API] Node telemetry read failed:', error);
    res.status(503).json({ success: false, error: 'Telemetry storage unavailable.' });
  }
});

/**
 * GET /api/v1/gems
 * GEMs and Water Credits are a proposed concept only for future development.
 * No points, tokens, balances, or redemptions are calculated, awarded, or stored.
 */
router.get('/v1/gems', requireCommunityTelemetryMembership, async (req: Request, res: Response) => {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : '';
  if (!villageId) {
    res.status(400).json({ success: false, error: 'Provide villageId.' });
    return;
  }
  res.json({
    success: true,
    villageId,
    proposed: true,
    message: 'GEMs and Water Credits are a proposed concept only for future development and will need community and authority agreement. No points or tokens are calculated, awarded, or stored.',
  });
});

export default router;
