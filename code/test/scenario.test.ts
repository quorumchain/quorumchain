// End-to-end integration: one accountability story threaded through the whole
// stack. A bonded agent acts → the action is notarized → a CIP-10-drawn,
// CIP-7-governed jury resolves it on frozen criteria (CIP-3) → the bond settles
// (CIP-8 v0.2) → inference cost is reimbursed under the CIP-6 clamp → the verdict
// is indexed into the Commons with dissent preserved (CIP-9 v0.1) → source
// reputation moves on the external anchor (CIP-9 v0.2) → the frozen ballot
// replays (CIP-5/CIP-8) → a provider sunset rotates a juror without breaching the
// floor (CIP-7). This test asserts the cross-module invariants hold as one flow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runScenario } from '../src/scenario.ts';

test('clean path: no violation → bond released, dissent preserved, correct jurors gain reputation', () => {
  const r = runScenario({ orderAmount: 42_300, hasApproval: true, seed: 'ballot-seed-01' });

  // CIP-10 — a diverse jury was admitted (PoD) and drawn (one seat per slot)
  assert.equal(r.jury.seats.length, 4);
  // CIP-8 v0.2 — the agent was bonded and authorized for the high-value context
  assert.equal(r.bondAuthorized, true);
  // CIP-8 v0.1 — the action is notarized, NOT_VERIFIED, and admissible
  assert.equal(r.attestation.status, 'NOT_VERIFIED');
  assert.equal(r.attestationCheck.accepted, true);
  // CIP-3 — the jury ratified the correct verdict on the frozen ballot
  assert.equal(r.resolution.ratified, true);
  assert.equal(r.resolution.verdict, 'NO_VIOLATION');
  // CIP-8 v0.2 — settlement releases the bond (no violation)
  assert.equal(r.settledBond.status, 'RELEASED');
  assert.equal(r.settledBond.slashed, 0);
  // CIP-6 — an over-reported inference cost is clamped to the external benchmark
  assert.ok(r.reimbursedTotal <= r.benchmarkTotal);
  // CIP-9 v0.1 — indexed as a claim that PRESERVES the dissenting juror
  assert.equal(r.claim.status, 'RESOLVED');
  assert.equal(r.claim.verdict, 'NO_VIOLATION');
  assert.ok(r.claim.stances.some((s) => s.standing === 'CREDIBLE_MINORITY'));
  // CIP-5 / CIP-8 — the frozen ballot replays, and a post-hoc edit changes the hash
  assert.equal(r.replay.replayOk, true);
  assert.equal(r.tamperDiffers, true);
  // CIP-9 v0.2 — reputation moved on the EXTERNAL anchor: correct jurors up, wrong dissenter down
  assert.ok(r.reputation[r.correctJurors[0]] > 0);
  assert.ok(r.reputation[r.dissenter] < 0);
  // CIP-7 — the dissenter's provider sunset rotated it out without breaching the floor
  assert.equal(r.rotation.floorOk, true);
  assert.equal(r.rotation.frozen, false);
  assert.ok(!r.rotation.standingIds.includes(r.dissenter));
});

test('violation path: order over the cap with no sign-off → bond slashed', () => {
  const r = runScenario({ orderAmount: 80_000, hasApproval: false, seed: 'ballot-seed-02' });
  assert.equal(r.resolution.verdict, 'VIOLATION');
  assert.equal(r.settledBond.status, 'SLASHED');
  assert.equal(r.settledBond.slashed, r.bondStake);
});

test('the resolution ballot is bound to frozen criteria (post-hoc context is a different ballot)', () => {
  const r = runScenario({ orderAmount: 42_300, hasApproval: true, seed: 's' });
  assert.equal(r.replay.hashMatches, true);
  assert.equal(r.tamperDiffers, true);
});
