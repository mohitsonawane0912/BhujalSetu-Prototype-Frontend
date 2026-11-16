import React, { useState } from 'react';
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
} from 'lucide-react';
import { WaterBalance, BalancePeriod } from '../types/groundwater';
import { calculateRechargeVolume } from '../utils/groundwaterLogic';

interface WaterBalanceViewProps {
  currentBalance: WaterBalance | null;
  selectedPeriod: BalancePeriod;
  onPeriodChange: (period: BalancePeriod) => void;
}

export const WaterBalanceView: React.FC<WaterBalanceViewProps> = ({
  currentBalance,
  selectedPeriod,
  onPeriodChange,
}) => {
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
                <span className="text-[11px] font-bold text-[#A7D7D7] uppercase tracking-wider block">
                  Calculated Harvest Potential
                </span>
                <div className="mt-2 text-4xl sm:text-5xl font-black text-[#F5F1E8]">
                  {rechargeCalc.liters.toLocaleString()}
                </div>
                <span className="text-base font-bold text-[#A7D7D7]">Liters</span>
                <div className="text-xs text-[#F5F1E8]/70 mt-1">
                  ≈ {rechargeCalc.cubicMeters} cubic meters (m³)
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#317260] text-left">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A7D7D7] block">
                  Formula Verification:
                </span>
                <p className="text-xs text-[#F5F1E8]/90 font-mono mt-1">
                  {rechargeCalc.explanation}
                </p>
                <div className="mt-3 p-2 rounded bg-[#184638] text-[10px] text-[#A7D7D7] leading-tight">
                  <strong className="text-white">Note:</strong> Illustrative calculation. Actual recharge depends on local hydrogeology, soil infiltration rate, and filter maintenance.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
