import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateValidatorKey,
  ballotHash,
  signVote,
  verifyVote,
  ratify,
  findEquivocations,
} from '../src/signed-vote.ts';

// --- ballot hashing: a vote must bind the FULL prompt + context (CIP-3 §1) ---

test('ballotHash is deterministic for the same prompt and context', () => {
  assert.equal(ballotHash('q', 'ctx'), ballotHash('q', 'ctx'));
});

test('ballotHash changes when the prompt changes', () => {
  assert.notEqual(ballotHash('q1', 'ctx'), ballotHash('q2', 'ctx'));
});

test('ballotHash changes when the context changes (anti bait-and-switch)', () => {
  assert.notEqual(ballotHash('q', 'ctx1'), ballotHash('q', 'ctx2'));
});

// --- signing & verification ---

test('a signed vote verifies with the validator public key', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('Did M(I)=O?', 'evidence');
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'reasoning...' });
  assert.equal(verifyVote(vote, k.publicKeyPem), true);
});

test('verification fails if the verdict is altered', () => {
  const k = generateValidatorKey();
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', 'c'), verdict: 'YES', rawOutput: 'r' });
  const tampered = { ...vote, verdict: 'NO' };
  assert.equal(verifyVote(tampered, k.publicKeyPem), false);
});

test('verification fails if the raw output is altered', () => {
  const k = generateValidatorKey();
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', 'c'), verdict: 'YES', rawOutput: 'original' });
  const tampered = { ...vote, rawOutput: 'rewritten' };
  assert.equal(verifyVote(tampered, k.publicKeyPem), false);
});

test('verification fails against a different ballot hash (bait-and-switch)', () => {
  const k = generateValidatorKey();
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('real question', 'c'), verdict: 'YES', rawOutput: 'r' });
  const tampered = { ...vote, ballotHash: ballotHash('swapped question', 'c') };
  assert.equal(verifyVote(tampered, k.publicKeyPem), false);
});

test('verification fails with the wrong public key', () => {
  const k = generateValidatorKey();
  const other = generateValidatorKey();
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', 'c'), verdict: 'YES', rawOutput: 'r' });
  assert.equal(verifyVote(vote, other.publicKeyPem), false);
});

// --- ratification: a verifiable function of signed votes (CIP-3 §1) ---

function panel() {
  const v1 = generateValidatorKey(), v2 = generateValidatorKey(), v3 = generateValidatorKey();
  return {
    keys: { V1: v1, V2: v2, V3: v3 },
    keyring: { V1: v1.publicKeyPem, V2: v2.publicKeyPem, V3: v3.publicKeyPem },
  };
}

test('ratify reaches quorum when enough validators agree on the same ballot', () => {
  const p = panel();
  const bh = ballotHash('Did M(I)=O?', 'evidence');
  const votes = [
    signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' }),
    signVote({ validatorId: 'V2', privateKeyPem: p.keys.V2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'b' }),
    signVote({ validatorId: 'V3', privateKeyPem: p.keys.V3.privateKeyPem, ballotHash: bh, verdict: 'NO', rawOutput: 'c' }),
  ];
  const r = ratify(bh, votes, p.keyring, 2);
  assert.equal(r.ratified, true);
  assert.equal(r.verdict, 'YES');
  assert.equal(r.tally.YES, 2);
});

test('ratify does not reach quorum when validators do not agree', () => {
  const p = panel();
  const bh = ballotHash('q', 'c');
  const votes = [
    signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' }),
    signVote({ validatorId: 'V2', privateKeyPem: p.keys.V2.privateKeyPem, ballotHash: bh, verdict: 'NO', rawOutput: 'b' }),
    signVote({ validatorId: 'V3', privateKeyPem: p.keys.V3.privateKeyPem, ballotHash: bh, verdict: 'MAYBE', rawOutput: 'c' }),
  ];
  const r = ratify(bh, votes, p.keyring, 2);
  assert.equal(r.ratified, false);
  assert.equal(r.verdict, null);
});

test('ratify rejects a vote signed over a different ballot hash', () => {
  const p = panel();
  const bh = ballotHash('real', 'c');
  const wrong = ballotHash('different', 'c');
  const votes = [
    signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' }),
    signVote({ validatorId: 'V2', privateKeyPem: p.keys.V2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'b' }),
    signVote({ validatorId: 'V3', privateKeyPem: p.keys.V3.privateKeyPem, ballotHash: wrong, verdict: 'YES', rawOutput: 'c' }),
  ];
  const r = ratify(bh, votes, p.keyring, 3);
  assert.equal(r.ratified, false); // only 2 valid votes for this ballot, quorum was 3
  assert.equal(r.counted.length, 2);
  assert.equal(r.rejected.length, 1);
});

test('ratify rejects an invalidly-signed vote', () => {
  const p = panel();
  const bh = ballotHash('q', 'c');
  const good = signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' });
  const forged = { ...signVote({ validatorId: 'V2', privateKeyPem: p.keys.V2.privateKeyPem, ballotHash: bh, verdict: 'NO', rawOutput: 'b' }), verdict: 'YES' }; // tampered after signing
  const r = ratify(bh, [good, forged], p.keyring, 2);
  assert.equal(r.ratified, false);
  assert.equal(r.counted.length, 1);
});

test('ratify rejects a vote from a validator not in the keyring', () => {
  const p = panel();
  const stranger = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const votes = [
    signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' }),
    signVote({ validatorId: 'VX', privateKeyPem: stranger.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'b' }),
  ];
  const r = ratify(bh, votes, p.keyring, 2);
  assert.equal(r.counted.length, 1);
  assert.equal(r.ratified, false);
});

// --- equivocation (CIP-3 §3 slashable offense) ---

test('findEquivocations flags a validator who signed two different verdicts on the same ballot', () => {
  const p = panel();
  const bh = ballotHash('q', 'c');
  const a = signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' });
  const b = signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'NO', rawOutput: 'b' });
  const eq = findEquivocations([a, b]);
  assert.equal(eq.length, 1);
  assert.equal(eq[0].validatorId, 'V1');
});

test('findEquivocations is empty when each validator votes once', () => {
  const p = panel();
  const bh = ballotHash('q', 'c');
  const a = signVote({ validatorId: 'V1', privateKeyPem: p.keys.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'a' });
  const b = signVote({ validatorId: 'V2', privateKeyPem: p.keys.V2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'b' });
  assert.equal(findEquivocations([a, b]).length, 0);
});
