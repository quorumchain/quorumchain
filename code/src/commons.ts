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

export type Standing = 'CONSENSUS' | 'CREDIBLE_MINORITY' | 'UNRANKED';
export type ClaimStatus = 'RESOLVED' | 'CONTESTED' | 'INDETERMINATE';

export interface Stance {
  position: string; // a verdict token held on the ballot, e.g. "YES" / "NO" / "INDETERMINATE"
  validators: string[]; // who held it — provenance, never flattened away
  panelVotes: number; // how many panelists held it (panel distribution, NOT reputation)
  standing: Standing; // computed from the tally by auditable rule; v0.1 never ranks FRINGE (NI-9c)
}

// Minimal panel-state receipt (NI-9a). v0.1 records the validator set that
// produced the claim; provider/diversity-correlation metadata is a v0.2 graduation.
export interface PanelStateReceipt {
  validators: string[];
  size: number;
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
export function buildClaimIndex(votes: SignedVote[], keyring: Record<string, string>, quorum: number): Claim[] {
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

    const status: ClaimStatus = !r.ratified ? 'CONTESTED' : r.verdict === 'INDETERMINATE' ? 'INDETERMINATE' : 'RESOLVED';
    // Standing is computed, not assigned. It is ranked ONLY for a substantive
    // resolution (RESOLVED): the ratified majority is CONSENSUS, every other held
    // position CREDIBLE_MINORITY. On the unverifiable / no-consensus class
    // (INDETERMINATE, CONTESTED) nothing is ranked — UNRANKED, never FRINGE —
    // consistent with reputation.ts and NI-9c.
    const ranked = status === 'RESOLVED';
    const stances: Stance[] = positionOrder.map((position) => ({
      position,
      validators: heldBy.get(position)!,
      panelVotes: heldBy.get(position)!.length,
      standing: ranked ? (position === r.verdict ? 'CONSENSUS' : 'CREDIBLE_MINORITY') : 'UNRANKED',
    }));

    return {
      ballotHash: bh,
      status,
      verdict: r.ratified ? r.verdict : null,
      stances,
      panelStateReceipt: { validators: [...seenValidator], size: seenValidator.size },
    };
  });
}

/** The read path (§4): return the full epistemic state of one claim, or null. */
export function queryClaim(index: Claim[], ballotHash: string): Claim | null {
  return index.find((c) => c.ballotHash === ballotHash) ?? null;
}
