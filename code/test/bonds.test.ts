// CIP-8 v0.2 — bonds & stake (the "teeth" graduation, §6 v0.2). BOND mode of the
// Staked Resolvable Attestation: a subject posts a signed, staked commitment to a
// constraint BEFORE acting; unbonded / under-bonded agents are excluded from
// high-value contexts (the flywheel). A bond is slashed on a RESOLUTION proving
// the constraint was violated. NI-8b: an evidence commitment has teeth or no
// weight — on challenge, disclose within the window or forfeit, and an unrevealed
// commitment carries zero evidentiary weight (no privileged decryptor).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateValidatorKey } from '../src/signed-vote.ts';
import {
  createBond,
  verifyBond,
  registerBond,
  isAuthorized,
  settleBond,
  challengeCommitment,
  type BondRegistry,
} from '../src/bonds.ts';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const subject = generateValidatorKey();

function bond(stake: number) {
  return createBond({
    subjectPublicKeyPem: subject.publicKeyPem,
    subjectPrivateKeyPem: subject.privateKeyPem,
    constraint: 'procurement agent will not exceed a $50k order without human sign-off',
    criteria: 'violated iff an order > $50,000 settles with no linked approval token',
    stake,
    timestamp: '2026-06-04T12:00:00Z',
  });
}

test('a bond is signed and verifies against its subject key', () => {
  const b = bond(1000);
  assert.equal(verifyBond(b), true);
  assert.equal(b.status, 'ACTIVE');
  // tamper the staked amount after signing -> verification fails
  assert.equal(verifyBond({ ...b, stake: 1 }), false);
});

test('gating: an unbonded or under-bonded subject is excluded from a high-value context', () => {
  let reg: BondRegistry = { bonds: [] };
  // no bond yet -> not authorized
  assert.equal(isAuthorized(reg, subject.publicKeyPem, 1000), false);
  reg = registerBond(reg, bond(500));
  // bonded, but below the context's required stake
  assert.equal(isAuthorized(reg, subject.publicKeyPem, 1000), false);
  reg = registerBond(reg, bond(1000));
  assert.equal(isAuthorized(reg, subject.publicKeyPem, 1000), true);
});

test('settlement: a bond is slashed when a RESOLUTION proves the constraint was violated', () => {
  const b = bond(1000);
  const slashed = settleBond(b, { violated: true });
  assert.equal(slashed.status, 'SLASHED');
  assert.equal(slashed.slashed, 1000);
  const released = settleBond(b, { violated: false });
  assert.equal(released.status, 'RELEASED');
  assert.equal(released.slashed, 0);
});

test('NI-8b: a disclosed evidence commitment matching its hash within the window carries weight', () => {
  const evidence = 'tool-call-log: order #4471 $42,300 + approval token 0x9af';
  const commitment = h(evidence);
  const r = challengeCommitment(commitment, { disclosure: evidence, withinWindow: true });
  assert.equal(r.disclosed, true);
  assert.equal(r.weight, 1);
  assert.equal(r.forfeit, false);
});

test('NI-8b: an undisclosed commitment carries ZERO weight and forfeits (no privileged decryptor)', () => {
  const commitment = h('sealed evidence');
  const r = challengeCommitment(commitment, { disclosure: null, withinWindow: true });
  assert.equal(r.disclosed, false);
  assert.equal(r.weight, 0);
  assert.equal(r.forfeit, true);
});

test('NI-8b: a disclosure that does not match the commitment hash is rejected (zero weight, forfeit)', () => {
  const commitment = h('the real evidence');
  const r = challengeCommitment(commitment, { disclosure: 'a different document', withinWindow: true });
  assert.equal(r.disclosed, false);
  assert.equal(r.weight, 0);
  assert.equal(r.forfeit, true);
});

test('NI-8b: disclosing only after the window has closed forfeits (teeth, not theatre)', () => {
  const evidence = 'late evidence';
  const commitment = h(evidence);
  const r = challengeCommitment(commitment, { disclosure: evidence, withinWindow: false });
  assert.equal(r.weight, 0);
  assert.equal(r.forfeit, true);
});
