# Rounds 21–23 — Validator lifecycle & model churn (signed consultation)

**Date:** 2026-06-04
**Subject:** foundations for [[CIP-7]] — what happens to the panel when newer versions of the validating AIs are released, and when frontier models converge. Three ballots.
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519 over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained JSONL. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus, Nous Portal).

---

## Round 21 — Version policy

**Question:** When a provider ships a new version of a validating model, should a validator be pinned to a specific version, float to the provider's latest, or pin-by-default with a gated upgrade path?
**Ballot tokens:** `PINNED`, `FLOATING`, `PINNED_GATED_UPGRADE`
**Ballot hash:** `a89c676a47b0d53c70996f49114a0e85bafb828e76a85bb647f18063c38071f6`
**Result:** ✅ **PINNED_GATED_UPGRADE 3/3.**

- **V1 (Claude):** FLOATING is disqualified by [[CIP-1]] — tracking "latest" is a standing provider-side channel to change a validator under us, and it breaks the round-16 requirement that PoI bind the exact tier. PINNED preserves reproducibility/immunity but dies at sunset. PINNED_GATED_UPGRADE keeps the pin as default and makes any version change an explicit [[CIP-4]] T1 admission event (independence + calibration gate). Also defuses the "ship a v2 that inherits trust" attack.
- **V2 (Codex):** the pin is what makes proof-of-inference's tier-binding enforceable; a version change must re-enter as a fresh candidate with version-bound re-calibration.
- **V3 (Hermes):** floating "turns every model upgrade into a live supply-chain attack"; the chain needs a lifecycle that outlives any single model version.

Sigs — V1 `roh=048afdcdb9… sig=91619ec002…` · V2 `roh=b1fd3974c6… sig=e8225cd9f0…` · V3 `roh=8f4d5ef2fb… sig=3c5d638836…`

---

## Round 22 — Reputation continuity across a version change

**Question:** When a validator upgrades to a new version, what happens to the calibration/reputation its predecessor earned?
**Ballot tokens:** `RESET`, `INHERIT`, `PROBATION`
**Ballot hash:** `1533c5680d2af7c5c8bbf50bfa2868a824058391a2e7957cfc2596641301de27`
**Result:** ✅ **PROBATION 3/3.**

- **V1 (Claude):** INHERIT decouples trust from the thing that earned it (the "v2 that behaves differently but carries full trust" attack). RESET is safe but punishing and dips the panel's trusted weight right when a forced retirement may be stressing the floor. PROBATION threads it: the slot persists (continuity), votes are shadowed/down-weighted until the new version re-proves calibration on its **own** version-bound record, then earns full standing — an objective, non-discretionary signal.
- **V2 (Codex):** trust must be re-earned against a version-bound record; inheritance is the laundering path.
- **V3 (Hermes):** shadow votes should be **recorded on-chain for auditability** but down-weighted/excluded from quorum-critical tallies; graduate when calibration ≥ predecessor. A provider's historical standing may inform the **length** of the probation window (good actors graduate faster) — but trust is still earned, never skipped.

Sigs — V1 `roh=135031964b… sig=0c88692b73…` · V2 `roh=38c5b2c623… sig=28a99fcec1…` · V3 `roh=945646476d… sig=0480477502…`

---

## Round 23 — Resisting frontier convergence

**Question:** As frontier models converge (shared data, distillation, shared RLHF conventions), "distinct providers" may stop meaning "independent errors." Defend with a structural-heterogeneity mandate, continuous correlation-eviction, or both?
**Ballot tokens:** `CORRELATION_EVICTION`, `STRUCTURAL_MANDATE`, `BOTH`
**Ballot hash:** `b9deaab01194b541cf8903fd1b136ff6ab043f0d428aab966eeee2053f28f445`
**Result:** ✅ **BOTH 3/3.**

- **V1 (Claude):** the one threat that needs no attacker and erodes the system from the inside while every dashboard still shows three providers. CORRELATION_EVICTION alone is reactive (the shared blind spot stays invisible until exploited); STRUCTURAL_MANDATE alone is coarse (lineage labels gameable). BOTH: mandate reserved distinct-lineage slots as the floor **and** continuously measure realized error-correlation, evicting a converging member regardless of capability. The hard rule: **capability is subordinate to independence.**
- **V2 (Codex):** structural heterogeneity must be the admission **floor** because realized-correlation tests **lag** the collapse; an explicit lifecycle rule must preserve both intended and measured independence, even at the cost of evicting a stronger-but-redundant validator.
- **V3 (Hermes):** named the two failure shapes — **compositional collapse** (panel becomes a monoculture of one family) vs **behavioral convergence** (structurally distinct but correlated outputs). Structural mandate = compositional guardrail; correlation-eviction = runtime detector. Caveat: correlation-eviction needs a **ground-truth proxy that may not always be available** — so the structural floor is what holds when the detector is blind.

Sigs — V1 `roh=c35311b367… sig=2d49e2452f…` · V2 `roh=b5caa50cd2… sig=7bed834fbf…` · V3 `roh=84a036b543… sig=7484008a60…`

---

## Outcome

All three foundations folded into **[[CIP-7]]** (Category I extension, drafted 2026-06-04): PINNED_GATED_UPGRADE (7a), PROBATION (7c), BOTH (7d), plus the derived **overlap-handoff rotation protocol** (7b/7e) that holds the diversity floor through forced provider retirement. Next: review (round 24) → red-team (round 25) → ratify.
