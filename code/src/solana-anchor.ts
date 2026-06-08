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
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import type { SolanaCluster } from './anchor-record.ts';

/** Canonical SPL Memo program id (CIP-17 §2.1). */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

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
}

/** Submit a memo commitment to Solana and return the witness coordinates. */
export async function submitMemo(rpc: SolanaRpc, memo: string): Promise<SubmitResult> {
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
 *  unchanged. Sends are wrapped in a bounded retry/backoff; each attempt rebuilds the
 *  transaction so sendAndConfirmTransaction fetches a FRESH blockhash (the usual transient). */
export function web3Rpc(cluster: SolanaCluster, payer: Keypair, overrideUrl?: string): SolanaRpc {
  const connection = new Connection(clusterEndpoint(cluster, overrideUrl), 'finalized');
  return {
    cluster,
    async sendMemo(memo: string) {
      const signature = await withRetry(async () => {
        // rebuild per attempt -> fresh blockhash fetched by sendAndConfirmTransaction
        const tx = new Transaction().add(memoInstruction(memo, payer.publicKey));
        return sendAndConfirmTransaction(connection, tx, [payer], { commitment: 'finalized' });
      }, SEND_RETRY);
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
