import React, { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  ArrowDownToLine,
  ArrowUpFromLine,
  Filter,
  Calculator,
  Info,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Award,
  Coins,
  Droplets,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  WaterBalance,
  BalancePeriod,
  WaterCreditSummary,
  WaterCreditLedgerEntry,
} from '../types/groundwater';
import { calculateRechargeVolume } from '../utils/groundwaterLogic';
import { useAuth } from '../context/AuthContext';
import { BhujalSetuApi as apiService } from '../services/api';

interface WaterBalanceViewProps {
  currentBalance: WaterBalance | null;
  selectedPeriod: BalancePeriod;
  onPeriodChange: (period: BalancePeriod) => void;
  villageId?: string;
}

export const WaterBalanceView: React.FC<WaterBalanceViewProps> = ({
  currentBalance,
  selectedPeriod,
  onPeriodChange,
  villageId,
}) => {
  const { user, token } = useAuth();
  const effectiveVillageId = villageId || user?.communityId || 'village-rampur-04';

  // Water Credits prototype state
  const [creditsSummary, setCreditsSummary] = useState<WaterCreditSummary | null>(null);
  const [creditsHistory, setCreditsHistory] = useState<WaterCreditLedgerEntry[]>([]);
  const [isLoadingCredits, setIsLoadingCredits] = useState<boolean>(true);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calcFeedback, setCalcFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [activeCreditViewTab, setActiveCreditViewTab] = useState<'latest' | 'today'>('latest');

  const fetchCreditsData = useCallback(async () => {
    setIsLoadingCredits(true);
    try {
      const [summary, history] = await Promise.all([
        apiService.getWaterCreditsSummary(effectiveVillageId, token || undefined),
        apiService.getWaterCreditsHistory(effectiveVillageId, 30, token || undefined),
      ]);
      setCreditsSummary(summary);
      setCreditsHistory(history);
    } catch (err) {
      console.error('[WaterBalanceView] Error fetching water credits:', err);
    } finally {
      setIsLoadingCredits(false);
    }
  }, [effectiveVillageId, token]);

  useEffect(() => {
    fetchCreditsData();
  }, [fetchCreditsData]);

  const handleCalculateDaily = async () => {
    setIsCalculating(true);
    setCalcFeedback(null);
    try {
      const res = await apiService.triggerDailyWaterCreditsCalculation(undefined, token || undefined);
      if (res.success && res.entry) {
        setCalcFeedback({
          type: 'success',
          message: `Calculated for ${res.entry.periodDate}: ${res.entry.creditsEarned} Water Credits awarded (${res.entry.dataCoverageStatus}).`,
        });
        await fetchCreditsData();
      } else {
        setCalcFeedback({
          type: 'error',
          message: res.error || 'Failed to calculate daily water credits.',
        });
      }
    } catch (err: any) {
      setCalcFeedback({
        type: 'error',
        message: err.message || 'Error executing calculation.',
      });
    } finally {
      setIsCalculating(false);
    }
  };

  // Interactive Recharge Potential Calculator state
  const [catchmentArea, setCatchmentArea] = useState<number>(1000); // 1000 m²
  const [rainfallMm, setRainfallMm] = useState<number>(40); // 40 mm
  const [runoffCoefficient, setRunoffCoefficient] = useState<number>(0.85); // 0.85

  const rechargeCalc = calculateRechargeVolume(catchmentArea, rainfallMm, runoffCoefficient);

  const inputs = currentBalance?.inputs;
  const outputs = currentBalance?.outputs;
  const hasMeasuredData = Boolean(currentBalance?.hasLiveTelemetry && inputs && outputs);
  const isDeficit = (currentBalance?.netBalanceLiters ?? 0) < 0;

  // Percentage calculations for flow visualization
  const totalThroughput = (inputs?.totalInputsLiters ?? 0) + (outputs?.totalOutputsLiters ?? 0);
  const inputRatio = totalThroughput > 0 ? Math.round(((inputs?.totalInputsLiters ?? 0) / totalThroughput) * 100) : 50;
  const outputRatio = 100 - inputRatio;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title & Timeframe Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8D2C4]">
        <div>
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
            <Scale className="w-3.5 h-3.5" />
            <span>Aquifer Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1E2A28]">
            Community Water Balance
          </h1>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
            Evaluating natural and managed recharge inflows against collective community extraction.
          </p>
        </div>

        {/* Timeframe Toggle */}
        <div className="inline-flex p-1 rounded-lg bg-[#EAE5DB] border border-[#D8D2C4] self-start sm:self-auto">
          {(['daily', 'weekly', 'monthly'] as BalancePeriod[]).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => onPeriodChange(period)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                selectedPeriod === period
                  ? 'bg-[#1F5A48] text-[#F5F1E8] shadow-xs'
                  : 'text-[#1E2A28]/70 hover:text-[#1E2A28]'
              }`}
            >
              {period} Balance
            </button>
          ))}
        </div>
      </div>

      {/* Explicit Physical Boundary & Baseline Notice */}
      <div className="p-4 rounded-xl bg-[#EAE5DB] border border-[#D8D2C4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#1E2A28]">
        <div className="flex items-start sm:items-center space-x-2.5">
          <Info className="w-5 h-5 text-[#1F5A48] flex-shrink-0 mt-0.5 sm:mt-0" />
          <div>
            <strong className="text-[#1E2A28] block">Modeled Reference Baseline (Planning Estimation):</strong>
            <p className="text-[#1E2A28]/70 mt-0.5">
              The two-node tabletop prototype measures bench flow and tank level only. Community-scale aquifer water balances require village-wide piezometer arrays, rainfall gauges, and all tubewell meters. The values below represent calibrated hydrological reference estimates for community water planning and are not live sensor telemetry.
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded bg-[#1F5A48]/10 text-[#1F5A48] font-bold uppercase text-[10px] tracking-wider flex-shrink-0 self-start sm:self-auto">
          Modeled Reference
        </span>
      </div>

      {hasMeasuredData && inputs && outputs ? (
        <>
          {/* Net Groundwater Balance Summary Card */}
          <div
            className={`p-6 rounded-2xl border shadow-xs ${
              isDeficit
                ? 'bg-[#B74A3B]/10 border-[#B74A3B]/30'
                : 'bg-[#1F5A48]/10 border-[#1F5A48]/30'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                      isDeficit ? 'bg-[#B74A3B] text-white' : 'bg-[#1F5A48] text-white'
                    }`}
                  >
                    {isDeficit ? 'Tabletop Interval Deficit' : 'Tabletop Interval Surplus'}
                  </span>
                  <span className="text-xs text-[#1E2A28]/60 font-medium">
                    {currentBalance.dateLabel}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline space-x-2">
                  <span
                    className={`text-4xl sm:text-5xl font-extrabold tracking-tight ${
                      isDeficit ? 'text-[#B74A3B]' : 'text-[#1F5A48]'
                    }`}
                  >
                    {isDeficit ? '' : '+'}
                    {currentBalance.netBalanceLiters?.toFixed(2)}
                  </span>
                  <span className="text-xl font-bold text-[#1E2A28]/70">Liters</span>
                  <span className="text-sm font-semibold text-[#1E2A28]/60 ml-2">
                    ({Math.abs(currentBalance.netBalanceLiters ?? 0).toFixed(2)} L {isDeficit ? 'net deficit' : 'net surplus'} over aligned intervals)
                  </span>
                </div>

                <p className="mt-2 text-xs sm:text-sm text-[#1E2A28]/80 max-w-2xl leading-relaxed">
                  Calculated from measured interval volumes across {currentBalance.alignedWindowsCount ?? 1} aligned 60-second window(s). Node 1 and Node 2 session counters reset independently and are never subtracted directly.
                </p>
              </div>

              <div className="bg-[#F5F1E8] p-4 rounded-xl border border-[#D8D2C4] min-w-[200px] flex-shrink-0 text-center">
                <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
                  Recharge vs Extraction
                </span>
                <div className="mt-2 text-2xl font-black text-[#1E2A28]">
                  {outputs.totalOutputsLiters > 0
                    ? `${Math.round((inputs.totalInputsLiters / outputs.totalOutputsLiters) * 100)}%`
                    : '100%'}
                </div>
                <span className="text-[11px] text-[#1E2A28]/70">
                  Replenishment Ratio
                </span>
                <div className="mt-2 w-full bg-[#EAE5DB] h-2 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#1F5A48] h-full"
                    style={{ width: `${Math.min(100, inputRatio)}%` }}
                  />
                  <div
                    className="bg-[#C56B4C] h-full"
                    style={{ width: `${Math.min(100, outputRatio)}%` }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[9px] text-[#1E2A28]/60 font-semibold">
                  <span>Recharge {inputRatio}%</span>
                  <span>Extraction {outputRatio}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* INPUTS and OUTPUTS Detailed Breakdown Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* INPUTS CARD */}
            <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-md bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
                      <ArrowDownToLine className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#1E2A28]">
                        Node 1 · Recharge Line Inflow
                      </h3>
                      <span className="text-[11px] text-[#1E2A28]/60">
                        Measured via YF-S201 turbine over aligned windows
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#1F5A48]">
                      {inputs.totalInputsLiters.toFixed(2)} L
                    </span>
                    <span className="text-[10px] text-[#1E2A28]/60 block">
                      {(inputs.totalInputsLiters / 1000).toFixed(4)} m³
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-[#1F5A48] block">
                        Measured Recharge Volume
                      </span>
                      <span className="text-[11px] text-[#1E2A28]/60">
                        Calibrated factor: 450 pulses/L
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-[#1F5A48]">
                        {inputs.managedRechargeLiters.toFixed(2)} L
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#D8D2C4] text-[11px] text-[#1E2A28]/70 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A48]" />
                <span>Synchronized with Node 2 extraction timestamps.</span>
              </div>
            </div>

            {/* OUTPUTS CARD */}
            <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 sm:p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-md bg-[#C56B4C]/15 text-[#C56B4C] flex items-center justify-center">
                      <ArrowUpFromLine className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#1E2A28]">
                        Node 2 · Pump Extraction Outflow
                      </h3>
                      <span className="text-[11px] text-[#1E2A28]/60">
                        Measured via YF-S201 turbine on pump line
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-[#C56B4C]">
                      {outputs.totalOutputsLiters.toFixed(2)} L
                    </span>
                    <span className="text-[10px] text-[#1E2A28]/60 block">
                      {(outputs.totalOutputsLiters / 1000).toFixed(4)} m³
                    </span>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-xs text-[#C56B4C] block">
                        Measured Extraction Volume
                      </span>
                      <span className="text-[11px] text-[#1E2A28]/60">
                        Calibrated factor: 450 pulses/L
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-xs text-[#C56B4C]">
                        {outputs.borewellExtractionLiters.toFixed(2)} L
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#D8D2C4] text-[11px] text-[#1E2A28]/70 flex items-center space-x-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A48]" />
                <span>Manual pump line monitoring; no relay automation.</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Honest Waiting / Unavailable State */
        <div className="p-8 rounded-2xl border bg-[#EAE5DB] border-[#D8D2C4] text-center shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-[#1F5A48]/10 text-[#1F5A48] flex items-center justify-center mx-auto mb-3">
            <Scale className="w-6 h-6" />
          </div>
          <span className="px-2.5 py-0.5 rounded bg-[#C56B4C]/15 text-[#B74A3B] text-[10px] font-bold uppercase tracking-wider inline-block mb-2">
            Waiting for Paired Measurements
          </span>
          <h2 className="text-xl font-bold text-[#1E2A28]">
            No Measured Water Balance Available Yet
          </h2>
          <p className="text-xs sm:text-sm text-[#1E2A28]/70 max-w-xl mx-auto mt-2 leading-relaxed">
            The tabletop prototype computes water balance comparisons strictly from synchronized Node 1 (recharge flow) and Node 2 (extraction flow) measured packets across aligned time windows. No hard-coded, seeded, or simulated values are presented.
          </p>

          <div className="mt-6 p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] max-w-lg mx-auto text-left text-xs space-y-2">
            <div className="font-bold text-[#1E2A28] flex items-center space-x-1.5">
              <Info className="w-4 h-4 text-[#1F5A48]" />
              <span>Hardware Prerequisites to Compute Balance:</span>
            </div>
            <ul className="list-disc pl-5 space-y-1 text-[#1E2A28]/75 text-[11px]">
              <li><strong>Node 1 (Recharge ESP32):</strong> Online and streaming measured packets with YF-S201 pulses.</li>
              <li><strong>Node 2 (Extraction ESP32):</strong> Online and streaming measured packets with YF-S201 pulses.</li>
              <li><strong>Aligned Window:</strong> Both nodes must provide readings in a common 60-second time interval.</li>
              <li><strong>Independent Session Counters:</strong> Raw session counters reset on reboot and are never subtracted directly.</li>
            </ul>
          </div>
        </div>
      )}

      {/* PROTOTYPE WATER CREDITS SECTION */}
      <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8D2C4]">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
              <Award className="w-4 h-4 text-[#1F5A48]" />
              <span>Incentive Accounting</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E2A28]">
              Prototype Water Credits Ledger
            </h2>
            <p className="text-xs sm:text-sm text-[#1E2A28]/70 mt-0.5">
              Volumetric community prototype points earned for measured tabletop net recharge surplus (1 credit per net litre).
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleCalculateDaily}
              disabled={isCalculating}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1F5A48] text-[#F5F1E8] text-xs font-semibold hover:bg-[#184638] disabled:opacity-50 transition-all shadow-xs cursor-pointer"
            >
              {isCalculating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Calculating...</span>
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Calculate Daily Credits</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={fetchCreditsData}
              disabled={isLoadingCredits}
              className="p-1.5 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] text-[#1E2A28]/70 hover:text-[#1E2A28] disabled:opacity-50 transition-colors cursor-pointer"
              title="Refresh credits"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingCredits ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Boundary Notice */}
        <div className="p-3.5 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] flex items-start space-x-2.5 text-xs text-[#1E2A28]">
          <Info className="w-4 h-4 text-[#1F5A48] flex-shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <strong className="text-[#1E2A28]">Tabletop Measured Flow Comparison:</strong>{' '}
            {creditsSummary?.disclaimer ||
              'Prototype Water Credits compare tabletop measured flow volumes (Node 1 recharge vs Node 2 extraction) using 1 credit per net surplus litre. They are prototype community recognition points and do NOT represent a village-wide groundwater aquifer balance, cash value, or external reward entitlement.'}
          </div>
        </div>

        {/* Calculation feedback */}
        {calcFeedback && (
          <div
            className={`p-3 rounded-lg text-xs font-medium flex items-center space-x-2 ${
              calcFeedback.type === 'success'
                ? 'bg-[#1F5A48]/10 text-[#1F5A48] border border-[#1F5A48]/30'
                : 'bg-[#B74A3B]/10 text-[#B74A3B] border border-[#B74A3B]/30'
            }`}
          >
            {calcFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{calcFeedback.message}</span>
          </div>
        )}

        {/* Top 4 Key Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Available Water Credits */}
          <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E2A28]/60">
                Available Water Credits
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="my-3">
              <div className="text-3xl sm:text-4xl font-black text-[#1F5A48]">
                {creditsSummary ? creditsSummary.availableCredits : 0}
              </div>
              <span className="text-[11px] text-[#1E2A28]/70">
                Cumulative prototype points earned
              </span>
            </div>
            <div className="pt-2 border-t border-[#D8D2C4]/70 text-[10px] text-[#1E2A28]/60">
              Rule: 1 Credit = 1 Net Litre Surplus (Never decremented)
            </div>
          </div>

          {/* Card 2: Period Focus Toggle & Measured Flow */}
          <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E2A28]/60">
                  {activeCreditViewTab === 'latest' ? 'Last Completed Day' : "Today's Running Flow"}
                </span>
              </div>
              <div className="inline-flex rounded-md bg-[#EAE5DB] p-0.5 border border-[#D8D2C4] text-[10px]">
                <button
                  type="button"
                  onClick={() => setActiveCreditViewTab('latest')}
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    activeCreditViewTab === 'latest'
                      ? 'bg-[#1F5A48] text-white'
                      : 'text-[#1E2A28]/70'
                  }`}
                >
                  Completed
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCreditViewTab('today')}
                  className={`px-1.5 py-0.5 rounded font-semibold ${
                    activeCreditViewTab === 'today'
                      ? 'bg-[#1F5A48] text-white'
                      : 'text-[#1E2A28]/70'
                  }`}
                >
                  Today
                </button>
              </div>
            </div>

            {activeCreditViewTab === 'latest' ? (
              creditsSummary?.latestCompletedDay ? (
                <div className="my-2 space-y-1">
                  <div className="text-xs font-semibold text-[#1E2A28]">
                    Date: {creditsSummary.latestCompletedDay.periodDate}
                  </div>
                  <div className="flex justify-between text-xs text-[#1F5A48]">
                    <span>Node 1 Recharge:</span>
                    <strong className="font-bold">{creditsSummary.latestCompletedDay.rechargeLiters.toFixed(2)} L</strong>
                  </div>
                  <div className="flex justify-between text-xs text-[#C56B4C]">
                    <span>Node 2 Extraction:</span>
                    <strong className="font-bold">{creditsSummary.latestCompletedDay.extractionLiters.toFixed(2)} L</strong>
                  </div>
                </div>
              ) : (
                <div className="my-3 text-xs text-[#1E2A28]/60 italic">
                  No completed daily period recorded yet.
                </div>
              )
            ) : creditsSummary?.todayRunning ? (
              <div className="my-2 space-y-1">
                <div className="text-xs font-semibold text-[#1E2A28]">
                  Today: {creditsSummary.todayRunning.periodDate} (IST)
                </div>
                <div className="flex justify-between text-xs text-[#1F5A48]">
                  <span>Node 1 Recharge:</span>
                  <strong className="font-bold">{creditsSummary.todayRunning.rechargeLiters.toFixed(2)} L</strong>
                </div>
                <div className="flex justify-between text-xs text-[#C56B4C]">
                  <span>Node 2 Extraction:</span>
                  <strong className="font-bold">{creditsSummary.todayRunning.extractionLiters.toFixed(2)} L</strong>
                </div>
              </div>
            ) : (
              <div className="my-3 text-xs text-[#1E2A28]/60 italic">Awaiting today&apos;s packets.</div>
            )}

            <div className="pt-2 border-t border-[#D8D2C4]/70 text-[10px] text-[#1E2A28]/60">
              Integrated from measured pulse telemetry
            </div>
          </div>

          {/* Card 3: Net Surplus/Deficit & Surplus % */}
          <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E2A28]/60">
                Net Balance & Surplus %
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#3B7C8A]/15 text-[#3B7C8A] flex items-center justify-center">
                <Scale className="w-4 h-4" />
              </div>
            </div>

            {(() => {
              const activeItem =
                activeCreditViewTab === 'latest'
                  ? creditsSummary?.latestCompletedDay
                  : creditsSummary?.todayRunning;

              if (!activeItem) {
                return (
                  <div className="my-3 text-xs text-[#1E2A28]/60 italic">
                    Waiting for measured data
                  </div>
                );
              }

              const isSurplus = (activeItem.netSurplusLiters ?? 0) > 0;
              const isDeficitPeriod = (activeItem.netDeficitLiters ?? 0) > 0;

              return (
                <div className="my-2">
                  <div className="flex items-baseline space-x-1.5">
                    <span
                      className={`text-2xl font-black ${
                        isSurplus ? 'text-[#1F5A48]' : isDeficitPeriod ? 'text-[#B74A3B]' : 'text-[#1E2A28]'
                      }`}
                    >
                      {isSurplus
                        ? `+${activeItem.netSurplusLiters.toFixed(2)} L`
                        : isDeficitPeriod
                        ? `-${activeItem.netDeficitLiters.toFixed(2)} L`
                        : '0.00 L'}
                    </span>
                    <span className="text-[10px] font-semibold text-[#1E2A28]/60">
                      {isSurplus ? 'surplus' : isDeficitPeriod ? 'deficit' : 'balanced'}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-[#1E2A28]/80 font-medium">
                    Surplus: {activeItem.surplusPercentage != null ? `${activeItem.surplusPercentage > 0 ? '+' : ''}${activeItem.surplusPercentage.toFixed(1)}%` : 'Unavailable (0 L extraction)'}
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 border-t border-[#D8D2C4]/70 text-[10px] text-[#1E2A28]/60">
              {activeCreditViewTab === 'latest' && creditsSummary?.latestCompletedDay ? (
                <span>Credits Earned: +{creditsSummary.latestCompletedDay.creditsEarned}</span>
              ) : (
                <span>Credits awarded at midnight IST</span>
              )}
            </div>
          </div>

          {/* Card 4: Audit & Coverage Status */}
          <div className="p-4 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E2A28]/60">
                Audit & Data Coverage
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#1F5A48]/15 text-[#1F5A48] flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>

            {(() => {
              const activeItem =
                activeCreditViewTab === 'latest'
                  ? creditsSummary?.latestCompletedDay
                  : creditsSummary?.todayRunning;

              if (!activeItem) {
                return (
                  <div className="my-3 text-xs text-[#1E2A28]/60 italic">
                    Waiting for telemetry
                  </div>
                );
              }

              const status =
                'dataCoverageStatus' in activeItem
                  ? activeItem.dataCoverageStatus
                  : activeItem.status;

              const isComplete = status === 'complete';
              const isIncomplete = status === 'incomplete';
              const isInProgress = status === 'in_progress';

              return (
                <div className="my-2 space-y-1">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isComplete
                          ? 'bg-[#1F5A48] text-white'
                          : isIncomplete
                          ? 'bg-[#B74A3B] text-white'
                          : isInProgress
                          ? 'bg-[#3B7C8A] text-white'
                          : 'bg-[#D8D2C4] text-[#1E2A28]'
                      }`}
                    >
                      {isComplete
                        ? 'Complete'
                        : isIncomplete
                        ? 'Incomplete'
                        : isInProgress
                        ? 'In Progress'
                        : 'Waiting Data'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#1E2A28]/75">
                    Node 1: {activeItem.coveragePercentageNode1.toFixed(1)}% ({activeItem.node1SampleCount} pkts)
                  </div>
                  <div className="text-[11px] text-[#1E2A28]/75">
                    Node 2: {activeItem.coveragePercentageNode2.toFixed(1)}% ({activeItem.node2SampleCount} pkts)
                  </div>
                </div>
              );
            })()}

            <div className="pt-2 border-t border-[#D8D2C4]/70 text-[10px] text-[#1E2A28]/60">
              Min coverage required: 75% • No gap interpolation
            </div>
          </div>
        </div>

        {/* Simple Measured Daily History Chart */}
        <div className="p-5 rounded-xl bg-[#F5F1E8] border border-[#D8D2C4]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#1E2A28] flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-[#1F5A48]" />
                <span>Measured Daily History</span>
              </h3>
              <p className="text-[11px] text-[#1E2A28]/60 mt-0.5">
                Stored daily measured flow totals and Water Credits earned (Asia/Kolkata timezone).
              </p>
            </div>
            <span className="text-[10px] font-semibold text-[#1E2A28]/60 bg-[#EAE5DB] px-2.5 py-1 rounded-md border border-[#D8D2C4] self-start sm:self-auto">
              PostgreSQL Ledger Source
            </span>
          </div>

          {creditsHistory.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={creditsHistory.slice().reverse().map((entry) => ({
                    date: entry.periodDate.slice(5), // 'MM-DD'
                    fullDate: entry.periodDate,
                    recharge: entry.rechargeLiters,
                    extraction: entry.extractionLiters,
                    credits: entry.creditsEarned,
                    status: entry.dataCoverageStatus,
                  }))}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#D8D2C4" />
                  <XAxis dataKey="date" stroke="#1E2A28" fontSize={11} />
                  <YAxis stroke="#1E2A28" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#F5F1E8',
                      borderColor: '#D8D2C4',
                      borderRadius: '8px',
                      fontSize: '11px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="recharge" name="Recharge Flow (L)" fill="#1F5A48" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="extraction" name="Extraction Flow (L)" fill="#C56B4C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="credits" name="Credits Earned" fill="#3B7C8A" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-8 text-center text-[#1E2A28]/60 text-xs">
              <Scale className="w-8 h-8 text-[#1E2A28]/30 mx-auto mb-2" />
              <p className="font-semibold text-[#1E2A28]">No completed daily credit periods recorded yet.</p>
              <p className="text-[11px] text-[#1E2A28]/60 mt-1 max-w-md mx-auto">
                Water Credits are calculated and stored only from authenticated, measured Node 1 and Node 2 packets for completed 24-hour days in Asia/Kolkata.
              </p>
            </div>
          )}
        </div>

        {/* Auditable Ledger History Table */}
        {creditsHistory.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-[#D8D2C4] bg-[#F5F1E8]">
            <table className="w-full text-left text-xs text-[#1E2A28]">
              <thead className="bg-[#EAE5DB] text-[10px] font-bold uppercase tracking-wider text-[#1E2A28]/70 border-b border-[#D8D2C4]">
                <tr>
                  <th className="py-2.5 px-3">Date (IST)</th>
                  <th className="py-2.5 px-3">Recharge</th>
                  <th className="py-2.5 px-3">Extraction</th>
                  <th className="py-2.5 px-3">Net Balance</th>
                  <th className="py-2.5 px-3">Surplus %</th>
                  <th className="py-2.5 px-3">Credits</th>
                  <th className="py-2.5 px-3">Coverage Status</th>
                  <th className="py-2.5 px-3">Audit Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8D2C4]/60">
                {creditsHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-[#EAE5DB]/40 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-[#1E2A28]">{item.periodDate}</td>
                    <td className="py-2.5 px-3 font-medium text-[#1F5A48]">{item.rechargeLiters.toFixed(2)} L</td>
                    <td className="py-2.5 px-3 font-medium text-[#C56B4C]">{item.extractionLiters.toFixed(2)} L</td>
                    <td className="py-2.5 px-3 font-bold">
                      {item.netSurplusLiters > 0 ? (
                        <span className="text-[#1F5A48]">+{item.netSurplusLiters.toFixed(2)} L</span>
                      ) : item.netDeficitLiters > 0 ? (
                        <span className="text-[#B74A3B]">-{item.netDeficitLiters.toFixed(2)} L</span>
                      ) : (
                        <span className="text-[#1E2A28]/60">0.00 L</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#1E2A28]/80">
                      {item.surplusPercentage != null ? `${item.surplusPercentage > 0 ? '+' : ''}${item.surplusPercentage.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-[#1F5A48]">+{item.creditsEarned}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          item.dataCoverageStatus === 'complete'
                            ? 'bg-[#1F5A48]/15 text-[#1F5A48]'
                            : 'bg-[#B74A3B]/15 text-[#B74A3B]'
                        }`}
                      >
                        {item.dataCoverageStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[10px] text-[#1E2A28]/50">
                      {new Date(item.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* RECHARGE LIFECYCLE & ILLUSTRATIVE CALCULATOR SECTION */}
      <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-2xl p-6 sm:p-8 shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#1F5A48] mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recharge Concept & Sizing</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#1E2A28]">
            The Closed-Loop Groundwater Recharge Architecture
          </h2>
          <p className="text-xs sm:text-sm text-[#1E2A28]/80 mt-1">
            How decentralized community structures channel monsoon runoff directly into shallow and deep aquifer formations.
          </p>
        </div>

        {/* 5-Step Recharge Concept Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-6">
          {[
            { step: '1', title: 'Rainwater', desc: 'Rooftops & catchment surfaces' },
            { step: '2', title: 'Collection', desc: 'Guttering & diversion channels' },
            { step: '3', title: 'Filtration', desc: 'Gravel, sand & charcoal beds' },
            { step: '4', title: 'Recharge', desc: 'Percolation shaft or check dam' },
            { step: '5', title: 'Groundwater', desc: 'Direct aquifer storage increase' },
          ].map((item, idx) => (
            <div
              key={item.step}
              className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4] text-center relative"
            >
              <div className="w-6 h-6 rounded-full bg-[#1F5A48] text-[#F5F1E8] text-xs font-bold flex items-center justify-center mx-auto mb-1.5">
                {item.step}
              </div>
              <h4 className="font-bold text-xs text-[#1E2A28]">{item.title}</h4>
              <p className="text-[10px] text-[#1E2A28]/70 mt-0.5 leading-tight">{item.desc}</p>
              {idx < 4 && (
                <div className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-[#1F5A48] font-bold text-sm">
                  →
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Interactive Rainwater Recharge Potential Calculator */}
        <div className="mt-8 pt-6 border-t border-[#D8D2C4]">
          <div className="flex items-center space-x-2 mb-4">
            <Calculator className="w-5 h-5 text-[#3B7C8A]" />
            <h3 className="font-bold text-base text-[#1E2A28]">
              Interactive Recharge Potential Calculator
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Sliders on Left */}
            <div className="lg:col-span-7 space-y-4">
              {/* Catchment Area Slider */}
              <div className="bg-[#F5F1E8] p-3.5 rounded-lg border border-[#D8D2C4]">
                <div className="flex justify-between items-center text-xs font-semibold text-[#1E2A28]">
                  <span>Catchment Area (A)</span>
                  <span className="text-sm font-bold text-[#1F5A48]">
                    {catchmentArea.toLocaleString()} m²
                  </span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={catchmentArea}
                  onChange={(e) => setCatchmentArea(Number(e.target.value))}
                  className="w-full mt-2 accent-[#1F5A48] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#1E2A28]/50 mt-1">
                  <span>100 m² (Small house)</span>
                  <span>1,000 m² (School / Cluster)</span>
                  <span>5,000 m² (Sub-watershed)</span>
                </div>
              </div>

              {/* Rainfall Slider */}
              <div className="bg-[#F5F1E8] p-3.5 rounded-lg border border-[#D8D2C4]">
                <div className="flex justify-between items-center text-xs font-semibold text-[#1E2A28]">
                  <span>Rainfall Event (P)</span>
                  <span className="text-sm font-bold text-[#3B7C8A]">
                    {rainfallMm} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="120"
                  step="5"
                  value={rainfallMm}
                  onChange={(e) => setRainfallMm(Number(e.target.value))}
                  className="w-full mt-2 accent-[#3B7C8A] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#1E2A28]/50 mt-1">
                  <span>5 mm (Drizzle)</span>
                  <span>40 mm (Good Monsoon Shower)</span>
                  <span>120 mm (Heavy Storm)</span>
                </div>
              </div>

              {/* Runoff Coefficient Selector */}
              <div className="bg-[#F5F1E8] p-3.5 rounded-lg border border-[#D8D2C4]">
                <div className="flex justify-between items-center text-xs font-semibold text-[#1E2A28] mb-2">
                  <span>Surface Runoff Coefficient (C)</span>
                  <span className="text-sm font-bold text-[#C56B4C]">
                    {runoffCoefficient.toFixed(2)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Rooftop / Metal', coeff: 0.85 },
                    { label: 'Paved / Concrete', coeff: 0.75 },
                    { label: 'Soil / Open Field', coeff: 0.50 },
                  ].map((surf) => (
                    <button
                      key={surf.label}
                      type="button"
                      onClick={() => setRunoffCoefficient(surf.coeff)}
                      className={`py-1.5 px-2 rounded text-xs font-medium border text-center transition-colors ${
                        runoffCoefficient === surf.coeff
                          ? 'bg-[#1F5A48] text-[#F5F1E8] border-[#1F5A48]'
                          : 'bg-[#EAE5DB] text-[#1E2A28] border-[#D8D2C4] hover:bg-[#E2DDD2]'
                      }`}
                    >
                      <div className="font-bold">{surf.coeff}</div>
                      <div className="text-[10px] truncate opacity-90">{surf.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Calculated Output Card on Right */}
            <div className="lg:col-span-5 bg-[#1F5A48] text-[#F5F1E8] rounded-xl p-6 text-center shadow-md border border-[#184638] flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#A7D7D7] uppercase tracking-wider block">
                  Planning Simulation Estimate
                </span>
                <div className="mt-2 text-4xl sm:text-5xl font-black text-[#F5F1E8]">
                  {rechargeCalc.liters.toLocaleString()}
                </div>
                <span className="text-base font-bold text-[#A7D7D7]">Liters</span>
                <div className="text-xs text-[#F5F1E8]/70 mt-1">
                  ≈ {rechargeCalc.cubicMeters} cubic meters (m³)
                </div>
                <span className="inline-block mt-2 px-2 py-0.5 rounded bg-[#184638] text-[10px] text-[#A7D7D7] border border-[#2a6856]">
                  Estimate based only on user-entered assumptions • Separate from sensor telemetry
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-[#317260] text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A7D7D7] block">
                  Formula Verification:
                </span>
                <p className="text-xs text-[#F5F1E8]/90 font-mono mt-1">
                  {rechargeCalc.explanation}
                </p>
                <div className="mt-3 p-2 rounded bg-[#184638] text-[10px] text-[#A7D7D7] leading-tight">
                  <strong className="text-white">Planning Boundary:</strong> This planning calculator computes volumetric estimates from the sliders above. It is not connected to or derived from physical ESP32 sensor telemetry.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
