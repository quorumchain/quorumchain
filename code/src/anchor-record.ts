// Quorumchain ($QRM) — CIP-17 Layer-B: the in-repo tip-commitment chain.
//
// Layer B (CIP-17 §2.2) is a separate, append-only, hash-chained record that binds
// {anchorSeq, tipHash, solanaTxSig, slot, cluster, asOf} into its OWN chain. It is the
// local, version-controlled mirror of what was anchored externally (Layer C / Solana),
// and it lets a verifier reconstruct the anchor history offline and cross-check it.
//
// This is the inner, ALWAYS-AVAILABLE layer: it has ZERO external dependencies (only
// node:crypto / node:fs) and is written even when Solana is unreachable — in that
// degraded case the Solana witness fields are null (Layer-B-only). Anchoring therefore
// degrades gracefully and NEVER blocks publishing (NI-17a). Like Layer A, Layer B is
// append-only and forward-only: anchoring appends, never rewrites.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const ANCHOR_GENESIS = '0'.repeat(64);

export type SolanaCluster = 'mainnet-beta' | 'devnet' | 'testnet';

/** One Layer-B commitment. The Solana witness fields (txSig/slot/cluster) are null when
 *  anchoring degraded to Layer-B-only (Solana unreachable or disabled). `cluster` records
 *  WHICH substrate witnessed it — only 'mainnet-beta' counts as an anchor of record (NI-17b),
 *  enforced by the verifier, not here. */
export interface AnchorRecord {
  anchorSeq: number; // monotonic, starts at 0
  tipHash: string; // the Layer-A log-head entryHash this anchor commits to
  solanaTxSig: string | null; // Layer-C tx signature, or null if degraded
  slot: number | null; // Solana slot of the confirmed tx, or null
  cluster: SolanaCluster | null; // which Solana cluster witnessed it, or null
  asOf: number; // when the commitment was formed (ms epoch)
}

export interface AnchorEntry {
  record: AnchorRecord;
  prevAnchorHash: string;
  entryHash: string;
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

/** The exact bytes an anchor entry hashes over: prevAnchorHash + canonical record JSON.
 *  Exported so a verifier (and tests) can recompute it independently. */
export function recomputeEntryHash(prevAnchorHash: string, record: AnchorRecord): string {
  return sha256hex(prevAnchorHash + JSON.stringify(record));
}

export function readAnchors(path: string): AnchorEntry[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  if (!txt) return [];
  return txt.split('\n').map((line) => JSON.parse(line) as AnchorEntry);
}

export interface AppendAnchorInput {
  tipHash: string;
  asOf: number;
  solanaTxSig?: string | null;
  slot?: number | null;
  cluster?: SolanaCluster | null;
}

/** Append a new Layer-B commitment, chaining it to the prior anchor. The next anchorSeq is
 *  derived from the chain (one past the last), so seq is monotonic by construction. */
export function appendAnchor(path: string, input: AppendAnchorInput): AnchorEntry {
  const entries = readAnchors(path);
  const last = entries.length ? entries[entries.length - 1] : null;
  const prevAnchorHash = last ? last.entryHash : ANCHOR_GENESIS;
  const anchorSeq = last ? last.record.anchorSeq + 1 : 0;
  const record: AnchorRecord = {
    anchorSeq,
    tipHash: input.tipHash,
    solanaTxSig: input.solanaTxSig ?? null,
    slot: input.slot ?? null,
    cluster: input.cluster ?? null,
    asOf: input.asOf,
  };
  const entry: AnchorEntry = { record, prevAnchorHash, entryHash: recomputeEntryHash(prevAnchorHash, record) };
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return entry;
}

export interface AnchorChainResult {
  valid: boolean;
  brokenAt?: number;
}

/** Verify the Layer-B chain is internally consistent: each prevAnchorHash links, each
 *  entryHash matches its record, and anchorSeq is strictly increasing from 0. */
export function verifyAnchorChain(entries: AnchorEntry[]): AnchorChainResult {
  let prev = ANCHOR_GENESIS;
  let expectedSeq = 0;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevAnchorHash !== prev) return { valid: false, brokenAt: i };
    if (e.entryHash !== recomputeEntryHash(e.prevAnchorHash, e.record)) return { valid: false, brokenAt: i };
    if (e.record.anchorSeq !== expectedSeq) return { valid: false, brokenAt: i };
    prev = e.entryHash;
    expectedSeq++;
  }
  return { valid: true };
}
