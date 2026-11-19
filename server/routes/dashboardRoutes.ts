import { Router, Request, Response } from 'express';
import { checkConnection, query } from '../db/postgres';
import { config } from '../config';
import { TelemetryService } from '../telemetryService';
import { NodeTelemetryRepository } from '../nodeTelemetryRepository';
import { requireCommunityTelemetryMembership, requireActiveCommunityMembership } from '../middleware/communityAuth';
import { AiAdvisorService } from '../aiAdvisorService';
import { AnomalyDetector } from '../anomalyDetector';
import {
  INITIAL_RECOMMENDATIONS,
  CURRENT_VILLAGE,
  AVAILABLE_COMMUNITIES,
} from '../../src/services/mockData';

const router = Router();

// Test stores for test environment
const testActions: any[] = [];
const testPledges: any[] = [];

/**
 * GET /api/health
 * System health and service configuration status
 */
router.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = 'testing';
  if (process.env.NODE_ENV !== 'test') {
    const isPgConnected = await checkConnection();
    dbStatus = isPgConnected
      ? `connected (PostgreSQL: ${config.postgres.database})`
      : 'disconnected (PostgreSQL is not responding)';
  } else {
    dbStatus = 'test_mode (in-memory test isolation)';
  }

  res.json({
    status: 'ok',
    service: 'BhujalSetu Backend',
    database: dbStatus,
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
 * Computes water balance from measured Node 1 recharge and Node 2 extraction
 */
router.get('/water-balance', async (req: Request, res: Response) => {
  const period = (req.query.period as 'daily' | 'weekly' | 'monthly') || 'daily';
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const balance = await TelemetryService.getWaterBalance(period, villageId);
  res.json(balance);
});

/**
 * GET /api/trends
 * Monitored historical trends. Tabletop sensors measure bench flow/tank level only;
 * returns empty series rather than fake village-wide groundwater trends.
 */
router.get('/trends', async (req: Request, res: Response) => {
  const range = (req.query.range as '7d' | '30d' | '90d') || '30d';
  const villageId = typeof req.query.villageId === 'string' ? req.query.villageId : undefined;
  const trends = await TelemetryService.getTrends(range, villageId);
  res.json(trends);
});

/**
 * GET /api/alerts
 * Fetches active prototype alerts derived from real hardware telemetry.
 * Protected: Requires authenticated active community membership.
 * Community ID is derived strictly server-side from verified user session.
 */
router.get('/alerts', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot query alerts for another community.' });
    return;
  }
  const villageId = verifiedCommunityId;
  const alerts: any[] = [];

  // 1. Check extraction anomaly from AnomalyDetector (including active alerts during recovery)
  let recentRecords: any[] = [];
  try {
    recentRecords = await NodeTelemetryRepository.list(villageId, 50);
  } catch {
    recentRecords = [];
  }

  const anomalyEval = AnomalyDetector.evaluateNode2Extraction(recentRecords, villageId);
  if (anomalyEval.alert && anomalyEval.alert.status === 'ACTIVE') {
    alerts.push(anomalyEval.alert);
  } else {
    const activeAlert = AnomalyDetector.getActiveAlert(villageId);
    if (activeAlert) {
      alerts.push(activeAlert);
    }
  }

  // 2. Check Node 1 tabletop water level (< 5.0 cm is low reserve)
  const node1Latest = recentRecords.find((r) => r.nodeId === 'node-1' && r.dataSource === 'measured');
  if (node1Latest?.waterLevel && node1Latest.waterLevel.levelCm < 5.0) {
    alerts.push({
      id: `alert-tank-low-${villageId}`,
      severity: 'WATCH',
      title: 'Tabletop Tank Water Level Low',
      message: `Ultrasonic sensor reports ${node1Latest.waterLevel.levelCm.toFixed(1)} cm water depth in tabletop reservoir.`,
      triggerMetric: 'Tabletop Tank Level',
      thresholdValue: '< 5.0 cm',
      actualValue: `${node1Latest.waterLevel.levelCm.toFixed(1)} cm`,
      timestamp: node1Latest.capturedAt || new Date().toISOString(),
    });
  }

  // 3. Check legacy tank level fallback
  const latestLegacy = await TelemetryService.getLatestPrototypeTelemetry(villageId);
  if (latestLegacy && latestLegacy.tankLevelPercent <= 10 && !node1Latest) {
    alerts.push({
      id: 'alert-tank-low-legacy',
      severity: 'WATCH',
      title: 'Tabletop Tank Level Low',
      message: `Tabletop tank water level is at ${latestLegacy.tankLevelPercent.toFixed(1)}%.`,
      triggerMetric: 'Tabletop Tank Level',
      thresholdValue: '<= 10%',
      actualValue: `${latestLegacy.tankLevelPercent.toFixed(1)}%`,
      timestamp: latestLegacy.timestamp || new Date().toISOString(),
    });
  }

  res.json(alerts);
});

/**
 * GET /api/telemetry/extraction-anomaly
 * Protected: Evaluates measured Node 2 extraction telemetry against baseline.
 * Derived strictly server-side from verified active community membership.
 */
router.get('/telemetry/extraction-anomaly', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot query anomaly telemetry for another community.' });
    return;
  }
  const villageId = verifiedCommunityId;

  let recentRecords: any[] = [];
  try {
    recentRecords = await NodeTelemetryRepository.list(villageId, 100);
  } catch {
    recentRecords = [];
  }
  const result = AnomalyDetector.evaluateNode2Extraction(recentRecords, villageId);
  res.json(result);
});

/**
 * GET /api/actions
 * Fetches rule-based action recommendations
 */
router.get('/actions', async (_req: Request, res: Response) => {
  res.json(INITIAL_RECOMMENDATIONS);
});

/**
 * Community Actions endpoints
 * Protected: Requires authentication and active community membership.
 * Acting user and community are derived strictly server-side from verified JWT.
 */
router.get('/community/actions', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const villageId = (req as any).communityId || (req as any).user.communityId || 'village-rampur-04';
  if (process.env.NODE_ENV === 'test') {
    return res.json({ success: true, actions: testActions.filter((a) => a.communityId === villageId) });
  }
  try {
    const result = await query(
      `SELECT id, community_id as "communityId", user_id as "userId", user_name as "userName",
              user_email as "userEmail", action_type as "actionType", title, description, ward,
              impact_liters as "impactLiters", status, created_at as "createdAt"
       FROM community_actions
       WHERE community_id = $1
       ORDER BY created_at DESC`,
      [villageId]
    );
    res.json({ success: true, actions: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/community/actions', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const { actionType, title, description, ward, impactLiters, status } = req.body || {};
  if (!actionType || !title || !ward) {
    res.status(400).json({ success: false, error: 'Missing required community action fields (actionType, title, ward).' });
    return;
  }

  // Derive acting user and community from verified server-side token
  const authUser = (req as any).user;
  const communityId = (req as any).communityId || authUser.communityId;

  const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();
  const action = {
    id,
    communityId,
    userId: authUser.userId,
    userName: authUser.displayName,
    userEmail: authUser.email || null,
    actionType: String(actionType).slice(0, 64),
    title: String(title).slice(0, 150),
    description: description ? String(description).slice(0, 500) : null,
    ward: String(ward).slice(0, 100),
    impactLiters: Number(impactLiters) || 0,
    status: status === 'completed' || status === 'in_progress' ? status : 'proposed',
    createdAt: nowIso,
  };

  if (process.env.NODE_ENV === 'test') {
    testActions.unshift(action);
    return res.status(201).json({ success: true, action });
  }
  try {
    await query(
      `INSERT INTO community_actions (id, community_id, user_id, user_name, user_email, action_type, title, description, ward, impact_liters, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [action.id, action.communityId, action.userId, action.userName, action.userEmail, action.actionType, action.title, action.description, action.ward, action.impactLiters, action.status, action.createdAt]
    );
    res.status(201).json({ success: true, action });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Community Water Pledges endpoints
 * Protected: Requires authentication and active community membership.
 * Acting user and community are derived strictly server-side from verified JWT.
 */
router.get('/community/pledges', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const villageId = (req as any).communityId || (req as any).user.communityId || 'village-rampur-04';
  if (process.env.NODE_ENV === 'test') {
    return res.json({ success: true, pledges: testPledges.filter((p) => p.communityId === villageId) });
  }
  try {
    const result = await query(
      `SELECT id, community_id as "communityId", user_id as "userId", user_name as "userName",
              pledge_type as "pledgeType", target_liters_per_day as "targetLitersPerDay", created_at as "createdAt"
       FROM water_pledges
       WHERE community_id = $1
       ORDER BY created_at DESC`,
      [villageId]
    );
    res.json({ success: true, pledges: result.rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/community/pledges', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const { pledgeType, targetLitersPerDay } = req.body || {};
  if (!pledgeType || targetLitersPerDay == null) {
    res.status(400).json({ success: false, error: 'Missing required pledge fields (pledgeType, targetLitersPerDay).' });
    return;
  }

  // Derive acting user and community from verified server-side token
  const authUser = (req as any).user;
  const communityId = (req as any).communityId || authUser.communityId;

  const id = `pledge_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const nowIso = new Date().toISOString();
  const pledge = {
    id,
    communityId,
    userId: authUser.userId,
    userName: authUser.displayName,
    pledgeType: String(pledgeType).slice(0, 64),
    targetLitersPerDay: Math.max(0, Number(targetLitersPerDay)),
    createdAt: nowIso,
  };

  if (process.env.NODE_ENV === 'test') {
    testPledges.unshift(pledge);
    return res.status(201).json({ success: true, pledge });
  }
  try {
    await query(
      `INSERT INTO water_pledges (id, community_id, user_id, user_name, pledge_type, target_liters_per_day, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [pledge.id, pledge.communityId, pledge.userId, pledge.userName, pledge.pledgeType, pledge.targetLitersPerDay, pledge.createdAt]
    );
    res.status(201).json({ success: true, pledge });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/ai/advice & POST /api/ai/advice
 * Protected: Requires authenticated active community membership.
 * Loads verified telemetry, external weather API forecast, and seasonal context server-side.
 * Browser-supplied sensor measurements are never accepted.
 */
const handleAiAdvice = async (req: Request, res: Response): Promise<void> => {
  try {
    const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
    if (!verifiedCommunityId) {
      res.status(403).json({ success: false, error: 'Active community membership required.' });
      return;
    }
    if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
      res.status(403).json({ success: false, error: 'Access denied: Cannot query advisor for another community.' });
      return;
    }
    const communityId = verifiedCommunityId;
    const result = await AiAdvisorService.generateAdvice(communityId);
    res.json(result);
  } catch (error) {
    console.error('[API] Error generating AI advisor intelligence:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating AI groundwater intelligence',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

router.get('/ai/advice', requireActiveCommunityMembership, handleAiAdvice);
router.post('/ai/advice', requireActiveCommunityMembership, handleAiAdvice);

export default router;
