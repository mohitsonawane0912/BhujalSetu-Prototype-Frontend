import { AlertSeverity, WaterBalance, ActionRecommendation } from '../types/groundwater';

/**
 * Calculates net water balance from inputs and outputs in Liters and cubic meters.
 */
export function calculateWaterBalance(
  inputs: {
    rainfallInfiltrationLiters: number;
    managedRechargeLiters: number;
    subsurfaceInflowLiters: number;
  },
  outputs: {
    borewellExtractionLiters: number;
    communityUsageLiters: number;
    otherAgriculturalExtractionLiters: number;
  },
  period: 'daily' | 'weekly' | 'monthly' = 'daily',
  dateLabel: string = 'Current Period'
): WaterBalance {
  const totalInputsLiters =
    inputs.rainfallInfiltrationLiters +
    inputs.managedRechargeLiters +
    inputs.subsurfaceInflowLiters;

  const totalOutputsLiters =
    outputs.borewellExtractionLiters +
    outputs.communityUsageLiters +
    outputs.otherAgriculturalExtractionLiters;

  const netBalanceLiters = totalInputsLiters - totalOutputsLiters;
  const netBalanceM3 = Math.round((netBalanceLiters / 1000) * 10) / 10;

  return {
    period,
    dateLabel,
    inputs: {
      ...inputs,
      totalInputsLiters,
    },
    outputs: {
      ...outputs,
      totalOutputsLiters,
    },
    netBalanceLiters,
    netBalanceM3,
  };
}

/**
 * Evaluates groundwater status (Stable / Watch / Critical) based on depth, recent decline, and extraction ratio.
 */
export function evaluateGroundwaterStatus(
  currentDepthMeters: number,
  baselineMeters: number,
  changeMeters: number
): {
  severity: AlertSeverity;
  label: 'Stable' | 'Watch' | 'Critical';
  summary: string;
} {
  // changeMeters: negative indicates water table has dropped (e.g. -0.6m means depth increased by 0.6m)
  const decline = -changeMeters;

  if (currentDepthMeters >= 25 || decline >= 1.2) {
    return {
      severity: 'CRITICAL',
      label: 'Critical',
      summary: 'Rapid decline detected. Immediate community review and extraction reduction recommended.',
    };
  }

  if (currentDepthMeters >= 17 || decline >= 0.4) {
    return {
      severity: 'WATCH',
      label: 'Watch',
      summary: 'Groundwater level is declining faster than the recent baseline. Monitoring active.',
    };
  }

  return {
    severity: 'NORMAL',
    label: 'Stable',
    summary: 'Groundwater trend is stable within seasonal equilibrium boundaries.',
  };
}

/**
 * Calculates theoretical harvested rainwater recharge volume:
 * Volume (Liters) = Area (m²) × Rainfall (mm) × Runoff Coefficient
 * (Since 1 mm of rain over 1 m² equals 1 Liter)
 */
export function calculateRechargeVolume(
  catchmentAreaSqMeters: number,
  rainfallMm: number,
  runoffCoefficient: number
): {
  liters: number;
  cubicMeters: number;
  explanation: string;
} {
  const safeArea = Math.max(0, catchmentAreaSqMeters);
  const safeRain = Math.max(0, rainfallMm);
  const safeCoeff = Math.min(Math.max(0, runoffCoefficient), 1.0);

  const liters = Math.round(safeArea * safeRain * safeCoeff);
  const cubicMeters = Math.round((liters / 1000) * 10) / 10;

  return {
    liters,
    cubicMeters,
    explanation: `${safeArea.toLocaleString()} m² catchment × ${safeRain} mm rainfall × ${safeCoeff} runoff coefficient ≈ ${liters.toLocaleString()} L`,
  };
}

/**
 * Generates rule-based advisory statements from current readings and water balance.
 * Uses deterministic threshold rules, not blackbox ML.
 */
export function generateRuleBasedAdvisories(
  currentDepthMeters: number,
  changeMeters: number,
  totalInputsLiters: number,
  totalOutputsLiters: number,
  recentRainfallMm: number
): ActionRecommendation[] {
  const recommendations: ActionRecommendation[] = [];
  const extractionRatio = totalInputsLiters > 0 ? totalOutputsLiters / totalInputsLiters : 2.5;

  // Rule 1: Extraction significantly higher than recharge
  if (extractionRatio > 1.35) {
    recommendations.push({
      id: 'rec-extraction-elevated',
      title: 'Extraction is above recent recharge capacity',
      whyAppeared: `Community extraction (${Math.round(totalOutputsLiters / 1000)} m³) exceeded recharge inflow (${Math.round(totalInputsLiters / 1000)} m³) by ${Math.round((extractionRatio - 1) * 100)}% over the observation window.`,
      suggestedAction: 'Coordinate irrigation cycles with cluster farmers; shift non-essential borewell pumping to night cycles or staggered schedules.',
      priority: 'HIGH',
      status: 'OPEN',
      category: 'EXTRACTION',
      supportingMetrics: [
        { label: 'Total Output', value: `${(totalOutputsLiters / 1000).toFixed(1)} m³`, threshold: 'Sustainable budget: < 150 m³' },
        { label: 'Recharge Inflow', value: `${(totalInputsLiters / 1000).toFixed(1)} m³`, threshold: 'Target: > 120 m³' },
        { label: 'Extraction Ratio', value: `${extractionRatio.toFixed(2)}x`, threshold: 'Safe: <= 1.0x' },
      ],
      dateGenerated: 'Updated today',
    });
  }

  // Rule 2: Rainfall event occurred or anticipated -> prioritize recharge structures
  if (recentRainfallMm >= 15) {
    recommendations.push({
      id: 'rec-recharge-post-rain',
      title: 'Prioritize recharge pit de-silting and channel clearing',
      whyAppeared: `Recent cumulative rainfall of ${recentRainfallMm} mm provides immediate surface runoff. Well de-silting will maximize aquifer replenishment.`,
      suggestedAction: 'Inspect Ward 2 & 4 community recharge shafts for silt accumulation and ensure filter media is unblocked before the next runoff pulse.',
      priority: 'MEDIUM',
      status: 'OPEN',
      category: 'RECHARGE',
      supportingMetrics: [
        { label: 'Recent Rainfall', value: `${recentRainfallMm} mm`, threshold: 'Trigger: >= 15 mm' },
        { label: 'Estimated Inflow Potential', value: `${(recentRainfallMm * 850).toLocaleString()} L`, threshold: 'Capacity: 50,000 L' },
      ],
      dateGenerated: 'Updated today',
    });
  }

  // Rule 3: Water table dropping steadily
  if (changeMeters <= -0.4) {
    recommendations.push({
      id: 'rec-check-borewell-zone',
      title: 'Check the borewell area for unusual extraction or leaks',
      whyAppeared: `Groundwater level dropped by ${Math.abs(changeMeters).toFixed(2)} m (current depth ${currentDepthMeters.toFixed(1)} m), exceeding the normal 0.3 m weekly drop curve.`,
      suggestedAction: 'Verify flow meters at Western Cluster borewells #3 and #7 for continuous draw or line breach.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      category: 'MONITORING',
      supportingMetrics: [
        { label: 'Water Level Drop', value: `${Math.abs(changeMeters).toFixed(2)} m`, threshold: 'Max baseline: 0.30 m' },
        { label: 'Current Depth', value: `${currentDepthMeters.toFixed(1)} m below surface`, threshold: 'Watch depth: 17.0 m' },
      ],
      dateGenerated: 'Updated yesterday',
    });
  }

  // Rule 4: Ongoing community maintenance
  recommendations.push({
    id: 'rec-participatory-maintenance',
    title: 'Validate check-dam bunding before monsoon transitions',
    whyAppeared: 'Quarterly participatory water audit scheduled for community aquifer boundary.',
    suggestedAction: 'Mobilize volunteer team to clear vegetative debris along primary check dam spillways.',
    priority: 'LOW',
    status: 'OPEN',
    category: 'MAINTENANCE',
    supportingMetrics: [
      { label: 'Audit Due', value: '7 days', threshold: 'Quarterly review' },
      { label: 'Active Recharge Pits', value: '8 of 10 operational', threshold: 'Target: 100%' },
    ],
    dateGenerated: 'Scheduled',
  });

  return recommendations;
}
