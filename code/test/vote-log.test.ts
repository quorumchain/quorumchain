import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendVote, readLog, verifyLog, verifyEntries } from '../src/vote-log.ts';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';

function tmpLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-')), 'votes.log');
}
function aVote(id = 'V1', verdict = 'YES'): SignedVote {
  const k = generateValidatorKey();
  return signVote({ validatorId: id, privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', 'c'), verdict, rawOutput: 'reasoning-' + id });
}

test('appending a vote then reading it back returns the same vote', () => {
  const p = tmpLog();
  const v = aVote();
  appendVote(p, v);
  const entries = readLog(p);
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].vote, v);
});

test('the first entry chains from genesis', () => {
  const p = tmpLog();
  appendVote(p, aVote());
  assert.equal(readLog(p)[0].prevHash, '0'.repeat(64));
});

test('the log chain verifies as intact after appending several votes', () => {
  const p = tmpLog();
  appendVote(p, aVote('V1', 'YES'));
  appendVote(p, aVote('V2', 'NO'));
  appendVote(p, aVote('V3', 'YES'));
  assert.equal(verifyLog(p).valid, true);
});

test('tampering with a logged vote breaks chain verification', () => {
  const p = tmpLog();
  appendVote(p, aVote('V1', 'YES'));
  appendVote(p, aVote('V2', 'NO'));
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  const e0 = JSON.parse(lines[0]);
  e0.vote.verdict = 'NO'; // rewrite the recorded verdict
  lines[0] = JSON.stringify(e0);
  writeFileSync(p, lines.join('\n') + '\n');
  const res = verifyLog(p);
  assert.equal(res.valid, false);
  assert.equal(res.brokenAt, 0);
});

test('removing an entry breaks the chain', () => {
  const p = tmpLog();
  appendVote(p, aVote('V1', 'YES'));
  appendVote(p, aVote('V2', 'NO'));
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  writeFileSync(p, lines[1] + '\n'); // keep only the 2nd entry; its prevHash now dangles
  assert.equal(verifyLog(p).valid, false);
});

test('verifyEntries: a clean chain verifies; a tampered entry is caught at its index', () => {
  const p = tmpLog();
  appendVote(p, aVote('V1', 'YES'));
  appendVote(p, aVote('V2', 'YES'));
  const entries = readLog(p);
  assert.deepEqual(verifyEntries(entries), { valid: true });
  const tampered = entries.map((e, i) => (i === 1 ? { ...e, vote: { ...e.vote, verdict: 'NO' } } : e));
  assert.deepEqual(verifyEntries(tampered), { valid: false, brokenAt: 1 });
});

test('an empty/absent log verifies as valid with no entries', () => {
  const p = tmpLog();
  assert.equal(verifyLog(p).valid, true);
  assert.equal(readLog(p).length, 0);
});
