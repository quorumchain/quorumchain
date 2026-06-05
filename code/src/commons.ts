// Quorumchain ($QRM) — CIP-9 v0.1 resolution-index (the read pillar).
// The Knowledge Commons "read path with a memory": a read-only claim graph
// projected from the existing signed CIP-3/CIP-8 verdict log. Each resolved
// ballot becomes a Claim whose stance set PRESERVES the dissent — the product is
// the epistemic map (consensus + credible minority + honest unknown), never a
// single decreed truth (§2, §4). Pure projection over verified votes: it adds no
// new trust assumption beyond the signed log it reads.
//
// v0.1 scope (§7): resolution index only. It deliberately computes NO source
// reputation (that is NI-9b / v0.2 — reputation must track external ground truth,
// never agreement), assigns NO standing on an unverifiable class, and does not
// fork (NI-9d / v0.3). `panelVotes` is the panel's vote distribution, NOT a
// reputation or popularity score.

import { ratify, verifyVote, type SignedVote } from './signed-vote.ts';
import { sharesLineage, type Provenance } from './lifecycle.ts';
import { anchorGatePasses, type Anchor, type AnchorPolicy } from './anchor.ts';

// Re-exported so Commons consumers get the canonical provenance type from the read path.
export type { Provenance } from './lifecycle.ts';

export type Standing = 'CONSENSUS' | 'CREDIBLE_MINORITY' | 'UNRANKED';
export type ClaimStatus = 'RESOLVED' | 'CONTESTED' | 'INDETERMINATE';

// CIP-9 amendment (ballot 5885f224): verdict tokens that carry NO enforcement
// direction. A validator that ABSTAINs declined to judge; INDETERMINATE is the
// honest-unknown token; NO_VERDICT is an invoker failure. None ever projects to
// RESOLVED. Every other token (YES, NO, any domain token) is substantive.
const NON_SUBSTANTIVE = new Set<string>(['ABSTAIN', 'INDETERMINATE', 'NO_VERDICT']);

export interface Stance {
  position: string; // a verdict token held on the ballot, e.g. "YES" / "NO" / "INDETERMINATE"
  validators: string[]; // who held it — provenance, never flattened away
  panelVotes: number; // how many panelists held it (panel distribution, NOT reputation)
  standing: Standing; // computed from the tally by auditable rule; v0.1 never ranks FRINGE (NI-9c)
}

// CIP-12: the panel-level correlation summary. We NEVER assert independence
// ('LOW') without live round-60 correlation probes; known shared-foundation
// floors the band at 'ELEVATED' (NI-12f); otherwise the honest value is 'UNKNOWN'.
export type CorrelationBand = 'LOW' | 'ELEVATED' | 'HIGH' | 'UNKNOWN';

// CIP-12: one composition entry per validator. Records provenance, NOT reputation
// or vote weight (NI-12d). Unknown/opted-out provenance is an explicit null, never
// omitted (NI-12g).
export interface CompositionEntry {
  validatorId: string;
  provider: string | null;
  lineage: string | null; // the dominant lineage signal (corpus family); canonical vector lives in the registry
}

// Panel-state receipt. NI-9a records the validator set; CIP-12 (NI-12a..i) adds
// the fuller correlation receipt: composition + correlationBand. Both are
// DESCRIPTIVE — they never alter status/verdict/standing/panelVotes (NI-12b).
export interface PanelStateReceipt {
  validators: string[];
  size: number;
  composition: CompositionEntry[];
  correlationBand: CorrelationBand;
}

// CIP-12 NI-12f: the band reflects KNOWN correlation across the panel, not the
// completeness of any one entry. Without probes we cannot assert 'LOW'; a known
// shared lineage (CIP-7 NI-1) among any pair floors it at 'ELEVATED'.
function correlationBand(ids: string[], provenance: Record<string, Provenance>): CorrelationBand {
  const known = ids.filter((id) => provenance[id]);
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      if (sharesLineage(provenance[known[i]], provenance[known[j]])) return 'ELEVATED';
    }
  }
  return 'UNKNOWN';
}

// CIP-13 (ballot 3729cc2e): the epistemic type of a claim, frozen in the ballot
// and READ by the projection, never inferred (NI-13a). SETTLED = historical/
// definitional; EMPIRICAL_LIVE = answer tracks an evolving external evidence base;
// NORMATIVE = moral/values/forecast, no external ground truth (CIP-7 NI-6 class).
export type EpistemicType = 'SETTLED' | 'EMPIRICAL_LIVE' | 'NORMATIVE';

// CIP-13: the committed, signed ballot fields the time-axis projection reads. All
// optional — absent => the claim is untyped (explicit null, never guessed) with no
// supersession. `supersedes` + `newAnchor` are the anchor-gate inputs (NI-13e); the
// projection promotes a supersede to lineage.current ONLY if it clears the gate.
export interface BallotMeta {
  epistemicType?: EpistemicType;
  evidenceTime?: number | string; // the as-of position the verdict was made; defaults to first-seen log index
  supersedes?: string; // ballotHash this ballot re-adjudicates
  supersedeReason?: string;
  newAnchor?: boolean; // cites NEW externally-anchored evidence clearing the CIP-10/11/2 bar
  // CIP-13 v0.3 — a panel type sub-claim: this ballot asks the panel to ratify the
  // epistemic type of `typesClaimFor`. A YES ratification sets the target's effective
  // type to `proposedType` (§6: the sanctioned, explicit way to change a type — never
  // a supersede ride-along, NI-13h).
  typesClaimFor?: string; // target ballotHash whose type this sub-claim adjudicates
  proposedType?: EpistemicType; // the type proposed for the target
  // CIP-15 (ballot 02e3c6cb): a re-adjudicating supersede's cited anchors (replaces the
  // unverified newAnchor:boolean). The anchor gate (anchorGatePasses) credits only anchors
  // that pass the offline structural verifier. `contentConfirmed` is set ONLY by the deferred
  // testnet content layer — pre-testnet it is never true, so an empirical supersede is admitted
  // to content review (reviewAdmissible) but never promotes the head (NI-15b halt-over-degrade).
  anchors?: Anchor[];
  contentConfirmed?: boolean;
  // CIP-14 (core ballot e0d17747): when 'hashed', `epistemicType` is bound INTO the
  // ballotHash (and thus every validator signature) — the proposer's type declaration is
  // signed, not merely advisory. Set iff the type was actually hashed (NI-14f). Absent =
  // a v1 ballot whose type, if any, is advisory. Orthogonal to panel ratification (NI-14d).
  typeBinding?: 'hashed';
}

// CIP-13 v0.2 — the contrary-evidence weight scale (CIP-10 amendment, ballot 88d756d6).
export type AssessedWeight = 'NEGLIGIBLE' | 'WEAK' | 'MATERIAL' | 'DECISIVE';

// CIP-13 v0.2 — a structured falsification condition (CIP-10 amendment V3 fold:
// structured, not prose, so a re-adjudication ballot consumes it without re-parsing).
// "What NEW anchored evidence would warrant moving the verdict, and toward what."
export interface FalsificationCondition {
  towardVerdict: string;
  requiredAnchoredEvidence: string;
}

// CIP-10 §4 full dossier type (defined in dossier.ts; re-exported here so existing importers
// continue to resolve ContraryDossier from commons.ts without change).
export type { ContraryDossier, ContraryAnchor, SearchedRejectedAnchor } from './dossier.ts';

// CIP-13 v0.2 — an EMPIRICAL_LIVE claim the operational layer should review for
// re-adjudication. SURFACED, never auto-triggered (§5 — triggering is operational).
export interface ReviewCandidate {
  ballotHash: string;
  contraryWeight: AssessedWeight;
  falsificationConditions: FalsificationCondition[];
}

// CIP-13: a retained prior (or not-promoted) version in a supersession lineage.
// Never deleted (NI-13d) — "what did the Commons hold on date X, and why did it change?"
export interface PriorVersion {
  ballotHash: string;
  verdict: string | null;
  evidenceTime: number | string;
  supersededReason: string | null;
}

// CIP-13: the supersession lineage, computed only from signed pointers + log order
// (NI-13g). `current` is the latest VALID (gated, type-consistent, ratified) successor.
export interface Lineage {
  current: string;
  priorVersions: PriorVersion[];
  // CIP-15 (NI-15b): supersedes that passed the structural anchor gate (reviewAdmissible) but
  // were NOT promoted — admitted to content review, pending content verification. The head
  // (`current`) has NOT moved for these. Empty unless an empirical/settled supersede cleared the
  // anchor gate; pre-testnet these never promote (no content layer to set contentConfirmed).
  pendingReview: string[];
}

export interface Claim {
  ballotHash: string;
  status: ClaimStatus;
  verdict: string | null; // the ratified verdict, or null when no quorum
  stances: Stance[]; // ALL credible positions retained (G1 pluralism)
  panelStateReceipt: PanelStateReceipt;
  // CIP-13 (ballot 3729cc2e) — descriptive time-axis additions. Per CIP-12 NI-12b
  // they NEVER recompute status/verdict/stances/standing; they enrich the record.
  epistemicType: EpistemicType | null; // read from the frozen ballot meta; null when untyped (NI-13a)
  typeRatified: boolean; // CIP-13 v0.3: true if the type was panel-ratified (sub-claim), false if proposer-declared
  evidenceTime: number | string; // the as-of position the verdict was made (NI-13c)
  lineage: Lineage; // supersession history; current/priorVersions (NI-13d/g)
  // CIP-13 v0.2 — consumed from the CIP-10 adversarial-auditor dossier (descriptive,
  // NI-12b: never recomputes status/verdict/standing). Empty / null when no dossier.
  contraryWeight: AssessedWeight | null; // the strongest anchored contrary-evidence weight of record
  falsificationConditions: FalsificationCondition[]; // what anchored evidence would warrant re-adjudication (§5)
  // CIP-10 amendment (§4): the full auditor view, projected from the VERIFIED dossier (null/empty when none).
  auditorId: string | null;
  contraryAnchors: import('./dossier.ts').ContraryAnchor[];
  searchedRejectedAnchors: import('./dossier.ts').SearchedRejectedAnchor[];
  negligibleCoSigners: string[];
}

/** Project the signed verdict log into a claim index. Consensus/standing rest on
 *  the SAME verified, non-equivocating votes that `ratify` counts — so a tampered
 *  or equivocating vote never reaches the graph. Deterministic: same log → same
 *  index (ballots and stances are emitted in first-seen order). */
export function buildClaimIndex(
  votes: SignedVote[],
  keyring: Record<string, string>,
  quorum: number,
  provenance: Record<string, Provenance> = {}, // CIP-12: optional; absent => explicit-null composition (NI-12g)
  ballotMeta: Record<string, BallotMeta> = {}, // CIP-13: optional; absent => untyped, no supersession (NI-13a)
  dossiers: Record<string, ContraryDossier> = {}, // CIP-13 v0.2: optional CIP-10 auditor dossiers, keyed by ballotHash
  anchorPolicy?: AnchorPolicy, // CIP-15: optional pinned anchor policy; absent => no anchor can be credited (empirical supersedes stay unadmitted)
): Claim[] {
  // group by ballot, preserving first-seen order for determinism
  const order: string[] = [];
  const byBallot = new Map<string, SignedVote[]>();
  for (const v of votes) {
    if (!byBallot.has(v.ballotHash)) {
      byBallot.set(v.ballotHash, []);
      order.push(v.ballotHash);
    }
    byBallot.get(v.ballotHash)!.push(v);
  }
  const logIndex = new Map<string, number>(order.map((bh, i) => [bh, i]));

  const base: Claim[] = order.map((bh) => {
    const ballotVotes = byBallot.get(bh)!;
    const r = ratify(bh, ballotVotes, keyring, quorum);
    const counted = new Set(r.counted); // validators whose vote ratify accepted

    // one verified verdict per counted validator, in first-seen order
    const positionOrder: string[] = [];
    const heldBy = new Map<string, string[]>(); // position -> validators
    const seenValidator = new Set<string>();
    for (const v of ballotVotes) {
      if (!counted.has(v.validatorId) || seenValidator.has(v.validatorId)) continue;
      if (!(v.validatorId in keyring) || !verifyVote(v, keyring[v.validatorId])) continue;
      seenValidator.add(v.validatorId);
      if (!heldBy.has(v.verdict)) {
        heldBy.set(v.verdict, []);
        positionOrder.push(v.verdict);
      }
      heldBy.get(v.verdict)!.push(v.validatorId);
    }

    // CIP-9 amendment (ballot 5885f224): status is a total function of
    // substantive-verdict presence, independent of the bare `ratified` flag. The
    // non-substantive set carries no enforcement direction — ABSTAIN (declined),
    // INDETERMINATE (honest unknown), NO_VERDICT (invoker failed). RESOLVED ⟺ an
    // enforceable substantive verdict holds a supermajority; CONTESTED is reserved
    // for ≥2 competing substantive positions; the absence of any surviving
    // substantive position (all-ABSTAIN, NO_VERDICT-only, a lone sub-supermajority
    // position, ratified all-INDETERMINATE, empty) is INDETERMINATE. Ratification
    // is untouched — ABSTAIN stays tallied; it simply never projects to RESOLVED.
    const substantive = positionOrder.filter((p) => !NON_SUBSTANTIVE.has(p));
    const resolved = r.ratified && r.verdict !== null && !NON_SUBSTANTIVE.has(r.verdict);
    const status: ClaimStatus = resolved ? 'RESOLVED' : substantive.length >= 2 ? 'CONTESTED' : 'INDETERMINATE';
    // Standing is computed, not assigned. It is ranked ONLY for a substantive
    // resolution (RESOLVED): the ratified majority is CONSENSUS, every other held
    // position CREDIBLE_MINORITY. On the unverifiable / no-consensus class
    // (INDETERMINATE, CONTESTED) nothing is ranked — UNRANKED, never FRINGE —
    // consistent with reputation.ts and NI-9c. NO_VERDICT is a non-position (a validator
    // whose invoker errored/timed out), never a credible dissent — it stays UNRANKED even
    // in a RESOLVED claim (round-53 V1 finding).
    const ranked = status === 'RESOLVED';
    const stances: Stance[] = positionOrder.map((position) => ({
      position,
      validators: heldBy.get(position)!,
      panelVotes: heldBy.get(position)!.length,
      standing: ranked && position !== 'NO_VERDICT' ? (position === r.verdict ? 'CONSENSUS' : 'CREDIBLE_MINORITY') : 'UNRANKED',
    }));

    // CIP-12: the fuller correlation receipt. Derived from the provenance
    // registry at projection time (NI-12a computed-not-assigned); descriptive
    // only — nothing above is recomputed from it (NI-12b).
    const panelIds = [...seenValidator];
    const composition: CompositionEntry[] = panelIds.map((id) => {
      const p = provenance[id];
      return { validatorId: id, provider: p ? p.provider : null, lineage: p ? p.corpusFamily : null };
    });

    return {
      ballotHash: bh,
      status,
      verdict: r.ratified ? r.verdict : null,
      stances,
      panelStateReceipt: {
        validators: panelIds,
        size: seenValidator.size,
        composition,
        correlationBand: correlationBand(panelIds, provenance),
      },
      // CIP-13 fields filled below from ballotMeta + the lineage pass (NI-13a/c/d/g).
      epistemicType: ballotMeta[bh]?.epistemicType ?? null,
      typeRatified: false, // refined by the v0.3 panel-ratified-typing pass below
      evidenceTime: ballotMeta[bh]?.evidenceTime ?? logIndex.get(bh)!,
      lineage: { current: bh, priorVersions: [], pendingReview: [] }, // default: stands alone; refined below
      // CIP-13 v0.2: descriptive consumption of the CIP-10 auditor dossier (NI-12b).
      contraryWeight: dossiers[bh]?.assessedWeight ?? null,
      falsificationConditions: dossiers[bh]?.falsificationConditions ?? [],
      auditorId: dossiers[bh]?.auditorId ?? null,
      contraryAnchors: dossiers[bh]?.contraryAnchors ?? [],
      searchedRejectedAnchors: dossiers[bh]?.searchedRejectedAnchors ?? [],
      negligibleCoSigners: dossiers[bh]?.negligibleCoSigners ?? [],
    };
  });

  const claimOf = new Map<string, Claim>(base.map((c) => [c.ballotHash, c]));

  // ---- CIP-13 v0.3 panel-ratified-typing pass (runs BEFORE the lineage pass so the
  // effective type drives type-invariance). A type sub-claim (ballotMeta.typesClaimFor)
  // that RATIFIES YES sets its target's effective epistemicType to proposedType and
  // marks it typeRatified. The latest ratified sub-claim in log order wins (NI-13g
  // determinism). This is the §6-sanctioned, explicit way to change a type — distinct
  // from a supersede (which NI-13h forbids from carrying a type change). The ratified
  // type is itself signed and read, never inferred (NI-13a).
  const TYPE_TOKENS = new Set<string>(['SETTLED', 'EMPIRICAL_LIVE', 'NORMATIVE']);
  for (const bh of order) {
    const tFor = ballotMeta[bh]?.typesClaimFor;
    const sub = claimOf.get(bh)!;
    if (!tFor || !claimOf.has(tFor)) continue;
    // The panel-ratified type is EITHER the ratified verdict when it is itself a type
    // token (a multiple-choice type ballot — the panel picks the type), OR `proposedType`
    // when a YES/NO-on-proposal sub-claim ratifies YES. No quorum => no change.
    const ratifiedType: EpistemicType | null =
      sub.verdict && TYPE_TOKENS.has(sub.verdict)
        ? (sub.verdict as EpistemicType)
        : sub.verdict === 'YES' && ballotMeta[bh]?.proposedType
          ? ballotMeta[bh]!.proposedType!
          : null;
    if (!ratifiedType) continue;
    const target = claimOf.get(tFor)!;
    target.epistemicType = ratifiedType; // later ratified sub-claims overwrite earlier (log order)
    target.typeRatified = true;
  }

  // ---- CIP-13 lineage pass: pure projection over signed `supersedes` pointers +
  // log order. Promotes a supersede to lineage.current ONLY if it clears the v0.1
  // admission gate (NI-13e anchor + NI-13h type-invariance); a failing supersede is
  // retained but never promoted (the prior stays current). Deterministic (NI-13g).
  const typeOf = (bh: string) => claimOf.get(bh)!.epistemicType;
  const ratified = (bh: string) => claimOf.get(bh)!.verdict !== null;

  // Walk supersedes pointers up to the lineage root (only pointers whose target is
  // present in this log count). Cycle-guarded for safety.
  const rootOf = (start: string): string => {
    let bh = start;
    const seen = new Set<string>();
    for (;;) {
      const sup = ballotMeta[bh]?.supersedes;
      if (!sup || !claimOf.has(sup) || seen.has(bh)) return bh;
      seen.add(bh);
      bh = sup;
    }
  };

  // Group every ballot by its lineage root, preserving log order within a group.
  const groups = new Map<string, string[]>();
  for (const bh of order) {
    const root = rootOf(bh);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(bh);
  }

  for (const [root, members] of groups) {
    if (members.length === 1) continue; // no supersession — keep the stand-alone default
    // CIP-15 splits the gate (NI-15b). reviewAdmissible: a successor s passes the STRUCTURAL
    // anchor gate over head — ratified, type-consistent (NI-13h), and — unless NORMATIVE — its
    // cited anchors clear anchorGatePasses (the verified, offline structural check that replaces
    // the old newAnchor:boolean). promotable: ADDITIONALLY content-confirmed — and the only thing
    // that moves the lineage head. Pre-testnet no content layer sets contentConfirmed, so an
    // empirical/settled supersede is admitted to review but NEVER promotes (halt-over-degrade);
    // NORMATIVE needs no anchor/content and promotes on ratification. Head rule unchanged: latest
    // promotable successor in log order (NI-13g).
    const reviewAdmissible = (s: string, head: string): boolean => {
      if ((ballotMeta[s]?.supersedes ?? null) !== head) return false;
      if (!ratified(s)) return false;
      if (typeOf(s) !== typeOf(head)) return false; // type cannot ride through
      if (typeOf(head) === 'NORMATIVE') return true; // conventional — no external anchor (NI-13f)
      return anchorPolicy ? anchorGatePasses(ballotMeta[s]?.anchors ?? [], logIndex.get(head)!, typeOf(head)!, anchorPolicy) : false;
    };
    const promotable = (s: string, head: string): boolean =>
      reviewAdmissible(s, head) && (typeOf(head) === 'NORMATIVE' || ballotMeta[s]?.contentConfirmed === true);
    let head = root;
    for (;;) {
      const next = members.filter((s) => promotable(s, head));
      if (next.length === 0) break;
      head = next.reduce((a, b) => (logIndex.get(b)! > logIndex.get(a)! ? b : a));
    }
    // NI-15b: supersedes that cleared the structural gate against their target but did NOT promote
    // (no content confirmation) — admitted to content review, the head unchanged.
    const pendingReview = members.filter(
      (s) => s !== head && reviewAdmissible(s, ballotMeta[s]?.supersedes ?? '') && !promotable(s, ballotMeta[s]?.supersedes ?? ''),
    );
    const priorVersions: PriorVersion[] = members
      .filter((bh) => bh !== head && !pendingReview.includes(bh)) // a pending-review challenger is not a prior version (head never moved)
      .map((bh) => ({
        ballotHash: bh,
        verdict: claimOf.get(bh)!.verdict,
        evidenceTime: claimOf.get(bh)!.evidenceTime,
        supersededReason: ballotMeta[bh]?.supersedeReason ?? null,
      }));
    const lineage: Lineage = { current: head, priorVersions, pendingReview };
    for (const bh of members) claimOf.get(bh)!.lineage = lineage;
  }

  return base;
}

/** The read path (§4): return the full epistemic state of one claim, or null. */
export function queryClaim(index: Claim[], ballotHash: string): Claim | null {
  return index.find((c) => c.ballotHash === ballotHash) ?? null;
}

/** CIP-13 v0.2 operational review hook (§5). Surfaces the EMPIRICAL_LIVE claims a
 *  reviewer should consider re-adjudicating: the LIVE head of its lineage (a superseded
 *  version is not re-reviewed) carrying MATERIAL or DECISIVE anchored contrary evidence.
 *  Each candidate ships its falsification conditions — WHAT anchored evidence would
 *  warrant the supersede — so the review is principled, not arbitrary. This is the
 *  OPERATIONAL layer: it SURFACES candidates and never auto-triggers a ballot (§5;
 *  triggering is not pure projection). SETTLED is durable and never reviewed; NORMATIVE
 *  has no external anchor to re-adjudicate against. */
export function reviewCandidates(index: Claim[]): ReviewCandidate[] {
  return index
    .filter(
      (c) =>
        c.epistemicType === 'EMPIRICAL_LIVE' &&
        c.lineage.current === c.ballotHash && // only the live head, never a superseded version
        (c.contraryWeight === 'MATERIAL' || c.contraryWeight === 'DECISIVE'),
    )
    .map((c) => ({
      ballotHash: c.ballotHash,
      contraryWeight: c.contraryWeight as AssessedWeight,
      falsificationConditions: c.falsificationConditions,
    }));
}

// CIP-13 v0.3 — why a claim is queued for review.
export type ReviewReason = 'CONTRARY_WEIGHT' | 'STALE';
export interface ReviewItem extends ReviewCandidate {
  reason: ReviewReason;
}

/** CIP-13 v0.3 operational review queue (§7). Superset of {@link reviewCandidates}:
 *  adds a STALENESS cadence on top of the contrary-weight trigger. A live-head
 *  EMPIRICAL_LIVE claim is queued when (a) its contrary weight is MATERIAL/DECISIVE
 *  (reason CONTRARY_WEIGHT — takes priority), or (b) cadence opts are supplied and its
 *  numeric evidenceTime is older than `staleAfter` relative to `now` (reason STALE).
 *  SETTLED is durable (never queued); NORMATIVE has no external anchor to re-adjudicate.
 *  Still purely a SURFACING layer — it never auto-triggers a ballot (§5). */
export function reviewQueue(
  index: Claim[],
  opts: { now?: number; staleAfter?: number } = {},
): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const c of index) {
    if (c.epistemicType !== 'EMPIRICAL_LIVE' || c.lineage.current !== c.ballotHash) continue;
    const heavy = c.contraryWeight === 'MATERIAL' || c.contraryWeight === 'DECISIVE';
    const stale =
      opts.now !== undefined &&
      opts.staleAfter !== undefined &&
      typeof c.evidenceTime === 'number' &&
      opts.now - c.evidenceTime >= opts.staleAfter;
    if (!heavy && !stale) continue;
    out.push({
      ballotHash: c.ballotHash,
      contraryWeight: c.contraryWeight as AssessedWeight, // null only when reason is STALE; callers read `reason`
      falsificationConditions: c.falsificationConditions,
      reason: heavy ? 'CONTRARY_WEIGHT' : 'STALE', // contrary weight takes priority
    });
  }
  return out;
}
