import { query } from './db/postgres';
import { NodeTelemetryRepository } from './nodeTelemetryRepository';
import { NodeTelemetryRecord } from './nodeTelemetrySchema';

export interface WaterCreditLedgerEntry {
  id: string;
  communityId: string;
  periodType: 'daily' | 'weekly' | 'monthly';
  periodDate: string; // 'YYYY-MM-DD'
  periodStart: string; // ISO UTC
  periodEnd: string; // ISO UTC
  rechargeLiters: number;
  extractionLiters: number;
  netSurplusLiters: number;
  netDeficitLiters: number;
  surplusPercentage: number | null;
  creditsEarned: number;
  dataCoverageStatus: 'complete' | 'incomplete' | 'waiting_for_data' | 'in_progress';
  coveragePercentageNode1: number;
  coveragePercentageNode2: number;
  node1SampleCount: number;
  node2SampleCount: number;
  gapCountNode1: number;
  gapCountNode2: number;
  formulaVersion: string;
  conversionRate: number;
  disclaimer: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WaterCreditTodayStatus {
  periodDate: string;
  isCompleted: false;
  status: 'in_progress' | 'waiting_for_data';
  rechargeLiters: number;
  extractionLiters: number;
  netSurplusLiters: number;
  netDeficitLiters: number;
  surplusPercentage: number | null;
  node1SampleCount: number;
  node2SampleCount: number;
  coveragePercentageNode1: number;
  coveragePercentageNode2: number;
  message: string;
}

export interface WaterCreditSummary {
  communityId: string;
  availableCredits: number;
  totalRechargeLitersAllTime: number;
  totalExtractionLitersAllTime: number;
  latestCompletedDay: WaterCreditLedgerEntry | null;
  todayRunning: WaterCreditTodayStatus;
  conversionRate: number;
  periodType: 'daily';
  formulaVersion: string;
  timezone: string;
  minCoveragePercentRequired: number;
  disclaimer: string;
}

export const WATER_CREDITS_CONFIG = {
  formulaVersion: 'v1.0-tabletop-net-litres',
  conversionRate: 1.0, // 1 Water Credit per net litre
  periodType: 'daily' as const,
  timezone: 'Asia/Kolkata',
  pulsesPerLiter: 450.0,
  sendIntervalMs: 10_000,
  maxGapThresholdSeconds: 60, // 6 missed 10s packets = gap
  minCoveragePercent: 75.0, // 75% coverage required for complete daily status
  disclaimer:
    'Prototype Water Credits compare tabletop measured flow volumes (Node 1 recharge vs Node 2 extraction). They are prototype community recognition points and do not represent a village-wide groundwater aquifer balance, cash value, or external reward entitlement.',
};

// In-memory store for isolated unit/integration tests
const testLedger: WaterCreditLedgerEntry[] = [];

/**
 * Returns date in Asia/Kolkata (UTC+5:30) as 'YYYY-MM-DD'
 */
export function getKolkataDateString(date: Date = new Date()): string {
  // Asia/Kolkata is UTC+05:30 (330 minutes)
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const kolkataTime = new Date(date.getTime() + kolkataOffsetMs);
  return kolkataTime.toISOString().slice(0, 10);
}

/**
 * Returns the yesterday date string in Asia/Kolkata
 */
export function getYesterdayKolkataDateString(now: Date = new Date()): string {
  const kolkataOffsetMs = 5.5 * 60 * 60 * 1000;
  const kolkataTime = new Date(now.getTime() + kolkataOffsetMs);
  kolkataTime.setUTCDate(kolkataTime.getUTCDate() - 1);
  return kolkataTime.toISOString().slice(0, 10);
}

/**
 * Returns UTC start and end timestamps for a given date in Asia/Kolkata
 */
export function getKolkataDayBounds(dateStr: string): { startUtc: string; endUtc: string } {
  // Start of day: YYYY-MM-DDT00:00:00.000+05:30
  // End of day: YYYY-MM-DDT23:59:59.999+05:30
  const startUtc = new Date(`${dateStr}T00:00:00.000+05:30`).toISOString();
  const endUtc = new Date(`${dateStr}T23:59:59.999+05:30`).toISOString();
  return { startUtc, endUtc };
}

/**
 * Checks if a given Asia/Kolkata day is completed (current time past 23:59:59.999 IST)
 */
export function isDayCompletedInKolkata(dateStr: string, now: Date = new Date()): boolean {
  const { endUtc } = getKolkataDayBounds(dateStr);
  return now.getTime() > new Date(endUtc).getTime();
}

/**
 * Integrates flow volume and calculates coverage for a set of records for one node.
 * Strictly avoids interpolating across gaps > maxGapThresholdSeconds.
 */
export function integrateNodeFlow(
  records: NodeTelemetryRecord[],
  expectedTotalSeconds = 86400,
  maxGapSeconds = WATER_CREDITS_CONFIG.maxGapThresholdSeconds
): {
  volumeLiters: number;
  sampleCount: number;
  coveredSeconds: number;
  coveragePercentage: number;
  gapCount: number;
} {
  const measured = records
    .filter((r) => r.dataSource === 'measured')
    .sort((a, b) => new Date(a.receivedAt || a.capturedAt).getTime() - new Date(b.receivedAt || b.capturedAt).getTime());

  if (measured.length === 0) {
    return {
      volumeLiters: 0,
      sampleCount: 0,
      coveredSeconds: 0,
      coveragePercentage: 0,
      gapCount: 0,
    };
  }

  let totalVolume = 0;
  let coveredSeconds = 0;
  let gapCount = 0;

  for (let i = 0; i < measured.length; i++) {
    const current = measured[i];
    const currentMs = new Date(current.receivedAt || current.capturedAt).getTime();

    // Volume from this packet's measured pulses
    // Calibration: FLOW_PULSES_PER_LITER = 450.0
    const packetLiters = current.flow.pulses > 0
      ? current.flow.pulses / WATER_CREDITS_CONFIG.pulsesPerLiter
      : 0;

    totalVolume += packetLiters;

    if (i === 0) {
      // First packet represents the initial send interval
      coveredSeconds += Math.min(10, maxGapSeconds);
    } else {
      const prevMs = new Date(measured[i - 1].receivedAt || measured[i - 1].capturedAt).getTime();
      const deltaSec = (currentMs - prevMs) / 1000;

      if (deltaSec > maxGapSeconds) {
        // Telemetry gap detected: missing transmissions or stale sensor
        // Do NOT interpolate across long gaps as if readings were measured!
        gapCount++;
        // Give only the packet's nominal 10s sampling window towards coverage
        coveredSeconds += 10;
      } else if (deltaSec > 0) {
        coveredSeconds += deltaSec;
      }
    }
  }

  const coveragePercentage = Math.min(
    100,
    Math.round((coveredSeconds / expectedTotalSeconds) * 10000) / 100
  );

  return {
    volumeLiters: Math.round(totalVolume * 1000) / 1000,
    sampleCount: measured.length,
    coveredSeconds: Math.round(coveredSeconds),
    coveragePercentage,
    gapCount,
  };
}

function mapRowToLedger(row: any): WaterCreditLedgerEntry {
  return {
    id: row.id,
    communityId: row.community_id,
    periodType: row.period_type,
    periodDate: typeof row.period_date === 'string' ? row.period_date.slice(0, 10) : new Date(row.period_date).toISOString().slice(0, 10),
    periodStart: new Date(row.period_start).toISOString(),
    periodEnd: new Date(row.period_end).toISOString(),
    rechargeLiters: Number(row.recharge_liters),
    extractionLiters: Number(row.extraction_liters),
    netSurplusLiters: Number(row.net_surplus_liters),
    netDeficitLiters: Number(row.net_deficit_liters),
    surplusPercentage: row.surplus_percentage != null ? Number(row.surplus_percentage) : null,
    creditsEarned: Number(row.credits_earned),
    dataCoverageStatus: row.data_coverage_status,
    coveragePercentageNode1: Number(row.coverage_percentage_node1),
    coveragePercentageNode2: Number(row.coverage_percentage_node2),
    node1SampleCount: Number(row.node1_sample_count),
    node2SampleCount: Number(row.node2_sample_count),
    gapCountNode1: Number(row.gap_count_node1 || 0),
    gapCountNode2: Number(row.gap_count_node2 || 0),
    formulaVersion: row.formula_version,
    conversionRate: Number(row.conversion_rate),
    disclaimer: row.disclaimer,
    notes: row.notes || undefined,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export const WaterCreditsService = {
  clearTestData(): void {
    testLedger.length = 0;
  },

  /**
   * Calculates daily water credits for a specified date in Asia/Kolkata.
   * If targetDateStr is omitted, defaults to yesterday (the most recently completed day).
   * Idempotent: safe against duplicate requests, restarts, and concurrent executions.
   */
  async calculateDailyCredits(
    communityId: string,
    targetDateStr?: string,
    options?: {
      minCoveragePercent?: number;
      conversionRate?: number;
      now?: Date;
    }
  ): Promise<WaterCreditLedgerEntry> {
    const now = options?.now || new Date();
    const dateStr = targetDateStr || getYesterdayKolkataDateString(now);

    const isCompleted = isDayCompletedInKolkata(dateStr, now);
    if (!isCompleted) {
      throw new Error(
        `Cannot award daily credits for incomplete day (${dateStr}). Daily water credits require a fully completed calendar day in Asia/Kolkata.`
      );
    }

    const minCoverage = options?.minCoveragePercent ?? WATER_CREDITS_CONFIG.minCoveragePercent;
    const conversionRate = options?.conversionRate ?? WATER_CREDITS_CONFIG.conversionRate;
    const formulaVersion = WATER_CREDITS_CONFIG.formulaVersion;
    const disclaimer = WATER_CREDITS_CONFIG.disclaimer;
    const { startUtc, endUtc } = getKolkataDayBounds(dateStr);

    // Check if an entry already exists for this community and day
    if (process.env.NODE_ENV === 'test') {
      const existing = testLedger.find(
        (l) => l.communityId === communityId && l.periodDate === dateStr && l.periodType === 'daily'
      );
      if (existing && existing.dataCoverageStatus === 'complete') {
        return existing;
      }
    } else {
      try {
        const existingRes = await query(
          `SELECT * FROM community_water_credits_ledger
           WHERE community_id = $1 AND period_type = 'daily' AND period_date = $2`,
          [communityId, dateStr]
        );
        if (existingRes.rows.length > 0) {
          const entry = mapRowToLedger(existingRes.rows[0]);
          if (entry.dataCoverageStatus === 'complete') {
            return entry;
          }
        }
      } catch (err) {
        console.error('[WaterCredits] Error checking existing ledger entry:', err);
      }
    }

    // Load authenticated, measured Node 1 and Node 2 telemetry strictly from the period
    const records = await NodeTelemetryRepository.listBetween(communityId, startUtc, endUtc);
    const measuredRecords = records.filter((r) => r.dataSource === 'measured');

    const node1Records = measuredRecords.filter((r) => r.nodeId === 'node-1');
    const node2Records = measuredRecords.filter((r) => r.nodeId === 'node-2');

    // 24 hours in a full day = 86,400 seconds
    const expectedDaySeconds = 86400;
    const node1Metrics = integrateNodeFlow(node1Records, expectedDaySeconds);
    const node2Metrics = integrateNodeFlow(node2Records, expectedDaySeconds);

    let dataCoverageStatus: 'complete' | 'incomplete' | 'waiting_for_data' = 'complete';
    let notes = '';

    if (node1Metrics.sampleCount === 0 && node2Metrics.sampleCount === 0) {
      dataCoverageStatus = 'waiting_for_data';
      notes = 'No measured telemetry packets received for Node 1 or Node 2 on this date.';
    } else if (node1Metrics.sampleCount === 0) {
      dataCoverageStatus = 'incomplete';
      notes = 'Node 1 (recharge) has zero measured packets. Incomplete coverage: zero credits awarded.';
    } else if (node2Metrics.sampleCount === 0) {
      dataCoverageStatus = 'incomplete';
      notes = 'Node 2 (extraction) has zero measured packets. Incomplete coverage: zero credits awarded.';
    } else if (
      node1Metrics.coveragePercentage < minCoverage ||
      node2Metrics.coveragePercentage < minCoverage
    ) {
      dataCoverageStatus = 'incomplete';
      notes = `Coverage below required ${minCoverage}%. Node 1 coverage: ${node1Metrics.coveragePercentage.toFixed(1)}%, Node 2 coverage: ${node2Metrics.coveragePercentage.toFixed(1)}%. Marked Incomplete: zero credits awarded.`;
    }

    const rechargeLiters = node1Metrics.volumeLiters;
    const extractionLiters = node2Metrics.volumeLiters;
    const netSurplusLiters = Math.max(0, Math.round((rechargeLiters - extractionLiters) * 1000) / 1000);
    const netDeficitLiters = Math.max(0, Math.round((extractionLiters - rechargeLiters) * 1000) / 1000);

    // Recharge surplus percentage rule:
    // (recharge - extraction) / extraction * 100 when extraction > 0.
    // If extraction is 0, show percentage as unavailable (null).
    const surplusPercentage =
      extractionLiters > 0
        ? Math.round(((rechargeLiters - extractionLiters) / extractionLiters) * 10000) / 100
        : null;

    // Credits rule:
    // Only complete days earn credits. Incomplete or deficit days earn 0 credits.
    let creditsEarned = 0;
    if (dataCoverageStatus === 'complete' && netSurplusLiters > 0) {
      creditsEarned = Math.floor(netSurplusLiters * conversionRate);
    }

    const id = `wc_${dateStr.replace(/-/g, '')}_${communityId}`;
    const nowIso = new Date().toISOString();

    const entry: WaterCreditLedgerEntry = {
      id,
      communityId,
      periodType: 'daily',
      periodDate: dateStr,
      periodStart: startUtc,
      periodEnd: endUtc,
      rechargeLiters,
      extractionLiters,
      netSurplusLiters,
      netDeficitLiters,
      surplusPercentage,
      creditsEarned,
      dataCoverageStatus,
      coveragePercentageNode1: node1Metrics.coveragePercentage,
      coveragePercentageNode2: node2Metrics.coveragePercentage,
      node1SampleCount: node1Metrics.sampleCount,
      node2SampleCount: node2Metrics.sampleCount,
      gapCountNode1: node1Metrics.gapCount,
      gapCountNode2: node2Metrics.gapCount,
      formulaVersion,
      conversionRate,
      disclaimer,
      notes,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (process.env.NODE_ENV === 'test') {
      const idx = testLedger.findIndex(
        (l) => l.communityId === communityId && l.periodDate === dateStr && l.periodType === 'daily'
      );
      if (idx >= 0) {
        testLedger[idx] = entry;
      } else {
        testLedger.unshift(entry);
      }
      return entry;
    }

    try {
      const insertSql = `
        INSERT INTO community_water_credits_ledger (
          id, community_id, period_type, period_date, period_start, period_end,
          recharge_liters, extraction_liters, net_surplus_liters, net_deficit_liters,
          surplus_percentage, credits_earned, data_coverage_status,
          coverage_percentage_node1, coverage_percentage_node2,
          node1_sample_count, node2_sample_count, gap_count_node1, gap_count_node2,
          formula_version, conversion_rate, disclaimer, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
        )
        ON CONFLICT (community_id, period_type, period_date) DO UPDATE
        SET recharge_liters = EXCLUDED.recharge_liters,
            extraction_liters = EXCLUDED.extraction_liters,
            net_surplus_liters = EXCLUDED.net_surplus_liters,
            net_deficit_liters = EXCLUDED.net_deficit_liters,
            surplus_percentage = EXCLUDED.surplus_percentage,
            credits_earned = EXCLUDED.credits_earned,
            data_coverage_status = EXCLUDED.data_coverage_status,
            coverage_percentage_node1 = EXCLUDED.coverage_percentage_node1,
            coverage_percentage_node2 = EXCLUDED.coverage_percentage_node2,
            node1_sample_count = EXCLUDED.node1_sample_count,
            node2_sample_count = EXCLUDED.node2_sample_count,
            gap_count_node1 = EXCLUDED.gap_count_node1,
            gap_count_node2 = EXCLUDED.gap_count_node2,
            notes = EXCLUDED.notes,
            updated_at = NOW()
        RETURNING *
      `;

      const result = await query(insertSql, [
        entry.id,
        entry.communityId,
        entry.periodType,
        entry.periodDate,
        entry.periodStart,
        entry.periodEnd,
        entry.rechargeLiters,
        entry.extractionLiters,
        entry.netSurplusLiters,
        entry.netDeficitLiters,
        entry.surplusPercentage,
        entry.creditsEarned,
        entry.dataCoverageStatus,
        entry.coveragePercentageNode1,
        entry.coveragePercentageNode2,
        entry.node1SampleCount,
        entry.node2SampleCount,
        entry.gapCountNode1,
        entry.gapCountNode2,
        entry.formulaVersion,
        entry.conversionRate,
        entry.disclaimer,
        entry.notes,
        entry.createdAt,
        entry.updatedAt,
      ]);

      return mapRowToLedger(result.rows[0]);
    } catch (err) {
      console.error('[WaterCredits] Failed to persist ledger entry in PostgreSQL:', err);
      throw new Error('PostgreSQL database storage unavailable; water credit calculation could not be saved.');
    }
  },

  /**
   * Fetches total available Water Credits (cumulative sum of credits_earned across completed days).
   * Deficits never subtract from previously earned credits.
   */
  async getAvailableBalance(communityId: string): Promise<number> {
    if (process.env.NODE_ENV === 'test') {
      const records = testLedger.filter((l) => l.communityId === communityId);
      return records.reduce((sum, r) => sum + r.creditsEarned, 0);
    }

    try {
      const res = await query<{ total_credits: string }>(
        `SELECT COALESCE(SUM(credits_earned), 0) as total_credits
         FROM community_water_credits_ledger
         WHERE community_id = $1`,
        [communityId]
      );
      return Number(res.rows[0]?.total_credits || 0);
    } catch (err) {
      console.error('[WaterCredits] Failed to get available balance:', err);
      return 0;
    }
  },

  /**
   * Fetches daily ledger history for the community.
   */
  async getDailyHistory(communityId: string, limit = 30): Promise<WaterCreditLedgerEntry[]> {
    if (process.env.NODE_ENV === 'test') {
      return testLedger
        .filter((l) => l.communityId === communityId)
        .sort((a, b) => b.periodDate.localeCompare(a.periodDate))
        .slice(0, limit);
    }

    try {
      const res = await query(
        `SELECT * FROM community_water_credits_ledger
         WHERE community_id = $1 AND period_type = 'daily'
         ORDER BY period_date DESC
         LIMIT $2`,
        [communityId, limit]
      );
      return res.rows.map(mapRowToLedger);
    } catch (err) {
      console.error('[WaterCredits] Failed to get daily history:', err);
      return [];
    }
  },

  /**
   * Computes running totals for the current (in-progress) day in Asia/Kolkata.
   * Credits are 0 since the day has not completed.
   */
  async getTodayRunningStatus(communityId: string, now: Date = new Date()): Promise<WaterCreditTodayStatus> {
    const todayStr = getKolkataDateString(now);
    const { startUtc, endUtc } = getKolkataDayBounds(todayStr);

    // Seconds elapsed since midnight IST today
    const startMs = new Date(startUtc).getTime();
    const nowMs = now.getTime();
    const elapsedSecondsToday = Math.max(1, Math.min(86400, (nowMs - startMs) / 1000));

    let records: NodeTelemetryRecord[] = [];
    try {
      records = await NodeTelemetryRepository.listBetween(communityId, startUtc, endUtc);
    } catch {
      records = [];
    }

    const measuredRecords = records.filter((r) => r.dataSource === 'measured');
    const node1Records = measuredRecords.filter((r) => r.nodeId === 'node-1');
    const node2Records = measuredRecords.filter((r) => r.nodeId === 'node-2');

    const node1Metrics = integrateNodeFlow(node1Records, elapsedSecondsToday);
    const node2Metrics = integrateNodeFlow(node2Records, elapsedSecondsToday);

    const rechargeLiters = node1Metrics.volumeLiters;
    const extractionLiters = node2Metrics.volumeLiters;
    const netSurplusLiters = Math.max(0, Math.round((rechargeLiters - extractionLiters) * 1000) / 1000);
    const netDeficitLiters = Math.max(0, Math.round((extractionLiters - rechargeLiters) * 1000) / 1000);

    const surplusPercentage =
      extractionLiters > 0
        ? Math.round(((rechargeLiters - extractionLiters) / extractionLiters) * 10000) / 100
        : null;

    const hasData = node1Metrics.sampleCount > 0 || node2Metrics.sampleCount > 0;

    return {
      periodDate: todayStr,
      isCompleted: false,
      status: hasData ? 'in_progress' : 'waiting_for_data',
      rechargeLiters,
      extractionLiters,
      netSurplusLiters,
      netDeficitLiters,
      surplusPercentage,
      node1SampleCount: node1Metrics.sampleCount,
      node2SampleCount: node2Metrics.sampleCount,
      coveragePercentageNode1: node1Metrics.coveragePercentage,
      coveragePercentageNode2: node2Metrics.coveragePercentage,
      message: hasData
        ? `Monitoring in progress for ${todayStr}. Daily credits will be finalized and awarded at midnight Asia/Kolkata.`
        : `Awaiting measured Node 1 and Node 2 packets for today (${todayStr}).`,
    };
  },

  /**
   * Returns a complete Water Credits summary for the dashboard.
   */
  async getSummary(communityId: string, now: Date = new Date()): Promise<WaterCreditSummary> {
    const history = await this.getDailyHistory(communityId, 30);
    const availableCredits = await this.getAvailableBalance(communityId);
    const todayRunning = await this.getTodayRunningStatus(communityId, now);

    const totalRechargeAllTime = history.reduce((sum, h) => sum + h.rechargeLiters, 0);
    const totalExtractionAllTime = history.reduce((sum, h) => sum + h.extractionLiters, 0);

    const latestCompletedDay = history.length > 0 ? history[0] : null;

    return {
      communityId,
      availableCredits,
      totalRechargeLitersAllTime: Math.round(totalRechargeAllTime * 100) / 100,
      totalExtractionLitersAllTime: Math.round(totalExtractionAllTime * 100) / 100,
      latestCompletedDay,
      todayRunning,
      conversionRate: WATER_CREDITS_CONFIG.conversionRate,
      periodType: WATER_CREDITS_CONFIG.periodType,
      formulaVersion: WATER_CREDITS_CONFIG.formulaVersion,
      timezone: WATER_CREDITS_CONFIG.timezone,
      minCoveragePercentRequired: WATER_CREDITS_CONFIG.minCoveragePercent,
      disclaimer: WATER_CREDITS_CONFIG.disclaimer,
    };
  },
};
