import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audit, readAudit } from '../src/audit-log.ts';

test('audit appends typed events that read back in order', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'qrm-au-')), 'audit.jsonl');
  audit(path, 'DECISION', { id: 'x', decision: 'ACCEPT' });
  audit(path, 'PUBLISH', { ok: false, reason: 'rollback' });
  const ev = readAudit(path);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].kind, 'DECISION');
  assert.equal(ev[1].detail.reason, 'rollback');
  assert.match(ev[0].at, /\d{4}-\d{2}-\d{2}T/);
});
