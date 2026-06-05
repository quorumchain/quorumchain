# CIP-13 — Claim Epistemic Typing & Re-adjudication (Category A — Application / Product, read-path extension)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ **Ratified (RATIFY 3/3, ballot `3729cc2e…`) · v0.1 + v0.2 + v0.3 IMPLEMENTED under TDD (272/272 tests green).** Red-team ballot `c5439212…` found two material flaws — folded as NI-13h, the v0.1 anchor-gate, and the explicit head rule; re-convened and ratified unanimously. **v0.1** (typed projection + gated supersession lineage), **v0.2** (falsification conditions consumed from the ratified CIP-10 adversarial-auditor dossier `88d756d6…` + the `reviewCandidates` hook), and **v0.3** (panel-ratified typing via type sub-claims + the `reviewQueue` cadence) ship in `code/src/commons.ts` (`EpistemicType`/`AssessedWeight`/`FalsificationCondition`/`ContraryDossier`, extended `Claim` with `typeRatified`, gated lineage pass + dossier consumption + panel-typing pass in `buildClaimIndex`, `reviewCandidates`/`reviewQueue`), surfaced through `commons-read.ts`/`commons-render.ts`, tested in `test/commons-cip13.test.ts` (G13a–h + NI-13a/b/c/d/e/g/h + v0.2/v0.3 dossier/review/typing/regression, 32 tests). Next (data-plumbing, not protocol): plumb `epistemicType`/dossiers/type-sub-claims into the ballot registry so live convenes declare them, then run `reviewQueue` over the real corpus.
- **Date:** 2026-06-05
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal) — *to be convened*
- **Human steward:** dev
- **Depends on:** [[CIP-9]] (computed standing + the read path; this implements its §3 `history` / §6 "superseded with a reason", deferred at v0.1), [[CIP-2]]/NI-9b (external-anchor reputation — the re-adjudication bar), [[CIP-10]] (anchor-gating + the adversarial auditor that yields falsification conditions), [[CIP-11]] (anchor diversity), [[CIP-3]]/[[CIP-4]] (signed hash-chained versioning; frozen history — no silent rewrite), [[CIP-5]] (forkability — a mis-type is a fork, not an error), [[CIP-7]] NI-6 (AI consensus is conventionality, not truth), [[CIP-12]] (the discipline that descriptive additions never recompute status/verdict/standing)

> **Scope.** CIP-13 extends the Knowledge Commons read path along the **time axis**. Today a claim is a flat projection of one ballot, marked `RESOLVED | CONTESTED | INDETERMINATE` once, forever. Two real failures follow: (1) a coarse empirical claim ("are mRNA COVID vaccines safe?") gets a binary verdict that a *later, validated* refinement (rare myocarditis in young males) makes look wrong — when in truth the verdict was only ever "best judgment as of date D"; and (2) the system cannot say *how it knows what it knows will or won't change.* CIP-13 adds two things, both **pure projection over the signed log, no new trust assumption**: a frozen **epistemic type** per claim, and a **re-adjudication lineage** (supersede-by-recency, never edit). It changes *presentation and history*, never the per-ballot status computation [[CIP-12]] protects.

---

## 1. The problem — the Commons has no honest model of time

The read path resolves a claim once and presents that verdict atemporally. But claims age differently:

- **"Apollo landed on the Moon" (1969–72)** — will not change. A verdict here is durable.
- **"mRNA COVID vaccines are safe"** — the *answer depends on an evolving evidence base.* In 2021 the honest verdict, on the evidence then, leaned YES; by mid-2021+ a real, validated signal (myocarditis/pericarditis, concentrated in young males after dose 2) refined it. The 2021 verdict was not *false* — "safe" was under-specified, and it was only ever "as of the evidence then." A Commons that renders it as timeless truth rots.
- **"Is voluntary euthanasia permissible?"** — never has an external ground truth; a supermajority here is *conventionality* ([[CIP-7]] NI-6), not a settled fact, and may shift with moral consensus.

The current model collapses all three into the same flat `status`. The COVID/myocarditis case is the canonical failure: mostly a **question-granularity** problem (a binary on a coarse claim), compounded by **no re-adjudication path** when validated evidence arrives. CIP-9 already named the cure in principle — §3 `history: VersionRef[]`, §6 *"the past is never deleted, only superseded with a reason"* — but v0.1 shipped the flat projection and deferred it. CIP-13 implements it, and adds the typing that tells a reader which kind of claim they are looking at.

## 2. Core principle — type the claim, and supersede instead of overwrite

Two additions, both derived from the signed log:

1. **Epistemic type** — every ballot declares, in its frozen criteria, what *kind* of question it is. The type is hashed into the ballot (`sha256(statement || criteria || epistemicType)`), so it is in the signed record and the projection merely reads it — never infers it. The type **modulates how a verdict is presented, never what status is computed.**
2. **Re-adjudication lineage** — a new ballot may carry a signed `supersedes` pointer to a prior ballot + a reason. The projection groups ballots into a lineage; the **current** view is the latest ratified verdict by log order, and **every prior verdict — with its evidence, time, and dissent — is retained and retrievable.** Supersession *appends*; it never edits. This is [[CIP-4]] frozen history applied to the read path, and it is **forward-only** by construction.

## 3. Structure — additions to the `Claim` model (`code/src/commons.ts`)

```
EpistemicType = SETTLED        // historical/definitional; not expected to change (Apollo, H2O, a final court ruling)
              | EMPIRICAL_LIVE  // answer tracks an evolving external evidence base (drug safety, "is X still true")
              | NORMATIVE       // moral/values/forecast; no external ground truth ([[CIP-7]] NI-6 class)

Claim {
  ballotHash, status, verdict, stances[], panelStateReceipt,   // unchanged — CIP-9/CIP-12
  epistemicType,            // NEW — read from the frozen ballot (NI-13a)
  evidenceTime,             // NEW — the log position/timestamp the verdict was made "as of"
  lineage {                 // NEW — supersession history, computed from signed pointers + log order
    current: ballotHash,    // latest ratified verdict in the lineage
    priorVersions: [{ ballotHash, verdict, evidenceTime, supersededReason }]   // retained, never deleted
  }
}
```

- `epistemicType`, `evidenceTime`, and `lineage` are **new descriptive fields**. Per [[CIP-12]] NI-12b they do **not** recompute the existing `status`/`verdict`/`stances`/`standing` of any ballot. A re-projection of today's log yields byte-identical existing fields plus the new ones.
- `lineage` is derived **only** from signed `supersedes` pointers and log order — deterministic, same log → same lineage (NI-13g). No editor, no off-chain ordering.

## 4. The read path — "best judgment as of D," with its lineage

A query still returns the full epistemic state, now with **time**: the current verdict, its epistemic type, the date/evidence it was made as of, and — for a re-adjudicated claim — the ordered history of what was held before and the reason each was superseded. An `EMPIRICAL_LIVE` resolution is surfaced as **provisional / as-of-D / open to anchored re-adjudication**, never as settled truth. A `NORMATIVE` supermajority is surfaced as **the panel's majority position as of D (conventional, not true)**. A `SETTLED` resolution is durable. The product becomes *"here is the best current judgment, what kind of question it is, when it was made, and exactly how and why it changed"* — which is strictly more honest than a frozen snapshot, and is the property the COVID case exposes as missing.

## 5. Re-adjudication is anchor-gated — no relitigation-by-vibes

The obvious abuse: relitigate a claim until you get the answer you want, or bury an inconvenient claim by re-typing it. Both are the [[CIP-9]] §9.6 "UNVERIFIABLE dumping ground" / [[CIP-7]] resolvable-gaming shape, on the time axis. Defense, reusing existing machinery:

- **The anchor gate is a v0.1 admission/projection-validity rule, not a v0.2 add-on** (the c5439212 red-team, V2). A superseding ballot for a `SETTLED` or `EMPIRICAL_LIVE` claim **must cite NEW externally-anchored evidence** clearing the [[CIP-10]]/[[CIP-11]]/[[CIP-2]] bar; a supersede that fails the gate **does not become `lineage.current`** — the prior version stays current and the failed supersede is recorded as `invalid`/`pending`, never silently promoted. You cannot supersede on agreement or rhetoric, and the protection exists from the first shipped version, not after it.
- **Type is invariant across a supersession lineage** (the c5439212 red-team, V1 — NI-13h). A `supersedes` ballot MUST carry the **same** `epistemicType` as the ballot it supersedes; a type mismatch is rejected at the same admission step as the anchor gap. Changing a claim's type is therefore **never** a ride-along on a substantive supersede — it is a [[CIP-5]] **fork** (a new, independent lineage), or, once v0.3 lands, an explicit panel-ratified type sub-claim. This closes the "clear the anchor bar on substance, silently relabel the claim" attack; a YES vote on a ballot *signs* its declared type but does not *adjudicate* it (v0.1), so type may not change under cover of a substantive re-adjudication.
- **Competing-successor head rule is explicit, not silent** (the c5439212 red-team, V2). When more than one *valid* (gated, type-consistent, ratified) successor to the same prior exists, `lineage.current` is **the latest such successor in log order — and this is the adjudicated head rule, stated as the convention**, deterministic and CIP-9-consistent (NI-13g). Divergence the head rule does not subsume is a [[CIP-5]] fork (two independent lineages, both readable), never a silent pick.
- The **falsification conditions** for an `EMPIRICAL_LIVE` claim SHOULD be declared in its frozen criteria — *what anchored evidence would warrant re-adjudication.* This is the natural product of the [[CIP-10]] **adversarial auditor / contrary-evidence dossier** (companion CIP-10 amendment): the auditor's dossier pre-states the falsification conditions, so a later re-adjudication is *principled*, not arbitrary. CIP-13 records the conditions; it does not auto-trigger (triggering is an operational layer, not pure projection).

## 6. What this does *not* do

- It does not let the protocol see the future or access truth. A 2021 verdict cannot be made "right" about 2023 evidence. CIP-13 buys **wrong legibly, and self-correcting on the record** — the [[CIP-7]] NI-6 honesty boundary, made temporal.
- It does not change ratification, the 2/3 bar, or the per-ballot status total-function ([[CIP-9]] amendment). It adds fields and a lineage view.
- v0.1 does not panel-ratify the *type* (the proposer declares it in the frozen ballot; a mis-type is an auditable, forkable disagreement — NI-9d). Panel-ratified typing is a v0.3 graduation.

## 7. KERNEL_FIRST build path (each stage evidence-gated, per round 26)

- **v0.1 — typed projection + *gated* supersession lineage (read model).** Extend `Claim` with `epistemicType` (read from the frozen ballot), `evidenceTime`, and `lineage` (current/priorVersions from signed `supersedes` pointers). **The admission gate ships in v0.1, not later** (the c5439212 red-team, V2): the projection promotes a supersede to `lineage.current` only if it passes the NI-13e anchor check **and** the NI-13h type-invariance check; a failing supersede is retained as `invalid`/`pending` and the prior stays current. Surface provisional-as-of for `EMPIRICAL_LIVE`, conventional-as-of for `NORMATIVE`. Pure projection; no new trust assumption. Smallest runnable slice that is *safe* — there is no version in which lineage exists without its gate.
- **v0.2 — falsification conditions + auditor integration.** ✅ **Implemented.** `Claim` gains `contraryWeight` (the dossier's `assessedWeight`) and structured `falsificationConditions`, consumed from the [[CIP-10]] adversarial-auditor dossier via `buildClaimIndex`'s `dossiers` input — descriptive only (NI-12b regression test confirms status/verdict/stances/lineage byte-identical). The operational review hook `reviewCandidates(index)` surfaces EMPIRICAL_LIVE live-head claims carrying MATERIAL/DECISIVE contrary weight, each shipping its falsification conditions; it never auto-triggers a ballot (§5 — triggering is operational, not pure projection). SETTLED is never reviewed; a superseded version is not re-reviewed.
- **v0.3 — panel-ratified typing + review triggers.** ✅ **Implemented.** A **type sub-claim** (`ballotMeta.typesClaimFor` + `proposedType`) that ratifies YES sets its target's effective `epistemicType` and marks `typeRatified` — the §6-sanctioned, explicit way to change a type (distinct from a supersede, which NI-13h forbids from carrying a type change); the latest ratified sub-claim wins (NI-13g determinism), and the pass runs before the lineage pass so type-invariance sees the effective type. `reviewQueue(index, {now, staleAfter})` is the v0.2 hook plus a **staleness cadence**: a live-head `EMPIRICAL_LIVE` claim is queued for `CONTRARY_WEIGHT` (priority) or `STALE` (numeric `evidenceTime` older than the threshold); SETTLED is never queued. Still pure surfacing — no auto-trigger (§5).

## 8. Non-negotiable invariants (to be hardened by the red-team)

1. **NI-13a — type is frozen and signed, never inferred.** `epistemicType` is part of the hashed ballot; the projection reads it and never guesses. A different type is a different ballot hash (forkable), not a mutation.
2. **NI-13b — type modulates presentation, not computation.** Adding type/time/lineage never changes any ballot's `status`/`verdict`/`stances`/`standing` ([[CIP-12]] NI-12b). Re-projecting today's log leaves all existing fields byte-identical.
3. **NI-13c — no empirical claim is ever atemporally RESOLVED.** An `EMPIRICAL_LIVE` resolution always carries its `evidenceTime` and is presented as provisional / open to anchored re-adjudication; the Commons never renders it as settled-for-all-time. *(The COVID/myocarditis fix.)*
4. **NI-13d — supersession appends, never edits.** A superseding verdict is a NEW signed ballot referencing the prior; the prior verdict, its evidence, and its dissent remain retrievable forever ([[CIP-4]]/[[CIP-9]] §6). "What did the Commons hold on date X, and why did it change?" is always answerable.
5. **NI-13e — re-adjudication is anchor-gated, from v0.1.** Promoting a supersede to `lineage.current` for a `SETTLED`/`EMPIRICAL_LIVE` claim requires NEW externally-anchored evidence clearing the [[CIP-10]]/[[CIP-11]]/[[CIP-2]] bar; a no-new-anchor supersede is **not promoted** (recorded `invalid`/`pending`, prior stays current). The gate is part of v0.1 projection validity, not a deferred add-on (the c5439212 red-team, V2). No relitigation-by-agreement.
6. **NI-13f — normative consensus is conventional, never truth.** A `NORMATIVE` supermajority is recorded as "the panel's majority position as of D (conventionality, [[CIP-7]] NI-6)," never RESOLVED-true; dissent stays first-class, never a footnote.
7. **NI-13g — lineage is determined only by signed pointers + log order.** "Current" vs "superseded" is computed deterministically from the chain; no editor, no off-chain ordering. Same log → same lineage (preserves CIP-9 v0.1 projection determinism). The competing-successor head rule (latest *valid* successor in log order) is the stated adjudicated convention, not a silent tie-break; divergence beyond it forks ([[CIP-5]]).
8. **NI-13h — epistemic type is invariant across a supersession lineage.** *(Folded from the the c5439212 red-team, V1 — closes the unenforced half of NI-13e.)* A `supersedes` ballot MUST carry the **same** `epistemicType` as the ballot it supersedes; a mismatch is rejected at the same admission step as the anchor gap, even when the new substantive anchor is valid. Changing a claim's type is a [[CIP-5]] fork (new independent lineage) or a v0.3 panel-ratified type sub-claim — **never** a ride-along on a substantive re-adjudication. A YES vote *signs* a ballot's declared type; it does not *adjudicate* it (v0.1). This is what makes "no burying a claim by re-typing it" an enforced guarantee rather than an advertised one.

## 9. Testnet gates (empirical)

- **G13a — type round-trips:** a `SETTLED`, `EMPIRICAL_LIVE`, and `NORMATIVE` ballot each project to a claim whose `epistemicType` matches the frozen ballot.
- **G13b — empirical provisionality:** an `EMPIRICAL_LIVE` RESOLVED claim surfaces with `evidenceTime` and a provisional/open-to-re-adjudication marker; **0** atemporal-RESOLVED renderings.
- **G13c — supersession lineage:** convene B1 (verdict X), then B2 (`supersedes` B1, verdict Y, new anchor); the Commons shows `current` = Y with B1 retained — its verdict X, evidence, and dissent intact; `verifyLog` valid; **0** edits to B1.
- **G13d — anchor-gated re-adjudication:** a B2 superseding without a new external anchor is **not promoted** (prior stays current); an otherwise-identical B2 with a valid new anchor **is** promoted. **And (NI-13h):** a B2 with a valid new anchor but an `epistemicType` ≠ the prior's is **rejected/not promoted** even though its anchor is valid — the type cannot ride through.
- **G13h — explicit head rule, no silent tie-break:** given two valid, type-consistent, ratified successors to one prior, `lineage.current` is deterministically the latest in log order; a successor that diverges beyond the head rule surfaces as a [[CIP-5]] fork (both lineages readable), never a silent pick.
- **G13e — normative conventionality:** a `NORMATIVE` supermajority renders "majority position as of D (conventional)" with dissent first-class; never "true."
- **G13f — determinism:** same log → identical typed index + lineage across re-projection.
- **G13g — no recomputation (CIP-12 regression):** projecting the existing log leaves every prior claim's `status`/`verdict`/`stances`/`standing` byte-identical; only the new fields appear.

---

*Status: ✅ ratified 2026-06-05 (RATIFY 3/3, ballot `3729cc2e…`). Red-teamed (ballot `c5439212…`, FAILS 2/3) and folded — NI-13h (type-invariant lineage), the v0.1 anchor gate, and the explicit head rule addressed V1's unenforced-protection flaw and V2's gate-sequencing flaw; V3's HOLDS notes reflected; both prior FAILS votes flipped to RATIFY on re-convene. Next: implement v0.1 under TDD (extend `buildClaimIndex`; gates G13a–h). Companion: the [[CIP-10]] adversarial-auditor / contrary-evidence-dossier amendment, which produces the falsification conditions §5 consumes.*
