// Quorumchain ($QRM) — CIP-10 v0.1 node admission + jury selection (judgment tier).
// Two mechanics that need no live inference and are after-the-fact verifiable:
//   - Proof-of-Diversity admission (§3): a judgment node joins ONLY by filling a
//     currently-missing model slot, so monoculture is un-enterable. The slot
//     taxonomy is frozen and panel-governed; operators cannot invent slots (PoD-2).
//   - Scarcity-weighted random per-slot selection (§4): each ballot draws one node
//     per slot from a committed seed via a deterministic PRF — an ephemeral jury,
//     one vote per slot, reproducible/verifiable by anyone (SEL-1 verifiability).
//     A scarce slot's lone operator is drawn every ballot, so scarcity pays more
//     and attracts entry. NI-10a: a single-operator slot is flagged thin,
//     down-weighted, and structurally cannot be the decisive vote.
//
// Deferred to production (documented, NOT faked here): NI-10c threshold /
// forced-inclusion randomness beacon (v0.1 uses a supplied seed and proves only
// the *verifiable-draw* property), SEL-2 proof-of-inference model binding, and
// CIP-7 correlation-eviction (the runtime backstop PoD cannot replace).
// Zero dependencies — Node built-in crypto only.

import { createHash } from 'node:crypto';

export type Assurance = 'STANDARD' | 'LOW_ASSURANCE';

export interface NodeOperator {
  id: string;
  model: string; // must be one of the taxonomy's slots
  assurance: Assurance;
}

export interface NodeRegistry {
  taxonomy: string[]; // frozen, panel-governed model slots (PoD-2)
  operators: NodeOperator[];
}

export interface AdmissionDecision {
  admitted: boolean;
  reason?: string;
  registry: NodeRegistry; // updated if admitted, unchanged otherwise
}

const THIN_SLOT_FLOOR = 2; // below this an operator count is "thin" (NI-10a)
const THIN_WEIGHT = 0.5; // a thin seat's reduced vote weight
const STANDARD_WEIGHT = 1;

/** Slots in the frozen taxonomy that currently have zero operators. */
export function missingSlots(registry: NodeRegistry): string[] {
  const covered = new Set(registry.operators.map((o) => o.model));
  return registry.taxonomy.filter((slot) => !covered.has(slot));
}

/** Proof-of-Diversity admission (§3). Monoculture is un-enterable: while any slot
 *  is empty, only a node that fills a missing slot is admitted; redundancy on an
 *  already-covered slot is allowed only once every slot is covered. */
export function admitNode(registry: NodeRegistry, node: NodeOperator): AdmissionDecision {
  if (!registry.taxonomy.includes(node.model)) {
    return { admitted: false, reason: `rejected: '${node.model}' is outside the frozen slot taxonomy (PoD-2)`, registry };
  }
  const missing = missingSlots(registry);
  if (missing.length > 0 && !missing.includes(node.model)) {
    return {
      admitted: false,
      reason: `rejected: must fill a missing slot first (${missing.length} missing: ${missing.join(', ')}) — monoculture is un-enterable`,
      registry,
    };
  }
  return { admitted: true, registry: { ...registry, operators: [...registry.operators, node] } };
}

export interface JurySeat {
  slot: string;
  nodeId: string;
  assurance: Assurance;
  thin: boolean; // single/under-floor operator slot (NI-10a)
  weight: number; // reduced for thin slots so they cannot be decisive
}

export interface Jury {
  seed: string;
  seats: JurySeat[];
}

// Deterministic, after-the-fact-verifiable draw index from a committed seed.
function drawIndex(seed: string, slot: string, n: number): number {
  const digest = createHash('sha256').update(`${seed}|${slot}`, 'utf8').digest();
  // first 6 bytes as an integer (within Number.MAX_SAFE_INTEGER), then mod n
  const v = digest.readUIntBE(0, 6);
  return v % n;
}

function slotOperatorsSorted(operators: NodeOperator[], slot: string): NodeOperator[] {
  return operators.filter((o) => o.model === slot).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Draw one node per covered slot for this ballot's seed — the ephemeral jury. */
export function drawJury(registry: NodeRegistry, seed: string): Jury {
  const seats: JurySeat[] = [];
  for (const slot of registry.taxonomy) {
    const ops = slotOperatorsSorted(registry.operators, slot);
    if (ops.length === 0) continue; // uncovered slot casts no seat
    const drawn = ops[drawIndex(seed, slot, ops.length)];
    const thin = ops.length < THIN_SLOT_FLOOR;
    seats.push({ slot, nodeId: drawn.id, assurance: drawn.assurance, thin, weight: thin ? THIN_WEIGHT : STANDARD_WEIGHT });
  }
  return { seed, seats };
}

/** Independently re-run the draw for one slot and confirm the claimed node. */
export function verifyDraw(seed: string, slot: string, slotOperators: NodeOperator[], claimedNodeId: string): boolean {
  const ops = [...slotOperators].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (ops.length === 0) return false;
  return ops[drawIndex(seed, slot, ops.length)].id === claimedNodeId;
}

export interface TallyResult {
  verdict: string | null;
  weighted: Record<string, number>;
  decisiveSlots: string[]; // slots whose removal would change the verdict
}

/** Weighted tally of one jury's votes with the HARD NI-10a guarantee: a thin slot
 *  can never be the decisive (swing) vote. This is structural, not a matter of
 *  down-weighting: the verdict is a function of the STANDARD seats alone, so no
 *  thin seat can ever appear in `decisiveSlots`. Thin seats are advisory — they
 *  are recorded but cannot change a verdict the standard seats determine. The one
 *  exception is the bootstrap regime where EVERY slot is thin (no standard seat to
 *  defer to): then the thin seats are all there is, and they decide. The thin
 *  seat's reduced `weight` still matters for compensation/scarcity (CIP-10 §4); it
 *  is simply no longer the lever that decides an outcome. */
export function tallyJury(jury: Jury, votesBySlot: Record<string, string>): TallyResult {
  const weigh = (seats: JurySeat[]): Record<string, number> => {
    const t: Record<string, number> = {};
    for (const s of seats) {
      const v = votesBySlot[s.slot];
      if (v === undefined) continue;
      t[v] = (t[v] ?? 0) + s.weight;
    }
    return t;
  };
  const winnerOf = (t: Record<string, number>): string | null => {
    let best: string | null = null;
    let max = -Infinity;
    for (const [v, w] of Object.entries(t)) if (w > max) ((max = w), (best = v));
    return best;
  };

  // The deciding set: standard seats govern. Only when there are none (every slot
  // thin) do thin seats decide — so a thin seat is structurally never a swing vote.
  const standardSeats = jury.seats.filter((s) => !s.thin);
  const deciding = standardSeats.length > 0 ? standardSeats : jury.seats;

  const weighted = weigh(deciding);
  const verdict = winnerOf(weighted);
  const decisiveSlots = deciding
    .filter((s) => winnerOf(weigh(deciding.filter((x) => x.slot !== s.slot))) !== verdict)
    .map((s) => s.slot);

  return { verdict, weighted, decisiveSlots };
}
