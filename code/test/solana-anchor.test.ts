// Quorumchain ($QRM) — CIP-17 Layer-A (Solana adapter) tests.
//
// solana-anchor.ts is the SOLE @solana/web3.js surface. These tests are deterministic
// (mock/recorded-fixture) so CI needs no live network. One optional live-devnet round-trip
// at the bottom SKIPS cleanly if QRM_SOLANA_LIVE is unset or the airdrop/RPC is unavailable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMO_PROGRAM_ID,
  buildCommitment,
  parseCommitment,
  clusterEndpoint,
  isAnchorOfRecord,
  newAnchoringKeypair,
  anchoringKeypairFromSecret,
  submitMemo,
  fetchMemo,
  type SolanaRpc,
} from '../src/solana-anchor.ts';

const TIP = 'a'.repeat(64);

test('buildCommitment/parseCommitment round-trips the tip + seq', () => {
  const memo = buildCommitment({ anchorSeq: 7, tipHash: TIP });
  const parsed = parseCommitment(memo);
  assert.equal(parsed.anchorSeq, 7);
  assert.equal(parsed.tipHash, TIP);
});

test('parseCommitment rejects a memo that is not a QRM anchor commitment', () => {
  assert.equal(parseCommitment('hello world'), null);
  assert.equal(parseCommitment(JSON.stringify({ foo: 1 })), null);
});

test('the Memo program id is the canonical SPL Memo program', () => {
  assert.equal(MEMO_PROGRAM_ID, 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
});

test('clusterEndpoint maps mainnet-beta and devnet to distinct RPC URLs', () => {
  assert.notEqual(clusterEndpoint('mainnet-beta'), clusterEndpoint('devnet'));
  assert.match(clusterEndpoint('mainnet-beta'), /mainnet/);
  assert.match(clusterEndpoint('devnet'), /devnet/);
});

test('isAnchorOfRecord: only a confirmed mainnet-beta witness counts (NI-17b)', () => {
  assert.equal(isAnchorOfRecord('mainnet-beta'), true);
  assert.equal(isAnchorOfRecord('devnet'), false);
  assert.equal(isAnchorOfRecord('testnet'), false);
  assert.equal(isAnchorOfRecord(null), false);
});

test('the anchoring keypair is a Solana key, NOT a validator Ed25519 PEM (§2.5 key separation)', () => {
  const kp = newAnchoringKeypair();
  // Solana secret is a 64-byte Uint8Array — structurally distinct from a PEM private key.
  assert.equal(kp.secretKey.length, 64);
  const serialized = JSON.stringify(Array.from(kp.secretKey));
  assert.ok(!serialized.includes('PRIVATE KEY'), 'must not be a PEM key');
  // and it round-trips from its byte secret (how the gitignored devnet key is stored)
  const restored = anchoringKeypairFromSecret(Array.from(kp.secretKey));
  assert.equal(restored.publicKey.toBase58(), kp.publicKey.toBase58());
});

test('submitMemo writes a memo via the injected RPC and returns the signature + slot', async () => {
  const sent: { memo: string }[] = [];
  const mock: SolanaRpc = {
    cluster: 'devnet',
    async sendMemo(memo) { sent.push({ memo }); return { signature: 'mockSig', slot: 99 }; },
    async getMemo() { return null; },
  };
  const memo = buildCommitment({ anchorSeq: 1, tipHash: TIP });
  const res = await submitMemo(mock, memo);
  assert.equal(res.signature, 'mockSig');
  assert.equal(res.slot, 99);
  assert.equal(res.cluster, 'devnet');
  assert.equal(sent[0].memo, memo);
});

test('fetchMemo returns the memo string a confirmed tx carried (recorded fixture)', async () => {
  const memo = buildCommitment({ anchorSeq: 2, tipHash: TIP });
  const mock: SolanaRpc = {
    cluster: 'devnet',
    async sendMemo() { return { signature: 's', slot: 1 }; },
    async getMemo(sig) { return sig === 'sig2' ? { memo, slot: 1, cluster: 'devnet' } : null; },
  };
  const got = await fetchMemo(mock, 'sig2');
  assert.equal(got?.memo, memo);
  assert.equal(parseCommitment(got!.memo)?.anchorSeq, 2);
  assert.equal(await fetchMemo(mock, 'absent'), null);
});

// --- Optional live-devnet round-trip (skips cleanly when not explicitly enabled) ---
test('live devnet memo round-trip', { skip: !process.env.QRM_SOLANA_LIVE }, async () => {
  const { liveDevnetRpc } = await import('../src/solana-anchor.ts');
  let rpc;
  try {
    rpc = await liveDevnetRpc(); // funds an ephemeral key via airdrop
  } catch (e) {
    // airdrop / RPC unavailable — skip rather than fail (deterministic CI is the contract)
    return;
  }
  const memo = buildCommitment({ anchorSeq: 0, tipHash: TIP });
  const res = await submitMemo(rpc, memo);
  assert.ok(res.signature);
  const got = await fetchMemo(rpc, res.signature);
  assert.equal(got?.memo, memo);
});
