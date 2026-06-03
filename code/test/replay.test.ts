// CIP-8 frozen-ballot replay verifier — gates G1 and G2.
// G1 (frozen-ballot integrity): appending "additional context" after creation
//   necessarily changes the ballotHash — the Polymarket attack is mechanically
//   impossible to do silently.
// G2 (replay the live case): from the byte-exact frozen criteria, recompute the
//   ballotHash, confirm it matches what was signed, and re-verify the signed
//   verdict — anyone with the criteria + keyring + votes reproduces the result.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { recomputeBallotHash, tamperDelta, replayBallot } from '../src/replay.ts';

const QUESTION = 'Did a qualifying sale occur by the deadline on the ORIGINAL frozen rule?';
const CRITERIA = 'Resolve YES if the entity sells any holding by 11:59 PM ET on the date. Primary source: SEC filings + on-chain data.';

function signedPanel(bh: string): { votes: SignedVote[]; keyring: Record<string, string> } {
  const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
  const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));
  const votes = [
    signVote({ validatorId: 'V1', privateKeyPem: keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'sale dated within window per primary source' }),
    signVote({ validatorId: 'V2', privateKeyPem: keys.V2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'EDGAR filing dates the sale inside the window' }),
    signVote({ validatorId: 'V3', privateKeyPem: keys.V3.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'frozen text keys on the sale, which occurred' }),
  ];
  return { votes, keyring };
}

test('recomputeBallotHash reproduces the resolution ballotHash from frozen criteria', () => {
  assert.equal(recomputeBallotHash(QUESTION, CRITERIA), ballotHash(QUESTION, CRITERIA));
});

test('G1: appending post-hoc context yields a different ballotHash', () => {
  const d = tamperDelta(QUESTION, CRITERIA, 'Additional context: confirmation outside the timeframe does not qualify.');
  assert.equal(d.originalHash, recomputeBallotHash(QUESTION, CRITERIA));
  assert.notEqual(d.tamperedHash, d.originalHash);
  assert.equal(d.differ, true);
});

test('G2: a ballot replays from its frozen criteria + signed votes', () => {
  const bh = recomputeBallotHash(QUESTION, CRITERIA);
  const { votes, keyring } = signedPanel(bh);
  const r = replayBallot({ question: QUESTION, frozenCriteria: CRITERIA, expectedBallotHash: bh, votes, keyring, quorum: 2 });
  assert.equal(r.hashMatches, true);
  assert.equal(r.allVotesValid, true);
  assert.equal(r.ratification.ratified, true);
  assert.equal(r.ratification.verdict, 'YES');
  assert.equal(r.replayOk, true);
});

test('G2: replay FAILS if the frozen criteria are not the ones that were signed', () => {
  const bh = recomputeBallotHash(QUESTION, CRITERIA);
  const { votes, keyring } = signedPanel(bh);
  // attacker presents different criteria and claims the same signed verdict
  const r = replayBallot({ question: QUESTION, frozenCriteria: CRITERIA + ' (silently widened)', expectedBallotHash: bh, votes, keyring, quorum: 2 });
  assert.equal(r.hashMatches, false);
  assert.equal(r.replayOk, false);
});

test('G2: replay FAILS if a signed vote was tampered after signing', () => {
  const bh = recomputeBallotHash(QUESTION, CRITERIA);
  const { votes, keyring } = signedPanel(bh);
  const tampered = [...votes];
  tampered[0] = { ...votes[0], verdict: 'NO' }; // flip a verdict without re-signing
  const r = replayBallot({ question: QUESTION, frozenCriteria: CRITERIA, expectedBallotHash: bh, votes: tampered, keyring, quorum: 2 });
  assert.equal(r.allVotesValid, false);
  assert.equal(r.replayOk, false);
});
