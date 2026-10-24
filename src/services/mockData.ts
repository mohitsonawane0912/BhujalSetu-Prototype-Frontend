import {
  GroundwaterReading,
  WaterBalance,
  Alert,
  ActionRecommendation,
  CommunityActionItem,
  WaterPledgeItem,
  VillageCommunity,
  HardwareSensorSpec,
} from '../types/groundwater';
import { calculateWaterBalance } from '../utils/groundwaterLogic';

export const CURRENT_VILLAGE: VillageCommunity = {
  id: 'village-rampur-04',
  name: 'Rampur Gram Panchayat',
  district: 'Jodhpur',
  state: 'Rajasthan',
  aquiferType: 'Hard-rock semi-confined fractured granite/sandstone',
  participatingHouseholds: 342,
  totalBorewellsTracked: 18,
  activeRechargeStructures: 7,
  totalRechargedThisSeasonLiters: 1420000,
};

export const AVAILABLE_COMMUNITIES: VillageCommunity[] = [
  CURRENT_VILLAGE,
  {
    id: 'village-shivpuri-02',
    name: 'Shivpuri Aquifer Cluster',
    district: 'Indore',
    state: 'Madhya Pradesh',
    aquiferType: 'Basaltic Deccan Trap with alluvial pockets',
    participatingHouseholds: 215,
    totalBorewellsTracked: 12,
    activeRechargeStructures: 5,
    totalRechargedThisSeasonLiters: 980000,
  },
  {
    id: 'village-adarsh-01',
    name: 'Adarsh Model Watershed',
    district: 'Ahmednagar',
    state: 'Maharashtra',
    aquiferType: 'Weathered vesicular basalt ridge',
    participatingHouseholds: 520,
    totalBorewellsTracked: 24,
    activeRechargeStructures: 14,
    totalRechargedThisSeasonLiters: 2840000,
  },
];

// Current Primary Groundwater Reading (Simulated prototype values)
export const CURRENT_GROUNDWATER_READING: GroundwaterReading = {
  timestamp: new Date().toISOString(),
  depthMeters: 18.4, // 18.4 m below ground level
  historicalBaselineMeters: 17.8,
  changeMeters: -0.6, // -0.6 m drop compared to seasonal baseline
  status: 'WATCH',
  wellId: 'COMMUNITY-PIEZOMETER-01',
  locationName: 'Ward 3 Central Monitoring Well',
};

// Daily Water Balance
export const DAILY_WATER_BALANCE: WaterBalance = calculateWaterBalance(
  {
    rainfallInfiltrationLiters: 14200,
    managedRechargeLiters: 18600,
    subsurfaceInflowLiters: 3500,
  },
  {
    borewellExtractionLiters: 28400,
    communityUsageLiters: 12800,
    otherAgriculturalExtractionLiters: 10500,
  },
  'daily',
  'Today (Past 24 Hours)'
);

// Weekly Water Balance
export const WEEKLY_WATER_BALANCE: WaterBalance = calculateWaterBalance(
  {
    rainfallInfiltrationLiters: 94000,
    managedRechargeLiters: 122000,
    subsurfaceInflowLiters: 24000,
  },
  {
    borewellExtractionLiters: 198000,
    communityUsageLiters: 89000,
    otherAgriculturalExtractionLiters: 65000,
  },
  'weekly',
  'Last 7 Days Cumulative'
);

// Monthly Water Balance
export const MONTHLY_WATER_BALANCE: WaterBalance = calculateWaterBalance(
  {
    rainfallInfiltrationLiters: 410000,
    managedRechargeLiters: 580000,
    subsurfaceInflowLiters: 110000,
  },
  {
    borewellExtractionLiters: 820000,
    communityUsageLiters: 380000,
    otherAgriculturalExtractionLiters: 290000,
  },
  'monthly',
  'Past 30 Days Cumulative'
);

// Alerts (Simulated rule-triggered alerts)
export const INITIAL_ALERTS: Alert[] = [
  {
    id: 'alert-01',
    severity: 'WATCH',
    title: 'Groundwater level is declining faster than recent baseline',
    message: 'Water depth has reached 18.4 m (-0.6 m shift in 7 days). Extraction remains 1.4× higher than recharge infiltration.',
    triggerMetric: 'Water Level Shift',
    thresholdValue: '-0.30 m / week',
    actualValue: '-0.60 m / week',
    timestamp: '2 hours ago',
  },
  {
    id: 'alert-02',
    severity: 'NORMAL',
    title: 'Recharge Pit #3 De-silting verified',
    message: 'Filter media cleared by Ward 2 volunteer team. Percolation rate restored to 45 L/min design capacity.',
    triggerMetric: 'Percolation Infiltration',
    thresholdValue: '> 30 L/min',
    actualValue: '45 L/min',
    timestamp: 'Yesterday at 16:30',
  },
  {
    id: 'alert-03',
    severity: 'CRITICAL',
    title: 'High continuous draw detected at East Borewell #05',
    message: 'Continuous night pumping for 7 consecutive hours detected. Potential unregistered commercial draw or valve failure.',
    triggerMetric: 'Uninterrupted Draw Duration',
    thresholdValue: '< 4.0 hours',
    actualValue: '7.2 hours',
    timestamp: 'Yesterday at 04:15',
  },
];

// Initial Action Recommendations
export const INITIAL_RECOMMENDATIONS: ActionRecommendation[] = [
  {
    id: 'rec-01',
    title: 'Extraction is above recent recharge capacity',
    whyAppeared: 'Community extraction (51.7 m³/day) exceeded managed recharge and natural infiltration (36.3 m³/day) by 42% over the last 5 days.',
    suggestedAction: 'Coordinate with agricultural committee to implement 36-hour rotation between North and South agricultural pump sets.',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'EXTRACTION',
    supportingMetrics: [
      { label: 'Daily Extraction', value: '51.7 m³', threshold: 'Target: < 38.0 m³' },
      { label: 'Recharge Inflow', value: '36.3 m³', threshold: 'Min: 35.0 m³' },
      { label: 'Aquifer Net Balance', value: '-15.4 m³ (Deficit)', threshold: 'Target: >= 0 m³' },
    ],
    dateGenerated: 'Generated today at 06:00',
  },
  {
    id: 'rec-02',
    title: 'Prioritize recharge after rainfall events',
    whyAppeared: 'A 24.5 mm rainfall event was recorded. Surrounding catchment runoff is currently peaking along the secondary nullah.',
    suggestedAction: 'Open diversion gates to the Ward 4 percolation pond and inspect silt trap filters to capture the first post-monsoon wave.',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'RECHARGE',
    supportingMetrics: [
      { label: 'Recorded Rain', value: '24.5 mm', threshold: 'Threshold: >= 15 mm' },
      { label: 'Runoff Inflow Potential', value: '38,000 L', threshold: 'Pond Capacity: 60,000 L' },
    ],
    dateGenerated: 'Generated 6 hours ago',
  },
  {
    id: 'rec-03',
    title: 'Check the borewell area for unusual extraction or pipe leaks',
    whyAppeared: 'Sensor HC-SR04 registered sudden 0.4 m drop during non-irrigation window between 01:00 and 05:00.',
    suggestedAction: 'Conduct physical line walk on western distribution main; verify if automatic float valve in the overhead tank stuck open.',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    category: 'MONITORING',
    supportingMetrics: [
      { label: 'Night Flow Rate', value: '18 L/min', threshold: 'Expected: < 3 L/min' },
      { label: 'Sudden Drop', value: '-0.42 m', threshold: 'Allowed: < 0.10 m' },
    ],
    dateGenerated: 'Generated yesterday',
  },
  {
    id: 'rec-04',
    title: 'Schedule seasonal aquifer boundary audit',
    whyAppeared: '30-day monitoring cycle completed. Seasonal post-harvest recharge review is now due.',
    suggestedAction: 'Convene monthly Pani Samiti (Water Committee) meeting to review household consumption and recharge pit readiness.',
    priority: 'LOW',
    status: 'COMPLETED',
    category: 'MAINTENANCE',
    supportingMetrics: [
      { label: 'Monitoring Cycle', value: 'Day 30 of 30', threshold: 'Monthly' },
      { label: 'Participating Households', value: '342 families', threshold: 'Target: 300+' },
    ],
    dateGenerated: '3 days ago',
  },
];

// Initial Community Actions
export const INITIAL_COMMUNITY_ACTIONS: CommunityActionItem[] = [
  {
    id: 'act-01',
    userId: 'user-rampur-01',
    userName: 'Kavita Patel (Ward 2 Head)',
    userEmail: 'kavita.p@rampur.in',
    actionType: 'recharge_pit_clearing',
    title: 'Ward 2 Main Silt Basin De-Silting',
    description: 'Mobilized 8 neighborhood volunteers to dig out 1.2 tons of compacted silt from the percolation basin ahead of expected rain.',
    ward: 'Ward 2 (Northern Catchment)',
    impactLiters: 45000,
    status: 'completed',
    createdAt: '2026-10-23T14:30:00Z',
  },
  {
    id: 'act-02',
    userId: 'user-rampur-02',
    userName: 'Rameshwar Meena (Farmer Group Lead)',
    userEmail: 'rameshwar.m@rampur.in',
    actionType: 'borewell_scheduling',
    title: 'Pumping Schedule Shift to Night Roster',
    description: 'Agreed with 14 neighboring tubewell owners to halt peak daytime pumping between 11:00 and 16:00 to reduce cone-of-depression stress.',
    ward: 'Ward 4 (Agricultural Fields)',
    impactLiters: 32000,
    status: 'in_progress',
    createdAt: '2026-10-22T09:15:00Z',
  },
  {
    id: 'act-03',
    userId: 'user-rampur-03',
    userName: 'Anil Godara (Youth Club Secretary)',
    userEmail: 'anil.g@rampur.in',
    actionType: 'rainwater_harvest_check',
    title: 'Government School Rooftop Filter Media Replacement',
    description: 'Installed washed pea gravel and charcoal filter bed on the 400 m² primary school rooftop rainwater pipe.',
    ward: 'Ward 1 (Central Village)',
    impactLiters: 18000,
    status: 'completed',
    createdAt: '2026-10-20T11:00:00Z',
  },
  {
    id: 'act-04',
    userId: 'user-rampur-04',
    userName: 'Sunita Mehar (Jal Saheli)',
    userEmail: 'sunita.m@rampur.in',
    actionType: 'leak_repair',
    title: 'Community Standpost Tap Washer Overhaul',
    description: 'Repaired 11 dripping public standpost taps across Bazaar chowk, saving continuous 24/7 drip losses.',
    ward: 'Ward 3 (Market Area)',
    impactLiters: 8500,
    status: 'completed',
    createdAt: '2026-10-19T16:00:00Z',
  },
];

// Initial Water Pledges
export const INITIAL_WATER_PLEDGES: WaterPledgeItem[] = [
  {
    id: 'pledge-01',
    userId: 'p-user-1',
    userName: 'Dinesh & Family',
    pledgeType: 'irrigation_timing',
    targetLitersPerDay: 120,
    communityId: 'village-rampur-04',
    createdAt: '2026-10-21T08:00:00Z',
  },
  {
    id: 'pledge-02',
    userId: 'p-user-2',
    userName: 'Bhanwari Devi',
    pledgeType: 'rain_storage',
    targetLitersPerDay: 80,
    communityId: 'village-rampur-04',
    createdAt: '2026-10-22T10:30:00Z',
  },
  {
    id: 'pledge-03',
    userId: 'p-user-3',
    userName: 'Kishanlal Carpenter',
    pledgeType: 'aerator_install',
    targetLitersPerDay: 45,
    communityId: 'village-rampur-04',
    createdAt: '2026-10-23T12:00:00Z',
  },
  {
    id: 'pledge-04',
    userId: 'p-user-4',
    userName: 'Govind Teacher',
    pledgeType: 'recharge_well_adoption',
    targetLitersPerDay: 200,
    communityId: 'village-rampur-04',
    createdAt: '2026-10-24T06:15:00Z',
  },
];

// Prototype Hardware Spec (ESP32)
export const PROTOTYPE_HARDWARE_SPEC: HardwareSensorSpec = {
  controller: 'ESP32-WROOM-32 (32-bit Dual Core Tensilica Xtensa, 240MHz)',
  waterLevelSensor: 'HC-SR04 Ultrasonic Ranging Module (calibrated for well casing depth 0.2m - 40m)',
  flowSensors: '2 × YF-S201 Hall-Effect Turbines (Sensor 1: Inflow Recharge, Sensor 2: Borewell Extraction)',
  actuator: '5V Optocoupler Relay controlling 12V/220V Submersible Valve & Solenoid Protection',
  telemetryMode: 'Wi-Fi 802.11 b/g/n → JSON payload over HTTPS REST / MQTT topic',
  samplingIntervalSeconds: 60,
};

// Trend Data Generator for 7d, 30d, 90d
export function generateTrendSeries(days: number) {
  const result = [];
  const baseDepth = 17.2;
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dayName = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Simulated rain events every ~6 to 10 days
    const isRainDay = (days - i) % 7 === 0 || (days - i) % 11 === 0;
    const rainfall = isRainDay ? Math.round((8 + Math.abs(Math.sin(i * 1.5)) * 18) * 10) / 10 : 0;

    // Recharge happens when rainfall > 0 or base managed recharge
    const rechargeLiters = rainfall > 0
      ? Math.round(rainfall * 950 + 15000 + (Math.sin(i) * 3000))
      : Math.round(14000 + Math.cos(i) * 2000);

    // Extraction varies between 38,000L and 56,000L
    const extractionLiters = Math.round(44000 + Math.sin(i * 0.8) * 9000);

    // Depth gradually drifts down unless rain recharges
    const seasonalDrift = (days - i) * 0.015;
    const rainRecovery = rainfall > 15 ? 0.35 : (rainfall > 5 ? 0.12 : 0);
    const depthMeters = Math.round((baseDepth + seasonalDrift - rainRecovery) * 100) / 100;

    const netBalanceM3 = Math.round(((rechargeLiters - extractionLiters) / 1000) * 10) / 10;

    result.push({
      date: dayName,
      fullDate: d.toISOString().split('T')[0],
      depthMeters,
      baselineDepthMeters: 17.5,
      waterExtractedLiters: extractionLiters,
      waterRechargedLiters: rechargeLiters,
      rainfallMm: rainfall,
      netBalanceM3,
    });
  }

  return result;
}
