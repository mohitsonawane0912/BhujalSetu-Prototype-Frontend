/**
 * Extraction Anomaly Detection for BhujalSetu Node 2 (Extraction Flow)
 *
 * Requirements & Method:
 * 1. Uses ONLY measured Node 2 extraction telemetry (dataSource === 'measured').
 * 2. Requires at least MIN_BASELINE_SAMPLES (default 10) active pumping samples before establishing baseline.
 * 3. Explainable baseline: computes a 10% symmetric trimmed mean of active pumping samples (>= 0.2 L/min)
 *    to eliminate outlier startup or shutdown spikes, alongside sample standard deviation.
 * 4. Configurable threshold: triggers when current flow exceeds baseline by ANOMALY_MULTIPLIER (1.8x)
 *    AND exceeds it by at least MIN_ANOMALY_DELTA_LPM (2.0 L/min) to avoid small baseline jitter.
 * 5. Sensor freshness: checks for stale packets (>45s) separately to prevent misclassifying disconnected nodes.
 * 6. Alert lifecycle: deduplicates ongoing alerts and clears ONLY when distinct new sensor readings
 *    (not repeated API evaluations of the same packet) confirm flow <= 1.3x baseline for >= 2 readings.
 * 7. Clear attribution: describes causes (demand surge, pipeline leak/burst, sensor calibration drift)
 *    as possibilities requiring field inspection, never claiming a confirmed diagnosis.
 *
 * Calibration Limitations:
 * In rural agricultural settings, borewell pumping exhibits diurnal peaks (e.g., morning irrigation rosters)
 * and aquifer drawdown curves over long runtimes. Once real physical ESP32 nodes are installed, thresholds
 * must be calibrated against 24-hour diurnal baselines and seasonal cropping cycles.
 */

import { NodeTelemetryRecord } from './nodeTelemetrySchema';

export interface ExtractionBaselineConfig {
  minBaselineSamples: number;
  anomalyMultiplier: number;
  minAnomalyDeltaLpm: number;
  staleThresholdMs: number;
  clearMultiplier: number;
}

export const DEFAULT_ANOMALY_CONFIG: ExtractionBaselineConfig = {
  minBaselineSamples: 10,
  anomalyMultiplier: 1.8,
  minAnomalyDeltaLpm: 2.0,
  staleThresholdMs: 45_000, // 45 seconds (aligned across backend and frontend)
  clearMultiplier: 1.3,
};

export interface ExtractionAnomalyResult {
  nodeId: 'node-2';
  communityId: string;
  sensorStatus: 'active' | 'stale' | 'no_data';
  baselineStatus: 'established' | 'building_baseline' | 'insufficient_samples';
  sampleCount: number;
  requiredSamples: number;
  baselineFlowLpm: number | null;
  baselineStdDev: number | null;
  currentFlowLpm: number | null;
  latestCapturedAt: string | null;
  timeWindowDescription: string;
  isAnomaly: boolean;
  severity?: 'WATCH' | 'CRITICAL';
  reason?: string;
  possibleCauses?: string[];
  alert?: AnomalyAlertRecord | null;
}

export interface AnomalyAlertRecord {
  id: string;
  severity: 'WATCH' | 'CRITICAL';
  title: string;
  message: string;
  triggerMetric: string;
  thresholdValue: string;
  actualValue: string;
  timestamp: string;
  communityId: string;
  nodeId: string;
  isDismissed?: boolean;
  status: 'ACTIVE' | 'CLEARED';
  clearedAt?: string;
  possibleCauses: string[];
}

// Active anomaly state map: communityId -> active alert record
const activeAnomalyAlerts = new Map<string, AnomalyAlertRecord>();
const normalSampleCountMap = new Map<string, number>();
const lastClearingPacketTimeMap = new Map<string, string>();

export const AnomalyDetector = {
  clearState(): void {
    activeAnomalyAlerts.clear();
    normalSampleCountMap.clear();
    lastClearingPacketTimeMap.clear();
  },

  getActiveAlert(communityId: string): AnomalyAlertRecord | null {
    const alert = activeAnomalyAlerts.get(communityId);
    return alert && alert.status === 'ACTIVE' ? alert : null;
  },

  getAllActiveAlerts(): AnomalyAlertRecord[] {
    return Array.from(activeAnomalyAlerts.values()).filter((a) => a.status === 'ACTIVE');
  },

  /**
   * Evaluates measured Node 2 extraction telemetry against baseline.
   */
  evaluateNode2Extraction(
    records: NodeTelemetryRecord[],
    communityId: string,
    customConfig: Partial<ExtractionBaselineConfig> = {}
  ): ExtractionAnomalyResult {
    const cfg: ExtractionBaselineConfig = { ...DEFAULT_ANOMALY_CONFIG, ...customConfig };

    // 1. Filter for measured Node 2 records for this community, sorting by server arrival (receivedAt)
    const node2Measured = records
      .filter((r) => r.nodeId === 'node-2' && r.dataSource === 'measured' && (!communityId || r.villageId === communityId))
      .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime());

    if (node2Measured.length === 0) {
      return {
        nodeId: 'node-2',
        communityId,
        sensorStatus: 'no_data',
        baselineStatus: 'insufficient_samples',
        sampleCount: 0,
        requiredSamples: cfg.minBaselineSamples,
        baselineFlowLpm: null,
        baselineStdDev: null,
        currentFlowLpm: null,
        latestCapturedAt: null,
        timeWindowDescription: 'No measured Node 2 telemetry recorded yet',
        isAnomaly: false,
      };
    }

    const latest = node2Measured[0];
    const latestTimestamp = latest.receivedAt || latest.capturedAt;
    const latestTime = new Date(latestTimestamp).getTime();
    const now = Date.now();
    const isStale = now - latestTime > cfg.staleThresholdMs;

    // 2. Separate sensor freshness check
    if (isStale) {
      // If sensor stopped, clear any previously active high-extraction anomaly (node is disconnected)
      if (activeAnomalyAlerts.has(communityId)) {
        const prev = activeAnomalyAlerts.get(communityId)!;
        if (prev.status === 'ACTIVE') {
          prev.status = 'CLEARED';
          prev.clearedAt = new Date().toISOString();
        }
      }

      return {
        nodeId: 'node-2',
        communityId,
        sensorStatus: 'stale',
        baselineStatus: 'insufficient_samples',
        sampleCount: node2Measured.length,
        requiredSamples: cfg.minBaselineSamples,
        baselineFlowLpm: null,
        baselineStdDev: null,
        currentFlowLpm: latest.flow.flowLpm,
        latestCapturedAt: latest.capturedAt,
        timeWindowDescription: `Sensor offline or telemetry stale (>45s since last packet; ${Math.round((now - latestTime) / 1000)}s elapsed)`,
        isAnomaly: false,
        reason: 'Node 2 telemetry is stale (>45s). Sensor offline or wireless packet gap detected.',
      };
    }

    // 3. Compute baseline over historical active samples excluding the immediate reading under test
    // Consider active pumping flows (> 0.2 L/min) to establish normal operating rate
    const historicalSamples = node2Measured.slice(1);
    const activeHistorical = historicalSamples.filter((r) => r.flow.flowLpm >= 0.2);

    if (activeHistorical.length < cfg.minBaselineSamples) {
      return {
        nodeId: 'node-2',
        communityId,
        sensorStatus: 'active',
        baselineStatus: 'building_baseline',
        sampleCount: activeHistorical.length,
        requiredSamples: cfg.minBaselineSamples,
        baselineFlowLpm: null,
        baselineStdDev: null,
        currentFlowLpm: latest.flow.flowLpm,
        latestCapturedAt: latest.capturedAt,
        timeWindowDescription: `Baseline warm-up: ${activeHistorical.length}/${cfg.minBaselineSamples} active samples collected`,
        isAnomaly: false,
      };
    }

    // 10% symmetric trimmed mean of active pumping samples
    const sortedFlows = [...activeHistorical.map((r) => r.flow.flowLpm)].sort((a, b) => a - b);
    const trimCount = Math.max(1, Math.floor(sortedFlows.length * 0.10));
    const centralFlows = sortedFlows.slice(trimCount, sortedFlows.length - trimCount);
    const meanFlow = centralFlows.reduce((sum, v) => sum + v, 0) / centralFlows.length;
    const variance =
      centralFlows.reduce((sum, v) => sum + Math.pow(v - meanFlow, 2), 0) /
      (centralFlows.length > 1 ? centralFlows.length - 1 : 1);
    const stdDev = Math.sqrt(variance);

    const currentFlow = latest.flow.flowLpm;
    const flowRatio = meanFlow > 0 ? currentFlow / meanFlow : 1.0;
    const flowDelta = currentFlow - meanFlow;

    // Check if current flow exceeds threshold: ratio >= ANOMALY_MULTIPLIER AND delta >= MIN_ANOMALY_DELTA_LPM
    const isAnomalyTriggered = currentFlow > 0.2 && flowRatio >= cfg.anomalyMultiplier && flowDelta >= cfg.minAnomalyDeltaLpm;

    const earliestHistorical = activeHistorical[activeHistorical.length - 1];
    const windowStart = new Date(earliestHistorical.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const windowEnd = new Date(latest.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const timeWindowDescription = `Established from ${activeHistorical.length} samples between ${windowStart} and ${windowEnd} (10% trimmed mean: ${meanFlow.toFixed(2)} L/min, σ: ${stdDev.toFixed(2)})`;

    const possibleCauses = [
      'Unusual sudden community or agricultural demand surge',
      'Distribution pipe leak, crack, or burst downstream of Node 2 flow meter',
      'Flow sensor turbine blockage or calibration drift requiring bench inspection',
    ];

    if (isAnomalyTriggered) {
      normalSampleCountMap.set(communityId, 0);
      lastClearingPacketTimeMap.delete(communityId);
      const severity: 'WATCH' | 'CRITICAL' = flowRatio >= 2.5 ? 'CRITICAL' : 'WATCH';
      const reason = `Measured extraction rate of ${currentFlow.toFixed(2)} L/min is ${(flowRatio * 100 - 100).toFixed(0)}% above normal operating baseline (${meanFlow.toFixed(2)} L/min).`;

      // Deduplicate: update existing active alert or create new one
      let alert = activeAnomalyAlerts.get(communityId);
      if (!alert || alert.status !== 'ACTIVE') {
        alert = {
          id: `anomaly-node2-${communityId}-${Date.now()}`,
          severity,
          title: 'Unusually High Extraction Detected (Node 2)',
          message: `${reason} Physical inspection of downstream pipes and pumping schedule recommended.`,
          triggerMetric: 'Node 2 Extraction Flow Rate',
          thresholdValue: `> ${(meanFlow * cfg.anomalyMultiplier).toFixed(2)} L/min (${cfg.anomalyMultiplier}x baseline)`,
          actualValue: `${currentFlow.toFixed(2)} L/min (+${(flowRatio * 100 - 100).toFixed(0)}%)`,
          timestamp: new Date(latest.capturedAt).toISOString(),
          communityId,
          nodeId: 'node-2',
          status: 'ACTIVE',
          possibleCauses,
        };
        activeAnomalyAlerts.set(communityId, alert);
      } else {
        // Ongoing alert: refresh current value without spamming duplicate objects
        alert.actualValue = `${currentFlow.toFixed(2)} L/min (+${(flowRatio * 100 - 100).toFixed(0)}%)`;
        alert.timestamp = new Date(latest.capturedAt).toISOString();
      }

      return {
        nodeId: 'node-2',
        communityId,
        sensorStatus: 'active',
        baselineStatus: 'established',
        sampleCount: activeHistorical.length,
        requiredSamples: cfg.minBaselineSamples,
        baselineFlowLpm: Math.round(meanFlow * 100) / 100,
        baselineStdDev: Math.round(stdDev * 100) / 100,
        currentFlowLpm: Math.round(currentFlow * 100) / 100,
        latestCapturedAt: latest.capturedAt,
        timeWindowDescription,
        isAnomaly: true,
        severity,
        reason,
        possibleCauses,
        alert,
      };
    }

    // If flow is normal, check whether an active alert needs to clear
    const activeAlert = activeAnomalyAlerts.get(communityId);
    if (activeAlert && activeAlert.status === 'ACTIVE') {
      const isNormal = currentFlow <= meanFlow * cfg.clearMultiplier || currentFlow < 0.2;
      if (isNormal) {
        // Ensure clearing counts distinct new sensor readings, not repeated API evaluations of the same packet
        const lastPacketTime = lastClearingPacketTimeMap.get(communityId);
        const packetTimestamp = latest.receivedAt || latest.capturedAt;
        if (packetTimestamp !== lastPacketTime) {
          lastClearingPacketTimeMap.set(communityId, packetTimestamp);
          const normalCount = (normalSampleCountMap.get(communityId) || 0) + 1;
          normalSampleCountMap.set(communityId, normalCount);

          // Clears when at least 2 distinct consecutive normal readings arrive
          if (normalCount >= 2) {
            activeAlert.status = 'CLEARED';
            activeAlert.clearedAt = new Date().toISOString();
          }
        }
      } else {
        normalSampleCountMap.set(communityId, 0);
        lastClearingPacketTimeMap.delete(communityId);
      }
    }

    return {
      nodeId: 'node-2',
      communityId,
      sensorStatus: 'active',
      baselineStatus: 'established',
      sampleCount: activeHistorical.length,
      requiredSamples: cfg.minBaselineSamples,
      baselineFlowLpm: Math.round(meanFlow * 100) / 100,
      baselineStdDev: Math.round(stdDev * 100) / 100,
      currentFlowLpm: Math.round(currentFlow * 100) / 100,
      latestCapturedAt: latest.capturedAt,
      timeWindowDescription,
      isAnomaly: false,
      alert: activeAlert && activeAlert.status === 'ACTIVE' ? activeAlert : null,
    };
  },
};
