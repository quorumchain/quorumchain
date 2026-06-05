import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ballotHash, generateValidatorKey, signVote, verifyVote, ratify } from '../src/signed-vote.ts';
import { appendBallot, loadRegistry, verifyEntry, deriveCip13Inputs } from '../src/ballot-registry.ts';
import { convene } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { parseVerdict } from '../src/panel.ts';
import { buildViews } from '../src/commons-read.ts';
import { readLog } from '../src/vote-log.ts';

// CIP-14 (core ballot e0d17747): bind epistemicType into ballotHash via the round-57
// nonce's optional-append discipline. v1 (no bound type) stays byte-identical; v2 binds the
// type into the hash and thus every signature. Gates G14a–f + the §2.3 serialization
// contract (NI-14f) that all three validators flagged at ratification.

const v1 = (p: string, c: string) => createHash('sha256').update(JSON.stringify({ prompt: p, context: c }), 'utf8').digest('hex');

function tmpReg(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-cip14-')), 'ballots.jsonl');
}
function tmpLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-cip14-')), 'votes.log');
}
function fakePanel(outputs: Record<string, string>): { signers: Signer[]; keyring: Record<string, string> } {
  const keyring: Record<string, string> = {};
  const signers = Object.entries(outputs).map(([id, out]) => {
    const k = generateValidatorKey();
    keyring[id] = k.publicKeyPem;
    return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(out), rawOutput: out }) });
  });
  return { signers, keyring };
}

// --- G14a / NI-14a: v1 hashing is byte-identical (legacy verifies forever) ---

test('G14a: ballotHash(prompt,context) is unchanged and byte-identical to the v1 formula', () => {
  assert.equal(ballotHash('p', 'c'), v1('p', 'c'));
  assert.equal(ballotHash('p', 'c', undefined), v1('p', 'c'));
});

// --- G14b: a bound type changes the hash, deterministically and per-token ---

test('G14b: a bound type yields a different, deterministic, per-token hash', () => {
  assert.notEqual(ballotHash('p', 'c', 'EMPIRICAL_LIVE'), ballotHash('p', 'c'));
  assert.notEqual(ballotHash('p', 'c', 'EMPIRICAL_LIVE'), ballotHash('p', 'c', 'SETTLED'));
  assert.equal(ballotHash('p', 'c', 'EMPIRICAL_LIVE'), ballotHash('p', 'c', 'EMPIRICAL_LIVE'));
});

// --- NI-14f: the serialization contract — only a recognized token enters the v2 preimage ---

test('NI-14f: null / empty / unrecognized boundType falls through to the v1 hash (no null key emitted)', () => {
  assert.equal(ballotHash('p', 'c', null as unknown as string), v1('p', 'c'));
  assert.equal(ballotHash('p', 'c', ''), v1('p', 'c'));
  assert.equal(ballotHash('p', 'c', 'BOGUS'), v1('p', 'c'));
});

// --- G14e: a v1 backfilled entry (type present, NOT bound) still verifies ---

test('G14e: a backfilled advisory entry (epistemicType present, no typeBinding) verifies under v1', () => {
  const reg = tmpReg();
  appendBallot(reg, 'p', 'c', { meta: { epistemicType: 'SETTLED' } }); // advisory, not hash-bound
  const e = loadRegistry(reg)[0];
  assert.equal(e.ballotHash, v1('p', 'c')); // v1 hash — type NOT in it
  assert.equal(verifyEntry(e), true);
});

// --- G14c: a v2 entry binds the type; tampering with a bound type fails verifyEntry ---

test('G14c: a type-bound (v2) entry verifies; flipping its bound type fails verifyEntry', () => {
  const reg = tmpReg();
  appendBallot(reg, 'p', 'c', { meta: { epistemicType: 'EMPIRICAL_LIVE', typeBinding: 'hashed' } });
  const e = loadRegistry(reg)[0];
  assert.equal(e.ballotHash, ballotHash('p', 'c', 'EMPIRICAL_LIVE')); // v2 hash — type IS in it
  assert.equal(verifyEntry(e), true);
  const tampered = { ...e, meta: { ...e.meta!, epistemicType: 'SETTLED' as const } };
  assert.equal(verifyEntry(tampered), false); // bound type changed → recomputed hash diverges
});

test('G14c (advisory): flipping a v1 advisory type does NOT break the hash (type not bound)', () => {
  const reg = tmpReg();
  appendBallot(reg, 'p', 'c', { meta: { epistemicType: 'SETTLED' } });
  const e = loadRegistry(reg)[0];
  const relabeled = { ...e, meta: { ...e.meta!, epistemicType: 'NORMATIVE' as const } };
  assert.equal(verifyEntry(relabeled), true); // advisory type is not in the hash
});

// --- G14d: a vote bound to type X is not accepted under a hash derived with type Y ---

test('G14d: ratify rejects votes whose bound type differs from the expected (type-bound) hash', () => {
  const k = generateValidatorKey();
  const keyring = { V1: k.publicKeyPem };
  const bhX = ballotHash('p', 'c', 'SETTLED');
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bhX, verdict: 'YES', rawOutput: 'r' });
  assert.equal(verifyVote(vote, k.publicKeyPem), true); // the vote itself is valid over bhX
  const bhY = ballotHash('p', 'c', 'NORMATIVE');
  const r = ratify(bhY, [vote], keyring, 1); // expected hash carries a DIFFERENT bound type
  assert.equal(r.ratified, false);
  assert.deepEqual(r.rejected, [{ validatorId: 'V1', reason: 'wrong-ballot' }]); // bound-type mismatch → rejected, never counted
});

// --- G14f: end-to-end — convene with a bound type lands a v2, signed, type-bound claim ---

test('G14f: convene with a bound type writes a v2 entry whose hash the votes share; read surface shows the type', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' });
  const reg = tmpReg();
  const log = tmpLog();
  const r = await convene({
    prompt: 'Is BTC dominance above 50%?',
    context: 'as of now',
    signers,
    keyring,
    quorum: 2,
    logPath: log,
    registryPath: reg,
    meta: { epistemicType: 'EMPIRICAL_LIVE', typeBinding: 'hashed' },
  });
  assert.equal(r.ratified, true);
  // the ratified ballotHash is the v2 (type-bound) hash, and the votes were signed over it
  assert.equal(r.ballotHash, ballotHash('Is BTC dominance above 50%?', 'as of now', 'EMPIRICAL_LIVE'));
  const votes = readLog(log).map((e) => e.vote);
  assert.ok(votes.every((vt) => vt.ballotHash === r.ballotHash));
  // the registry entry is v2 and verifies
  const e = loadRegistry(reg).find((x) => x.ballotHash === r.ballotHash)!;
  assert.equal(e.meta?.typeBinding, 'hashed');
  assert.equal(verifyEntry(e), true);
  // the read surface projects the (now signed) type
  const view = buildViews(votes, keyring, 2, loadRegistry(reg), true).find((vv) => vv.ballotHash === r.ballotHash)!;
  assert.equal(view.epistemicType, 'EMPIRICAL_LIVE');
  assert.equal(view.typeRatified, false); // NI-14d: binding is the proposer's declaration, not panel ratification
});
