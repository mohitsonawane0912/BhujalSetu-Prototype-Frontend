import { ValidatedTelemetry } from './telemetryValidator';
import { NodeTelemetryRepository } from './nodeTelemetryRepository';

export const FLOW_PULSES_PER_LITER = 450.0;
export const WINDOW_DURATION_MS = 60_000; // 60-second aligned time window

export interface TelemetryRecord {
  id: string;
  deviceId: string;
  villageId: string;
  timestamp: string;
  dataSource: 'measured' | 'simulated';
  tankLevelPercent: number;
  tankDistanceCm: number;
  flowInLpm: number;
  flowOutLpm: number;
  flowInLitersTotal: number;
  flowOutLitersTotal: number;
  pumpEnabled: boolean;
  receivedAt: string;
}

const legacyTelemetryStore: TelemetryRecord[] = [];

export interface BackendGroundwaterStatus {
  timestamp: string;
  depthMeters: number | null;
  historicalBaselineMeters: number | null;
  changeMeters: number | null;
  status: 'NORMAL' | 'WATCH' | 'CRITICAL' | 'UNMEASURED';
  wellId: string;
  locationName: string;
  hasLiveTelemetry: boolean;
  message: string;
}

export interface BackendWaterBalance {
  period: 'daily' | 'weekly' | 'monthly';
  dateLabel: string;
  hasLiveTelemetry: boolean;
  isPrototypeMeasured: boolean;
  status: 'measured' | 'waiting_for_devices';
  inputs: {
    rainfallInfiltrationLiters: number;
    managedRechargeLiters: number;
    subsurfaceInflowLiters: number;
    totalInputsLiters: number;
  } | null;
  outputs: {
    borewellExtractionLiters: number;
    communityUsageLiters: number;
    otherAgriculturalExtractionLiters: number;
    totalOutputsLiters: number;
  } | null;
  netBalanceLiters: number | null;
  netBalanceM3: number | null;
  alignedWindowsCount: number;
  message?: string;
  disclaimer: string;
}

export const TelemetryService = {
  clearLegacyStore(): void {
    legacyTelemetryStore.length = 0;
  },

  async processIncomingTelemetry(input: ValidatedTelemetry): Promise<{
    record: TelemetryRecord;
    alertsTriggered: string[];
  }> {
    const id = `legacy_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const record: TelemetryRecord = {
      ...input,
      id,
      timestamp: input.timestamp || new Date().toISOString(),
      receivedAt: new Date().toISOString(),
    };
    legacyTelemetryStore.unshift(record);

    const alertsTriggered: string[] = [];
    if (input.tankLevelPercent <= 10) alertsTriggered.push('Prototype tank level is at or below 10%.');
    return { record, alertsTriggered };
  },

  async getLatestPrototypeTelemetry(villageId?: string): Promise<TelemetryRecord | null> {
    if (villageId) {
      const match = legacyTelemetryStore.find((r) => r.villageId === villageId);
      if (match) return match;
    }
    return legacyTelemetryStore[0] || null;
  },

  async getGroundwaterStatus(_villageId?: string): Promise<BackendGroundwaterStatus> {
    // A tabletop reservoir is not a groundwater monitoring well. Tabletop sensors
    // cannot measure deep aquifer depth. No fixed or simulated depths are presented.
    return {
      timestamp: new Date().toISOString(),
      depthMeters: null,
      historicalBaselineMeters: null,
      changeMeters: null,
      status: 'UNMEASURED',
      wellId: 'COMMUNITY-PIEZOMETER-NONE',
      locationName: 'No Physical Piezometer (Tabletop Sensor Phase)',
      hasLiveTelemetry: false,
      message:
        'Tabletop prototype sensors measure tank level and bench flow only; they do not measure deep aquifer depth. Aquifer monitoring requires certified piezometer field instruments.',
    };
  },

  async getWaterBalance(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    villageId?: string
  ): Promise<BackendWaterBalance> {
    const targetVillage = villageId || 'village-rampur-04';
    let recentRecords: any[] = [];
    try {
      recentRecords = await NodeTelemetryRepository.list(targetVillage, 100);
    } catch {
      recentRecords = [];
    }

    const measuredRecords = recentRecords.filter((r) => r.dataSource === 'measured');

    // Group measured records into fixed aligned windows (60s)
    const windowMap = new Map<string, { node1: any[]; node2: any[] }>();
    for (const record of measuredRecords) {
      const timeMs = new Date(record.capturedAt).getTime();
      const windowStartMs = Math.floor(timeMs / WINDOW_DURATION_MS) * WINDOW_DURATION_MS;
      const windowKey = new Date(windowStartMs).toISOString();
      if (!windowMap.has(windowKey)) {
        windowMap.set(windowKey, { node1: [], node2: [] });
      }
      const entry = windowMap.get(windowKey)!;
      if (record.nodeId === 'node-1') entry.node1.push(record);
      else if (record.nodeId === 'node-2') entry.node2.push(record);
    }

    // Keep only windows where BOTH Node 1 and Node 2 have valid measured records
    const pairedWindows: Array<{
      windowKey: string;
      rechargeLiters: number;
      extractionLiters: number;
      netLiters: number;
    }> = [];

    for (const [windowKey, { node1, node2 }] of windowMap.entries()) {
      if (node1.length > 0 && node2.length > 0) {
        const rechargeLiters = node1.reduce((sum, r) => sum + r.flow.pulses / FLOW_PULSES_PER_LITER, 0);
        const extractionLiters = node2.reduce((sum, r) => sum + r.flow.pulses / FLOW_PULSES_PER_LITER, 0);
        pairedWindows.push({
          windowKey,
          rechargeLiters,
          extractionLiters,
          netLiters: rechargeLiters - extractionLiters,
        });
      }
    }

    // If no paired measured windows exist, return honest waiting state with NO fabricated numbers
    if (pairedWindows.length === 0) {
      return {
        period,
        dateLabel: 'Awaiting Paired Measured Readings',
        hasLiveTelemetry: false,
        isPrototypeMeasured: false,
        status: 'waiting_for_devices',
        inputs: null,
        outputs: null,
        netBalanceLiters: null,
        netBalanceM3: null,
        alignedWindowsCount: 0,
        message:
          'Waiting for synchronized Node 1 (recharge) and Node 2 (extraction) measured packets. No fabricated or simulated numbers are displayed.',
        disclaimer:
          'Prototype measured comparison requires active streaming from both calibrated ESP32 nodes across aligned time windows. This is tabletop telemetry, not a village aquifer balance.',
      };
    }

    const totalRecharge = pairedWindows.reduce((sum, w) => sum + w.rechargeLiters, 0);
    const totalExtraction = pairedWindows.reduce((sum, w) => sum + w.extractionLiters, 0);
    const netBalance = totalRecharge - totalExtraction;

    return {
      period,
      dateLabel: `Measured Prototype Interval (${pairedWindows.length} paired window${pairedWindows.length === 1 ? '' : 's'})`,
      hasLiveTelemetry: true,
      isPrototypeMeasured: true,
      status: 'measured',
      inputs: {
        rainfallInfiltrationLiters: 0,
        managedRechargeLiters: Math.round(totalRecharge * 1000) / 1000,
        subsurfaceInflowLiters: 0,
        totalInputsLiters: Math.round(totalRecharge * 1000) / 1000,
      },
      outputs: {
        borewellExtractionLiters: Math.round(totalExtraction * 1000) / 1000,
        communityUsageLiters: 0,
        otherAgriculturalExtractionLiters: 0,
        totalOutputsLiters: Math.round(totalExtraction * 1000) / 1000,
      },
      netBalanceLiters: Math.round(netBalance * 1000) / 1000,
      netBalanceM3: Math.round((netBalance / 1000) * 10000) / 10000,
      alignedWindowsCount: pairedWindows.length,
      disclaimer:
        'Measured tabletop comparison (Node 1 recharge vs Node 2 extraction) across aligned time windows. This tabletop demonstration is not a village-wide aquifer balance.',
    };
  },

  async getTrends(_range: '7d' | '30d' | '90d' = '30d', _villageId?: string) {
    // Tabletop sensors do not measure aquifer depth or rainfall. Return empty array
    // so no simulated trends are returned as live history.
    return [];
  },
};
