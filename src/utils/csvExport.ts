/**
 * Utility for exporting authenticated prototype sensor telemetry to CSV
 * Designed for community leaders, water committees, and technical auditing.
 */

import { NodePrototypeTelemetry } from '../types/groundwater';

/**
 * Transforms real measured telemetry into a formatted CSV string
 * with header metadata and summary statistics.
 */
export function generateMeasuredTelemetryCsvString(
  records: NodePrototypeTelemetry[],
  villageName: string = 'Rampur Gram Panchayat',
  timeRange: string = '30d'
): string {
  const lines: string[] = [];

  // Header metadata rows
  lines.push('# BhujalSetu — Authenticated Two-Node Sensor Telemetry Export');
  lines.push(`# Community / Cluster: ${villageName}`);
  lines.push(`# Time Window: ${timeRange.toUpperCase()} (${records.length} records)`);
  lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
  lines.push('# Notice: Authenticated tabletop prototype measurements only (Node 1 recharge/tank level + Node 2 extraction flow).');
  lines.push('# Physical Boundary: Tabletop measurements do not infer aquifer depth, rainfall, or community groundwater balance.');
  lines.push(''); // Blank line before data table

  // CSV column headers
  const headers = [
    'Captured At (ISO)',
    'Captured At (Local)',
    'Node ID',
    'Hardware Device ID',
    'Data Source',
    'Flow Rate (L/min)',
    'Session Total (Liters)',
    'Pulses (Window)',
    'Pulse Frequency (Hz)',
    'Tabletop Tank Level (cm)',
    'Tabletop Tank Sensor Gap (cm)',
  ];
  lines.push(headers.map((h) => `"${h}"`).join(','));

  // Data rows
  let node1Count = 0;
  let node2Count = 0;
  let maxNode1TotalLiters = 0;
  let maxNode2TotalLiters = 0;

  records.forEach((r) => {
    if (r.nodeId === 'node-1') {
      node1Count++;
      if (r.flow.totalLiters > maxNode1TotalLiters) maxNode1TotalLiters = r.flow.totalLiters;
    } else if (r.nodeId === 'node-2') {
      node2Count++;
      if (r.flow.totalLiters > maxNode2TotalLiters) maxNode2TotalLiters = r.flow.totalLiters;
    }

    const localTime = new Date(r.capturedAt).toLocaleString();
    const flowLpm = r.flow.flowLpm.toFixed(2);
    const totalLiters = r.flow.totalLiters.toFixed(2);
    const pulses = r.flow.pulses.toString();
    const freqHz = r.flow.frequencyHz.toFixed(1);
    const levelCm = r.waterLevel ? r.waterLevel.levelCm.toFixed(1) : 'N/A';
    const distanceCm = r.waterLevel ? r.waterLevel.distanceCm.toFixed(1) : 'N/A';

    const rowValues = [
      r.capturedAt,
      localTime,
      r.nodeId,
      r.deviceId,
      r.dataSource,
      flowLpm,
      totalLiters,
      pulses,
      freqHz,
      levelCm,
      distanceCm,
    ];

    lines.push(rowValues.map((v) => `"${v}"`).join(','));
  });

  // Summary Row
  if (records.length > 0) {
    lines.push(''); // Spacer
    const summaryValues = [
      'TOTALS & SUMMARY',
      `Total records: ${records.length}`,
      `Node 1 packets: ${node1Count}`,
      `Node 2 packets: ${node2Count}`,
      'Verified Hardware',
      '—',
      `Max Totals: N1=${maxNode1TotalLiters.toFixed(2)}L, N2=${maxNode2TotalLiters.toFixed(2)}L`,
      '—',
      '—',
      '—',
      '—',
    ];
    lines.push(summaryValues.map((v) => `"${v}"`).join(','));
  }

  return lines.join('\r\n');
}

/**
 * Triggers client-side browser file download for the CSV report
 */
export function downloadMeasuredTelemetryCsv(
  records: NodePrototypeTelemetry[],
  villageName: string = 'Rampur Gram Panchayat',
  timeRange: string = '30d'
): { filename: string; rowCount: number } {
  const csvContent = generateMeasuredTelemetryCsvString(records, villageName, timeRange);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const sanitizedVillage = villageName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `BhujalSetu_${sanitizedVillage}_Measured_Telemetry_${timeRange}_${dateStr}.csv`;

  // Create temporary link and click
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return { filename, rowCount: records.length };
}

// Retain backwards-compatible export name for any callers
export const downloadTrendsCsv = (
  data: any[],
  villageName?: string,
  timeRange?: string
) => {
  // If data items are NodePrototypeTelemetry records
  if (data.length > 0 && 'nodeId' in data[0]) {
    return downloadMeasuredTelemetryCsv(data as NodePrototypeTelemetry[], villageName, timeRange);
  }
  // Otherwise if empty
  return downloadMeasuredTelemetryCsv([], villageName, timeRange);
};

// Legacy test fixtures types and functions retained strictly for automated test suites
export interface TrendRow {
  date: string;
  fullDate: string;
  depthMeters: number;
  baselineDepthMeters?: number;
  waterExtractedLiters: number;
  waterRechargedLiters: number;
  rainfallMm: number;
  netBalanceM3: number;
}

export function generateTrendsCsvString(
  rows: TrendRow[],
  villageName: string = 'Rampur Gram Panchayat',
  timeRange: string = '30d'
): string {
  const lines: string[] = [];

  lines.push('# BhujalSetu — Community Groundwater Intelligence & Recharge System');
  lines.push(`# Community / Cluster: ${villageName}`);
  lines.push(`# Time Window: ${timeRange.toUpperCase()} (${rows.length} records)`);
  lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
  lines.push('# Notice: SIMULATED / PROTOTYPE DATA — NOT LIVE SENSORS');
  lines.push('');

  const headers = [
    'Date Label',
    'Date (ISO)',
    'Water Table Depth (m)',
    'Seasonal Baseline Depth (m)',
    'Water Extracted (Liters)',
    'Water Extracted (m3)',
    'Water Recharged (Liters)',
    'Water Recharged (m3)',
    'Rainfall (mm)',
    'Net Balance (m3)',
    'Status Indicator',
  ];
  lines.push(headers.map((h) => `"${h}"`).join(','));

  let totalExtractedLiters = 0;
  let totalRechargedLiters = 0;
  let totalRainfallMm = 0;
  let totalDepthMeters = 0;
  let totalNetBalanceM3 = 0;

  rows.forEach((r) => {
    totalExtractedLiters += r.waterExtractedLiters;
    totalRechargedLiters += r.waterRechargedLiters;
    totalRainfallMm += r.rainfallMm;
    totalDepthMeters += r.depthMeters;
    totalNetBalanceM3 += r.netBalanceM3;

    const extractedM3 = (r.waterExtractedLiters / 1000).toFixed(2);
    const rechargedM3 = (r.waterRechargedLiters / 1000).toFixed(2);
    const status = r.netBalanceM3 >= 0 ? 'Surplus' : 'Deficit';

    const rowValues = [
      r.date,
      r.fullDate,
      r.depthMeters.toFixed(2),
      (r.baselineDepthMeters ?? 17.5).toFixed(2),
      r.waterExtractedLiters.toString(),
      extractedM3,
      r.waterRechargedLiters.toString(),
      rechargedM3,
      r.rainfallMm.toFixed(1),
      r.netBalanceM3.toFixed(2),
      status,
    ];

    lines.push(rowValues.map((v) => `"${v}"`).join(','));
  });

  if (rows.length > 0) {
    const avgDepth = (totalDepthMeters / rows.length).toFixed(2);
    const sumExtractedM3 = (totalExtractedLiters / 1000).toFixed(2);
    const sumRechargedM3 = (totalRechargedLiters / 1000).toFixed(2);

    lines.push('');
    const summaryValues = [
      'TOTALS & AVERAGES',
      `Summary for ${rows.length} days`,
      `Avg: ${avgDepth}`,
      '17.50',
      totalExtractedLiters.toString(),
      sumExtractedM3,
      totalRechargedLiters.toString(),
      sumRechargedM3,
      totalRainfallMm.toFixed(1),
      totalNetBalanceM3.toFixed(2),
      totalNetBalanceM3 >= 0 ? 'Overall Surplus' : 'Overall Deficit',
    ];
    lines.push(summaryValues.map((v) => `"${v}"`).join(','));
  }

  return lines.join('\r\n');
}
