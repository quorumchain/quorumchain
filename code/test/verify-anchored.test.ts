// Quorumchain ($QRM) — CIP-17 verify-anchored: the standalone outsider verifier.
// Covers §7 tests 1 (tip binding), 2 (NI-17c rewrite-detectability), 3 (NI-17d honest
// boundary), 4 (NI-17a sovereignty/degradation). Deterministic — RPC is mocked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendVote, readLog } from '../src/vote-log.ts';
import { generateValidatorKey, ballotHash, signVote } from '../src/signed-vote.ts';
import { appendAnchor, readAnchors } from '../src/anchor-record.ts';
import { buildCommitment, type SolanaRpc } from '../src/solana-anchor.ts';
import { verifyAnchored } from '../src/verify-anchored.ts';

function tmp(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-va-')), name);
}
function vote(id: string, verdict = 'YES') {
  const k = generateValidatorKey();
  return signVote({ validatorId: id, privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', id), verdict, rawOutput: 'r-' + id });
}
/** Build a log with N votes and return the path + the entryHash at each step (tip after each vote). */
function buildLog(n: number): { path: string; tips: string[] } {
  const path = tmp('votes.log');
  const tips: string[] = [];
  for (let i = 0; i < n; i++) {
    const e = appendVote(path, vote('V' + ((i % 3) + 1)));
    tips.push(e.entryHash);
  }
  return { path, tips };
}
/** An RPC that "witnessed" a set of {signature -> {memo, cluster}} pairs. */
function witnessRpc(witnessed: Record<string, { memo: string; cluster: 'mainnet-beta' | 'devnet' }>): SolanaRpc {
  return {
    cluster: 'mainnet-beta',
    async sendMemo() { return { signature: 'x', slot: 0 }; },
    async getMemo(sig) {
      const w = witnessed[sig];
      return w ? { memo: w.memo, slot: 1, cluster: w.cluster } : null;
    },
  };
}

// §7.1 — Layer-B commitment must bind a REAL Layer-A prefix tip.
test('a Layer-B entry whose tipHash is not a Layer-A prefix tip is rejected (§7.1)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  appendAnchor(anchorPath, { tipHash: 'f'.repeat(64), asOf: 1, solanaTxSig: 'sig0', slot: 1, cluster: 'mainnet-beta' });
  const memo = buildCommitment({ anchorSeq: 0, tipHash: 'f'.repeat(64) });
  const rpc = witnessRpc({ sig0: { memo, cluster: 'mainnet-beta' } });
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  void tips;
  assert.equal(res.ok, false);
  assert.match(res.reasons.join(' '), /tip/i);
});

// §7.2 — NI-17c: the genuine anchored chain verifies; a rewrite before the anchored tip fails.
test('the genuine anchored chain verifies, a rewrite before the anchored tip fails (§7.2 / NI-17c)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  const anchoredTip = tips[2]; // anchor the full 3-vote chain tip
  appendAnchor(anchorPath, { tipHash: anchoredTip, asOf: 1, solanaTxSig: 'sigA', slot: 5, cluster: 'mainnet-beta' });
  const memo = buildCommitment({ anchorSeq: 0, tipHash: anchoredTip });
  const rpc = witnessRpc({ sigA: { memo, cluster: 'mainnet-beta' } });

  // genuine chain: verifies
  const good = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  assert.equal(good.ok, true, good.reasons.join('; '));
  assert.ok(good.anchoredTip);

  // rewrite: a divergent log (different votes) whose tip differs from the witnessed commitment
  const { path: forkPath } = buildLog(3); // independent log -> different entryHashes
  const bad = await verifyAnchored(readLog(forkPath), readAnchors(anchorPath), rpc);
  assert.equal(bad.ok, false);
});

// §7.3 — NI-17d: a rewrite confined to the UNANCHORED suffix is not claimed detectable.
test('a rewrite in the unanchored suffix is reported as outside the anchored boundary (§7.3 / NI-17d)', async () => {
  const { path: logPath, tips } = buildLog(5);
  const anchorPath = tmp('anchors.jsonl');
  const anchoredTip = tips[2]; // anchor only the first 3 votes; votes 4-5 are the unanchored suffix
  appendAnchor(anchorPath, { tipHash: anchoredTip, asOf: 1, solanaTxSig: 'sigB', slot: 7, cluster: 'mainnet-beta' });
  const memo = buildCommitment({ anchorSeq: 0, tipHash: anchoredTip });
  const rpc = witnessRpc({ sigB: { memo, cluster: 'mainnet-beta' } });
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  assert.equal(res.ok, true);
  // the anchored coverage stops at vote 3; the suffix (votes 4-5) is honestly unprotected
  assert.equal(res.anchoredThroughIndex, 2);
  assert.equal(res.unanchoredSuffixLength, 2);
  assert.match(res.boundaryNote ?? '', /unanchored|suffix|not.*witnessed/i);
});

// §7.4 — NI-17a: with Layer C unreachable, Layer A still verifies; coverage = up to last confirmed anchor.
test('with Solana unreachable, verifyAnchored reports Layer-A validity + coverage up to last anchor (§7.4 / NI-17a)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  // a degraded (Layer-B-only) anchor: null Solana fields
  appendAnchor(anchorPath, { tipHash: tips[2], asOf: 1 });
  const offlineRpc: SolanaRpc = {
    cluster: 'mainnet-beta',
    async sendMemo() { throw new Error('network down'); },
    async getMemo() { throw new Error('network down'); },
  };
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), offlineRpc);
  assert.equal(res.layerAValid, true);
  // degraded anchor has no confirmed mainnet-beta witness -> not counted as anchor of record
  assert.equal(res.confirmedAnchorCount, 0);
  assert.match(res.reasons.concat(res.boundaryNote ?? '').join(' '), /degrad|no confirmed|Layer-B-only|unreachable|not.*anchor of record/i);
});

// §7.7 reinforcement at the verifier: a devnet witness is NOT an anchor of record.
test('a devnet witness does not count as an anchor of record (§7.7 / NI-17b)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  appendAnchor(anchorPath, { tipHash: tips[2], asOf: 1, solanaTxSig: 'sigD', slot: 9, cluster: 'devnet' });
  const memo = buildCommitment({ anchorSeq: 0, tipHash: tips[2] });
  const rpc = witnessRpc({ sigD: { memo, cluster: 'devnet' } });
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  assert.equal(res.confirmedAnchorCount, 0); // devnet never counts
});

// NI-17b cryptographic identity (Codex follow-up #1): if the read-only RPC's endpoint genesis
// hash does NOT match mainnet-beta (a devnet/hostile override labelled mainnet-beta), none of
// its memos may count as confirmed anchors of record. The verifier must NOT crash; it reports
// honestly (a clear reason) and confirmedAnchorCount stays 0. ok stays true (this is a degraded
// witness, not a tamper) — mirroring the NI-17a degraded-coverage stance.
test('a mainnet-beta-labelled RPC whose genesis is NOT mainnet-beta confirms NOTHING (NI-17b identity)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  appendAnchor(anchorPath, { tipHash: tips[2], asOf: 1, solanaTxSig: 'sigG', slot: 3, cluster: 'mainnet-beta' });
  const memo = buildCommitment({ anchorSeq: 0, tipHash: tips[2] });
  const rpc: SolanaRpc = {
    ...witnessRpc({ sigG: { memo, cluster: 'mainnet-beta' } }),
    async assertClusterIdentity() { throw new Error('endpoint genesis != mainnet-beta genesis (NI-17b identity check failed)'); },
  };
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  assert.equal(res.confirmedAnchorCount, 0, 'a non-mainnet endpoint witness is never an anchor of record');
  assert.equal(res.anchoredTip, null);
  assert.equal(res.ok, true, 'a failed identity check is a degraded witness, not a tamper');
  assert.match(res.reasons.join(' '), /genesis|identity|not.*mainnet-beta/i);
});

// a matching genesis (identity OK) confirms the witness exactly as before — and the genesis is
// asserted at most once per verify run (cached), not per anchor.
test('a mainnet-beta RPC with a matching genesis confirms normally, asserting identity once (cached)', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  appendAnchor(anchorPath, { tipHash: tips[1], asOf: 1, solanaTxSig: 'sigH1', slot: 4, cluster: 'mainnet-beta' });
  appendAnchor(anchorPath, { tipHash: tips[2], asOf: 2, solanaTxSig: 'sigH2', slot: 5, cluster: 'mainnet-beta' });
  let idCalls = 0;
  const rpc: SolanaRpc = {
    ...witnessRpc({
      sigH1: { memo: buildCommitment({ anchorSeq: 0, tipHash: tips[1] }), cluster: 'mainnet-beta' },
      sigH2: { memo: buildCommitment({ anchorSeq: 1, tipHash: tips[2] }), cluster: 'mainnet-beta' },
    }),
    async assertClusterIdentity() { idCalls++; },
  };
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), rpc);
  assert.equal(res.confirmedAnchorCount, 2);
  assert.equal(res.ok, true, res.reasons.join('; '));
  assert.equal(idCalls, 1, 'identity asserted once per verify run, not per anchor');
});

// no-RPC (pure offline) path: still validates Layer-A + Layer-B internal consistency
test('offline (no RPC) verification validates Layer-A and Layer-B internal consistency', async () => {
  const { path: logPath, tips } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  appendAnchor(anchorPath, { tipHash: tips[2], asOf: 1, solanaTxSig: 'sigE', slot: 1, cluster: 'mainnet-beta' });
  const res = await verifyAnchored(readLog(logPath), readAnchors(anchorPath), null);
  assert.equal(res.layerAValid, true);
  assert.equal(res.layerBValid, true);
  // without an RPC we cannot confirm the external witness, so it is not counted as confirmed
  assert.equal(res.confirmedAnchorCount, 0);
});
