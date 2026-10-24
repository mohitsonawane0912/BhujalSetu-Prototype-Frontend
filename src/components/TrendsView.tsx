import React, { useState, useEffect } from 'react';
import {
  LineChart as LineChartIcon,
  Calendar,
  Info,
  TrendingDown,
  Layers,
  CloudRain,
  ArrowDownToLine,
  ArrowUpFromLine,
  Download,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { TimeRange } from '../types/groundwater';
import { BhujalSetuApi } from '../services/api';
import { downloadTrendsCsv } from '../utils/csvExport';

interface TrendsViewProps {
  initialRange?: TimeRange;
  villageName?: string;
}

export const TrendsView: React.FC<TrendsViewProps> = ({
  initialRange = '30d',
  villageName = 'Rampur Gram Panchayat',
}) => {
  const [range, setRange] = useState<TimeRange>(initialRange);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    BhujalSetuApi.getTrends(range).then((data) => {
      if (isMounted) {
        setTrendData(data);
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [range]);

  // Editorial custom tooltip for Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1E2A28] text-[#F5F1E8] p-3 rounded-lg shadow-lg border border-[#3E524D] text-xs">
          <div className="font-bold border-b border-[#3E524D] pb-1 text-[#A7D7D7]">
            {label}
          </div>
          <div className="mt-2 space-y-1">
            {payload.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between space-x-3">
                <span className="flex items-center space-x-1">
                  <span
                    className="w-2 h-2 rounded-full inline-block"
                    style={{ backgroundColor: item.color || item.fill }}
                  />
                  <span className="text-[#F5F1E8]/80">{item.name}:</span>
                </span>
                <span className="font-mono font-bold text-[#F5F1E8]">
                  {typeof item.value === 'number'
                    ? item.value.toLocaleString()
                    : item.value}{' '}
                  {item.unit || ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return null;
  };

  const handleDownloadCsv = () => {
    if (!trendData || trendData.length === 0) return;
    const result = downloadTrendsCsv(trendData, villageName, range);
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
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#3B7C8A] mb-1">
            <LineChartIcon className="w-3.5 h-3.5" />
            <span>Aquifer Dynamics</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
            Hydrological Trends
          </h1>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
            Historical time-series correlation between precipitation, pumping stress, and water table recovery.
          </p>
        </div>

        {/* Actions: Download Report & 7d / 30d / 90d Filter */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Download Report Button */}
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={loading || trendData.length === 0}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#EAE5DB] hover:bg-[#E2DDD2] text-[#1E2A28] border border-[#D8D2C4] text-xs font-semibold shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
            title="Export current trend data as formatted CSV for offline community reporting"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#1F5A48]" />
                <span className="text-[#1F5A48] font-bold">Downloaded CSV</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#3B7C8A]" />
                <span>Download Report (CSV)</span>
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
              <strong>CSV Report Exported:</strong> <code className="font-mono text-[11px] bg-[#1F5A48]/10 px-1 py-0.5 rounded">{downloadSuccess}</code> ({trendData.length} records ready for offline Pani Samiti audit).
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

      {/* Prominent Simulated Data Notice Banner */}
      <div className="p-3 rounded-lg bg-[#C56B4C]/15 border border-[#C56B4C]/30 flex items-center justify-between text-xs text-[#B74A3B]">
        <div className="flex items-center space-x-2">
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="font-bold">
            DEMO / SIMULATED TIME-SERIES DATA:
          </span>
          <span className="hidden md:inline text-[#1E2A28]/80">
            Charts display modeled seasonal variations to demonstrate dashboard visualization capabilities prior to live IoT gateway integration.
          </span>
        </div>
        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-[#B74A3B] text-white rounded">
          {range.toUpperCase()} Window
        </span>
      </div>

      {loading ? (
        <div className="py-24 text-center text-sm text-[#1E2A28]/60">
          Loading simulated time series...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CHART 1: Groundwater Level Over Time */}
          <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
                <div>
                  <h3 className="font-bold text-sm text-[#1E2A28]">
                    1. Groundwater Level Over Time
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Depth to water table in meters (deeper = lower water storage)
                  </span>
                </div>
                <span className="text-xs font-bold text-[#3B7C8A] bg-[#3B7C8A]/10 px-2 py-0.5 rounded">
                  Piezometer Depth
                </span>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="depthGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B7C8A" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B7C8A" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      tick={{ fontSize: 10, fill: '#1E2A28' }}
                      stroke="#D8D2C4"
                      unit="m"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                      y={17.5}
                      stroke="#C56B4C"
                      strokeDasharray="4 4"
                      label={{ value: 'Watch Depth: 17.5m', position: 'insideTopRight', fill: '#C56B4C', fontSize: 10 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="depthMeters"
                      name="Water Table Depth"
                      unit="m"
                      stroke="#3B7C8A"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#depthGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
              <span>Baseline: 17.5 m below ground</span>
              <span className="font-semibold text-[#B74A3B]">Recent trend: -0.6 m drop</span>
            </div>
          </div>

          {/* CHART 2: Water Extraction Over Time */}
          <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
                <div>
                  <h3 className="font-bold text-sm text-[#1E2A28]">
                    2. Community Water Extraction Over Time
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Daily total extraction volume across all monitored borewells (m³)
                  </span>
                </div>
                <div className="w-7 h-7 rounded-md bg-[#C56B4C]/15 text-[#C56B4C] flex items-center justify-center">
                  <ArrowUpFromLine className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#1E2A28' }}
                      stroke="#D8D2C4"
                      unit="kL"
                      tickFormatter={(val) => `${Math.round(val / 1000)}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine
                      y={42000}
                      stroke="#1F5A48"
                      strokeDasharray="4 4"
                      label={{ value: 'Sustainable Ceiling: 42 kL', position: 'insideTopLeft', fill: '#1F5A48', fontSize: 10 }}
                    />
                    <Bar
                      dataKey="waterExtractedLiters"
                      name="Extracted Water"
                      unit="L"
                      fill="#C56B4C"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
              <span>Avg Extraction: ~46,500 L/day</span>
              <span className="font-semibold text-[#C56B4C]">Peak: 54,000 L</span>
            </div>
          </div>

          {/* CHART 3: Rainfall vs Groundwater Level */}
          <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
                <div>
                  <h3 className="font-bold text-sm text-[#1E2A28]">
                    3. Rainfall Inflow vs Groundwater Level
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Dual axis: Rainfall bars (mm) and Aquifer depth recovery (m)
                  </span>
                </div>
                <div className="w-7 h-7 rounded-md bg-[#3B7C8A]/15 text-[#3B7C8A] flex items-center justify-center">
                  <CloudRain className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis
                      yAxisId="left"
                      orientation="left"
                      stroke="#3B7C8A"
                      tick={{ fontSize: 10, fill: '#3B7C8A' }}
                      unit="mm"
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#1F5A48"
                      tick={{ fontSize: 10, fill: '#1F5A48' }}
                      domain={['dataMin - 0.5', 'dataMax + 0.5']}
                      unit="m"
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                    <Bar
                      yAxisId="left"
                      dataKey="rainfallMm"
                      name="Precipitation"
                      unit="mm"
                      fill="#A7D7D7"
                      radius={[3, 3, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="depthMeters"
                      name="Depth to Water"
                      unit="m"
                      stroke="#1F5A48"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
              <span>Noticeable 24h recharge lag following precipitation pulses</span>
              <span className="font-semibold text-[#1F5A48]">Infiltration confirmed</span>
            </div>
          </div>

          {/* CHART 4: Managed Recharge Activity */}
          <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-[#D8D2C4]">
                <div>
                  <h3 className="font-bold text-sm text-[#1E2A28]">
                    4. Managed Recharge Infiltration Volume
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Volume channeled directly into sub-surface structures (Liters)
                  </span>
                </div>
                <div className="w-7 h-7 rounded-md bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
                  <ArrowDownToLine className="w-4 h-4" />
                </div>
              </div>

              <div className="h-64 mt-4 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" opacity={0.6} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#1E2A28' }} stroke="#D8D2C4" />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#1E2A28' }}
                      stroke="#D8D2C4"
                      unit="kL"
                      tickFormatter={(val) => `${Math.round(val / 1000)}`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar
                      dataKey="waterRechargedLiters"
                      name="Recharged Volume"
                      unit="L"
                      fill="#1F5A48"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-[#D8D2C4] flex items-center justify-between text-[11px] text-[#1E2A28]/70">
              <span>Cumulative Recharged: {(trendData.reduce((acc: number, curr: any) => acc + (curr.waterRechargedLiters || 0), 0) / 1000).toFixed(1)} m³</span>
              <span className="font-semibold text-[#1F5A48]">7 Active Pits</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
