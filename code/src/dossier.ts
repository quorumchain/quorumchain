// Quorumchain ($QRM) — CIP-10 adversarial-auditor contrary-evidence dossier (spec §4).
// A SIGNED artifact (Ed25519 by the auditor's validator key), recorded alongside the ballot,
// NEVER counted in the tally (descriptive-only, CIP-12 NI-12b). Zero dependencies.

import type { AssessedWeight, FalsificationCondition } from './commons.ts';

export interface ContraryAnchor { source: string; anchorType: string; claimItContradicts: string }
export interface SearchedRejectedAnchor { source: string; whyRejected: string }

export interface ContraryDossier {
  ballotHash: string;
  auditorId: string;
  contraryAnchors: ContraryAnchor[];          // each must clear the symmetric anchor bar (NI-AA4)
  searchedRejectedAnchors: SearchedRejectedAnchor[]; // suppression audit-trail (NI-AA8)
  assessedWeight: AssessedWeight;              // NEGLIGIBLE is first-class (NI-AA5)
  falsificationConditions: FalsificationCondition[]; // structured CIP-13 bridge
  negligibleCoSigners: string[];              // required iff NEGLIGIBLE on an eligible class (NI-AA8)
  signature: string;                          // hex Ed25519 over dossierPayload (NI-AA2 — artifact, not vote)
}

export function emptyDossier(ballotHash: string, auditorId: string): ContraryDossier {
  return {
    ballotHash, auditorId,
    contraryAnchors: [], searchedRejectedAnchors: [],
    assessedWeight: 'NEGLIGIBLE', falsificationConditions: [], negligibleCoSigners: [],
    signature: '',
  };
}
