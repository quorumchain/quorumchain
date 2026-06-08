// Quorumchain ($QRM) — CIP-17 Layer-A (Solana adapter) tests.
//
// solana-anchor.ts is the SOLE @solana/web3.js surface. These tests are deterministic
// (mock/recorded-fixture) so CI needs no live network. One optional live-devnet round-trip
// at the bottom SKIPS cleanly if QRM_SOLANA_LIVE is unset or the airdrop/RPC is unavailable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEMO_PROGRAM_ID,
  MAINNET_BETA_GENESIS,
  buildCommitment,
  parseCommitment,
  clusterEndpoint,
  isAnchorOfRecord,
  newAnchoringKeypair,
  anchoringKeypairFromSecret,
  submitMemo,
  fetchMemo,
  assertClusterIdentity,
  type SolanaRpc,
  type GenesisSeam,
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

test('MAINNET_BETA_GENESIS is the canonical mainnet-beta genesis hash (NI-17b cryptographic identity)', () => {
  // Confirmed by a single read-only getGenesisHash() against api.mainnet-beta.solana.com.
  assert.equal(MAINNET_BETA_GENESIS, '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d');
});

// assertClusterIdentity: for a mainnet-beta logical cluster the endpoint's REAL genesis hash
// must match MAINNET_BETA_GENESIS, else the connection is refused (a devnet/hostile override
// URL labelled mainnet-beta cannot masquerade as the anchor of record). Non-mainnet clusters
// are not gated. The genesis is fetched at most ONCE (cached per seam instance). No network:
// the genesis fetch is injected.
function genesisSeam(genesis: string): GenesisSeam & { calls: number } {
  let calls = 0;
  return {
    get calls() { return calls; },
    async getGenesisHash() { calls++; return genesis; },
  };
}

test('assertClusterIdentity: mainnet-beta label + matching genesis passes', async () => {
  const seam = genesisSeam(MAINNET_BETA_GENESIS);
  await assertClusterIdentity('mainnet-beta', seam); // resolves
  assert.equal(seam.calls, 1);
});

test('assertClusterIdentity: mainnet-beta label + MISMATCHED genesis throws (devnet/hostile override)', async () => {
  const seam = genesisSeam('DEVNETgenesisHashNotMainnet1111111111111111');
  await assert.rejects(() => assertClusterIdentity('mainnet-beta', seam), /genesis|mainnet-beta|identity/i);
});

test('assertClusterIdentity: a non-mainnet cluster is not genesis-gated and never fetches', async () => {
  const seam = genesisSeam('whatever');
  await assertClusterIdentity('devnet', seam); // resolves, no gate
  assert.equal(seam.calls, 0, 'devnet does not trigger a genesis fetch');
});

test('assertClusterIdentity: the genesis hash is fetched at most once (cached) across repeated asserts', async () => {
  const seam = genesisSeam(MAINNET_BETA_GENESIS);
  await assertClusterIdentity('mainnet-beta', seam);
  await assertClusterIdentity('mainnet-beta', seam);
  await assertClusterIdentity('mainnet-beta', seam);
  assert.equal(seam.calls, 1, 'genesis fetched once, then served from cache');
});

test('assertClusterIdentity: a REJECTED genesis fetch is evicted, so a later assert re-fetches and can succeed', async () => {
  // First getGenesisHash() rejects (transient RPC error); the second resolves to the matching
  // mainnet genesis. The rejected promise must NOT be cached: the first assert rejects, but a
  // subsequent assert against the SAME seam must re-fetch and SUCCEED.
  let calls = 0;
  const seam: GenesisSeam = {
    async getGenesisHash() {
      calls++;
      if (calls === 1) throw new Error('transient RPC error');
      return MAINNET_BETA_GENESIS;
    },
  };
  await assert.rejects(() => assertClusterIdentity('mainnet-beta', seam), /transient RPC error/);
  await assertClusterIdentity('mainnet-beta', seam); // re-fetch (eviction) then succeed
  assert.equal(calls, 2, 'rejected promise evicted, so the second assert re-fetched');
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
