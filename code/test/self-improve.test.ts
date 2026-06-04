import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateOf, exitCodeFor, gateForBallot } from '../src/self-improve.ts';
import type { Feed } from '../src/feed.ts';

function feed(chainValid: boolean, convenings: { ballotHash: string; ratified: boolean; verdict: string | null }[]): Feed {
  return { chainValid, entryCount: convenings.length * 3, convenings: convenings.map((c) => ({ ...c, required: 2, tally: {}, votes: [] })) };
}

// The self-improvement gate (Phase 1.3): a change is APPROVED only on a ratified SOUND.
// Every other outcome blocks it, classified by why — so "nothing merges without 2/3 SOUND"
// is a mechanical decision, not a human reading the tally.
test('a ratified SOUND is APPROVED', () => {
  assert.equal(gateOf({ ratified: true, verdict: 'SOUND' }), 'APPROVED');
});

test('a ratified REVISE is CHANGES_REQUESTED', () => {
  assert.equal(gateOf({ ratified: true, verdict: 'REVISE' }), 'CHANGES_REQUESTED');
});

test('a ratified INADEQUATE is REJECTED', () => {
  assert.equal(gateOf({ ratified: true, verdict: 'INADEQUATE' }), 'REJECTED');
});

test('a non-ratified outcome (no 2/3, or a liveness failure) is INCONCLUSIVE — never an approval', () => {
  assert.equal(gateOf({ ratified: false, verdict: null }), 'INCONCLUSIVE');
});

// Round-54 V1 finding: the gate must be ACTIONABLE — a scheduler/CI step needs a
// non-zero exit code on any non-APPROVED outcome, not just a printed label.
test('exitCodeFor is 0 only for APPROVED, non-zero otherwise', () => {
  assert.equal(exitCodeFor('APPROVED'), 0);
  assert.notEqual(exitCodeFor('CHANGES_REQUESTED'), 0);
  assert.notEqual(exitCodeFor('REJECTED'), 0);
  assert.notEqual(exitCodeFor('INCONCLUSIVE'), 0);
});

// Round-54 V2 finding: the gate must be anchored to the RECOMPUTED log-derived outcome
// (the feed), never a mutable stored record — and a tampered chain can never approve.
test('gateForBallot approves only a ratified SOUND convening on a valid chain', () => {
  const bh = 'abc';
  assert.equal(gateForBallot(feed(true, [{ ballotHash: bh, ratified: true, verdict: 'SOUND' }]), bh), 'APPROVED');
});

test('gateForBallot blocks (INCONCLUSIVE) when the chain is invalid, even with a ratified SOUND', () => {
  const bh = 'abc';
  assert.equal(gateForBallot(feed(false, [{ ballotHash: bh, ratified: true, verdict: 'SOUND' }]), bh), 'INCONCLUSIVE');
});

test('gateForBallot is INCONCLUSIVE when the ballot is not in the feed (not yet convened)', () => {
  assert.equal(gateForBallot(feed(true, [{ ballotHash: 'other', ratified: true, verdict: 'SOUND' }]), 'abc'), 'INCONCLUSIVE');
});

test('gateForBallot classifies a ratified REVISE as CHANGES_REQUESTED', () => {
  const bh = 'abc';
  assert.equal(gateForBallot(feed(true, [{ ballotHash: bh, ratified: true, verdict: 'REVISE' }]), bh), 'CHANGES_REQUESTED');
});

test('only APPROVED clears the gate', () => {
  assert.equal(gateOf({ ratified: true, verdict: 'SOUND' }) === 'APPROVED', true);
  for (const g of [
    gateOf({ ratified: true, verdict: 'REVISE' }),
    gateOf({ ratified: true, verdict: 'INADEQUATE' }),
    gateOf({ ratified: false, verdict: null }),
  ]) {
    assert.notEqual(g, 'APPROVED');
  }
});
