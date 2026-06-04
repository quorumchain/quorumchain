// Quorumchain ($QRM) — Phase 1.3: the self-improvement gate. The dogfood (rounds 52→53)
// proved the pattern by hand; this formalizes it into one standing decision: a change is
// APPROVED only when the panel ratifies it SOUND. Every other outcome blocks it,
// classified by why — so "nothing merges without 2/3 SOUND" is mechanical, not a human
// reading the tally. gateOf is pure; runSelfImprove (in run-self-improve.ts) wires the
// full cycle: source a review of HEAD -> convene -> gate -> refresh the public feed.

import type { Feed } from './feed.ts';

export type Gate = 'APPROVED' | 'CHANGES_REQUESTED' | 'REJECTED' | 'INCONCLUSIVE';

/** The gate decision for a self-review convening. Only a ratified SOUND clears it. */
export function gateOf(convening: { ratified: boolean; verdict: string | null }): Gate {
  if (!convening.ratified) return 'INCONCLUSIVE'; // no 2/3, or a liveness failure
  switch (convening.verdict) {
    case 'SOUND': return 'APPROVED';
    case 'REVISE': return 'CHANGES_REQUESTED';
    case 'INADEQUATE': return 'REJECTED';
    default: return 'INCONCLUSIVE';
  }
}

/** The gate for one ballot, anchored to the RECOMPUTED log-derived feed — never a mutable
 *  stored result (round-54 V2). A tampered chain can never approve; a ballot not yet in
 *  the feed (not convened / a liveness miss) is INCONCLUSIVE. The feed itself recomputes
 *  ratify over the signed votes + pinned keyring, so the gate inherits that proof. */
export function gateForBallot(feed: Feed, ballotHash: string): Gate {
  if (!feed.chainValid) return 'INCONCLUSIVE'; // a broken chain approves nothing
  const convening = feed.convenings.find((c) => c.ballotHash === ballotHash);
  if (!convening) return 'INCONCLUSIVE'; // not yet convened
  return gateOf(convening);
}

/** Make the gate ACTIONABLE (round-54 V1): a scheduler/CI step gets a non-zero exit code
 *  on any non-APPROVED outcome, so the cycle blocks mechanically, not by a human reading
 *  the tally. */
export function exitCodeFor(gate: Gate): number {
  return gate === 'APPROVED' ? 0 : 1;
}
