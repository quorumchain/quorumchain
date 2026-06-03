// CIP-6 §3f cost-oracle — demonstrable artifact. Shows the Reserve-Drain Cascade
// (3f inflation → 3a drain → cheaper 3b bribery → sustained inflation) and that
// the external-benchmark clamp breaks it at the source. Run: node src/cost-oracle-demo.ts
import { oracleCost, reimburse, challengeCostReport, buybackAllowed, reserveCoversFloor, type CostReport, type Benchmark } from './cost-oracle.ts';

const BENCH: Benchmark = { frontier: 100, mid: 30, small: 8 };
const rep = (id: string, tier: string, cost: number, poiTier = tier): CostReport => ({ validatorId: id, tier, reportedCost: cost, poiTier });

console.log('=== 3c/3f — reimbursement capped at the proven-tier benchmark ===');
console.log(`  honest frontier @100        → paid ${reimburse(rep('V1', 'frontier', 100), BENCH)}`);
console.log(`  inflated frontier @500      → paid ${reimburse(rep('V2', 'frontier', 500), BENCH)} (clamped to benchmark 100)`);
console.log(`  claims frontier, ran mid    → paid ${reimburse(rep('V3', 'frontier', 100, 'mid'), BENCH)} (proven tier mid=30); challengeable: ${challengeCostReport(rep('V3', 'frontier', 100, 'mid'), BENCH).wrong}`);

console.log('\n=== 3f — the Reserve-Drain Cascade, with and without the clamp ===');
const EPOCHS = 12, FLOOR_RESERVE = 300 * 6; // 6-epoch runway at honest cost-per-verdict 300
// a 2/3 coalition (V2,V3) reports 10× inflated cost every epoch; V1 honest
const coalitionReports = [rep('V1', 'frontier', 100), rep('V2', 'frontier', 1000), rep('V3', 'frontier', 1000)];

function runOracle(epochs: number, useClamp: boolean): number {
  let reserve = 300 * 24, prev = 100; // genesis reserve: 24-epoch runway at honest cost-per-verdict (CIP-6 3a constraint)
  for (let i = 0; i < epochs; i++) {
    const price = useClamp
      ? oracleCost(coalitionReports, BENCH, { prevPrice: prev, maxEpochDelta: 0.5 }).price
      : Math.min(prev * 1.5, ([100, 1000, 1000].sort((a, b) => a - b)[1])); // unclamped median, rate-limited only
    const costPerVerdict = price * 3; // 3-validator floor
    reserve -= costPerVerdict;
    prev = price;
  }
  return Math.round(reserve);
}
const drained = runOracle(EPOCHS, false);
const held = runOracle(EPOCHS, true);
console.log(`  WITHOUT benchmark clamp: reserve after ${EPOCHS} epochs = ${drained} | covers floor? ${reserveCoversFloor(drained, 300, 6)}`);
console.log(`  WITH benchmark clamp:    reserve after ${EPOCHS} epochs = ${held} | covers floor? ${reserveCoversFloor(held, 300, 6)}`);
console.log('  → the clamp bounds cost-per-verdict at the external anchor, so inflation cannot drain the reserve through the floor (3a burn-rate guard).');

console.log('\n=== 3d — buyback may never spend the reserve below the diversity floor ===');
console.log(`  reserve 1000, buyback 200, floor 700 → ${buybackAllowed(1000, 200, 700) ? 'ALLOWED' : 'REJECTED'}`);
console.log(`  reserve 1000, buyback 400, floor 700 → ${buybackAllowed(1000, 400, 700) ? 'ALLOWED' : 'REJECTED'} (security budget outranks buyback)`);
