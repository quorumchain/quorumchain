# CIP-9 Amendment — Claim Status as a Total Function of Substantive-Verdict Presence (Category — Knowledge Commons / Read Path)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified & implemented. Design-ratified across two consults — principle ballot `2d1e9a2d1b711b4263605b3e8779851709d9ac18401291c35e1468407c927d2c` (2/3 MAP_TO_INDETERMINATE; V1 dissent EXCLUDE_FROM_RATIFY) + scope ballot `11db96068d301f0993923ba0599e5f0c63284aa95fd06ae687c1d8be3de634a6` (**3/3 GENERAL_TOTAL_FUNCTION**). **Draft survived red-team 3/3** — ballot `5885f224844b229d3116d62b011acc7a05ccac8ebe4163b3ee128a38448f3746` (V1/V2/V3 all YES; no binding finding). **Implemented under TDD** — `commons.ts` status-layer change + 7 §7 tests; full suite 240/240 green, zero regression.
- **Date:** 2026-06-05
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev
- **Amends:** [[CIP-9]] (the Knowledge Commons read path) — replaces the `buildClaimIndex` status-derivation rule. **Surfaced by:** the CIP-12 case-study corpus (an all-ABSTAIN ballot projecting as RESOLVED).

> **Scope.** A controversial-question case study surfaced a defect in how the Commons projects a verdict to a claim *status*: a ratified all-ABSTAIN ballot rendered as `RESOLVED`/ABSTAIN — an honest non-answer presented as a settled result. The root cause is that the status rule uses the bare `ratified` boolean as a proxy for *"does a substantive position exist?"* It has a dual: a NO_VERDICT-only ballot (three parse failures) renders as `CONTESTED`, though there is no contest. This amendment makes `status` a **total function of substantive-verdict presence**, independent of the `ratified` flag: a status of `RESOLVED` exists **iff** an enforceable substantive verdict carries a supermajority; competing substantive verdicts without a supermajority are `CONTESTED`; the absence of any surviving substantive position is `INDETERMINATE`. It is a status-*projection* change only — ratification semantics are untouched, so `ABSTAIN` remains tallied and transparent on-chain; it simply never projects to `RESOLVED`.

---

## 1. The defect

Current `buildClaimIndex` status derivation:

```
status = (!r.ratified ? 'CONTESTED' : r.verdict === 'INDETERMINATE' ? 'INDETERMINATE' : 'RESOLVED')
```

This asks only *"did something ratify?"*, never *"does a substantive position exist?"* — producing two dual defects:

- **All-ABSTAIN → RESOLVED** (the surfaced bug). A ratified `ABSTAIN` carries no enforcement direction, yet projects as a settled result.
- **NO_VERDICT-only → CONTESTED** (the latent twin). Three parse/invocation failures are not a contest, yet fall into the `!ratified` catch-all.

Both let the `ratified` flag stand in for substantive-position presence. `ABSTAIN` (a validator *declined* to judge) and `NO_VERDICT` (an invocation *failed*) are tallied for transparency but are **non-substantive** — they carry no enforceable direction.

## 2. The amendment

The **non-substantive set** is `{ ABSTAIN, INDETERMINATE, NO_VERDICT }` — verdict tokens that carry no enforcement direction. Every other token (`YES`, `NO`, and any domain token) is **substantive**. `status` becomes a total function over the claim's counted stances:

```
substantive = stances whose position ∉ { ABSTAIN, INDETERMINATE, NO_VERDICT }

  ratified AND the ratified verdict is substantive   → RESOLVED
  else if ≥2 distinct substantive positions          → CONTESTED
  else                                               → INDETERMINATE
```

## 3. Binding invariant (the ratified rule)

> **`status` is a total function of substantive-verdict presence, independent of the bare `ratified` flag.** `RESOLVED` ⟺ an enforceable substantive verdict holds a supermajority. `CONTESTED` is reserved strictly for ≥2 *competing substantive* verdicts where none reaches supermajority. The absence of any surviving substantive position (all-ABSTAIN, NO_VERDICT-only, a lone sub-supermajority position, or empty) is `INDETERMINATE`. No non-enforcement verdict (`ABSTAIN`, `INDETERMINATE`, `NO_VERDICT`) ever projects to `RESOLVED`.

## 4. Behaviour table (before → after)

| Ballot | Today | After | Correct? |
|---|---|---|---|
| Substantive supermajority (e.g. 3×YES, 2×YES+1×NO) | RESOLVED | **RESOLVED** | unchanged ✓ |
| 2×YES + 1×ABSTAIN | RESOLVED/YES | **RESOLVED/YES** | unchanged ✓ (ABSTAIN never blocks a real supermajority) |
| 2×YES + 1×NO_VERDICT | RESOLVED/YES | **RESOLVED/YES** | unchanged ✓ |
| Genuine split, ≥2 substantive, no supermajority (A/B/C) | CONTESTED | **CONTESTED** | unchanged ✓ |
| Ratified all-INDETERMINATE | INDETERMINATE | **INDETERMINATE** | unchanged ✓ |
| **All-ABSTAIN (ratified ABSTAIN)** | RESOLVED/ABSTAIN | **INDETERMINATE** | **fixed** (surfaced bug) |
| **NO_VERDICT-only** | CONTESTED | **INDETERMINATE** | **fixed** (latent twin) |
| **1 substantive + 2 failures** (e.g. 1×YES + 2×NO_VERDICT) | CONTESTED | **INDETERMINATE** | **fixed** (no competitor — not a contest, not a resolution) |
| **1 substantive + 2 INDETERMINATE** (1×YES + 2×INDETERMINATE) | CONTESTED | **INDETERMINATE** | **fixed** (same class — lone sub-supermajority position, no competitor) |

## 5. Scope and what is preserved

- **`commons.ts` status-layer only. No ratify-layer change.** `ABSTAIN` stays ratifiable and tallied — the transparent record that the panel *deliberately abstained* is never erased (the explicit reason EXCLUDE_FROM_RATIFY was rejected). Ratification records *what happened*; projection interprets *what it means* — orthogonal concerns.
- Substantive-supermajority `RESOLVED` and genuine-split `CONTESTED` are unchanged.
- The CIP-12 correlation receipt (NI-12b descriptive-not-dispositive) is unaffected; this changes `status`, not the receipt.
- **Verified zero regression:** across the current 233 tests, `BH_NOQUORUM` (A/B/C) stays CONTESTED and `BH_WITHFAIL` (2×YES+1×NO_VERDICT) stays RESOLVED; no existing test asserts all-ABSTAIN→RESOLVED or NO_VERDICT-only→CONTESTED, so no consensus-test assertion is flipped — the change only *adds* correct handling for the no-substantive-position case.

## 6. Why this scope (the folded dissent)

On the principle consult V1 dissented (EXCLUDE_FROM_RATIFY), arguing the real defect was the missing "does a substantive position exist?" test and that NO_VERDICT-only was the same bug's dual. The scope consult then ratified that broader reading **3/3** — the credible-minority mechanism working as designed: a recorded dissent became the unanimous next-round position once its only practical objection (test-churn / regression-laundering risk) was empirically removed. EXCLUDE_FROM_RATIFY itself was declined because the status-layer total-function already yields correct chain-observable outcomes, and changing ratification semantics would *lose* the transparent abstention record for no gain.

## 7. Test plan (TDD)

1. all-ABSTAIN → INDETERMINATE (was RESOLVED) — surfaced bug
2. NO_VERDICT-only → INDETERMINATE (was CONTESTED) — latent twin
3. 1 substantive + 2 failures → INDETERMINATE (edge: no competitor)
4. `BH_NOQUORUM` (A/B/C) → still CONTESTED (regression guard)
5. `BH_WITHFAIL` (2×YES+1×NO_VERDICT) → still RESOLVED (regression guard)
6. substantive supermajority → still RESOLVED; 2×YES+1×ABSTAIN → still RESOLVED/YES
7. ratified all-INDETERMINATE → still INDETERMINATE

## 8. CIP-9 amendment designation

This changes chain-observable status semantics (all-ABSTAIN and NO_VERDICT-only ballots change their projected status), so it is a normative consensus change to [[CIP-9]], not a refactor — recorded here, red-teamed before implementation, implemented under TDD.

---

## Provenance

- **Principle consult:** ballot `2d1e9a2d…c927d2c`, 2/3 MAP_TO_INDETERMINATE (V1 dissent EXCLUDE_FROM_RATIFY). Raw: `code/data/raw-2d1e9a2d1b71.txt`.
- **Scope consult:** ballot `11db9606…3de634a6`, **3/3 GENERAL_TOTAL_FUNCTION**. Raw: `code/data/raw-11db96068d30.txt`.
- **Draft red-team:** ballot `5885f224…448f3746`, **3/3 YES** (no binding finding; V1/V2/V3 each verified the before/after table against live code and confirmed totality + zero regression). Raw: `code/data/raw-5885f224844b.txt`.
- **Surfaced by:** the CIP-12 demonstration corpus — an all-ABSTAIN case-study ballot projecting as RESOLVED/ABSTAIN.
- **Implementation:** `code/src/commons.ts` — module-level `NON_SUBSTANTIVE = {ABSTAIN, INDETERMINATE, NO_VERDICT}` + total-function status derivation in `buildClaimIndex`. Tests: `code/test/commons.test.ts` (7 §7 cases). Full suite **240/240 green**, zero regression.
