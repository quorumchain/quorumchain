import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { bootVerify } from '../src/boot.ts';

const k = generateValidatorKey();

function bootedData() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-boot-'));
  const lp = join(mkdtempSync(join(tmpdir(), 'qrm-bl-')), 'votes.log');
  appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  return { data, log: readFileSync(lp, 'utf8') };
}

test('bootVerify returns live for a valid current + matching checkpoint chainId', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h', publishedAt: 't' });
  assert.equal(bootVerify(data, 'c').mode, 'live');
});

test('bootVerify returns degraded for a checkpoint chainId mismatch (wrong-chain volume)', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'WRONG', length: 1, headHash: 'h', publishedAt: 't' });
  assert.equal(bootVerify(data, 'c').mode, 'degraded');
});

test('bootVerify is live with no chain yet (nothing published) but not chainValid', () => {
  const { data } = bootedData();
  const b = bootVerify(data, 'c');
  assert.equal(b.mode, 'live');
  assert.equal(b.chainValid, false);
});

test('bootVerify is degraded when a checkpoint exists but no release is current (rollback below checkpoint)', () => {
  const { data } = bootedData();
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h', publishedAt: 't' }); // checkpoint but never committed a release
  const b = bootVerify(data, 'c');
  assert.equal(b.mode, 'degraded');
});

test('bootVerify is degraded when the active release chain is broken', () => {
  const { data } = bootedData();
  stageRelease(data, 'h', { votesLog: '{"vote":{"validatorId":"V1","ballotHash":"x","verdict":"YES","rawOutput":"y","rawOutputHash":"z","signature":"00"},"prevHash":"0000000000000000000000000000000000000000000000000000000000000000","entryHash":"deadbeef"}\n', ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  // no checkpoint mismatch; the chain itself is broken (entryHash won't recompute)
  assert.equal(bootVerify(data, 'c').mode, 'degraded');
});

test('bootVerify is degraded when current head != checkpoint head', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'DIFFERENT', publishedAt: 't' });
  assert.equal(bootVerify(data, 'c').mode, 'degraded');
});
