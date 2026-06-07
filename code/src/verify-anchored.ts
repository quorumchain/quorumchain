// Quorumchain ($QRM) — CIP-17 verify-anchored: the standalone outsider verifier.
//
// Given the PUBLIC Layer-A log and the Layer-B commitment chain (and, optionally, a Solana
// RPC), an independent party can confirm, with NO private state, that:
//   (1) the Layer-A hash chain is internally valid (verifyLog, unchanged);
//   (2) the Layer-B chain is internally valid (verifyAnchorChain);
//   (3) each Layer-B entry's tipHash matches a REAL Layer-A prefix tip (§7.1);
//   (4) each confirmed Layer-B entry references a Solana MAINNET-BETA tx whose memo carries
//       exactly that commitment (online, via the RPC) — devnet/degraded never count (NI-17b);
// and it reports, honestly, the anchored boundary: history at/before the latest CONFIRMED
// anchored tip is rewrite-detectable (NI-17c); the unanchored suffix is NOT (NI-17d).
//
// Sovereignty (NI-17a): the verifier NEVER requires Solana to validate Layer A. If the RPC is
// unreachable or absent, Layer-A/Layer-B internal validity is still reported; the external
// witness simply cannot be confirmed and those anchors are not counted as anchors of record.
// This is the only place a "halt over degrade" stance applies (the verifier is honest about
// what it could not confirm) — publishing itself never halts on Solana (see publish-feed.ts).

import { verifyEntries, type LogEntry } from './vote-log.ts';
import { verifyAnchorChain, type AnchorEntry } from './anchor-record.ts';
import { parseCommitment, isAnchorOfRecord, fetchMemo, type SolanaRpc } from './solana-anchor.ts';

export interface VerifyAnchoredResult {
  ok: boolean; // every checkable property held (Layer A + Layer B valid, every anchor's tip is a real prefix tip, every confirmed anchor's memo matches)
  layerAValid: boolean;
  layerBValid: boolean;
  confirmedAnchorCount: number; // anchors with a confirmed mainnet-beta witness carrying the matching commitment
  anchoredTip: string | null; // the latest CONFIRMED anchored tip hash (the NI-17c boundary), or null
  anchoredThroughIndex: number | null; // Layer-A index of the latest confirmed anchored tip, or null
  unanchoredSuffixLength: number; // Layer-A entries newer than the latest confirmed anchored tip (NI-17d)
  boundaryNote: string | null;
  reasons: string[]; // why ok is false, or notes (degradation, devnet-not-of-record, etc.)
}

/** Verify the anchored chain. `rpc` is optional: pass null for a pure-offline check (no
 *  external witness confirmation), or a SolanaRpc to confirm the mainnet-beta witnesses. */
export async function verifyAnchored(
  logEntries: LogEntry[],
  anchors: AnchorEntry[],
  rpc: SolanaRpc | null,
): Promise<VerifyAnchoredResult> {
  const reasons: string[] = [];
  const layerAValid = verifyEntries(logEntries).valid;
  if (!layerAValid) reasons.push('Layer-A hash chain is invalid');
  const layerB = verifyAnchorChain(anchors);
  const layerBValid = layerB.valid;
  if (!layerBValid) reasons.push(`Layer-B anchor chain is invalid at index ${layerB.brokenAt}`);

  // Map every Layer-A prefix tip (entryHash after each vote) to its index, so we can check
  // that a committed tipHash is a tip the genuine chain actually produced (§7.1).
  const tipIndex = new Map<string, number>();
  logEntries.forEach((e, i) => tipIndex.set(e.entryHash, i));

  let confirmedAnchorCount = 0;
  let anchoredTip: string | null = null;
  let anchoredThroughIndex: number | null = null;

  for (const a of anchors) {
    const r = a.record;
    // (3) every Layer-B entry's tipHash MUST match a real Layer-A prefix tip.
    if (!tipIndex.has(r.tipHash)) {
      reasons.push(`anchor seq ${r.anchorSeq}: tipHash does not match any Layer-A prefix tip`);
      continue;
    }
    const tipIdx = tipIndex.get(r.tipHash)!;

    // A degraded (Layer-B-only) anchor has no Solana witness — it is honest local state, not
    // an anchor of record. It does not fail verification; it simply isn't counted (NI-17a).
    if (!r.solanaTxSig || !isAnchorOfRecord(r.cluster)) {
      if (!r.solanaTxSig) reasons.push(`anchor seq ${r.anchorSeq}: Layer-B-only (degraded, no Solana witness) — not an anchor of record`);
      else reasons.push(`anchor seq ${r.anchorSeq}: ${r.cluster} witness is not an anchor of record (mainnet-beta only, NI-17b)`);
      continue;
    }

    // (4) confirm the external mainnet-beta witness carries EXACTLY this commitment.
    if (!rpc) {
      reasons.push(`anchor seq ${r.anchorSeq}: no RPC supplied — external witness unconfirmed (offline coverage only)`);
      continue;
    }
    let hit;
    try {
      hit = await fetchMemo(rpc, r.solanaTxSig);
    } catch {
      reasons.push(`anchor seq ${r.anchorSeq}: Solana unreachable — witness unconfirmed (degraded, NI-17a)`);
      continue;
    }
    if (!hit) {
      reasons.push(`anchor seq ${r.anchorSeq}: no confirmed transaction found for ${r.solanaTxSig}`);
      continue;
    }
    if (!isAnchorOfRecord(hit.cluster)) {
      reasons.push(`anchor seq ${r.anchorSeq}: witnessed on ${hit.cluster}, not mainnet-beta (NI-17b)`);
      continue;
    }
    const parsed = parseCommitment(hit.memo);
    if (!parsed || parsed.tipHash !== r.tipHash || parsed.anchorSeq !== r.anchorSeq) {
      reasons.push(`anchor seq ${r.anchorSeq}: on-chain memo does not match the committed (seq, tip)`);
      continue;
    }
    // A genuine, confirmed, mainnet-beta anchor of record.
    confirmedAnchorCount++;
    if (anchoredThroughIndex === null || tipIdx > anchoredThroughIndex) {
      anchoredThroughIndex = tipIdx;
      anchoredTip = r.tipHash;
    }
  }

  const unanchoredSuffixLength =
    anchoredThroughIndex === null ? logEntries.length : logEntries.length - 1 - anchoredThroughIndex;

  let boundaryNote: string | null;
  if (anchoredThroughIndex === null) {
    boundaryNote = confirmedAnchorCount === 0 && reasons.some((s) => /degrad|unreachable|not an anchor of record|no RPC/.test(s))
      ? 'No confirmed mainnet-beta anchor of record; Layer-A is internally valid but no external witness is confirmed (degraded coverage, NI-17a).'
      : 'No anchored history; the entire log is the unanchored suffix and is protected only by the internal hash chain (NI-17d).';
  } else {
    boundaryNote = unanchoredSuffixLength > 0
      ? `Rewrite-detectable through Layer-A index ${anchoredThroughIndex} (NI-17c). The unanchored suffix of ${unanchoredSuffixLength} entr${unanchoredSuffixLength === 1 ? 'y is' : 'ies are'} newer than the latest confirmed anchor and NOT externally witnessed (NI-17d).`
      : `Rewrite-detectable through the current tip (NI-17c); no unanchored suffix.`;
  }

  // `ok`: the chains are internally valid AND every Layer-B entry referenced a real Layer-A
  // tip. Degraded/devnet/offline anchors are NOT failures (they are honestly uncounted); the
  // only `ok=false` causes are an invalid chain or a committed tip with no Layer-A pre-image.
  const tipMismatch = reasons.some((s) => /does not match any Layer-A prefix tip/.test(s));
  const witnessMismatch = reasons.some((s) => /does not match the committed|no confirmed transaction found|not mainnet-beta/.test(s));
  const ok = layerAValid && layerBValid && !tipMismatch && !witnessMismatch;

  return {
    ok,
    layerAValid,
    layerBValid,
    confirmedAnchorCount,
    anchoredTip,
    anchoredThroughIndex,
    unanchoredSuffixLength,
    boundaryNote,
    reasons,
  };
}
