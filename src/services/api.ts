/**
 * BhujalSetu - Service & API Abstraction Layer
 *
 * Current State: Prototype with typed simulated datasets and optional Firestore synchronization.
 * Future State: Replace mock responses with Node.js/Express backend calls:
 *   - GET  /api/groundwater      -> getGroundwaterStatus()
 *   - GET  /api/water-balance    -> getWaterBalance(period)
 *   - GET  /api/trends?range=30d -> getTrends(range)
 *   - GET  /api/alerts           -> getAlerts()
 *   - GET  /api/actions          -> getRecommendations()
 *   - POST /api/community/action -> submitCommunityAction()
 *   - POST /api/community/pledge -> submitWaterPledge()
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
} from '../types/groundwater';
import {
  INITIAL_RECOMMENDATIONS,
  CURRENT_VILLAGE,
  AVAILABLE_COMMUNITIES,
  PROTOTYPE_HARDWARE_SPEC,
} from './mockData';
import {
  db,
  auth,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  where,
  handleFirestoreError,
  OperationType,
} from '../firebase';

// In-memory runtime state for prototype interaction (no fake pre-seeded records)
let runtimeActions: CommunityActionItem[] = [];
let runtimePledges: WaterPledgeItem[] = [];
let runtimeAlerts: Alert[] = [];

// Helper delay to mimic async network response cleanly
const asyncDelay = (ms: number = 100) => new Promise((resolve) => setTimeout(resolve, ms));

export const BhujalSetuApi = {
  async getNodePrototypeTelemetry(villageId: string, limit = 120): Promise<NodePrototypeTelemetry[]> {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Sign in with your approved Firebase account to load node readings.');
    const params = new URLSearchParams({ villageId, limit: String(limit) });
    const response = await fetch(`/api/v1/telemetry?${params.toString()}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      // Non-JSON response (e.g. gateway timeout or proxy error)
    }
    if (!response.ok) {
      const message = body?.error || (response.status === 503
        ? 'Backend Firestore storage is unavailable or credentials are not configured.'
        : response.status === 403
        ? 'Active community membership is required to access telemetry.'
        : response.status === 401
        ? 'Sign in with an approved Firebase account to view telemetry.'
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
      const response = await fetch(`/api/prototype/telemetry/latest${params.toString() ? `?${params.toString()}` : ''}`);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.dataSource !== 'measured' && data.dataSource !== 'simulated') return null;
      return data as PrototypeTelemetry;
    } catch {
      return null;
    }
  },

  /**
   * Fetch current village / aquifer profile
   */
  async getVillageProfile(villageId?: string): Promise<VillageCommunity> {
    await asyncDelay(50);
    if (!villageId) return CURRENT_VILLAGE;
    const match = AVAILABLE_COMMUNITIES.find((v) => v.id === villageId);
    return match || CURRENT_VILLAGE;
  },

  /**
   * Fetch list of available communities
   */
  async getAvailableVillages(): Promise<VillageCommunity[]> {
    await asyncDelay(50);
    return AVAILABLE_COMMUNITIES;
  },

  /**
   * Fetch current groundwater level, status, and shift
   * Returns null when no piezometer instrument is installed (tabletop sensor phase)
   */
  async getGroundwaterStatus(villageId?: string): Promise<GroundwaterReading | null> {
    try {
      const url = villageId ? `/api/groundwater?villageId=${encodeURIComponent(villageId)}` : '/api/groundwater';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.depthMeters !== null && data.depthMeters !== undefined) {
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

  /**
   * Fetch prototype water balance from backend for daily, weekly, or monthly
   * Calls GET /api/water-balance?period=...
   * Returns honest waiting state when paired measured data is unavailable. No hardcoded or fabricated numbers.
   */
  async getWaterBalance(period: BalancePeriod = 'daily', villageId?: string): Promise<WaterBalance> {
    try {
      const params = new URLSearchParams({ period });
      if (villageId) params.append('villageId', villageId);
      const res = await fetch(`/api/water-balance?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data as WaterBalance;
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

  /**
   * Fetch community aggregate GEM points balance and auditable accrual ledger
   * Requires authenticated community membership.
   */
  async getCommunityGems(villageId: string, idToken?: string): Promise<CommunityGemSummary | null> {
    try {
      const headers: Record<string, string> = {};
      if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
      const res = await fetch(`/api/v1/gems?villageId=${encodeURIComponent(villageId)}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          return data as CommunityGemSummary;
        }
      }
    } catch (err) {
      console.error('[API] Error fetching community GEMs:', err);
    }
    return null;
  },

  /**
   * Fetch historical trend data series for charts
   * Calls GET /api/trends?range=... returning real measured history only
   */
  async getTrends(range: TimeRange = '30d', villageId?: string) {
    try {
      const params = new URLSearchParams({ range });
      if (villageId) params.append('villageId', villageId);
      const res = await fetch(`/api/trends?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        if (body.data && Array.isArray(body.data)) {
          return body.data;
        }
      }
    } catch {
      // Backend unavailable
    }
    // Never fall back to generated/simulated time series
    return [];
  },

  /**
   * Fetch active alerts
   */
  async getAlerts(): Promise<Alert[]> {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const remoteAlerts = await res.json();
        if (Array.isArray(remoteAlerts)) {
          return remoteAlerts;
        }
      }
    } catch {
      // Fallback
    }
    await asyncDelay(40);
    return [...runtimeAlerts];
  },

  /**
   * Dismiss an alert locally
   */
  async dismissAlert(alertId: string): Promise<void> {
    runtimeAlerts = runtimeAlerts.filter((a) => a.id !== alertId);
  },

  /**
   * Fetch rule-based action recommendations
   */
  async getRecommendations(): Promise<ActionRecommendation[]> {
    try {
      const res = await fetch('/api/actions');
      if (res.ok) {
        const remoteRecs = await res.json();
        if (Array.isArray(remoteRecs) && remoteRecs.length > 0) {
          return remoteRecs;
        }
      }
    } catch {
      // Fallback
    }
    await asyncDelay(40);
    return [...INITIAL_RECOMMENDATIONS];
  },

  /**
   * Request groundwater intelligence advice from Google Gemini AI advisor
   */
  async getAiGroundwaterAdvice(input: Record<string, unknown>) {
    try {
      const res = await fetch('/api/ai/advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('AI advisor service unreachable:', err);
    }
    return {
      success: true,
      source: 'general_guidance',
      advisory: 'Advisory guidance: Live sensor telemetry is not connected. Prioritize seasonal recharge structure maintenance and voluntary water budgeting.',
      recommendedAction: 'Inspect local percolation pits and maintain community water log.',
    };
  },

  /**
   * Fetch community actions list. Tries Firestore first if user is logged in,
   * otherwise returns session-submitted local actions (no seeded fake actions).
   */
  async getCommunityActions(communityId: string): Promise<CommunityActionItem[]> {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      try {
        const q = query(
          collection(db, 'community_actions'),
          where('communityId', '==', communityId),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const remoteActions: CommunityActionItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              communityId: data.communityId,
              userId: data.userId || 'anonymous',
              userName: data.userName || 'Community Member',
              userEmail: data.userEmail,
              actionType: data.actionType || 'recharge_pit_clearing',
              title: data.title || 'Community Action',
              description: data.description || '',
              ward: data.ward || 'General Ward',
              impactLiters: data.impactLiters || 0,
              status: data.status || 'completed',
              createdAt: data.createdAt || new Date().toISOString(),
            };
          });
          return remoteActions;
        }
        return [];
      } catch (err) {
        console.warn('Could not load community actions from Firestore:', err);
      }
    }
    // Return only actions submitted during this session
    return runtimeActions.filter((action) => action.communityId === communityId);
  },

  /**
   * Submit a new community action
   */
  async submitCommunityAction(action: Omit<CommunityActionItem, 'id' | 'createdAt'>): Promise<CommunityActionItem> {
    const newAction: CommunityActionItem = {
      ...action,
      id: `act-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    // If signed into Firebase, attempt Firestore persistence
    if (auth.currentUser) {
      try {
        const docRef = await addDoc(collection(db, 'community_actions'), {
          ...newAction,
          userId: auth.currentUser.uid,
          userName: action.userName || auth.currentUser.displayName || 'Community Member',
          userEmail: auth.currentUser.email || '',
        });
        newAction.id = docRef.id;
      } catch (error) {
        console.warn('Could not persist to Firestore, stored in local runtime state:', error);
      }
    }

    runtimeActions.unshift(newAction);
    return newAction;
  },

  /**
   * Fetch household water pledges from Firestore only (no seeded fake pledges).
   */
  async getWaterPledges(communityId: string): Promise<WaterPledgeItem[]> {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      try {
        const q = query(
          collection(db, 'water_pledges'),
          where('communityId', '==', communityId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          return snapshot.docs.map((docSnap) => ({ ...docSnap.data(), id: docSnap.id } as WaterPledgeItem));
        }
        return [];
      } catch (error) {
        console.warn('Could not load member-scoped water pledges from Firestore:', error);
      }
    }
    await asyncDelay(50);
    // Return only pledges submitted during this session
    return runtimePledges.filter((pledge) => pledge.communityId === communityId);
  },

  /**
   * Submit a household water pledge
   */
  async submitWaterPledge(pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>): Promise<WaterPledgeItem> {
    const newPledge: WaterPledgeItem = {
      ...pledge,
      id: `pledge-${Date.now()}`,
      createdAt: new Date().toISOString(),
    };

    if (auth.currentUser) {
      try {
        const docRef = await addDoc(collection(db, 'water_pledges'), {
          ...newPledge,
          userId: auth.currentUser.uid,
        });
        newPledge.id = docRef.id;
      } catch (error) {
        console.warn('Could not persist pledge to Firestore:', error);
      }
    }

    runtimePledges.unshift(newPledge);
    return newPledge;
  },

  /**
   * Fetch hardware specification and ESP32 IoT blueprint data
   */
  async getHardwareSpec(): Promise<HardwareSensorSpec> {
    await asyncDelay(30);
    return { ...PROTOTYPE_HARDWARE_SPEC };
  },
};
