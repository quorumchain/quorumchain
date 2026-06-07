// Quorumchain ($QRM) — CIP-17 Layer-B tip-commitment chain tests.
// Layer B is the in-repo, append-only mirror of what was anchored externally. It
// has ZERO external deps and is the always-available inner layer: anchoring degrades
// gracefully (Solana fields null) but the local commitment chain is still written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendAnchor,
  readAnchors,
  verifyAnchorChain,
  recomputeEntryHash,
  ANCHOR_GENESIS,
} from '../src/anchor-record.ts';

function tmpAnchors(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-anchors-')), 'anchors.jsonl');
}
const TIP_A = 'a'.repeat(64);
const TIP_B = 'b'.repeat(64);

test('first anchor chains from genesis and gets anchorSeq 0', () => {
  const p = tmpAnchors();
  const e = appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  assert.equal(e.record.anchorSeq, 0);
  assert.equal(e.prevAnchorHash, ANCHOR_GENESIS);
  assert.equal(e.record.tipHash, TIP_A);
});

test('a Layer-B-only (degraded) anchor records null Solana fields', () => {
  const p = tmpAnchors();
  const e = appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  assert.equal(e.record.solanaTxSig, null);
  assert.equal(e.record.slot, null);
  assert.equal(e.record.cluster, null);
});

test('a confirmed anchor records the Solana witness fields', () => {
  const p = tmpAnchors();
  const e = appendAnchor(p, {
    tipHash: TIP_A, asOf: 1000,
    solanaTxSig: 'sig123', slot: 42, cluster: 'mainnet-beta',
  });
  assert.equal(e.record.solanaTxSig, 'sig123');
  assert.equal(e.record.slot, 42);
  assert.equal(e.record.cluster, 'mainnet-beta');
});

test('anchorSeq is monotonic and the chain links prev->entry', () => {
  const p = tmpAnchors();
  const a = appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  const b = appendAnchor(p, { tipHash: TIP_B, asOf: 2000 });
  assert.equal(b.record.anchorSeq, 1);
  assert.equal(b.prevAnchorHash, a.entryHash);
  const all = readAnchors(p);
  assert.equal(all.length, 2);
});

test('the anchor chain verifies as intact after several appends', () => {
  const p = tmpAnchors();
  appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  appendAnchor(p, { tipHash: TIP_B, asOf: 2000, solanaTxSig: 's', slot: 1, cluster: 'devnet' });
  assert.equal(verifyAnchorChain(readAnchors(p)).valid, true);
});

test('tampering with a recorded tipHash breaks anchor-chain verification', () => {
  const p = tmpAnchors();
  appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  appendAnchor(p, { tipHash: TIP_B, asOf: 2000 });
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  const e0 = JSON.parse(lines[0]);
  e0.record.tipHash = TIP_B; // rewrite a committed tip
  lines[0] = JSON.stringify(e0);
  writeFileSync(p, lines.join('\n') + '\n');
  const res = verifyAnchorChain(readAnchors(p));
  assert.equal(res.valid, false);
  assert.equal(res.brokenAt, 0);
});

test('removing an anchor entry breaks the chain', () => {
  const p = tmpAnchors();
  appendAnchor(p, { tipHash: TIP_A, asOf: 1000 });
  appendAnchor(p, { tipHash: TIP_B, asOf: 2000 });
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  writeFileSync(p, lines[1] + '\n'); // drop the first; entry 0's prev now dangles
  assert.equal(verifyAnchorChain(readAnchors(p)).valid, false);
});

test('a non-monotonic anchorSeq is rejected even when hashes are recomputed', () => {
  const p = tmpAnchors();
  appendAnchor(p, { tipHash: TIP_A, asOf: 1 });
  appendAnchor(p, { tipHash: TIP_B, asOf: 2 });
  const lines = readFileSync(p, 'utf8').trimEnd().split('\n');
  const obj = JSON.parse(lines[1]);
  obj.record.anchorSeq = 0; // force a duplicate seq
  // recompute the entryHash so the hash check passes and ONLY the seq check can fail
  obj.entryHash = recomputeEntryHash(obj.prevAnchorHash, obj.record);
  lines[1] = JSON.stringify(obj);
  writeFileSync(p, lines.join('\n') + '\n');
  assert.equal(verifyAnchorChain(readAnchors(p)).valid, false);
});

test('an empty/absent anchor chain verifies as valid with no entries', () => {
  const p = tmpAnchors();
  assert.equal(verifyAnchorChain(readAnchors(p)).valid, true);
  assert.equal(readAnchors(p).length, 0);
});
