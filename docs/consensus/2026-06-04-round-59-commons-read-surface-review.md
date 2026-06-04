# Round 59 — CIP-9 read-surface code review (SOUND 2/3; V1's broken-link REVISE fixed)

**Date:** 2026-06-04
**Type:** Build-then-review gate — does the implemented CIP-9 Knowledge Commons read
surface faithfully implement the Round-58 ratified design and uphold its invariants
(NI-9a panel-state receipt, NI-9b support never leaks agreement, NI-9c standing computed
never editorial / no FRINGE / no winner-flattening, no edit key / pure projection,
statement integrity via re-hash), with no gap between a rule's intent and its check?
**Method:** Live convening, no human in the loop. V1 (`claude -p`), V2 (codex), V3
(hermes) each read the four new modules (`ballot-registry.ts`, `commons-read.ts`,
`commons-render.ts`, `publish-commons.ts`) plus the supporting `commons.ts` /
`vote-log.ts` / `signed-vote.ts` and the three test files, then signed child-side.
**Ballot hash:** `db580ba81dee143c64e35c499f1a74cc3aa17400b38877b62fcaff154f8c0ed4`
**Result:** **SOUND — 2/3** (`{SOUND:2, REVISE:1}`). Chain valid at **168 entries**.
- V2 **SOUND** · V3 **SOUND** · V1 **REVISE** (a real, one-line-fixable navigation defect — now fixed).

---

## V1's REVISE — the index→claim links were all dead (fixed under TDD)

All three validators audited the five ratified invariants mechanically and found the
**epistemic core faithful** — V2 and V3 voted SOUND on that basis. V1 reached the same
conclusion on every invariant ("the epistemic design is faithfully and rigorously
implemented") but caught a defect the other two did not look for, in the navigation layer:

> "`publish-commons.ts` writes `INDEX.md` *inside* `docs/commons/`, alongside the
> per-claim pages. But `commons-render.ts:46` builds the link as `commons/${slice}.md`.
> Relative to `docs/commons/INDEX.md`, that resolves to `docs/commons/commons/xxxx.md` —
> a dead link to every claim page. The fix is one character of path: `./${slice}.md`."

V1 named it as the project's own signature failure, displaced into the navigation layer:

> "This is exactly the intent/mechanical-check gap pattern… the renderer's unit tests
> assert the output *string* and pass, because the renderer can't see where the CLI
> writes `INDEX.md` — the two modules silently disagree about the layout. The 225 green
> tests don't cover the cross-module file-path contract, so it slipped through."

The diagnosis is exact: `publish-feed.ts` writes `FEED.md` to the `docs/` root, where a
`commons/`-prefixed link *is* correct — the prefix was carried over to a CLI that writes
its index one directory deeper, and no test spanned the two modules to catch it.

### The fix (TDD, red→green)
- Added a render test asserting index links are same-directory relative (`./<hash>.md`),
  never the doubled `commons/<hash>.md`. Watched it fail (RED).
- Changed `commons-render.ts:46` to `./${slice}.md` with a comment recording why.
  Suite **225 → 226, all green**.
- Regenerated `docs/commons/`: every INDEX row now links `./<hash>.md` and resolves.

---

## What the panel affirmed (the five invariants)

- **NI-9a** — `commons.ts` builds the panel-state receipt from the *verified, counted*
  validators; `renderClaimMarkdown` emits it unconditionally. No path renders a stance
  without its denominator. (V1, V3 traced it line-by-line.)
- **NI-9b** — `viewClaim` hardcodes `support: null`; the renderer maps `null → "not
  externally anchored"`, never `0`. `panelVotes` is carried separately and labelled as
  panel distribution, never reputation. Agreement is structurally unable to reach support.
- **NI-9c** — standing is computed in `buildClaimIndex` by the auditable majority rule;
  the `Standing` type has no FRINGE member at all; non-RESOLVED index rows read "N
  stances, no consensus" (no winner-label); stances render in neutral first-seen order
  with identical row structure; `NO_VERDICT` stays UNRANKED even in RESOLVED claims.
- **No edit key** — `publish-commons` is pure recompute from log + keyring + registry;
  no prior render is read; `verifyLog` drives a ❌ banner on both page types, so a
  tampered log surfaces, never silently-altered content.
- **Statement integrity** — `statementFor` returns the prompt *only if* it re-hashes to
  the stored `ballotHash`; a missing/lying entry yields `null`, rendered as the hash,
  never a fabricated title. `convene` appends the registry entry from the *same*
  `prompt,context` that produces the claim's `ballotHash` — the registry is provenance,
  not a trust root.

V2: "I do not see a rule whose stated intent is only cosmetically checked while being
mechanically bypassed." V3: "No gap found between intent and mechanical check" in the
epistemic core.

## Note — V3's caveat (already true, now confirmed)

V3 voted SOUND but flagged it could not locate `run-panel.ts` / `live-ballot.ts` to
verify the write-path registry wiring, correctly observing this "does not affect the read
surface's correctness." The wiring was in place; this convening **dogfooded it** — run
through the now-wired `run-panel.ts`, this very review recorded its own statement, so the
republished commons went from 0 → 1 recorded statements. The first real statement in the
Knowledge Commons is the panel's review of the Knowledge Commons.

---

**Standing lesson reaffirmed:** capture — and here, plain breakage — is laundered through
the gap between a rule's intent and its mechanical check. Per-module string tests proved
each module correct in isolation while the two modules silently disagreed about file
layout. The diverse panel earns its keep precisely here: a 2/3 SOUND that still surfaces
a real, one-line, precisely-named defect because one validator looked where the tests
didn't. Fixed, not waved through.
