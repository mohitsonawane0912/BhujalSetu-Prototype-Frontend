/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * BhujalSetu — Community Groundwater Intelligence & Recharge System
 * "Turning Groundwater Data into Community Action"
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { Header } from './components/Header';
import { Navigation, TabType } from './components/Navigation';
import { HomeView } from './components/HomeView';
import { WaterBalanceView } from './components/WaterBalanceView';
import { TrendsView } from './components/TrendsView';
import { ActionsView } from './components/ActionsView';
import { CommunityView } from './components/CommunityView';
import { HardwareModal } from './components/HardwareModal';
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
} from './types/groundwater';
import { BhujalSetuApi } from './services/api';
import { Droplets, Heart } from 'lucide-react';

export default function App() {
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

  // Initialize data layer
  useEffect(() => {
    let isMounted = true;
    async function loadInitialData() {
      try {
        const [
          vProfile,
          vList,
          gwReading,
          wBalance,
          alertList,
          recList,
          cActions,
          wPledges,
          hSpec,
        ] = await Promise.all([
          BhujalSetuApi.getVillageProfile(),
          BhujalSetuApi.getAvailableVillages(),
          BhujalSetuApi.getGroundwaterStatus(),
          BhujalSetuApi.getWaterBalance('daily'),
          BhujalSetuApi.getAlerts(),
          BhujalSetuApi.getRecommendations(),
          BhujalSetuApi.getCommunityActions(),
          BhujalSetuApi.getWaterPledges(),
          BhujalSetuApi.getHardwareSpec(),
        ]);

        if (isMounted) {
          setVillage(vProfile);
          setAvailableVillages(vList);
          setReading(gwReading);
          setWaterBalance(wBalance);
          setAlerts(alertList);
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

  // Update water balance when period toggle changes
  const handlePeriodChange = async (newPeriod: BalancePeriod) => {
    setBalancePeriod(newPeriod);
    const updated = await BhujalSetuApi.getWaterBalance(newPeriod);
    setWaterBalance(updated);
  };

  const handleSelectVillage = async (selected: VillageCommunity) => {
    setVillage(selected);
    const profile = await BhujalSetuApi.getVillageProfile(selected.id);
    setVillage(profile);
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

  const handleAddCommunityAction = async (action: Omit<CommunityActionItem, 'id' | 'createdAt'>) => {
    const created = await BhujalSetuApi.submitCommunityAction(action);
    setCommunityActions((prev) => [created, ...prev]);
  };

  const handleAddWaterPledge = async (pledge: Omit<WaterPledgeItem, 'id' | 'createdAt'>) => {
    const created = await BhujalSetuApi.submitWaterPledge(pledge);
    setWaterPledges((prev) => [created, ...prev]);
  };

  if (isLoading || !village || !reading || !waterBalance || !hardwareSpec) {
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

  const openActionCount = recommendations.filter((r) => r.status !== 'COMPLETED').length;

  return (
    <AuthProvider>
      <div className="min-h-screen bg-[#F5F1E8] text-[#1E2A28] flex flex-col selection:bg-[#1F5A48] selection:text-[#F5F1E8]">
        {/* Top Header */}
        <Header
          currentVillage={village}
          availableVillages={availableVillages}
          onSelectVillage={handleSelectVillage}
          alerts={alerts}
          onDismissAlert={handleDismissAlert}
          onOpenHardwareModal={() => setIsHardwareModalOpen(true)}
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
            />
          )}

          {activeTab === 'balance' && (
            <WaterBalanceView
              currentBalance={waterBalance}
              selectedPeriod={balancePeriod}
              onPeriodChange={handlePeriodChange}
            />
          )}

          {activeTab === 'trends' && (
            <TrendsView initialRange="30d" villageName={village.name} />
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
                Clean engineering prototype • Ready for ESP32 & Node.js Express integration
              </div>
            </div>
          </div>
        </footer>
      </div>
    </AuthProvider>
  );
}
