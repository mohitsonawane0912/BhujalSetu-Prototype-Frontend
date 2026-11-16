/**
 * BhujalSetu - Community Groundwater Intelligence System
 * TypeScript Data Models and Interfaces
 */

export type AlertSeverity = 'NORMAL' | 'WATCH' | 'CRITICAL';
export type TimeRange = '7d' | '30d' | '90d';
export type BalancePeriod = 'daily' | 'weekly' | 'monthly';
export type ActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';

export type TelemetryDataSource = 'measured' | 'simulated';

export type TelemetryConnectionStatus =
  | 'loading'
  | 'signed-out'
  | 'unauthorized'
  | 'backend-error'
  | 'no-data'
  | 'ready';

export interface PrototypeTelemetry {
  id: string;
  deviceId: string;
  villageId: string;
  timestamp: string;
  receivedAt: string;
  dataSource: TelemetryDataSource;
  tankLevelPercent: number;
  tankDistanceCm: number;
  flowInLpm: number;
  flowOutLpm: number;
  flowInLitersTotal: number;
  flowOutLitersTotal: number;
  pumpEnabled: boolean;
}

export interface NodePrototypeTelemetry {
  id: string;
  schemaVersion: 1;
  deviceId: string;
  nodeId: 'node-1' | 'node-2';
  villageId: string;
  dataSource: TelemetryDataSource;
  capturedAt: string;
  receivedAt: string;
  flow: {
    pulses: number;
    frequencyHz: number;
    flowLpm: number;
    totalLiters: number;
  };
  waterLevel?: {
    distanceCm: number;
    levelCm: number;
  };
}

export interface GroundwaterReading {
  timestamp: string; // ISO string
  depthMeters: number; // e.g. 18.4 m below ground
  historicalBaselineMeters: number;
  changeMeters: number; // e.g. -0.6 m
  status: AlertSeverity;
  wellId: string;
  locationName: string;
}

export interface WaterFlowReading {
  timestamp: string;
  inflowLiters: number;
  extractionLiters: number;
  sensorIdInflow: string;
  sensorIdOutflow: string;
}

export interface RainfallReading {
  timestamp: string;
  rainfallMm: number;
  rainDurationMinutes: number;
  gaugeStation: string;
}

export interface RechargeEvent {
  id: string;
  date: string;
  structureName: string; // e.g. "Community Recharge Pit #2"
  structureType: 'recharge_shaft' | 'percolation_tank' | 'check_dam' | 'rooftop_harvest';
  volumeLiters: number;
  status: 'active' | 'scheduled' | 'maintenance';
}

export interface WaterBalance {
  period: BalancePeriod;
  dateLabel: string;
  hasLiveTelemetry?: boolean;
  isPrototypeMeasured?: boolean;
  status?: 'measured' | 'waiting_for_devices';
  inputs: {
    rainfallInfiltrationLiters: number;
    managedRechargeLiters: number;
    subsurfaceInflowLiters: number;
    totalInputsLiters: number;
  } | null;
  outputs: {
    borewellExtractionLiters: number;
    communityUsageLiters: number;
    otherAgriculturalExtractionLiters: number;
    totalOutputsLiters: number;
  } | null;
  netBalanceLiters: number | null; // Positive = surplus, Negative = deficit
  netBalanceM3: number | null;
  alignedWindowsCount?: number;
  message?: string;
  disclaimer?: string;
}

export interface GemAccrualItem {
  id: string;
  villageId: string;
  windowStart: string;
  windowEnd: string;
  rechargeLiters: number;
  extractionLiters: number;
  netLiters: number;
  gemsAwarded: number;
  node1RecordCount: number;
  node2RecordCount: number;
  accruedAt: string;
  rule: string;
}

export interface CommunityGemSummary {
  villageId: string;
  aggregateBalance: number;
  totalNetRechargeLiters: number;
  lastAccrualAt: string | null;
  rule: string;
  ledger: GemAccrualItem[];
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggerMetric: string;
  thresholdValue: string;
  actualValue: string;
  timestamp: string;
  isDismissed?: boolean;
}

export interface ActionRecommendation {
  id: string;
  title: string;
  whyAppeared: string;
  suggestedAction: string;
  priority: ActionPriority;
  status: ActionStatus;
  category: 'EXTRACTION' | 'RECHARGE' | 'MONITORING' | 'MAINTENANCE';
  supportingMetrics: {
    label: string;
    value: string;
    threshold: string;
  }[];
  dateGenerated: string;
}

export interface CommunityActionItem {
  id: string;
  communityId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  actionType: 'recharge_pit_clearing' | 'borewell_scheduling' | 'rainwater_harvest_check' | 'leak_repair' | 'greywater_recycling' | 'recharge_well_monitoring';
  title: string;
  description: string;
  ward: string;
  impactLiters: number;
  status: 'proposed' | 'in_progress' | 'completed';
  createdAt: string;
}

export interface WaterPledgeItem {
  id: string;
  userId: string;
  userName: string;
  pledgeType: 'irrigation_timing' | 'aerator_install' | 'rain_storage' | 'recharge_well_adoption';
  targetLitersPerDay: number;
  communityId: string;
  createdAt: string;
}

export interface VillageCommunity {
  id: string;
  name: string;
  district: string;
  state: string;
  aquiferType: string;
  participatingHouseholds: number;
  totalBorewellsTracked: number;
  activeRechargeStructures: number;
  totalRechargedThisSeasonLiters: number;
}

export interface HardwareSensorSpec {
  controller: string; // "ESP32-WROOM-32"
  waterLevelSensor: string; // HC-SR04 mounted above a tabletop tank
  flowSensors: string; // "2 × YF-S201 Hall-Effect Flow Sensors"
  actuator: string; // "5V Relay + Submersible Pump"
  telemetryMode: string; // "Wi-Fi HTTP REST / MQTT"
  samplingIntervalSeconds: number;
}
