// CIP-9 v0.1 — the resolution-index (read pillar).
// A read-only claim graph projected from the signed CIP-3/CIP-8 verdict log:
// every resolved ballot becomes a Claim whose stance set PRESERVES the dissent
// (G1 pluralism), carries a panel-state receipt (NI-9a), and never fabricates a
// confidence on a non-resolution (G5 honest unknown). v0.1 deliberately computes
// NO source reputation — that is NI-9b/v0.2 — so these tests also pin its absence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { buildClaimIndex, queryClaim } from '../src/commons.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function vote(id: 'V1' | 'V2' | 'V3', bh: string, verdict: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id} reasons: ${verdict}` });
}

const BH_UNANIMOUS = ballotHash('Q-unanimous', 'criteria');
const BH_SPLIT = ballotHash('Q-split', 'criteria'); // 2/1 — dissent must survive
const BH_INDET = ballotHash('Q-indeterminate', 'criteria');
const BH_NOQUORUM = ballotHash('Q-noquorum', 'criteria'); // 1/1/1 — no consensus

function fullPanel(): SignedVote[] {
  return [
    vote('V1', BH_UNANIMOUS, 'YES'), vote('V2', BH_UNANIMOUS, 'YES'), vote('V3', BH_UNANIMOUS, 'YES'),
    vote('V1', BH_SPLIT, 'NO'), vote('V2', BH_SPLIT, 'YES'), vote('V3', BH_SPLIT, 'NO'),
    vote('V1', BH_INDET, 'INDETERMINATE'), vote('V2', BH_INDET, 'INDETERMINATE'), vote('V3', BH_INDET, 'NO'),
    vote('V1', BH_NOQUORUM, 'A'), vote('V2', BH_NOQUORUM, 'B'), vote('V3', BH_NOQUORUM, 'C'),
  ];
}

test('a unanimous ballot becomes a RESOLVED claim with one CONSENSUS stance', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'YES');
  assert.equal(c.stances.length, 1);
  assert.equal(c.stances[0].standing, 'CONSENSUS');
  assert.deepEqual(c.stances[0].validators.sort(), ['V1', 'V2', 'V3']);
});

test('G1 pluralism: a 2/1 split preserves the dissenting stance as CREDIBLE_MINORITY', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_SPLIT)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'NO');
  assert.equal(c.stances.length, 2); // both positions retained
  const consensus = c.stances.find((s) => s.position === 'NO')!;
  const minority = c.stances.find((s) => s.position === 'YES')!;
  assert.equal(consensus.standing, 'CONSENSUS');
  assert.deepEqual(consensus.validators.sort(), ['V1', 'V3']);
  assert.equal(minority.standing, 'CREDIBLE_MINORITY');
  assert.deepEqual(minority.validators, ['V2']); // the dissent is named, not flattened
});

test('G5 honest unknown: an INDETERMINATE resolution is UNRANKED, not ranked CONSENSUS (NI-9c)', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_INDET)!;
  assert.equal(c.status, 'INDETERMINATE');
  assert.equal(c.verdict, 'INDETERMINATE');
  // the dissenting NO stance is still preserved...
  assert.ok(c.stances.some((s) => s.position === 'NO'));
  // ...but on the unverifiable class NOTHING is ranked CONSENSUS (consistent with reputation.ts / NI-9c)
  assert.ok(c.stances.every((s) => s.standing === 'UNRANKED'));
});

test('no quorum becomes a CONTESTED claim with no CONSENSUS stance', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_NOQUORUM)!;
  assert.equal(c.status, 'CONTESTED');
  assert.equal(c.verdict, null);
  assert.equal(c.stances.length, 3);
  assert.ok(c.stances.every((s) => s.standing !== 'CONSENSUS')); // nothing earned consensus
});

test('NI-9a: every claim carries a panel-state receipt', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  assert.deepEqual(c.panelStateReceipt.validators.sort(), ['V1', 'V2', 'V3']);
  assert.equal(c.panelStateReceipt.size, 3);
});

test('NI-9c / v0.1 honesty: no stance carries a reputation score and none is ranked FRINGE', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  for (const c of idx) {
    for (const s of c.stances) {
      assert.equal('reputation' in s, false); // reputation is NI-9b/v0.2, deliberately absent
      assert.notEqual(s.standing, 'FRINGE'); // no demotion power in v0.1
      assert.equal(typeof s.panelVotes, 'number'); // support is panel distribution, NOT reputation
    }
  }
});

test('G2 / projection honesty: a vote that fails signature verification is excluded', () => {
  const votes = fullPanel();
  // tamper V3's verbatim output after signing -> its rawOutputHash no longer matches
  const i = votes.findIndex((v) => v.ballotHash === BH_UNANIMOUS && v.validatorId === 'V3');
  votes[i] = { ...votes[i], rawOutput: 'silently rewritten after signing' };
  const idx = buildClaimIndex(votes, keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  // V3 dropped; only V1/V2 counted -> still RESOLVED YES, receipt reflects the 2 valid signers
  assert.equal(c.verdict, 'YES');
  assert.deepEqual(c.stances[0].validators.sort(), ['V1', 'V2']);
  assert.deepEqual(c.panelStateReceipt.validators.sort(), ['V1', 'V2']);
});

test('the index is a deterministic projection (same log => same claims)', () => {
  const a = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2));
  const b = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2));
  assert.equal(a, b);
});
