// CIP-10 v0.1 — node admission + jury selection, demonstrable artifact.
//   §3 Proof-of-Diversity admission (G1): monoculture is un-enterable.
//   §4 scarcity-weighted verifiable selection (G2/G4) on the dev's own scenario
//      (many model-A/B nodes, a scarce model-C) — the scarce slot's operators are
//      drawn more often, so scarcity pays more and pulls entry toward balance.
//   NI-10a: a thin (single-operator) slot is down-weighted and never decisive.
// Run:  node src/nodes-demo.ts
import { admitNode, drawJury, verifyDraw, tallyJury, missingSlots, type NodeRegistry, type NodeOperator } from './nodes.ts';

const TAXONOMY = ['model-A', 'model-B', 'model-C'];
const op = (id: string, model: string): NodeOperator => ({ id, model, assurance: 'STANDARD' });

console.log('=== G1 — Proof-of-Diversity admission (monoculture is un-enterable) ===');
let reg: NodeRegistry = { taxonomy: TAXONOMY, operators: [op('a1', 'model-A')] };
console.log('  start: 1 model-A node | missing slots:', missingSlots(reg).join(', '));
for (const cand of [op('a2', 'model-A'), op('b1', 'model-B'), op('c1', 'model-C'), op('z1', 'model-Z')]) {
  const d = admitNode(reg, cand);
  reg = d.registry;
  console.log(`  + ${cand.id} (${cand.model}): ${d.admitted ? 'ADMITTED' : 'REJECTED — ' + d.reason}`);
}
console.log('  → you cannot pile a second model-A while B/C are empty; rogue model-Z is outside the frozen taxonomy.');

console.log('\n=== G4 — scarcity-weighted selection (dev scenario: 10×A, 10×B, 4×C) ===');
const operators: NodeOperator[] = [];
for (let i = 1; i <= 10; i++) operators.push(op(`a${i}`, 'model-A'));
for (let i = 1; i <= 10; i++) operators.push(op(`b${i}`, 'model-B'));
for (let i = 1; i <= 4; i++) operators.push(op(`c${i}`, 'model-C'));
const scen: NodeRegistry = { taxonomy: TAXONOMY, operators };

const M = 4000;
const draws: Record<string, number> = {};
for (let i = 0; i < M; i++) for (const s of drawJury(scen, `beacon-${i}`).seats) draws[s.nodeId] = (draws[s.nodeId] ?? 0) + 1;
const avg = (prefix: string, n: number) => {
  let sum = 0;
  for (let i = 1; i <= n; i++) sum += draws[`${prefix}${i}`] ?? 0;
  return Math.round(sum / n);
};
console.log(`  over ${M} ballots, avg draws per operator:`);
console.log(`    model-A (10 nodes): ${avg('a', 10)}   model-B (10 nodes): ${avg('b', 10)}   model-C (4 nodes): ${avg('c', 4)}`);
console.log(`  → a model-C operator is drawn ~${(avg('c', 4) / avg('a', 10)).toFixed(1)}x as often as a model-A operator`);
console.log('    (one seat per slot per ballot ÷ fewer operators = higher per-operator draw rate = higher reward → entry rebalances).');

console.log('\n=== G2 — the draw is independently verifiable ===');
const j = drawJury(scen, 'beacon-7');
const seatC = j.seats.find((s) => s.slot === 'model-C')!;
const cOps = scen.operators.filter((o) => o.model === 'model-C');
console.log(`  seed beacon-7 drew ${seatC.nodeId} for model-C — verifies:`, verifyDraw('beacon-7', 'model-C', cOps, seatC.nodeId));
console.log(`  a forged claim (different node, same seed) verifies:`, verifyDraw('beacon-7', 'model-C', cOps, cOps.find((o) => o.id !== seatC.nodeId)!.id));

console.log('\n=== NI-10a — a thin (single-operator) slot is never decisive ===');
const thinReg: NodeRegistry = { taxonomy: TAXONOMY, operators: [op('a1', 'model-A'), op('a2', 'model-A'), op('b1', 'model-B'), op('b2', 'model-B'), op('c1', 'model-C')] };
const tj = drawJury(thinReg, 'seed-thin');
const sc = tj.seats.find((s) => s.slot === 'model-C')!;
console.log(`  model-C seat: thin=${sc.thin} weight=${sc.weight} (vs standard weight 1)`);
const t = tallyJury(tj, { 'model-A': 'NO', 'model-B': 'NO', 'model-C': 'YES' });
console.log(`  votes A=NO B=NO C=YES → verdict ${t.verdict}; decisive slots: [${t.decisiveSlots.join(', ')}]`);
console.log('  → the lone-operator slot cannot overturn two full-weight slots; its predictable draw carries reduced weight.');
