import React from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Compass,
  ArrowRight,
  ShieldAlert,
  ArrowDownToLine,
  ArrowUpFromLine,
  Activity,
  Layers,
  ChevronRight,
  Info,
  Waves,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Clock,
  Radio,
  WifiOff,
} from 'lucide-react';
import {
  GroundwaterReading,
  WaterBalance,
  Alert,
  ActionRecommendation,
  VillageCommunity,
  NodePrototypeTelemetry,
  TelemetryConnectionStatus,
} from '../types/groundwater';
import { TabType } from './Navigation';

interface HomeViewProps {
  reading?: GroundwaterReading | null;
  waterBalance?: WaterBalance | null;
  alerts: Alert[];
  recommendations: ActionRecommendation[];
  village: VillageCommunity;
  onNavigate: (tab: TabType) => void;
  onOpenHardwareModal: () => void;
  nodeTelemetry: NodePrototypeTelemetry[];
  telemetryStatus: TelemetryConnectionStatus;
  telemetryError: string | null;
  lastTelemetryFetch: Date | null;
}

export const HomeView: React.FC<HomeViewProps> = ({
  reading,
  waterBalance,
  alerts,
  recommendations,
  village,
  onNavigate,
  onOpenHardwareModal,
  nodeTelemetry,
  telemetryStatus,
  telemetryError,
  lastTelemetryFetch,
}) => {
  const latestNode = (nodeId: NodePrototypeTelemetry['nodeId']) =>
    nodeTelemetry
      .filter((record) => record.nodeId === nodeId)
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))[0];

  const node1Latest = latestNode('node-1');
  const node2Latest = latestNode('node-2');

  const isStale = (record?: NodePrototypeTelemetry) => {
    if (!record) return false;
    const ageMs = Date.now() - new Date(record.receivedAt).getTime();
    return ageMs > 30000;
  };

  const flowChartData = [...nodeTelemetry]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((record) => ({
      time: new Date(record.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      recharge: record.nodeId === 'node-1' ? record.flow.flowLpm : null,
      extraction: record.nodeId === 'node-2' ? record.flow.flowLpm : null,
      source: record.dataSource,
    }));

  const levelChartData = [...nodeTelemetry]
    .filter((record) => record.nodeId === 'node-1' && record.waterLevel)
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((record) => ({
      time: new Date(record.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      levelCm: record.waterLevel!.levelCm,
    }));

  const formatTimestamp = (isoString?: string) => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-[#1F5A48]/10 text-[#1F5A48] rounded-full text-xs font-semibold uppercase tracking-wider mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>Two-Node Tabletop Prototype</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#1E2A28] leading-[1.15]">
            Tabletop Sensor Telemetry. <br />
            <span className="text-[#1F5A48]">Measured flow & tank level.</span>
          </h1>

          <p className="mt-3 text-base sm:text-lg text-[#1E2A28]/80 leading-relaxed">
            Real-time telemetry from two ESP32 prototype nodes. Node 1 monitors the tabletop recharge line flow and tank water level (via ultrasonic HC-SR04). Node 2 monitors pump extraction flow. The pump is switched manually for demonstration.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onOpenHardwareModal}
              className="px-5 py-2.5 rounded-lg bg-[#1F5A48] hover:bg-[#184638] text-[#F5F1E8] font-semibold text-sm transition-colors flex items-center space-x-2 shadow-xs"
            >
              <span>ESP32 Prototype Sensor Specs</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('balance')}
              className="px-4 py-2.5 rounded-lg bg-[#F5F1E8] hover:bg-[#ECE7DC] text-[#1E2A28] font-semibold text-sm border border-[#D8D2C4] transition-colors"
            >
              Examine Water Balance Baseline
            </button>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="px-4 py-2.5 rounded-lg bg-transparent hover:bg-[#DCD6CA] text-[#1E2A28]/80 hover:text-[#1E2A28] font-medium text-xs border border-transparent underline transition-colors"
            >
              View Community Actions →
            </button>
          </div>
        </div>

        {/* Prototype Scope Disclaimer Pill */}
        <div className="mt-6 pt-4 border-t border-[#D8D2C4] flex items-center space-x-2 text-xs text-[#B74A3B]">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="font-bold">
            TABLETOP DEMONSTRATION ONLY:
          </span>
          <span className="text-[#1E2A28]/70">
            Readings measure tabletop bench flow and tank level in centimetres. They are not groundwater depth, do not infer community aquifer storage, and do not calculate scientific groundwater balance.
          </span>
        </div>
      </section>

      {/* Telemetry Connection & Access Status Banner */}
      <section aria-live="polite">
        {telemetryStatus === 'signed-out' && (
          <div className="p-4 rounded-xl bg-[#D9C6A4]/30 border border-[#D9C6A4] flex items-center justify-between gap-3 text-xs text-[#1E2A28]">
            <div className="flex items-center space-x-3">
              <WifiOff className="w-5 h-5 text-[#C56B4C] flex-shrink-0" />
              <div>
                <strong className="font-bold text-[#1E2A28] block">Sign-in Required for Live Telemetry</strong>
                <p className="text-[#1E2A28]/70 mt-0.5">
                  Sign in with your approved Firebase account to read live prototype readings for <span className="font-semibold text-[#1E2A28]">{village.name}</span>. Telemetry access is restricted to verified community members.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#D8D2C4] font-bold uppercase text-[10px] text-[#1E2A28]/70 flex-shrink-0">
              Signed Out
            </span>
          </div>
        )}

        {telemetryStatus === 'unauthorized' && (
          <div className="p-4 rounded-xl bg-[#B74A3B]/10 border border-[#B74A3B]/30 flex items-center justify-between gap-3 text-xs text-[#1E2A28]">
            <div className="flex items-center space-x-3">
              <ShieldAlert className="w-5 h-5 text-[#B74A3B] flex-shrink-0" />
              <div>
                <strong className="font-bold text-[#B74A3B] block">Access Denied: Community Membership Required</strong>
                <p className="text-[#1E2A28]/80 mt-0.5">
                  You are signed in, but your account does not have confirmed active membership in <span className="font-semibold text-[#1E2A28]">{village.name}</span>. Telemetry history is strictly scoped to verified community members in Firestore (<code className="bg-[#B74A3B]/10 px-1 py-0.5 rounded text-[11px]">community_memberships/[uid]_{village.id}</code>).
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#B74A3B] text-white font-bold uppercase text-[10px] flex-shrink-0">
              Unauthorized
            </span>
          </div>
        )}

        {telemetryStatus === 'backend-error' && (
          <div className="p-4 rounded-xl bg-[#C56B4C]/15 border border-[#C56B4C]/30 flex items-center justify-between gap-3 text-xs text-[#1E2A28]">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-[#C56B4C] flex-shrink-0" />
              <div>
                <strong className="font-bold text-[#B74A3B] block">Backend Telemetry Service Unavailable</strong>
                <p className="text-[#1E2A28]/80 mt-0.5">
                  {telemetryError || 'Unable to load sensor records from backend service.'} If Firestore Admin credentials are not yet configured on the server, live telemetry persistence returns HTTP 503.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#C56B4C] text-white font-bold uppercase text-[10px] flex-shrink-0">
              Storage Unavailable
            </span>
          </div>
        )}

        {telemetryStatus === 'loading' && (
          <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center space-x-3 text-xs text-[#1E2A28]/70 animate-pulse">
            <Radio className="w-4 h-4 text-[#1F5A48] animate-spin" />
            <span>Loading prototype sensor telemetry for {village.name}...</span>
          </div>
        )}

        {telemetryStatus === 'no-data' && (
          <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex items-center justify-between gap-3 text-xs text-[#1E2A28]">
            <div className="flex items-center space-x-3">
              <Info className="w-5 h-5 text-[#3B7C8A] flex-shrink-0" />
              <div>
                <strong className="font-bold text-[#1E2A28] block">Waiting for Device Telemetry</strong>
                <p className="text-[#1E2A28]/70 mt-0.5">
                  Connected to backend for <span className="font-semibold text-[#1E2A28]">{village.name}</span>, but no measured packets have been recorded yet. Power on ESP32 Node 1 and Node 2 to stream live sensor readings.
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded bg-[#D8D2C4] text-[#1E2A28]/70 font-bold uppercase text-[10px] flex-shrink-0">
              No Data Yet
            </span>
          </div>
        )}

        {telemetryStatus === 'ready' && (
          <div className="p-3.5 rounded-xl bg-[#1F5A48]/10 border border-[#1F5A48]/25 flex items-center justify-between gap-3 text-xs text-[#1E2A28]">
            <div className="flex items-center space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
              <span>
                <strong className="font-bold text-[#1F5A48]">Live Prototype Telemetry Active:</strong> Sourced from authenticated Node 1 & Node 2 packets for <strong className="text-[#1E2A28]">{village.name}</strong>.
              </span>
            </div>
            {lastTelemetryFetch && (
              <span className="text-[11px] text-[#1E2A28]/60 flex-shrink-0 hidden sm:inline">
                Refreshed at {lastTelemetryFetch.toLocaleTimeString()}
              </span>
            )}
          </div>
        )}
      </section>

      {/* 4 Authentic Tabletop Prototype Metric Cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-[#1E2A28]">
              Prototype Sensor Readings
            </h2>
            <p className="text-xs text-[#1E2A28]/70">
              Real-time measurements from Node 1 (recharge & tank level) and Node 2 (extraction). No generated demo values.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#D8D2C4] text-[#1E2A28]/70">
            Hardware Measured
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Node 1 Flow */}
          <div className="p-5 rounded-xl border bg-[#EAE5DB] border-[#D8D2C4] flex flex-col justify-between hover:shadow-xs transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E2A28]/70">
                  Node 1 · Recharge Flow
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#1F5A48]/10 text-[#1F5A48]">
                  <ArrowDownToLine className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                {node1Latest ? (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
                      {node1Latest.flow.flowLpm.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-[#1E2A28]/60">L/min</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-[#1E2A28]/50">Waiting for device</span>
                )}
              </div>
              <p className="text-[11px] text-[#1E2A28]/60 mt-0.5">
                {node1Latest
                  ? `${node1Latest.flow.totalLiters.toFixed(2)} L session · ${node1Latest.flow.pulses} pulses (5s window)`
                  : 'Awaiting first packet'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D8D2C4]/80 flex items-center justify-between text-[10px]">
              <span className="text-[#1E2A28]/60 truncate">
                {node1Latest ? `Captured: ${formatTimestamp(node1Latest.capturedAt)}` : 'YF-S201 on inlet'}
              </span>
              <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                node1Latest
                  ? isStale(node1Latest)
                    ? 'bg-[#C56B4C]/20 text-[#B74A3B]'
                    : 'bg-[#1F5A48]/15 text-[#1F5A48]'
                  : 'bg-[#D8D2C4] text-[#1E2A28]/60'
              }`}>
                {node1Latest ? (isStale(node1Latest) ? 'Stale' : 'Measured') : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Card 2: Node 1 Water Level */}
          <div className="p-5 rounded-xl border bg-[#EAE5DB] border-[#D8D2C4] flex flex-col justify-between hover:shadow-xs transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E2A28]/70">
                  Node 1 · Tabletop Tank Level
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#3B7C8A]/10 text-[#3B7C8A]">
                  <Waves className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                {node1Latest?.waterLevel ? (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
                      {node1Latest.waterLevel.levelCm.toFixed(1)}
                    </span>
                    <span className="text-xs font-bold text-[#1E2A28]/60">cm</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-[#1E2A28]/50">Waiting for device</span>
                )}
              </div>
              <p className="text-[11px] text-[#1E2A28]/60 mt-0.5">
                {node1Latest?.waterLevel
                  ? `Sensor gap: ${node1Latest.waterLevel.distanceCm.toFixed(1)} cm to water`
                  : 'HC-SR04 ultrasonic echo'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D8D2C4]/80 flex items-center justify-between text-[10px]">
              <span className="text-[#1E2A28]/60 truncate">
                {node1Latest?.waterLevel ? `Received: ${formatTimestamp(node1Latest.receivedAt)}` : 'Tabletop tank depth'}
              </span>
              <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                node1Latest?.waterLevel
                  ? 'bg-[#1F5A48]/15 text-[#1F5A48]'
                  : 'bg-[#D8D2C4] text-[#1E2A28]/60'
              }`}>
                {node1Latest?.waterLevel ? 'Measured' : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Card 3: Node 2 Extraction Flow */}
          <div className="p-5 rounded-xl border bg-[#EAE5DB] border-[#D8D2C4] flex flex-col justify-between hover:shadow-xs transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E2A28]/70">
                  Node 2 · Pump Extraction Flow
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#C56B4C]/10 text-[#C56B4C]">
                  <ArrowUpFromLine className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline space-x-1.5">
                {node2Latest ? (
                  <>
                    <span className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
                      {node2Latest.flow.flowLpm.toFixed(2)}
                    </span>
                    <span className="text-xs font-bold text-[#1E2A28]/60">L/min</span>
                  </>
                ) : (
                  <span className="text-lg font-bold text-[#1E2A28]/50">Waiting for device</span>
                )}
              </div>
              <p className="text-[11px] text-[#1E2A28]/60 mt-0.5">
                {node2Latest
                  ? `${node2Latest.flow.totalLiters.toFixed(2)} L session · ${node2Latest.flow.pulses} pulses (5s window)`
                  : 'Manual pump extraction'}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D8D2C4]/80 flex items-center justify-between text-[10px]">
              <span className="text-[#1E2A28]/60 truncate">
                {node2Latest ? `Captured: ${formatTimestamp(node2Latest.capturedAt)}` : 'YF-S201 on hose'}
              </span>
              <span className={`font-bold uppercase px-1.5 py-0.5 rounded ${
                node2Latest
                  ? isStale(node2Latest)
                    ? 'bg-[#C56B4C]/20 text-[#B74A3B]'
                    : 'bg-[#1F5A48]/15 text-[#1F5A48]'
                  : 'bg-[#D8D2C4] text-[#1E2A28]/60'
              }`}>
                {node2Latest ? (isStale(node2Latest) ? 'Stale' : 'Measured') : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Card 4: Node Cumulative Totals (Shown Separately) */}
          <div className="p-5 rounded-xl border bg-[#EAE5DB] border-[#D8D2C4] flex flex-col justify-between hover:shadow-xs transition-all">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#1E2A28]/70">
                  Node Session Totals
                </span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#1E2A28]/10 text-[#1E2A28]">
                  <Scale className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#1E2A28]/70 font-medium">Node 1 (Inflow):</span>
                  <span className="font-bold text-sm text-[#1F5A48]">
                    {node1Latest ? `${node1Latest.flow.totalLiters.toFixed(2)} L` : 'Waiting'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs">
                  <span className="text-[#1E2A28]/70 font-medium">Node 2 (Outflow):</span>
                  <span className="font-bold text-sm text-[#C56B4C]">
                    {node2Latest ? `${node2Latest.flow.totalLiters.toFixed(2)} L` : 'Waiting'}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-[#1E2A28]/60 mt-1.5 leading-tight">
                Counters reset independently on ESP32 reboot. They are not lifetime counters and are never subtracted directly.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[#D8D2C4]/80 flex items-center justify-between text-[10px]">
              <span className="text-[#1E2A28]/60 truncate">
                Independent totals
              </span>
              <span className="font-bold uppercase px-1.5 py-0.5 rounded bg-[#D8D2C4] text-[#1E2A28]/70">
                Separated Totals
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Node Detailed Packet Inspection Cards */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs" aria-live="polite">
        <div className="flex items-center justify-between gap-3 border-b border-[#D8D2C4] pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#1F5A48]" />
            <h2 className="text-sm font-bold">Node Telemetry Packet Details</h2>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded bg-[#D8D2C4] text-[#1E2A28]/70">
            Per-Node Verified Source
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
          {/* Node 1 Detail */}
          <div className="rounded-lg border border-[#D8D2C4] bg-[#F5F1E8] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#1E2A28]">Node 1 · Recharge Line & Tank Level</h3>
                <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${
                  node1Latest
                    ? node1Latest.dataSource === 'measured'
                      ? 'bg-[#1F5A48]/10 text-[#1F5A48]'
                      : 'bg-[#C56B4C]/15 text-[#B74A3B]'
                    : 'bg-[#D8D2C4] text-[#1E2A28]/70'
                }`}>
                  {node1Latest ? (node1Latest.dataSource === 'measured' ? 'Measured' : 'Simulated') : 'Waiting'}
                </span>
              </div>

              {node1Latest ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Recent Flow Rate:</span>
                    <span className="font-bold text-base text-[#1E2A28]">
                      {node1Latest.flow.flowLpm.toFixed(2)} L/min
                      <span className="text-[10px] text-[#1E2A28]/50 font-normal ml-1">(0.00 when idle)</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Sampling Window Pulses:</span>
                    <span className="font-semibold text-[#1E2A28]">
                      {node1Latest.flow.pulses} pulses (last 5s interval)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Board Session Volume:</span>
                    <span className="font-semibold text-[#1E2A28]">
                      {node1Latest.flow.totalLiters.toFixed(2)} L (resets on reboot)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Tabletop Tank Water Level:</span>
                    <span className="font-semibold text-[#1F5A48]">
                      {node1Latest.waterLevel
                        ? `${node1Latest.waterLevel.levelCm.toFixed(1)} cm (gap ${node1Latest.waterLevel.distanceCm.toFixed(1)} cm)`
                        : 'Unavailable'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-[#1E2A28]/60 pt-1">
                    <span>Captured:</span>
                    <span>{formatTimestamp(node1Latest.capturedAt)} ({new Date(node1Latest.capturedAt).toLocaleDateString()})</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-[#1E2A28]/60">
                    <span>Device:</span>
                    <span>{node1Latest.deviceId} · {isStale(node1Latest) ? '⚠️ Stale (>30s)' : '✓ Active'}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-md bg-[#EAE5DB]/70 border border-[#D8D2C4]/70 text-center">
                  <p className="text-xs font-semibold text-[#1E2A28]/70">Waiting for Node 1 device</p>
                  <p className="text-[11px] text-[#1E2A28]/55 mt-1">
                    No packet received yet. Values will populate once ESP32 Node 1 sends measured readings to <code className="text-[#1F5A48] font-mono">/api/v1/telemetry</code>.
                  </p>
                </div>
              )}
            </div>
            <p className="pt-3 text-[10px] text-[#1E2A28]/55 border-t border-[#D8D2C4]/60 mt-3">
              Node 1 hardware: YF-S201 flow sensor on GPIO 27 + HC-SR04 ultrasonic sensor (TRIG 5, ECHO 34 via 5V-to-3.3V divider).
            </p>
          </div>

          {/* Node 2 Detail */}
          <div className="rounded-lg border border-[#D8D2C4] bg-[#F5F1E8] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-[#1E2A28]">Node 2 · Pump Extraction Line</h3>
                <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded ${
                  node2Latest
                    ? node2Latest.dataSource === 'measured'
                      ? 'bg-[#1F5A48]/10 text-[#1F5A48]'
                      : 'bg-[#C56B4C]/15 text-[#B74A3B]'
                    : 'bg-[#D8D2C4] text-[#1E2A28]/70'
                }`}>
                  {node2Latest ? (node2Latest.dataSource === 'measured' ? 'Measured' : 'Simulated') : 'Waiting'}
                </span>
              </div>

              {node2Latest ? (
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Recent Flow Rate:</span>
                    <span className="font-bold text-base text-[#1E2A28]">
                      {node2Latest.flow.flowLpm.toFixed(2)} L/min
                      <span className="text-[10px] text-[#1E2A28]/50 font-normal ml-1">(0.00 when idle)</span>
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Sampling Window Pulses:</span>
                    <span className="font-semibold text-[#1E2A28]">
                      {node2Latest.flow.pulses} pulses (last 5s interval)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Board Session Volume:</span>
                    <span className="font-semibold text-[#1E2A28]">
                      {node2Latest.flow.totalLiters.toFixed(2)} L (resets on reboot)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-[#D8D2C4]/50 pb-2">
                    <span className="text-[#1E2A28]/70">Water Level Sensor:</span>
                    <span className="font-medium text-[#1E2A28]/60 italic">
                      None (Node 2 reports extraction flow only)
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-[#1E2A28]/60 pt-1">
                    <span>Captured:</span>
                    <span>{formatTimestamp(node2Latest.capturedAt)} ({new Date(node2Latest.capturedAt).toLocaleDateString()})</span>
                  </div>
                  <div className="flex items-baseline justify-between text-[11px] text-[#1E2A28]/60">
                    <span>Device:</span>
                    <span>{node2Latest.deviceId} · {isStale(node2Latest) ? '⚠️ Stale (>30s)' : '✓ Active'}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-4 rounded-md bg-[#EAE5DB]/70 border border-[#D8D2C4]/70 text-center">
                  <p className="text-xs font-semibold text-[#1E2A28]/70">Waiting for Node 2 device</p>
                  <p className="text-[11px] text-[#1E2A28]/55 mt-1">
                    No packet received yet. Values will populate once ESP32 Node 2 sends measured readings to <code className="text-[#1F5A48] font-mono">/api/v1/telemetry</code>.
                  </p>
                </div>
              )}
            </div>
            <p className="pt-3 text-[10px] text-[#1E2A28]/55 border-t border-[#D8D2C4]/60 mt-3">
              Node 2 hardware: YF-S201 flow sensor on GPIO 27. Pump is switched manually for demonstration; no automated relay status.
            </p>
          </div>
        </div>

        {/* Real Sensor History Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-5">
          {/* Flow Rate Chart */}
          <div className="rounded-lg border border-[#D8D2C4] bg-[#F5F1E8] p-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-[#1E2A28]">Prototype Flow History · L/min</h3>
              <span className="text-[10px] text-[#1E2A28]/60 font-medium">
                {flowChartData.length} records
              </span>
            </div>
            {flowChartData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={flowChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="recharge" name="Node 1 recharge flow" stroke="#1F5A48" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="extraction" name="Node 2 extraction flow" stroke="#C56B4C" strokeWidth={2} dot={false} connectNulls />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-center p-4">
                <Radio className="w-6 h-6 text-[#1E2A28]/30 mb-2" />
                <p className="text-xs font-medium text-[#1E2A28]/60">Waiting for device readings to plot flow history.</p>
                <p className="text-[10px] text-[#1E2A28]/45 mt-0.5">Records will be plotted in real-time as packets are ingested.</p>
              </div>
            )}
          </div>

          {/* Water Level Chart */}
          <div className="rounded-lg border border-[#D8D2C4] bg-[#F5F1E8] p-4">
            <div className="flex items-center justify-between pb-2">
              <h3 className="text-xs font-bold text-[#1E2A28]">Node 1 Tabletop Tank Level · cm</h3>
              <span className="text-[10px] text-[#1E2A28]/60 font-medium">
                {levelChartData.length} records
              </span>
            </div>
            {levelChartData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={levelChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="levelCm" name="Tank water level (cm)" stroke="#3B7C8A" strokeWidth={2} dot={false} />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-56 flex flex-col items-center justify-center text-center p-4">
                <Waves className="w-6 h-6 text-[#1E2A28]/30 mb-2" />
                <p className="text-xs font-medium text-[#1E2A28]/60">Waiting for Node 1 water-level readings to plot tank level history.</p>
                <p className="text-[10px] text-[#1E2A28]/45 mt-0.5">Reports distance to water surface in tabletop reservoir (not aquifer depth).</p>
              </div>
            )}
          </div>
        </div>

        <p className="pt-3 text-[10px] text-[#1E2A28]/55">
          These charts use authenticated telemetry history stored in Firestore for {village.name}. They reflect tabletop sensor measurements only and do not alter separate community aquifer records.
        </p>
      </section>

      {/* Community Planning Modules (Explicitly Distinct from Tabletop Sensors) */}
      <section className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#1E2A28]/60">
                Community Planning Modules
              </span>
              <span className="text-[10px] font-semibold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded">
                Separate from Prototype
              </span>
            </div>
            <h3 className="text-base font-bold text-[#1E2A28] mt-1">
              {village.name} ({village.district}, {village.state})
            </h3>
          </div>
          <p className="text-xs text-[#1E2A28]/70 max-w-md">
            Aquifer baselines, community budgets, and collective actions are recorded separately from the two-node bench prototype.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-[#D8D2C4]">
          <button
            type="button"
            onClick={() => onNavigate('balance')}
            className="flex items-center justify-between p-3.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] hover:border-[#1F5A48]/40 transition-colors text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#1F5A48]/10 text-[#1F5A48] flex items-center justify-center flex-shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1E2A28] group-hover:text-[#1F5A48] block transition-colors">
                  Water Balance Baseline
                </span>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Modeled monsoon supply & seasonal extraction estimation
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#1E2A28]/40 group-hover:text-[#1F5A48] transition-colors flex-shrink-0" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('actions')}
            className="flex items-center justify-between p-3.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] hover:border-[#1F5A48]/40 transition-colors text-left group"
          >
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-md bg-[#3B7C8A]/10 text-[#3B7C8A] flex items-center justify-center flex-shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-[#1E2A28] group-hover:text-[#1F5A48] block transition-colors">
                  Community Action Tracker
                </span>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Participatory recharge structures and collective initiatives
                </span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#1E2A28]/40 group-hover:text-[#1F5A48] transition-colors flex-shrink-0" />
          </button>
        </div>

        <p className="text-[11px] text-[#1E2A28]/60 mt-3 pt-2 border-t border-[#D8D2C4]/50">
          <strong>Physical Boundary:</strong> Tabletop sensors measure bench flow and tank level only. They do not calculate aquifer depth, water balance, or GEM/Water Credits.
        </p>
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
