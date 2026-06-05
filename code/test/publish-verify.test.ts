import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, type SignedVote } from '../src/signed-vote.ts';
import { appendVote, readLog } from '../src/vote-log.ts';
import { verifyPublish } from '../src/publish-verify.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));
const QUORUM = 2;

function vote(id: 'V1' | 'V2' | 'V3', bh: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: `${id}:YES` });
}
function freshLog(): string { return join(mkdtempSync(join(tmpdir(), 'qrm-pv-')), 'votes.log'); }

test('accepts a valid forward-extension signed entirely by pinned validators', () => {
  const p = freshLog();
  appendVote(p, vote('V1', 'bh1')); appendVote(p, vote('V2', 'bh1'));
  const current = readLog(p);
  appendVote(p, vote('V3', 'bh2')); // extend the SAME file → shares the prefix
  const staged = readLog(p);
  const r = verifyPublish({ staged, current, checkpoint: null, keyring, chainId: 'c', quorum: QUORUM });
  assert.equal(r.ok, true);
  assert.equal(r.length, 3);
});

test('rejects a vote from an unpinned validator (NI-D1 substitution)', () => {
  const rogue = generateValidatorKey();
  const p = freshLog();
  appendVote(p, signVote({ validatorId: 'VX', privateKeyPem: rogue.privateKeyPem, ballotHash: 'b', verdict: 'YES', rawOutput: 'x' }));
  const r = verifyPublish({ staged: readLog(p), current: [], checkpoint: null, keyring, chainId: 'c', quorum: QUORUM });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /unpinned|unknown/i);
});

test('rejects a tampered chain', () => {
  const p = freshLog(); appendVote(p, vote('V1', 'bh1')); appendVote(p, vote('V2', 'bh1'));
  const entries = readLog(p);
  const tampered = entries.map((e, i) => (i === 0 ? { ...e, vote: { ...e.vote, verdict: 'NO' } } : e));
  assert.equal(verifyPublish({ staged: tampered, current: [], checkpoint: null, keyring, chainId: 'c', quorum: QUORUM }).ok, false);
});

test('rejects a history rewrite / shorter-than-current chain', () => {
  const p = freshLog(); appendVote(p, vote('V1', 'bh1')); appendVote(p, vote('V2', 'bh1'));
  const current = readLog(p);
  const f = freshLog(); appendVote(f, vote('V3', 'other'));
  const fork = readLog(f);
  assert.equal(verifyPublish({ staged: fork, current, checkpoint: null, keyring, chainId: 'c', quorum: QUORUM }).ok, false);
});

test('rejects a rollback below the checkpoint', () => {
  const p = freshLog(); appendVote(p, vote('V1', 'bh1')); appendVote(p, vote('V2', 'bh1'));
  const current = readLog(p);
  const r = verifyPublish({ staged: current, current, checkpoint: { chainId: 'c', length: 5, headHash: 'zz', publishedAt: 't' }, keyring, chainId: 'c', quorum: QUORUM });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /checkpoint|rollback/i);
});
