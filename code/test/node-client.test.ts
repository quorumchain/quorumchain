import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { renderSubmission, packageSnapshot, inert } from '../src/node-client.ts';

const k = generateValidatorKey();

test('inert neutralizes angle brackets and control chars', () => {
  assert.doesNotMatch(inert('<b>x</b>'), /<b>/);
  assert.equal(inert('a b').includes(' '), false);
});

test('renderSubmission escapes submission text as inert (no raw markup)', () => {
  const line = renderSubmission({ id: 'abc', status: 'PENDING_REVIEW', ballotHash: 'h', raw: { question: 'hi `rm -rf` <b>x</b>', context: 'c' }, screening: { wellFormed: true, lengthOk: true, tokenCount: 3, exactDuplicate: false, nearestHash: null, similarity: 0, rateFlagged: false } });
  assert.doesNotMatch(line, /<b>/);
  assert.match(line, /abc/);
});

test('packageSnapshot reads local votes.log + ballots.jsonl into a Snapshot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-pkg-'));
  const lp = join(dir, 'votes.log');
  appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  writeFileSync(join(dir, 'ballots.jsonl'), '');
  const snap = packageSnapshot(dir);
  assert.equal(snap.votesLog, readFileSync(lp, 'utf8'));
  assert.equal(typeof snap.ballots, 'string');
});
