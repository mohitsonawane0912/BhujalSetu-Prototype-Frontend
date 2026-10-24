/**
 * Utility for exporting groundwater and hydrological trends to formatted CSV
 * Designed for community leaders, water committees, and offline reporting.
 */

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

/**
 * Pure function that transforms trend data into a formatted CSV string
 * with header metadata and summary statistics.
 */
export function generateTrendsCsvString(
  rows: TrendRow[],
  villageName: string = 'Rampur Gram Panchayat',
  timeRange: string = '30d'
): string {
  const lines: string[] = [];

  // Header metadata rows for village records
  lines.push('# BhujalSetu — Community Groundwater Intelligence & Recharge System');
  lines.push(`# Community / Cluster: ${villageName}`);
  lines.push(`# Time Window: ${timeRange.toUpperCase()} (${rows.length} records)`);
  lines.push(`# Export Timestamp: ${new Date().toISOString()}`);
  lines.push('# Notice: SIMULATED / PROTOTYPE DATA — NOT LIVE SENSORS');
  lines.push(''); // Blank line before table

  // CSV column headers
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

  // Data rows
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

  // Summary Row
  if (rows.length > 0) {
    const avgDepth = (totalDepthMeters / rows.length).toFixed(2);
    const sumExtractedM3 = (totalExtractedLiters / 1000).toFixed(2);
    const sumRechargedM3 = (totalRechargedLiters / 1000).toFixed(2);

    lines.push(''); // Spacer
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

/**
 * Triggers client-side browser file download for the CSV report
 */
export function downloadTrendsCsv(
  rows: TrendRow[],
  villageName: string = 'Rampur Gram Panchayat',
  timeRange: string = '30d'
): { filename: string; rowCount: number } {
  const csvContent = generateTrendsCsvString(rows, villageName, timeRange);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const sanitizedVillage = villageName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `BhujalSetu_${sanitizedVillage}_Trends_${timeRange}_${dateStr}.csv`;

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

  return { filename, rowCount: rows.length };
}
