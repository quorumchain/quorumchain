You are reviewing the implemented CIP-9 Knowledge Commons read surface — the code that
Round 58 ratified the DESIGN for (ADOPT 2/3). This is now the build-then-review gate:
does the code faithfully implement the ratified design and uphold its invariants, with
no gap between a rule's intent and its mechanical check?

Read the source yourself before voting. The new/changed modules (≈219 new lines):

- `code/src/ballot-registry.ts` — the self-verifying statement store. The signed log
  stores only `ballotHash = sha256(JSON.stringify({prompt,context}))` (one-way; the
  prompt is NOT recoverable from the log). The registry records `{ballotHash, prompt,
  context}` so a human-readable statement can be shown. `statementFor` returns the prompt
  ONLY IF it re-hashes to the stored ballotHash (`verifyEntry`); otherwise null.
- `code/src/commons-read.ts` — `buildViews` recomputes each claim's epistemic state from
  the signed votes + pinned keyring via `buildClaimIndex` (the existing `commons.ts`).
  A ClaimView carries the stance SET (consensus + credible dissent + honest-unknown),
  status (RESOLVED|CONTESTED|INDETERMINATE), the NI-9a panel-state receipt, and the
  statement (or null). `support` is `null` in v0.1.
- `code/src/commons-render.ts` — the human projection. `renderClaimMarkdown` /
  `renderIndexMarkdown`.
- `code/src/publish-commons.ts` — CLI; pure recompute from log + keyring + registry to
  `docs/commons/`.
- `code/src/run-panel.ts`, `code/src/live-ballot.ts` — wired to pass `registryPath` so
  future convenings record their statement.

Supporting (unchanged, but you depend on them): `commons.ts` (buildClaimIndex/queryClaim,
the Stance/Claim types and standing computation), `vote-log.ts` (readLog/verifyLog), the
test files `test/ballot-registry.test.ts`, `test/commons-read.test.ts`,
`test/commons-render.test.ts`. Full suite: 225 tests, all green.

Judge against the Round-58 invariants — flag any place the CODE diverges from the
DESIGN's intent:

  NI-9a — the panel-state receipt (which validators ruled, panel size) is always shown,
          so a stance can never be read as more authority than the panel that produced it.
  NI-9b — reputation/support is computed only from EXTERNAL anchors, never from
          agreement or panel size. In v0.1 there are no external anchors, so support MUST
          render as honest-absent ("not externally anchored"), NEVER as 0.
  NI-9c — standing is COMPUTED from the signed votes, never assigned/editorial; no stance
          is ever labelled FRINGE; a non-consensus claim is never flattened to a
          winner-label.
  No edit key — the surface is a pure projection of the signed log. A prior render is
          never an input. A tampered log (verifyLog false) surfaces as a banner, never as
          silently altered content.
  Statement integrity — a statement is shown ONLY if it re-hashes to its ballotHash; a
          missing statement shows the hash, never a fabricated title. The registry is
          NOT a trust root: a lying registry entry is rejected by re-hash, not believed.

Also apply the project's standing test: capture is laundered through the gap between a
rule's intent and its mechanical check. Look for a place where the code passes the letter
of an invariant while violating its spirit (e.g., a stance ordering that re-introduces a
truth-decree, a support value that leaks agreement, a render path that could show
unverified text).

Vote SOUND (faithful, ship it), REVISE (a real actionable gap — name it precisely), or
INADEQUATE (the design intent is not met and needs rework). Give your reasoning.
