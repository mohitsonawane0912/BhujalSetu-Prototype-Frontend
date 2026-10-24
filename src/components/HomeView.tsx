import React from 'react';
import {
  Compass,
  ArrowRight,
  ShieldAlert,
  Droplet,
  Activity,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { GroundwaterDial } from './GroundwaterDial';
import { MetricCards } from './MetricCards';
import {
  GroundwaterReading,
  WaterBalance,
  Alert,
  ActionRecommendation,
  VillageCommunity,
} from '../types/groundwater';
import { TabType } from './Navigation';

interface HomeViewProps {
  reading: GroundwaterReading;
  waterBalance: WaterBalance;
  alerts: Alert[];
  recommendations: ActionRecommendation[];
  village: VillageCommunity;
  onNavigate: (tab: TabType) => void;
  onOpenHardwareModal: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  reading,
  waterBalance,
  alerts,
  recommendations,
  village,
  onNavigate,
  onOpenHardwareModal,
}) => {
  const topAlert = alerts.find((a) => !a.isDismissed);
  const urgentRecommendations = recommendations.filter((r) => r.status !== 'COMPLETED').slice(0, 2);

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#1F5A48]/10 text-[#1F5A48] rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>Community Aquifer Intelligence</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1E2A28] leading-[1.15]">
            Know your groundwater. <br />
            <span className="text-[#1F5A48]">Act before it falls.</span>
          </h1>

          <p className="mt-3 text-base sm:text-lg text-[#1E2A28]/80 leading-relaxed">
            BhujalSetu bridges physical aquifer dynamics and community action.
            Track extraction, measure rainfall infiltration, and mobilize neighborhood recharge
            before critical seasonal deficits emerge.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="px-5 py-2.5 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-[#F5F1E8] font-semibold text-sm transition-colors flex items-center space-x-2 shadow-xs"
            >
              <span>View Action Priorities</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('balance')}
              className="px-4 py-2.5 rounded-lg bg-[#F5F1E8] hover:bg-[#ECE7DC] text-[#1E2A28] font-semibold text-sm border border-[#D8D2C4] transition-colors"
            >
              Examine Water Balance
            </button>
            <button
              type="button"
              onClick={onOpenHardwareModal}
              className="px-4 py-2.5 rounded-lg bg-transparent hover:bg-[#DCD6CA] text-[#1E2A28]/80 hover:text-[#1E2A28] font-medium text-xs border border-transparent underline transition-colors"
            >
              ESP32 Prototype Sensor Specs →
            </button>
          </div>
        </div>

        {/* Demo Mode Disclaimer Pill */}
        <div className="mt-6 pt-4 border-t border-[#D8D2C4] flex items-center space-x-2 text-xs text-[#B74A3B]">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="font-bold">
            DEMO DATA — NOT LIVE FIELD DATA.
          </span>
          <span className="text-[#1E2A28]/70 hidden sm:inline">
            Values shown are simulated baseline calculations for prototype demonstration.
          </span>
        </div>
      </section>

      {/* Core Philosophy Banner: MEASURE -> UNDERSTAND -> ACT -> RECHARGE */}
      <section className="bg-[#1E2A28] text-[#F5F1E8] rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold tracking-wider text-[#A7D7D7] uppercase">
              Core Operating Principle
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-[#2B3B38] px-3 py-2 rounded-lg border border-[#3E524D]">
              <span className="text-xs font-bold text-[#A7D7D7] block">1. MEASURE</span>
              <span className="text-[11px] text-[#F5F1E8]/70">Depth & Flow</span>
            </div>
            <div className="bg-[#2B3B38] px-3 py-2 rounded-lg border border-[#3E524D]">
              <span className="text-xs font-bold text-[#D9C6A4] block">2. UNDERSTAND</span>
              <span className="text-[11px] text-[#F5F1E8]/70">Balance Deficit</span>
            </div>
            <div className="bg-[#2B3B38] px-3 py-2 rounded-lg border border-[#3E524D]">
              <span className="text-xs font-bold text-[#C56B4C] block">3. ACT</span>
              <span className="text-[11px] text-[#F5F1E8]/70">Ration & Stagger</span>
            </div>
            <div className="bg-[#2B3B38] px-3 py-2 rounded-lg border border-[#3E524D]">
              <span className="text-xs font-bold text-[#A7D7D7] block">4. RECHARGE</span>
              <span className="text-[11px] text-[#F5F1E8]/70">Pits & Trenches</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Status Grid: Dial on Left, Aquifer Context on Right */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5">
          <GroundwaterDial
            waterLevelMeters={reading.depthMeters}
            changeMeters={reading.changeMeters}
            status={reading.status}
            historicalBaselineMeters={reading.historicalBaselineMeters}
            locationName={reading.locationName}
          />
        </div>

        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {/* Active Alert Spotlight */}
          {topAlert && (
            <div
              className={`p-5 rounded-xl border flex flex-col justify-between ${
                topAlert.severity === 'CRITICAL'
                  ? 'bg-[#B74A3B]/10 border-[#B74A3B]/40'
                  : 'bg-[#C56B4C]/10 border-[#C56B4C]/40'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldAlert
                      className={`w-5 h-5 ${
                        topAlert.severity === 'CRITICAL'
                          ? 'text-[#B74A3B]'
                          : 'text-[#C56B4C]'
                      }`}
                    />
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        topAlert.severity === 'CRITICAL'
                          ? 'bg-[#B74A3B] text-white'
                          : 'bg-[#C56B4C] text-white'
                      }`}
                    >
                      Alert • {topAlert.severity}
                    </span>
                  </div>
                  <span className="text-xs text-[#1E2A28]/60 font-medium">
                    {topAlert.timestamp}
                  </span>
                </div>
                <h4 className="mt-2 text-base font-bold text-[#1E2A28]">
                  {topAlert.title}
                </h4>
                <p className="mt-1 text-xs text-[#1E2A28]/80 leading-relaxed">
                  {topAlert.message}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-black/5 flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#1E2A28]/70">
                  Trigger: {topAlert.triggerMetric} ({topAlert.actualValue} vs threshold {topAlert.thresholdValue})
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('actions')}
                  className="text-xs font-bold text-[#1F5A48] hover:underline flex items-center space-x-1"
                >
                  <span>Resolve in Actions</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Aquifer Characteristics Panel */}
          <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2A28]/60">
                  Aquifer Hydrogeology Profile
                </span>
                <span className="text-xs font-semibold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded">
                  {village.participatingHouseholds} Households Active
                </span>
              </div>
              <h4 className="text-base font-bold text-[#1E2A28]">
                {village.name} ({village.district}, {village.state})
              </h4>
              <p className="text-xs text-[#1E2A28]/80 mt-1">
                <span className="font-semibold text-[#1E2A28]">Aquifer Formation:</span> {village.aquiferType}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#D8D2C4]">
              <div className="text-center p-2 rounded bg-[#F5F1E8]/70 border border-[#D8D2C4]/60">
                <span className="text-[10px] text-[#1E2A28]/60 block font-medium">Borewells Tracked</span>
                <span className="text-sm font-bold text-[#1E2A28]">{village.totalBorewellsTracked}</span>
              </div>
              <div className="text-center p-2 rounded bg-[#F5F1E8]/70 border border-[#D8D2C4]/60">
                <span className="text-[10px] text-[#1E2A28]/60 block font-medium">Recharge Pits</span>
                <span className="text-sm font-bold text-[#1F5A48]">{village.activeRechargeStructures}</span>
              </div>
              <div className="text-center p-2 rounded bg-[#F5F1E8]/70 border border-[#D8D2C4]/60">
                <span className="text-[10px] text-[#1E2A28]/60 block font-medium">Season Recharge</span>
                <span className="text-sm font-bold text-[#3B7C8A]">{(village.totalRechargedThisSeasonLiters / 1000).toLocaleString()} m³</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Important Measurements */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#1E2A28]">
              Daily Community Water Ledger
            </h2>
            <p className="text-xs text-[#1E2A28]/70">
              Computed 24-hour inputs vs extraction (Simulated prototype values)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('balance')}
            className="text-xs font-semibold text-[#1F5A48] hover:underline flex items-center space-x-1"
          >
            <span>Full Balance Breakdown</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <MetricCards waterBalance={waterBalance} rainfallMm={24.5} />
      </section>

      {/* Suggested Actions Preview */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#1F5A48]" />
            <h3 className="text-base font-bold text-[#1E2A28]">
              Urgent Community Action Recommendations
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('actions')}
            className="text-xs font-semibold text-[#1F5A48] hover:underline"
          >
            View all ({recommendations.length})
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {urgentRecommendations.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      rec.priority === 'HIGH'
                        ? 'bg-[#B74A3B] text-white'
                        : 'bg-[#C56B4C] text-white'
                    }`}
                  >
                    Priority {rec.priority}
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60 font-medium">
                    {rec.category}
                  </span>
                </div>
                <h4 className="mt-2 text-sm font-bold text-[#1E2A28]">
                  {rec.title}
                </h4>
                <p className="mt-1 text-xs text-[#1E2A28]/80 leading-relaxed">
                  {rec.suggestedAction}
                </p>
              </div>

              <div className="mt-3 pt-2 border-t border-[#D8D2C4]/60 flex items-center justify-between">
                <span className="text-[11px] text-[#1E2A28]/60 truncate max-w-[200px]">
                  Why: {rec.whyAppeared}
                </span>
                <button
                  type="button"
                  onClick={() => onNavigate('actions')}
                  className="text-xs font-bold text-[#1F5A48] hover:underline flex-shrink-0 ml-2"
                >
                  Take Action →
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Product Philosophy & Government Monitoring Distinction */}
      <section className="p-4 rounded-lg bg-[#D9C6A4]/25 border border-[#D9C6A4] text-xs text-[#1E2A28]/80 leading-relaxed">
        <p>
          <strong className="text-[#1E2A28]">Community Decision Layer:</strong> BhujalSetu does
          not replace central or state government groundwater survey piezometers. Instead, it provides a
          hyper-local community decision and participatory action layer that turns groundwater data into
          immediate village-level conservation and recharge operations.
        </p>
      </section>
    </div>
  );
};
