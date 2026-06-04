# Rounds 52–53 — the self-review loop dogfooded (found 3 bugs → fixed → SOUND 3/3)

**Date:** 2026-06-04
**What this is:** the Phase 1.2 tier-1 self-review source (round 51) run for real,
end-to-end, with **no human choosing the question**: a git commit triggered the sourcer,
which auto-enqueued a review ballot of that commit's diff, which the daemon drained. This
is also the first live demonstration of the **Phase 1.3 self-improvement pattern**:
propose → build → the panel reviews its own diff from source → revise → re-review.

```
commit ──► source-self-review.ts ──► auto-generated review ballot ──► run-daemon.ts ──► panel ──► verdict
   (no human wrote the ballot; no human ran the panel)
```

---

## Round 52 — the dogfood found three real bugs (tally NO_VERDICT 2/3)

**Ballot:** autonomous self-review of commit `6d403de` (Phase 1.2 tier 1).
**Ballot hash:** `989e5532c602477c9589794efd9253a409f330ef04330d0472adbb55e91eb4cd`
**Raw tally:** `{NO_VERDICT:2, REVISE:1}` — V1 NO_VERDICT · V2 REVISE · V3 NO_VERDICT.

Only **one** validator produced a parseable verdict, yet the daemon recorded
`ratified: True, verdict: NO_VERDICT`. That misleading outcome *was the biggest finding*:
the dogfood exposed three bugs, two in core logic.

1. **V2 — REVISE (a real collision bug).** The dedup id `review-<epoch>-<short-sha>` used
   only 12 hex chars; two commits sharing a committer-second and 12-char prefix collide,
   so the later is silently skipped as "already reviewed" — an adversarial commit could
   craft a collision to suppress its own review. Fix: key the dedup identity by the FULL
   sha.
2. **The ratify laundering bug (exposed by the tally).** `NO_VERDICT` is the sentinel for
   "no parseable verdict / the invoker errored." `ratify` let it WIN with 2/3, laundering
   two failures (V1's CLI error + V3's agent timeout) into a "ratified consensus." A
   non-decision must never ratify.
3. **The daemon participation bug (same root).** The daemon finalized "decided vs retry"
   on raw `votes.length` (3 ≥ quorum), so a convening where 2/3 validators *failed* was
   moved to `done/` instead of retried.

Plus two liveness causes: **V1** — `claude -p` was killed by the 180s `execFile` timeout
mid-agentic-review (`Command failed`, no stderr captured); **V3** — hit its 6-turn cap
before concluding. Code-review ballots are agentic (read files, run `git show`) and the
invoker budgets were tuned for a plain verdict.

### Fixes (all TDD, red→green) — commit `548ed4a`
- **ratify:** `NO_VERDICT` is kept in the tally for transparency but can never BE the
  ratified verdict. Round-52's logged votes now recompute to **not ratified** (ratify is
  pure) — only the stale round-52 `done/` record holds the pre-fix outcome.
- **daemon:** participation counts REAL (non-`NO_VERDICT`) verdicts; 2/3 failures retry,
  never finalize.
- **self-review-source:** dedup id is `review-<epoch>-<full-sha>` (short sha is display
  only).
- **invokers:** budgets raised to 480s / 12 turns; a failure re-throws with the child's
  stderr tail (or "timed out after Nms") so the cause is recorded, not swallowed.
- Suite 178 → **181**, all green.

---

## Round 53 — re-review of the fix commit (SOUND, unanimous 3/3)

**Ballot:** autonomous self-review of commit `548ed4a` (the round-52 fixes).
**Ballot hash:** `6a395c72fb699da2d81cc7dfc4c6167c31609eb8fbfda4c39d33f6f546a3f281`
**Result:** **SOUND — 3/3** (`{SOUND:3}`). Chain valid at **150 entries**.

All three completed this time (the budget fix worked — no timeout/cap) and each verified
all four fixes *from source* with their tests, plus cross-cutting invariants (custody,
no-laundering, liveness, tamper-evidence, TDD). Notably V1 confirmed the daemon filters
the signed-vote set itself, not `ratify().tally` (which still includes NO_VERDICT voters),
so the laundering path is closed at *both* layers consistently.

### Two non-blocking findings (noted, deferred)
V1 raised two, and reasoned why neither breaks soundness (all three still voted SOUND):
- **The daemon's participation bar uses `params.quorum`, not `max(quorum,
  supermajority(n))`.** For the standing 3-panel they coincide (2 = ⌈6/3⌉); and `ratify`
  *independently* enforces the 2/3 floor, so the `ratified` flag is always correct — the
  daemon's bar only governs retry-vs-finalize and errs conservative (finalizes as *not*
  ratified, never laundering a NO into a YES). **Deferred hardening** for if/when an N>3
  panel with a misconfigured quorum is introduced.
- **`commons.ts` would display a NO_VERDICT position as `CREDIBLE_MINORITY`** — cosmetic/
  reputational only, doesn't touch ratification, outside this commit's surface.

---

## Status

**Phase 1.2 tier 1 is panel-certified** (round 53, SOUND 3/3) and the autonomous
self-review loop is proven end-to-end — including its ability to **find and drive the fix
of real bugs in itself** (round 52 → 53 is the round-45→46 pattern, now executed by the
machinery on itself). 181 tests green; log at 150 entries, chain valid. The two deferred
findings are recorded above. Next within Phase 1: tier 2 (external dispute feed, the
decision+build the round-51 binding constraint makes hard) and 1.3/1.4 proper.

Verbatim reasoning: `code/data/raw-989e5532c602.txt` (r52), `code/data/raw-6a395c72fb69.txt` (r53).
