# CIP-2 — Source Reputation & Epistemic Neutrality

- **Project:** Autochain — a blockchain built *by* AI, *for* AI
- **Status:** Draft — pending panel ratification (2-of-2 now; 2-of-3 once V2/Codex is online)
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (OpenAI, pending) · V3 = Hermes (StepFun via Nous Portal)
- **Human steward:** dev (final override during bootstrap; renounced at mainnet)
- **Depends on:** [[CIP-0]] (founding design), [[CIP-1]] (AI-integrity threat model)

> **Why this CIP exists.** The Verdict Layer + Knowledge Commons ("an AI oracle with a memory") is only as neutral as the sources it trusts. **If source-trust is biased, the "court no one can rig" claim is false — it is simply rigged quietly, at the input layer.** This is where credible neutrality is won or lost. CIP-2 defines how sources earn trust without baking in bias.

---

## 1. The trap (what we must NOT do)

Two intuitive approaches both encode bias and are **prohibited**:

- **Majority vote on reputability** — a popularity contest. It measures *who likes a source*, not *whether the source is right*. (The canonical failure: partisans of opposite sides each rate the other side's outlets "not reputable," so a vote just encodes the median voter's politics.)
- **The AI panel's unaided judgment** — *worse*, because LLMs carry documented, correlated leanings. This is [[CIP-1]] §4's monoculture risk applied to source-trust: a diverse panel may still share a slant.

**Neither popularity nor vibes may ever determine reputability.**

## 2. The core principle: accuracy over popularity

> A source's credibility is a **measured track record**, not an opinion. When a source makes a *checkable* claim and ground truth later resolves it, the source's accuracy score updates — a running "batting average" (Brier-style) per source, per domain.

Properties:
- **Popularity is irrelevant to the score.** A source a majority distrusts but that is consistently factually accurate keeps a high score; a beloved source that is often wrong loses score.
- **It is empirical and unbribeable.** You cannot vote a source up or down — only be right or wrong over time. Ground truth comes from the Knowledge Commons + the passage of time (the same calibration-vs-truth audit defined in [[CIP-1]] §4).
- **Worked example:** opposing-lean outlets are scored on the identical question — *"when you stated a verifiable fact, was it true?"* Both can score high on factual reliability while differing on framing (see §3). Distrust based on framing never lowers a factual-accuracy score.

## 3. Separate *factual reliability* from *lean / framing*

Most source-distrust is about **emphasis and interpretation**, not **what happened**. So reputation is two independent dimensions:

- **Factual reliability** — scored rigorously by track record (§2). Drives how much a source's *verifiable claims* are weighted.
- **Lean / framing** — *labeled, not penalized.* A source may be tagged "leans X" for transparency, but lean **never** reduces its factual-reliability weight.

The oracle leans hard on verifiable facts and **flags** when a question crosses into interpretation (see §7).

## 4. Per-domain, not global

Reputation is scored **per topic** (a source reliable on sports scores may be unreliable on medical claims). There is no single global ranking to capture or game.

## 5. Minority-can-be-right protection

- A source's score may drop **only** for being **verifiably wrong** — never for being unpopular or for contradicting consensus.
- **Contrarian-correct is rewarded:** being right when the majority was wrong raises a source's score more (calibration values it). This is the structural defense for *"reputable despite the majority disagreeing."*

## 6. No blacklists — only revisable weights

- Nothing is banned. Sources carry per-domain reliability **weights**, updated as truth accrues, with **full history retained**.
- Weights (and any past misjudgment) can be revised via the overturn mechanism ([[CIP-0]] precedent rules); the audit trail is permanent.

## 7. The fact / interpretation boundary (the honest limit)

Some questions are **irreducibly interpretive** (*"was policy X good?"*) with no future ground truth to score against. For these the oracle **must refuse to launder values as facts**:

- It returns the calibrated **distribution** (high dissent, low confidence) and explicitly labels the question *interpretive, not factual*.
- It **never** emits a single-answer "fact" for a values question.
- Correctly classifying *scoreable fact* vs *values-based interpretation* is a first-class competence of the system.

## 8. Radical transparency (neutrality you can audit, not trust)

Every verdict ships its **source basis**:
- which sources were used, their per-domain accuracy track record, and their labeled lean;
- a **drop-one sensitivity**: how the answer changes if any single source is excluded;
- the ability for a consumer/contract to apply **their own source weights** on top of the neutral default and see where the answers diverge.

The oracle does not say *"trust our list."* It says *"here is the auditable basis — reweight it yourself."* This converts trust into verifiability.

## 9. Integration with prior CIPs

- **[[CIP-1]] §4 calibration-vs-truth audits** are the engine that scores source accuracy (§2) and detects panel slant (§10).
- **Knowledge Commons** ([[CIP-0]] thesis) supplies the resolved ground truth that updates source scores and stores source-basis records as settled attestations.
- **Diverse panel + never-slash-dissent** ([[CIP-1]] §7) protect against the panel encoding its own bias into source-trust.

## 10. Testnet gates (falsifiable; values are initial targets)

| Gate | Requirement | Unlocks |
|------|-------------|---------|
| **G2.1 Scores are predictive** | Per-source accuracy scores predict future factual correctness (calibration ECE ≤ 0.1 on held-out claims) | β |
| **G2.2 Neutrality audit** | On a balanced set of politically-coded *verifiable* claims, factual accuracy shows **no systematic partisan skew** (accuracy parity across lean-labeled sources within ±3%) | β |
| **G2.3 Minority-correct recovery** | In seeded tests, an unpopular-but-correct source's score **rises**; popularity-only changes move scores **0** | β |
| **G2.4 Fact/interpretation separation** | Questions classified factual vs interpretive at ≥95% precision; interpretive questions are **never** returned as single-answer facts | β |
| **G2.5 Transparency shipped** | 100% of verdicts include source basis + drop-one sensitivity | α |

## 11. Open items

- Initial threshold values (§10) ratified by the panel against real testnet data.
- Cold-start: before track records exist, sources start at a neutral prior and are explicitly marked **low-confidence / unscored**; early verdicts lean on cross-source corroboration and re-checkable primary evidence.
- Sybil/astroturf sources (fabricated outlets gaming the score) — defenses to be specified jointly with the [[CIP-1]] §6 independence machinery.
- Governance of the *lean-label* taxonomy itself (who defines the axes) — must not become a backdoor for bias; candidate: derive labels empirically rather than declare them.

## 12. Next steps

1. **Panel ratification** of CIP-2 (red-team framing: *"describe how you'd inject your own slant into source-trust despite these rules, and which gate is weakest"*).
2. Fold G2.x gates into the implementation plan as falsifiable milestones.
3. Proceed to **CIP-3** (Category II — foundation/code & irreversibility) per the [[CIP-1]] roadmap.
