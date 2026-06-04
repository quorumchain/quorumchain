# Round 58 — CIP-9 Knowledge Commons read surface (design review)

**Ballot hash:** `60536b946f5b04b2fe4005e49ce5595796b438bdee659bf34d601bebdea54613`
**Verdicts:** ADOPT / REVISE / REJECT
**Result:** **ADOPT 2/3** — V2 ADOPT, V3 ADOPT, V1 REVISE (tally `{ADOPT:2, REVISE:1}`). Log entry 165, chain valid.

Approved to build. V1's REVISE + V2's condition + V3's observations converge on one theme: the
invariants are clean in the *data model* but unpinned in the *presentation layer* — where an
epistemic state quietly degrades into "a single truth + footnotes." All three sets of notes are
folded into the spec before building (per the project's fold-the-dissent practice).

## Question

> CIP-9 Knowledge Commons read surface (v0.1 of the read product): is the proposed feed-pattern
> projection — a canonical ClaimView core + markdown page projection + publish CLI, per-claim now and
> topic-ready, recompute-from-log — sound to build under the CIP-9 invariants (NI-9a/9b/9c, no edit
> key, store the epistemic state not a single truth)?

## Ballot context (verbatim — the bytes hashed into the ballot)

# Design-review brief — CIP-9 Knowledge Commons read surface (v0.1 of the read product)

## What this is

CIP-9 has a built data model (v0.1 claim graph in `commons.ts`, v0.2 states + external-anchor
reputation in `reputation.ts`) but **no readable surface**: the only read path is `queryClaim()`,
a programmatic call. This proposes the first read product — turning the existing claim graph into
something an agent can query and a human can browse — explicitly NOT an AI-Wikipedia that decrees a
single truth, but a projection of the epistemic state (CIP-9 §0/§2).

## Proposal (Approach A — feed-pattern projection)

Mirror the existing `publish-feed.ts` pattern (recompute from the signed log, publish markdown).
Three small zero-dependency modules:

1. **`commons-read.ts`** — the one canonical core. `ClaimView` + `readClaim` / `buildAllViews`,
   pure functions assembling the full epistemic state from `commons.ts` + `reputation.ts`.
2. **`commons-render.ts`** — `renderClaimMarkdown` / `renderIndexMarkdown`, pure string projections.
3. **`publish-commons.ts`** — CLI: recompute every claim from the live log + pinned keyring, write
   `docs/commons/<id>.md` + `INDEX.md` (committed artifacts, like FEED.md).

The agent-facing read is `ClaimView` (structured data); the human page is a markdown projection of the
SAME object — one core, two readers.

### ClaimView (canonical object)

```
ClaimView { id, statement, status (OPEN|CONTESTED|RESOLVED|UNVERIFIABLE),
  stances: [{ position, standing (CONSENSUS|CREDIBLE_MINORITY|UNRANKED), support, heldBy[], evidence[] }],
  panelState,           // NI-9a receipt: panel composition + diversity/correlation state
  history: VersionRef[], // signed, hash-chained; superseded views retained + reason
  provenance: { ballotHash, voteRefs, transcriptLink },
  subjectKey: null,     // RESERVED for later NON-EDITORIAL topic grouping — empty now (NI-9c)
  chainValid }          // recomputed; the page asserts the log verified
```

The stance-set IS the body — a RESOLVED claim is one stance (the consensus one) standing alongside
the preserved dissent, never collapsed to a single answer.

## Key design choices

- **Granularity:** per-claim pages now (each ballot-derived claim = a mini-article), structured so a
  later non-editorial topic-grouping layer can sit on top (`subjectKey` reserved, empty).
- **Pure recompute:** every publish recomputes from `votes.log`; a prior render is never an input.
  A tampered log → `chainValid` false → the page/index flags it, never silently renders.
- **No edit key:** pages are pure projections; regenerating reproduces them; no page-level editing.

## Claimed invariant compliance (the panel should test this hardest)

- **NI-9a** — every CONSENSUS rendered with its panel-state receipt.
- **NI-9b** — support/reputation only where externally anchored; no fabricated movement on panel-only claims.
- **NI-9c** — standing computed, never assigned; UNVERIFIABLE shows raw plurality, never "FRINGE";
  `subjectKey` empty (no editorial topic classification yet).
- **§2** — store the epistemic state, never a single truth; the renderer shows the stance SET as the body.

## Question

Is this design sound to BUILD as CIP-9's read surface v0.1 (per-claim now, topic-ready), under the
listed invariants?

## Verdicts

- **ADOPT** — sound to build as proposed.
- **REVISE** — sound direction, but specific changes required (name them).
- **REJECT** — wrong approach (say why, and what instead).

---

## Verbatim votes

### V1 — REVISE

I was unable to read the source (`commons.ts`/`reputation.ts`/`publish-feed.ts` aren't at the expected paths and shell/reads are gated this session), so I'm judging the design as specified in the brief — which is the actual unit under review.

## Reasoning

**The direction is right.** Three things make this architecture correct for CIP-9, not just convenient:

- **Recompute-from-log + no edit key** is the structural guarantee of §0/§2. A pure projection that reproduces on regeneration cannot harbor an editor's hand; `chainValid` surfaced on the page makes tamper non-silent. This is the same trust model as `publish-feed.ts`, so no new assumptions are introduced.
- **One `ClaimView` core, two readers** keeps the agent-facing structured read and the human markdown page from diverging into two different "truths." Single source, correct.
- **`subjectKey` reserved-but-empty** is the right NI-9c discipline — topic classification is the editorial-risk layer, and deferring it (rather than half-building it) keeps v0.1 genuinely non-editorial.
- **stance-set as body** is the §2 commitment honored at the data level.

**Where it is not yet sound — and it's specific.** The invariants are clean in the *data model* but unpinned in the *presentation layer*, which is exactly where an "epistemic state" quietly degrades into "a single truth + footnotes." The brief asserts intent ("never collapsed") without a testable contract. Four named changes:

1. **`INDEX.md` is an uncontrolled compression point.** A one-line index row per claim is where a CONTESTED/OPEN claim gets flattened to a winner-label. Define what the index renders per status — a CONTESTED claim must read as contested in the index, not show its top stance. Without this, the index becomes the single-truth surface even while pages stay pure.
2. **Render dissent at equal structural weight.** "Consensus stance alongside preserved dissent" must be enforced, not intended. Add a golden-file test asserting a RESOLVED claim's page contains the full dissent set with no demotion-to-footnote and no omission. Ordering/headline treatment is real editorialization even over clean data.
3. **NI-9b: `support` must be `null`/"not externally anchored", never `0`.** Pin null-vs-zero in both the `ClaimView` type and the renderer. A panel-only claim that prints `support: 0` fabricates a signal — the precise thing NI-9b forbids.
4. **`status` must be a documented pure derivation with a test** (so it is "computed, not assigned" per NI-9c), and UNVERIFIABLE's raw-plurality display must be test-covered against ever emitting "FRINGE."

These are additive guardrails on a correct design, all nameable — not a wrong approach (not REJECT) and not yet safe to build verbatim given the read surface's entire purpose is to *not* decree a single truth (not ADOPT).

VERDICT: REVISE

### V2 — ADOPT

The design is sound in direction and matches the CIP-9 invariants: a recomputed projection from the signed log, with `ClaimView` as the canonical read object, avoids introducing an edit key or a separate editorial truth layer. Per-claim pages are also the right v0.1 granularity because they expose the existing claim graph without prematurely inventing topic curation.

The key condition is that `chainValid`, panel-state receipts, external-anchor provenance, and preserved dissent must be mandatory render fields, not optional decorations. If those are enforced in `commons-read.ts`, then markdown is only a projection of the epistemic state and not a new authority surface.

VERDICT: ADOPT

### V3 — ADOPT

Evaluating against the CIP-9 invariants:

**NI-9a** — `panelState` carried as a structured field on every `ClaimView` and passed through the renderer. Consensus renders alongside its receipt. Good fit.

**NI-9b** — Support/reputation surfaces only where tied to external anchors (reputation.ts already enforces this). The ClaimView model doesn't invent panel-only movement metrics.

**NI-9c** — Standing is computed, not editorialized. UNVERIFIABLE falls back to raw plurality, no FRINGE label. `subjectKey` is explicitly empty now, deferring non-editorial topic grouping. Compliant.

**§2 (epistemic state, not single truth)** — The stance-set IS the body. RESOLVED shows consensus stance alongside preserved dissent, not collapsed to one answer. This matches the invariant's intent.

**Architecture** — Single `ClaimView` core with two readers (agent structured, human markdown) is clean. Pure recompute from the log means no stale pages, no edit key, no drift from the source of truth. `chainValid` flags tampering.

**Minor observations** (don't block building):
- The markdown renderer must show all stances with equal visual weight — any typographic hierarchy (heading size, ordering, "featured" callouts) risks covert editorialization. A review of the rendered output for that risk should happen when `commons-render.ts` lands, not now.
- If a claim's panelState changes between votes (member joins/leaves, correlation shifts), the view should capture the panelState at each version step in `history[]` so the receipt trail is reconstructible. This is implied by the VersionRef model but worth confirming during implementation.

These are implementation-level cautions, not direction changes.

The architecture is small, composable, invariant-respecting, and mirrors a pattern already proven in the codebase. Sound to build.

VERDICT: ADOPT

---

## Ratified outcome — build, with the presentation-layer guardrails folded in

The design is ADOPTED. The following (V1's four named changes + V2's mandatory-fields condition +
V3's two observations, all convergent) are folded into the spec before building:

1. **Equal-structural-weight rendering** of stances — no demotion-to-footnote, no omission, no
   typographic/ordering hierarchy that favors the consensus stance. Enforced by a **golden-file test**
   on a RESOLVED claim's page (V1-2, V3).
2. **INDEX per-status rendering rules** — a CONTESTED/OPEN claim reads as contested in the index, never
   as a winner-label; the index is not allowed to become the single-truth surface (V1-1).
3. **`support` is `null` ("not externally anchored"), never `0`** on panel-only claims — pinned in both
   the `ClaimView` type and the renderer (V1-3, NI-9b).
4. **`status` is a documented pure derivation with a test**; UNVERIFIABLE raw-plurality display is
   test-covered against ever emitting "FRINGE" (V1-4, NI-9c).
5. **Mandatory render fields** — `chainValid`, the NI-9a panel-state receipt, external-anchor
   provenance, and preserved dissent are required fields enforced in `commons-read.ts`, not optional
   render-time decorations (V2).
6. **panel-state receipt per version step** — `history[]` captures the panelState at each version so the
   NI-9a receipt trail is reconstructible over time, not just for the current view (V3).

(Process note: V1 reported it could not read the source files this session and judged the design as
specified in the brief — which is the unit under review. The findings stand on the design's own terms.)
