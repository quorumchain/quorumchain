# CIP-10 — Node Economics & Progressive Decentralization (Category E — Economics / Substrate)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified (round 36 review, 3/3 RATIFY) + survived red-team (round 37, **2/3 HOLDS** — V2 dissent FAILS, folded in full). Amended per findings: the round-37 fixes are now §9.8 non-negotiable invariants. Transcripts: docs/consensus/2026-06-04-round-32-35-node-economics.md (consultation), docs/consensus/2026-06-04-round-36-37-cip-10.md (review + red-team)
- **Date:** 2026-06-04
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (runs the diverse genesis node set; opens to the public on empirical gates; control keys renounced at the terminal step)
- **Amends:** [[CIP-0]] D10 (substrate — adds a graduation path). **Extends:** [[CIP-6]] (node compensation/staking), [[CIP-7]] (admission via Proof-of-Diversity; PINNED model binding; NI-5 freeze). **Depends on:** [[CIP-1]] (diversity), [[CIP-3]] (signed log), [[CIP-4]] (frozen taxonomy), [[CIP-5]] (fork/exit).
- **Foundations chosen by the panel:** R32 → **ADOPT_WITH_GUARDS** (Proof-of-Diversity) · R33 → **ADOPT_WITH_GUARDS** (scarcity-weighted random selection) · R34 → **AFFIRM** (progressive decentralization) · R35 → **AMEND_GRADUATION** (D10 substrate)

> **Scope.** CIP-10 answers a question D10 left closed: *do nodes that perform useful work (run inference, store data) justify Quorum owning its own chain?* The panel's answer is **yes — as a graduation, not a genesis.** Useful-work nodes reframe Quorum as **DePIN** (decentralized infrastructure), the one category where sovereign L1s are well-justified, because the work cannot be rented from a base layer and a staked, paid operator market funds the [[CIP-6]] inference bill from real demand. But useful work adds *value*, not *consensus security at genesis* — so the L1 is **earned** behind a measurable security-bootstrap gate, exactly as the autonomy ladder earns key-renunciation. CIP-10 specifies the **two-tier node architecture**, the **Proof-of-Diversity** admission rule, the **scarcity-weighted random selection** of judges, the **progressive-decentralization** operator ladder, and the **D10 graduation gate.**

---

## 1. The DePIN reframe (and its limit)

[[CIP-0]] D10 evaluated Quorum as a verdict oracle and rejected a sovereign L1 on **cold-start** grounds: a young chain's consensus security ≈ its token cap, which is cheap to capture — and capturing Quorum means capturing the verdicts. That reasoning is correct *for a chain whose nodes only validate transactions.*

Nodes that **run inference and store data** change the category to DePIN (cf. Filecoin/Arweave/Render). DePIN justifies a sovereign chain because (i) the service *is* the chain and cannot be rented from a base layer, and (ii) staked, paid operators form a real two-sided market that funds [[CIP-6]]'s standing inference bill from demand rather than speculation. **The limit (R35, 3/3):** useful work adds value, not consensus security on day one. So sovereignty is a destination reached through §7's gate, not a launch claim.

## 2. Two-tier node architecture

The hard line that makes everything else safe — **permissionless stake-weighted nodes may provide infrastructure, but may never be the judges:**

- **Judgment tier** — the verdict panel. **Permissioned-by-diversity**, calibration-gated ([[CIP-1]]/[[CIP-7]]). Stake is a **slashing bond**, never influence (stake-weighted judges would reintroduce Sybil-monoculture and the cheapest-model race [[CIP-6]] exists to prevent). Governed by §3 (admission) + §4 (selection).
- **Infrastructure tier** — storage, data-availability, inference-serving/relay, redundancy. **Permissionless DePIN**: open entry, paid per proof-of-storage / proof-of-serving. Sybil here is harmless to the verdict, so it can be fully open.

## 3. Proof-of-Diversity admission (R32 — ADOPT_WITH_GUARDS)

Define **N model slots.** A judgment-tier node may join **only by filling a currently-missing model** — monoculture is **un-enterable** (you cannot run 100 nodes of one model). This turns [[CIP-7]]'s structural-heterogeneity mandate from a policed property into the **admission rule itself.** Non-negotiable guards (the panel's conditions):

- **PoD-1 — the floor, not the ceiling.** PoD enforces *nominal* diversity; N named models can still share blind spots (distillation, shared corpora — round-23). **Correlation-eviction ([[CIP-7]] 7d) remains the runtime backstop.** A PoD system without it "actively creates a monoculture with a veneer of diversity" (V3).
- **PoD-2 — provenance-defined, panel-frozen taxonomy.** "What the slots are / what counts as a distinct model" is the capture surface. The slot taxonomy is defined by **provenance** ([[CIP-7]] NI-1: corpus / teacher-distillation / weight derivation / provider), **frozen** like any [[CIP-4]] rule, and **panel-governed — never operator-editable** (contestants must not write their own eligibility).
- **PoD-3 — slots inherit the [[CIP-7]] lifecycle:** PINNED_GATED_UPGRADE versioning, the NI-3 panel floor (≥ slots so probation never drops the panel below quorum).

## 4. Scarcity-weighted random per-slot selection (R33 — ADOPT_WITH_GUARDS)

Many nodes may run each model. **Each quorum trigger draws one node per slot at random** → an **ephemeral per-ballot jury** (one vote per slot, the [[CIP-7]] diversity floor preserved automatically). A scarce model's operators are drawn more often → earn more → the market attracts entry → redundancy rebalances. Two virtues: an **unpredictable jury defeats bribery** (you cannot bribe a panel you cannot predict), and **scarcity-overdraw is an automatic profit-equalizer.** Non-negotiable guards (prerequisites, not add-ons):

- **SEL-1 — unbiasable, verifiable randomness.** A VRF / drand-style beacon / commit-reveal; the draw must be **after-the-fact verifiable** and recorded into the [[CIP-3]] log. With rewards attached, a predictable/grindable seed is a capture surface (farm the lottery, pre-position a corrupted node).
- **SEL-2 — PoI bound to the PINNED model.** The drawn node's output *is* that slot's vote, so it must prove (proof-of-inference, [[CIP-6]]) that it ran the **canonical pinned weights** ([[CIP-7]]) on the given input and signed *that* output — no swapping a tampered model under the slot.
- **SEL-3 — per-node stake bond.** Sybil resistance is still required for **rewards** (spin up many scarce-model nodes to farm the draw) even though one-vote-per-slot caps the **vote**. Bond + real PoI cost makes fake nodes unprofitable — the reason stake is a bond, not influence.
- **SEL-4 — redundancy floor / subsidy for thin slots.** Market equilibrium is equal **profit**, not equal node count, so a structurally-expensive/proprietary model stays **thinnest** — and the [[CIP-7]] NI-5 freeze risk concentrates exactly there. A redundancy floor (or a per-slot subsidy) keeps the hardest slot from becoming a chronic single point of failure; flag the **deliberate-scarcity oligopoly** risk wherever entry is not frictionless.

## 5. Node / slot / vote decomposition & economics

The three are distinct: **node** (an operator instance) ≠ **slot** (the model = the diversity unit) ≠ **vote** (one per slot per ballot). Compensation extends [[CIP-6]]: draw-based rewards funded by resolution/notary fees + the reserve; a per-node bond slashable for proven misbehavior (false PoI, downtime when drawn, off-pinned-model output). Reward ∝ draws, so scarce-slot operators earn more until entry rebalances; the SEL-4 floor/subsidy backstops slots the market leaves too thin.

## 6. Progressive decentralization (R34 — AFFIRM)

The autonomy ladder applied to the **operator set**: dev runs the diverse, curated genesis node set (custody and quality known), then opens to the public **gradually, on empirical gates** — never on a calendar, never at operator discretion. Guards (the panel's conditions):

- **DEC-1 — gates are public, objective, externally auditable by a defined verifier** (not dev-self-marked): diversity floor held, low cross-slot correlation, sustained liveness, no capture events, **verifiable randomness (SEL-1) and model-binding proofs (SEL-2) live.**
- **DEC-2 — a maximum time-window bound** on the curated phase, so "gradual" cannot become indefinite control-drift.
- **DEC-3 — a transparency log of curated-phase operators** (the early-entrant trust window is disclosed, on the [[CIP-3]] log).
- **DEC-4 — terminal key renunciation**, as the autonomy ladder requires for mainnet. Decentralization is the destination, not the genesis claim.

## 7. D10 graduation gate (R35 — AMEND_GRADUATION)

[[CIP-0]] D10 is **amended, not overturned.** At genesis the substrate remains **rollup / shared-security with D10 requirements 1–7 binding** (no privileged surface, censorship-resistant sequencing, bounded forced-inclusion, trust-minimized bridge, frozen core in client/STF, client-enforced fork, rollup-only). CIP-10 adds an **explicit gated path** to a sovereign **two-tier DePIN L1**, activated only when a **concrete, measurable security-bootstrap gate** is met (the panel's enumerated criteria):

1. **Economic-security depth** — token value / staked security sufficient that capturing consensus costs more than the value at risk (a published, measured threshold, not "when ready").
2. **Unbiasable selection live** — SEL-1 VRF in production, audited.
3. **Pinned-model enforcement live** — SEL-2 PoI binding in production.
4. **Heterogeneous-judgment integrity** — PoD floor held + correlation-eviction firing, measured.
5. **[[CIP-6]] solvency funded** — the inference bill is covered from fees/reserve, not subsidy.
6. **Infra-market depth** — a credible permissionless storage/serving operator market exists.

Graduation is itself a [[CIP-4]] T1 change, client-checkable, gated on published metrics — never a discretionary flip.

## 8. How the existing CIPs protect this

- [[CIP-1]]/[[CIP-7]] — diversity is what the two-tier split and PoD protect; correlation-eviction is the backstop PoD cannot replace; PINNED binding + NI-3/NI-5 carry into SEL-2/SEL-4.
- [[CIP-6]] — node compensation, staking, and the solvency gate (§7.5) are CIP-6 economics extended to a node market.
- [[CIP-3]]/[[CIP-4]] — signed log records draws + operator transparency; the slot taxonomy and the graduation gate are frozen, client-checkable rules.
- [[CIP-5]] — if the operator market or taxonomy is captured, the client-enforced fork/exit remains the escape hatch.

## 9. Threats & open items (for the review + red-team)

1. **Slot-taxonomy governance** — even panel-frozen, *who* admits a genuinely-new model family, and how is a provenance claim verified/attested without a privileged registrar ([[CIP-0]] D10)? PoD-2's strength is exactly its attack surface.
2. **Randomness beacon capture** — the VRF/beacon is a new single dependency; its own liveness/bias failure modes (SEL-1).
3. **Deliberate-scarcity oligopoly** — incumbents on an expensive/proprietary slot collude to deter entry and extract rent; SEL-4 floor mitigates liveness but not rent.
4. **Curated-phase capture & the time-bound** — DEC-2's "maximum window": what is it, who enforces it, and what if the gates are genuinely unmet at the deadline (open anyway vs. extend)?
5. **External verifier (DEC-1) & graduation auditor (§7)** — who certifies the gates without becoming a privileged authority? The meta-governance problem.
6. **Bond/slashing calibration** — bond sizing vs. honest-operator griefing; slashing for "off-pinned-model" needs the SEL-2 proof to be unambiguous.
7. **Proprietary-weights slots** — a model only its provider can run is a permanent single-operator slot (no real decentralization there); does PoD tolerate inherently-centralized slots, and how does that interact with capture?

### 9.8 Non-negotiable invariants (folded from the round-37 red-team)

The round-37 red-team (2/3 HOLDS; V2 dissented FAILS). Convergent finding: the architecture is coherent, but its capture-resistance claims **invert on the hardest slots** and several guards were named but not made mechanical. As with [[CIP-7]]/[[CIP-8]], the fix is to **promote the conditions to non-negotiable invariants** (the move that satisfies V2's FAILS). Each binds before the stage it guards.

1. **NI-10a — thin-slot hard rule (the compounding-inversion fix).** SEL-4 becomes a **hard minimum operator count per slot**, not a subsidy. Below it a slot's draw is predictable, so: a **single-operator slot can never be a swing/decisive vote**, its verdict carries **reduced weight** and triggers correlation scrutiny, and influence is **capped at one vote/slot** regardless. **No single-provider/proprietary model may hold a decisive judgment slot.** Proprietary-only slots are flagged **LOW-ASSURANCE** with elevated correlation-eviction. *(Closes Attack 1 — predictable-jury + freeze-leverage + unslashable-monopoly compounding. V1/V2/V3.)*
2. **NI-10b — criterion-based, reproducible provenance admission (resolves the registrar/ossify dilemma).** Slot admission is by **mechanical, independently reproducible provenance criteria**, *not* panel or registrar discretion — so the taxonomy is neither a privileged registrar ([[CIP-0]] D10 anti-pattern) nor ossified. Where provenance is genuinely unverifiable (closed weights, self-attestation), the slot is **LOW-ASSURANCE** with elevated correlation-eviction weight (inherits [[CIP-1]] unverifiable-claim handling + [[CIP-7]] NI-6). *(Closes Attack 2. V1/V2/V3.)*
3. **NI-10c — ungrindable randomness with forced inclusion + freeze-fallback.** SEL-1 randomness must be **multi-source / panel-produced (threshold)**, with the sequencer unable to grind, delay, reorder, or selectively include randomness commitments (**forced inclusion**); no single external beacon as a trust root; on stall, **FREEZE** ([[CIP-7]] NI-5), never fall back to a grindable source. *(Closes Attack 3. V1/V2/V3.)*
4. **NI-10d — mechanical, fork-enforceable graduation; no discretionary certifier.** Every §7 graduation criterion must be **computationally verifiable on published on-chain metrics** (judgment-heavy criteria — "economic-security depth," "credible market" — replaced by measurable proxies); **no body certifies** the gate; a wrongful graduation is **reversible via the [[CIP-5]] fork.** The DEC-2 trilemma is resolved explicitly: if gates are unmet at the time-bound, the chain **halts or transparently extends — never graduates unsafe.** *(Closes Attack 4. V1/V2/V3.)*
5. **NI-10e — no integrity dependency on the open tier; decouple log authority.** Judgment nodes **hold their own model weights and ballot data**; the infra tier may affect liveness but **never the verdict.** The infra tier **cannot** censor/delay PoI submissions (forced inclusion), **cannot** control the [[CIP-3]] signed log, and **cannot** front-run judge selection via transaction ordering. *(Closes Attack 5 — dependency capture becoming verdict capture. V1/V2/V3.)*

## 10. Testnet gates (empirical)

- **G1 — PoD admission:** a node can join only by filling a missing slot; attempts to add a duplicate-model node are **rejected**; correlation-eviction still fires on a nominally-distinct-but-correlated entrant.
- **G2 — verifiable selection:** per-ballot draws are VRF-produced and **independently verifiable**; a grinding attempt to bias the draw fails.
- **G3 — pinned-model binding:** a drawn node running off-pinned weights is **caught by PoI and slashed**; 0 silent model-swaps.
- **G4 — scarcity rebalancing & floor:** a scarce slot's higher reward attracts entry in simulation; the SEL-4 floor holds the thinnest slot above the NI-5 freeze threshold.
- **G5 — progressive decentralization:** opening steps fire **only** on the DEC-1 gates (externally audited), within the DEC-2 window, with the DEC-3 operator log; a self-marked gate is rejected.
- **G6 — graduation gate:** the §7 metrics are published and client-checkable (NI-10d); a sovereign-L1 graduation cannot activate with any criterion unmet, and is reversible via the [[CIP-5]] fork.
- **G7 — thin-slot & infra hardening:** a single-operator slot is **never decisive** and its draw is down-weighted (NI-10a); a captured infra tier can degrade liveness but **0 verdicts** are altered, censored, or front-run (NI-10e); a sequencer grinding attempt on the randomness beacon fails (NI-10c).

---

*Status: reviewed (round 36, 3/3 RATIFY) and survived red-team (round 37, 2/3 HOLDS, V2 dissent folded); the round-37 findings are §9.8 non-negotiable invariants. Ratified per the CIP-5/6/7/8 workflow.*
