import { Router, Request, Response } from 'express';
import { requireActiveCommunityMembership } from '../middleware/communityAuth';
import {
  WaterCreditsService,
  WATER_CREDITS_CONFIG,
  isDayCompletedInKolkata,
  getYesterdayKolkataDateString,
} from '../waterCreditsService';

const router = Router();

/**
 * GET /api/v1/water-credits/summary
 * Protected: Requires active community membership.
 * Returns community Water Credits balance, latest completed day ledger entry,
 * today's running totals, formula configuration, and tabletop disclaimer.
 */
router.get('/v1/water-credits/summary', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot query water credits for another community.' });
    return;
  }

  try {
    const summary = await WaterCreditsService.getSummary(verifiedCommunityId);
    res.json({ success: true, ...summary });
  } catch (err: any) {
    console.error('[API] Failed to get water credits summary:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve water credits summary.' });
  }
});

/**
 * GET /api/v1/water-credits/history
 * Protected: Requires active community membership.
 * Returns auditable daily history entries.
 */
router.get('/v1/water-credits/history', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot query water credits history for another community.' });
    return;
  }

  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30));

  try {
    const history = await WaterCreditsService.getDailyHistory(verifiedCommunityId, limit);
    res.json({ success: true, communityId: verifiedCommunityId, history });
  } catch (err: any) {
    console.error('[API] Failed to get water credits history:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve water credits history.' });
  }
});

/**
 * GET /api/v1/water-credits/balance
 * Protected: Returns total available credits balance.
 */
router.get('/v1/water-credits/balance', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.query.villageId && req.query.villageId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot query water credits balance for another community.' });
    return;
  }

  try {
    const availableCredits = await WaterCreditsService.getAvailableBalance(verifiedCommunityId);
    res.json({
      success: true,
      communityId: verifiedCommunityId,
      availableCredits,
      conversionRate: WATER_CREDITS_CONFIG.conversionRate,
      unit: 'Water Credits',
    });
  } catch (err: any) {
    console.error('[API] Failed to get water credits balance:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to retrieve water credits balance.' });
  }
});

/**
 * POST /api/v1/water-credits/calculate-daily
 * Protected: Triggers daily calculation for a completed day.
 * Derives communityId strictly server-side.
 * Idempotent: repeats do not duplicate awards.
 */
router.post('/v1/water-credits/calculate-daily', requireActiveCommunityMembership, async (req: Request, res: Response) => {
  const verifiedCommunityId = (req as any).communityId || (req as any).user?.communityId;
  if (!verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Active community membership required.' });
    return;
  }
  if (req.body?.communityId && req.body.communityId !== verifiedCommunityId) {
    res.status(403).json({ success: false, error: 'Access denied: Cannot trigger calculation for another community.' });
    return;
  }

  const targetDateStr = typeof req.body?.targetDate === 'string' && req.body.targetDate
    ? req.body.targetDate.slice(0, 10)
    : getYesterdayKolkataDateString();

  if (!isDayCompletedInKolkata(targetDateStr)) {
    res.status(400).json({
      success: false,
      error: `Date ${targetDateStr} is still in progress in Asia/Kolkata. Daily water credits are awarded only for completed days.`,
      targetDate: targetDateStr,
    });
    return;
  }

  try {
    const entry = await WaterCreditsService.calculateDailyCredits(verifiedCommunityId, targetDateStr);
    const availableBalance = await WaterCreditsService.getAvailableBalance(verifiedCommunityId);

    res.json({
      success: true,
      message: `Daily calculation for ${targetDateStr} processed successfully.`,
      entry,
      availableCredits: availableBalance,
    });
  } catch (err: any) {
    console.error('[API] Daily calculation failed:', err);
    res.status(500).json({ success: false, error: err.message || 'Daily calculation failed.' });
  }
});

export default router;
