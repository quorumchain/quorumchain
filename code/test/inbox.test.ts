import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { submit, listInbox, getSubmission, decide, markConvened, newId, type Signals } from '../src/inbox.ts';

function inbox() { return join(mkdtempSync(join(tmpdir(), 'qrm-ib-')), 'inbox.jsonl'); }
const SIG: Signals = { wellFormed: true, lengthOk: true, tokenCount: 5, exactDuplicate: false, nearestHash: null, similarity: 0, rateFlagged: false };

test('newId yields a 128-bit hex capability id', () => {
  const id = newId();
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.notEqual(newId(), newId());
});

test('submit stores PENDING_REVIEW; decide and markConvened append new states (append-only)', () => {
  const path = inbox();
  const s = submit(path, { question: 'Q', context: 'C', ballotHash: 'bh', screening: SIG });
  assert.equal(s.status, 'PENDING_REVIEW');
  assert.equal(getSubmission(path, s.id)?.status, 'PENDING_REVIEW');
  decide(path, s.id, 'ACCEPT');
  assert.equal(getSubmission(path, s.id)?.status, 'ACCEPTED');
  markConvened(path, s.id, 'convened-bh');
  const final = getSubmission(path, s.id)!;
  assert.equal(final.status, 'CONVENED');
  assert.equal(final.convenedBallotHash, 'convened-bh');
});

test('reject records a reason and is retained; listInbox folds to the latest state per id', () => {
  const path = inbox();
  const a = submit(path, { question: 'A', context: 'C', ballotHash: 'a', screening: SIG });
  const b = submit(path, { question: 'B', context: 'C', ballotHash: 'b', screening: SIG });
  decide(path, b.id, 'REJECT', 'spam');
  assert.equal(getSubmission(path, b.id)?.status, 'REJECTED');
  assert.equal(getSubmission(path, b.id)?.decision?.reason, 'spam');
  assert.deepEqual(listInbox(path, 'PENDING_REVIEW').map((s) => s.id), [a.id]);
  assert.equal(listInbox(path).length, 2);
});

test('submit throws when the inbox exceeds the byte budget (NI-D9 cap)', () => {
  const path = inbox();
  // first submit succeeds and writes a record; a second submit with a tiny budget must throw
  submit(path, { question: 'Q', context: 'C', ballotHash: 'bh', screening: SIG });
  assert.throws(() => submit(path, { question: 'Q', context: 'C', ballotHash: 'bh2', screening: SIG }, 1), /budget/);
});
