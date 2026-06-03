// Quorumchain ($QRM) — CIP-9 v0.2 open claims + external-anchor reputation (§5).
// The read pillar's reputation layer, built to defuse the §5 crux the round-39
// red-team struck: a graph that rewards "agreement with the panel" silently
// converges to a monoculture of sources that agreed before — incumbency
// laundered as truth. The fix is structural, not a heuristic:
//   NI-9b — a source's accuracy is scored ONLY against ground truth EXTERNAL to
//           the maintaining panel. Where the only "truth" is the panel's own
//           resolution, reputation does not move. "Agreement forbidden" is
//           enforced by source-of-truth, not by an after-the-fact check.
//   NI-9c — standing is COMPUTED from the provenance-weighted source distribution
//           by auditable criteria, never panel-assigned; on the unverifiable
//           class stances are shown UNRANKED (raw plurality), never FRINGE.
// Zero dependencies.

export type Anchor = 'EXTERNAL' | 'PANEL_ONLY';
export type ClaimStatus = 'OPEN' | 'CONTESTED' | 'RESOLVED' | 'UNVERIFIABLE';
export type Standing = 'CONSENSUS' | 'CREDIBLE_MINORITY' | 'UNRANKED';

export interface Stance {
  position: string;
  sources: string[]; // source ids that cite this position (provenance)
}

export interface Resolution {
  anchor: Anchor; // EXTERNAL = ground truth outside the panel; PANEL_ONLY = the panel is the only "truth"
  groundTruth?: string; // the external outcome, when anchor === EXTERNAL
  panelVerdict: string;
}

export interface Claim {
  id: string;
  stances: Stance[];
  resolution?: Resolution;
}

/** Claim lifecycle state. A panel-only resolution is UNVERIFIABLE: the panel can
 *  record a present view, but with no external anchor there is no ground truth —
 *  the honest-unknown class, where reputation must not move and standing is not
 *  ranked. */
export function claimStatus(claim: Claim): ClaimStatus {
  if (!claim.resolution) return claim.stances.length > 1 ? 'CONTESTED' : 'OPEN';
  return claim.resolution.anchor === 'EXTERNAL' ? 'RESOLVED' : 'UNVERIFIABLE';
}

/** Source reputation: +1 for being right, −1 for being wrong, ONLY on claims with
 *  an external ground-truth anchor (NI-9b). Panel-only and unresolved claims move
 *  nothing — so agreeing with the panel can never earn reputation, and a source
 *  that matched a WRONG consensus loses rep while a correct dissenter gains it
 *  (accuracy, never popularity). */
export function scoreSources(claims: Claim[]): Record<string, number> {
  const reps: Record<string, number> = {};
  for (const claim of claims) {
    const r = claim.resolution;
    if (!r || r.anchor !== 'EXTERNAL' || r.groundTruth === undefined) continue; // NI-9b: no external anchor → no movement
    for (const stance of claim.stances) {
      const delta = stance.position === r.groundTruth ? 1 : -1;
      for (const s of stance.sources) reps[s] = (reps[s] ?? 0) + delta;
    }
  }
  return reps;
}

export interface StandingRow {
  position: string;
  weight: number; // accuracy-weighted support (sum of source reputations), for ranked claims
  sourceCount: number; // raw provenance count, always shown
  standing: Standing;
}

/** Standing is computed, never assigned (NI-9c). On an externally-RESOLVED claim
 *  the ground-truth-matching stance is CONSENSUS and the others CREDIBLE_MINORITY.
 *  On the unverifiable class (no external anchor) there is no authority to rank
 *  stances: every stance is UNRANKED with its raw plurality + provenance shown,
 *  and nothing is demoted FRINGE. */
export function computeStanding(claim: Claim, reps: Record<string, number>): StandingRow[] {
  const status = claimStatus(claim);
  const ranked = status === 'RESOLVED' && claim.resolution?.groundTruth !== undefined;
  const gt = claim.resolution?.groundTruth;
  return claim.stances.map((stance) => ({
    position: stance.position,
    weight: stance.sources.reduce((sum, s) => sum + (reps[s] ?? 0), 0),
    sourceCount: stance.sources.length,
    standing: ranked ? (stance.position === gt ? 'CONSENSUS' : 'CREDIBLE_MINORITY') : 'UNRANKED',
  }));
}
