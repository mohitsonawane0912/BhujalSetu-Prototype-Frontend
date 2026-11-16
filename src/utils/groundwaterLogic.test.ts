import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWaterBalance,
  evaluateGroundwaterStatus,
  calculateRechargeVolume,
  generateRuleBasedAdvisories,
} from './groundwaterLogic';

test('calculateWaterBalance accurately sums inputs, outputs, and net balance', () => {
  const inputs = {
    rainfallInfiltrationLiters: 12000,
    managedRechargeLiters: 18000,
    subsurfaceInflowLiters: 4000,
  };
  const outputs = {
    borewellExtractionLiters: 25000,
    communityUsageLiters: 15000,
    otherAgriculturalExtractionLiters: 8000,
  };

  const balance = calculateWaterBalance(inputs, outputs, 'daily', '2026-10-24');

  assert.equal(balance.inputs?.totalInputsLiters, 34000);
  assert.equal(balance.outputs?.totalOutputsLiters, 48000);
  assert.equal(balance.netBalanceLiters, -14000); // Deficit of 14,000 L
  assert.equal(balance.netBalanceM3, -14.0);
});

test('calculateRechargeVolume matches prompt illustrative calculation: 1000m² × 40mm × 0.85 ≈ 34,000L', () => {
  const result = calculateRechargeVolume(1000, 40, 0.85);
  assert.equal(result.liters, 34000);
  assert.equal(result.cubicMeters, 34.0);
  assert.match(result.explanation, /34,000 L/);
});

test('evaluateGroundwaterStatus categorizes Stable, Watch, and Critical correctly', () => {
  // Stable: depth 14m, decline 0.1m
  const stable = evaluateGroundwaterStatus(14.0, 13.9, -0.1);
  assert.equal(stable.severity, 'NORMAL');
  assert.equal(stable.label, 'Stable');

  // Watch: depth 18.4m, decline 0.6m (matches prompt example!)
  const watch = evaluateGroundwaterStatus(18.4, 17.8, -0.6);
  assert.equal(watch.severity, 'WATCH');
  assert.equal(watch.label, 'Watch');

  // Critical: depth 26m or rapid decline >= 1.2m
  const critical = evaluateGroundwaterStatus(26.2, 24.5, -1.7);
  assert.equal(critical.severity, 'CRITICAL');
  assert.equal(critical.label, 'Critical');
});

test('generateRuleBasedAdvisories produces targeted recommendations when extraction exceeds recharge', () => {
  const recs = generateRuleBasedAdvisories(18.4, -0.6, 20000, 45000, 25);
  assert.ok(recs.length >= 3);
  const extractionRec = recs.find(r => r.category === 'EXTRACTION');
  assert.ok(extractionRec);
  assert.equal(extractionRec?.priority, 'HIGH');
  assert.ok(extractionRec?.whyAppeared.includes('Community extraction'));
});
