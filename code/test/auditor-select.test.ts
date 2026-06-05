// code/test/auditor-select.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAuditor } from '../src/auditor-select.ts';

const sigs = { V3: 'cc', V1: 'aa', V2: 'bb' };

test('selection is deterministic and replay-verifiable', () => {
  const a = selectAuditor('ballotX', sigs);
  const b = selectAuditor('ballotX', sigs);
  assert.equal(a, b);
  assert.ok(['V1', 'V2', 'V3'].includes(a));
});

test('panel order is canonical (sorted): caller key order does not matter', () => {
  const a = selectAuditor('ballotX', { V1: 'aa', V2: 'bb', V3: 'cc' });
  const b = selectAuditor('ballotX', { V3: 'cc', V2: 'bb', V1: 'aa' });
  assert.equal(a, b);
});

test('changing the ballot or any signature changes the seed (and usually the pick)', () => {
  const picks = new Set([
    selectAuditor('b1', sigs), selectAuditor('b2', sigs), selectAuditor('b3', sigs),
    selectAuditor('b4', sigs), selectAuditor('b5', sigs), selectAuditor('b6', sigs),
  ]);
  assert.ok(picks.size >= 2, 'varying the ballot must reach more than one auditor');
});

test('distribution over many ballots is roughly uniform across the 3 seats', () => {
  const counts: Record<string, number> = { V1: 0, V2: 0, V3: 0 };
  for (let i = 0; i < 300; i++) counts[selectAuditor(`b${i}`, sigs)]++;
  for (const id of ['V1', 'V2', 'V3']) assert.ok(counts[id] > 40, `${id} got ${counts[id]} — far from uniform`);
});

test('throws on an empty panel', () => {
  assert.throws(() => selectAuditor('b', {}));
});
