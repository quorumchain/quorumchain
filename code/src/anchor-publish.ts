// Quorumchain ($QRM) — CIP-17 publish-time anchoring hook.
//
// Wired into publish-feed.ts / publish-commons.ts. On each publish it ALWAYS writes the
// Layer-B commitment for the current Layer-A tip, and submits a Solana memo when an RPC is
// configured. The cardinal rule (NI-17a / §7.4): anchoring NEVER blocks publishing. If the
// Solana submit throws (RPC outage, no key, rate limit, anything), this DEGRADES to a
// Layer-B-only record (null witness) and returns — it never propagates the error.
//
// Idempotence: if the latest Layer-B entry already commits the current tip, anchoring is a
// no-op (we do not append a duplicate). An empty Layer-A log is skipped (nothing to commit).
//
// This module imports only the Layer-B chain (zero-dep) and the Solana adapter's SEAM
// (types + submitMemo), so it carries no direct @solana/web3.js surface.

import { readFileSync, existsSync } from 'node:fs';
import { readLog } from './vote-log.ts';
import { appendAnchor, readAnchors, type SolanaCluster } from './anchor-record.ts';
import { buildCommitment, submitMemo, type SolanaRpc } from './solana-anchor.ts';

export interface AnchorPublishInput {
  logPath: string;
  anchorPath: string;
  rpc: SolanaRpc | null; // null = anchoring disabled / unconfigured -> Layer-B-only
  now: number;
}

export interface AnchorPublishResult {
  skipped: boolean; // nothing to commit (empty log) or tip unchanged (idempotent)
  degraded: boolean; // no confirmed Solana witness (disabled, or outage)
  anchorSeq: number | null;
  tipHash: string | null;
  signature: string | null;
  note: string | null;
}

export async function anchorTipAtPublish(input: AnchorPublishInput): Promise<AnchorPublishResult> {
  const { logPath, anchorPath, rpc, now } = input;
  const log = readLog(logPath);
  if (log.length === 0) {
    return { skipped: true, degraded: true, anchorSeq: null, tipHash: null, signature: null, note: 'empty Layer-A log; nothing to anchor' };
  }
  const tipHash = log[log.length - 1].entryHash;

  // Idempotent: do not re-anchor an unchanged tip.
  const existing = readAnchors(anchorPath);
  const last = existing.length ? existing[existing.length - 1] : null;
  if (last && last.record.tipHash === tipHash) {
    return { skipped: true, degraded: last.record.solanaTxSig === null, anchorSeq: last.record.anchorSeq, tipHash, signature: last.record.solanaTxSig, note: 'tip unchanged since last anchor' };
  }

  const anchorSeq = last ? last.record.anchorSeq + 1 : 0;

  // Try the external witness, but NEVER let a failure block the Layer-B write / publish.
  let signature: string | null = null;
  let slot: number | null = null;
  let cluster = null as SolanaRpc['cluster'] | null;
  let note: string | null = null;
  if (rpc) {
    try {
      const memo = buildCommitment({ anchorSeq, tipHash });
      const res = await submitMemo(rpc, memo);
      signature = res.signature;
      slot = res.slot;
      cluster = res.cluster;
    } catch (e) {
      note = `Solana submit failed (${(e as Error).message}); degraded to Layer-B-only (NI-17a)`;
    }
  } else {
    note = 'no Solana RPC configured; Layer-B-only';
  }

  const entry = appendAnchor(anchorPath, { tipHash, asOf: now, solanaTxSig: signature, slot, cluster });
  const degraded = signature === null;
  return { skipped: false, degraded, anchorSeq: entry.record.anchorSeq, tipHash, signature, note };
}

/** Build a publish-time RPC from environment config, or null when anchoring is unconfigured
 *  (the default — publishing then degrades to Layer-B-only). Reading the low-privilege
 *  anchoring key is LAZY and guarded: a missing/unparseable key yields null (Layer-B-only),
 *  never a thrown error, so publishing is never gated on key presence (NI-17a).
 *
 *  Env:  QRM_ANCHOR_CLUSTER = mainnet-beta | devnet | testnet   (enables anchoring)
 *        QRM_ANCHOR_KEY     = path to the GITIGNORED keypair JSON (a number[] secret).
 *        QRM_ANCHOR_RPC_URL = optional custom RPC endpoint (transport only; the logical
 *                             cluster — and thus anchor-of-record status — is unchanged).
 *
 *  This is the ONLY place that pulls in @solana/web3.js (via web3Rpc); it is imported lazily
 *  so the zero-dep callers that pass an explicit rpc never load it. */
export async function rpcFromEnv(): Promise<SolanaRpc | null> {
  const cluster = process.env.QRM_ANCHOR_CLUSTER as SolanaCluster | undefined;
  const keyPath = process.env.QRM_ANCHOR_KEY;
  const rpcUrl = process.env.QRM_ANCHOR_RPC_URL;
  if (!cluster || !keyPath) return null;
  if (!existsSync(keyPath)) return null;
  try {
    const secret = JSON.parse(readFileSync(keyPath, 'utf8')) as number[];
    const { web3Rpc, anchoringKeypairFromSecret } = await import('./solana-anchor.ts');
    return web3Rpc(cluster, anchoringKeypairFromSecret(secret), rpcUrl);
  } catch {
    return null; // never block publishing on a key/config problem
  }
}
