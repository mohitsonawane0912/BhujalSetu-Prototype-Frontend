import test from 'node:test';
import assert from 'node:assert/strict';
import { generateTrendsCsvString, TrendRow } from './csvExport';

test('generateTrendsCsvString formats metadata, data rows and summary statistics correctly', () => {
  const sampleRows: TrendRow[] = [
    {
      date: 'Oct 23',
      fullDate: '2026-10-23',
      depthMeters: 18.2,
      baselineDepthMeters: 17.5,
      waterExtractedLiters: 45000,
      waterRechargedLiters: 30000,
      rainfallMm: 12.5,
      netBalanceM3: -15.0,
    },
    {
      date: 'Oct 24',
      fullDate: '2026-10-24',
      depthMeters: 18.4,
      baselineDepthMeters: 17.5,
      waterExtractedLiters: 48000,
      waterRechargedLiters: 32000,
      rainfallMm: 0,
      netBalanceM3: -16.0,
    },
  ];

  const csv = generateTrendsCsvString(sampleRows, 'Rampur Gram Panchayat', '7d');

  // Verify headers and metadata
  assert.match(csv, /# Community \/ Cluster: Rampur Gram Panchayat/);
  assert.match(csv, /# Time Window: 7D \(2 records\)/);
  assert.match(csv, /"Date Label","Date \(ISO\)","Water Table Depth \(m\)"/);

  // Verify rows are formatted
  assert.match(csv, /"Oct 23","2026-10-23","18.20","17.50","45000","45.00","30000","30.00","12.5","-15.00","Deficit"/);
  assert.match(csv, /"Oct 24","2026-10-24","18.40","17.50","48000","48.00","32000","32.00","0.0","-16.00","Deficit"/);

  // Verify Summary row
  assert.match(csv, /"TOTALS & AVERAGES"/);
  assert.match(csv, /"93000","93.00","62000","62.00","12.5","-31.00","Overall Deficit"/);
});
