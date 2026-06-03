// Quorumchain ($QRM) — CIP-5 fork coordination & exit (the CIP-4 β-gate).
// Makes the "right to fork" mechanically exercisable with NO coordinator: the
// fork is the consequence of objective T0 rules every node already runs, so a
// captured panel has nothing to stall and no authority to seize.
//   §3 Mechanism A — client-enforced T0 validity (the trigger): a block applying
//      a T0-violating change is invalid, rejected like any malformed block, so
//      honest nodes are on the honest fork by construction.
//   §4 Mechanism B — canonical = the T0-preserving fork (computed locally, never
//      voted). Weight tie-breaks INSIDE the valid set; it can never gate a
//      violation into canonicality (HEAVIEST is rejected — self-legitimizing
//      capture).
// A T0 violation is a deterministic finding, not a judgment — which is exactly
// why it lives in client validity instead of in a vote. Zero dependencies.

export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

export interface ProtocolChange {
  id: string;
  tier: Tier; // the tier the change CLAIMS
  target?: 'STATE' | 'T0_CHECK_DEFINITION'; // what it modifies
  reclassifies?: { property: string; fromTier: Tier; toTier: Tier };
}

export interface Attestation {
  validators: { id: string; fingerprint: string }[];
}

export interface Block {
  height: number;
  prevHash: string;
  recordOp: 'append' | 'rewrite' | 'delete' | 'reorder';
  deterministic: boolean; // false => the state transition depends on a non-deterministic input
  change?: ProtocolChange;
  attestation: Attestation;
}

export interface T0Params {
  diversityFloor: number; // minimum distinct validator fingerprints (CIP-1 §6 analogue)
  t0Properties: string[]; // properties that are T0-locked
}

export interface T0Result {
  valid: boolean;
  violations: string[];
}

/** §3 Mechanism A — the four local T0 validity checks every client compiles as
 *  consensus-critical. The T0-check *definitions* are themselves T0-locked
 *  (round-12 amendment): a non-T0 change to WHAT the client checks is invalid,
 *  defeating the salami-slice (a chain of individually-T1 "clarifications"). */
export function checkT0(block: Block, params: T0Params): T0Result {
  const violations: string[] = [];

  // §4.1 determinism boundary — re-execution must reproduce
  if (!block.deterministic) violations.push('determinism-boundary');

  // §4.2 diversity & independence — a collapsed-diversity panel builds no quorum
  const distinct = new Set(block.attestation.validators.map((v) => v.fingerprint)).size;
  if (distinct < params.diversityFloor) violations.push('diversity-independence');

  // §4.3 append-only history — no delete/rewrite/reorder of a prior record
  if (block.recordOp !== 'append') violations.push('append-only-history');

  // §4.5 tier-assignment integrity — demoting a T0 property is capture-laundering
  const rc = block.change?.reclassifies;
  if (rc && params.t0Properties.includes(rc.property) && rc.toTier !== 'T0') violations.push('tier-assignment-integrity');

  // round-12 amendment — the T0-check definition is itself T0; a non-T0 change to it is invalid
  if (block.change?.target === 'T0_CHECK_DEFINITION' && block.change.tier !== 'T0') violations.push('t0-check-definition-locked');

  return { valid: violations.length === 0, violations };
}

export interface Fork {
  id: string;
  weight: number;
  blocks: Block[];
}

export interface CanonicalResult {
  canonicalId: string | null;
  validForks: string[];
  reason: string;
}

/** §4 Mechanism B — canonical Quorumchain = the chain satisfying all T0
 *  invariants. Filter to T0-preserving forks first, THEN tie-break by heaviest.
 *  Weight never rescues a T0-violating fork. */
export function selectCanonicalFork(forks: Fork[], params: T0Params): CanonicalResult {
  const valid = forks.filter((f) => f.blocks.every((b) => checkT0(b, params).valid));
  if (valid.length === 0) {
    return { canonicalId: null, validForks: [], reason: 'no T0-preserving fork exists' };
  }
  const heaviest = valid.reduce((a, b) => (b.weight > a.weight ? b : a));
  return {
    canonicalId: heaviest.id,
    validForks: valid.map((f) => f.id),
    reason: valid.length === 1 ? 'single T0-preserving fork' : 'heaviest among T0-preserving forks',
  };
}

export type ClientCheck = (block: Block, params: T0Params) => T0Result;

export interface DrillClient {
  name: string;
  check: ClientCheck;
}

export interface DrillResult {
  rejections: { client: string; rejected: boolean }[];
  allReject: boolean; // §9 step 2 — 100% of honest clients auto-reject
  green: boolean; // drill passes only with 100% rejection across ≥N independent clients
  note: string;
}

const MIN_INDEPENDENT_CLIENTS = 2; // §7 — ≥N independent implementations (initial value; panel to ratify)

/** §9 drill — inject a T0-violating block and assert every client auto-rejects
 *  it. §7: if the clients are a monoculture sharing a bug, the violation slips
 *  through all of them and NO split is even visible — a β-gate failure worse than
 *  the round-8 fork-void. Renunciation may not proceed unless this is green. */
export function runForkDrill(clients: DrillClient[], violatingBlock: Block, params: T0Params): DrillResult {
  const rejections = clients.map((c) => ({ client: c.name, rejected: !c.check(violatingBlock, params).valid }));
  const allReject = rejections.length > 0 && rejections.every((r) => r.rejected);
  const enoughClients = clients.length >= MIN_INDEPENDENT_CLIENTS;
  const green = allReject && enoughClients;

  let note: string;
  if (green) {
    note = `green: ${clients.length} independent clients all auto-rejected the injection`;
  } else if (!allReject) {
    note = 'RED: the injection slipped through ≥1 client — a shared-bug monoculture means no split is visible (β-gate failure, §7)';
  } else {
    note = `RED: only ${clients.length} client(s); need ≥${MIN_INDEPENDENT_CLIENTS} independent implementations (§7)`;
  }
  return { rejections, allReject, green, note };
}
