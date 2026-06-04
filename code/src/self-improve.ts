// Quorumchain ($QRM) — Phase 1.3: the self-improvement gate. The dogfood (rounds 52→53)
// proved the pattern by hand; this formalizes it into one standing decision: a change is
// APPROVED only when the panel ratifies it SOUND. Every other outcome blocks it,
// classified by why — so "nothing merges without 2/3 SOUND" is mechanical, not a human
// reading the tally. gateOf is pure; runSelfImprove (in run-self-improve.ts) wires the
// full cycle: source a review of HEAD -> convene -> gate -> refresh the public feed.

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
