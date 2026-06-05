// Quorumchain ($QRM) — CIP-9 read surface, the one canonical core (round 58, ADOPT 2/3).
// A pure projection of commons.ts's claim graph into a ClaimView: the full epistemic state of a
// claim (stance set with computed standing, the NI-9a panel-state receipt, the verified statement,
// chain validity). The agent-facing read is this object; the human page is its markdown projection.
// support is null in v0.1 (NI-9b: no external anchors in the convening log — never 0). No edit key:
// every field is derived, nothing assigned. Zero dependencies.

import type { Claim, ClaimStatus, Standing, PanelStateReceipt, EpistemicType, Lineage, BallotMeta, AssessedWeight, FalsificationCondition, ContraryDossier } from './commons.ts';
import { buildClaimIndex } from './commons.ts';
import { statementFor, deriveCip13InputsVerified, type BallotRegistryEntry } from './ballot-registry.ts';
import type { ContraryAnchor, SearchedRejectedAnchor } from './dossier.ts';
import type { SignedVote } from './signed-vote.ts';

export interface StanceView {
  position: string;
  standing: Standing; // CONSENSUS | CREDIBLE_MINORITY | UNRANKED — computed by commons.ts, never assigned
  validators: string[]; // who held it (provenance, never flattened)
  panelVotes: number; // panel distribution, NOT reputation/popularity
  support: number | null; // null = not externally anchored (NI-9b) — null in v0.1, never 0
}

export interface ClaimView {
  ballotHash: string;
  statement: string | null; // verified registry statement, else null (never fabricated)
  status: ClaimStatus; // RESOLVED | CONTESTED | INDETERMINATE
  stances: StanceView[];
  panelState: PanelStateReceipt; // NI-9a receipt
  chainValid: boolean;
  // CIP-13 (ballot 3729cc2e): the time-aware read. Descriptive — carried through
  // from the projection, never recomputing status/verdict/standing (NI-13b).
  epistemicType: EpistemicType | null;
  typeRatified: boolean; // CIP-13 v0.3: panel-ratified type vs proposer-declared
  evidenceTime: number | string;
  lineage: Lineage;
  // CIP-13 v0.2: the CIP-10 auditor dossier surface (descriptive, NI-12b).
  contraryWeight: AssessedWeight | null;
  falsificationConditions: FalsificationCondition[];
  // CIP-10 amendment (§4): the full auditor view, projected from the VERIFIED dossier (null/empty when none).
  auditorId: string | null;
  contraryAnchors: ContraryAnchor[];
  searchedRejectedAnchors: SearchedRejectedAnchor[];
  negligibleCoSigners: string[];
}

/** Project one commons.ts Claim into a ClaimView. Pure: statement comes from the verified registry,
 *  chainValid is supplied by the caller (it recomputed verifyLog), everything else from the Claim. */
export function viewClaim(claim: Claim, registry: BallotRegistryEntry[], chainValid: boolean): ClaimView {
  return {
    ballotHash: claim.ballotHash,
    statement: statementFor(registry, claim.ballotHash),
    status: claim.status,
    stances: claim.stances.map((s) => ({
      position: s.position,
      standing: s.standing,
      validators: s.validators,
      panelVotes: s.panelVotes,
      support: null, // v0.1: no external anchor → null (NI-9b), never 0
    })),
    panelState: claim.panelStateReceipt,
    chainValid,
    epistemicType: claim.epistemicType,
    typeRatified: claim.typeRatified,
    evidenceTime: claim.evidenceTime,
    lineage: claim.lineage,
    contraryWeight: claim.contraryWeight,
    falsificationConditions: claim.falsificationConditions,
    auditorId: claim.auditorId,
    contraryAnchors: claim.contraryAnchors,
    searchedRejectedAnchors: claim.searchedRejectedAnchors,
    negligibleCoSigners: claim.negligibleCoSigners,
  };
}

/** Build a ClaimView for every ballot in a vote set. Pure: caller supplies the loaded votes,
 *  keyring, registry, and the already-recomputed chainValid (from verifyLog). */
export function buildViews(
  votes: SignedVote[],
  keyring: Record<string, string>,
  quorum: number,
  registry: BallotRegistryEntry[],
  chainValid: boolean,
  ballotMeta: Record<string, BallotMeta> = {}, // CIP-13: explicit overrides; merged OVER registry-derived
  dossiers: Record<string, ContraryDossier> = {}, // CIP-13 v0.2: explicit overrides; merged OVER registry-derived
): ClaimView[] {
  // Production source of CIP-13 inputs is the registry itself; explicit args override per key.
  // deriveCip13InputsVerified drops unverifiable dossiers — only signed dossiers project (Task 6/7).
  const derived = deriveCip13InputsVerified(registry, keyring);
  const meta = { ...derived.ballotMeta, ...ballotMeta };
  const doss = { ...derived.dossiers, ...dossiers };
  return buildClaimIndex(votes, keyring, quorum, {}, meta, doss).map((c) => viewClaim(c, registry, chainValid));
}
