// CIP-10 v0.1 — node admission + jury selection prototype (judgment tier).
// Two mechanics, both self-contained and verifiable without live inference:
//   - Proof-of-Diversity admission (§3, G1): monoculture is un-enterable.
//   - Verifiable scarcity-weighted per-slot selection (§4, G2 + NI-10a thin-slot).
// Deferred to production (documented, not faked): NI-10c threshold/forced-include
// randomness beacon, SEL-2 proof-of-inference model binding, CIP-7 correlation-
// eviction. v0.1 demonstrates the deterministic, after-the-fact-verifiable draw.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  admitNode,
  missingSlots,
  drawJury,
  verifyDraw,
  tallyJury,
  type NodeRegistry,
  type NodeOperator,
} from '../src/nodes.ts';

const TAXONOMY = ['model-A', 'model-B', 'model-C']; // frozen, panel-governed (PoD-2)

function op(id: string, model: string, assurance: 'STANDARD' | 'LOW_ASSURANCE' = 'STANDARD'): NodeOperator {
  return { id, model, assurance };
}

function reg(operators: NodeOperator[]): NodeRegistry {
  return { taxonomy: TAXONOMY, operators };
}

test('PoD: a node filling a currently-missing slot is admitted', () => {
  const r = reg([op('n1', 'model-A')]);
  const d = admitNode(r, op('n2', 'model-B'));
  assert.equal(d.admitted, true);
  assert.equal(d.registry.operators.length, 2);
});

test('G1: a duplicate-model node is rejected while another slot is still missing', () => {
  const r = reg([op('n1', 'model-A'), op('n2', 'model-B')]); // model-C still missing
  const d = admitNode(r, op('n3', 'model-A')); // piling onto A while C is empty
  assert.equal(d.admitted, false);
  assert.match(d.reason!, /missing slot/i);
  assert.equal(d.registry.operators.length, 2); // unchanged
});

test('G1: redundancy is allowed once every slot is covered (scarcity then governs)', () => {
  const r = reg([op('n1', 'model-A'), op('n2', 'model-B'), op('n3', 'model-C')]);
  const d = admitNode(r, op('n4', 'model-A'));
  assert.equal(d.admitted, true);
  assert.equal(d.registry.operators.filter((o) => o.model === 'model-A').length, 2);
});

test('PoD-2: an operator cannot invent a slot outside the frozen taxonomy', () => {
  const r = reg([op('n1', 'model-A')]);
  const d = admitNode(r, op('rogue', 'model-Z'));
  assert.equal(d.admitted, false);
  assert.match(d.reason!, /taxonomy/i);
});

test('missingSlots reports the empty slots', () => {
  assert.deepEqual(missingSlots(reg([op('n1', 'model-A')])).sort(), ['model-B', 'model-C']);
  assert.deepEqual(missingSlots(reg([op('a', 'model-A'), op('b', 'model-B'), op('c', 'model-C')])), []);
});

test('G2: the jury is one node per covered slot and is deterministic for a seed', () => {
  const r = reg([op('a1', 'model-A'), op('a2', 'model-A'), op('b1', 'model-B'), op('c1', 'model-C')]);
  const j1 = drawJury(r, 'beacon-seed-0001');
  const j2 = drawJury(r, 'beacon-seed-0001');
  assert.equal(j1.seats.length, 3); // one per slot
  assert.deepEqual(new Set(j1.seats.map((s) => s.slot)), new Set(TAXONOMY));
  assert.deepEqual(j1, j2); // same seed => same jury
  // each seat's drawn node actually belongs to that slot
  for (const s of j1.seats) assert.equal(r.operators.find((o) => o.id === s.nodeId)!.model, s.slot);
});

test('G2: a draw is independently verifiable; a forged claim fails', () => {
  const r = reg([op('a1', 'model-A'), op('a2', 'model-A'), op('a3', 'model-A'), op('b1', 'model-B'), op('c1', 'model-C')]);
  const j = drawJury(r, 'beacon-seed-0002');
  const seatA = j.seats.find((s) => s.slot === 'model-A')!;
  const slotAops = r.operators.filter((o) => o.model === 'model-A');
  assert.equal(verifyDraw('beacon-seed-0002', 'model-A', slotAops, seatA.nodeId), true);
  // claim a different node for the same seed/slot => rejected
  const other = slotAops.find((o) => o.id !== seatA.nodeId)!;
  assert.equal(verifyDraw('beacon-seed-0002', 'model-A', slotAops, other.id), false);
});

test('G4 scarcity: the lone operator of a thin slot is drawn far more often than each of a crowded slot', () => {
  const r = reg([
    op('a1', 'model-A'), op('a2', 'model-A'), op('a3', 'model-A'), op('a4', 'model-A'), op('a5', 'model-A'),
    op('b1', 'model-B'),
    op('c1', 'model-C'),
  ]);
  const draws: Record<string, number> = {};
  const M = 300;
  for (let i = 0; i < M; i++) {
    for (const s of drawJury(r, `seed-${i}`).seats) draws[s.nodeId] = (draws[s.nodeId] ?? 0) + 1;
  }
  assert.equal(draws['b1'], M); // sole operator of model-B is drawn every ballot
  const aMax = Math.max(...['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => draws[id] ?? 0));
  assert.ok(draws['b1'] > aMax * 2); // scarce-slot operator earns far more draws -> entry incentive
});

test('NI-10a: a single-operator slot is flagged thin, down-weighted, and never decisive', () => {
  const r = reg([
    op('a1', 'model-A'), op('a2', 'model-A'),
    op('b1', 'model-B'), op('b2', 'model-B'),
    op('c1', 'model-C'), // lone -> thin
  ]);
  const j = drawJury(r, 'seed-thin');
  const seatC = j.seats.find((s) => s.slot === 'model-C')!;
  assert.equal(seatC.thin, true);
  assert.ok(seatC.weight < 1);
  const seatA = j.seats.find((s) => s.slot === 'model-A')!;
  assert.equal(seatA.thin, false);
  assert.equal(seatA.weight, 1);
  // the thin slot alone cannot overturn two full-weight slots that agree
  const winner = tallyJury(j, { [seatA.slot]: 'NO', [j.seats.find((s) => s.slot === 'model-B')!.slot]: 'NO', [seatC.slot]: 'YES' });
  assert.equal(winner.verdict, 'NO');
  assert.equal(winner.decisiveSlots.includes('model-C'), false);
});

test('NI-10b: a LOW_ASSURANCE operator is carried with its flag', () => {
  const r = reg([op('a1', 'model-A'), op('b1', 'model-B'), op('c1', 'model-C', 'LOW_ASSURANCE')]);
  const j = drawJury(r, 'seed-la');
  const seatC = j.seats.find((s) => s.slot === 'model-C')!;
  assert.equal(seatC.assurance, 'LOW_ASSURANCE');
});
