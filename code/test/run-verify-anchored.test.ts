// Quorumchain ($QRM) — CIP-17 run-verify-anchored CLI (Increment 1 of Solana anchoring).
// The CLI is a thin wrapper over verifyAnchored(): it loads Layer-A (votes.log) and Layer-B
// (anchors.jsonl), runs the verifier offline by default, and exits non-zero ONLY on a real
// tamper/inconsistency (ok=false). These tests drive the offline path deterministically; the
// --online path is exercised manually against mainnet later, never in CI.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendVote } from '../src/vote-log.ts';
import { generateValidatorKey, ballotHash, signVote } from '../src/signed-vote.ts';
import { appendAnchor } from '../src/anchor-record.ts';
import { runVerifyAnchored } from '../src/run-verify-anchored.ts';

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'qrm-rva-'));
}
function vote(id: string, verdict = 'YES') {
  const k = generateValidatorKey();
  return signVote({ validatorId: id, privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', id), verdict, rawOutput: 'r-' + id });
}
/** Build a log of N votes at <dir>/votes.log and return the entryHash tip after each vote. */
function buildLog(dir: string, n: number): string[] {
  const path = join(dir, 'votes.log');
  const tips: string[] = [];
  for (let i = 0; i < n; i++) tips.push(appendVote(path, vote('V' + ((i % 3) + 1))).entryHash);
  return tips;
}

// Offline, valid: a degraded (Layer-B-only) anchor pointing at a real Layer-A tip is honest
// state, not a failure. The CLI must report ok and exit 0.
test('offline valid (degraded Layer-B-only anchor of a real tip) reports ok and exits 0', async () => {
  const dir = tmpDir();
  const tips = buildLog(dir, 3);
  appendAnchor(join(dir, 'anchors.jsonl'), { tipHash: tips[2], asOf: 1 }); // degraded, null Solana fields
  const { report, exitCode } = await runVerifyAnchored({ dataDir: dir, online: false });
  assert.equal(report.ok, true, report.reasons.join('; '));
  assert.equal(report.layerAValid, true);
  assert.equal(report.layerBValid, true);
  assert.equal(report.confirmedAnchorCount, 0); // no RPC + degraded -> nothing counted of record
  assert.equal(exitCode, 0);
});

// Offline tamper: an anchor committing a tipHash that no Layer-A prefix tip produced is a real
// inconsistency (NI-17c violation surface). ok=false -> non-zero exit.
test('offline tamper (anchor tip with no Layer-A pre-image) is flagged and exits non-zero', async () => {
  const dir = tmpDir();
  buildLog(dir, 3);
  appendAnchor(join(dir, 'anchors.jsonl'), { tipHash: 'f'.repeat(64), asOf: 1, solanaTxSig: 'sig0', slot: 1, cluster: 'mainnet-beta' });
  const { report, exitCode } = await runVerifyAnchored({ dataDir: dir, online: false });
  assert.equal(report.ok, false);
  assert.match(report.reasons.join(' '), /tip/i);
  assert.notEqual(exitCode, 0);
});

// Empty data dir (no log, no anchors): the verifier treats empty chains as internally valid;
// the CLI exits 0 (nothing to contradict).
test('empty data dir reports ok and exits 0', async () => {
  const dir = tmpDir();
  const { report, exitCode } = await runVerifyAnchored({ dataDir: dir, online: false });
  assert.equal(report.ok, true);
  assert.equal(report.confirmedAnchorCount, 0);
  assert.equal(exitCode, 0);
});
