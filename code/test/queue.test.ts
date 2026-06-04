import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enqueue, listPending, bumpAttempt, complete, fail, hasBallot } from '../src/queue.ts';

function tmpQueue(): string {
  return mkdtempSync(join(tmpdir(), 'qrm-queue-'));
}

test('enqueue then listPending returns the ballot with attempts 0', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?', context: 'evidence' });
  const pending = listPending(q);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, 'b01');
  assert.equal(pending[0].ballot.prompt, 'ship it?');
  assert.equal(pending[0].ballot.context, 'evidence');
  assert.equal(pending[0].attempts, 0);
});

test('listPending returns ballots oldest-first by id', () => {
  const q = tmpQueue();
  enqueue(q, 'b03', { prompt: 'third' });
  enqueue(q, 'b01', { prompt: 'first' });
  enqueue(q, 'b02', { prompt: 'second' });
  assert.deepEqual(
    listPending(q).map((p) => p.id),
    ['b01', 'b02', 'b03'],
  );
});

test('complete moves a ballot out of pending into done with its result attached', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?' });
  complete(q, 'b01', { ballotHash: 'abc', ratified: true, verdict: 'YES' });
  assert.equal(listPending(q).length, 0);
  assert.ok(existsSync(join(q, 'done', 'b01.json')));
  const done = JSON.parse(readFileSync(join(q, 'done', 'b01.json'), 'utf8'));
  assert.equal(done.status, 'done');
  assert.equal(done.result.ratified, true);
  assert.equal(done.ballot.prompt, 'ship it?');
});

test('fail moves a ballot out of pending into failed with a reason', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?' });
  fail(q, 'b01', 'no signers started');
  assert.equal(listPending(q).length, 0);
  assert.ok(existsSync(join(q, 'failed', 'b01.json')));
  const failed = JSON.parse(readFileSync(join(q, 'failed', 'b01.json'), 'utf8'));
  assert.equal(failed.status, 'failed');
  assert.equal(failed.reason, 'no signers started');
});

// Round-50 V2 finding: complete() is write-done-then-unlink-pending. A crash between
// the two leaves a DECIDED ballot in both dirs; it must NOT be re-listed and re-convened
// (that would launder a genuine NO). listPending excludes ids with a terminal record.
test('listPending skips a ballot that already has a done record (crash recovery — a decided ballot is never re-listed)', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?' });
  complete(q, 'b01', { ratified: false, verdict: 'NO' });
  // simulate a crash that wrote done/ but did not finish unlinking pending/
  writeFileSync(join(q, 'pending', 'b01.json'), JSON.stringify({ id: 'b01', ballot: { prompt: 'ship it?' }, attempts: 0 }));
  assert.deepEqual(listPending(q), []);
});

test('listPending skips a ballot that already has a failed record', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?' });
  fail(q, 'b01', 'no signers started');
  writeFileSync(join(q, 'pending', 'b01.json'), JSON.stringify({ id: 'b01', ballot: { prompt: 'ship it?' }, attempts: 0 }));
  assert.deepEqual(listPending(q), []);
});

// hasBallot: the dedup primitive the self-review sourcer uses so a given commit is
// enqueued at most once across pending/done/failed (no flooding, deterministic).
test('hasBallot is false for an unknown id, true once a ballot exists in any state', () => {
  const q = tmpQueue();
  assert.equal(hasBallot(q, 'b01'), false);
  enqueue(q, 'b01', { prompt: 'x' });
  assert.equal(hasBallot(q, 'b01'), true); // pending
  complete(q, 'b01', { ratified: true });
  assert.equal(hasBallot(q, 'b01'), true); // done — still known, never re-enqueue
  enqueue(q, 'b02', { prompt: 'y' });
  fail(q, 'b02', 'nope');
  assert.equal(hasBallot(q, 'b02'), true); // failed — still known
});

test('bumpAttempt increments the attempt counter and leaves the ballot pending', () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship it?' });
  bumpAttempt(q, 'b01');
  bumpAttempt(q, 'b01');
  const pending = listPending(q);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].attempts, 2);
});
