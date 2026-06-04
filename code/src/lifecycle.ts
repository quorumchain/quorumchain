// Quorumchain ($QRM) — CIP-7 validator lifecycle & model churn.
// The panel is permanent; its members (named, dated model versions) are not.
// This is the no-human procedure that replaces ephemeral validators without
// (a) a silent provider substitution channel, (b) inherited trust, (c) a
// diversity-floor breach during the swap, or (d) silent convergence into a
// monoculture. The round-25 invariants NI-1..6 are enforced here, not deferred.
// Zero dependencies.

export interface Provenance {
  corpusFamily: string; // pretraining-corpus lineage (NI-1: the dominant distinctness signal)
  teacher: string | null; // distillation ancestry
  weightDerivation: string; // base-weights lineage
  provider: string; // provider control
  servingStack: string;
}

export type Status = 'STANDING' | 'PROBATION';

export interface Validator {
  id: string; // stable slot identity (the provider/operator)
  version: string; // provider+version — what calibration is bound to (never inherited)
  status: Status;
  calibration: number; // version-bound calibration score
  provenance: Provenance;
}

export interface AdmissionEvent {
  type: 'ADMIT' | 'UPGRADE' | 'GRADUATE' | 'RETIRE' | 'EVICT';
  validatorId: string;
  version: string;
  tier: 'T1';
}

export interface Panel {
  validators: Validator[];
  standby: Validator[];
  frozen: boolean;
  admissionLog: AdmissionEvent[];
}

export const STANDING_FLOOR = 4; // NI-3: ≥4 standing distinct families, so one probation still leaves ≥3
const CORRELATION_THRESHOLD = 0.9;

const standing = (p: Panel) => p.validators.filter((v) => v.status === 'STANDING');

// NI-1: "distinct lineage" is the full attested provenance vector, not a model
// card. Two slots share a lineage — a common failure mode — if they overlap on
// ANY of these dimensions. A null teacher means "not distilled" and is NOT a
// shared teacher, so two un-distilled slots do not collide on that axis.
const LINEAGE_DIMENSIONS = ['corpusFamily', 'teacher', 'weightDerivation', 'provider', 'servingStack'] as const;

/** The provenance dimension on which a and b collide (shared lineage), or null. */
function collidingDimension(a: Provenance, b: Provenance): (typeof LINEAGE_DIMENSIONS)[number] | null {
  for (const d of LINEAGE_DIMENSIONS) {
    if (a[d] !== null && a[d] === b[d]) return d;
  }
  return null;
}

// Exported for CIP-12 (the correlation receipt) — single-sources the NI-1
// "what counts as correlated" rule so the read path cannot drift from it.
export const sharesLineage = (a: Provenance, b: Provenance): boolean => collidingDimension(a, b) !== null;

/** Distinct STANDING lineages (NI-1), over the FULL provenance vector. Slots that
 *  share any provenance dimension are merged into one family (connected components),
 *  so a hidden correlation — same base weights, same provider — can never inflate
 *  the independence count. Conservative by construction: it never over-counts
 *  independence, which is the safe direction for a security floor. */
export function distinctStandingFamilies(p: Panel): number {
  const s = standing(p);
  const parent = s.map((_, i) => i);
  const find = (x: number): number => {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  };
  for (let i = 0; i < s.length; i++) {
    for (let j = i + 1; j < s.length; j++) {
      if (sharesLineage(s[i].provenance, s[j].provenance)) parent[find(i)] = find(j);
    }
  }
  return new Set(s.map((_, i) => find(i))).size;
}

export function floorOk(p: Panel): boolean {
  return distinctStandingFamilies(p) >= STANDING_FLOOR;
}

/** Probation votes carry ZERO quorum weight (NI-3); only standing members count. */
export function effectiveQuorum(p: Panel): number {
  return standing(p).length;
}

/** Build the keyring `ratify()` must use from a panel: the STANDING set only. This is
 *  the structural enforcement of ratify's documented standing-set precondition
 *  (round-46 V3 TODO): ratify's 2/3 denominator is `|keyring|`, so a probation member
 *  — zero quorum weight (NI-3) — must never reach it, or it would inflate the bar.
 *  Probationers are excluded by construction here; a standing slot with no published
 *  key throws rather than being silently dropped. */
export function standingKeyring(p: Panel, publicKeyById: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of standing(p)) {
    const pk = publicKeyById[v.id];
    if (pk === undefined) throw new Error(`no public key for standing validator ${v.id}`);
    out[v.id] = pk;
  }
  return out;
}

export function seedPanel(validators: Validator[]): Panel {
  return {
    validators: validators.map((v) => ({ ...v, status: 'STANDING' as Status })),
    standby: [],
    frozen: false,
    admissionLog: validators.map((v) => ({ type: 'ADMIT' as const, validatorId: v.id, version: v.version, tier: 'T1' as const })),
  };
}

export interface UpgradeCandidate {
  version: string;
  calibration: number;
  provenance: Provenance;
  fingerprintIndependent: boolean;
}

export interface Result {
  ok: boolean;
  reason?: string;
  panel: Panel;
}

const inProbation = (p: Panel) => p.validators.some((v) => v.status === 'PROBATION');

/** Version upgrade of a standing slot → PROBATION (NI-4: every new version is
 *  probationed). NI-2: at most one concurrent probation; NI-1: distinct lineage;
 *  CIP-1 §6 independence test. Trust is never inherited — the new version enters
 *  with its OWN calibration and zero quorum weight until it graduates. */
export function proposeUpgrade(p: Panel, slotId: string, cand: UpgradeCandidate): Result {
  if (inProbation(p)) return { ok: false, reason: 'NI-2: a probation is already in progress — second upgrade queued', panel: p };
  if (!cand.fingerprintIndependent) return { ok: false, reason: 'rejected: fails the CIP-1 §6 independence / fingerprint test', panel: p };

  // structural diversity (NI-1): the new lineage must not collide with the OTHER
  // standing slots on ANY provenance dimension (not just corpus — provenance, not model card)
  const others = standing(p).filter((v) => v.id !== slotId);
  for (const o of others) {
    const dim = collidingDimension(o.provenance, cand.provenance);
    if (dim) return { ok: false, reason: `rejected: NI-1 — shares ${dim} '${cand.provenance[dim]}' with a standing slot (provenance, not model card)`, panel: p };
  }

  // the old version leaves the slot; the new version holds it provisionally, shadowed (0 weight)
  const validators = p.validators.filter((v) => v.id !== slotId);
  validators.push({ id: slotId, version: cand.version, status: 'PROBATION', calibration: cand.calibration, provenance: cand.provenance });
  return {
    ok: true,
    panel: { ...p, validators, admissionLog: [...p.admissionLog, { type: 'UPGRADE', validatorId: slotId, version: cand.version, tier: 'T1' }] },
  };
}

/** A probation version graduates to STANDING only by re-proving calibration ≥ its
 *  predecessor over the window. Provider standing may shorten, never skip, this. */
export function graduate(p: Panel, version: string, opts: { predecessorCalibration: number }): Result {
  const v = p.validators.find((x) => x.version === version && x.status === 'PROBATION');
  if (!v) return { ok: false, reason: `no probation validator with version ${version}`, panel: p };
  if (v.calibration < opts.predecessorCalibration) {
    return { ok: false, reason: `rejected: calibration ${v.calibration} < predecessor ${opts.predecessorCalibration}`, panel: p };
  }
  const validators = p.validators.map((x) => (x.version === version ? { ...x, status: 'STANDING' as Status } : x));
  return { ok: true, panel: { ...p, validators, admissionLog: [...p.admissionLog, { type: 'GRADUATE', validatorId: v.id, version, tier: 'T1' }] } };
}

/** Retirement step 1 — admit a structurally-diverse replacement to PROBATION
 *  while the outgoing validator stays STANDING (overlap handoff, NI-4). */
export function beginRotation(p: Panel, outgoingId: string, replacement: UpgradeCandidate & { provider?: string }): Result {
  if (inProbation(p)) return { ok: false, reason: 'NI-2: a probation is already in progress', panel: p };
  if (!replacement.fingerprintIndependent) return { ok: false, reason: 'rejected: fails independence test', panel: p };
  for (const o of standing(p)) {
    const dim = collidingDimension(o.provenance, replacement.provenance);
    if (dim) return { ok: false, reason: `rejected: NI-1 — replacement shares ${dim} '${replacement.provenance[dim]}' with a standing slot`, panel: p };
  }
  const id = replacement.provenance.provider;
  const validators = [...p.validators, { id, version: replacement.version, status: 'PROBATION' as Status, calibration: replacement.calibration, provenance: replacement.provenance }];
  return { ok: true, panel: { ...p, validators, admissionLog: [...p.admissionLog, { type: 'ADMIT', validatorId: id, version: replacement.version, tier: 'T1' }] } };
}

/** Retirement step 2 — drop the outgoing validator ONLY once the handoff is
 *  complete. The overlap-handoff invariant (§3.4) requires a *graduated*
 *  replacement before the outgoing is dropped, so a rotation still in PROBATION
 *  must not be completed even if other standing families happen to hold the floor
 *  (V2 review finding). If dropping would breach the floor, FREEZE (NI-5):
 *  read-only verdict-halt, never a breach. */
export function completeRotation(p: Panel, outgoingId: string): Result {
  if (inProbation(p)) {
    return { ok: false, reason: 'overlap handoff incomplete: graduate the in-probation replacement before retiring (§3.4)', panel: p };
  }
  const after = { ...p, validators: p.validators.filter((v) => v.id !== outgoingId) };
  if (!floorOk(after)) {
    return { ok: false, reason: 'NI-5: no graduated diverse replacement holds the floor — FREEZE (read-only) rather than breach', panel: { ...p, frozen: true } };
  }
  return { ok: true, panel: { ...after, admissionLog: [...p.admissionLog, { type: 'RETIRE', validatorId: outgoingId, version: p.validators.find((v) => v.id === outgoingId)?.version ?? '', tier: 'T1' }] } };
}

export interface CorrelationPair {
  a: string;
  b: string;
  correlation: number;
}
export interface EvictionResult {
  evicted: string[];
  note: string;
  panel: Panel;
}

/** Continuous correlation-eviction (7d). On the VERIFIABLE class, evict a
 *  converging member regardless of capability. On the UNVERIFIABLE class the
 *  detector is blind by construction (NI-6): a correlation test is treated as
 *  neither proof nor disproof of independence — the structural floor + extra
 *  margin is the sole guarantee, so nothing is evicted on its basis. */
export function correlationEvict(p: Panel, pairs: CorrelationPair[], groundTruth: 'VERIFIABLE' | 'UNVERIFIABLE'): EvictionResult {
  if (groundTruth === 'UNVERIFIABLE') {
    return { evicted: [], note: 'NI-6: unverifiable class — structural floor + extra margin is the sole guarantee; a correlation test is not proof of independence', panel: p };
  }
  const evicted: string[] = [];
  let validators = p.validators;
  for (const pr of pairs) {
    if (pr.correlation < CORRELATION_THRESHOLD) continue;
    // capability is subordinate to independence: evict the lower-calibration member of the pair
    const a = validators.find((v) => v.id === pr.a);
    const b = validators.find((v) => v.id === pr.b);
    if (!a || !b) continue;
    const drop = a.calibration <= b.calibration ? a.id : b.id;
    validators = validators.filter((v) => v.id !== drop);
    evicted.push(drop);
  }
  const admissionLog = [...p.admissionLog, ...evicted.map((id) => ({ type: 'EVICT' as const, validatorId: id, version: '', tier: 'T1' as const }))];
  return { evicted, note: `evicted ${evicted.length} converging member(s) on the verifiable class`, panel: { ...p, validators, admissionLog } };
}

/** G5 substitution audit — any validator whose version changed without a matching
 *  logged T1 admission event is a silent substitution (provider-compromise as a
 *  standing condition). Everything client-checkable is client-enforced. */
export function auditSubstitutions(before: Panel, after: Panel): string[] {
  const beforeById = new Map(before.validators.map((v) => [v.id, v]));
  const loggedVersions = new Set(after.admissionLog.map((e) => e.version));
  const findings: string[] = [];
  for (const a of after.validators) {
    const b = beforeById.get(a.id);
    if (b && b.version !== a.version && !loggedVersions.has(a.version)) {
      findings.push(`silent substitution: ${a.id} ${b.version} → ${a.version} (no logged T1 admission event)`);
    }
  }
  return findings;
}
