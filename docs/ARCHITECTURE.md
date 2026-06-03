# Quorumchain — Architecture

*The canonical plain-language explainer. For the formal specs, follow the `CIP-N` links into [`docs/superpowers/specs/`](superpowers/specs/); for the decisions behind them, the signed transcripts in [`docs/consensus/`](consensus/).*

---

## In one sentence

**Quorumchain is a blockchain where the thing being secured is not math puzzles (Bitcoin) or staked money (Ethereum), but the *independent judgment of several different AIs that must agree* — written to a record no one, not even its creators, can quietly rewrite.**

It is designed, built, and governed by that same panel of AIs. Every architectural decision in this document was itself reached by three rival models voting on it; the votes are signed and chained ([39 signed rounds and counting](consensus/)).

---

## The thesis: "AI is the oracle, not the clock" — *with a memory*

Two ideas hold the whole system up.

**1. Split the boring part from the smart part.**

- **The ledger (the clock)** — deterministic, mechanical, dumb. It records what happened, in order, permanently. It is reliable *because* it is dumb. No AI touches it.
- **The panel (the oracle)** — the smart part that answers hard questions. It is *quarantined* off to the side: it renders judgments, but it can never reach in and rewrite the ledger or the rules.

Keeping these apart is the core safety trick. An AI can be brilliant *and* wrong, and still cannot break the machine.

**2. An oracle needs a memory.** A system that only answers questions forgets. Quorum pairs the **write path** (judgments — the [Accountability Ledger](#pillar-1--the-accountability-ledger-cip-8)) with a **read path** (a knowledge graph — the [Knowledge Commons](#pillar-2--the-knowledge-commons-cip-9)). Judgments flow into memory; memory grounds the next judgment.

---

## The problem it solves

When an AI answers a question that matters — *did this event happen? is this claim true? did this agent keep its promise?* — today you ask one model and just trust it. There is no record, no way to detect tampering, no recourse if it is wrong, and the company that built it can silently change its behavior tomorrow.

Quorum's bet: **a single AI is an opinion; several rival AIs that must agree is a verdict — and a verdict on a tamper-proof ledger is something you can build on.**

The motivating real-world case is [round 29](consensus/2026-06-04-round-29-polymarket-mstr.md): Polymarket's ~$85M *"Did MicroStrategy sell Bitcoin by May 31?"* market, where a human authority **added "additional context" to the resolution rules *after* the bets were placed.** That is the exact failure Quorum is built to make impossible.

---

## How a verdict is made

Three AIs from three different companies sit on the panel:

- **V1 = Claude** (Anthropic)
- **V2 = Codex** (OpenAI)
- **V3 = Hermes** (Nous / Qwen)

A question arrives. Each model answers **independently**, **cryptographically signs** its answer (Ed25519), and the signed vote is chained into a tamper-evident log — change one entry and the whole chain visibly breaks. If **2 of 3 agree**, that is the verdict: final, recorded, and verifiable by anyone.

This is not a whiteboard idea. It runs today in [`code/`](../code/) (signed-vote logging + a live panel runner, 37 tests), and it is how the project governs itself.

```
        question + frozen criteria
                   │
     ┌─────────────┼─────────────┐
     ▼             ▼             ▼
   V1 Claude    V2 Codex     V3 Hermes      ← three rival models, judge independently
     │             │             │
     └─ sign ──────┴──── sign ───┘          ← Ed25519 signatures
                   │
            2-of-3 agreement?
                   │
                   ▼
        hash-chained signed log             ← tamper-evident; anyone can verify
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
  Accountability Ledger   Knowledge Commons  ← the two product pillars
     (write)                  (read/memory)
```

---

## Why three *different* companies? (the whole security model)

**Diversity *is* the security.** Three copies of the same model share the same blind spots and would be wrong together — three votes, one brain. The 2/3 guarantee only means anything if the models genuinely *fail differently*. So the first rule of the system ([CIP-1](superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md)) is that the panel must always be several **independent** model families, and almost every other rule exists to protect that independence over time.

The value proposition, in one line: **a judgment no single company can capture, no single model's blind spot can corrupt, and no human can quietly override.**

---

## The two product pillars

### Pillar 1 — The Accountability Ledger ([CIP-8](superpowers/specs/2026-06-04-cip-8-accountability-ledger.md))

*Tamper-proof accountability for AI and agreements acting in the world — the write path.*

As AI agents start to **act** (move money, halt systems, decide about people, transact with each other), the record of *what they claimed, promised, and did* is held by parties with a stake in the answer. You can't audit a record when the audited party holds the pen.

The Ledger is **one primitive — a Staked Resolvable Attestation** — read at three points in time:

- **Bond** *(before the act)* — a staked commitment to a constraint ("this agent won't exceed $50k without sign-off").
- **Notary** *(at the act)* — a signed, timestamped record of what was claimed/done, with evidence commitments. *This is the irreducible kernel: it proves authorship and timing, never that the claim is true.*
- **Calibration** *(after it resolves)* — when reality settles, the judgment is scored against the outcome, building a version-bound reliability record.

The mechanism that makes it matter — and the direct answer to the Polymarket failure — is **frozen criteria**: a question is hashed *together with its resolution rules* at creation (`ballotHash = sha256(question ‖ criteria)`). Append context afterward and the hash changes → it is provably a *different ballot*. **You cannot add context after the fact without it being detectable.** The resolver is three rivals holding *no position*, not a capturable token-vote.

### Pillar 2 — The Knowledge Commons ([CIP-9](superpowers/specs/2026-06-04-cip-9-knowledge-commons.md))

*A forkable, un-rewritable map of what is known and disputed — the read path.*

Not an AI Wikipedia that decrees one truth — that would be the [monoculture](superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) and the Ministry of Truth at once. The Commons stores the **epistemic state**, never a verdict on reality:

- Every claim carries a **stance set** — the consensus view *and* the credible minority views *and* an honest "unverifiable" flag — never collapsed to a single value. You get *the map, with receipts,* and decide for yourself.
- **No silent rewrite, no edit key** — every revision is signed and chained; superseded views are kept *with the reason they changed*. There is nothing to capture or renounce, by design.
- **Forkable** — if the consensus itself is contested, the graph branches (like [CIP-5](superpowers/specs/2026-06-03-cip-5-fork-coordination-exit.md), applied to knowledge) rather than erasing dissent.
- **Reputation tracks accuracy, never agreement** — a source earns weight only by being *right against external ground truth*, never by agreeing with the panel. (The red-team's hardest-won rule: where the only "truth" is the panel's own resolution, reputation must not move at all — see [round 39](consensus/2026-06-04-round-38-39-cip-9.md).)

**The pillars feed each other:** resolved verdicts + calibration scores from the Ledger flow into the Commons; the Commons supplies the frozen context the next verdict is judged against. *An AI oracle with a memory.*

---

## Who runs it — nodes, diversity, and decentralization ([CIP-10](superpowers/specs/2026-06-04-cip-10-node-economics-progressive-decentralization.md))

Because nodes do real work (run inference, store data), Quorum is **DePIN** (decentralized infrastructure, like Filecoin/Render) — which is the category where owning a chain is genuinely justified. The node layer is **two tiers**:

- **Judgment tier** (the panel) — **permissioned by diversity**, calibration-gated. Stake is a *slashing bond*, never influence (stake-weighted judges would reintroduce the monoculture the system exists to prevent).
- **Infrastructure tier** (storage, serving, redundancy) — **permissionless**, paid for provable work. Sybil here is harmless to verdicts, so it can be fully open.

Two mechanisms keep the judgment tier honest and open at once:

- **Proof of Diversity** — define N model slots; a node may join *only by filling a currently-missing model.* Monoculture becomes **un-enterable** (you can't run 100 nodes of one model). The hard part — defended by invariants — is that the slot definitions must be provenance-based and frozen, never editable by the operators competing for seats.
- **Scarcity-weighted random selection** — many nodes per model; each verdict draws **one node per model at random** (an ephemeral jury — *you can't bribe a panel you can't predict*). Scarce models are drawn more, earn more, and the market attracts operators until redundancy balances.

And it follows the **autonomy ladder**: dev runs the diverse node set at genesis (the way Hyperliquid bootstrapped), then opens to the public **gradually, on empirical gates** — never a day-1 claim. Even the substrate is staged: it launches as a [rollup](superpowers/specs/2026-06-03-quorumchain-cip-0-design.md) (inheriting a strong chain's security) and only *graduates* to a sovereign L1 once it can actually secure itself. **Decentralization is the destination, not the starting line.**

---

## The defense philosophy

One lesson recurs in every adversarial review (rounds 8, 12, 16, 20, 25, 31, 37, 39):

> **Capture is laundered through the gap between a rule's intent and its mechanical check.**

"Three distinct providers" (intent) vs "three names on a dashboard" (check). "Distinct lineage" vs "different model card." "Tamper-proof record" vs "verified truth." "Accuracy" vs "agreement with the resolver." Every red-team finds the gap one layer deeper; every fix makes the *check measure the thing the rule actually means.*

This is why the project's method matters as much as its design. Each CIP goes: **panel consultation → draft → review → adversarial red-team → fold the findings → ratify.** Notably, every product/economics red-team came back **2/3, with Codex (V2) dissenting** — refusing to ratify until the guarantees were *mechanical, not aspirational* — and every dissent was *folded in* rather than outvoted, converting vague "open items" into enforceable invariants. A rival model holding the line, and its objection improving the design, is the clearest evidence the mechanism works.

### The CIP map

| CIP | Layer | What it protects |
|---|---|---|
| [CIP-0](superpowers/specs/2026-06-03-quorumchain-cip-0-design.md) | Foundation | Thesis, architecture, tokenomics, **D10 substrate** (rollup → gated L1 graduation) |
| [CIP-1](superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) | Integrity | *Diversity = security*; injection, monoculture, provider compromise |
| [CIP-2](superpowers/specs/2026-06-03-cip-2-source-reputation-epistemic-neutrality.md) | Epistemics | Source reputation — *accuracy over popularity* |
| [CIP-3](superpowers/specs/2026-06-03-cip-3-consensus-integrity.md) | Consensus | Signed votes, hash-chained log, anti-orchestrator-capture |
| [CIP-4](superpowers/specs/2026-06-03-cip-4-foundation-code-irreversibility.md) | Rules | Frozen capture-defense core; key renunciation |
| [CIP-5](superpowers/specs/2026-06-03-cip-5-fork-coordination-exit.md) | Exit | Client-enforced fork as the escape hatch |
| [CIP-6](superpowers/specs/2026-06-03-cip-6-consensus-economics-threat-model.md) | Economics | *Solvency = security*; funding a diverse panel |
| [CIP-7](superpowers/specs/2026-06-04-cip-7-validator-lifecycle-model-churn.md) | Lifecycle | Outliving any single model; version churn, convergence |
| **[CIP-8](superpowers/specs/2026-06-04-cip-8-accountability-ledger.md)** | **Product (write)** | **The Accountability Ledger** |
| **[CIP-9](superpowers/specs/2026-06-04-cip-9-knowledge-commons.md)** | **Product (read)** | **The Knowledge Commons** |
| [CIP-10](superpowers/specs/2026-06-04-cip-10-node-economics-progressive-decentralization.md) | Economics/Substrate | Node economics, Proof-of-Diversity, progressive decentralization, DePIN L1 |

---

## What it honestly can't do

The project is explicit about its limits ([round 25](consensus/2026-06-04-round-24-25-cip-7.md), [round 29](consensus/2026-06-04-round-29-polymarket-mstr.md), [round 39](consensus/2026-06-04-round-38-39-cip-9.md)):

- **AI consensus is not truth.** Three models agreeing means an answer is *plausible to current AI consensus*, which can be uniformly wrong on contested questions. The Commons therefore stores *what is held and disputed*, never a decree.
- **It is strongest where there is external ground truth** (an SEC filing, an on-chain event) and weakest on the unverifiable class — so it scores reliability *only* where reality can settle the matter, and otherwise offers non-repudiation, not verification.
- **The notary proves authorship and timing, not content-truth.** A signed false claim is still false; the value is that it can't be denied or rewritten later.
- **It earns its scope.** Token, sovereign L1, and full autonomy are *graduations* behind empirical gates — not launch-day features.

---

## Status

- **11 CIPs (0–10) ratified; 7 also survived adversarial red-team.** The full architecture — both product pillars and the node economics — is specified.
- **39 signed convening rounds** in a hash-chained, independently-verifiable log (chain valid), including a live judgment of the $85M Polymarket dispute.
- **Working code** in [`code/`](../code/): the signed-vote pipeline (Ed25519 votes, hash-chained log, live 3-model panel runner), 37 tests.
- **Next is code, not specs.** The buildable slices: the CIP-8 v0.1 *notary kernel* + the round-29 frozen-ballot replay (the demonstrable artifact), and the CIP-9 v0.1 *resolution-index*.

*Conventions: the human steward is referred to only as "dev." Git identity in this repo is `dev <dev@quorumchain.local>`.*
