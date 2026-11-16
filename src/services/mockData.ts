import {
  GroundwaterReading,
  WaterBalance,
  ActionRecommendation,
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

// Prototype Hardware Spec (ESP32)
export const PROTOTYPE_HARDWARE_SPEC: HardwareSensorSpec = {
  controller: 'ESP32-WROOM-32 (32-bit Dual Core Tensilica Xtensa, 240MHz)',
  waterLevelSensor: 'HC-SR04 ultrasonic sensor mounted over tabletop tank',
  flowSensors: '2 × YF-S201 flow sensors (tabletop loop inlet and outlet)',
  actuator: 'Manual switch for tabletop DC mini pump; no automated relay control',
  telemetryMode: '2.4 GHz Wi-Fi → authenticated JSON HTTP POST to local backend',
  samplingIntervalSeconds: 10,
};
