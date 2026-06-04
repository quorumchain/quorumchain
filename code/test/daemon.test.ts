import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { enqueue, listPending } from '../src/queue.ts';
import { drainQueue } from '../src/daemon.ts';

function tmpQueue(): string {
  return mkdtempSync(join(tmpdir(), 'qrm-daemon-'));
}

// A fake convene result: only the fields the daemon's participation policy reads.
function result(votes: number, ratified: boolean) {
  return { ballotHash: 'h', ratified, verdict: ratified ? 'YES' : 'NO', tally: {}, votes: new Array(votes).fill({}), failures: [], rejected: [] };
}

test('a ratified convening (>= quorum votes) is moved to done', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 3, runBallot: async () => result(3, true) });
  assert.deepEqual(summary.done, ['b01']);
  assert.equal(listPending(q).length, 0);
  assert.ok(existsSync(join(q, 'done', 'b01.json')));
});

test('ran with >= quorum votes but NOT ratified is still done, never retried (a real NO is not laundered)', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  let calls = 0;
  const summary = await drainQueue({
    queueDir: q,
    quorum: 2,
    maxAttempts: 3,
    runBallot: async () => {
      calls++;
      return result(3, false); // 3 validators voted, quorum not reached -> legitimate NO
    },
  });
  assert.equal(calls, 1, 'a decided ballot is convened exactly once');
  assert.deepEqual(summary.done, ['b01']);
  const done = JSON.parse(readFileSync(join(q, 'done', 'b01.json'), 'utf8'));
  assert.equal(done.result.ratified, false);
});

test('fewer than quorum votes (liveness, not a decision) is a retry, not done', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 3, runBallot: async () => result(1, false) });
  assert.deepEqual(summary.retried, ['b01']);
  assert.equal(summary.done.length, 0);
  const pending = listPending(q);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].attempts, 1);
});

test('a throw from runBallot (could not run) is a retry; after maxAttempts it fails', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  const run = async () => {
    throw new Error('no signers started');
  };
  // attempt 1 -> retried (attempts 1)
  await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 2, runBallot: run });
  assert.equal(listPending(q)[0].attempts, 1);
  // attempt 2 -> reaches maxAttempts -> failed
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 2, runBallot: run });
  assert.deepEqual(summary.failed, ['b01']);
  assert.equal(listPending(q).length, 0);
  const failed = JSON.parse(readFileSync(join(q, 'failed', 'b01.json'), 'utf8'));
  assert.match(failed.reason, /no signers started/);
});

test('drains pending oldest-first, one convening at a time', async () => {
  const q = tmpQueue();
  enqueue(q, 'b02', { prompt: 'second' });
  enqueue(q, 'b01', { prompt: 'first' });
  const order: string[] = [];
  let inFlight = 0;
  await drainQueue({
    queueDir: q,
    quorum: 2,
    maxAttempts: 3,
    runBallot: async (ballot) => {
      inFlight++;
      assert.equal(inFlight, 1, 'convenings never overlap');
      order.push(ballot.prompt);
      inFlight--;
      return result(2, true);
    },
  });
  assert.deepEqual(order, ['first', 'second']);
});
