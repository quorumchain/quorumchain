import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gateOf } from '../src/self-improve.ts';

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
