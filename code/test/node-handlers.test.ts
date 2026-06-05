import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { appendBallot } from '../src/ballot-registry.ts';
import { stageRelease, commitRelease, currentRelease } from '../src/release-store.ts';
import { handleHealth, handleVerify, handleBallot, handleLog, handleCommons, VALID_HASH } from '../src/node-handlers.ts';

function buildRelease() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-h-'));
  const k = generateValidatorKey();
  const bh = ballotHash('Q', 'C');
  const tmpLog = join(mkdtempSync(join(tmpdir(), 'qrm-hl-')), 'votes.log');
  appendVote(tmpLog, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'V1:YES' }));
  const tmpReg = join(mkdtempSync(join(tmpdir(), 'qrm-hr-')), 'ballots.jsonl');
  appendBallot(tmpReg, 'Q', 'C');
  stageRelease(data, 'head1', { votesLog: readFileSync(tmpLog, 'utf8'), ballots: readFileSync(tmpReg, 'utf8'), commons: { 'INDEX.md': '# Commons', 'a.md': '# claim a' } });
  commitRelease(data, 'head1', { chainId: 'c', valid: true, length: 1, headHash: 'head1', verifiedAt: 't' });
  return { data, bh };
}

test('VALID_HASH accepts 64-hex, rejects path tricks', () => {
  assert.equal(VALID_HASH.test('a'.repeat(64)), true);
  assert.equal(VALID_HASH.test('../etc/passwd'), false);
});

test('health and verify reflect the active release', () => {
  const { data } = buildRelease();
  const ref = currentRelease(data)!;
  assert.equal(handleHealth(data, ref, 'live').body.chainValid, true);
  assert.equal(handleVerify(data, ref).body.headHash, 'head1');
});

test('ballot handler returns the entry + verifyEntry true; log paginates', () => {
  const { data, bh } = buildRelease();
  const ref = currentRelease(data)!;
  const b = handleBallot(data, ref, bh);
  assert.equal(b.status, 200);
  assert.equal(b.body.verified, true);
  assert.equal(handleLog(data, ref, 0, 10).body.entries.length, 1);
  assert.equal(handleBallot(data, ref, 'zz').status, 400);
});
