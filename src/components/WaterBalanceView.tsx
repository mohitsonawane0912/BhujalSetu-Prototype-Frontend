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
  currentBalance: WaterBalance;
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

  const inputs = currentBalance.inputs;
  const outputs = currentBalance.outputs;
  const isDeficit = currentBalance.netBalanceLiters < 0;

  // Percentage calculations for flow visualization
  const totalThroughput = inputs.totalInputsLiters + outputs.totalOutputsLiters;
  const inputRatio = Math.round((inputs.totalInputsLiters / totalThroughput) * 100);
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
                {isDeficit ? 'Aquifer Deficit' : 'Aquifer Surplus'}
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
                {currentBalance.netBalanceM3.toFixed(1)}
              </span>
              <span className="text-xl font-bold text-[#1E2A28]/70">m³</span>
              <span className="text-sm font-semibold text-[#1E2A28]/60 ml-2">
                ({Math.abs(currentBalance.netBalanceLiters).toLocaleString()} Liters{' '}
                {isDeficit ? 'net loss' : 'net gain'})
              </span>
            </div>

            <p className="mt-2 text-xs sm:text-sm text-[#1E2A28]/80 max-w-2xl leading-relaxed">
              {isDeficit
                ? 'More water is being extracted through agricultural and domestic tubewells than is currently entering the aquifer through natural rainfall infiltration and community recharge pits.'
                : 'Managed recharge and rainfall infiltration currently exceed collective extraction, raising localized groundwater storage.'}
            </p>
          </div>

          <div className="bg-[#F5F1E8] p-4 rounded-xl border border-[#D8D2C4] min-w-[200px] flex-shrink-0 text-center">
            <span className="text-[11px] font-semibold text-[#1E2A28]/60 uppercase tracking-wider block">
              Inflow vs Extraction
            </span>
            <div className="mt-2 text-2xl font-black text-[#1E2A28]">
              {Math.round((inputs.totalInputsLiters / outputs.totalOutputsLiters) * 100)}%
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
              <span>Inflow {inputRatio}%</span>
              <span>Draw {outputRatio}%</span>
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
                    Aquifer Inflows (Inputs)
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Natural infiltration & managed recharge
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-[#1F5A48]">
                  {(inputs.totalInputsLiters / 1000).toFixed(1)} m³
                </span>
                <span className="text-[10px] text-[#1E2A28]/60 block">
                  {inputs.totalInputsLiters.toLocaleString()} L
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Rainfall Infiltration */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1E2A28] block">
                    Rainfall Natural Infiltration
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Estimated deep percolation through soil horizon
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#1E2A28]">
                    {(inputs.rainfallInfiltrationLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {inputs.rainfallInfiltrationLiters.toLocaleString()} L
                  </span>
                </div>
              </div>

              {/* Managed Recharge Structures */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1F5A48] block">
                    Managed Community Recharge
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Percolation pits, recharge shafts & check dams
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#1F5A48]">
                    {(inputs.managedRechargeLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {inputs.managedRechargeLiters.toLocaleString()} L
                  </span>
                </div>
              </div>

              {/* Subsurface Inflow */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1E2A28] block">
                    Subsurface Base Inflow
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Regional hydraulic gradient gradient seepage
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#1E2A28]">
                    {(inputs.subsurfaceInflowLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {inputs.subsurfaceInflowLiters.toLocaleString()} L
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D8D2C4] text-[11px] text-[#1E2A28]/70 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#1F5A48]" />
            <span>7 operational community recharge structures actively contributing.</span>
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
                    Aquifer Extraction (Outputs)
                  </h3>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Borewells, community supply & irrigation
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-lg font-black text-[#C56B4C]">
                  {(outputs.totalOutputsLiters / 1000).toFixed(1)} m³
                </span>
                <span className="text-[10px] text-[#1E2A28]/60 block">
                  {outputs.totalOutputsLiters.toLocaleString()} L
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {/* Borewell Extraction */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1E2A28] block">
                    Borewell & Tubewell Extraction
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    18 monitored agricultural and commercial pump sets
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#C56B4C]">
                    {(outputs.borewellExtractionLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {outputs.borewellExtractionLiters.toLocaleString()} L
                  </span>
                </div>
              </div>

              {/* Community Usage */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1E2A28] block">
                    Community Domestic Tap Usage
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Piped drinking water distribution to 342 households
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#1E2A28]">
                    {(outputs.communityUsageLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {outputs.communityUsageLiters.toLocaleString()} L
                  </span>
                </div>
              </div>

              {/* Other Agricultural Extraction */}
              <div className="p-3 rounded-lg bg-[#F5F1E8] border border-[#D8D2C4]/70 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-xs text-[#1E2A28] block">
                    Other Distributed Extraction
                  </span>
                  <span className="text-[11px] text-[#1E2A28]/60">
                    Private open wells & perimeter livestock supply
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-bold text-xs text-[#1E2A28]">
                    {(outputs.otherAgriculturalExtractionLiters / 1000).toFixed(1)} m³
                  </span>
                  <span className="text-[10px] text-[#1E2A28]/50 block">
                    {outputs.otherAgriculturalExtractionLiters.toLocaleString()} L
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D8D2C4] text-[11px] text-[#C56B4C] flex items-center space-x-1.5 font-medium">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Tubewell extraction exceeds seasonal replenishment rate by 14.8%.</span>
          </div>
        </div>
      </div>

      {/* Sankey / Visual Flow Diagram */}
      <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-[#D8D2C4]">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#3B7C8A]" />
            <h3 className="font-bold text-base text-[#1E2A28]">
              Aquifer Flow & Distribution Topology
            </h3>
          </div>
          <span className="text-xs text-[#1E2A28]/60">
            Sankey Flow Breakdown
          </span>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Inputs Column */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#1F5A48] block mb-2">
              Sources of Inflow
            </span>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#1E2A28]">
                <span>Rain Infiltration</span>
                <span>{(inputs.rainfallInfiltrationLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#3B7C8A] h-full rounded"
                  style={{
                    width: `${Math.round((inputs.rainfallInfiltrationLiters / inputs.totalInputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#1F5A48]">
                <span>Managed Pits</span>
                <span>{(inputs.managedRechargeLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#1F5A48] h-full rounded"
                  style={{
                    width: `${Math.round((inputs.managedRechargeLiters / inputs.totalInputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#1E2A28]">
                <span>Subsurface Seepage</span>
                <span>{(inputs.subsurfaceInflowLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#A7D7D7] h-full rounded"
                  style={{
                    width: `${Math.round((inputs.subsurfaceInflowLiters / inputs.totalInputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Central Aquifer Reservoir */}
          <div className="p-5 rounded-2xl bg-[#1E2A28] text-[#F5F1E8] text-center shadow-md border border-[#3E524D]">
            <span className="text-[11px] font-bold text-[#A7D7D7] uppercase tracking-wider block">
              Hydrogeological Reservoir
            </span>
            <div className="text-xl sm:text-2xl font-black mt-1">
              Rampur Unconfined Aquifer
            </div>
            <div className="text-xs text-[#F5F1E8]/70 mt-1">
              Fractured Granitic Horizon (12m - 45m depth)
            </div>

            <div className="mt-4 pt-3 border-t border-[#3E524D] grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[#A7D7D7] font-bold block">
                  +{(inputs.totalInputsLiters / 1000).toFixed(1)} m³
                </span>
                <span className="text-[10px] text-[#F5F1E8]/60">Total Inflow</span>
              </div>
              <div>
                <span className="text-[#C56B4C] font-bold block">
                  -{(outputs.totalOutputsLiters / 1000).toFixed(1)} m³
                </span>
                <span className="text-[10px] text-[#F5F1E8]/60">Total Extraction</span>
              </div>
            </div>
          </div>

          {/* Outputs Column */}
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#C56B4C] block mb-2">
              Sinks of Extraction
            </span>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#C56B4C]">
                <span>Borewells (Agri)</span>
                <span>{(outputs.borewellExtractionLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#C56B4C] h-full rounded"
                  style={{
                    width: `${Math.round((outputs.borewellExtractionLiters / outputs.totalOutputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#1E2A28]">
                <span>Domestic Supply</span>
                <span>{(outputs.communityUsageLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#3B7C8A] h-full rounded"
                  style={{
                    width: `${Math.round((outputs.communityUsageLiters / outputs.totalOutputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="p-3 rounded bg-[#F5F1E8] border border-[#D8D2C4] text-xs">
              <div className="flex justify-between font-semibold text-[#1E2A28]">
                <span>Distributed Draw</span>
                <span>{(outputs.otherAgriculturalExtractionLiters / 1000).toFixed(1)} m³</span>
              </div>
              <div className="w-full bg-[#EAE5DB] h-1.5 rounded mt-1.5">
                <div
                  className="bg-[#D9C6A4] h-full rounded"
                  style={{
                    width: `${Math.round((outputs.otherAgriculturalExtractionLiters / outputs.totalOutputsLiters) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
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
