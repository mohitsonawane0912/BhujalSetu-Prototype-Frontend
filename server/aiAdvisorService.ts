/**
 * AI Groundwater Intelligence Advisor Service for BhujalSetu
 *
 * Implements the 4 Structured Advice Levels from Pitch Deck Slide 12:
 * - NORMAL_USE
 * - CONSERVE_WATER
 * - CRITICAL_CONSERVATION
 * - PREPARE_RECHARGE
 * (Plus WAITING_FOR_DATA when insufficient measured telemetry exists)
 *
 * Requirements & Invariants:
 * 1. Protected endpoint: loads authorized telemetry and context server-side.
 * 2. Tabletop ultrasonic sensor measures tabletop tank level (cm), NEVER described as groundwater depth.
 * 3. Groundwater depth is marked UNMEASURED until a calibrated piezometer is connected.
 * 4. Weather forecast fetched from external Weather API (Open-Meteo) with attributed source, location, and freshness.
 * 5. Seasonal context determined via IMD agro-climatic calendar rules.
 * 6. Extraction anomaly evaluated via Node 2 measured baseline.
 * 7. When GEMINI_API_KEY is present, enhances synthesis; otherwise, uses deterministic hydrological rules.
 */

import { GoogleGenAI } from '@google/genai';
import { config } from './config';
import { NodeTelemetryRepository } from './nodeTelemetryRepository';
import { WeatherService, WeatherForecast } from './weatherService';
import { AnomalyDetector, ExtractionAnomalyResult } from './anomalyDetector';
import { AuthService } from './authService';
import { query } from './db/postgres';

export const TELEMETRY_STALE_THRESHOLD_MS = 45_000; // 45 seconds (aligned across system)

export type AdviceLevel =
  | 'NORMAL_USE'
  | 'CONSERVE_WATER'
  | 'CRITICAL_CONSERVATION'
  | 'PREPARE_RECHARGE'
  | 'WAITING_FOR_DATA';

export interface AdvisorEvidence {
  groundwater: {
    status: 'UNMEASURED' | 'MEASURED';
    value: string;
    source: string;
    freshness: string;
    limitationNote: string;
  };
  nodeTelemetry: {
    status: 'measured' | 'waiting_for_devices' | 'incomplete' | 'stale';
    node1Status: 'live' | 'stale' | 'missing';
    node2Status: 'live' | 'stale' | 'missing';
    node1Freshness: string;
    node2Freshness: string;
    rechargeFlowLpm: number | null;
    rechargeTotalLiters: number | null;
    extractionFlowLpm: number | null;
    extractionTotalLiters: number | null;
    tankLevelCm: number | null;
    tankDistanceCm: number | null;
    windowDuration: string;
    sampleCount: number;
    averageRechargeFlowLpm: number | null;
    averageExtractionFlowLpm: number | null;
    source: string;
    freshness: string;
    limitationNote?: string;
  };
  weather: WeatherForecast;
  seasonal: {
    seasonName: string;
    calendarPeriod: string;
    ruleSource: string;
    guidance: string;
  };
  anomaly: {
    detected: boolean;
    severity?: 'WATCH' | 'CRITICAL';
    reason?: string;
    baselineLpm?: number;
    measuredLpm?: number;
    possibleCauses?: string[];
  };
}

export interface AiAdvisorResponse {
  success: boolean;
  level: AdviceLevel;
  headline: string;
  explanation: string;
  recommendedAction: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: AdvisorEvidence;
  synthesisSource: 'gemini' | 'deterministic_hydrological_rules';
  dataQualityNote: string;
  generatedAt: string;
  nextReviewAt?: string;
}

/**
 * Returns IMD seasonal agro-climatic context for Indian aquifers.
 */
export function getSeasonalContext(date: Date = new Date()): {
  seasonName: string;
  calendarPeriod: string;
  ruleSource: string;
  guidance: string;
  isMonsoon: boolean;
  isDrySeason: boolean;
} {
  const month = date.getMonth(); // 0 = Jan, 11 = Dec

  // June (5) to September (8): South-West Monsoon
  if (month >= 5 && month <= 8) {
    return {
      seasonName: 'South-West Monsoon (Active Inflow)',
      calendarPeriod: 'June 1 – September 30',
      ruleSource: 'India Meteorological Department (IMD) Agro-Climatic Seasonal Calendar',
      guidance: 'Monsoon precipitation window. Focus Pani Samiti operations on maximizing recharge shaft filtration and desilting bunds.',
      isMonsoon: true,
      isDrySeason: false,
    };
  }

  // October (9) to November (10): Post-Monsoon / Autumn
  if (month >= 9 && month <= 10) {
    return {
      seasonName: 'Post-Monsoon (Recharge Stabilization)',
      calendarPeriod: 'October 1 – November 30',
      ruleSource: 'India Meteorological Department (IMD) Agro-Climatic Seasonal Calendar',
      guidance: 'Surface runoff receding. Establish baseline aquifer storage before rabi agricultural pumping commences.',
      isMonsoon: false,
      isDrySeason: false,
    };
  }

  // December (11) to February (1): Winter / Rabi Crop Season
  if (month === 11 || month <= 1) {
    return {
      seasonName: 'Winter / Rabi Season (Intensive Extraction)',
      calendarPeriod: 'December 1 – February 28/29',
      ruleSource: 'India Meteorological Department (IMD) Agro-Climatic Seasonal Calendar',
      guidance: 'High agricultural crop water demand for rabi crops. Strict rotational pumping rosters required to prevent localized drawdown cones.',
      isMonsoon: false,
      isDrySeason: true,
    };
  }

  // March (2) to May (4): Pre-Monsoon / Summer Dry Period
  return {
    seasonName: 'Pre-Monsoon / Summer (Peak Drought Stress)',
    calendarPeriod: 'March 1 – May 31',
    ruleSource: 'India Meteorological Department (IMD) Agro-Climatic Seasonal Calendar',
    guidance: 'Maximum evaporation and deepest water table levels. Restrict non-essential water usage and protect drinking water reserves.',
    isMonsoon: false,
    isDrySeason: true,
  };
}

const ADVISOR_REVIEW_INTERVAL_MS = 24 * 60 * 60 * 1000;
const pendingAdvice = new Map<string, Promise<AiAdvisorResponse>>();

async function refreshCachedTelemetry(communityId: string, cached: AiAdvisorResponse): Promise<AiAdvisorResponse> {
  const records = await NodeTelemetryRepository.list(communityId, 100);
  const latestForNode = (nodeId: string) => records
    .filter((record) => record.nodeId === nodeId && record.dataSource === 'measured')
    .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime())[0] || null;
  const node1 = latestForNode('node-1');
  const node2 = latestForNode('node-2');
  const now = Date.now();
  const age = (record: any) => record ? now - new Date(record.receivedAt || record.capturedAt).getTime() : null;
  const age1 = age(node1);
  const age2 = age(node2);
  const status = (record: any, ageMs: number | null) => !record ? 'missing' as const : ageMs === null || ageMs > TELEMETRY_STALE_THRESHOLD_MS ? 'stale' as const : 'live' as const;
  const node1Status = status(node1, age1);
  const node2Status = status(node2, age2);
  const staleText = (nodeName: string, ageMs: number | null, nodeStatus: string) =>
    nodeStatus === 'missing' ? `${nodeName} missing (no packets received)` :
    nodeStatus === 'stale' ? `Stale (last packet received ${Math.max(0, Math.round((ageMs || 0) / 1000))}s ago; >45s threshold)` :
    `Live (${Math.max(0, Math.round((ageMs || 0) / 1000))}s ago)`;
  const node1Freshness = staleText('Node 1', age1, node1Status);
  const node2Freshness = staleText('Node 2', age2, node2Status);
  const incomplete = node1Status !== 'live' || node2Status !== 'live';
  const refreshed: AiAdvisorResponse = {
    ...cached,
    evidence: {
      ...cached.evidence,
      nodeTelemetry: {
        ...cached.evidence.nodeTelemetry,
        status: node1Status === 'missing' && node2Status === 'missing' ? 'waiting_for_devices' :
          node1Status === 'missing' || node2Status === 'missing' ? 'incomplete' : incomplete ? 'stale' : 'measured',
        node1Status,
        node2Status,
        node1Freshness,
        node2Freshness,
        freshness: `Node 1: ${node1Freshness} • Node 2: ${node2Freshness}`,
        rechargeFlowLpm: node1?.flow.flowLpm ?? null,
        rechargeTotalLiters: node1?.flow.totalLiters ?? null,
        extractionFlowLpm: node2?.flow.flowLpm ?? null,
        extractionTotalLiters: node2?.flow.totalLiters ?? null,
        tankLevelCm: node1?.waterLevel?.levelCm ?? null,
        tankDistanceCm: node1?.waterLevel?.distanceCm ?? null,
        limitationNote: incomplete ? 'The stored 24-hour decision is retained, but one or both nodes are currently missing or stale. Current readings cannot be treated as live.' : undefined,
      },
    },
  };

  // Freshness changes are a safety gate, not a new AI decision.
  if (incomplete) {
    refreshed.level = 'WAITING_FOR_DATA';
    refreshed.urgency = 'LOW';
    refreshed.synthesisSource = 'deterministic_hydrological_rules';
    refreshed.headline = 'Waiting for Current Sensor Data';
    refreshed.explanation = `The latest daily decision is retained, but current paired telemetry is unavailable. Node 1: ${node1Freshness}. Node 2: ${node2Freshness}.`;
    refreshed.recommendedAction = 'Restore both ESP32 connections. The daily water decision will remain fixed until its next review.';
  }
  return refreshed;
}

export const AiAdvisorService = {
  /**
   * Returns one persisted decision per community for 24 hours. Routine dashboard polls
   * reuse it; only the live sensor freshness gate is checked on cache hits.
   */
  async generateAdvice(communityId: string): Promise<AiAdvisorResponse> {
    if (process.env.NODE_ENV === 'test') return this.buildAndCacheAdvice(communityId);
    const existing = pendingAdvice.get(communityId);
    if (existing) return existing;

    const work = (async () => {
      const cached = await query<{ response: AiAdvisorResponse }>(
        'SELECT response FROM community_advisor_snapshots WHERE community_id = $1 AND expires_at > NOW()',
        [communityId]
      );
      if (cached.rows.length) {
        const payload = typeof cached.rows[0].response === 'string'
          ? JSON.parse(cached.rows[0].response as unknown as string) as AiAdvisorResponse
          : cached.rows[0].response;
        return refreshCachedTelemetry(communityId, payload);
      }

      const response = await this.buildAndCacheAdvice(communityId);
      if (response.level !== 'WAITING_FOR_DATA') {
        const expiresAt = new Date(Date.parse(response.generatedAt) + ADVISOR_REVIEW_INTERVAL_MS).toISOString();
        const stored = { ...response, nextReviewAt: expiresAt };
        await query(
          `INSERT INTO community_advisor_snapshots (community_id, generated_at, expires_at, response)
           VALUES ($1, $2, $3, $4::jsonb)
           ON CONFLICT (community_id) DO UPDATE SET generated_at = EXCLUDED.generated_at,
             expires_at = EXCLUDED.expires_at, response = EXCLUDED.response`,
          [communityId, response.generatedAt, expiresAt, JSON.stringify(stored)]
        );
        response.nextReviewAt = expiresAt;
      }
      return response;
    })();
    pendingAdvice.set(communityId, work);
    try {
      return await work;
    } finally {
      pendingAdvice.delete(communityId);
    }
  },

  /** Builds a fresh daily decision from the previous 24 hours of measured telemetry. */
  async buildAndCacheAdvice(communityId: string): Promise<AiAdvisorResponse> {
    const generatedAt = new Date().toISOString();

    // 1. Resolve community coordinates strictly from the actual community record (no hardcoded fallback)
    let lat: number | null = null;
    let lon: number | null = null;
    let locationName = communityId;

    const comm = await AuthService.getCommunityById(communityId);
    if (comm) {
      locationName = comm.name + (comm.district || comm.state ? ` (${comm.district || ''}, ${comm.state || ''})` : '');
      if (comm.latitude != null && comm.longitude != null && !isNaN(comm.latitude) && !isNaN(comm.longitude)) {
        lat = comm.latitude;
        lon = comm.longitude;
      }
    }

    // 2. Fetch external weather forecast (returns unconfigured if coordinates are missing)
    const weather = await WeatherService.getForecast(lat, lon, locationName);

    // 3. Load recent measured node telemetry from Postgres/Repository
    let records: any[] = [];
    try {
      records = await NodeTelemetryRepository.list(communityId, 100);
    } catch {
      records = [];
    }

    const measuredRecords = records.filter((r) => r.dataSource === 'measured');
    const node1Records = measuredRecords
      .filter((r) => r.nodeId === 'node-1')
      .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime());
    const node2Records = measuredRecords
      .filter((r) => r.nodeId === 'node-2')
      .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime());

    const n1Latest = node1Records[0] || null;
    const n2Latest = node2Records[0] || null;

    // 4. Run Anomaly Detection on Node 2 measured extraction
    const anomalyResult: ExtractionAnomalyResult = AnomalyDetector.evaluateNode2Extraction(
      measuredRecords,
      communityId
    );

    // 5. Evaluate Node 1 & Node 2 presence, freshness, and usability using server arrival clock (receivedAt)
    const now = Date.now();
    const n1Time = n1Latest ? new Date(n1Latest.receivedAt || n1Latest.capturedAt).getTime() : null;
    const n2Time = n2Latest ? new Date(n2Latest.receivedAt || n2Latest.capturedAt).getTime() : null;

    const n1AgeMs = n1Time !== null ? now - n1Time : null;
    const n2AgeMs = n2Time !== null ? now - n2Time : null;

    const n1Stale = n1AgeMs !== null && n1AgeMs > TELEMETRY_STALE_THRESHOLD_MS;
    const n2Stale = n2AgeMs !== null && n2AgeMs > TELEMETRY_STALE_THRESHOLD_MS;

    const node1Status: 'live' | 'stale' | 'missing' = !n1Latest ? 'missing' : n1Stale ? 'stale' : 'live';
    const node2Status: 'live' | 'stale' | 'missing' = !n2Latest ? 'missing' : n2Stale ? 'stale' : 'live';

    const node1Freshness = !n1Latest
      ? 'Node 1 missing (no packets received)'
      : n1Stale
      ? `Stale (last packet received ${Math.round(n1AgeMs! / 1000)}s ago; >45s threshold)`
      : `Live (${Math.round(n1AgeMs! / 1000)}s ago)`;

    const node2Freshness = !n2Latest
      ? 'Node 2 missing (no packets received)'
      : n2Stale
      ? `Stale (last packet received ${Math.round(n2AgeMs! / 1000)}s ago; >45s threshold)`
      : `Live (${Math.round(n2AgeMs! / 1000)}s ago)`;

    const hasNode1 = Boolean(n1Latest);
    const hasNode2 = Boolean(n2Latest);
    const isMissingNode = !hasNode1 || !hasNode2;
    const isStaleNode = n1Stale || n2Stale;
    const isTelemetryIncomplete = isMissingNode || isStaleNode;

    let telemetryStatus: 'measured' | 'waiting_for_devices' | 'incomplete' | 'stale' = 'waiting_for_devices';
    if (!hasNode1 && !hasNode2) {
      telemetryStatus = 'waiting_for_devices';
    } else if (isMissingNode) {
      telemetryStatus = 'incomplete';
    } else if (isStaleNode) {
      telemetryStatus = 'stale';
    } else {
      telemetryStatus = 'measured';
    }

    const sampleCount = measuredRecords.length;
    const windowDuration = 'Rolling last 24 hours';
    const averageFlow = (nodeRecords: any[]) => nodeRecords.length
      ? nodeRecords.reduce((sum, record) => sum + record.flow.flowLpm, 0) / nodeRecords.length
      : null;
    const averageRechargeFlowLpm = averageFlow(node1Records);
    const averageExtractionFlowLpm = averageFlow(node2Records);

    // Node flow metrics
    const rechargeFlowLpm = n1Latest ? n1Latest.flow.flowLpm : null;
    const rechargeTotalLiters = n1Latest ? n1Latest.flow.totalLiters : null;
    const extractionFlowLpm = n2Latest ? n2Latest.flow.flowLpm : null;
    const extractionTotalLiters = n2Latest ? n2Latest.flow.totalLiters : null;
    const tankLevelCm = n1Latest?.waterLevel ? n1Latest.waterLevel.levelCm : null;
    const tankDistanceCm = n1Latest?.waterLevel ? n1Latest.waterLevel.distanceCm : null;

    // 6. Seasonal context
    const seasonal = getSeasonalContext();

    // 7. Evidence Assembly
    const evidence: AdvisorEvidence = {
      groundwater: {
        status: 'UNMEASURED',
        value: 'Piezometer Telemetry Offline',
        source: 'Certified Borewell Piezometer Network',
        freshness: 'No active telemetry',
        limitationNote:
          'Ultrasonic sensor on ESP32 Node 1 monitors bench demonstration tank level only. Tabletop water depth is not aquifer groundwater depth.',
      },
      nodeTelemetry: {
        status: telemetryStatus,
        node1Status,
        node2Status,
        node1Freshness,
        node2Freshness,
        rechargeFlowLpm,
        rechargeTotalLiters,
        extractionFlowLpm,
        extractionTotalLiters,
        tankLevelCm,
        tankDistanceCm,
        windowDuration,
        sampleCount,
        averageRechargeFlowLpm,
        averageExtractionFlowLpm,
        source: 'ESP32 Hardware Nodes (Node 1 & Node 2)',
        freshness: `Node 1: ${node1Freshness} • Node 2: ${node2Freshness}`,
        limitationNote: isTelemetryIncomplete
          ? 'Telemetry is incomplete or stale. Both nodes must stream live, non-stale packets for confident advice classification.'
          : undefined,
      },
      weather,
      seasonal,
      anomaly: {
        detected: anomalyResult.isAnomaly || anomalyResult.alert?.status === 'ACTIVE',
        severity: anomalyResult.severity || anomalyResult.alert?.severity,
        reason: anomalyResult.reason || anomalyResult.alert?.message,
        baselineLpm: anomalyResult.baselineFlowLpm || undefined,
        measuredLpm: anomalyResult.currentFlowLpm || undefined,
        possibleCauses: anomalyResult.possibleCauses || anomalyResult.alert?.possibleCauses,
      },
    };

    // 8. Deterministic Classification of Advice Level (Slide 12 of Pitch Deck)
    let level: AdviceLevel = 'NORMAL_USE';
    let urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let headline = '';
    let explanation = '';
    let recommendedAction = '';

    // Condition A: Incomplete, missing, or stale telemetry -> WAITING_FOR_DATA
    if (isTelemetryIncomplete) {
      level = 'WAITING_FOR_DATA';
      urgency = 'LOW';
      if (!hasNode1 && !hasNode2) {
        headline = 'Awaiting Both Prototype Sensor Nodes';
        explanation =
          'Both Node 1 (recharge line & tank level) and Node 2 (extraction line) must stream authenticated measured packets to evaluate community water intelligence. Neither node has transmitted telemetry yet.';
        recommendedAction =
          'Power on ESP32 Node 1 and Node 2 and verify authenticated Wi-Fi connection to the local backend.';
      } else if (!hasNode1) {
        headline = 'Incomplete Telemetry: Awaiting Node 1 (Recharge)';
        explanation =
          'Node 2 (extraction) is active, but Node 1 (recharge line & reservoir level) has not transmitted readings. The AI Advisor does not treat missing recharge flow as zero.';
        recommendedAction =
          'Check Node 1 power supply and verify YF-S201 flow and HC-SR04 ultrasonic sensors are connected.';
      } else if (!hasNode2) {
        headline = 'Incomplete Telemetry: Awaiting Node 2 (Extraction)';
        explanation =
          'Node 1 (recharge) is active, but Node 2 (extraction line) has not transmitted readings. The AI Advisor does not treat missing extraction flow as zero.';
        recommendedAction =
          'Check Node 2 power supply and verify extraction pump line sensor is transmitting packets.';
      } else if (n1Stale && n2Stale) {
        headline = 'Telemetry Stale: Both Sensor Nodes Offline';
        explanation =
          'Packets from both Node 1 and Node 2 are stale (>45 seconds old). Stale historical readings cannot be used to determine a confident advice level.';
        recommendedAction =
          'Verify Wi-Fi connectivity and power to both ESP32 hardware nodes to resume real-time telemetry.';
      } else if (n1Stale) {
        headline = 'Telemetry Stale: Node 1 (Recharge) Offline';
        explanation =
          `Node 1 packet is stale (${Math.round(n1AgeMs! / 1000)}s old). Live bench recharge flow and reservoir water level cannot be confirmed.`;
        recommendedAction =
          'Inspect Node 1 hardware connection to restore synchronized paired telemetry.';
      } else {
        headline = 'Telemetry Stale: Node 2 (Extraction) Offline';
        explanation =
          `Node 2 packet is stale (${Math.round(n2AgeMs! / 1000)}s old). Live extraction flow cannot be verified.`;
        recommendedAction =
          'Inspect Node 2 hardware connection to restore synchronized paired telemetry.';
      }
    }
    // Condition B: Anomaly detected (or active in recovery) or tank critically depleted -> CRITICAL_CONSERVATION
    else if (anomalyResult.isAnomaly || anomalyResult.alert?.status === 'ACTIVE' || (tankLevelCm !== null && tankLevelCm < 5.0)) {
      level = 'CRITICAL_CONSERVATION';
      urgency = 'CRITICAL';
      if (anomalyResult.isAnomaly || anomalyResult.alert?.status === 'ACTIVE') {
        headline = 'Critical Alert: Extraction Anomaly Detected on Node 2';
        explanation = anomalyResult.isAnomaly
          ? `Node 2 measured extraction rate of ${extractionFlowLpm?.toFixed(2)} L/min exceeds baseline normal by ${(
              ((extractionFlowLpm || 0) / (anomalyResult.baselineFlowLpm || 1)) * 100 -
              100
            ).toFixed(0)}%. ${anomalyResult.reason}`
          : `Node 2 extraction alert remains ACTIVE during recovery. ${anomalyResult.alert?.message || anomalyResult.reason}`;
        recommendedAction =
          'Dispatch field inspection immediately: verify potential pipeline burst, unmetered drawdowns, or flow sensor drift. Maintain conservation until alert clears.';
      } else {
        headline = 'Critical Alert: Tabletop Tank Level Critically Depleted';
        explanation = `Demonstration tank water level has dropped to ${tankLevelCm?.toFixed(1)} cm (< 5.0 cm reserve threshold). Continuous extraction risks running the pump dry.`;
        recommendedAction =
          'Switch off Node 2 extraction pump immediately and refill demonstration reservoir.';
      }
    }
    // Condition C: Significant upcoming rainfall or active recharge -> PREPARE_RECHARGE
    else if (
      (weather.status === 'available' &&
        weather.forecastRainMm !== null &&
        (weather.forecastRainMm >= 10 || (weather.maxProbabilityPercent || 0) >= 65)) ||
      (averageRechargeFlowLpm !== null && averageRechargeFlowLpm > 1.2 && (averageExtractionFlowLpm || 0) < 0.5)
    ) {
      level = 'PREPARE_RECHARGE';
      urgency = 'HIGH';
      const rainText =
        weather.status === 'available' && weather.forecastRainMm !== null
          ? `${weather.forecastRainMm} mm rain forecasted (${weather.maxProbabilityPercent}% chance)`
          : 'High inflow detected on Node 1';
      headline = 'Prepare Recharge Structures Ahead of Rainfall';
      explanation = `External forecast indicates ${rainText}. Active seasonal precipitation provides high aquifer replenishment potential if runoff channels are clear.`;
      recommendedAction =
        'Inspect community recharge pits, de-silt percolation shafts, and clear rooftop inlet filtration beds before runoff begins.';
    }
    // Condition D: Extraction exceeds recharge -> CONSERVE_WATER
    else if (
      averageExtractionFlowLpm !== null &&
      averageRechargeFlowLpm !== null &&
      averageExtractionFlowLpm > averageRechargeFlowLpm * 1.05
    ) {
      level = 'CONSERVE_WATER';
      urgency = 'MEDIUM';
      headline = 'Water Conservation Advisory Active';
      explanation = `Across the last 24 hours, average measured extraction (${averageExtractionFlowLpm.toFixed(2)} L/min) exceeds average recharge (${averageRechargeFlowLpm.toFixed(2)} L/min). Local water resources require rotational scheduling to avoid unnecessary reservoir depletion.`;
      recommendedAction =
        'Implement rotational tubewell pumping schedules and defer non-essential water usage until recharge replenishment.';
    }
    // Condition E: Equilibrium / Normal use
    else {
      level = 'NORMAL_USE';
      urgency = 'LOW';
      headline = 'Normal Water Operations: Systems Balanced';
      explanation = `Across the last 24 hours, average measured Node 1 inflow (${(averageRechargeFlowLpm || 0).toFixed(2)} L/min) and Node 2 extraction (${(averageExtractionFlowLpm || 0).toFixed(2)} L/min) are operating in stable balance.`;
      recommendedAction =
        'Maintain standard community pumping rosters and regular periodic sensor checks.';
    }

    const dataQualityNote =
      'Data Quality Note: Grounded strictly in authenticated ESP32 telemetry (Node 1 & Node 2), external Open-Meteo weather forecasts, and IMD agro-climatic rules. Tabletop ultrasonic sensor measures reservoir water depth, not deep groundwater piezometer tables.';

    // 9. Optional Google Gemini Synthesis if GEMINI_API_KEY is configured
    let synthesisSource: 'gemini' | 'deterministic_hydrological_rules' = 'deterministic_hydrological_rules';

    if (level !== 'WAITING_FOR_DATA' && config.geminiApiKey && config.geminiApiKey !== 'your_gemini_api_key_here' && process.env.NODE_ENV !== 'test') {
      try {
        const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
        const systemPrompt = `You are the BhujalSetu Community Groundwater Intelligence Advisor.
Strictly adhere to the determined advice level: "${level}". This decision uses the previous 24 hours and is reviewed once daily, not on each dashboard poll.
CRITICAL CONSTRAINTS:
1. You are synthesizing verified telemetry and external forecasts. Do NOT hallucinate, change, or fabricate numbers.
2. The ultrasonic sensor measures bench tabletop tank water level (${tankLevelCm ?? 'unmeasured'} cm), NOT deep aquifer groundwater depth.
3. Keep explanation to 2-3 concise sentences.
4. Keep recommended action to 1 actionable sentence for village water committees (Pani Samiti).`;

        const userPrompt = `Context:
- Advice Level: ${level}
- Urgency: ${urgency}
- Community: ${locationName}
- Analysis window: the rolling 24 hours ending ${generatedAt}
- Node 1 24-hour average recharge flow: ${averageRechargeFlowLpm?.toFixed(2) ?? 'No measured samples'} L/min (latest: ${rechargeFlowLpm ?? 'None'} L/min)
- Node 2 24-hour average extraction flow: ${averageExtractionFlowLpm?.toFixed(2) ?? 'No measured samples'} L/min (latest: ${extractionFlowLpm ?? 'None'} L/min)
- Tabletop Tank Level: ${tankLevelCm ?? 'None'} cm (Distance: ${tankDistanceCm ?? 'None'} cm)
- Weather Forecast: ${weather.summary} (Rain: ${weather.forecastRainMm ?? 0} mm, ${weather.source})
- Season: ${seasonal.seasonName} (${seasonal.calendarPeriod})
- Extraction Anomaly: ${anomalyResult.isAnomaly ? `DETECTED (${anomalyResult.reason})` : 'Normal baseline'}`;

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Gemini API timeout')), 6000)
        );

        const apiPromise = ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
        });

        const resp = await Promise.race([apiPromise, timeoutPromise]);
        const text = resp.text || '';
        if (text.trim().length > 20) {
          explanation = text.trim();
          synthesisSource = 'gemini';
        }
      } catch (err: any) {
        console.warn('[AiAdvisorService] Gemini synthesis skipped or timed out, using deterministic rules:', err.message);
      }
    }

    return {
      success: true,
      level,
      headline,
      explanation,
      recommendedAction,
      urgency,
      evidence,
      synthesisSource,
      dataQualityNote,
      generatedAt,
      nextReviewAt: level === 'WAITING_FOR_DATA' ? undefined : new Date(Date.parse(generatedAt) + ADVISOR_REVIEW_INTERVAL_MS).toISOString(),
    };
  },
};
