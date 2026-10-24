/**
 * BhujalSetu - Community Groundwater Intelligence System
 * TypeScript Data Models and Interfaces
 */

export type AlertSeverity = 'NORMAL' | 'WATCH' | 'CRITICAL';
export type TimeRange = '7d' | '30d' | '90d';
export type BalancePeriod = 'daily' | 'weekly' | 'monthly';
export type ActionPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';

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
  inputs: {
    rainfallInfiltrationLiters: number;
    managedRechargeLiters: number;
    subsurfaceInflowLiters: number;
    totalInputsLiters: number;
  };
  outputs: {
    borewellExtractionLiters: number;
    communityUsageLiters: number;
    otherAgriculturalExtractionLiters: number;
    totalOutputsLiters: number;
  };
  netBalanceLiters: number; // Positive = surplus, Negative = deficit
  netBalanceM3: number;
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
  waterLevelSensor: string; // "HC-SR04 Ultrasonic Sensor (Well depth)"
  flowSensors: string; // "2 × YF-S201 Hall-Effect Flow Sensors"
  actuator: string; // "5V Relay + Submersible Pump"
  telemetryMode: string; // "Wi-Fi HTTP REST / MQTT"
  samplingIntervalSeconds: number;
}
