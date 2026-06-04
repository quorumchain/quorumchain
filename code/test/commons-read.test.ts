import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballotHash, generateValidatorKey, signVote, type SignedVote } from '../src/signed-vote.ts';
import type { Claim } from '../src/commons.ts';
import { viewClaim, buildViews } from '../src/commons-read.ts';

const bh = ballotHash('Did X occur?', 'evidence');
const resolvedClaim: Claim = {
  ballotHash: bh,
  status: 'RESOLVED',
  verdict: 'YES',
  stances: [
    { position: 'YES', validators: ['V1', 'V2'], panelVotes: 2, standing: 'CONSENSUS' },
    { position: 'NO', validators: ['V3'], panelVotes: 1, standing: 'CREDIBLE_MINORITY' },
  ],
  panelStateReceipt: { validators: ['V1', 'V2', 'V3'], size: 3 },
};

test('viewClaim maps a RESOLVED 2/1 claim, preserving the dissent as a named CREDIBLE_MINORITY', () => {
  const reg = [{ ballotHash: bh, prompt: 'Did X occur?', context: 'evidence' }];
  const v = viewClaim(resolvedClaim, reg, true);
  assert.equal(v.ballotHash, bh);
  assert.equal(v.statement, 'Did X occur?'); // hash-verified statement
  assert.equal(v.status, 'RESOLVED');
  assert.equal(v.chainValid, true);
  assert.deepEqual(v.stances.map((s) => [s.position, s.standing]), [['YES', 'CONSENSUS'], ['NO', 'CREDIBLE_MINORITY']]);
  assert.equal(v.stances[0].support, null); // NI-9b: never 0, no external anchor in v0.1
  assert.deepEqual(v.panelState.validators, ['V1', 'V2', 'V3']);
});

test('viewClaim statement is null when the registry has no (or a tampered) entry', () => {
  assert.equal(viewClaim(resolvedClaim, [], true).statement, null);
  const tampered = [{ ballotHash: bh, prompt: 'forged', context: 'evidence' }];
  assert.equal(viewClaim(resolvedClaim, tampered, true).statement, null);
});

test('buildViews produces one ClaimView per ballot, chainValid threaded through', () => {
  const k1 = generateValidatorKey(), k2 = generateValidatorKey(), k3 = generateValidatorKey();
  const keyring = { V1: k1.publicKeyPem, V2: k2.publicKeyPem, V3: k3.publicKeyPem };
  const bhA = ballotHash('Q-A', 'ctx');
  const votes: SignedVote[] = [
    signVote({ validatorId: 'V1', privateKeyPem: k1.privateKeyPem, ballotHash: bhA, verdict: 'YES', rawOutput: 'r' }),
    signVote({ validatorId: 'V2', privateKeyPem: k2.privateKeyPem, ballotHash: bhA, verdict: 'YES', rawOutput: 'r' }),
    signVote({ validatorId: 'V3', privateKeyPem: k3.privateKeyPem, ballotHash: bhA, verdict: 'NO', rawOutput: 'r' }),
  ];
  const reg = [{ ballotHash: bhA, prompt: 'Q-A', context: 'ctx' }];
  const views = buildViews(votes, keyring, 2, reg, true);
  assert.equal(views.length, 1);
  assert.equal(views[0].statement, 'Q-A');
  assert.equal(views[0].status, 'RESOLVED');
  assert.equal(views[0].chainValid, true);
});
