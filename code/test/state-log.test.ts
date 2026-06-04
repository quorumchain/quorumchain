// Tamper-evident state log — the local interim step toward CIP-3/CIP-4 on-chain
// state (round-44 backlog #6). Module state transitions (a bond created/settled, a
// node admitted, a validator rotated) are appended into ONE SHA-256 hash chain, so
// the history is replayable and any edit/deletion/reorder breaks verification —
// the same guarantee vote-log gives votes, until on-chain anchoring lands.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendState, readStateLog, verifyStateLog, type StateEvent } from '../src/state-log.ts';

function tmp(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-state-')), 'state.log');
}

const ev = (module: string, type: string, ref: string, payload: Record<string, unknown> = {}): Omit<StateEvent, 'prevHash' | 'entryHash'> => ({
  module, type, ref, payload, timestamp: '2026-06-04T12:00:00Z',
});

test('appended state transitions are hash-chained and verify as a valid history', () => {
  const path = tmp();
  appendState(path, ev('bond', 'CREATE', 'a79e…', { stake: 1000 }));
  appendState(path, ev('registry', 'ADMIT', 'corpus-E', { operator: 'E' }));
  appendState(path, ev('bond', 'SETTLE', 'a79e…', { status: 'SLASHED', slashed: 1000 }));
  const log = readStateLog(path);
  assert.equal(log.length, 3);
  assert.equal(log[0].module, 'bond');
  assert.equal(log[2].payload.status, 'SLASHED');
  assert.equal(verifyStateLog(path).valid, true);
});

test('an empty/absent state log verifies as valid with no entries', () => {
  assert.deepEqual(verifyStateLog(tmp()), { valid: true });
  assert.deepEqual(readStateLog(tmp()), []);
});

test('editing a past state event breaks the chain (tamper-evidence)', () => {
  const path = tmp();
  appendState(path, ev('bond', 'CREATE', 'a79e…', { stake: 1000 }));
  appendState(path, ev('bond', 'SETTLE', 'a79e…', { status: 'SLASHED', slashed: 1000 }));
  // rewrite the first entry's payload to pretend a smaller stake was bonded
  const lines = readStateLog(path);
  lines[0].payload = { stake: 1 };
  writeFileSync(path, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
  const v = verifyStateLog(path);
  assert.equal(v.valid, false);
  assert.equal(v.brokenAt, 0);
});
