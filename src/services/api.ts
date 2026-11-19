/**
 * BhujalSetu - Service & API Abstraction Layer
 *
 * All browser communication routes strictly through the Express backend.
 * PostgreSQL database is accessed only via Express backend routes.
 */

import {
  GroundwaterReading,
  WaterBalance,
  Alert,
  ActionRecommendation,
  CommunityActionItem,
  WaterPledgeItem,
  TimeRange,
  BalancePeriod,
  VillageCommunity,
  HardwareSensorSpec,
  PrototypeTelemetry,
  NodePrototypeTelemetry,
  CommunityGemSummary,
  WaterCreditSummary,
  WaterCreditLedgerEntry,
} from '../types/groundwater';
import {
  INITIAL_RECOMMENDATIONS,
  CURRENT_VILLAGE,
  PROTOTYPE_HARDWARE_SPEC,
} from './mockData';

// In-memory runtime state for prototype fallback (starts empty)
let runtimeActions: CommunityActionItem[] = [];
let runtimePledges: WaterPledgeItem[] = [];
let runtimeAlerts: Alert[] = [];

export type AdviceLevel =
  | 'NORMAL_USE'
  | 'CONSERVE_WATER'
  | 'CRITICAL_CONSERVATION'
  | 'PREPARE_RECHARGE'
  | 'WAITING_FOR_DATA';

export interface AiAdvisorEvidence {
  groundwater: {
    status: 'UNMEASURED' | 'MEASURED';
    value: string;
    source: string;
    freshness: string;
    limitationNote: string;
  };
  nodeTelemetry: {
    status: 'measured' | 'waiting_for_devices' | 'incomplete' | 'stale';
    node1Status?: 'live' | 'stale' | 'missing';
    node2Status?: 'live' | 'stale' | 'missing';
    node1Freshness?: string;
    node2Freshness?: string;
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
  weather: {
    status: 'available' | 'unconfigured' | 'error';
    source: string;
    location: string;
    forecastRainMm: number | null;
    maxProbabilityPercent: number | null;
    summary: string;
    freshness: string;
    limitationNote?: string;
  };
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

export interface AiAdvisorData {
  success: boolean;
  level: AdviceLevel;
  headline: string;
  explanation: string;
  recommendedAction: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  evidence: AiAdvisorEvidence;
  synthesisSource: 'gemini' | 'deterministic_hydrological_rules';
  dataQualityNote: string;
  generatedAt: string;
  nextReviewAt?: string;
}

export interface ExtractionAnomalyData {
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
}

const asyncDelay = (ms: number = 50) => new Promise((resolve) => setTimeout(resolve, ms));

async function safeParseJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const BhujalSetuApi = {
  async getNodePrototypeTelemetry(villageId: string, limit = 120): Promise<NodePrototypeTelemetry[]> {
    const token = localStorage.getItem('bhujalsetu_auth_token');
    if (!token) throw new Error('Sign in with your approved community account to load node readings.');

    const params = new URLSearchParams({ villageId, limit: String(limit) });
    const response = await fetch(`/api/v1/telemetry?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const body = await safeParseJson(response);

    if (!response.ok) {
      const message = body?.error || (response.status === 503
        ? 'Backend PostgreSQL storage is unavailable or database is not connected.'
        : response.status === 403
        ? 'Active community membership is required to access telemetry.'
        : response.status === 401
        ? 'Sign in with an approved community account to view telemetry.'
        : `Telemetry request failed with status ${response.status}.`);
      const err = new Error(message);
      (err as any).status = response.status;
      throw err;
    }

    if (!body || !Array.isArray(body.records)) throw new Error('The backend returned an invalid sensor history response.');
    return body.records.filter((record: NodePrototypeTelemetry) =>
      (record.nodeId === 'node-1' || record.nodeId === 'node-2') && record.dataSource === 'measured'
    );
  },

  async getLatestPrototypeTelemetry(villageId?: string): Promise<PrototypeTelemetry | null> {
    try {
      const params = new URLSearchParams();
      if (villageId) params.set('villageId', villageId);
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(
        `/api/prototype/telemetry/latest${params.toString() ? `?${params.toString()}` : ''}`,
        { headers }
      );
      if (!response.ok) return null;
      const data = await safeParseJson(response);
      if (!data || (data.dataSource !== 'measured' && data.dataSource !== 'simulated')) return null;
      return data as PrototypeTelemetry;
    } catch {
      return null;
    }
  },

  async getVillageProfile(villageId?: string): Promise<VillageCommunity> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const params = new URLSearchParams();
      if (villageId) params.set('villageId', villageId);
      const res = await fetch(`/api/auth/community${params.toString() ? `?${params.toString()}` : ''}`, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && data.community) {
          const c = data.community;
          return {
            ...CURRENT_VILLAGE,
            id: c.id,
            name: c.name,
            district: c.district || CURRENT_VILLAGE.district,
            state: c.state || CURRENT_VILLAGE.state,
            latitude: c.latitude != null ? Number(c.latitude) : null,
            longitude: c.longitude != null ? Number(c.longitude) : null,
          };
        }
      }
    } catch {
      // Fallback
    }
    return CURRENT_VILLAGE;
  },

  async getAvailableVillages(authorizedVillageId?: string): Promise<VillageCommunity[]> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      if (token) {
        const res = await fetch('/api/auth/authorized-communities', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await safeParseJson(res);
          if (data && data.success && Array.isArray(data.communities) && data.communities.length > 0) {
            return data.communities;
          }
        }
      }

      // Fallback: look up single registered prototype community profile from server
      const params = new URLSearchParams();
      if (authorizedVillageId) params.set('villageId', authorizedVillageId);
      const resComm = await fetch(`/api/auth/community${params.toString() ? `?${params.toString()}` : ''}`);
      if (resComm.ok) {
        const data = await safeParseJson(resComm);
        if (data && data.success && data.community) {
          const c = data.community;
          return [{
            id: c.id,
            name: c.name,
            district: c.district || 'Pune',
            state: c.state || 'Maharashtra',
            aquiferType: 'Basaltic Deccan Trap with alluvial pockets',
            participatingHouseholds: 215,
            totalBorewellsTracked: 12,
            activeRechargeStructures: 5,
            totalRechargedThisSeasonLiters: 980000,
            latitude: c.latitude != null ? Number(c.latitude) : null,
            longitude: c.longitude != null ? Number(c.longitude) : null,
          }];
        }
      }
    } catch {
      // Fallback
    }

    if (authorizedVillageId) {
      return [{
        ...CURRENT_VILLAGE,
        id: authorizedVillageId,
        name: authorizedVillageId === 'village-rampur-04' ? 'Rampur Prototype Village' : authorizedVillageId,
      }];
    }
    return [CURRENT_VILLAGE];
  },

  async getGroundwaterStatus(villageId?: string): Promise<GroundwaterReading | null> {
    try {
      const url = villageId ? `/api/groundwater?villageId=${encodeURIComponent(villageId)}` : '/api/groundwater';
      const res = await fetch(url);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.depthMeters !== null && data.depthMeters !== undefined) {
          return {
            timestamp: data.timestamp || new Date().toISOString(),
            depthMeters: data.depthMeters,
            historicalBaselineMeters: data.historicalBaselineMeters || 17.8,
            changeMeters: data.changeMeters ?? 0,
            status: data.status || 'NORMAL',
            wellId: data.wellId || 'COMMUNITY-PIEZOMETER-01',
            locationName: data.locationName || 'Ward Piezometer Survey',
          };
        }
      }
    } catch {
      // Backend unavailable; no fabricated readings
    }
    return null;
  },

  async getWaterBalance(period: BalancePeriod = 'daily', villageId?: string): Promise<WaterBalance> {
    try {
      const params = new URLSearchParams({ period });
      if (villageId) params.append('villageId', villageId);
      const res = await fetch(`/api/water-balance?${params.toString()}`);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data) return data as WaterBalance;
      }
    } catch {
      // Backend unavailable; show waiting state
    }
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
      message: 'Waiting for synchronized Node 1 and Node 2 measured packets.',
      disclaimer: 'Tabletop prototype sensors do not simulate or fabricate water-balance values.',
    };
  },

  async getCommunityGems(villageId: string, idToken?: string): Promise<CommunityGemSummary | null> {
    try {
      const token = idToken || localStorage.getItem('bhujalsetu_auth_token') || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/v1/gems?villageId=${encodeURIComponent(villageId)}`, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success) {
          return data as CommunityGemSummary;
        }
      }
    } catch (err) {
      console.error('[API] Error fetching community GEMs:', err);
    }
    return null;
  },

  async getWaterCreditsSummary(villageId?: string, idToken?: string): Promise<WaterCreditSummary | null> {
    try {
      const token = idToken || localStorage.getItem('bhujalsetu_auth_token') || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const url = villageId ? `/api/v1/water-credits/summary?villageId=${encodeURIComponent(villageId)}` : '/api/v1/water-credits/summary';
      const res = await fetch(url, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success) {
          return data as WaterCreditSummary;
        }
      }
    } catch (err) {
      console.error('[API] Error fetching water credits summary:', err);
    }
    return null;
  },

  async getWaterCreditsHistory(villageId?: string, limit = 30, idToken?: string): Promise<WaterCreditLedgerEntry[]> {
    try {
      const token = idToken || localStorage.getItem('bhujalsetu_auth_token') || undefined;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const params = new URLSearchParams({ limit: String(limit) });
      if (villageId) params.append('villageId', villageId);
      const res = await fetch(`/api/v1/water-credits/history?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && Array.isArray(data.history)) {
          return data.history as WaterCreditLedgerEntry[];
        }
      }
    } catch (err) {
      console.error('[API] Error fetching water credits history:', err);
    }
    return [];
  },

  async triggerDailyWaterCreditsCalculation(targetDate?: string, idToken?: string): Promise<{ success: boolean; entry?: WaterCreditLedgerEntry; error?: string }> {
    try {
      const token = idToken || localStorage.getItem('bhujalsetu_auth_token') || undefined;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/v1/water-credits/calculate-daily', {
        method: 'POST',
        headers,
        body: JSON.stringify(targetDate ? { targetDate } : {}),
      });
      const data = await safeParseJson(res);
      if (res.ok && data?.success) {
        return { success: true, entry: data.entry };
      }
      return { success: false, error: data?.error || 'Calculation failed' };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  },

  async getTrends(range: TimeRange = '30d', villageId?: string) {
    try {
      const params = new URLSearchParams({ range });
      if (villageId) params.append('villageId', villageId);
      const res = await fetch(`/api/trends?${params.toString()}`);
      if (res.ok) {
        const data = await safeParseJson(res);
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch {
      // Monitored history only
    }
    return [];
  },

  async getAlerts(villageId?: string): Promise<Alert[]> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      if (!token) return [];
      const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
      };
      const res = await fetch('/api/alerts', { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (Array.isArray(data)) {
          return data as Alert[];
        }
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async dismissAlert(alertId: string): Promise<void> {
    runtimeAlerts = runtimeAlerts.filter((a) => a.id !== alertId);
  },

  async getRecommendations(): Promise<ActionRecommendation[]> {
    try {
      const res = await fetch('/api/actions');
      if (res.ok) {
        const data = await safeParseJson(res);
        if (Array.isArray(data)) {
          return data as ActionRecommendation[];
        }
      }
    } catch {
      // Fallback
    }
    return INITIAL_RECOMMENDATIONS;
  },

  async getAiAdvisor(villageId?: string): Promise<AiAdvisorData> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/ai/advice', { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.level) {
          return data as AiAdvisorData;
        }
      }
    } catch (err) {
      console.warn('AI advisor endpoint failed; fallback guidance displayed.', err);
    }

    return {
      success: false,
      level: 'WAITING_FOR_DATA',
      headline: 'Awaiting Hardware Telemetry or Backend Connection',
      explanation: 'Both Node 1 and Node 2 must stream authenticated measured packets to evaluate community groundwater intelligence. No simulated or fabricated numbers are displayed.',
      recommendedAction: 'Connect ESP32 hardware nodes and verify active backend session.',
      urgency: 'LOW',
      evidence: {
        groundwater: {
          status: 'UNMEASURED',
          value: 'Piezometer Offline',
          source: 'Borewell Piezometers',
          freshness: 'N/A',
          limitationNote: 'Tabletop ultrasonic sensor measures bench tank level, not deep groundwater.',
        },
        nodeTelemetry: {
          status: 'waiting_for_devices',
          rechargeFlowLpm: null,
          rechargeTotalLiters: null,
          extractionFlowLpm: null,
          extractionTotalLiters: null,
          tankLevelCm: null,
          tankDistanceCm: null,
          windowDuration: 'No packets',
          sampleCount: 0,
          averageRechargeFlowLpm: null,
          averageExtractionFlowLpm: null,
          source: 'ESP32 Nodes',
          freshness: 'N/A',
        },
        weather: {
          status: 'unconfigured',
          source: 'Open-Meteo Weather API',
          location: 'Community Location',
          forecastRainMm: null,
          maxProbabilityPercent: null,
          summary: 'Weather forecast awaiting backend synchronization',
          freshness: 'N/A',
        },
        seasonal: {
          seasonName: 'Current Season',
          calendarPeriod: 'Annual cycle',
          ruleSource: 'IMD rules',
          guidance: 'Standard rotational water management',
        },
        anomaly: {
          detected: false,
        },
      },
      synthesisSource: 'deterministic_hydrological_rules',
      dataQualityNote: 'Tabletop prototype sensors measure bench flow and tank level only.',
      generatedAt: new Date().toISOString(),
    };
  },

  async getAiGroundwaterAdvice(villageId?: string, question?: string): Promise<{
    headline: string;
    analysis: string;
    advisory: string;
    recommendedAction: string;
    source?: string;
  }> {
    const advisor = await this.getAiAdvisor(villageId);
    return {
      headline: advisor.headline,
      analysis: advisor.explanation,
      advisory: advisor.explanation,
      recommendedAction: advisor.recommendedAction,
      source: advisor.synthesisSource,
    };
  },

  async getExtractionAnomaly(villageId?: string): Promise<ExtractionAnomalyData | null> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/telemetry/extraction-anomaly', { headers });
      if (res.ok) {
        return await safeParseJson(res);
      }
    } catch (err) {
      console.warn('Extraction anomaly check failed:', err);
    }
    return null;
  },

  async getCommunityActions(communityId: string): Promise<CommunityActionItem[]> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/community/actions?villageId=${encodeURIComponent(communityId)}`, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && Array.isArray(data.actions)) {
          return data.actions;
        }
      }
    } catch (err) {
      console.warn('Could not load community actions from PostgreSQL backend:', err);
    }
    return runtimeActions.filter((action) => action.communityId === communityId);
  },

  async submitCommunityAction(action: Omit<CommunityActionItem, 'id' | 'createdAt'>): Promise<CommunityActionItem> {
    const token = localStorage.getItem('bhujalsetu_auth_token');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/community/actions', {
        method: 'POST',
        headers,
        body: JSON.stringify(action),
      });

      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && data.action) {
          runtimeActions.unshift(data.action);
          return data.action;
        }
      }
    } catch (error) {
      console.warn('Could not persist to PostgreSQL backend, stored in local runtime state:', error);
    }

    const newAction: CommunityActionItem = {
      ...action,
      id: `act-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    runtimeActions.unshift(newAction);
    return newAction;
  },

  async getWaterPledges(communityId: string): Promise<WaterPledgeItem[]> {
    try {
      const token = localStorage.getItem('bhujalsetu_auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/community/pledges?villageId=${encodeURIComponent(communityId)}`, { headers });
      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && Array.isArray(data.pledges)) {
          return data.pledges;
        }
      }
    } catch (error) {
      console.warn('Could not load water pledges from PostgreSQL backend:', error);
    }
    return runtimePledges.filter((pledge) => pledge.communityId === communityId);
  },

  async submitWaterPledge(pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>): Promise<WaterPledgeItem> {
    const token = localStorage.getItem('bhujalsetu_auth_token');
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/community/pledges', {
        method: 'POST',
        headers,
        body: JSON.stringify(pledge),
      });

      if (res.ok) {
        const data = await safeParseJson(res);
        if (data && data.success && data.pledge) {
          runtimePledges.unshift(data.pledge);
          return data.pledge;
        }
      }
    } catch (error) {
      console.warn('Could not persist pledge to PostgreSQL backend:', error);
    }

    const newPledge: WaterPledgeItem = {
      ...pledge,
      id: `pledge-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };
    runtimePledges.unshift(newPledge);
    return newPledge;
  },

  async updateCommunityLocation(latitude: number | null, longitude: number | null): Promise<any> {
    const token = localStorage.getItem('bhujalsetu_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/community/location', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ latitude, longitude }),
    });
    const data = await safeParseJson(res);
    if (!res.ok) {
      throw new Error(data?.error || `Failed to update community location (${res.status}).`);
    }
    return data;
  },

  async updateCommunityName(name: string): Promise<any> {
    const token = localStorage.getItem('bhujalsetu_auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/auth/community/name', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name }),
    });
    const data = await safeParseJson(res);
    if (!res.ok) {
      throw new Error(data?.error || `Failed to update community name (${res.status}).`);
    }
    return data;
  },

  async getHardwareSpec(): Promise<HardwareSensorSpec> {
    await asyncDelay(20);
    return { ...PROTOTYPE_HARDWARE_SPEC };
  },
};
