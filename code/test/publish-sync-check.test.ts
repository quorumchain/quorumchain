import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPublishSync } from '../src/publish-sync-check.ts';
import { appendVote, readLog } from '../src/vote-log.ts';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendAnchor, readAnchors } from '../src/anchor-record.ts';

const k = generateValidatorKey();

function seedLog(n: number): { entries: ReturnType<typeof readLog>; text: string; head: string } {
  const path = join(mkdtempSync(join(tmpdir(), 'qrm-sync-')), 'votes.log');
  for (let i = 0; i < n; i++) {
    appendVote(path, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash(`q${i}`, 'c'), verdict: 'YES', rawOutput: `V1:YES:${i}` }));
  }
  const entries = readLog(path);
  return { entries, text: readFileSync(path, 'utf8'), head: entries[entries.length - 1].entryHash };
}

function anchorsFor(tip: string): ReturnType<typeof readAnchors> {
  const path = join(mkdtempSync(join(tmpdir(), 'qrm-anc-')), 'anchors.jsonl');
  appendAnchor(path, { tipHash: tip, asOf: 1, solanaTxSig: null, slot: null, cluster: null });
  return readAnchors(path);
}

test('in-sync: head==anchor and committed==working → ok, no warnings', () => {
  const log = seedLog(3);
  const r = checkPublishSync({ workingEntries: log.entries, anchors: anchorsFor(log.head), workingLogText: log.text, committedLogText: log.text });
  assert.equal(r.ok, true);
  assert.equal(r.headAnchorMismatch, false);
  assert.equal(r.committedDrift, false);
  assert.deepEqual(r.warnings, []);
});

test('head!=anchor: a stale anchor (commits an older tip) is flagged', () => {
  const log = seedLog(3);
  const stale = seedLog(2); // a different, shorter chain's tip
  const r = checkPublishSync({ workingEntries: log.entries, anchors: anchorsFor(stale.head), workingLogText: log.text, committedLogText: log.text });
  assert.equal(r.headAnchorMismatch, true);
  assert.equal(r.ok, false);
  assert.match(r.warnings.join('\n'), /head!=anchor/);
});

test('head!=anchor: a non-empty chain with no anchors at all is flagged', () => {
  const log = seedLog(2);
  const r = checkPublishSync({ workingEntries: log.entries, anchors: [], workingLogText: log.text, committedLogText: log.text });
  assert.equal(r.headAnchorMismatch, true);
  assert.match(r.warnings.join('\n'), /no Layer-B anchor yet/);
});

test('committed-drift: a forgotten git add (committed differs from working) is flagged', () => {
  const log = seedLog(3);
  const older = seedLog(2); // simulate the committed blob lagging the working log
  const r = checkPublishSync({ workingEntries: log.entries, anchors: anchorsFor(log.head), workingLogText: log.text, committedLogText: older.text });
  assert.equal(r.committedDrift, true);
  assert.equal(r.ok, false);
  assert.match(r.warnings.join('\n'), /git add -f code\/data\/votes\.log/);
});

test('committed-drift: an untracked votes.log (null committed blob) is flagged', () => {
  const log = seedLog(1);
  const r = checkPublishSync({ workingEntries: log.entries, anchors: anchorsFor(log.head), workingLogText: log.text, committedLogText: null });
  assert.equal(r.committedDrift, true);
  assert.match(r.warnings.join('\n'), /not tracked at git HEAD/);
});

test('empty chain: nothing to anchor → no head!=anchor warning', () => {
  const r = checkPublishSync({ workingEntries: [], anchors: [], workingLogText: '', committedLogText: '' });
  assert.equal(r.headAnchorMismatch, false);
  assert.equal(r.ok, true);
});
