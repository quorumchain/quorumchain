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
markdown. Three small zero-dependency modules:

- **`commons-read.ts`** — the one canonical core. `ClaimView` + `readClaim(log, keyring, id)` /
  `buildAllViews(log, keyring)`. Pure functions assembling the full epistemic state from `commons.ts`
  (claim graph) + `reputation.ts` (status, standing, source scores). No I/O.
- **`commons-render.ts`** — `renderClaimMarkdown(view)` and `renderIndexMarkdown(views)`. Pure string
  projections of `ClaimView`. No I/O.
- **`publish-commons.ts`** — CLI. Recomputes every claim from the live log + pinned keyring; writes
  `docs/commons/<id>.md` + `docs/commons/INDEX.md` (committed artifacts, like `FEED.md`).

The agent-facing read is `ClaimView` (structured data); the human page is a markdown projection of the
**same** object — so the two readers can never diverge into two different "truths."

## 3. The `ClaimView` core (with mandatory fields — round-58 V2)

```
ClaimView {
  id, statement,                       // the proposition, stated neutrally
  status,                              // OPEN | CONTESTED | RESOLVED | UNVERIFIABLE — pure derivation (§5)
  stances: Stance[],                   // the credible positions — the BODY, never one value
  panelState,                          // NI-9a receipt: panel composition + diversity/correlation state
  history: VersionRef[],               // signed, hash-chained; each step carries its own panelState (V3)
  provenance: { ballotHash, voteRefs, transcriptLink? },  // ballotHash + voteRefs mandatory; link best-effort
  subjectKey: null,                    // RESERVED for later NON-EDITORIAL topic grouping — empty now
  chainValid: boolean                  // recomputed; the page asserts the log verified
}
Stance {
  position,
  standing,                            // CONSENSUS | CREDIBLE_MINORITY | UNRANKED — computed, never assigned
  support: number | null,              // null = "not externally anchored" — NEVER 0 on panel-only (NI-9b)
  heldBy: string[],                    // who held it (validators / sources)
  evidence: Edge[]
}
```

`chainValid`, `panelState`, `provenance`, and the preserved-dissent stances are **required** fields
produced by `commons-read.ts` — not optional render-time decorations (round-58 V2). If the core can't
populate them, that is an error, not a blank.

## 4. Data flow (pure recompute; trusts nothing stored)

`votes.log` → `readLog`/`verifyLog` → `buildClaimIndex` (commons.ts) → enrich via reputation.ts
(`claimStatus`, `computeStanding`, `scoreSources`) → one `ClaimView` per claim → `renderClaimMarkdown`
+ `renderIndexMarkdown` → `docs/commons/*.md` + `INDEX.md`. Every publish recomputes from the log; a
prior render is never an input. A tampered log → `verifyLog` invalid → `chainValid: false` → the page
and index render an explicit tamper banner, never silently emit content.

## 5. Invariant compliance — pinned in the presentation layer (round-58 guardrails)

The round-58 catch: the invariants were clean in the data model but unpinned in rendering, where an
epistemic state degrades into "a single truth + footnotes." Each is now a testable contract:

1. **Equal structural weight (V1-2, V3).** Stances render with no demotion-to-footnote, no omission,
   and no typographic/ordering hierarchy that favors the consensus stance. A RESOLVED claim's page
   shows the full dissent set. *Enforced by a golden-file test.*
2. **Index is not a single-truth surface (V1-1).** `renderIndexMarkdown` shows per-status: a
   CONTESTED/OPEN claim reads as *contested* (e.g. "CONTESTED — N stances"), never as a winner-label;
   only RESOLVED shows the resolved stance, and even then flags preserved dissent.
3. **`support` is `null`, never `0`, when not externally anchored (V1-3, NI-9b).** Pinned in the
   `ClaimView` type and rendered as "not externally anchored" — printing `0` would fabricate a signal.
4. **`status` is a documented pure derivation with a test (V1-4, NI-9c).** Computed from the claim's
   resolution state + anchor availability, never assigned. UNVERIFIABLE renders raw plurality + provenance
   and is test-covered against ever emitting "FRINGE."
5. **NI-9a receipt, always, and over time (V3).** Every CONSENSUS render carries its panel-state
   receipt; `history[]` carries the panelState at each version step so the receipt trail is
   reconstructible, not just for the current view.
6. **No edit key / §2.** Pages are pure projections; regenerating reproduces them byte-for-byte; the
   body is the stance *set*. A RESOLVED verdict is one stance among the preserved others.

## 6. Topic-readiness (per-claim now)

`subjectKey` is present in `ClaimView` but **empty** in v0.1 — no editorial topic classification (that
would violate NI-9c). A later, separately-designed, non-editorial grouping layer (e.g. derived from
signed topic-claims, never an editor's hand) can populate it without reworking the core or the pages.

## 7. Components & isolation

| Module | Responsibility | Depends on | I/O |
|---|---|---|---|
| `commons-read.ts` | assemble `ClaimView` (the epistemic state) | commons.ts, reputation.ts, signed-vote/vote-log | none (pure) |
| `commons-render.ts` | project `ClaimView` → markdown (page + index) | commons-read types | none (pure) |
| `publish-commons.ts` | recompute from live log, write files | the above + fs | reads log, writes docs/commons/ |

## 8. Testing (TDD, red→green)

- `readClaim` assembles the full epistemic state incl. preserved dissent (a 2/1 claim → a CONSENSUS
  stance + a named CREDIBLE_MINORITY stance).
- **Golden-file:** `renderClaimMarkdown` on a RESOLVED claim shows the full dissent set, equal weight,
  no omission (contract for guardrail 1).
- `renderIndexMarkdown`: a CONTESTED claim reads as contested, not a winner-label (guardrail 2).
- `support` is `null` (not `0`) on a panel-only claim, and renders as "not externally anchored"
  (guardrail 3).
- `status` derivation test; UNVERIFIABLE renders raw plurality and never "FRINGE" (guardrail 4).
- Every CONSENSUS render includes the NI-9a receipt; `history[]` carries per-version panelState
  (guardrail 5).
- Tampered log → `chainValid: false` → tamper banner, no silent content (data flow).
- `subjectKey` exposed and unpopulated (topic-readiness).

## 9. Out of scope (named, not faked)

- Topic aggregation / `subjectKey` population (its own later design — must be non-editorial).
- A live query service (Approach B) — a future wrapper over the same `ClaimView`; static publish first.
- CIP-9 v0.3 (epistemic forking + heterodox floor) — its own spec, deferred to the fork/peering layer.
