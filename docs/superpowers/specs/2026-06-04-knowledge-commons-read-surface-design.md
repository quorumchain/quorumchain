# Design — CIP-9 Knowledge Commons read surface (v0.1 of the read product)

- **Project:** Quorumchain ($QRM)
- **Date:** 2026-06-04
- **Status:** Panel-ratified design — **round 58, ADOPT 2/3** (V2/V3 ADOPT, V1 REVISE). V1's four named
  changes + V2's mandatory-fields condition + V3's two observations are folded in below
  (`docs/consensus/2026-06-04-round-58-commons-read-surface.md`). Implementation will go to the panel
  for SOUND/REVISE code review as usual.
- **Extends:** CIP-9 (ratified round 38–39). This is the **read surface** — not a new CIP; the first
  product front over the existing claim graph (`commons.ts` v0.1 + `reputation.ts` v0.2).

## 1. Problem

CIP-9 has a data model but no readable surface: the only read path is `queryClaim()`, a programmatic
call. There is no way for an agent to retrieve a claim's full epistemic state as data, nor for a human
to browse it. This builds that surface — explicitly **not** an AI-Wikipedia that decrees a single
truth, but a projection of the epistemic state (CIP-9 §0/§2): consensus *and* credible dissent *and*
the honest-unknown, with provenance, on a record no one can quietly rewrite.

## 2. Architecture — feed-pattern projection (one core, two readers)

Mirrors the proven `feed.ts`/`publish-feed.ts` pattern: recompute from the signed log, publish
markdown. Modules (all zero-dependency):

- **`ballot-registry.ts`** *(new — planning discovery)* — the log stores only `ballotHash`
  (`sha256(prompt,context)`), never the prompt, so a human-readable statement cannot be recovered from
  the log. This records `{ballotHash, prompt, context}` and exposes `verifyEntry(entry)` =
  `ballotHash(prompt,context) === entry.ballotHash`. The read surface accepts a statement **only if it
  hash-verifies** — a wrong/forged statement is rejected (same recompute-trust-nothing discipline). The
  convening path (`convene`, optional `registryPath`) appends an entry per ballot going forward; the
  165 pre-registry ballots have `statement: null`.
- **`commons-read.ts`** — the one canonical core. `ClaimView` + `readClaim(...)` / `buildAllViews(...)`.
  Pure functions assembling the epistemic state from `commons.ts` (the claim graph) + the verified
  registry statement. `reputation.ts` is **not** wired in v0.1: its OPEN/UNVERIFIABLE states and
  `support` scores need external anchors the convening log lacks, so `support` is `null` everywhere
  (correct per NI-9b) and `status` is `commons.ts`'s own `RESOLVED | CONTESTED | INDETERMINATE`.
- **`commons-render.ts`** — `renderClaimMarkdown(view)` and `renderIndexMarkdown(views)`. Pure string
  projections of `ClaimView`. No I/O.
- **`publish-commons.ts`** — CLI. Recomputes every claim from the live log + pinned keyring + registry;
  writes `docs/commons/<id>.md` + `docs/commons/INDEX.md` (committed artifacts, like `FEED.md`).

The agent-facing read is `ClaimView` (structured data); the human page is a markdown projection of the
**same** object — so the two readers can never diverge into two different "truths."

## 3. The `ClaimView` core (with mandatory fields — round-58 V2)

```
ClaimView {
  ballotHash,                          // the claim id (sha256 of prompt+context)
  statement: string | null,            // from ballot-registry, ONLY if it hash-verifies; else null
  status,                              // RESOLVED | CONTESTED | INDETERMINATE — from commons.ts (pure, §5)
  stances: Stance[],                   // the credible positions — the BODY, never one value
  panelState,                          // NI-9a receipt: the validator set that produced the claim
  chainValid: boolean                  // recomputed; the page asserts the log verified
}
Stance {                               // projected from commons.ts Stance
  position,
  standing,                            // CONSENSUS | CREDIBLE_MINORITY | UNRANKED — computed, never assigned
  validators: string[],                // who held it (provenance, never flattened)
  panelVotes: number,                  // panel distribution (NOT reputation/popularity)
  support: number | null               // null = "not externally anchored" — NEVER 0 (NI-9b); null in v0.1
}
```

(`history`/`subjectKey` from the original sketch are deferred: the log has no multi-version claim
history yet — a claim is one ballot — and `subjectKey` topic-grouping is explicitly out of scope.
They are noted in §6/§9, not built in v0.1.)

`chainValid`, `panelState`, `provenance`, and the preserved-dissent stances are **required** fields
produced by `commons-read.ts` — not optional render-time decorations (round-58 V2). If the core can't
populate them, that is an error, not a blank.

## 4. Data flow (pure recompute; trusts nothing stored)

`votes.log` → `readLog`/`verifyLog` → `buildClaimIndex` (commons.ts) → for each `Claim`, attach the
registry statement **iff it hash-verifies** (else null) → one `ClaimView` per claim →
`renderClaimMarkdown` + `renderIndexMarkdown` → `docs/commons/*.md` + `INDEX.md`. Every publish
recomputes from the log; a prior render is never an input. A tampered log → `verifyLog` invalid →
`chainValid: false` → the page and index render an explicit tamper banner, never silently emit content.

## 5. Invariant compliance — pinned in the presentation layer (round-58 guardrails)

The round-58 catch: the invariants were clean in the data model but unpinned in rendering, where an
epistemic state degrades into "a single truth + footnotes." Each is now a testable contract:

1. **Equal structural weight (V1-2, V3).** Stances render with no demotion-to-footnote, no omission,
   and no typographic/ordering hierarchy that favors the consensus stance. A RESOLVED claim's page
   shows the full dissent set. *Enforced by a golden-file test.*
2. **Index is not a single-truth surface (V1-1).** `renderIndexMarkdown` shows per-status: a
   CONTESTED/INDETERMINATE claim reads as *contested/indeterminate* (e.g. "CONTESTED — N stances"),
   never as a winner-label; only RESOLVED shows the resolved stance, and even then flags preserved dissent.
3. **`support` is `null`, never `0`, when not externally anchored (V1-3, NI-9b).** Pinned in the
   `ClaimView` type and rendered as "not externally anchored" — printing `0` would fabricate a signal.
   (Null everywhere in v0.1: the convening log has no external anchors.)
4. **`status` is `commons.ts`'s pure derivation, test-covered (V1-4, NI-9c).** `RESOLVED | CONTESTED |
   INDETERMINATE`, computed from the verified tally, never assigned. INDETERMINATE renders raw plurality
   + provenance with all stances `UNRANKED` and is test-covered against ever emitting "FRINGE."
5. **NI-9a receipt, always (V3).** Every CONSENSUS render carries its panel-state receipt (the
   validator set that produced the claim — `commons.ts` `panelStateReceipt`). The per-version receipt
   *trail* (V3's "over time") is deferred with multi-version `history`, which the log doesn't yet
   produce (a claim is one ballot); noted in §9.
6. **No edit key / §2.** Pages are pure projections; regenerating reproduces them byte-for-byte; the
   body is the stance *set*. A RESOLVED verdict is one stance among the preserved others.

## 6. Topic-readiness (per-claim now)

v0.1 is per-claim only. Topic grouping is deliberately **not** modelled (no `subjectKey` in the core) —
classifying claims into topics is the editorial-risk layer NI-9c forbids without a non-editorial
mechanism. A later, separately-designed grouping layer (e.g. derived from signed topic-claims, never an
editor's hand) can sit on top of `ClaimView` without reworking it.

## 7. Components & isolation

| Module | Responsibility | Depends on | I/O |
|---|---|---|---|
| `ballot-registry.ts` | record + hash-verify `{ballotHash,prompt,context}` | signed-vote (`ballotHash`) | reads/writes registry file |
| `panel.ts` (convene) | append a registry entry per ballot (optional `registryPath`) | ballot-registry | writes registry |
| `commons-read.ts` | assemble `ClaimView` (claim graph + verified statement) | commons.ts, ballot-registry, vote-log | none (pure) |
| `commons-render.ts` | project `ClaimView` → markdown (page + index) | commons-read types | none (pure) |
| `publish-commons.ts` | recompute from live log + registry, write files | the above + fs | reads log/registry, writes docs/commons/ |

## 8. Testing (TDD, red→green)

- `ballot-registry.verifyEntry`: an entry whose `prompt`/`context` re-hash to its `ballotHash` verifies;
  a tampered statement fails.
- `readClaim` assembles the epistemic state incl. preserved dissent (a 2/1 claim → a CONSENSUS stance +
  a named CREDIBLE_MINORITY stance); `statement` is set only when the registry entry hash-verifies, else
  `null`.
- **Golden-file:** `renderClaimMarkdown` on a RESOLVED claim shows the full dissent set, equal weight,
  no omission (contract for guardrail 1).
- `renderIndexMarkdown`: a CONTESTED claim reads as contested, not a winner-label (guardrail 2).
- `support` is `null` (not `0`) on a panel-only claim, and renders as "not externally anchored"
  (guardrail 3).
- `status` derivation test; INDETERMINATE renders raw plurality, all stances UNRANKED, never "FRINGE"
  (guardrail 4).
- Every CONSENSUS render includes the NI-9a panel-state receipt (guardrail 5).
- Tampered log → `chainValid: false` → tamper banner, no silent content (data flow).
- A statement-less (pre-registry) claim renders the hash + "statement not recorded", never a fabricated title.

## 9. Out of scope (named, not faked)

- **Topic aggregation** — its own later design; must be non-editorial (no `subjectKey` in v0.1).
- **Multi-version `history` + per-version receipt trail** — the log models a claim as one ballot; a
  revision model is a later graduation (V3's "receipt over time").
- **`reputation.ts` wiring / `support` scores** — needs external-anchored claims the convening log lacks.
- A **live query service** (Approach B) — a future wrapper over the same `ClaimView`; static publish first.
- **CIP-9 v0.3** (epistemic forking + heterodox floor) — its own spec, deferred to the fork/peering layer.
