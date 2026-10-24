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
} from '../types/groundwater';
import {
  CURRENT_GROUNDWATER_READING,
  DAILY_WATER_BALANCE,
  WEEKLY_WATER_BALANCE,
  MONTHLY_WATER_BALANCE,
  INITIAL_ALERTS,
  INITIAL_RECOMMENDATIONS,
  INITIAL_COMMUNITY_ACTIONS,
  INITIAL_WATER_PLEDGES,
  CURRENT_VILLAGE,
  AVAILABLE_COMMUNITIES,
  PROTOTYPE_HARDWARE_SPEC,
  generateTrendSeries,
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
  handleFirestoreError,
  OperationType,
} from '../firebase';

// In-memory runtime state for prototype interaction
let runtimeActions: CommunityActionItem[] = [...INITIAL_COMMUNITY_ACTIONS];
let runtimePledges: WaterPledgeItem[] = [...INITIAL_WATER_PLEDGES];
let runtimeAlerts: Alert[] = [...INITIAL_ALERTS];

// Helper delay to mimic async network response cleanly
const asyncDelay = (ms: number = 100) => new Promise((resolve) => setTimeout(resolve, ms));

export const BhujalSetuApi = {
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
   * Future: GET /api/groundwater
   */
  async getGroundwaterStatus(): Promise<GroundwaterReading> {
    await asyncDelay(80);
    return { ...CURRENT_GROUNDWATER_READING };
  },

  /**
   * Fetch water balance calculations for daily, weekly, or monthly
   * Future: GET /api/water-balance?period=daily
   */
  async getWaterBalance(period: BalancePeriod = 'daily'): Promise<WaterBalance> {
    await asyncDelay(80);
    switch (period) {
      case 'weekly':
        return { ...WEEKLY_WATER_BALANCE };
      case 'monthly':
        return { ...MONTHLY_WATER_BALANCE };
      case 'daily':
      default:
        return { ...DAILY_WATER_BALANCE };
    }
  },

  /**
   * Fetch historical trend data series for charts
   * Future: GET /api/trends?range=30d
   */
  async getTrends(range: TimeRange = '30d') {
    await asyncDelay(120);
    const dayCount = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    return generateTrendSeries(dayCount);
  },

  /**
   * Fetch active alerts
   * Future: GET /api/alerts
   */
  async getAlerts(): Promise<Alert[]> {
    await asyncDelay(60);
    return [...runtimeAlerts];
  },

  /**
   * Dismiss an alert locally
   */
  async dismissAlert(alertId: string): Promise<void> {
    runtimeAlerts = runtimeAlerts.filter((a) => a.id !== alertId);
  },

  /**
   * Fetch rule-based action recommendations and AI Advisor evaluation
   * Future: GET /api/actions
   */
  async getRecommendations(): Promise<ActionRecommendation[]> {
    await asyncDelay(80);
    return [...INITIAL_RECOMMENDATIONS];
  },

  /**
   * Fetch community actions list. Tries Firestore first if user is logged in,
   * otherwise seamlessly returns local prototype list.
   * Future: GET /api/community/actions
   */
  async getCommunityActions(): Promise<CommunityActionItem[]> {
    if (auth.currentUser && !auth.currentUser.isAnonymous) {
      try {
        const q = query(
          collection(db, 'community_actions'),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const remoteActions: CommunityActionItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
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
          // Merge with initial prototype seed actions
          return [...remoteActions, ...runtimeActions.filter(a => !remoteActions.some(r => r.id === a.id))];
        }
      } catch (err) {
        console.warn('Falling back to local community actions:', err);
      }
    }
    return [...runtimeActions];
  },

  /**
   * Submit a new community action
   * Future: POST /api/community/actions
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
   * Fetch household water pledges
   */
  async getWaterPledges(): Promise<WaterPledgeItem[]> {
    await asyncDelay(50);
    return [...runtimePledges];
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
