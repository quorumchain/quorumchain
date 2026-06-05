// Quorumchain ($QRM) — CIP-10 dossier validity: the symmetric bar (NI-AA4) and the suppression
// guard (NI-AA8). Same bar, both directions — guards manufactured doubt AND suppressed doubt.
// Pure. Zero dependencies.

import type { ContraryDossier } from './dossier.ts';
import type { EpistemicType } from './commons.ts';

export interface DossierValidity { valid: boolean; reason?: string }

export function validateDossier(d: ContraryDossier, ctx: { eligible: boolean; epistemicType?: EpistemicType | null }): DossierValidity {
  // NI-AA4 — every contrary anchor must be well-formed in all three fields (symmetric bar stand-in)
  // AND carry a non-empty provenanceClass (T2-a, ballot 8415ba86).
  for (const a of d.contraryAnchors) {
    if (!a.source.trim() || !a.anchorType.trim() || !a.claimItContradicts.trim()) {
      return { valid: false, reason: 'contrary anchor missing a required field (symmetric bar, NI-AA4)' };
    }
    if (!a.provenanceClass.trim()) {
      return { valid: false, reason: 'contrary anchor missing provenanceClass (NI-AA4)' };
    }
  }
  // NI-AA4 monoculture guard (T2-a): ≥2 anchors must not all share the same provenanceClass.
  if (d.contraryAnchors.length >= 2) {
    const classes = new Set(d.contraryAnchors.map((a) => a.provenanceClass.trim().toLowerCase()));
    if (classes.size === 1) {
      return { valid: false, reason: 'contrary anchors all share the same provenanceClass — provenance monoculture not permitted (NI-AA4)' };
    }
  }
  // NI-AA8 — a NEGLIGIBLE on an audit-eligible class must be accountable.
  // T3 (ballot 8415ba86): for EMPIRICAL_LIVE, require BOTH co-signers AND searchedRejectedAnchors.
  // For all other eligible types, the existing either-or sufficiency applies.
  if (ctx.eligible && d.assessedWeight === 'NEGLIGIBLE') {
    if (ctx.epistemicType === 'EMPIRICAL_LIVE') {
      const hasBoth = d.negligibleCoSigners.length > 0 && d.searchedRejectedAnchors.length > 0;
      if (!hasBoth) return { valid: false, reason: 'NEGLIGIBLE on EMPIRICAL_LIVE requires BOTH negligibleCoSigners and searchedRejectedAnchors (NI-AA8, T3)' };
    } else {
      const accountable = d.negligibleCoSigners.length > 0 || d.searchedRejectedAnchors.length > 0;
      if (!accountable) return { valid: false, reason: 'bare NEGLIGIBLE on an eligible claim (NI-AA8): needs co-signers or searchedRejectedAnchors' };
    }
  }
  return { valid: true };
}
