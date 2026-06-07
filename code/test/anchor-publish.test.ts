// Quorumchain ($QRM) — CIP-17 publish-time anchoring hook. Always writes the Layer-B
// record; submits to Solana when configured; on Solana/RPC outage DEGRADES to Layer-B-only
// and continues — anchoring MUST NEVER block publishing (NI-17a / §7.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendVote, readLog } from '../src/vote-log.ts';
import { generateValidatorKey, ballotHash, signVote } from '../src/signed-vote.ts';
import { readAnchors } from '../src/anchor-record.ts';
import { buildCommitment, parseCommitment, type SolanaRpc } from '../src/solana-anchor.ts';
import { anchorTipAtPublish } from '../src/anchor-publish.ts';

function tmp(name: string): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-ap-')), name);
}
function buildLog(n: number): { path: string; tip: string } {
  const path = tmp('votes.log');
  let tip = '';
  for (let i = 0; i < n; i++) {
    const k = generateValidatorKey();
    const e = appendVote(path, signVote({ validatorId: 'V' + ((i % 3) + 1), privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('q', String(i)), verdict: 'YES', rawOutput: 'r' }));
    tip = e.entryHash;
  }
  return { path, tip };
}

test('with no RPC configured, anchoring writes a Layer-B-only (degraded) record and does not throw', async () => {
  const { path: logPath, tip } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  const res = await anchorTipAtPublish({ logPath, anchorPath, rpc: null, now: 1000 });
  assert.equal(res.degraded, true);
  const anchors = readAnchors(anchorPath);
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].record.tipHash, tip);
  assert.equal(anchors[0].record.solanaTxSig, null);
  assert.equal(anchors[0].record.cluster, null);
});

test('with a working RPC, anchoring submits the memo and records the Solana witness', async () => {
  const { path: logPath, tip } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  const sent: string[] = [];
  const rpc: SolanaRpc = {
    cluster: 'mainnet-beta',
    async sendMemo(memo) { sent.push(memo); return { signature: 'sigZ', slot: 123 }; },
    async getMemo() { return null; },
  };
  const res = await anchorTipAtPublish({ logPath, anchorPath, rpc, now: 2000 });
  assert.equal(res.degraded, false);
  const a = readAnchors(anchorPath)[0].record;
  assert.equal(a.solanaTxSig, 'sigZ');
  assert.equal(a.slot, 123);
  assert.equal(a.cluster, 'mainnet-beta');
  // the submitted memo committed exactly this tip + the assigned seq
  const parsed = parseCommitment(sent[0]);
  assert.equal(parsed?.tipHash, tip);
  assert.equal(parsed?.anchorSeq, 0);
});

test('on Solana outage, anchoring DEGRADES to Layer-B-only and never throws (NI-17a)', async () => {
  const { path: logPath, tip } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  const rpc: SolanaRpc = {
    cluster: 'mainnet-beta',
    async sendMemo() { throw new Error('RPC 503'); },
    async getMemo() { throw new Error('RPC 503'); },
  };
  const res = await anchorTipAtPublish({ logPath, anchorPath, rpc, now: 3000 });
  assert.equal(res.degraded, true);
  assert.match(res.note ?? '', /degrad|outage|RPC|Layer-B-only/i);
  const a = readAnchors(anchorPath)[0].record;
  assert.equal(a.tipHash, tip); // Layer-B still written
  assert.equal(a.solanaTxSig, null); // but no witness
});

test('anchoring an empty log is a no-op (nothing to commit)', async () => {
  const logPath = tmp('votes.log');
  const anchorPath = tmp('anchors.jsonl');
  const res = await anchorTipAtPublish({ logPath, anchorPath, rpc: null, now: 1 });
  assert.equal(res.skipped, true);
  assert.equal(readAnchors(anchorPath).length, 0);
});

test('anchoring is idempotent for an unchanged tip (no duplicate Layer-B entry)', async () => {
  const { path: logPath } = buildLog(3);
  const anchorPath = tmp('anchors.jsonl');
  await anchorTipAtPublish({ logPath, anchorPath, rpc: null, now: 1 });
  const second = await anchorTipAtPublish({ logPath, anchorPath, rpc: null, now: 2 });
  assert.equal(second.skipped, true);
  assert.equal(readAnchors(anchorPath).length, 1);
});

test('a new tip after more votes appends a fresh Layer-B entry', async () => {
  const path = tmp('votes.log');
  const anchorPath = tmp('anchors.jsonl');
  const k1 = generateValidatorKey();
  appendVote(path, signVote({ validatorId: 'V1', privateKeyPem: k1.privateKeyPem, ballotHash: ballotHash('q', '1'), verdict: 'YES', rawOutput: 'r' }));
  await anchorTipAtPublish({ logPath: path, anchorPath, rpc: null, now: 1 });
  const k2 = generateValidatorKey();
  appendVote(path, signVote({ validatorId: 'V2', privateKeyPem: k2.privateKeyPem, ballotHash: ballotHash('q', '2'), verdict: 'YES', rawOutput: 'r' }));
  await anchorTipAtPublish({ logPath: path, anchorPath, rpc: null, now: 2 });
  const anchors = readAnchors(anchorPath);
  assert.equal(anchors.length, 2);
  assert.equal(anchors[1].record.anchorSeq, 1);
  assert.equal(anchors[1].record.tipHash, readLog(path)[1].entryHash);
});
