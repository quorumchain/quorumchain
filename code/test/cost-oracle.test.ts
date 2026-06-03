// CIP-6 §3f — the cost-oracle (the keystone economic defense). "Solvency is
// security": the protocol must always afford the ≥3-diverse-validator floor, in
// every market regime, with no human to recapitalize it. The Reserve-Drain
// Cascade (round-16 convergent finding) is broken at its source by anchoring
// reported inference cost to an EXTERNAL capability-tiered benchmark: a report
// above the benchmark is a challengeable wrong verdict, and reimbursement /
// the price peg are capped at the benchmark for the PoI-proven tier (3c).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  reimburse,
  challengeCostReport,
  oracleCost,
  spamFeeOk,
  reserveCoversFloor,
  costPerVerdictBounded,
  buybackAllowed,
  type CostReport,
  type Benchmark,
} from '../src/cost-oracle.ts';

const BENCH: Benchmark = { frontier: 100, mid: 30, small: 8 }; // external observable cost ceilings (GPU spot / API pricing)

function report(validatorId: string, tier: string, reportedCost: number, poiTier = tier): CostReport {
  return { validatorId, tier, reportedCost, poiTier };
}

test('3f: reimbursement is capped at the external benchmark for the proven tier', () => {
  // honest frontier report at benchmark — paid in full
  assert.equal(reimburse(report('V1', 'frontier', 100), BENCH), 100);
  // inflated frontier report above the benchmark — only the benchmark is paid
  assert.equal(reimburse(report('V2', 'frontier', 500), BENCH), 100);
});

test('3c: a tier-mismatch (claims frontier, PoI proves mid ran) is paid only the proven tier', () => {
  const r = report('V3', 'frontier', 100, 'mid'); // billed frontier, actually ran mid
  assert.equal(reimburse(r, BENCH), 30); // paid the mid benchmark, not the frontier claim
});

test('3f: a cost report exceeding its tier benchmark is a challengeable wrong verdict (slashable)', () => {
  const honest = challengeCostReport(report('V1', 'frontier', 95), BENCH);
  assert.equal(honest.wrong, false);
  const inflated = challengeCostReport(report('V2', 'frontier', 250), BENCH);
  assert.equal(inflated.wrong, true);
  assert.ok(inflated.overBy! > 0);
  // tier mismatch is also wrong (real inference, valid PoI, inflated price — 3c)
  const mismatch = challengeCostReport(report('V3', 'frontier', 100, 'mid'), BENCH);
  assert.equal(mismatch.wrong, true);
});

test('3f: the oracle is a benchmark-clamped median with a bounded per-epoch change rate', () => {
  const reports = [report('V1', 'frontier', 90), report('V2', 'frontier', 100), report('V3', 'frontier', 110)];
  const r = oracleCost(reports, BENCH, { prevPrice: 95, maxEpochDelta: 0.1 });
  // median of clamped [90,100,100] = 100, but rate-limited to prev*(1+0.1)=104.5
  assert.equal(r.price <= 104.5, true);
  assert.equal(r.price >= 95, true);
});

test('3f cascade broken at source: a 2/3 coalition reporting 10× inflated cost cannot exceed the benchmark', () => {
  // V2,V3 collude to inflate; V1 honest. Without the clamp the median would be huge.
  const reports = [report('V1', 'frontier', 100), report('V2', 'frontier', 1000), report('V3', 'frontier', 1000)];
  const r = oracleCost(reports, BENCH, { prevPrice: 100, maxEpochDelta: 1.0 }); // generous velocity bound
  assert.equal(r.price <= BENCH.frontier, true); // steady-state bound holds: clamped to 100
  assert.equal(r.challengeable.length, 2); // both inflated reports are flagged challengeable
});

test('3f spam-drain: a fee below true marginal cost is rejected (spam pays its own way)', () => {
  assert.equal(spamFeeOk(120, 100, 0.1), true); // 120 ≥ 100*1.1
  assert.equal(spamFeeOk(105, 100, 0.1), false); // 105 < 110
});

test('3a burn-rate floor: the reserve must cover ≥X epochs at the cost-per-verdict, and cost-per-verdict is bounded', () => {
  // floor: 3 frontier validators; benchmark cost-per-verdict ceiling = 300
  assert.equal(costPerVerdictBounded(300, ['frontier', 'frontier', 'frontier'], BENCH), true);
  assert.equal(costPerVerdictBounded(900, ['frontier', 'frontier', 'frontier'], BENCH), false); // inflated past the anchor
  // reserve solvency over the runway
  assert.equal(reserveCoversFloor(300 * 24, 300, 24), true); // exactly 24 epochs
  assert.equal(reserveCoversFloor(300 * 10, 300, 24), false);
});

test('3d: a buyback may never spend the reserve below the sacrosanct diversity floor', () => {
  assert.equal(buybackAllowed(1000, 200, 700), true); // 1000-200=800 ≥ 700 floor
  assert.equal(buybackAllowed(1000, 400, 700), false); // 1000-400=600 < 700 floor — rejected
});
