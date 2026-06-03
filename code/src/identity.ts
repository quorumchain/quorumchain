// Quorumchain ($QRM) — canonical participant Identity (round-44 backlog #1).
// One participant was modelled three incompatible ways: CIP-3's `validatorId`
// (signing), CIP-10's `NodeOperator` (jury slot), CIP-7's `Validator` (lifecycle
// slot) — and the end-to-end scenario glued them by reusing a bare string, so the
// composition held only by convention. This is the single source of truth: an
// Identity projects into each module's record via an adapter, so the linkage is
// structural. Critically, `slot` is the ONE diversity-lineage label that both
// CIP-10's per-slot jury draw and CIP-7's distinctness floor range over — instead
// of CIP-10 ranging over `model-*` and CIP-7 over `corpus-*` (two label spaces
// that only coincidentally paired up), they now measure the same axis.
// Zero dependencies; a pure composition layer above the module types.

import type { NodeOperator, Assurance } from './nodes.ts';
import type { Validator } from './lifecycle.ts';

export interface Identity {
  id: string; // stable participant — the CIP-3 validatorId, CIP-10 operator id, CIP-7 slot id
  slot: string; // the diversity lineage it occupies — CIP-10 model AND CIP-7 corpusFamily
}

/** Project an Identity into a CIP-10 node operator. The slot IS the model slot. */
export function asNodeOperator(idn: Identity, assurance: Assurance = 'STANDARD'): NodeOperator {
  return { id: idn.id, model: idn.slot, assurance };
}

/** Project an Identity into a CIP-7 validator. The slot IS the corpusFamily (the
 *  NI-1 distinctness signal). Version and calibration are version-bound and MUST
 *  be supplied — never inherited from the identity (CIP-7 §3). Provider/serving
 *  default to the participant unless a real provider split is given. */
export function asValidator(
  idn: Identity,
  opts: { version: string; calibration: number; provider?: string; servingStack?: string; teacher?: string | null; weightDerivation?: string },
): Validator {
  return {
    id: idn.id,
    version: opts.version,
    status: 'STANDING',
    calibration: opts.calibration,
    provenance: {
      corpusFamily: idn.slot,
      teacher: opts.teacher ?? null,
      weightDerivation: opts.weightDerivation ?? `${idn.slot}-base`,
      provider: opts.provider ?? idn.id,
      servingStack: opts.servingStack ?? `${idn.id}-stack`,
    },
  };
}

/** The frozen CIP-10 slot taxonomy implied by a participant set: the distinct
 *  slots in first-seen order. One slot may hold several operators (redundancy). */
export function taxonomyOf(idns: Identity[]): string[] {
  return [...new Set(idns.map((i) => i.slot))];
}
