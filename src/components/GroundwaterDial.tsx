import React from 'react';
import { AlertCircle, ArrowDown, ArrowUp, Minus, ShieldAlert, ShieldCheck } from 'lucide-react';
import { AlertSeverity } from '../types/groundwater';

interface GroundwaterDialProps {
  waterLevelMeters: number; // e.g. 18.4 m
  changeMeters: number; // e.g. -0.6 m
  status: AlertSeverity; // 'NORMAL' | 'WATCH' | 'CRITICAL'
  historicalBaselineMeters?: number;
  locationName?: string;
}

export const GroundwaterDial: React.FC<GroundwaterDialProps> = ({
  waterLevelMeters = 18.4,
  changeMeters = -0.6,
  status = 'WATCH',
  historicalBaselineMeters = 17.8,
  locationName = 'Ward 3 Central Monitoring Piezometer',
}) => {
  // Dial range: 0m (ground level) to 35m (deep aquifer limit)
  const minMeters = 0;
  const maxMeters = 35;
  const clampedDepth = Math.max(minMeters, Math.min(waterLevelMeters, maxMeters));

  // Gauge angle range: -135deg (0m, top-left) to +135deg (35m, top-right) -> 270 deg sweep
  const startAngle = 135;
  const sweepAngle = 270;
  const fraction = clampedDepth / maxMeters;
  // Calculate angle for current value
  const needleAngle = startAngle + fraction * sweepAngle;

  // Colors based on status
  const statusConfig = {
    NORMAL: {
      color: '#1F5A48',
      bgLight: '#1F5A48/10',
      label: 'Stable',
      description: 'Aquifer recharge and extraction are within balanced equilibrium.',
      icon: ShieldCheck,
    },
    WATCH: {
      color: '#C56B4C',
      bgLight: '#C56B4C/15',
      label: 'Watch',
      description: 'Water table is declining faster than seasonal baseline. Extraction elevated.',
      icon: AlertCircle,
    },
    CRITICAL: {
      color: '#B74A3B',
      bgLight: '#B74A3B/15',
      label: 'Critical',
      description: 'Rapid drop detected. Community extraction rationing required.',
      icon: ShieldAlert,
    },
  }[status];

  const StatusIcon = statusConfig.icon;

  // SVG coordinate helpers for the circular arc
  const size = 320;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2 - 20;
  const center = size / 2;

  // Convert polar coordinates to Cartesian
  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, startA: number, endA: number) => {
    const start = polarToCartesian(x, y, r, endA);
    const end = polarToCartesian(x, y, r, startA);
    const largeArcFlag = endA - startA <= 180 ? '0' : '1';
    return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y].join(' ');
  };

  // Three calibrated color segments on the ring
  // Stable: 0m to 14m (fraction 0 to 0.40)
  // Watch: 14m to 23m (fraction 0.40 to 0.65)
  // Critical: 23m to 35m (fraction 0.65 to 1.0)
  const arcStable = describeArc(center, center, radius, 135, 135 + 0.4 * 270);
  const arcWatch = describeArc(center, center, radius, 135 + 0.4 * 270, 135 + 0.65 * 270);
  const arcCritical = describeArc(center, center, radius, 135 + 0.65 * 270, 135 + 270);

  // Needle position
  const needleCoords = polarToCartesian(center, center, radius - 24, needleAngle);

  return (
    <div className="bg-[#EAE5DB] border border-[#D8D2C4] rounded-xl p-5 md:p-6 shadow-sm flex flex-col items-center">
      {/* Header section */}
      <div className="w-full flex items-center justify-between pb-3 border-b border-[#D8D2C4]/80">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1E2A28]/60">
            Groundwater Balance Dial
          </span>
          <h3 className="text-sm font-semibold text-[#1E2A28] truncate max-w-[220px] sm:max-w-xs">
            {locationName}
          </h3>
        </div>
        <div
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold border`}
          style={{
            borderColor: `${statusConfig.color}40`,
            backgroundColor: `${statusConfig.color}15`,
            color: statusConfig.color,
          }}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          <span className="uppercase tracking-wider">{statusConfig.label}</span>
        </div>
      </div>

      {/* Circular Dial SVG Canvas */}
      <div className="relative my-2 flex items-center justify-center">
        <svg
          width={size}
          height={size - 40}
          viewBox={`0 0 ${size} ${size - 20}`}
          className="overflow-visible"
        >
          {/* Subtle background track */}
          <path
            d={describeArc(center, center, radius, 135, 135 + 270)}
            fill="none"
            stroke="#D5CEBF"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Color Zone Arcs */}
          {/* Stable Zone (Forest Green) */}
          <path
            d={arcStable}
            fill="none"
            stroke="#1F5A48"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          {/* Watch Zone (Terracotta) */}
          <path
            d={arcWatch}
            fill="none"
            stroke="#C56B4C"
            strokeWidth={strokeWidth}
            strokeLinecap="butt"
          />
          {/* Critical Zone (Brick Red) */}
          <path
            d={arcCritical}
            fill="none"
            stroke="#B74A3B"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Calibrated Tick Marks */}
          {[0, 7, 14, 21, 28, 35].map((meterVal) => {
            const angle = 135 + (meterVal / maxMeters) * 270;
            const pInner = polarToCartesian(center, center, radius - 16, angle);
            const pOuter = polarToCartesian(center, center, radius - 8, angle);
            const pLabel = polarToCartesian(center, center, radius - 26, angle);
            return (
              <g key={meterVal}>
                <line
                  x1={pInner.x}
                  y1={pInner.y}
                  x2={pOuter.x}
                  y2={pOuter.y}
                  stroke="#1E2A28"
                  strokeWidth={meterVal % 14 === 0 ? 2 : 1}
                  strokeOpacity={0.4}
                />
                <text
                  x={pLabel.x}
                  y={pLabel.y + 3}
                  textAnchor="middle"
                  fontSize="9"
                  fontFamily="sans-serif"
                  fontWeight="600"
                  fill="#1E2A28"
                  opacity={0.65}
                >
                  {meterVal}m
                </text>
              </g>
            );
          })}

          {/* Needle / Radial Pointer */}
          <line
            x1={center}
            y1={center}
            x2={needleCoords.x}
            y2={needleCoords.y}
            stroke="#1E2A28"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx={center} cy={center} r="7" fill="#1E2A28" />
          <circle cx={center} cy={center} r="3" fill="#F5F1E8" />
        </svg>

        {/* Center Display Overlay */}
        <div className="absolute top-[165px] flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#1E2A28]/60">
            Current Water Level
          </span>
          <div className="flex items-baseline space-x-1 mt-0.5">
            <span className="text-4xl font-extrabold text-[#1E2A28] tracking-tight">
              {waterLevelMeters.toFixed(1)}
            </span>
            <span className="text-xl font-bold text-[#1E2A28]/70">m</span>
          </div>
          <span className="text-[11px] font-medium text-[#1E2A28]/70">
            below surface
          </span>

          {/* Change indicator pill */}
          <div className="mt-2 flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F5F1E8] border border-[#D8D2C4] shadow-2xs">
            {changeMeters < 0 ? (
              <ArrowDown className="w-3.5 h-3.5 text-[#B74A3B]" />
            ) : changeMeters > 0 ? (
              <ArrowUp className="w-3.5 h-3.5 text-[#1F5A48]" />
            ) : (
              <Minus className="w-3.5 h-3.5 text-[#1E2A28]/60" />
            )}
            <span
              className={
                changeMeters < 0
                  ? 'text-[#B74A3B]'
                  : changeMeters > 0
                  ? 'text-[#1F5A48]'
                  : 'text-[#1E2A28]'
              }
            >
              {changeMeters > 0 ? `+${changeMeters.toFixed(1)}` : `${changeMeters.toFixed(1)}`} m
            </span>
            <span className="text-[#1E2A28]/50 text-[10px]">vs 7d baseline</span>
          </div>
        </div>
      </div>

      {/* Description & Demo notice */}
      <div className="w-full mt-1 pt-3 border-t border-[#D8D2C4]/80 text-center">
        <p className="text-xs text-[#1E2A28]/80 leading-relaxed mb-2">
          {statusConfig.description}
        </p>
        <div className="inline-block px-2.5 py-0.5 bg-[#C56B4C]/10 border border-[#C56B4C]/30 text-[#B74A3B] text-[10px] font-bold tracking-wide rounded">
          DEMO DATA — NOT LIVE SENSOR READINGS
        </div>
      </div>
    </div>
  );
};
