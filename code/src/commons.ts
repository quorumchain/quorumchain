// Quorumchain ($QRM) — CIP-9 v0.1 resolution-index (the read pillar).
// The Knowledge Commons "read path with a memory": a read-only claim graph
// projected from the existing signed CIP-3/CIP-8 verdict log. Each resolved
// ballot becomes a Claim whose stance set PRESERVES the dissent — the product is
// the epistemic map (consensus + credible minority + honest unknown), never a
// single decreed truth (§2, §4). Pure projection over verified votes: it adds no
// new trust assumption beyond the signed log it reads.
//
// v0.1 scope (§7): resolution index only. It deliberately computes NO source
// reputation (that is NI-9b / v0.2 — reputation must track external ground truth,
// never agreement), assigns NO standing on an unverifiable class, and does not
// fork (NI-9d / v0.3). `panelVotes` is the panel's vote distribution, NOT a
// reputation or popularity score.

import { ratify, verifyVote, type SignedVote } from './signed-vote.ts';
import { sharesLineage, type Provenance } from './lifecycle.ts';

// Re-exported so Commons consumers get the canonical provenance type from the read path.
export type { Provenance } from './lifecycle.ts';

export type Standing = 'CONSENSUS' | 'CREDIBLE_MINORITY' | 'UNRANKED';
export type ClaimStatus = 'RESOLVED' | 'CONTESTED' | 'INDETERMINATE';

// CIP-9 amendment (ballot 5885f224): verdict tokens that carry NO enforcement
// direction. A validator that ABSTAINs declined to judge; INDETERMINATE is the
// honest-unknown token; NO_VERDICT is an invoker failure. None ever projects to
// RESOLVED. Every other token (YES, NO, any domain token) is substantive.
const NON_SUBSTANTIVE = new Set<string>(['ABSTAIN', 'INDETERMINATE', 'NO_VERDICT']);

export interface Stance {
  position: string; // a verdict token held on the ballot, e.g. "YES" / "NO" / "INDETERMINATE"
  validators: string[]; // who held it — provenance, never flattened away
  panelVotes: number; // how many panelists held it (panel distribution, NOT reputation)
  standing: Standing; // computed from the tally by auditable rule; v0.1 never ranks FRINGE (NI-9c)
}

// CIP-12: the panel-level correlation summary. We NEVER assert independence
// ('LOW') without live round-60 correlation probes; known shared-foundation
// floors the band at 'ELEVATED' (NI-12f); otherwise the honest value is 'UNKNOWN'.
export type CorrelationBand = 'LOW' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';

// CIP-12: one composition entry per validator. Records provenance, NOT reputation
// or vote weight (NI-12d). Unknown/opted-out provenance is an explicit null, never
// omitted (NI-12g).
export interface CompositionEntry {
  validatorId: string;
  provider: string | null;
  lineage: string | null; // the dominant lineage signal (corpus family); canonical vector lives in the registry
}

// Panel-state receipt. NI-9a records the validator set; CIP-12 (NI-12a..i) adds
// the fuller correlation receipt: composition + correlationBand. Both are
// DESCRIPTIVE — they never alter status/verdict/standing/panelVotes (NI-12b).
export interface PanelStateReceipt {
  validators: string[];
  size: number;
  composition: CompositionEntry[];
  correlationBand: CorrelationBand;
}

// CIP-12 NI-12f: the band reflects KNOWN correlation across the panel, not the
// completeness of any one entry. Without probes we cannot assert 'LOW'; a known
// shared lineage (CIP-7 NI-1) among any pair floors it at 'ELEVATED'.
function correlationBand(ids: string[], provenance: Record<string, Provenance>): CorrelationBand {
  const known = ids.filter((id) => provenance[id]);
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      if (sharesLineage(provenance[known[i]], provenance[known[j]])) return 'ELEVATED';
    }
  }
  return 'UNKNOWN';
}

export interface Claim {
  ballotHash: string;
  status: ClaimStatus;
  verdict: string | null; // the ratified verdict, or null when no quorum
  stances: Stance[]; // ALL credible positions retained (G1 pluralism)
  panelStateReceipt: PanelStateReceipt;
}

/** Project the signed verdict log into a claim index. Consensus/standing rest on
 *  the SAME verified, non-equivocating votes that `ratify` counts — so a tampered
 *  or equivocating vote never reaches the graph. Deterministic: same log → same
 *  index (ballots and stances are emitted in first-seen order). */
export function buildClaimIndex(
  votes: SignedVote[],
  keyring: Record<string, string>,
  quorum: number,
  provenance: Record<string, Provenance> = {}, // CIP-12: optional; absent => explicit-null composition (NI-12g)
): Claim[] {
  // group by ballot, preserving first-seen order for determinism
  const order: string[] = [];
  const byBallot = new Map<string, SignedVote[]>();
  for (const v of votes) {
    if (!byBallot.has(v.ballotHash)) {
      byBallot.set(v.ballotHash, []);
      order.push(v.ballotHash);
    }
    byBallot.get(v.ballotHash)!.push(v);
  }

  return order.map((bh) => {
    const ballotVotes = byBallot.get(bh)!;
    const r = ratify(bh, ballotVotes, keyring, quorum);
    const counted = new Set(r.counted); // validators whose vote ratify accepted

    // one verified verdict per counted validator, in first-seen order
    const positionOrder: string[] = [];
    const heldBy = new Map<string, string[]>(); // position -> validators
    const seenValidator = new Set<string>();
    for (const v of ballotVotes) {
      if (!counted.has(v.validatorId) || seenValidator.has(v.validatorId)) continue;
      if (!(v.validatorId in keyring) || !verifyVote(v, keyring[v.validatorId])) continue;
      seenValidator.add(v.validatorId);
      if (!heldBy.has(v.verdict)) {
        heldBy.set(v.verdict, []);
        positionOrder.push(v.verdict);
      }
      heldBy.get(v.verdict)!.push(v.validatorId);
    }

    // CIP-9 amendment (ballot 5885f224): status is a total function of
    // substantive-verdict presence, independent of the bare `ratified` flag. The
    // non-substantive set carries no enforcement direction — ABSTAIN (declined),
    // INDETERMINATE (honest unknown), NO_VERDICT (invoker failed). RESOLVED ⟺ an
    // enforceable substantive verdict holds a supermajority; CONTESTED is reserved
    // for ≥2 competing substantive positions; the absence of any surviving
    // substantive position (all-ABSTAIN, NO_VERDICT-only, a lone sub-supermajority
    // position, ratified all-INDETERMINATE, empty) is INDETERMINATE. Ratification
    // is untouched — ABSTAIN stays tallied; it simply never projects to RESOLVED.
    const substantive = positionOrder.filter((p) => !NON_SUBSTANTIVE.has(p));
    const resolved = r.ratified && r.verdict !== null && !NON_SUBSTANTIVE.has(r.verdict);
    const status: ClaimStatus = resolved ? 'RESOLVED' : substantive.length >= 2 ? 'CONTESTED' : 'INDETERMINATE';
    // Standing is computed, not assigned. It is ranked ONLY for a substantive
    // resolution (RESOLVED): the ratified majority is CONSENSUS, every other held
    // position CREDIBLE_MINORITY. On the unverifiable / no-consensus class
    // (INDETERMINATE, CONTESTED) nothing is ranked — UNRANKED, never FRINGE —
    // consistent with reputation.ts and NI-9c. NO_VERDICT is a non-position (a validator
    // whose invoker errored/timed out), never a credible dissent — it stays UNRANKED even
    // in a RESOLVED claim (round-53 V1 finding).
    const ranked = status === 'RESOLVED';
    const stances: Stance[] = positionOrder.map((position) => ({
      position,
      validators: heldBy.get(position)!,
      panelVotes: heldBy.get(position)!.length,
      standing: ranked && position !== 'NO_VERDICT' ? (position === r.verdict ? 'CONSENSUS' : 'CREDIBLE_MINORITY') : 'UNRANKED',
    }));

    // CIP-12: the fuller correlation receipt. Derived from the provenance
    // registry at projection time (NI-12a computed-not-assigned); descriptive
    // only — nothing above is recomputed from it (NI-12b).
    const panelIds = [...seenValidator];
    const composition: CompositionEntry[] = panelIds.map((id) => {
      const p = provenance[id];
      return { validatorId: id, provider: p ? p.provider : null, lineage: p ? p.corpusFamily : null };
    });

    return {
      ballotHash: bh,
      status,
      verdict: r.ratified ? r.verdict : null,
      stances,
      panelStateReceipt: {
        validators: panelIds,
        size: seenValidator.size,
        composition,
        correlationBand: correlationBand(panelIds, provenance),
      },
    };
  });
}

/** The read path (§4): return the full epistemic state of one claim, or null. */
export function queryClaim(index: Claim[], ballotHash: string): Claim | null {
  return index.find((c) => c.ballotHash === ballotHash) ?? null;
}
