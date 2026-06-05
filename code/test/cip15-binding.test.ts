import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ballotHash, generateValidatorKey } from '../src/signed-vote.ts';
import { appendBallot, loadRegistry, verifyEntry } from '../src/ballot-registry.ts';
import { convene, parseVerdict } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { readLog } from '../src/vote-log.ts';
import { anchorCommitment, type Anchor } from '../src/anchor.ts';

// CIP-15 slice 3 — NI-15e: the anchor SET is bound into the ballot hash (CIP-14 optional-append),
// so it enters every validator signature and cannot be swapped/added/dropped post-vote. Plus the
// canonicalization the red-team demanded (sorted, NFC, dup-rejected, empty-forbidden) and the
// two-optional composition with CIP-14's epistemicType (legacy byte-stable, no collision).

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const legacy = (p: string, c: string) => sha(JSON.stringify({ prompt: p, context: c }));
const mk = (contentHash: string, citedAssertion = 'a', anchorType = 't', issuer = 'i'): Anchor =>
  ({ anchorType, provenanceClass: 'STRUCTURED', issuer, contentHash, citedAssertion, asOf: 1 });

function tmpReg() { return join(mkdtempSync(join(tmpdir(), 'qrm-bind-')), 'ballots.jsonl'); }
function tmpLog() { return join(mkdtempSync(join(tmpdir(), 'qrm-bind-')), 'votes.log'); }
function fakePanel(outputs: Record<string, string>): { signers: Signer[]; keyring: Record<string, string> } {
  const keyring: Record<string, string> = {};
  const signers = Object.entries(outputs).map(([id, out]) => {
    const k = generateValidatorKey();
    keyring[id] = k.publicKeyPem;
    return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(out), rawOutput: out }) });
  });
  return { signers, keyring };
}

// --- GP3a: anchorCommitment canonicalization (NI-15e) ---

test('GP3a: anchorCommitment is order-independent, NFC-stable, and rejects duplicates / empty', () => {
  const a = mk(sha('1')), b = mk(sha('2'));
  assert.equal(anchorCommitment([a, b]), anchorCommitment([b, a])); // sorted by contentHash
  const ch = sha('3');
  assert.equal(anchorCommitment([mk(ch, 'café')]), anchorCommitment([mk(ch, 'café')])); // NFC normalization
  assert.throws(() => anchorCommitment([a, mk(sha('1'), 'different')])); // duplicate contentHash rejected
  assert.throws(() => anchorCommitment([])); // empty set forbidden
});

// --- GP3b: ballotHash composes the two optional fields, legacy byte-stable, no collision ---

test('GP3b: ballotHash binds anchorCommitment without shifting legacy / CIP-14 hashes or colliding', () => {
  assert.equal(ballotHash('p', 'c'), legacy('p', 'c')); // legacy byte-stable
  assert.equal(ballotHash('p', 'c', 'EMPIRICAL_LIVE'), sha(JSON.stringify({ prompt: 'p', context: 'c', epistemicType: 'EMPIRICAL_LIVE' }))); // CIP-14 stable
  const comm = anchorCommitment([mk(sha('1'))]);
  const typedOnly = ballotHash('p', 'c', 'EMPIRICAL_LIVE');
  const anchoredOnly = ballotHash('p', 'c', undefined, comm);
  const both = ballotHash('p', 'c', 'EMPIRICAL_LIVE', comm);
  assert.notEqual(ballotHash('p', 'c'), anchoredOnly);
  assert.notEqual(typedOnly, anchoredOnly);
  assert.notEqual(typedOnly, both);
  assert.notEqual(anchoredOnly, both);
  assert.equal(ballotHash('p', 'c', undefined, comm), anchoredOnly); // deterministic
});

// --- GP3c: registry binding — mutating anchors fails verifyEntry (NI-15e) ---

test('GP3c: appendBallot binds the anchor set; swap/drop fails verifyEntry', () => {
  const reg = tmpReg();
  const anchors = [mk(sha('1')), mk(sha('2'))];
  appendBallot(reg, 'p', 'c', { meta: { anchors } });
  const e = loadRegistry(reg)[0];
  assert.equal(e.ballotHash, ballotHash('p', 'c', undefined, anchorCommitment(anchors))); // anchor-bound
  assert.equal(verifyEntry(e), true);
  assert.equal(verifyEntry({ ...e, meta: { anchors: [mk(sha('1')), mk(sha('999'))] } }), false); // swap
  assert.equal(verifyEntry({ ...e, meta: { anchors: [mk(sha('1'))] } }), false); // drop
});

// --- GP3d: end-to-end convene binds anchors into the signed ballot; post-vote swap is caught ---

test('GP3d: convene binds anchors into every signature; a post-vote anchor swap breaks verifyEntry', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' });
  const reg = tmpReg();
  const log = tmpLog();
  const anchors = [mk(sha('1')), mk(sha('2'))];
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: log, registryPath: reg, meta: { epistemicType: 'EMPIRICAL_LIVE', anchors } });
  assert.equal(r.ratified, true);
  assert.equal(r.ballotHash, ballotHash('q', 'c', undefined, anchorCommitment(anchors))); // anchor-bound (typeBinding not set)
  const votes = readLog(log).map((e) => e.vote);
  assert.ok(votes.every((v) => v.ballotHash === r.ballotHash)); // signed over the anchor-bound hash
  const e = loadRegistry(reg).find((x) => x.ballotHash === r.ballotHash)!;
  assert.equal(verifyEntry(e), true);
  assert.equal(verifyEntry({ ...e, meta: { ...e.meta, anchors: [mk(sha('1')), mk(sha('CHANGED'))] } }), false); // post-vote substitution caught
});
