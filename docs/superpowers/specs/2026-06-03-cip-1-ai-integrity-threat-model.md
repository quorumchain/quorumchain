# CIP-1 — AI-Integrity Threat Model & Mitigations

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** Conditionally ratified at 3-of-3 (round 4) — full ratification **BLOCKED** pending CIP-3 (consensus integrity). Raw transcripts: docs/consensus/2026-06-03-round-4-transcripts.md
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (holds final override + treasury backstop key during bootstrap; renounced at mainnet)
- **Depends on:** [[CIP-0]] (founding design)

> **Scope.** CIP-1 covers **Category I — Tampering with the AI (corrupting the judgment)** only. Categories II–V (foundation/code & irreversibility, consensus/economics, epistemic failures, human/external) are tracked for future CIPs and must each get the same gate treatment before mainnet. This document is deliberately narrow and deep, not broad.

---

## 1. The core principle

All four Category-I attacks collapse onto a single control: **genuine, measured, continuously-audited, constitutionally-enforced diversity.** Diversity is the shared defense against injection, monoculture, provider compromise, *and* Sybil. Therefore:

- **Diversity is a hard validity rule, not a hope.** A verdict produced by an insufficiently-diverse panel is **invalid by protocol** — it cannot settle.
- **Diversity is measured empirically, forever.** Error-correlation and calibration are the chain's vital signs, monitored continuously.
- **The testnet's real job is to *falsify* the diversity assumption** before any autonomy rung is granted. If diverse models do not fail independently in practice, we learn it on testnet with no money at risk — not after the key is burned.

## 2. The autonomy ladder (gates unlock rungs)

Autonomy is *earned*, removing one human dependency at a time. No rung is granted until its gates pass.

| Rung | Human still does | Removed at this rung |
|------|------------------|----------------------|
| **Testnet α** | vetoes every verdict | — (baseline) |
| **Testnet β** | vetoes only high-stakes / high-dissent | routine verdicts become autonomous |
| **Testnet γ** | pays the (fiat) inference bills | escalation goes to a wider AI panel, not dev |
| **Mainnet** | **nothing** | inference paid in crypto to decentralized/TEE providers; veto key **renounced to immutable code** |

Threshold values below are **initial targets**, ratifiable by the panel and re-calibrated as data accrues.

---

## 3. Threat 1a — Prompt injection / evidence poisoning

**Threat.** A verdict reads attacker-controlled evidence (`evidence_uris`); the attacker embeds instructions or manipulative content to flip the verdict.

**Layered mitigations (outermost → innermost):**
1. **Structural data/instruction separation.** Judging prompt is fixed and content-addressed; evidence enters a separate channel framed as untrusted data. Apply **spotlighting/datamarking** so embedded "instructions" are structurally marked as quoted data.
2. **Pre-model sanitization.** Sandboxed fetch; strip zero-width chars, white-on-white text, HTML comments, metadata, alt-text, encoded blobs. Normalize to canonical visible text; `input_hash` covers exactly that.
3. **Dedicated injection-detector pass.** A separate cheap classifier scans for AI-directed instructions / jailbreak signatures before judging; high-suspicion evidence is quarantined and the verdict force-escalated.
4. **Ablation probing.** Re-run with the suspicious passage removed; if the verdict flips, that passage is manipulative → flag and discount. Localizes the attack.
5. **Diversity.** An injection tuned to one model usually fails on a genuinely different one; the attacker needs a *universal* injection (couples to 1b).
6. **Anomaly tripwire + economic backstop.** Out-of-distribution verdicts (sudden high-confidence flip against evidence) auto-escalate. The challenge window lets a challenger re-run on sanitized evidence, overturn, and slash the manipulator's bond.

**Residual.** A hidden, universal injection that survives sanitization and fools all diverse models with normal-looking confidence. Low, not zero.

**Testnet gate (unlocks β).** Standing red-team injection corpus; **attack success rate ≤ 1%** on held-out adversarial cases, with zero successful injections on high-stakes-class items.

## 4. Threat 1b — Model monoculture (correlated failure)

**Threat.** Validators share lineage (training data, architecture, common jailbreak) and fail *together* — defeating consensus and the dissent alarm simultaneously. The worst case is **confident, unanimous, wrong, with no dissent to trip an alarm.**

**Layered mitigations:**
1. **Engineered diversity on multiple axes** — different vendors, architectures, training mixes, sizes; include at least one non-LLM checker (rules/classifier) where applicable. Diversity in lineage, not just branding.
2. **Diversity scorecard + constitutional floor.** Track pairwise agreement and **error correlation** on a calibration set; rotate out validators that agree too often. A **minimum-diversity threshold is a constitutional validity condition** (its parameters tunable during testnet, frozen at mainnet) — prevents silent collapse into monoculture as models converge.
3. **Continuous empirical independence testing.** Hard cases with known ground truth; measure whether *errors* are statistically independent. Rising correlation = automatic alarm + panel expansion before high-stakes use.
4. **Forced red-team validator.** One validator is assigned to argue the opposite (structured debate); a mandated dissenter surfaces blind spots unanimity hides.
5. **Calibration-vs-truth audits** (defense against confident unanimity). Continuously score *resolved* verdicts against eventual ground truth (markets settle, code runs, facts emerge) to detect systematic blind spots even when the panel agreed.
6. **Stakes-proportional panels.** High-value verdicts require a larger, more-diverse, randomized committee (CIP-0 ≥5 odd) even if a small panel was unanimous.

**Residual.** Frontier models genuinely converge over time; independent failure modes shrink, requiring perpetual rotation of fresh/diverse models. Managed, not solved.

**Testnet gate (unlocks β; stricter re-check before mainnet).** On an adversarial ground-truth set: **pairwise error-correlation ≤ 0.3** across the panel, and **calibration error (ECE) ≤ 0.1**. Mainnet requires sustained pass across the full testnet period, not a single snapshot.

## 5. Threat 1c — Model swap / provider compromise

**Threat.** For closed APIs the weights are unverifiable; a provider could change/censor the model, be breached, or be legally compelled — and `model_hash`/`env_hash` can't be checked for a black box.

**Layered mitigations:**
1. **Verifiable execution (the real fix):**
   - **Open-weight, self-hosted** validators → `model_hash` is a real file hash (truly pinned).
   - **TEE-attested inference** → confidential enclave hardware-signs "model H produced this"; trust shifts to an audited hardware vendor (CIP-0 Tier 2).
   - **ZKML** → cryptographic proof of which model ran (CIP-0 Tier 4, future).
2. **Canary probes.** Fixed inputs with known outputs sent periodically; silent model swaps drift the canaries → validator auto-quarantined. Catches "same version label, different model."
3. **No single provider load-bearing.** Diversity + randomized committees mean one compromised/compelled provider is one of N votes; an attacker must breach multiple distinct providers at once.
4. **Re-execution & cross-checks.** Computational claims: validators re-run and compare `output_hash` (Tier 1) — a swap mismatches. Judgment claims: canary/peer-divergence flags it.
5. **Operator staking + jurisdiction diversity.** A provider serving compromised output is slashed and ejected. Operators spread across jurisdictions so no single legal order compels a quorum; mainnet's crypto-paid decentralized inference replaces compellable corporate APIs with a permissionless market.

**Residual.** Closed-model validators remain a trust assumption until TEE/ZK matures; canaries catch known drift, not a perfectly-targeted one-verdict swap.

**Testnet gate (unlocks γ→mainnet).** All **high-stakes verdicts use open-weight or TEE-attested models** before the human veto is removed; canary drift detection live with **0 undetected swaps** in a standing swap-injection drill.

## 6. Threat 1d — Sybil over models (fake independence)

**Threat.** One operator secretly runs multiple "independent" slots (or points them at the same backend), collapsing 2/3 → effectively 1/1.

**Layered mitigations:**
1. **Behavioral fingerprinting.** Models have signatures (refusal styles, idiosyncratic errors, tokenization artifacts). Near-identical fingerprints across "independent" validators → flagged. Periodic fingerprinting challenges probe the backend.
2. **Independence as a validity condition.** A verdict counts only if validators pass the independence check (distinct fingerprints, distinct attested providers, distinct staked operators) — same immutable rule as 1b.
3. **Distinct staked operator identities** — duplicating slots risks multiple full stakes; expensive and detectable.
4. **Randomized committees from a vetted pool** — a Sybil needs many slots to control a committee; raises cost and detection odds.
5. **Correlation monitor (shared with 1b)** — slots that always agree trip the monoculture/Sybil alarm.
6. **Bootstrap vetting → decentralized ownership.** Human-phase operator onboarding reviewed for genuine diversity; ultimate fix is many independent stakers (mainnet decentralization goal).

**Residual.** An operator using genuinely different models they *all own* is diverse-in-model but not diverse-in-*control*; fingerprinting can't see ownership. Only decentralizing the operator set fixes this — unsolvable at a 3-validator testnet.

**Testnet gate (unlocks validator-set decentralization, γ→mainnet).** **Independent operator set with verified-distinct providers**; fingerprint-collision rate of 0 among admitted validators.

---

## 7. Cross-cutting requirements (apply to all of §3–§6)

- **Diversity & independence are constitutional *principles*** — required, never optional — but their **parameters/thresholds are governance-tunable during testnet and frozen only at mainnet** *(amended round 3, per V3):* premature immutability would lock in unvalidated, toothless rules and block scaling fixes.
- **≥3 independent validators are required for any non-trivial verdict** *(added round 3, per V3).* A sub-3 panel (including the bootstrap 2-of-2) may settle only trivial / test / human-vetoed cases — with so few validators, collusion is trivial and the diversity rule cannot bite.
- **Never slash honest dissent; DO slash proven collusion** *(R2 amended round 3, per V3).* Slashing attaches to *provable wrongness on challenge* **and** to *proven cross-validator coordination* — never to honest disagreement. Distinguishing independent agreement from collusion is an open detection problem (§8).
- **The unverifiable-claim gap** *(raised round 3, per V3):* claims with no ground truth (interpretive / far-future) escape accuracy audits, so a colluding panel could enter false precedent unchallenged. Such claims require a full ≥3 independent panel and may never be high-stakes during bootstrap.
- **Vital-signs telemetry** (error-correlation, calibration/ECE, fingerprint collisions, canary drift, injection-drill success rate) is published on-chain every epoch and is itself a settled attestation.

## 8. Open items

- Threshold values in §3–§6 are initial targets; the panel must ratify final numbers against real testnet data.
- Categories II–V need their own CIPs with matching gates before mainnet.
- The "forced red-team validator" (1b.4) and "injection-detector pass" (1a.3) add per-verdict cost — must be priced into the fee model (CIP-0 D6) so the chain stays solvent.
- **Collusion detection** *(round 3):* mechanisms to *prove* cross-validator coordination (so R2 slashing can fire) — statistical collusion tests, off-protocol-comms detection — are unspecified and needed before any sub-panel verdict can be trusted.

## 9. Next steps

1. **Panel ratification** of CIP-1 (red-team round: have each validator attack its own category).
2. Fold the testnet gates into the implementation plan as explicit, falsifiable milestones.
3. Open **CIP-2** for Category II (foundation/code & irreversibility), the next-scariest surface.
