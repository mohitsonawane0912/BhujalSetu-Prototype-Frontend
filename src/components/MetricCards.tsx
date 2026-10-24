import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CloudRain,
  Scale,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { WaterBalance } from '../types/groundwater';

interface MetricCardsProps {
  waterBalance: WaterBalance;
  rainfallMm?: number;
}

export const MetricCards: React.FC<MetricCardsProps> = ({
  waterBalance,
  rainfallMm = 24.5,
}) => {
  const extractedM3 = (waterBalance.outputs.totalOutputsLiters / 1000).toFixed(1);
  const rechargeM3 = (waterBalance.inputs.totalInputsLiters / 1000).toFixed(1);
  const netM3 = waterBalance.netBalanceM3.toFixed(1);
  const isDeficit = waterBalance.netBalanceLiters < 0;

  const metrics = [
    {
      id: 'extracted',
      title: 'Water Extracted',
      value: `${extractedM3}`,
      unit: 'm³',
      secondaryVal: `${(waterBalance.outputs.totalOutputsLiters).toLocaleString()} Liters`,
      subtitle: '24h borewell & community pumping',
      trend: '+8.4% above target baseline',
      trendType: 'warning',
      icon: ArrowUpFromLine,
      iconColor: '#C56B4C',
      bgColor: '#EAE5DB',
      borderColor: '#D8D2C4',
    },
    {
      id: 'recharge',
      title: 'Water Entering / Recharge',
      value: `${rechargeM3}`,
      unit: 'm³',
      secondaryVal: `${(waterBalance.inputs.totalInputsLiters).toLocaleString()} Liters`,
      subtitle: 'Pits, trenches & managed percolation',
      trend: '+14.2% from recent rainfall',
      trendType: 'positive',
      icon: ArrowDownToLine,
      iconColor: '#1F5A48',
      bgColor: '#EAE5DB',
      borderColor: '#D8D2C4',
    },
    {
      id: 'rainfall',
      title: 'Rainfall Event',
      value: `${rainfallMm.toFixed(1)}`,
      unit: 'mm',
      secondaryVal: 'Runoff potential: ~38,000 L',
      subtitle: 'Recorded over last 48 hours',
      trend: 'Active catchment runoff peak',
      trendType: 'info',
      icon: CloudRain,
      iconColor: '#3B7C8A',
      bgColor: '#EAE5DB',
      borderColor: '#D8D2C4',
    },
    {
      id: 'net-balance',
      title: 'Net Water Balance',
      value: isDeficit ? `${netM3}` : `+${netM3}`,
      unit: 'm³',
      secondaryVal: isDeficit
        ? `${Math.abs(waterBalance.netBalanceLiters).toLocaleString()} L Deficit`
        : `${waterBalance.netBalanceLiters.toLocaleString()} L Surplus`,
      subtitle: isDeficit ? 'Aquifer storage drawn down' : 'Aquifer storage replenished',
      trend: isDeficit ? 'Extraction outpaces infiltration' : 'Recharge exceeding extraction',
      trendType: isDeficit ? 'negative' : 'positive',
      icon: Scale,
      iconColor: isDeficit ? '#B74A3B' : '#1F5A48',
      bgColor: '#EAE5DB',
      borderColor: '#D8D2C4',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.id}
            className="p-5 rounded-xl border transition-all duration-200 hover:shadow-xs flex flex-col justify-between"
            style={{
              backgroundColor: m.bgColor,
              borderColor: m.borderColor,
            }}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#1E2A28]/70">
                  {m.title}
                </span>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{
                    backgroundColor: `${m.iconColor}15`,
                    color: m.iconColor,
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline space-x-1.5">
                <span
                  className="text-3xl font-extrabold tracking-tight"
                  style={{
                    color: m.id === 'net-balance' && isDeficit ? '#B74A3B' : '#1E2A28',
                  }}
                >
                  {m.value}
                </span>
                <span className="text-sm font-semibold text-[#1E2A28]/60">
                  {m.unit}
                </span>
              </div>

              <div className="text-xs font-medium text-[#1E2A28]/70 mt-0.5">
                {m.secondaryVal}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D8D2C4]/70">
              <div className="text-[11px] text-[#1E2A28]/80 flex items-center justify-between">
                <span className="truncate">{m.subtitle}</span>
              </div>
              <div className="mt-1 flex items-center space-x-1 text-[11px] font-semibold">
                {m.trendType === 'negative' || m.trendType === 'warning' ? (
                  <TrendingDown className="w-3.5 h-3.5 text-[#B74A3B]" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-[#1F5A48]" />
                )}
                <span
                  className={
                    m.trendType === 'negative'
                      ? 'text-[#B74A3B]'
                      : m.trendType === 'warning'
                      ? 'text-[#C56B4C]'
                      : 'text-[#1F5A48]'
                  }
                >
                  {m.trend}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
