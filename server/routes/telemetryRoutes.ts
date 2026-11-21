import { Router, Request, Response } from 'express';
import { TelemetryInputSchema } from '../telemetryValidator';
import { requireDeviceAuth } from '../middleware/auth';
import { TelemetryService } from '../telemetryService';

const router = Router();

/**
 * POST /api/telemetry
 * [DEPRECATED] Legacy combined sensor reading ingestion from older single-node ESP32 sketch.
 * Active hardware path: POST /api/v1/telemetry with node-specific packets (node-1 / node-2).
 * Requires Authorization: Bearer <DEVICE_API_KEY>
 */
router.post('/telemetry', requireDeviceAuth, async (req: Request, res: Response): Promise<void> => {
  res.setHeader('X-Deprecated', 'POST /api/telemetry is deprecated; migrate to POST /api/v1/telemetry');

  const parseResult = TelemetryInputSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      issues: parseResult.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    });
    return;
  }

  if (parseResult.data.dataSource !== 'measured' && process.env.NODE_ENV !== 'test') {
    res.status(400).json({
      success: false,
      error: 'Only measured telemetry packets are accepted in production.',
    });
    return;
  }

  try {
    const { record, alertsTriggered } = await TelemetryService.processIncomingTelemetry(
      parseResult.data
    );

    res.status(201).json({
      success: true,
      message: 'Telemetry received and persisted (legacy format)',
      deprecatedNotice: 'This endpoint is deprecated; migrate to POST /api/v1/telemetry',
      deviceId: record.deviceId,
      telemetryId: record.id,
      timestamp: record.timestamp,
      receivedAt: record.receivedAt,
      alerts: alertsTriggered,
    });
  } catch (error) {
    console.error('[API] Error processing telemetry:', error);
    const msg = error instanceof Error ? error.message : String(error);
    const statusCode = msg.includes('PostgreSQL') || msg.includes('database') ? 503 : 500;
    res.status(statusCode).json({
      success: false,
      error: msg.includes('PostgreSQL') || msg.includes('database')
        ? 'PostgreSQL database storage is unavailable; sample was not accepted.'
        : 'Internal server error processing telemetry',
      message: msg,
    });
  }
});

export default router;
