# Round 44 — Panel review of the code build (implementation vs. ratified specs)

**Date:** 2026-06-04
**Type:** Implementation review — does the session's code faithfully realize the ratified CIP-0..10 specs and their non-negotiable invariants? Anything missing or improvable?
**Method:** Live convening via `code/src/run-panel.ts`. V1 (Claude) reviewed and pre-committed its vote; V2 (Codex) and V3 (Hermes) reviewed independently from a neutral build summary (`code/data/review-context.txt`). Verdict tokens: SOUND / REVISE / INADEQUATE.
**Ballot hash:** `c20ec41af1ddc1dd71016909418b23c9a48a8726eebaccda9951be64eeba2e7d`
**Result:** **REVISE — 2/3** (tally `{REVISE:2, NO_VERDICT:1}`)
- V1 **REVISE** · `sig 6dd2964cfd…` · `roh 7fa167c401…`
- V2 **REVISE** · `sig 97a96829ae…` · `roh 16668f9780…`
- V3 **NO_VERDICT** · `sig e8b6cc9140…` · `roh 6f18f3d361…` *(mis-fire — see below)*

Chain verified valid at 120 entries. Verbatim reasoning: `code/data/raw-c20ec41af1dd.txt`.

---

## Verdict

The panel **ratified REVISE 2/3**: the build is faithful and sound in direction — all tests pass, each module realizes the gate(s) its spec names, and the load-bearing invariants (NI-8a, NI-9b, the CIP-5 monoculture-as-β-gate-failure) are enforced *structurally*, not by convention — **but** there are specific, real gaps to fold as follow-ups. Not INADEQUATE (nothing misrepresents what's built); not SOUND (the gaps are real).

## V2 (Codex) — independent findings

V2 read the actual source files and ran `node --test` in its own sandbox (102 pass; 17 "failures" were sandbox `EPERM` temp-dir write denials, not logic failures — correctly identified as environmental). Its findings:

1. **Independent validator key custody (its top item).** In `panel.ts`/`run-panel.ts` the orchestrator invokes validators, receives raw text, then signs the votes with keys *it* holds. This preserves auditability only if the orchestrator is honest; it does not yet prove each validator independently signed its own ballot — weakening the central CIP-3 invariant that the orchestrator is no longer the trust root. *(Already documented as a known testnet-α limitation; V2 correctly ranks it the single most important gap.)*
2. **A correctness bug in `lifecycle.ts completeRotation`** — it checked only `floorOk(after)`, so with ≥5 standing families it could retire the outgoing validator *while its replacement was still in PROBATION*, contradicting the §3.4 overlap-handoff / graduated-replacement invariant. **Found independently; not in V1's list.**
3. `ratify` accepts a caller-supplied quorum, so the 2/3 rule is not enforced by the primitive itself.

## V1 (Claude) — findings

1. **No shared identity model** (highest priority): a validator is represented three incompatible ways (CIP-3 `validatorId`, CIP-10 `NodeOperator`, CIP-7 `Validator`) and `scenario.ts` glues them by string-matching — composition by convention, not by type.
2. **commons.ts vs reputation.ts standing inconsistency**: commons v0.1 labelled a ratified majority `CONSENSUS` even on an INDETERMINATE (unverifiable-class) claim, while reputation v0.2 correctly leaves the unverifiable class `UNRANKED` (NI-9c).
3. **NI-1 simplified** to `corpusFamily` only, not the full provenance vector (corpus + teacher/distillation + weight-derivation + provider + serving).
4. **NI-10a weight-based, not a hard guarantee**: a thin slot is down-weighted (0.5) but "never decisive" is config-dependent, not structural.
5. **Bond↔resolution not hash-linked**: the bond's `ballotHash` and the settling resolution's `ballotHash` are different preimages; the link is by convention.
6. **New module state off-chain**: bonds, node registry, reputation, lifecycle panel are in-memory; only votes + notary attestations are hash-chained.

## V3 (Hermes) — mis-fire (NO_VERDICT)

V3 returned NO_VERDICT, reporting "no evidence attached" — the large (~4 KB) review context did not reach it through the `hermes chat -q` invocation, so it could not review concretely and (correctly, per its honesty rule) refused to fabricate a verdict. This is an invocation/context-delivery failure of the same class as the round-40 timeout, **not** a substantive vote. The errored entry remains in the immutable log (entry 120); quorum was met by V1+V2. Re-running V3 is deferred (the verdict is ratified and the actionable findings are already captured).

## Actions taken (this round)

Two findings were concrete correctness defects and were fixed immediately via TDD (red→green):

- **`completeRotation` (V2 finding #2):** now refuses to complete while any replacement is in PROBATION (`overlap handoff incomplete: graduate the in-probation replacement before retiring §3.4`), so the outgoing validator can never be dropped before its graduated replacement holds the floor — even when other standing families coincidentally satisfy the count. New regression test added.
- **commons standing (V1 finding #2):** the unverifiable / no-consensus class (INDETERMINATE, CONTESTED) is now `UNRANKED`, never `CONSENSUS`/`CREDIBLE_MINORITY` — reconciling commons.ts with reputation.ts and NI-9c. (Round 43's Barron INDETERMINATE claim now correctly shows `UNRANKED`.)

Suite: **120 tests, all green.**

## Backlog (the remaining REVISE items, none fatal, none change a ratified design)

1. A single canonical **Identity/Slot type** referenced by CIP-3/7/10 (turns `scenario.ts` wiring from string-matching into type-level composition) — *highest priority.*
2. **Independent validator key custody** (V2 #1) — the per-validator signer isolated from the orchestrator; the standing CIP-3 trust-root gap.
3. **NI-1 full provenance vector** in lifecycle distinctness (corpus + teacher + weight-derivation + provider + serving).
4. **NI-10a hard rule** — a thin slot structurally cannot be the pivotal vote, not merely down-weighted.
5. **Bond↔resolution hash binding** — a bond references the exact resolution `ballotHash` that settles it.
6. **On-chain state** — bond/registry/reputation/lifecycle transitions onto the tamper-evident log (CIP-3/CIP-4).
7. Consider enforcing the 2/3 quorum in the `ratify` primitive rather than by parameter (V2 #3).
