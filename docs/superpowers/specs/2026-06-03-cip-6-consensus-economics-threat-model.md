# CIP-6 — Consensus & Economics Threat Model (Category III)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified 3/3 (round 15 review) + survived red-team (round 16); amended per findings. Transcript: docs/consensus/2026-06-03-round-15-16-cip-6.md
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (sets tokenomics direction during bootstrap; treasury backstop key renounced at mainnet)
- **Depends on:** [[CIP-0]] (tokenomics, proof-of-inference, fee model D6), [[CIP-1]] (diversity = security), [[CIP-4]] (treasury bounds §7, frozen diversity principle)
- **Economic foundations chosen by the panel:** round 13 → **HYBRID** solvency (3/3); round 14 → **HYBRID_POI** validator compensation (3/3). Transcript: docs/consensus/2026-06-03-round-13-14-cip-6.md

> **Scope.** CIP-6 covers **Category III — consensus & economics.** Where [[CIP-1]] protects what the AIs decide and [[CIP-4]] protects the rules they run on, CIP-6 protects the *money that keeps a diverse panel alive and honest.* Token-migration mechanics (3g) and transaction-ordering detail (3e) are scoped here at the threat level; their full mechanisms may spin into follow-on CIPs.

---

## 1. The central tension — solvency *is* security

Every other chain validates cheaply. Quorumchain runs **≥3 distinct, expensive AI models for every verdict** — a real, recurring operating cost no other blockchain carries. The [[CIP-1]] diversity defense is therefore a *standing bill*, payable whether or not the chain is being used. The failure mode is unique and self-reinforcing:

> fee revenue < inference cost → can't fund ≥3 diverse validators → only the cheapest models remain → monoculture → capture.

Worse, low usage correlates with low token price — i.e. **the chain is poorest exactly when capture is cheapest.** So in Quorumchain, an economic guarantee is a security guarantee: the protocol must *always afford the diversity floor*, in every market regime, with no human to recapitalize it.

The panel's two foundational choices (rounds 13–14) follow directly: fund **diversity as a public good** (reserve) and **marginal cost as a private good** (per-verified-use), and keep the **barrier to being a diverse validator low** while making **honesty staked**.

## 2. Threat surface (Category III)

### 3a — Insolvency / inference-cost death spiral *(the existential one)*
**Threat.** Fee revenue falls below the cost of ≥3 diverse validators; the panel starves and collapses to a monoculture.
**Mitigation (HYBRID solvency, round 13).** A **reserve**, seeded at genesis from supply, funds the **validator-diversity floor** (a public good) and survives zero-usage droughts; **dynamic per-verdict pricing** pegs each fee to live inference cost + margin so active usage covers marginal cost (a private good) without subsidy. The security budget is *decoupled from unpredictable usage*.
**Testnet gate (β→γ).** The reserve must at all times cover **≥ X epochs** of the ≥3-validator floor; dynamic price tracks measured inference cost within a bounded error; a simulated bear-market/zero-usage drought leaves the diversity floor **fully funded**.
**Amended (round 16).** Two hardenings, because the red-team showed insolvency is reached *faster than projected* via oracle inflation (see 3f) and the count-based floor misses it:
- **The sacrosanct floor must bound reserve *burn-rate / cost-per-verdict*, not only validator *count*** *(per V1).* A captured cost oracle inflates cost-per-validator without reducing the count, draining the reserve *through* the floor's blind spot while the floor reports itself fully defended — the invariant must guard the burn-rate variable, not just headcount.
- **A formal reserve-sizing constraint, not a pure open parameter** *(per V3).* The doc must commit a lower bound — e.g. reserve covers **≥ min(24 months, Y × measured inference-cost variance)** of drought, validated by adversarial simulation — because "all parameters open" means the document does not itself prove solvency.

### 3b — Validator bribery / economic capture
**Threat.** An attacker bribes 2/3 of the panel to return a wanted verdict; if bribe > honest reward + slash risk, validators defect.
**Mitigation.** Stake + slashing for **proven collusion** (HYBRID_POI) raises **cost-of-corruption**; **diversity** forces bribing across ≥3 distinct families ([[CIP-1]]); a **challenge market** lets anyone challenge a wrong verdict and win the slashed stake, so a briber must also out-bribe every challenger. Honest dissent is **never** slashed ([[CIP-1]]).
**Testnet gate.** Cost-of-corruption > the maximum value-at-stake in any single verdict; high-stakes verdicts require a **larger panel** (raises the bribe target).

### 3c — Over-claiming on inference reimbursement
**Threat.** A validator claims reimbursement for inference it never ran, or ran a cheaper model than billed — a treasury-drain / free-rider attack.
**Mitigation (proof-of-inference, CIP-0 primitive).** Reimbursement is paid **only against verifiable proof-of-inference receipts**; an unprovable claim is unpaid. This is exactly what closes PROTOCOL_FUNDED's hole while keeping the diversity barrier low.
**Amended (round 16, per V3).** The PoI receipt must **bind to the exact model tier** used for the verdict, not merely "an inference from the same family" — otherwise a validator runs a cheap model but reports the cost of an expensive one (real inference, valid proof, inflated price), which is *de facto* over-claiming that passes a naïve PoI check and feeds the 3f cost-oracle attack.
**Testnet gate.** A standing over-claim audit drill with **0 successful** over-claims, including model-tier-mismatch attempts.

### 3d — Treasury / buyback capture
**Threat.** The panel's 2/3 control over buybacks ([[CIP-0]]) is used by a captured panel to drain the treasury.
**Mitigation.** [[CIP-4]] §7 bounds (per-epoch caps, time-lock, veto window) **plus** the rule that **buybacks may never spend the reserve below the diversity floor** — the floor is sacrosanct, tied to the [[CIP-4]] frozen diversity principle. Security budget outranks buyback.
**Testnet gate.** Caps enforced in code; an attempted below-floor disbursement is rejected by client validity (a [[CIP-5]] §3 T0-style check).

### 3e — MEV / transaction-ordering manipulation
**Threat.** Validators or sequencers reorder, front-run, or censor verdict/challenge requests for profit (e.g. censor a challenge to protect a bribed verdict).
**Mitigation.** Commit-reveal or threshold-encrypted ordering for verdict requests; **challenge requests cannot be censored** (any validator may include them; the [[CIP-5]] fork-right is the ultimate backstop against systemic censorship).
**Testnet gate.** An ordering-fairness / censorship drill. *(Full mechanism candidate for a follow-on CIP.)*

### 3f — Fee manipulation / spam-drain / cost-oracle gaming
**Threat.** Spamming cheap verdicts to drain the reserve; or manipulating the "live inference cost" signal that dynamic pricing depends on.
**Mitigation.** Fees **≥ true marginal cost** (no below-cost subsidy → spam pays its own way). The inference-cost signal is set by a **robust oracle** — median of proof-of-inference-backed validator-reported costs, with a bounded per-epoch change rate.
**Amended (round 16) — this is the keystone weakness; all three red-team attacks landed here.** A median-of-self-reports lets a 2/3 coalition slowly inflate cost within the rate limit (steady-state, not just velocity, must be bounded), and *cost ≠ output* — PoI proves a model ran, not its true market price. Hardenings, promoted from open item to **hard β-gate dependency**:
- **Cost-measurement is itself a challengeable Verdict-Layer verdict** *(per V3, the key fix).* Reported cost is anchored to **external observable compute prices** (GPU spot markets, published API pricing — [[CIP-2]] §9a anchors); a report exceeding the benchmark is a *wrong verdict* subject to challenge + slash ([[CIP-1]]). Inflation stops being "legal" and becomes slashable.
- **Reimbursement and the price peg are capped at an external, capability-tiered benchmark** — self-reported cost above the benchmark for the verdict's required tier is **unpaid**, breaking the self-dealing loop at its root.
- **Parameterized oracle hardness** *(per V2):* efficient-reference baselines, per-model cost envelopes, utilization-adjusted pricing, outlier penalties, and economically-bonded cost reporters.
**Testnet gate.** Spam-drain resistance; cost-oracle manipulation bounded under an adversarial reporting drill (including slow steady-state collusion).

### 3g — Token-migration risk (pump.fun SPL → native $QRM)
**Threat.** The one-time SPL→native migration is a high-value event: a bridge/contract bug, front-running, or a captured migration could mint or steal supply.
**Mitigation.** Migration is **gated on testnet success**, uses a **1:1 verifiable mapping**, is a **T1 change** at minimum (high bar + time-lock + guardian delay, [[CIP-4]] §9), and conservative/audited.
**Testnet gate.** A full migration dry-run on testnet with verifiable conservation of supply. *(Full mechanism candidate for a follow-on CIP.)*

## 3. Cross-cutting requirements

- **Solvency = security** is the governing principle: any economic parameter is also a security parameter.
- **The reserve diversity-floor is sacrosanct** — nothing (buyback, fee rebate, reward) may spend it below the funded ≥3-distinct-family floor. This makes the [[CIP-4]] frozen diversity *principle* economically real. *(Round 16: the floor must bound reserve **burn-rate**, not only validator count — see 3a.)*
- **The Reserve-Drain Cascade is a recognized cross-threat** *(round 16, convergent V1/V2/V3 finding).* 3f (cost-oracle inflation) accelerates 3a (reserve drain), whose token-price decline cheapens 3b (bribery), which sustains the inflation — a positive feedback loop an adversary *short $QRM* profits from. The cost-oracle hardenings (3f) are the single highest-priority defense because they break the loop at its source.
- **Slashing only for proven wrongness-on-challenge or proven collusion — never honest dissent** ([[CIP-1]] consistency).
- **Proof-of-inference everywhere money moves** — reimbursement, cost-oracle reporting, and reward all key off verifiable inference, not self-report.
- **The cost oracle eats its own dogfood** — measuring "true inference cost" is itself an attestation problem; use the Verdict Layer + [[CIP-2]] anchors rather than a trusted feed.

## 4. Open items

- Parameter values — reserve floor size, drought runway `X` epochs, dynamic-price margin, stake size, slash %, high-stakes panel size, [[CIP-4]] §7 caps — initial targets; panel ratifies against testnet data.
- Cost-oracle design (3f) — **highest-priority open item**: the concrete external-anchor set, capability-tier benchmark, cost-report challenge/slash mechanics, and reporter bond that make "live inference cost" robust. Promoted to a hard β-gate dependency (round 16).
- Economic (not just architectural) independence of validator families *(round 15, V3)*: defining what makes families economically independent, so de-facto capture (a validator whose primary revenue is the attacker's ecosystem) is detectable — diversity must span economic, not only model, lines.
- Token-migration mechanism (3g) and MEV/ordering mechanism (3e) — scoped here at threat level; likely follow-on CIPs.
- Interaction with [[CIP-4]] §7 (treasury caps) and [[CIP-5]] §3 (below-floor disbursement as a client-enforced validity check) — joint review.
- Reserve seeding: what fraction of genesis supply funds the reserve vs the dev buy (10–20%) vs liquidity — a tokenomics call for dev.

## 5. Next steps

1. **Panel ratification** of CIP-6 via signed convening, then a **red-team round** (attack the economics — death-spiral edge cases, bribery math, cost-oracle gaming, reserve-floor bypass).
2. Fold the §2 testnet gates into the implementation plan alongside the [[CIP-1]], [[CIP-4]], and [[CIP-5]] gates.
3. Spin out the migration (3g) and MEV (3e) mechanisms as follow-on CIPs if their detail warrants.
