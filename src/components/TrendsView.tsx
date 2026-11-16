import React, { useState, useEffect } from 'react';
import {
  LineChart as LineChartIcon,
  Calendar,
  Info,
  Radio,
  Layers,
  Waves,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Check,
  Activity,
  Scale,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TimeRange, NodePrototypeTelemetry, TelemetryConnectionStatus } from '../types/groundwater';
import { downloadMeasuredTelemetryCsv } from '../utils/csvExport';

interface TrendsViewProps {
  initialRange?: TimeRange;
  villageName?: string;
  villageId?: string;
  nodeTelemetry?: NodePrototypeTelemetry[];
  telemetryStatus?: TelemetryConnectionStatus;
}

export const TrendsView: React.FC<TrendsViewProps> = ({
  initialRange = '30d',
  villageName = 'Rampur Gram Panchayat',
  villageId = 'village-rampur-04',
  nodeTelemetry = [],
  telemetryStatus = 'ready',
}) => {
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  // Filter only measured telemetry records within the requested window
  const measuredRecords = nodeTelemetry.filter((r) => r.dataSource === 'measured');

  const filteredRecords = measuredRecords.filter((record) => {
    const recordTime = new Date(record.capturedAt).getTime();
    if (isNaN(recordTime)) return true;
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return recordTime >= cutoff;
  });

  const sortedRecords = [...filteredRecords].sort((a, b) =>
    a.capturedAt.localeCompare(b.capturedAt)
  );

  // Flow rate history (Node 1 recharge vs Node 2 extraction)
  const flowRateData = sortedRecords.map((r) => ({
    time: new Date(r.capturedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    node1Flow: r.nodeId === 'node-1' ? r.flow.flowLpm : null,
    node2Flow: r.nodeId === 'node-2' ? r.flow.flowLpm : null,
  }));

  // Tank water level history (Node 1 HC-SR04 in cm)
  const tankLevelData = sortedRecords
    .filter((r) => r.nodeId === 'node-1' && r.waterLevel)
    .map((r) => ({
      time: new Date(r.capturedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      levelCm: r.waterLevel!.levelCm,
      distanceCm: r.waterLevel!.distanceCm,
    }));

  // Cumulative session volume history (Node 1 vs Node 2)
  const volumeData = sortedRecords.map((r) => ({
    time: new Date(r.capturedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    node1Total: r.nodeId === 'node-1' ? r.flow.totalLiters : null,
    node2Total: r.nodeId === 'node-2' ? r.flow.totalLiters : null,
  }));

  // Pulse frequency history (Hz)
  const frequencyData = sortedRecords.map((r) => ({
    time: new Date(r.capturedAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
    node1Hz: r.nodeId === 'node-1' ? r.flow.frequencyHz : null,
    node2Hz: r.nodeId === 'node-2' ? r.flow.frequencyHz : null,
  }));

  const handleDownloadCsv = () => {
    if (sortedRecords.length === 0) return;
    const result = downloadMeasuredTelemetryCsv(sortedRecords, villageName, range);
    setDownloadSuccess(result.filename);
    setTimeout(() => {
      setDownloadSuccess(null);
    }, 4000);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8D2C4]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Two-Node Hardware History</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
            Measured Prototype Trends
          </h1>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
            Historical time-series telemetry from authenticated Node 1 and Node 2 hardware packets.
          </p>
        </div>

        {/* Actions: Download Report & 7d / 30d / 90d Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Report Button */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={sortedRecords.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#EAE5DB] hover:bg-[#E2DDD2] text-[#1E2A28] border border-[#D8D2C4] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title={sortedRecords.length === 0 ? 'No measured records available to export' : 'Export verified telemetry to CSV'}
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1F5A48]" />
                <span className="text-[#1F5A48] font-bold">Downloaded CSV</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#3B7C8A]" />
                <span>Export Sensor CSV ({sortedRecords.length})</span>
              </>
            )}
          </button>

          {/* 7d / 30d / 90d Filter */}
          <div className="inline-flex p-1 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4]">
            {(['7d', '30d', '90d'] as TimeRange[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${
                  range === r
                    ? 'bg-[#1F5A48] text-[#F5F1E8] shadow-xs'
                    : 'text-[#1E2A28]/70 hover:text-[#1E2A28]'
                }`}
              >
                {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Download Success Confirmation Toast */}
      {downloadSuccess && (
        <div className="p-3 rounded-lg bg-[#1F5A48]/10 border border-[#1F5A48]/30 flex items-center justify-between text-xs text-[#1F5A48]">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 flex-shrink-0" />
            <span>
              <strong>CSV Report Exported:</strong> <code className="font-mono text-[11px] bg-[#1F5A48]/10 px-1 py-0.5 rounded">{downloadSuccess}</code> ({sortedRecords.length} measured records exported).
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadSuccess(null)}
            className="text-[#1F5A48] hover:opacity-70 text-xs font-bold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Physical Boundary & Data Source Notice */}
      <div className="p-3.5 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] flex items-center justify-between text-xs text-[#1E2A28]">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 text-[#1F5A48] flex-shrink-0" />
          <span>
            <strong className="text-[#1E2A28]">Authenticated Prototype Telemetry:</strong> Charts display verified records from Node 1 (recharge flow & tabletop tank level) and Node 2 (pump extraction flow) for <strong>{villageName}</strong>. Tabletop sensors measure bench flow only; they do not calculate aquifer depth or community water balance.
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-[#1F5A48]/10 text-[#1F5A48] rounded hidden sm:inline-block">
          {sortedRecords.length} Measured Records
        </span>
      </div>

      {/* 4 Authentic Measured Sensor Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Flow Rate History (L/min) */}
        <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
              <div>
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  1. Prototype Flow Rate History
                </h3>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Real-time flow rate in Litres per minute (YF-S201 turbines)
                </span>
              </div>
              <span className="text-xs font-bold text-[#1F5A48] bg-[#1F5A48]/10 px-2 py-0.5 rounded">
                L/min
              </span>
            </div>

            <div className="h-64 mt-4 w-full">
              {flowRateData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={flowRateData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" unit=" L/m" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="node1Flow"
                      name="Node 1 Recharge Flow"
                      stroke="#1F5A48"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="node2Flow"
                      name="Node 2 Extraction Flow"
                      stroke="#C56B4C"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Radio className="w-8 h-8 text-[#1E2A28]/30 mb-2" />
                  <p className="text-xs font-semibold text-[#1E2A28]/70">
                    Waiting for measured flow history for {villageName}.
                  </p>
                  <p className="text-[11px] text-[#1E2A28]/50 mt-1 max-w-sm">
                    No flow packets recorded in this time range. ESP32 Node 1 and Node 2 must be transmitting measured readings.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
            <span>Inlet (Node 1) vs Extraction Hose (Node 2)</span>
            <span className="font-semibold text-[#1F5A48]">{flowRateData.length} samples</span>
          </div>
        </div>

        {/* CHART 2: Tabletop Tank Water Level (cm) */}
        <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
              <div>
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  2. Tabletop Tank Water Level
                </h3>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Node 1 HC-SR04 ultrasonic echo distance to tank water surface (cm)
                </span>
              </div>
              <span className="text-xs font-bold text-[#3B7C8A] bg-[#3B7C8A]/10 px-2 py-0.5 rounded">
                Tank Level (cm)
              </span>
            </div>

            <div className="h-64 mt-4 w-full">
              {tankLevelData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tankLevelData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="tankLevelGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B7C8A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B7C8A" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" unit=" cm" />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="levelCm"
                      name="Tank Water Level"
                      unit=" cm"
                      stroke="#3B7C8A"
                      strokeWidth={2}
                      fill="url(#tankLevelGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Waves className="w-8 h-8 text-[#1E2A28]/30 mb-2" />
                  <p className="text-xs font-semibold text-[#1E2A28]/70">
                    Waiting for Node 1 tank level readings.
                  </p>
                  <p className="text-[11px] text-[#1E2A28]/50 mt-1 max-w-sm">
                    Measures tabletop bench tank depth in centimetres (not community aquifer depth).
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
            <span>Tabletop reservoir depth only</span>
            <span className="font-semibold text-[#3B7C8A]">{tankLevelData.length} samples</span>
          </div>
        </div>

        {/* CHART 3: Cumulative Volume Ingested (Liters) */}
        <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
              <div>
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  3. Cumulative Session Volume
                </h3>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Independent session pulse totals recorded per microcontroller (Liters)
                </span>
              </div>
              <div className="w-7 h-7 rounded-md bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
            </div>

            <div className="h-64 mt-4 w-full">
              {volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={volumeData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" unit=" L" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="node1Total"
                      name="Node 1 Inflow Total"
                      stroke="#1F5A48"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="node2Total"
                      name="Node 2 Outflow Total"
                      stroke="#C56B4C"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Scale className="w-8 h-8 text-[#1E2A28]/30 mb-2" />
                  <p className="text-xs font-semibold text-[#1E2A28]/70">
                    Waiting for session volume records.
                  </p>
                  <p className="text-[11px] text-[#1E2A28]/50 mt-1 max-w-sm">
                    Microcontroller volume counters reset independently upon power-cycling each board.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
            <span>Independent node counters shown separately</span>
            <span className="font-semibold text-[#1E2A28]/70">{volumeData.length} records</span>
          </div>
        </div>

        {/* CHART 4: Flow Pulse Frequency (Hz) */}
        <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
              <div>
                <h3 className="font-bold text-sm text-[#1E2A28]">
                  4. Flow Turbine Pulse Frequency
                </h3>
                <span className="text-[11px] text-[#1E2A28]/60">
                  Hall effect sensor interrupt pulse frequency across sampling windows (Hz)
                </span>
              </div>
              <div className="w-7 h-7 rounded-md bg-[#3B7C8A]/15 text-[#3B7C8A] flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
            </div>

            <div className="h-64 mt-4 w-full">
              {frequencyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={frequencyData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="time" minTickGap={28} tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis tick={{ fontSize: 9, fill: '#1E2A28' }} stroke="#D8D2C4" unit=" Hz" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                    <Line
                      type="monotone"
                      dataKey="node1Hz"
                      name="Node 1 Pulse Freq (Hz)"
                      stroke="#1F5A48"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="node2Hz"
                      name="Node 2 Pulse Freq (Hz)"
                      stroke="#C56B4C"
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <Activity className="w-8 h-8 text-[#1E2A28]/30 mb-2" />
                  <p className="text-xs font-semibold text-[#1E2A28]/70">
                    Waiting for turbine frequency records.
                  </p>
                  <p className="text-[11px] text-[#1E2A28]/50 mt-1 max-w-sm">
                    Interrupt pulse frequencies will plot as water passes through the YF-S201 sensors.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
            <span>Physical turbine interrupt signals</span>
            <span className="font-semibold text-[#1E2A28]/70">{frequencyData.length} records</span>
          </div>
        </div>
      </div>
    </div>
  );
};
