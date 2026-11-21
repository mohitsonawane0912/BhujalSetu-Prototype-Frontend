/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BhujalSetu — Community Groundwater Intelligence & Recharge System
 * "Turning Groundwater Data into Community Action"
 */

import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { WaterBalanceView } from './components/WaterBalanceView';
import { TrendsView } from './components/TrendsView';
import { ActionsView } from './components/ActionsView';
import { CommunityView } from './components/CommunityView';
import { HardwareModal } from './components/HardwareModal';
import { WelcomeView } from './components/WelcomeView';
import {
  GroundwaterReading,
  WaterBalance,
  Alert,
  ActionRecommendation,
  CommunityActionItem,
  WaterPledgeItem,
  VillageCommunity,
  BalancePeriod,
  ActionStatus,
  HardwareSensorSpec,
  NodePrototypeTelemetry,
  TelemetryConnectionStatus,
} from './types/groundwater';
import { BhujalSetuApi } from './services/api';
import { Droplets } from 'lucide-react';

function deriveHardwareAlerts(records: NodePrototypeTelemetry[]): Alert[] {
  const alerts: Alert[] = [];
  const latestNode = (nodeId: NodePrototypeTelemetry['nodeId']) =>
    records
      .filter((r) => r.nodeId === nodeId)
      .sort((a, b) => new Date(b.receivedAt || b.capturedAt).getTime() - new Date(a.receivedAt || a.capturedAt).getTime())[0];

  const n1 = latestNode('node-1');
  const n2 = latestNode('node-2');

  if (n1?.waterLevel && n1.waterLevel.levelCm < 5.0) {
    alerts.push({
      id: 'alert-tank-low',
      severity: 'WATCH',
      title: 'Tabletop Tank Water Level Low',
      message: `Ultrasonic sensor reports ${n1.waterLevel.levelCm.toFixed(1)} cm water depth remaining in the tabletop tank.`,
      triggerMetric: 'Tabletop Tank Level',
      thresholdValue: '< 5.0 cm',
      actualValue: `${n1.waterLevel.levelCm.toFixed(1)} cm`,
      timestamp: new Date(n1.capturedAt).toLocaleTimeString(),
    });
  }

  const isStale = (r?: NodePrototypeTelemetry) => r && Date.now() - new Date(r.receivedAt || r.capturedAt).getTime() > 45000;
  if (n1 && isStale(n1)) {
    alerts.push({
      id: 'alert-node1-stale',
      severity: 'WATCH',
      title: 'Node 1 Telemetry Stale (>45s)',
      message: 'Node 1 (Recharge line) has not sent a packet in over 45 seconds.',
      triggerMetric: 'Node 1 Packet Heartbeat',
      thresholdValue: '< 45s',
      actualValue: '> 45s',
      timestamp: new Date(n1.capturedAt).toLocaleTimeString(),
    });
  }
  if (n2 && isStale(n2)) {
    alerts.push({
      id: 'alert-node2-stale',
      severity: 'WATCH',
      title: 'Node 2 Telemetry Stale (>45s)',
      message: 'Node 2 (Extraction line) has not sent a packet in over 45 seconds.',
      triggerMetric: 'Node 2 Packet Heartbeat',
      thresholdValue: '< 45s',
      actualValue: '> 45s',
      timestamp: new Date(n2.capturedAt).toLocaleTimeString(),
    });
  }

  return alerts;
}

export default function App() {
  return (
    <AuthProvider>
      <BhujalSetuDashboard />
    </AuthProvider>
  );
}

function BhujalSetuDashboard() {
  const { user, membershipStatus, loading: authLoading, refreshAuth } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [village, setVillage] = useState<VillageCommunity | null>(null);
  const [availableVillages, setAvailableVillages] = useState<VillageCommunity[]>([]);
  const [reading, setReading] = useState<GroundwaterReading | null>(null);
  const [waterBalance, setWaterBalance] = useState<WaterBalance | null>(null);
  const [balancePeriod, setBalancePeriod] = useState<BalancePeriod>('daily');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [recommendations, setRecommendations] = useState<ActionRecommendation[]>([]);
  const [communityActions, setCommunityActions] = useState<CommunityActionItem[]>([]);
  const [waterPledges, setWaterPledges] = useState<WaterPledgeItem[]>([]);
  const [hardwareSpec, setHardwareSpec] = useState<HardwareSensorSpec | null>(null);
  const [isHardwareModalOpen, setIsHardwareModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Decoupled telemetry state
  const [nodeTelemetry, setNodeTelemetry] = useState<NodePrototypeTelemetry[]>([]);
  const [telemetryStatus, setTelemetryStatus] = useState<TelemetryConnectionStatus>('loading');
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const [lastTelemetryFetch, setLastTelemetryFetch] = useState<Date | null>(null);

  // In-flight refresh ref to prevent overlapping requests
  const isRefreshingRef = useRef<boolean>(false);

  // Step 1: Initial page load (loads community baseline, profiles, alerts, etc.)
  // CRITICAL: Does NOT include authenticated telemetry request in this Promise.all.
  // This guarantees the dashboard renders even if local auth is not yet restored or visitor is signed out.
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        const authorizedCommunityId = user?.communityId;
        const [
          vProfile,
          vList,
          gwReading,
          wBalance,
          alertList,
          recList,
          hSpec,
        ] = await Promise.all([
          BhujalSetuApi.getVillageProfile(authorizedCommunityId),
          BhujalSetuApi.getAvailableVillages(authorizedCommunityId),
          BhujalSetuApi.getGroundwaterStatus(authorizedCommunityId),
          BhujalSetuApi.getWaterBalance('daily', authorizedCommunityId),
          BhujalSetuApi.getAlerts(authorizedCommunityId),
          BhujalSetuApi.getRecommendations(),
          BhujalSetuApi.getHardwareSpec(),
        ]);

        const [cActions, wPledges] = await Promise.all([
          BhujalSetuApi.getCommunityActions(vProfile.id).catch(() => []),
          BhujalSetuApi.getWaterPledges(vProfile.id).catch(() => []),
        ]);

        if (isMounted) {
          const selectedCommunity = (vList.length > 0 && authorizedCommunityId)
            ? (vList.find((v) => v.id === authorizedCommunityId) || vList[0])
            : vProfile;
          setVillage(selectedCommunity);
          setAvailableVillages(vList);
          setReading(gwReading);
          setWaterBalance(wBalance);
          setAlerts([]); // Alerts are strictly derived from real hardware telemetry
          setRecommendations(recList);
          setCommunityActions(cActions);
          setWaterPledges(wPledges);
          setHardwareSpec(hSpec);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to load initial dataset:', err);
        if (isMounted) setIsLoading(false);
      }
    }

    loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update available villages whenever authenticated user's community resolves
  useEffect(() => {
    if (!user?.communityId) return;
    let isMounted = true;
    BhujalSetuApi.getAvailableVillages(user.communityId).then((vList) => {
      if (isMounted && vList.length > 0) {
        setAvailableVillages(vList);
        const match = vList.find((v) => v.id === user.communityId) || vList[0];
        setVillage(match);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [user?.communityId]);

  // Step 2: Independent telemetry lifecycle with error handling and concurrency guards
  useEffect(() => {
    let isMounted = true;
    let isRequestInProgress = false;
    const currentVillageId = village?.id;

    if (!currentVillageId) return;

    // While local auth is still resolving on initial launch, keep loading indicator
    if (authLoading) {
      setTelemetryStatus('loading');
      return;
    }

    // Check user sign-in status
    if (!user) {
      setNodeTelemetry([]);
      setTelemetryStatus('signed-out');
      setTelemetryError('Sign in with your approved community account to view live node telemetry.');
      return;
    }

    const fetchTelemetry = async (isInitial = false) => {
      if (isRequestInProgress || !isMounted) return;
      isRequestInProgress = true;

      if (isInitial) {
        setTelemetryStatus('loading');
      }

      try {
        const [records, updatedBalance, anomalyData] = await Promise.all([
          BhujalSetuApi.getNodePrototypeTelemetry(currentVillageId),
          BhujalSetuApi.getWaterBalance(balancePeriod, currentVillageId).catch(() => null),
          BhujalSetuApi.getExtractionAnomaly(currentVillageId).catch(() => null),
        ]);
        // Prevent race conditions: ensure response belongs to currently selected village
        if (isMounted && currentVillageId === village?.id) {
          setNodeTelemetry(records);
          if (updatedBalance) setWaterBalance(updatedBalance);
          setTelemetryStatus(records.length > 0 ? 'ready' : 'no-data');

          const baseAlerts = deriveHardwareAlerts(records);
          // Backend AnomalyDetector is the single source of truth for extraction anomaly alerts.
          // Keep displaying an alert whenever backend reports alert.status === 'ACTIVE',
          // including recovery periods before the second distinct normal packet arrives.
          if (anomalyData && (anomalyData as any).alert && (anomalyData as any).alert.status === 'ACTIVE') {
            const backendAlert = (anomalyData as any).alert;
            if (!baseAlerts.some((a) => a.id === backendAlert.id)) {
              baseAlerts.push(backendAlert);
            }
          }
          setAlerts(baseAlerts);
          setTelemetryError(null);
          setLastTelemetryFetch(new Date());
        }
      } catch (err: any) {
        if (isMounted && currentVillageId === village?.id) {
          const status = err?.status;
          const msg = err?.message || 'Failed to load telemetry';
          setTelemetryError(msg);
          if (status === 403 || msg.includes('membership') || msg.includes('Active community membership is required')) {
            setTelemetryStatus('unauthorized');
            setNodeTelemetry([]);
          } else if (status === 503 || msg.includes('PostgreSQL') || msg.includes('database') || msg.includes('unavailable')) {
            setTelemetryStatus('backend-error');
          } else if (status === 401 || msg.includes('Sign in')) {
            setTelemetryStatus('signed-out');
            setNodeTelemetry([]);
          } else {
            setTelemetryStatus('backend-error');
          }
        }
      } finally {
        isRequestInProgress = false;
      }
    };

    fetchTelemetry(true);

    const intervalId = window.setInterval(() => {
      fetchTelemetry(false);
    }, 10000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, [village?.id, user, authLoading]);

  // Update water balance when period toggle changes
  const handlePeriodChange = async (newPeriod: BalancePeriod) => {
    setBalancePeriod(newPeriod);
    const updated = await BhujalSetuApi.getWaterBalance(newPeriod, village?.id);
    setWaterBalance(updated);
  };

  const handleSelectVillage = async (selected: VillageCommunity) => {
    // Only allow selecting verified authorized communities
    if (availableVillages.length > 0 && !availableVillages.some((v) => v.id === selected.id)) {
      console.warn(`[Security] Blocked selection of unauthorized community: ${selected.id}`);
      return;
    }

    // Immediately set village and reset telemetry state to avoid showing stale data from the previous community
    setVillage(selected);
    setNodeTelemetry([]);
    setTelemetryStatus('loading');
    setTelemetryError(null);

    const [actions, pledges] = await Promise.all([
      BhujalSetuApi.getCommunityActions(selected.id).catch(() => []),
      BhujalSetuApi.getWaterPledges(selected.id).catch(() => []),
    ]);
    setCommunityActions(actions);
    setWaterPledges(pledges);
  };

  const handleDismissAlert = async (alertId: string) => {
    await BhujalSetuApi.dismissAlert(alertId);
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  };

  const handleUpdateRecommendationStatus = (recId: string, newStatus: ActionStatus) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.id === recId ? { ...r, status: newStatus } : r))
    );
  };

  const handleAddCommunityAction = async (action: Omit<CommunityActionItem, 'id' | 'createdAt' | 'communityId'>) => {
    if (!village) throw new Error('Select a community before submitting an action.');
    const created = await BhujalSetuApi.submitCommunityAction({ ...action, communityId: village.id });
    setCommunityActions((prev) => [created, ...prev]);
  };

  const handleAddWaterPledge = async (pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>) => {
    const created = await BhujalSetuApi.submitWaterPledge(pledge);
    setWaterPledges((prev) => [created, ...prev]);
  };

  const handleVillageUpdate = (updatedVillage: VillageCommunity) => {
    setVillage(updatedVillage);
    setAvailableVillages((prev) =>
      prev.map((v) => (v.id === updatedVillage.id ? updatedVillage : v))
    );
  };

  if (authLoading || isLoading || !village || !hardwareSpec) {
    return (
      <div className="min-h-screen bg-[#F5F1E8] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-xl bg-[#1F5A48] flex items-center justify-center text-[#F5F1E8] mb-4 animate-pulse">
          <Droplets className="w-7 h-7 text-[#A7D7D7]" />
        </div>
        <h2 className="text-xl font-bold text-[#1E2A28]">BhujalSetu</h2>
        <p className="text-xs text-[#1E2A28]/60 mt-1">
          Initializing community groundwater ledger...
        </p>
      </div>
    );
  }

  // If signed out or membership is pending hardware verification, route to Welcome / Setup flow
  if (!user || membershipStatus === 'pending') {
    return <WelcomeView onActivated={refreshAuth} />;
  }

  const openActionCount = recommendations.filter((r) => r.status !== 'COMPLETED').length;

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1E2A28] flex flex-col selection:bg-[#1F5A48] selection:text-[#F5F1E8]">
      {/* Top Header */}
      <Header
        currentVillage={village}
        availableVillages={availableVillages}
        onSelectVillage={handleSelectVillage}
        alerts={alerts}
        onDismissAlert={handleDismissAlert}
        onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
        telemetryStatus={telemetryStatus}
      />

      {/* Navigation Tabs (Desktop Sub-Header & Mobile Bottom Nav) */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        openActionCount={openActionCount}
      />

      {/* Main Workspace Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'home' && (
          <HomeView
            reading={reading}
            waterBalance={waterBalance}
            alerts={alerts}
            recommendations={recommendations}
            village={village}
            onNavigate={setActiveTab}
            onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
            nodeTelemetry={nodeTelemetry}
            telemetryStatus={telemetryStatus}
            telemetryError={telemetryError}
            lastTelemetryFetch={lastTelemetryFetch}
          />
        )}

        {activeTab === 'balance' && (
          <WaterBalanceView
            currentBalance={waterBalance}
            selectedPeriod={balancePeriod}
            onPeriodChange={handlePeriodChange}
            villageId={village.id}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsView
            initialRange="30d"
            villageName={village.name}
            villageId={village.id}
            nodeTelemetry={nodeTelemetry}
            telemetryStatus={telemetryStatus}
          />
        )}

        {activeTab === 'actions' && (
          <ActionsView
            recommendations={recommendations}
            onUpdateStatus={handleUpdateRecommendationStatus}
            onAddCommunityAction={handleAddCommunityAction}
          />
        )}

        {activeTab === 'community' && (
          <CommunityView
            village={village}
            actions={communityActions}
            pledges={waterPledges}
            onAddPledge={handleAddWaterPledge}
            onVillageUpdate={handleVillageUpdate}
          />
        )}
      </main>

      {/* Hardware Blueprint Modal */}
      <HardwareModal
        isOpen={isHardwareModalOpen}
        onClose={() => setIsHardwareModalOpen(false)}
        spec={hardwareSpec}
      />

      {/* Footer */}
      <footer className="mt-auto bg-[#EAE5DB] border-t border-[#D8D2C4] py-8 pb-20 md:pb-8 text-xs text-[#1E2A28]/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#1E2A28]">BhujalSetu</span>
            <span>— Turning Groundwater Data into Community Action</span>
          </div>
          <div className="text-center sm:text-right">
            <div className="font-semibold text-[#1F5A48]">
              MEASURE → UNDERSTAND → ACT → RECHARGE
            </div>
            <div className="text-[10px] text-[#1E2A28]/60 mt-0.5">
              ESP32 Two-Node Hardware Prototype • Authentic Readings Layer
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
