// Quorumchain ($QRM) — CIP-17 Layer-A: the Solana adapter (Layer C witness surface).
//
// This is the ONLY file in the codebase permitted to import @solana/web3.js. The
// dependency is confined here (CIP-17 §2.3): panel.ts / vote-log.ts / commons.ts /
// anchor.ts (CIP-15) carry no Solana import surface, keeping the substrate swappable
// and the blast radius of a Solana issue contained to this module.
//
// It submits a tip-hash COMMITMENT into the SPL Memo program and fetches/parses a memo
// back from a confirmed transaction. The substrate is cluster-parameterized: devnet is
// used for tests/CI only and NEVER counts as an anchor of record (NI-17b); mainnet-beta
// is the anchor of record. Confirmations use the `finalized` commitment.
//
// Network operations go through the small `SolanaRpc` seam so the rest of the codebase
// (and CI) can drive a deterministic mock; the real implementation (`web3Rpc`) wraps
// @solana/web3.js, and `liveDevnetRpc()` builds a funded ephemeral connection for the
// optional live smoke test.

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  clusterApiUrl,
} from '@solana/web3.js';
import type { SolanaCluster } from './anchor-record.ts';

/** Canonical SPL Memo program id (CIP-17 §2.1). */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** Canonical Solana MAINNET-BETA genesis hash. NI-17b keys anchor-of-record off the LOGICAL
 *  cluster label, but the label is operator-supplied and a custom RPC URL (QRM_ANCHOR_RPC_URL)
 *  can point a `mainnet-beta`-labelled connection at a devnet/private/hostile endpoint. This
 *  constant lets us CRYPTOGRAPHICALLY confirm an endpoint really is mainnet-beta — its genesis
 *  hash is a fixed network identity that a counterfeit endpoint cannot fake — before any send
 *  or verify trusts it as the anchor of record. Strengthens NI-17b; does not redefine it.
 *  Verified by a single read-only getGenesisHash() against api.mainnet-beta.solana.com. */
export const MAINNET_BETA_GENESIS = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d';

const COMMITMENT_TAG = 'QRM-ANCHOR-v1';

export interface Commitment {
  anchorSeq: number;
  tipHash: string;
}

/** The exact memo string committed on-chain: a tagged, canonical JSON of {seq, tip}.
 *  The tag lets a verifier distinguish a QRM anchor memo from any other memo. */
export function buildCommitment(c: Commitment): string {
  return JSON.stringify({ tag: COMMITMENT_TAG, anchorSeq: c.anchorSeq, tipHash: c.tipHash });
}

/** Parse a memo string back into a commitment, or null if it is not a QRM anchor memo. */
export function parseCommitment(memo: string): Commitment | null {
  let obj: unknown;
  try {
    obj = JSON.parse(memo);
  } catch {
    return null;
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  if (o.tag !== COMMITMENT_TAG) return null;
  if (typeof o.anchorSeq !== 'number' || typeof o.tipHash !== 'string') return null;
  return { anchorSeq: o.anchorSeq, tipHash: o.tipHash };
}

/** RPC endpoint for a cluster. Mainnet-beta and devnet are distinct substrates. An optional
 *  overrideUrl (a custom/private RPC endpoint) replaces the public endpoint — this is purely a
 *  TRANSPORT choice and does NOT change the logical cluster or anchor-of-record status (NI-17b
 *  keys off `cluster`, not the URL). An empty/whitespace override falls back to the public URL. */
export function clusterEndpoint(cluster: SolanaCluster, overrideUrl?: string): string {
  if (overrideUrl && overrideUrl.trim() !== '') return overrideUrl;
  return clusterApiUrl(cluster);
}

/** Resolve the RPC URL for a cluster given an optional override (typically QRM_ANCHOR_RPC_URL).
 *  Thin wrapper over clusterEndpoint kept as a named seam so callers/tests read the override
 *  intent explicitly. The override is transport-only; cluster identity is unchanged (NI-17b). */
export function resolveRpcUrl(cluster: SolanaCluster, overrideUrl?: string): string {
  return clusterEndpoint(cluster, overrideUrl);
}

/** NI-17b: ONLY a confirmed mainnet-beta witness counts as an anchor of record. A devnet
 *  (or testnet, or null/degraded) witness never does. */
export function isAnchorOfRecord(cluster: SolanaCluster | null): boolean {
  return cluster === 'mainnet-beta';
}

// --- Cryptographic cluster identity (NI-17b hardening; Codex review follow-up #1) ----------
// isAnchorOfRecord keys off the LOGICAL cluster label, but that label is operator-supplied and
// a custom RPC URL can point a `mainnet-beta`-labelled connection anywhere. assertClusterIdentity
// closes that gap: when the logical cluster is mainnet-beta, the endpoint's REAL genesis hash
// must equal MAINNET_BETA_GENESIS, else the connection is refused. A non-mainnet cluster is not
// gated (devnet/testnet never count as anchors of record regardless). The genesis fetch is done
// AT MOST ONCE per seam instance (cached), so a verify/anchor run pays one getGenesisHash.

/** The minimal surface assertClusterIdentity needs: a read-only genesis-hash fetch. The real
 *  Connection implements this; tests inject a deterministic stub so no network is required. */
export interface GenesisSeam {
  getGenesisHash(): Promise<string>;
}

// Per-seam cache of the in-flight/resolved genesis fetch, so repeated asserts against the same
// connection/seam fetch the genesis only once. WeakMap keys off the seam instance identity.
const genesisCache = new WeakMap<GenesisSeam, Promise<string>>();

/** Assert the endpoint behind `seam` really IS the cluster it claims. For `mainnet-beta` the
 *  endpoint's genesis hash MUST equal MAINNET_BETA_GENESIS; on mismatch this throws (the caller
 *  treats the endpoint as NOT mainnet-beta and refuses to trust it). Non-mainnet clusters are
 *  not gated and trigger no fetch. The genesis is fetched at most once per seam (cached). */
export async function assertClusterIdentity(cluster: SolanaCluster, seam: GenesisSeam): Promise<void> {
  if (cluster !== 'mainnet-beta') return; // only the anchor-of-record cluster is gated
  let pending = genesisCache.get(seam);
  if (!pending) {
    pending = seam.getGenesisHash();
    genesisCache.set(seam, pending);
  }
  const genesis = await pending;
  if (genesis !== MAINNET_BETA_GENESIS) {
    throw new Error(
      `endpoint genesis ${genesis} != mainnet-beta genesis ${MAINNET_BETA_GENESIS} ` +
        `(NI-17b identity check failed: this endpoint is NOT mainnet-beta and cannot be an anchor of record)`,
    );
  }
}

// --- The low-privilege anchoring keypair (§2.5) -----------------------------------
// This is a Solana keypair whose ONLY capability is paying for / signing memo
// submissions. It is NOT a validator key and holds no consensus authority. Structurally
// it is a 64-byte secret (Uint8Array) — not a PEM Ed25519 validator key — so it can never
// be confused with, or used as, a keystore signing key. Its secret is stored as a JSON
// byte array in a GITIGNORED file (see code/.gitignore), exactly like keystore secrets.

export function newAnchoringKeypair(): Keypair {
  return Keypair.generate();
}

export function anchoringKeypairFromSecret(secret: number[]): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(secret));
}

// --- The RPC seam -----------------------------------------------------------------

export interface SubmitResult {
  signature: string;
  slot: number;
  cluster: SolanaCluster;
}
export interface MemoHit {
  memo: string;
  slot: number;
  cluster: SolanaCluster;
}

/** The minimal Solana surface the anchoring path needs. A mock implements this directly
 *  in tests; the real implementation (`web3Rpc`) wraps @solana/web3.js. */
export interface SolanaRpc {
  cluster: SolanaCluster;
  sendMemo(memo: string): Promise<{ signature: string; slot: number }>;
  getMemo(signature: string): Promise<{ memo: string; slot: number; cluster: SolanaCluster } | null>;
  /** NI-17b hardening: assert the endpoint's real genesis matches its claimed cluster before it
   *  is trusted (mainnet-beta only; throws on mismatch). Optional so test mocks may omit it; the
   *  real web3Rpc/readOnlyRpc seams always provide it. Cached so it fetches at most once. */
  assertClusterIdentity?(): Promise<void>;
}

/** Submit a memo commitment to Solana and return the witness coordinates. Before sending, the
 *  endpoint's cluster identity is asserted (NI-17b): a mainnet-beta-labelled endpoint whose real
 *  genesis is NOT mainnet-beta makes this THROW, so the memo is never sent to a counterfeit
 *  endpoint and anchor-publish degrades to Layer-B-only (NI-17a) rather than silently stamping. */
export async function submitMemo(rpc: SolanaRpc, memo: string): Promise<SubmitResult> {
  if (rpc.assertClusterIdentity) await rpc.assertClusterIdentity();
  const { signature, slot } = await rpc.sendMemo(memo);
  return { signature, slot, cluster: rpc.cluster };
}

/** Fetch the memo a confirmed transaction carried, or null if not found / not a memo tx. */
export async function fetchMemo(rpc: SolanaRpc, signature: string): Promise<MemoHit | null> {
  return rpc.getMemo(signature);
}

// --- Bounded retry with exponential backoff ---------------------------------------
// A transient send failure (most commonly a stale/expired blockhash) is retried a bounded
// number of times before the error is allowed to propagate. PURE and network-free: the work
// and the sleep are injected, so it is unit-tested directly. Backoff is baseDelayMs * 2^i.
// Crucially, after `attempts` failures the LAST error is re-thrown — anchor-publish then
// catches it and degrades to Layer-B-only (NI-17a). withRetry never swallows the error.

export interface RetryOpts {
  attempts: number;
  baseDelayMs: number;
  sleep?: (ms: number) => Promise<void>;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts): Promise<T> {
  const sleep = opts.sleep ?? realSleep;
  let lastErr: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < opts.attempts - 1) await sleep(opts.baseDelayMs * 2 ** i);
    }
  }
  throw lastErr;
}

/** Default send retry policy for real anchoring (overridable for the live test). */
const SEND_RETRY: RetryOpts = { attempts: 4, baseDelayMs: 500 };

// --- Send / confirm split (Codex review follow-up #2) -----------------------------
// The earlier shape wrapped send+confirm together in withRetry, rebuilding the tx each
// attempt. If attempt 1's memo LANDED on-chain but its confirmation threw/timed out,
// attempt 2 sent a SECOND identical memo — a duplicate on-chain memo + a wasted fee.
//
// The fix separates SEND from CONFIRM and, before any resend, queries the prior
// signature's status. A confirmation timeout is NOT proof the tx is gone, so we only
// resend when the status query shows the tx is genuinely dropped (blockhash expired /
// not found). If the prior sig is already confirmed we RETURN it (no resend); a still-
// pending sig is treated as not-yet-landed and retried within the bound.
//
// PURE / network-free: the Solana surface is injected as a `MemoSender`, so the dedup
// logic is unit-tested at the seam with a mock and NO network. After `opts.attempts`
// the last error propagates — anchor-publish then degrades to Layer-B-only (NI-17a).

/** Status of a previously-sent signature, as the orchestrator needs to decide resend-vs-return:
 *  'confirmed' = it landed (return it, do NOT resend); 'gone' = dropped/blockhash expired (safe to
 *  resend); 'pending' = inconclusive (treat as not-yet-landed and retry within the bound). */
export type SigStatus = 'confirmed' | 'pending' | 'gone';

/** The minimal lower-level Solana surface the send/confirm orchestrator drives. Splitting send
 *  from confirm is what lets a confirm-timeout query the prior sig instead of blindly resending. */
export interface MemoSender {
  /** Send the memo transaction ONCE with a fresh blockhash; return the sig + its blockhash ctx. */
  send(): Promise<{ signature: string; blockhash: string; lastValidBlockHeight: number }>;
  /** Confirm a sent signature against its blockhash context; throws/rejects on timeout/failure. */
  confirm(signature: string, blockhash: string, lastValidBlockHeight: number): Promise<void>;
  /** Query whether a prior signature landed, is still pending, or is gone (drop/expired). */
  status(signature: string): Promise<SigStatus>;
}

/** Send a memo and confirm it WITHOUT ever sending a duplicate on a confirm-timeout.
 *  Bounded by opts.attempts; injectable sleep keeps tests instant. On the bound being
 *  exhausted the last error is thrown so anchor-publish degrades to Layer-B-only (NI-17a). */
export async function sendConfirmMemo(sender: MemoSender, opts: RetryOpts): Promise<string> {
  const sleep = opts.sleep ?? realSleep;
  let lastErr: unknown;
  for (let i = 0; i < opts.attempts; i++) {
    let sig: string | undefined;
    try {
      const sent = await sender.send();
      sig = sent.signature;
      await sender.confirm(sent.signature, sent.blockhash, sent.lastValidBlockHeight);
      return sent.signature; // confirmed on this attempt
    } catch (e) {
      lastErr = e;
    }
    // Confirm (or send) failed. Before resending, check whether the sig we just submitted
    // actually landed — a confirm timeout does NOT mean the tx is gone. Only query status when
    // a signature actually exists: if send() ITSELF threw, no tx was submitted, so there is
    // nothing to query (querying status(undefined) would be unsound) — fall straight to retry.
    if (sig !== undefined) {
      try {
        const st = await sender.status(sig);
        if (st === 'confirmed') return sig; // it landed; returning it avoids a duplicate send
        // 'gone' (dropped / blockhash expired) and 'pending' both fall through to retry: an
        // expired-blockhash tx is guaranteed dropped, and a pending one is not yet proven landed,
        // so a fresh send (fresh blockhash) is safe and necessary.
      } catch (e) {
        lastErr = e; // status query itself failed; fall through to a bounded retry
      }
    }
    if (i < opts.attempts - 1) await sleep(opts.baseDelayMs * 2 ** i);
  }
  throw lastErr;
}

// --- Real @solana/web3.js-backed RPC ----------------------------------------------

const memoInstruction = (memo: string, payer: PublicKey): TransactionInstruction =>
  new TransactionInstruction({
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    programId: new PublicKey(MEMO_PROGRAM_ID),
    data: Buffer.from(memo, 'utf8'),
  });

/** Build a real RPC over the given cluster, signing memo submissions with the supplied
 *  low-privilege anchoring keypair. Confirmations use `finalized` commitment. An optional
 *  overrideUrl (a custom/private RPC endpoint, e.g. QRM_ANCHOR_RPC_URL) replaces the public
 *  endpoint — transport only; the logical cluster (and thus anchor-of-record status) is
 *  unchanged. SEND and CONFIRM are split (see sendConfirmMemo): a confirm-timeout queries the
 *  prior signature's status before any resend, so a tx that LANDED is never duplicated; only a
 *  genuinely-dropped (expired/not-found) tx is resent with a FRESH blockhash. */
export function web3Rpc(cluster: SolanaCluster, payer: Keypair, overrideUrl?: string): SolanaRpc {
  const connection = new Connection(clusterEndpoint(cluster, overrideUrl), 'finalized');
  // A MemoSender for one specific memo, wrapping the lower-level send/confirm/status calls so
  // sendConfirmMemo can dedup on a confirm-timeout. A fresh sender per submission keeps `send`
  // pure w.r.t. the memo it commits.
  const memoSenderFor = (memo: string): MemoSender => ({
    async send() {
      // one fresh blockhash per send; sign + raw-send so the signature exists BEFORE confirm.
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight })
        .add(memoInstruction(memo, payer.publicKey));
      tx.sign(payer);
      const signature = await connection.sendRawTransaction(tx.serialize());
      return { signature, blockhash, lastValidBlockHeight };
    },
    async confirm(signature, blockhash, lastValidBlockHeight) {
      const res = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'finalized',
      );
      if (res.value.err) throw new Error(`tx failed: ${JSON.stringify(res.value.err)}`);
    },
    async status(signature): Promise<SigStatus> {
      const { value } = await connection.getSignatureStatus(signature, { searchTransactionHistory: true });
      if (!value) return 'gone'; // not found -> dropped / blockhash expired -> safe to resend
      if (value.err) return 'gone'; // failed on-chain -> resend a fresh tx
      const cs = value.confirmationStatus;
      if (cs === 'finalized' || cs === 'confirmed') return 'confirmed';
      return 'pending';
    },
  });
  return {
    cluster,
    // NI-17b hardening: the genesis is read straight off the live connection and cached per seam.
    assertClusterIdentity: () => assertClusterIdentity(cluster, connection),
    async sendMemo(memo: string) {
      const signature = await sendConfirmMemo(memoSenderFor(memo), SEND_RETRY);
      const parsed = await connection.getParsedTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      });
      return { signature, slot: parsed?.slot ?? 0 };
    },
    async getMemo(signature: string) {
      const parsed = await connection.getParsedTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      });
      if (!parsed) return null;
      const memoProgram = MEMO_PROGRAM_ID;
      for (const ix of parsed.transaction.message.instructions as any[]) {
        if (ix.programId?.toBase58?.() === memoProgram && typeof ix.parsed === 'string') {
          return { memo: ix.parsed, slot: parsed.slot, cluster };
        }
        // memo data sometimes surfaces as the raw program log; fall back to that
        if (ix.program === 'spl-memo' && typeof ix.parsed === 'string') {
          return { memo: ix.parsed, slot: parsed.slot, cluster };
        }
      }
      // last resort: scan logs for the memo content
      const log = (parsed.meta?.logMessages ?? []).find((l) => l.includes('Memo'));
      if (log) {
        const m = log.match(/"(.*)"\s*$/);
        if (m) return { memo: m[1], slot: parsed.slot, cluster };
      }
      return null;
    },
  };
}

/** Build a READ-ONLY RPC over the given cluster: it can confirm/parse memos (getMemo) but
 *  cannot send (no payer, so sendMemo throws). This is the verifier's path — confirming an
 *  existing memo needs no key and never spends. getMemo mirrors web3Rpc's parsing exactly. */
export function readOnlyRpc(cluster: SolanaCluster, overrideUrl?: string): SolanaRpc {
  const connection = new Connection(clusterEndpoint(cluster, overrideUrl), 'finalized');
  return {
    cluster,
    // NI-17b hardening: the verifier confirms the endpoint really is mainnet-beta (genesis match)
    // before any of its memos may count as a confirmed anchor of record. Cached per seam.
    assertClusterIdentity: () => assertClusterIdentity(cluster, connection),
    async sendMemo() {
      throw new Error('readOnlyRpc cannot send memos (no payer) — read-only verification only');
    },
    async getMemo(signature: string) {
      const parsed = await connection.getParsedTransaction(signature, {
        commitment: 'finalized',
        maxSupportedTransactionVersion: 0,
      });
      if (!parsed) return null;
      for (const ix of parsed.transaction.message.instructions as any[]) {
        if (ix.programId?.toBase58?.() === MEMO_PROGRAM_ID && typeof ix.parsed === 'string') {
          return { memo: ix.parsed, slot: parsed.slot, cluster };
        }
        if (ix.program === 'spl-memo' && typeof ix.parsed === 'string') {
          return { memo: ix.parsed, slot: parsed.slot, cluster };
        }
      }
      const log = (parsed.meta?.logMessages ?? []).find((l) => l.includes('Memo'));
      if (log) {
        const m = log.match(/"(.*)"\s*$/);
        if (m) return { memo: m[1], slot: parsed.slot, cluster };
      }
      return null;
    },
  };
}

/** Build a live DEVNET RPC with a freshly-funded ephemeral key. Used ONLY by the optional
 *  live smoke test; it throws if the airdrop/RPC is unavailable so the test can skip. */
export async function liveDevnetRpc(): Promise<SolanaRpc> {
  const cluster: SolanaCluster = 'devnet';
  const connection = new Connection(clusterEndpoint(cluster), 'finalized');
  const payer = newAnchoringKeypair();
  const sig = await connection.requestAirdrop(payer.publicKey, 100_000_000); // 0.1 SOL
  await connection.confirmTransaction(sig, 'finalized');
  return web3Rpc(cluster, payer);
}
