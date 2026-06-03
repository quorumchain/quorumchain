// CIP-5 §9 — the β-gate fork-drill (the CIP-4 §8 renunciation prerequisite).
// Two mechanisms, both pure local functions (coordination without a coordinator):
//   §3 Mechanism A — client-enforced T0 validity: a block applying a T0-violating
//      change is INVALID, rejected like any malformed block.
//   §4 Mechanism B — canonical = the T0-preserving fork; weight is a tie-break
//      INSIDE the valid set, never a gate (no laundering a violation by weight).
// The drill (§9) injects T0 violations — including boundary-ambiguous, salami-
// sliced, and correlated-fault classes — and asserts honest clients auto-reject
// across ≥N independent implementations. A client monoculture is itself a
// β-gate failure (§7): a shared bug means the violation is never caught and no
// split is even visible — worse than the round-8 fork-void.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkT0,
  selectCanonicalFork,
  runForkDrill,
  type Block,
  type T0Params,
} from '../src/fork.ts';

const PARAMS: T0Params = { diversityFloor: 3, t0Properties: ['determinism', 'diversity', 'append-only', 'tier-assignment'] };

function cleanBlock(over: Partial<Block> = {}): Block {
  return {
    height: 10,
    prevHash: 'abc',
    recordOp: 'append',
    deterministic: true,
    attestation: { validators: [
      { id: 'V1', fingerprint: 'anthropic' },
      { id: 'V2', fingerprint: 'openai' },
      { id: 'V3', fingerprint: 'nous' },
    ] },
    ...over,
  };
}

test('a clean block passes all four T0 validity checks', () => {
  const r = checkT0(cleanBlock(), PARAMS);
  assert.equal(r.valid, true);
  assert.deepEqual(r.violations, []);
});

test('determinism boundary: a non-reproducible block is invalid (§4.1)', () => {
  const r = checkT0(cleanBlock({ deterministic: false }), PARAMS);
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes('determinism-boundary'));
});

test('diversity & independence: a collapsed-diversity panel is invalid (§4.2)', () => {
  const collapsed = cleanBlock({ attestation: { validators: [
    { id: 'V1', fingerprint: 'anthropic' },
    { id: 'V2', fingerprint: 'anthropic' }, // same provider fingerprint
    { id: 'V3', fingerprint: 'anthropic' },
  ] } });
  const r = checkT0(collapsed, PARAMS);
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes('diversity-independence'));
});

test('boundary-ambiguous: exactly at the diversity floor is valid; just below is invalid (clients agree)', () => {
  const atFloor = cleanBlock(); // 3 distinct fingerprints == floor
  const belowFloor = cleanBlock({ attestation: { validators: [
    { id: 'V1', fingerprint: 'anthropic' }, { id: 'V2', fingerprint: 'openai' },
  ] } });
  assert.equal(checkT0(atFloor, PARAMS).valid, true);
  assert.equal(checkT0(belowFloor, PARAMS).valid, false); // deterministic finding -> no client disagreement
});

test('append-only history: a rewrite/delete/reorder block is invalid (§4.3)', () => {
  for (const op of ['rewrite', 'delete', 'reorder'] as const) {
    const r = checkT0(cleanBlock({ recordOp: op }), PARAMS);
    assert.equal(r.valid, false, `${op} should be invalid`);
    assert.ok(r.violations.includes('append-only-history'));
  }
});

test('tier-assignment integrity: demoting a T0 property to a lower tier is invalid (§4.5)', () => {
  const launder = cleanBlock({ change: { id: 'c1', tier: 'T1', reclassifies: { property: 'diversity', fromTier: 'T0', toTier: 'T1' } } });
  const r = checkT0(launder, PARAMS);
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes('tier-assignment-integrity'));
});

test('§3 salami-slice: a non-T0 change to a T0-check DEFINITION is invalid', () => {
  // each step looks like an innocuous T1 "clarification" of what the client checks
  const slice = cleanBlock({ change: { id: 'redefine-fingerprint', tier: 'T1', target: 'T0_CHECK_DEFINITION' } });
  const r = checkT0(slice, PARAMS);
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes('t0-check-definition-locked'));
});

test('Mechanism B: canonical is the T0-preserving fork; weight never launders a violation', () => {
  const honest = { id: 'honest', weight: 100, blocks: [cleanBlock()] };
  const heavierCaptured = { id: 'captured', weight: 1000, blocks: [cleanBlock({ recordOp: 'rewrite' })] };
  const r = selectCanonicalFork([honest, heavierCaptured], PARAMS);
  assert.equal(r.canonicalId, 'honest'); // lighter but valid beats heavier-but-T0-violating
  assert.deepEqual(r.validForks.sort(), ['honest']);
});

test('Mechanism B: heaviest applies only INSIDE the valid set', () => {
  const a = { id: 'a', weight: 100, blocks: [cleanBlock()] };
  const b = { id: 'b', weight: 250, blocks: [cleanBlock()] };
  assert.equal(selectCanonicalFork([a, b], PARAMS).canonicalId, 'b');
  // if every fork violates T0, there is no canonical chain
  const allBad = selectCanonicalFork([
    { id: 'x', weight: 100, blocks: [cleanBlock({ deterministic: false })] },
    { id: 'y', weight: 999, blocks: [cleanBlock({ recordOp: 'delete' })] },
  ], PARAMS);
  assert.equal(allBad.canonicalId, null);
});

test('§9 drill: ≥N independent clients 100% auto-reject the injection → green', () => {
  // three independent, correct client implementations
  const clients = [
    { name: 'client-rs', check: checkT0 },
    { name: 'client-go', check: checkT0 },
    { name: 'client-ts', check: checkT0 },
  ];
  const injection = cleanBlock({ change: { id: 'cap', tier: 'T1', reclassifies: { property: 'diversity', fromTier: 'T0', toTier: 'T2' } } });
  const r = runForkDrill(clients, injection, PARAMS);
  assert.equal(r.allReject, true);
  assert.equal(r.green, true);
});

test('§7 correlated-fault: a client monoculture sharing a bug fails to reject → β-gate FAILURE', () => {
  // a buggy check that skips the tier-assignment integrity test
  const buggyCheck = (block: Block, p: T0Params) => {
    const r = checkT0(block, p);
    return { valid: r.violations.filter((v) => v !== 'tier-assignment-integrity').length === 0, violations: r.violations.filter((v) => v !== 'tier-assignment-integrity') };
  };
  const monoculture = [
    { name: 'client-a', check: buggyCheck },
    { name: 'client-b', check: buggyCheck },
    { name: 'client-c', check: buggyCheck },
  ];
  const injection = cleanBlock({ change: { id: 'cap', tier: 'T1', reclassifies: { property: 'diversity', fromTier: 'T0', toTier: 'T2' } } });
  const r = runForkDrill(monoculture, injection, PARAMS);
  assert.equal(r.allReject, false); // the violation slips through every client
  assert.equal(r.green, false); // drill is RED — renunciation may not proceed (§9)
  assert.ok(r.note.toLowerCase().includes('monoculture') || r.note.toLowerCase().includes('no split'));
});
