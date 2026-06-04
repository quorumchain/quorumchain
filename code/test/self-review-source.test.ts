import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listPending, complete } from '../src/queue.ts';
import { reviewBallotFor, sourceSelfReview } from '../src/self-review-source.ts';

function tmpQueue(): string {
  return mkdtempSync(join(tmpdir(), 'qrm-selfreview-'));
}

const commit = { sha: 'abc123def456789', subject: 'round 47: deliberating host', epoch: 1780000000 };

test('reviewBallotFor is deterministic and keyed by the commit sha', () => {
  const a = reviewBallotFor(commit);
  const b = reviewBallotFor(commit);
  assert.deepEqual(a, b); // pure: same commit -> identical id and ballot
  assert.match(a.id, /abc123def456/); // id encodes the short sha (reproducible, public)
  assert.deepEqual(a.ballot.verdicts, ['SOUND', 'REVISE', 'INADEQUATE']);
  assert.match(a.ballot.context ?? '', /git show abc123def456789/); // points validators at the diff
});

test('reviewBallotFor ids sort oldest-commit-first (epoch prefix)', () => {
  const older = reviewBallotFor({ sha: 'zzz', subject: 'older', epoch: 1000 });
  const newer = reviewBallotFor({ sha: 'aaa', subject: 'newer', epoch: 2000 });
  assert.ok(older.id < newer.id, 'epoch prefix orders by commit time, not sha');
});

test('sourceSelfReview enqueues a review of an unreviewed commit and returns its id', () => {
  const q = tmpQueue();
  const id = sourceSelfReview({ queueDir: q, head: commit });
  assert.equal(id, reviewBallotFor(commit).id);
  const pending = listPending(q);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, id);
});

test('sourceSelfReview is idempotent: a commit already reviewed is NOT re-enqueued (no flooding)', () => {
  const q = tmpQueue();
  const id = sourceSelfReview({ queueDir: q, head: commit })!;
  complete(q, id, { ratified: true, verdict: 'SOUND' }); // the review was decided
  const again = sourceSelfReview({ queueDir: q, head: commit });
  assert.equal(again, null); // same commit -> nothing new
  assert.equal(listPending(q).length, 0); // not re-listed, not re-convened
});
