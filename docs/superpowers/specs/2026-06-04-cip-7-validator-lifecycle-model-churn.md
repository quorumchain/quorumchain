# CIP-7 — Validator Lifecycle & Model Churn (Category I extension)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified (round 24 review, 3/3 RATIFY) + survived red-team (round 25, **2/3 HOLDS** — V2 dissent FAILS, folded in full). Amended per findings: the round-25 fixes are now §5 non-negotiable invariants. Transcripts: docs/consensus/2026-06-04-round-21-23-validator-lifecycle.md (consultation), docs/consensus/2026-06-04-round-24-25-cip-7.md (review + red-team).
- **Date:** 2026-06-04
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (admits/retires validators during bootstrap; admission key renounced at mainnet per the autonomy ladder)
- **Depends on:** [[CIP-1]] (diversity = security; §6 independence/fingerprint test; §7 distinct-model-families rule), [[CIP-4]] (T1 admission events; T0-frozen diversity *principle*), [[CIP-6]] (proof-of-inference binds the exact model tier; diversity is a standing solvency cost)
- **Foundations chosen by the panel:** round 21 → **PINNED_GATED_UPGRADE** (3/3) · round 22 → **PROBATION** (3/3) · round 23 → **BOTH** (3/3)

> **Scope.** CIP-7 is a **Category I extension.** [[CIP-1]] proves *why* a diverse panel is the security model and tests independence at a single instant. CIP-7 governs that panel **over time** — how a validator is upgraded, how a new version earns trust, how forced retirement is survived, and how the panel resists silently collapsing into a monoculture as the frontier converges. The principle CIP-7 protects is one line: **the chain must outlive its most ephemeral component.** Validators *are* specific model versions; models are retired on a yearly cadence; diversity is the security model. The panel is permanent — its members are not.

---

## 1. The central tension — a permanent panel of impermanent members

Every other chain's validators are interchangeable, durable software. Quorumchain's validators are **named, dated model versions** — `claude-opus-4-8`, `gpt-5.5`, `qwen3.6-plus` — each of which a provider will sunset, often on 12–18 month cycles, sometimes abruptly. Three facts collide:

1. **Diversity is the security model** ([[CIP-1]]): the 2/3 guarantee rests on independent errors across distinct model families.
2. **Reproducibility is the integrity model** ([[CIP-6]] §PoI): a verdict must bind to the *exact* model tier that produced it, or proof-of-inference is meaningless.
3. **Models churn**: the specific versions that satisfy (1) and (2) today will not exist in two years.

So the lifecycle must, **with no human in the loop at mainnet**, replace ephemeral members without (a) handing a provider a silent channel to change a validator under us, (b) letting a new version inherit trust it has not earned, (c) ever dropping below the diversity floor during the swap, or (d) letting the surviving members quietly converge into one effective mind. Each of the four is a distinct threat with a distinct, panel-chosen answer.

---

## 2. Threat model & chosen defenses

### 7a — Silent provider substitution *(version policy)* → **PINNED_GATED_UPGRADE**
A validator pinned to "the provider's latest" hands the provider a **standing channel** to alter that validator's behavior with no transaction, no vote, no admission event — provider-compromise as a permanent *condition* rather than an attack. It also breaks [[CIP-6]]'s requirement that proof-of-inference bind the exact model tier: you can no longer prove *which* model produced a verdict.

**Defense (round 21, 3/3):** pin by default — reproducibility and provider-change immunity hold. Any version change is an **explicit admission event**, processed as a [[CIP-4]] **T1** change in which the new version is treated as a *fresh candidate* that must pass the [[CIP-1]] §6 independence/fingerprint test **and** a calibration gate before it replaces the old pin. An upgrade is therefore never silent and never automatic. (V3: floating "turns every model upgrade into a live supply-chain attack." V2: the pin is what makes PoI's tier-binding enforceable.)

### 7b — Brittleness at sunset *(the cost of pinning)* → gated upgrade + §3 rotation protocol
A *hard* pin with no upgrade path is safe but mortal: it goes stale and dies at the provider's sunset with no way to improve. PINNED_GATED_UPGRADE already supplies the controlled path in; §3's rotation protocol supplies the path *out* without a coverage gap.

### 7c — Trust-inheritance exploit *(reputation continuity)* → **PROBATION**
If a new version automatically **inherits** its predecessor's earned reputation/calibration weight, trust is decoupled from the thing that earned it: a provider (or adversary) ships a "v2" that behaves differently but carries full influence on day one. A clean **RESET** is safe but punishing — it discards institutional continuity and forces honest upgrades to re-earn from zero, and during that window the panel's effective trusted weight dips, which is most dangerous precisely when a forced retirement is already stressing the floor.

**Defense (round 22, 3/3):** a new version takes the validator's **slot** provisionally (continuity preserved), but its votes are **shadowed / down-weighted** — recorded on-chain for auditability, discounted or excluded from quorum-critical tallies — until it **re-proves calibration on its own version-bound record** over a defined window, then graduates to full standing. Reputation is **version-bound and never inherited** (consistent with the metacognition logic: calibration is a property of a specific model version). A provider's historical standing may *shorten* the probation window (good actors graduate faster) but can **never skip** it — trust is always re-earned. PROBATION also gives an objective, non-discretionary admission signal rather than a governance judgment call.

### 7d — Frontier convergence *(the existential, self-arising risk)* → **BOTH**
This is the one threat that needs **no attacker**. As frontier models train on overlapping corpora, distill from one another, and converge on shared RLHF conventions, "three distinct providers" can quietly stop meaning "three independent error distributions." The system erodes **from the inside while every dashboard still shows three providers.** The panel distinguished two failure shapes (V3):

- **Compositional collapse** — the panel drifts into a *monoculture of one family* (e.g. three frontier transformers post-trained on the same data). A structural property.
- **Behavioral convergence** — members remain structurally distinct yet their *outputs* correlate (the same confident shared blind spot). A runtime property.

Neither single control is sufficient. CORRELATION_EVICTION alone is **reactive** — you act only once correlation is *observed*, and a subtle shared blind spot stays invisible until the moment it is exploited (all three confidently wrong together); worse, realized-correlation tests **lag** the collapse (V2). STRUCTURAL_MANDATE alone is **proactive but coarse** — lineage labels can be gamed and "different architecture" does not guarantee uncorrelated errors.

**Defense (round 23, 3/3) — BOTH, layered:**
- **Structural-heterogeneity mandate = the floor (compositional guardrail).** Reserve slots for deliberately distinct lineages — open-weight, different architecture, non-distilled, even an older or smaller model — so the panel can *never* collapse into one frontier class. This is the admission floor because it is checkable *before* any correlation has had a chance to manifest.
- **Continuous correlation-eviction = the runtime detector (behavioral guardrail).** Measure realized cross-validator error-correlation / fingerprint collapse on an ongoing basis; **evict a converging member regardless of how individually capable it is.**
- **The hard rule, stated plainly: capability is subordinate to independence.** The chain must sometimes *prefer a less-capable but less-correlated validator*, because independence is what the 2/3 guarantee actually rests on.

### 7e — Rotation gap *(diversity-floor breach during churn)* → §3 overlap-handoff + standby pool
The act of swapping a member is itself an attack window: retire-then-admit drops the panel below the [[CIP-1]] §7 floor for the duration; admit-then-retire requires capacity. A sudden provider sunset can force the issue with no notice. The defense is the §3 protocol: **never retire a validator until a qualified, probation-graduated, structurally-diverse replacement already holds the floor**, backed by a pre-qualified standby pool.

---

## 3. The validator lifecycle protocol

The synthesis of the four defenses into one no-human procedure:

1. **Admission (every entry, including a version upgrade) is a [[CIP-4]] T1 event.** A candidate must pass, in order:
   - **(i) Structural-diversity check** — distinct lineage; does not collapse a reserved heterogeneity slot or reduce the panel below the [[CIP-1]] §7 distinct-family floor.
   - **(ii) [[CIP-1]] §6 independence / fingerprint test** — empirically uncorrelated errors vs. the standing panel.
   - **(iii) Calibration gate** — meets the calibration bar on its own version-bound record.
2. **Version upgrade of a standing validator → PROBATION.** Provisional slot; votes recorded on-chain but shadowed / down-weighted out of quorum-critical tallies; graduates to full weight when it re-proves calibration **≥ its predecessor** over the probation window. Provider track record may shorten, never skip, the window.
3. **Standing membership is continuously monitored.** Realized error-correlation and fingerprint drift are measured on an ongoing basis; a member crossing the convergence threshold is **evicted regardless of capability** (7d).
4. **Retirement / rotation = overlap handoff.** A replacement is admitted *and graduated* **before** the outgoing validator is dropped, so the structural-diversity floor and the ≥3-distinct-family floor are **never** breached (7e). A **pre-qualified standby pool** absorbs sudden provider sunsets without a scramble.
5. **Capability is subordinate to independence** at every step (7d) — the tie-break rule wherever a more-capable choice would reduce diversity.

---

## 4. Cross-cutting invariants

- **Reputation / calibration is version-bound and never inherited** (7c). It is a property of `provider+version`, not of `provider`.
- **A permanent compositional floor exists** (7d): a non-zero count of reserved structural-heterogeneity slots is part of the [[CIP-4]] **T0-frozen diversity principle**; *which* lineages fill them and the slot count are **T2-tunable parameters**. (The diversity *principle* is frozen; the lifecycle *parameters* are governable.)
- **Correlation-eviction needs a ground-truth proxy, which is not always available** (V3's caveat). Where verdicts have no checkable ground truth (the [[CIP-1]] unverifiable-claim class), the system must **fall back to structural diversity + fingerprint**, never relying on realized-correlation alone. The structural floor is what holds when the detector is blind.
- **Everything client-checkable is client-enforced** ([[CIP-5]] style): admission gates and the floor invariant should be verifiable by any node from the signed log, not asserted by a privileged coordinator. This inherits the [[CIP-0]] D10 round-20 requirement of *no privileged upgrade/admission surface*.

---

## 5. Non-negotiable invariants (folded from the round-25 red-team)

The round-25 red-team (2/3 HOLDS; V2 dissented FAILS) converged on one verdict: CIP-7 is sound in direction but was **not ratifiable while its strongest guarantees sat in "open items."** A deferred guarantee is a dashboard label. These six are therefore **promoted to non-negotiable invariants** — enforceable at genesis, client-checkable where possible, not roadmap items. Each closes a specific attack from the transcript.

1. **NI-1 — "distinct lineage" is provenance, not a model card.** A candidate satisfies the structural-diversity floor only on **attested, client-checkable provenance**: pretraining-corpus overlap, teacher/distillation ancestry, weight derivation, provider control, and serving stack. Different name / size / architecture alone is **insufficient**. *(Closes Attack 1 — the gameable-lineage intent-vs-check gap; V1/V2/V3.)*
2. **NI-2 — concurrent probations are capped at 1, in the protocol.** Not a tunable. At most one slot may be in probation at a time; a second upgrade queues. *(Closes the panel-degradation attack — two simultaneous upgrades can never drive the panel below quorum; V3 Attack 1, V1, V2.)*
3. **NI-3 — probation quorum weight is ZERO, and the standing panel floor is ≥4.** Shadowed votes are recorded on-chain (auditability) but carry **zero** quorum weight (no influence leak), and the distinct-family panel floor is held at **≥4** so that a single in-probation slot still leaves **≥3 independent validators** satisfying the [[CIP-1]] §7 floor. *(Resolves both horns of Attack 4 — no leak AND no sub-quorum window; V1, V3, V2.)*
4. **NI-4 — every new version on a slot goes through probation — upgrade *or* replacement.** A rotation-replacement is not exempt; otherwise it is a trust-inheritance bypass. *(Closes the V3 §7e replacement-bypass loophole.)*
5. **NI-5 — forced double-sunset fails safe to FREEZE, never to a floor breach.** If no probation-graduated, structurally-diverse replacement can hold the floor, the chain enters **read-only / verdict-halt** rather than ratifying below the diversity floor. The standby pool is sized for **N simultaneous removals where N = the provider count (≥2)** — a mandatory invariant, not open item #4. *(Closes Attack 3 / the double-sunset hole; V1/V2/V3.)*
6. **NI-6 — where no ground-truth proxy exists, the structural floor is the SOLE guarantee, with extra margin.** Correlation-eviction is a *monitoring aid*, not a capture-prevention proof: fingerprints test behavioral difference on *sampled* prompts, never independence on adversarial *future* unverifiable claims. On the unverifiable-claim class the system must hold **additional structural margin** and must not treat a passed correlation test as evidence of independence. *(Addresses the sharpest round-25 finding — V3's laundered-capture: a genuinely structurally-distinct model that shares a blind spot precisely on the class the detector cannot see.)*

### 5.7 Still open (parameters only)

These remain genuinely open but are **parameters within the invariants above**, due before β-gate, not unresolved guarantees:

- Probation **window length & graduation threshold** (calibration-≥-predecessor bar; minimum sample of version-bound verdicts; how prior provider standing scales the window).
- The exact **correlation metric & threshold** (the *policy* — sole-guarantee fallback — is fixed by NI-6).
- Exact **standby-pool count** (the *rule* — ≥ provider count — is fixed by NI-5).
- **Interaction with the metacognition pillar** — calibration is the shared currency of 7c and 7d; whether metacognition becomes its own CIP and how its calibration record feeds the probation gate (the standing open thread from rounds 17–18).

---

## 6. Testnet gates (empirical, per the autonomy ladder)

CIP-7 graduates from β only after, in simulation:

- **G1 — sunset drill:** force a provider retirement; the rotation protocol maintains the diversity floor with **0 breaches** across the handoff window, and the replacement goes through probation (NI-4).
- **G2 — upgrade drill:** ship a "v2"; PROBATION holds — the new version carries **0 inherited trust** and **0 quorum weight** while shadowed (NI-3), re-proves calibration, then graduates. A *second* concurrent upgrade is **queued, not admitted** (NI-2).
- **G3 — convergence drill:** inject deliberately correlated validators; **correlation-eviction fires** where ground truth exists, and on the unverifiable-claim class the structural floor + extra margin holds with the proxy withheld (NI-6). Include V3's laundered-capture variant — a structurally-distinct model that diverges on verifiable claims but shares a blind spot on the unverifiable class — and confirm the structural floor, not the detector, is what must catch it.
- **G4 — double-sunset drill:** retire two providers with an undersized pool; the chain **enters FREEZE / read-only rather than breaching the floor** (NI-5), and resumes only once a graduated diverse replacement holds the floor.
- **G5 — substitution audit:** across all drills, **0 silent substitutions** — every behavior change of any validator corresponds to a logged T1 admission event.

---

## 7. The recurring lesson, restated

Every prior red-team (rounds 8, 12, 16, 20) found capture **laundered through the gap between a rule's intent and its mechanical check.** CIP-7's exposure is the same shape across *time*: "three distinct providers" is the *intent*; "three provider names on the dashboard" is the lax *check*. Round 25 found the gap **one layer deeper** (V3): even a model that is *genuinely* structurally distinct can share a blind spot precisely on the unverifiable-claim class — where the correlation detector is blind by construction — so "independent on verifiable benchmarks" is itself a lax check for "independent on the claims that matter." NI-1 closes the surface gap (provenance, not model card); NI-6 closes the deeper one (structural margin as the sole guarantee where the detector can't see, never treating a passed correlation test as proof of independence). The dissent that drove these fixes (V2's FAILS) was not that CIP-7 is wrong, but that a guarantee deferred to an "open item" is no guarantee — which is why the round-25 findings are now invariants, not aspirations. The lifecycle is what turns "outlive any single model, with no human" from an aspiration into a procedure.

---

*Status: reviewed (round 24, 3/3 RATIFY) and survived red-team (round 25, 2/3 HOLDS); round-25 findings folded as §5 non-negotiable invariants. Ratified per the CIP-5 / CIP-6 workflow.*

**Drills built (2026-06-04).** The no-human lifecycle procedure and the NI-1..6 invariants are now code — `code/src/lifecycle.ts` (`proposeUpgrade`/`graduate`, `beginRotation`/`completeRotation`, `correlationEvict`, `auditSubstitutions`, `floorOk`/`effectiveQuorum`) + the demo `code/src/lifecycle-demo.ts`. All five §6 gates pass (`node --test`, 11 CIP-7 tests within 95 total): **G1** sunset (overlap handoff holds the ≥4 floor with 0 breaches; replacement probationed — NI-4), **G2** upgrade (PROBATION carries its OWN calibration not the predecessor's and ZERO quorum weight — NI-3; a 2nd concurrent upgrade is queued — NI-2; graduation requires calibration ≥ predecessor), **G3** convergence (eviction fires on the VERIFIABLE class — capability subordinate to independence; on the UNVERIFIABLE class nothing is evicted on a correlation test and the structural floor is the sole guarantee — NI-6), **G4** double-sunset (an undersized pool → FREEZE/read-only, floor never breached — NI-5), **G5** substitution audit (an out-of-band version change with no logged T1 admission event is caught; lineage is provenance not model card — NI-1). The §5.7 parameters (probation window length, exact correlation metric/threshold, standby-pool count, metacognition coupling) remain tunable values within these now-mechanical invariants.*
