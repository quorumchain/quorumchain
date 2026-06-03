// Quorumchain ($QRM) — CIP-6 §3f cost-oracle (the keystone economic defense).
// "Solvency is security": the chain runs ≥3 distinct expensive models per verdict,
// a standing bill that must be afforded in every market regime with no human to
// recapitalize. The Reserve-Drain Cascade (3f inflation → 3a drain → cheaper 3b
// bribery → sustained inflation) is broken at its SOURCE by anchoring reported
// inference cost to an EXTERNAL, capability-tiered benchmark (GPU spot / API
// pricing, CIP-2 anchors): a report above the benchmark is a challengeable wrong
// verdict, and reimbursement + the price peg are capped at the benchmark for the
// PoI-PROVEN tier (not the claimed tier — 3c). Zero dependencies.

export type Benchmark = Record<string, number>; // tier -> external observable cost ceiling

export interface CostReport {
  validatorId: string;
  tier: string; // the capability tier the validator BILLS for
  reportedCost: number;
  poiTier: string; // the tier proof-of-inference actually proves ran (3c binding)
}

/** Reimbursement is capped at the external benchmark for the PROVEN tier. A claim
 *  above the benchmark is unpaid; a tier mismatch is paid only the proven tier —
 *  breaking the self-dealing loop at its root (3c/3f). */
export function reimburse(report: CostReport, benchmark: Benchmark): number {
  const ceiling = benchmark[report.poiTier] ?? 0;
  return Math.min(report.reportedCost, ceiling);
}

export interface ChallengeResult {
  wrong: boolean;
  reason?: string;
  overBy?: number;
}

/** Cost-measurement is itself a challengeable Verdict-Layer verdict (V3's key
 *  fix). A report above the external benchmark for its claimed tier, or a
 *  tier mismatch (billed tier ≠ PoI-proven tier), is a wrong verdict → slashable. */
export function challengeCostReport(report: CostReport, benchmark: Benchmark): ChallengeResult {
  if (report.tier !== report.poiTier) {
    return { wrong: true, reason: `tier mismatch: billed ${report.tier}, PoI proves ${report.poiTier}` };
  }
  const ceiling = benchmark[report.tier] ?? 0;
  if (report.reportedCost > ceiling) {
    return { wrong: true, reason: `report ${report.reportedCost} exceeds ${report.tier} benchmark ${ceiling}`, overBy: report.reportedCost - ceiling };
  }
  return { wrong: false };
}

export interface OracleParams {
  prevPrice: number;
  maxEpochDelta: number; // bounded per-epoch change rate (velocity bound)
}
export interface OracleResult {
  price: number;
  challengeable: CostReport[];
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The accepted inference-cost signal: a benchmark-clamped median (the steady-
 *  state bound — a 2/3 coalition cannot inflate past the external anchor) with a
 *  bounded per-epoch change rate (the velocity bound). Reports exceeding the
 *  benchmark are flagged challengeable. */
export function oracleCost(reports: CostReport[], benchmark: Benchmark, params: OracleParams): OracleResult {
  const clamped = reports.map((r) => Math.min(r.reportedCost, benchmark[r.poiTier] ?? 0));
  const med = median(clamped);
  const hi = params.prevPrice * (1 + params.maxEpochDelta);
  const lo = params.prevPrice * (1 - params.maxEpochDelta);
  const price = Math.min(hi, Math.max(lo, med));
  const challengeable = reports.filter((r) => challengeCostReport(r, benchmark).wrong);
  return { price, challengeable };
}

/** 3f spam-drain: a fee must be ≥ true marginal cost + margin, so spam pays its
 *  own way and cannot drain the reserve through below-cost subsidy. */
export function spamFeeOk(fee: number, cost: number, margin: number): boolean {
  return fee >= cost * (1 + margin);
}

/** 3a (round-16 amendment): the sacrosanct floor must bound the reserve BURN-RATE
 *  / cost-per-verdict, not only validator count — a captured oracle inflates
 *  cost-per-validator without reducing the count, draining through the floor's
 *  blind spot. The cost-per-verdict ceiling is the sum of the floor tiers' anchors. */
export function costPerVerdictBounded(costPerVerdict: number, floorTiers: string[], benchmark: Benchmark): boolean {
  const ceiling = floorTiers.reduce((sum, t) => sum + (benchmark[t] ?? 0), 0);
  return costPerVerdict <= ceiling;
}

/** 3a solvency: the reserve must at all times cover ≥X epochs of the diversity
 *  floor at the current cost-per-verdict. */
export function reserveCoversFloor(reserve: number, costPerVerdict: number, epochs: number): boolean {
  return reserve >= costPerVerdict * epochs;
}

/** 3d: a buyback may never spend the reserve below the funded diversity floor —
 *  the security budget outranks buyback (a CIP-5 §3 T0-style client check). */
export function buybackAllowed(reserve: number, amount: number, floorReserve: number): boolean {
  return reserve - amount >= floorReserve;
}
