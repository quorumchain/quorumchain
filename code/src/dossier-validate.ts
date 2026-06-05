// Quorumchain ($QRM) — CIP-10 dossier validity: the symmetric bar (NI-AA4) and the suppression
// guard (NI-AA8). Same bar, both directions — guards manufactured doubt AND suppressed doubt.
// Pure. Zero dependencies.

import type { ContraryDossier } from './dossier.ts';

export interface DossierValidity { valid: boolean; reason?: string }

export function validateDossier(d: ContraryDossier, ctx: { eligible: boolean }): DossierValidity {
  // NI-AA4 — every contrary anchor must be well-formed in all three fields (symmetric bar stand-in).
  for (const a of d.contraryAnchors) {
    if (!a.source.trim() || !a.anchorType.trim() || !a.claimItContradicts.trim()) {
      return { valid: false, reason: 'contrary anchor missing a required field (symmetric bar, NI-AA4)' };
    }
  }
  // NI-AA8 — a NEGLIGIBLE on an audit-eligible class must be accountable.
  if (ctx.eligible && d.assessedWeight === 'NEGLIGIBLE') {
    const accountable = d.negligibleCoSigners.length > 0 || d.searchedRejectedAnchors.length > 0;
    if (!accountable) return { valid: false, reason: 'bare NEGLIGIBLE on an eligible claim (NI-AA8): needs co-signers or searchedRejectedAnchors' };
  }
  return { valid: true };
}
