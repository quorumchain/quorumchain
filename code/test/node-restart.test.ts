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
