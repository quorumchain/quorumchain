import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote, readLog } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { bootVerify } from '../src/boot.ts';

const k = generateValidatorKey();
const keyring: Record<string, string> = { V1: k.publicKeyPem };

function bootedData() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-boot-'));
  const lp = join(mkdtempSync(join(tmpdir(), 'qrm-bl-')), 'votes.log');
  appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  return { data, log: readFileSync(lp, 'utf8') };
}

// The real head/length of a votes.log string, as bootVerify recomputes it on-disk.
function realHeadOf(log: string): string {
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-rh-')), 'votes.log');
  writeFileSync(p, log);
  const entries = readLog(p);
  return entries.length ? entries[entries.length - 1].entryHash : '0'.repeat(64);
}

test('bootVerify returns live for a valid current + matching checkpoint chainId', () => {
  const { data, log } = bootedData();
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: realHead, publishedAt: 't' });
  assert.equal(bootVerify(data, 'c', keyring).mode, 'live');
});

test('bootVerify returns degraded for a checkpoint chainId mismatch (wrong-chain volume)', () => {
  const { data, log } = bootedData();
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'WRONG', length: 1, headHash: realHead, publishedAt: 't' });
  assert.equal(bootVerify(data, 'c', keyring).mode, 'degraded');
});

test('bootVerify is live with no chain yet (nothing published) but not chainValid', () => {
  const { data } = bootedData();
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'live');
  assert.equal(b.chainValid, false);
});

test('bootVerify is degraded when a checkpoint exists but no release is current (rollback below checkpoint)', () => {
  const { data } = bootedData();
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h', publishedAt: 't' }); // checkpoint but never committed a release
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'degraded');
});

test('bootVerify is degraded when the active release chain is broken', () => {
  const { data } = bootedData();
  stageRelease(data, 'h', { votesLog: '{"vote":{"validatorId":"V1","ballotHash":"x","verdict":"YES","rawOutput":"y","rawOutputHash":"z","signature":"00"},"prevHash":"0000000000000000000000000000000000000000000000000000000000000000","entryHash":"deadbeef"}\n', ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  // no checkpoint mismatch; the chain itself is broken (entryHash won't recompute)
  assert.equal(bootVerify(data, 'c', keyring).mode, 'degraded');
});

test('bootVerify is degraded when current head != checkpoint head', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: '1'.repeat(64), publishedAt: 't' });
  assert.equal(bootVerify(data, 'c', keyring).mode, 'degraded');
});

test('bootVerify is degraded when current is signed by an unpinned (rogue) validator', () => {
  // A self-consistent hash chain (verifyEntries passes) but signed by a key whose
  // validatorId is NOT in the pinned keyring — must NOT boot live (NI-D7/NI-D1).
  const data = mkdtempSync(join(tmpdir(), 'qrm-boot-'));
  const lp = join(mkdtempSync(join(tmpdir(), 'qrm-bl-')), 'votes.log');
  const rogue = generateValidatorKey();
  appendVote(lp, signVote({ validatorId: 'VX', privateKeyPem: rogue.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'VX:YES' }));
  const log = readFileSync(lp, 'utf8');
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'degraded');
  assert.match(b.reason ?? '', /unpinned validator VX/);
});

test('bootVerify is degraded for a PINNED validatorId whose signature is invalid (linkage valid, sig bad)', () => {
  // The vote claims validatorId 'V1' (a PINNED id) but is signed with a DIFFERENT (non-pinned)
  // private key. appendVote computes the entryHash over the vote AS SIGNED, so the hash chain
  // (verifyEntries linkage) is self-consistent — yet verifyVote(vote, pinnedV1PublicKey) fails.
  // This isolates the SIGNATURE branch (NI-D7) from the linkage branch.
  const data = mkdtempSync(join(tmpdir(), 'qrm-boot-'));
  const lp = join(mkdtempSync(join(tmpdir(), 'qrm-bl-')), 'votes.log');
  const wrong = generateValidatorKey();
  appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: wrong.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  const log = readFileSync(lp, 'utf8');
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: realHead, publishedAt: 't' });
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'degraded');
  assert.match(b.reason ?? '', /invalid signature for V1/);
});

test('bootVerify is degraded when actual on-disk length differs from the checkpoint', () => {
  // Pinned-signed, chain intact, head matches — but the checkpoint claims a longer
  // chain than is actually on disk. Must NOT boot live.
  const { data, log } = bootedData();
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 2, headHash: realHead, publishedAt: 't' });
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'degraded');
  assert.match(b.reason ?? '', /length/);
});

test('bootVerify is live for a pinned-signed release whose real head + length match the checkpoint', () => {
  const { data, log } = bootedData();
  const realHead = realHeadOf(log);
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: realHead, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: realHead, publishedAt: 't' });
  const b = bootVerify(data, 'c', keyring);
  assert.equal(b.mode, 'live');
  assert.equal(b.chainValid, true);
});
