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

// Initial Standard Participatory Action Recommendations
export const INITIAL_RECOMMENDATIONS: ActionRecommendation[] = [
  {
    id: 'rec-01',
    title: 'Establish rotating community tubewell pumping roster',
    whyAppeared: 'Standard Participatory Guideline: Staggering pump operational hours prevents localized extraction drawdown cones and protects shared aquifer yields.',
    suggestedAction: 'Coordinate with village water committee (Pani Samiti) to schedule alternating shifts between agricultural pump clusters.',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'EXTRACTION',
    supportingMetrics: [
      { label: 'Operational Focus', value: 'Pumping Schedule', threshold: 'Target: Rotating shifts' },
      { label: 'Participatory Policy', value: 'Off-Peak Irrigation', threshold: 'Minimize evaporative loss' },
      { label: 'Guideline Basis', value: 'Standard Practice', threshold: 'Community agreement' },
    ],
    dateGenerated: 'Standard Playbook Recommendation',
  },
  {
    id: 'rec-02',
    title: 'Inspect and clear silt filtration beds in community recharge pits',
    whyAppeared: 'Standard Participatory Guideline: De-silting recharge structures prior to peak seasonal runoff maximizes surface water infiltration.',
    suggestedAction: 'Organize community shramdaan (volunteer effort) to clear surface debris and inspect sand-gravel filter beds along percolation channels.',
    priority: 'HIGH',
    status: 'OPEN',
    category: 'RECHARGE',
    supportingMetrics: [
      { label: 'Operational Focus', value: 'De-Silting & Filtration', threshold: 'Inspect before rains' },
      { label: 'Asset Readiness', value: 'Runoff Capture', threshold: 'Ensure silt beds clear' },
    ],
    dateGenerated: 'Standard Playbook Recommendation',
  },
  {
    id: 'rec-03',
    title: 'Conduct physical line walks to detect distribution pipe leaks',
    whyAppeared: 'Standard Participatory Guideline: Unrepaired distribution leaks deplete village overhead storage without recharging aquifers.',
    suggestedAction: 'Inspect community pipeline joints, standposts, and float valves across all village distribution sectors.',
    priority: 'MEDIUM',
    status: 'IN_PROGRESS',
    category: 'MONITORING',
    supportingMetrics: [
      { label: 'Operational Focus', value: 'Pipeline Inspection', threshold: 'Zero visible leaks' },
      { label: 'Distribution Check', value: 'Overhead Float Valves', threshold: 'Prevent tank overflow' },
    ],
    dateGenerated: 'Standard Playbook Recommendation',
  },
  {
    id: 'rec-04',
    title: 'Convene monthly participatory water budgeting meeting',
    whyAppeared: 'Standard Participatory Guideline: Periodic community reviews align seasonal crop choices with monitored water balance data.',
    suggestedAction: 'Convene monthly Pani Samiti (Water Committee) meeting to review household conservation pledges and collective water balance.',
    priority: 'LOW',
    status: 'COMPLETED',
    category: 'MAINTENANCE',
    supportingMetrics: [
      { label: 'Operational Focus', value: 'Water Budgeting', threshold: 'Monthly Pani Samiti' },
      { label: 'Household Engagement', value: 'Voluntary Pledges', threshold: 'Community adoption' },
    ],
    dateGenerated: 'Standard Playbook Recommendation',
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
