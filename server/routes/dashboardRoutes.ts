import { Router, Request, Response } from 'express';
import { isFirebaseConfigured } from '../firebaseAdmin';
import { config } from '../config';
import { TelemetryService } from '../telemetryService';
import { requireCommunityTelemetryMembership } from '../middleware/communityAuth';
import { generateGroundwaterAdvice, AiAdviceRequest } from '../aiService';
import {
  INITIAL_RECOMMENDATIONS,
  CURRENT_VILLAGE,
  AVAILABLE_COMMUNITIES,
} from '../../src/services/mockData';

const router = Router();

/**
 * GET /api/health
 * System health and service configuration status
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'BhujalSetu Backend',
    firebase: isFirebaseConfigured
      ? 'connected'
      : 'not_configured (service account credentials missing in .env.local; production telemetry persistence returns 503 until configured)',
    ai: config.geminiApiKey
      ? 'configured'
      : 'not_configured (provide GEMINI_API_KEY in .env.local for live Gemini synthesis)',
    deviceAuth: config.deviceApiKey ? 'configured' : 'missing_key',
    timestamp: new Date().toISOString(),
  });
});

/** Latest tabletop prototype sensor telemetry (measured or explicitly simulated). */
router.get('/prototype/telemetry/latest', requireCommunityTelemetryMembership, async (req: Request, res: Response) => {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const record = await TelemetryService.getLatestPrototypeTelemetry(villageId);
  if (!record) {
    res.status(404).json({ success: false, error: 'No prototype telemetry received yet' });
    return;
  }
  res.json(record);
});

/**
 * GET /api/groundwater
 * Fetches latest monitored groundwater status
 */
router.get('/groundwater', async (req: Request, res: Response) => {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const status = await TelemetryService.getGroundwaterStatus(villageId);
  res.json(status);
});

/**
 * GET /api/water-balance
 * Fetches computed water balance for daily, weekly, or monthly
 */
router.get('/water-balance', async (req: Request, res: Response) => {
  const period = req.query.period === 'weekly' ? 'weekly' : req.query.period === 'monthly' ? 'monthly' : 'daily';
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const balance = await TelemetryService.getWaterBalance(period, villageId);
  res.json(balance);
});

/**
 * GET /api/trends
 * Fetches time-series trend data
 */
router.get('/trends', async (req: Request, res: Response) => {
  const range = req.query.range === '7d' ? '7d' : req.query.range === '90d' ? '90d' : '30d';
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const liveSeries = await TelemetryService.getTrends(range, villageId);

  res.json({
    hasLiveTelemetry: liveSeries !== null,
    range,
    data: liveSeries,
  });
});

/**
 * GET /api/alerts
 * Fetches active prototype alerts derived from real hardware telemetry
 */
router.get('/alerts', async (req: Request, res: Response) => {
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const latest = await TelemetryService.getLatestPrototypeTelemetry(villageId);
  const alerts: any[] = [];
  if (latest && latest.tankLevelPercent <= 10) {
    alerts.push({
      id: 'alert-tank-low',
      severity: 'WATCH',
      title: 'Tabletop Tank Level Low',
      message: `Tabletop tank water level is at ${latest.tankLevelPercent.toFixed(1)}%.`,
      triggerMetric: 'Tabletop Tank Level',
      thresholdValue: '<= 10%',
      actualValue: `${latest.tankLevelPercent.toFixed(1)}%`,
      timestamp: latest.timestamp || new Date().toISOString(),
    });
  }
  res.json(alerts);
});

/**
 * GET /api/actions
 * Fetches rule-based action recommendations
 */
router.get('/actions', async (_req: Request, res: Response) => {
  res.json(INITIAL_RECOMMENDATIONS);
});

/**
 * POST /api/ai/advice
 * Synthesizes groundwater intelligence using Google Gemini
 */
router.post('/ai/advice', async (req: Request, res: Response): Promise<void> => {
  try {
    const adviceInput: AiAdviceRequest = req.body || {};
    const result = await generateGroundwaterAdvice(adviceInput);
    res.json(result);
  } catch (error) {
    console.error('[API] Error generating AI advice:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating AI groundwater advice',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
