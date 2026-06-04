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
// `verdicts` are the per-validator verdicts; the daemon counts REAL (non-NO_VERDICT)
// ones and compares against the result's own `required` threshold (ratify's actual bar).
function result(verdicts: string[], ratified: boolean, required = 2) {
  return {
    ballotHash: 'h',
    ratified,
    required,
    verdict: ratified ? verdicts[0] : null,
    tally: {},
    votes: verdicts.map((verdict) => ({ verdict })),
    failures: [],
    rejected: [],
  };
}

test('a ratified convening (>= quorum votes) is moved to done', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 3, runBallot: async () => result(['SOUND','SOUND','SOUND'], true) });
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
      return result(['NO','NO','NO'], false); // 3 validators voted, quorum not reached -> legitimate NO
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
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 3, runBallot: async () => result(['NO'], false) });
  assert.deepEqual(summary.retried, ['b01']);
  assert.equal(summary.done.length, 0);
  const pending = listPending(q);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].attempts, 1);
});

// Round-52 dogfood scenario: 2 validators returned NO_VERDICT (a CLI error + an agent
// timeout) and only 1 produced a real verdict. Raw votes.length is 3, but real
// participation is 1 < quorum, so this is a LIVENESS failure (retry), not a decided
// outcome. Counting raw votes would launder two failures into a finalized "decision".
test('a convening with fewer than quorum REAL verdicts (rest NO_VERDICT) is a retry, not done', async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  const summary = await drainQueue({
    queueDir: q,
    quorum: 2,
    maxAttempts: 3,
    runBallot: async () => result(['REVISE', 'NO_VERDICT', 'NO_VERDICT'], false),
  });
  assert.deepEqual(summary.retried, ['b01']); // 1 real verdict < quorum -> liveness retry
  assert.equal(summary.done.length, 0);
  assert.equal(listPending(q)[0].attempts, 1);
});

// Round-53 V1 deferred finding: the daemon's participation bar must match ratify's ACTUAL
// threshold (max(quorum, supermajority(n))), not the passed quorum. For an N>4 panel,
// supermajority can exceed a weak passed quorum; 2 real verdicts that ratify reports as
// required=3 must be a retry, not a finalized "decided" outcome.
test("the daemon honours the result's own required threshold, not just the passed quorum", async () => {
  const q = tmpQueue();
  enqueue(q, 'b01', { prompt: 'ship?' });
  // 2 real verdicts, but ratify says required=3 (e.g. a 4-validator panel) -> liveness retry
  const summary = await drainQueue({ queueDir: q, quorum: 2, maxAttempts: 3, runBallot: async () => result(['NO', 'NO'], false, 3) });
  assert.deepEqual(summary.retried, ['b01']);
  assert.equal(summary.done.length, 0);
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
      return result(['SOUND','SOUND'], true);
    },
  });
  assert.deepEqual(order, ['first', 'second']);
});
