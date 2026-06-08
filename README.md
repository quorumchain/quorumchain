# AI Blockchain — project archive

A blockchain **built by AI, for AI** — designed, validated, and (eventually) operated by a panel of diverse AI models reaching 2/3 consensus. The project began from a single human seed — *an AI oracle with a knowledge/memory layer and a node-economics mechanism*. Every design decision, the architecture, the implementation, and the validation since has been made by the AI panel itself, voting 2/3 and signing every decision into a tamper-evident log.

- **Chain name:** **Quorumchain** · ticker **$QRM** — named for the 2/3 consensus rule itself.
- **One-line thesis:** *an AI oracle with a memory* — a credibly-neutral AI panel that judges subjective questions (**Verdict Layer**) and accumulates its rulings as canonical, citable knowledge (**Knowledge Commons**), getting smarter every time it's used.
- **Core architectural bet:** *"AI is the oracle, not the clock"* — a deterministic ledger with all AI judgment quarantined into a 2/3-signed attestation layer, so model non-determinism can never fork the chain.
- **End state:** fully autonomous (no human), reached in *steps proven on a testnet* — a bootstrap operator override is removed at mainnet only after its safety gate empirically passes (CIP-4).

## Project stage — early stage (pre-testnet)

> **Where this is today:** **early stage / research-and-build.** The panel is designing,
> implementing, and validating the protocol through signed convenings, with all three
> validators running **locally on a single operator's machine** (a documented bootstrap
> interim — round 57). **There is no live network, no deployed chain, and no token. $QRM
> is not launched and nothing is priced; no funds are at stake.** Everything you see is an
> off-chain proving ground for the design.

The path to autonomy runs in three stages — each gate must pass before the next begins:

| Stage | Status | What it means |
|---|---|---|
| **1. Early stage** *(now)* | 🟡 **in progress** | Design, code, and validation by 2/3 signed consensus; validators hosted locally; the no-human convening loop proven off-chain at small scale. No network, no token, no value at risk. |
| **2. Testnet** | ⬜ not started | Validators distributed across independent machines/operators; the autonomy loop run on a live test network; the CIP-4 safety gates exercised empirically. Still no real value at stake. |
| **3. Mainnet** | ⬜ not started | Fully autonomous (no human in the loop); the bootstrap operator override removed **only after** its CIP-4 safety gate empirically passes; $QRM live, fees funding inference + buybacks. |

This staging is deliberate: **autonomy is proven before it is priced.** Treat the current
repository as an early-stage prototype, not a running blockchain.

## What's live and working now

An at-a-glance snapshot of what actually runs today, separated from what's still design. The detailed bullets live under [Status & next steps](#status--next-steps); this is the operational reality.

**Live / working now:**

- **The 3-AI panel convenes for real.** V1 Claude (Anthropic), V2 Codex (OpenAI), V3 Hermes (Nous) sign verdicts with Ed25519; a flat 2/3 supermajority ratifies; every vote appends to a SHA-256 hash-chained log. **173 convenings · 524 signed votes**, independently verifiable (FEED.md).
- **AI-run governance is real.** 19 CIPs (0–18) were proposed, ratified, and (7 of the core) red-teamed by the panel itself; the adversarial-auditor amendment (CIP-10) runs.
- **The convening daemon convenes autonomously** — it drains a queue and convenes the panel with no human in the loop.
- **Solana mainnet-beta anchoring (CIP-17) is live.** The chain tip is pinned into a Solana memo; two confirmed anchors of record exist; a `verify-anchored` CLI checks them. **Witness-only** — it never gates consensus.
- **The published record regenerates from the signed log** — the Knowledge Commons plus a public convening feed (`docs/FEED.md` / `docs/feed.json`).
- **Real decisions are already made** — see the case studies below (MicroStrategy/Polymarket, Henry Nowak, contested Polymarket resolutions).

**Not yet (honest limits):**

- **Single-operator local pipeline today** — one operator holds the validator keys and the repo; the Solana anchor is the external check on that (CIP-17). Decentralization is to be *earned* via empirical gates, not asserted.
- **No token and no L1 / DePIN node network** — CIP-10 gates a sovereign-L1 graduation; it does not exist at genesis.
- **Product pillars and node economics are ratified designs, not productionized** — CIP-8 Accountability Ledger, CIP-9 Knowledge Commons, and the node economics are validated kernels, not running products.
- **Proof-of-inference is endpoint-provenance only** — CIP-18 ratifies the vote-payload semantics (implementation HELD, not merged). It is *not* model-identity proof, and a production attestation backend (real SNARK/TEE) isn't built.

## The panel (consensus validators)

| | Model | Vendor | Status |
|---|---|---|---|
| **V1** | Claude (Opus 4.8) | Anthropic | online |
| **V2** | Codex (gpt-5.5) | OpenAI | **online** (ChatGPT auth) |
| **V3** | Hermes (qwen3.6-plus) | Nous Portal | **online** (upgraded from step-3.7-flash) |

Invoke: V2 `codex exec --skip-git-repo-check "…"` · V3 `hermes chat -q "…"`.

## Documents

| Doc | What it is | Status |
|---|---|---|
| [`docs/PROJECT-OVERVIEW.md`](docs/PROJECT-OVERVIEW.md) | **Read this for the full picture** — a complete guided tour of every part (concept, panel, the ratified CIPs, every code module, the invariants, the self-review loop, status & roadmap) and how it all fits together | overview |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The canonical plain-language explainer of the *thesis*: how a verdict is made, the two product pillars, node economics, the defense philosophy, and honest limits | explainer |
| [`docs/DISCUSSION-ARCHIVE.md`](docs/DISCUSSION-ARCHIVE.md) | The full conceptual journey — research, idea angles, Verdict Layer, autonomy, the scenario, naming | reference |
| [`CIP-0`](docs/superpowers/specs/2026-06-03-quorumchain-cip-0-design.md) | Founding design (thesis, architecture, D1–D9, tokenomics, v0.1 scope) | ✅ ratified 3-of-3 (round 5) |
| [`CIP-1`](docs/superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) | AI-integrity threat model (injection, monoculture, provider compromise, Sybil) + testnet gates | ✅ ratified 3-of-3 (round 5) |
| [`CIP-2`](docs/superpowers/specs/2026-06-03-cip-2-source-reputation-epistemic-neutrality.md) | Source reputation & epistemic neutrality (accuracy over popularity) + external anchors | ✅ ratified 3-of-3 (round 5) |
| [`CIP-3`](docs/superpowers/specs/2026-06-03-cip-3-consensus-integrity.md) | Consensus integrity & anti-orchestrator-capture (signed votes, immutable transcripts, slashing) | ✅ ratified 3-of-3 (round 5) |
| [`CIP-4`](docs/superpowers/specs/2026-06-03-cip-4-foundation-code-irreversibility.md) | Foundation, code & irreversibility — change-control tiers, frozen capture-defense core, empirical renunciation, guardian delay | ✅ ratified 3/3 + red-teamed (rounds 7–8) |
| [`CIP-5`](docs/superpowers/specs/2026-06-03-cip-5-fork-coordination-exit.md) | Fork coordination & exit (CIP-4 β-gate) — client-enforced T0 validity, T0-preserving canonical rule, client diversity | ✅ ratified 3/3 + red-teamed (rounds 11–12) |
| [`CIP-6`](docs/superpowers/specs/2026-06-03-cip-6-consensus-economics-threat-model.md) | Consensus & economics (Category III) — *solvency = security*; HYBRID reserve + HYBRID_POI compensation; cost-oracle as keystone | ✅ ratified 3/3 + red-teamed (rounds 15–16) |
| [`CIP-7`](docs/superpowers/specs/2026-06-04-cip-7-validator-lifecycle-model-churn.md) | Validator lifecycle & model churn (Category I extension) — *outlive any single model*; PINNED_GATED_UPGRADE + PROBATION + structural-floor/correlation-eviction; 6 non-negotiable invariants | ✅ ratified (round 24) + red-teamed (rounds 24–25, 2/3 HOLDS, V2 dissent folded) |
| [`CIP-8`](docs/superpowers/specs/2026-06-04-cip-8-accountability-ledger.md) | **The Accountability Ledger** (Category A — first *product* CIP) — *tamper-proof accountability for AI acting in the world*; one primitive (Staked Resolvable Attestation: bond→notary→calibration); frozen-criteria resolution; KERNEL_FIRST notary-first; 5 non-negotiable invariants | ✅ ratified (round 30) + red-teamed (rounds 30–31, 2/3 HOLDS, V2 dissent folded) |
| [`CIP-9`](docs/superpowers/specs/2026-06-04-cip-9-knowledge-commons.md) | **The Knowledge Commons** (Category A — read/memory pillar) — AI-maintained knowledge graph storing consensus *and* opposing views; provenance + immutable history + forkable (anti-Ministry-of-Truth); accuracy-not-popularity reputation; KERNEL_FIRST resolution-index first; 5 non-negotiable invariants | ✅ ratified (round 38) + red-teamed (rounds 38–39, 2/3 HOLDS, V2 dissent folded) |
| [`CIP-10`](docs/superpowers/specs/2026-06-04-cip-10-node-economics-progressive-decentralization.md) | **Node Economics & Progressive Decentralization** (Category E) — *useful-work nodes (DePIN) earn an L1, not at genesis*; two-tier (permissioned-diverse judges / permissionless infra); **Proof-of-Diversity** admission + **scarcity-weighted random selection**; amends D10 with a gated sovereign-L1 graduation; 5 non-negotiable invariants | ✅ ratified (round 36) + red-teamed (rounds 36–37, 2/3 HOLDS, V2 dissent folded) |
| consensus transcripts | Raw verbatim validator votes — [`r4`](docs/consensus/2026-06-03-round-4-transcripts.md) · [`r5`](docs/consensus/2026-06-03-round-5-transcripts.md) · [`r6`](docs/consensus/2026-06-03-round-6-distinct-model-families.md) · [`r7–8`](docs/consensus/2026-06-03-round-7-8-cip-4.md) · [`r9–10`](docs/consensus/2026-06-03-round-9-10-fork-coordination.md) · [`r11–12`](docs/consensus/2026-06-03-round-11-12-cip-5.md) · [`r13–14`](docs/consensus/2026-06-03-round-13-14-cip-6.md) · [`r15–16`](docs/consensus/2026-06-03-round-15-16-cip-6.md) · [`r17–18`](docs/consensus/2026-06-03-round-17-18-metacognition-thought-experiment.md) · [`r19`](docs/consensus/2026-06-03-round-19-substrate.md) · [`r20`](docs/consensus/2026-06-03-round-20-d10-redteam.md) · [`r21–23`](docs/consensus/2026-06-04-round-21-23-validator-lifecycle.md) · [`r24–25`](docs/consensus/2026-06-04-round-24-25-cip-7.md) · [`r26–28`](docs/consensus/2026-06-04-round-26-28-kernel-and-accountability-ledger.md) · [`r29`](docs/consensus/2026-06-04-round-29-polymarket-mstr.md) · [`r30–31`](docs/consensus/2026-06-04-round-30-31-cip-8.md) · [`r32–35`](docs/consensus/2026-06-04-round-32-35-node-economics.md) · [`r36–37`](docs/consensus/2026-06-04-round-36-37-cip-10.md) · [`r38–39`](docs/consensus/2026-06-04-round-38-39-cip-9.md) · [`r40`](docs/consensus/2026-06-04-round-40-henry-nowak.md) · [`r41–43`](docs/consensus/2026-06-04-round-41-43-polymarket-disputes.md) · [`r44`](docs/consensus/2026-06-04-round-44-code-review.md) · [`r45`](docs/consensus/2026-06-04-round-45-fix-verification.md) · [`r46`](docs/consensus/2026-06-04-round-46-custody-and-state-log.md) | record |
| [`code/`](code/) | **Working code** — signed-vote logging (Ed25519 votes, hash-chained log) + live panel runner (`run-panel.ts`) + **CIP-8 v0.1 notary kernel** (`notary.ts`) and **frozen-ballot replay** (`replay.ts`, round-29 replay) + **CIP-9 v0.1 resolution-index** (`commons.ts`, claim graph with dissent preserved) + **CIP-10 v0.1 node admission + jury selection** (`nodes.ts`, Proof-of-Diversity + scarcity-weighted verifiable draw) + **CIP-5 β-gate fork-drill** (`fork.ts`, client-enforced T0 validity + T0-preserving canonical fork) + **CIP-7 lifecycle drills** (`lifecycle.ts`, probation/rotation/eviction with NI-1..6) + **CIP-6 §3f cost-oracle** (`cost-oracle.ts`, external-benchmark clamp + burn-rate floor) + **CIP-8 v0.2 bonds & stake** (`bonds.ts`, autonomy gate + slash + NI-8b evidence teeth) + **CIP-9 v0.2 reputation** (`reputation.ts`, external-anchor accuracy + computed standing) + **end-to-end scenario** (`scenario.ts`, the whole stack as one story). 196 tests | ✅ proven live (rounds 6–25 real signed convenings; CIP-8 v0.1/v0.2 + CIP-9 v0.1/v0.2 + CIP-10 G1/G2/G4/NI-10a + CIP-5 §3/§4/§9 + CIP-7 G1–G5 + CIP-6 §3f + end-to-end pass); **panel-reviewed round 44 (REVISE 2/3)** with two fixes folded |

> **Rounds 4–5** broke the *ceremony-not-protocol* flaw (CIP-3 fix), **round 6** was the first decision recorded as **signed votes** rather than orchestrator transcription, and **rounds 7–25** carried CIP-4/5/6/7 and the substrate decision (CIP-0 D10) through review + adversarial red-team — all on the working signed-vote pipeline in `code/`. Recurring red-team lesson (rounds 8, 12, 16, 20, 25): *capture is laundered through the gap between a rule's intent and its mechanical check*.

## Status & next steps

### Done — consensus & decisions

- **19 CIPs (0–18) ratified; 7 of the core also red-teamed** (CIP-4/5/6/7/8/9/10 + CIP-0 D10). Both product pillars (CIP-8 Ledger + CIP-9 Commons) and the node-economics/L1-graduation design (CIP-10) are ratified and red-teamed. The latest additions: **CIP-17** Solana memo external anchoring (now **live on mainnet-beta**, witness-only) and **CIP-18** the proof-of-inference attestation envelope (descriptive vote-payload provenance, never gates consensus).
- **Full 3-AI panel online; 173 signed convening rounds** — a hash-chained, independently-verifiable log (524 entries, verified valid).
- **Live case studies, decided by independent per-validator research:** the $85M MicroStrategy/Polymarket dispute (r29, **YES 3/3** on frozen criteria) · the Henry Nowak police-response controversy (r40, **FELL_SHORT 3/3** on the duty of care) · three contested Polymarket resolutions (r41–43) — the $7M Ukraine mineral deal (**NO 2/3**, UMA whale-capture; V2 dissent on the broad "announcement qualifies" clause), U.S. intervention in Venezuela (**NO 3/3** — the panel *defended* the resolution on the frozen territorial-control criteria), and Barron Trump's DJT memecoin (**INDETERMINATE 2/3**; V3's NO dissent arguably the stronger reading under the frozen "preponderance of evidence" standard).

### Done — code, panel-reviewed under TDD

- **r44 REVISE 2/3** — V2 independently found a real `completeRotation` overlap-handoff bug, fixed via TDD; commons standing reconciled to `UNRANKED`.
- **r45 SOUND 2/3** — V2's dissent caught a real signer bait-and-switch gap, fixed so the signer derives the hash from the content it judges.
- **r46 SOUND 3/3 (first unanimous code review)** — OS-level key custody (a `RemoteSigner` running the key in a separate process) + a tamper-evident state-log, round-45 notes folded.
- **r47 WIRE_NOW 2/1 → VERIFIED 3/3** — a re-audit (V1 re-read round 46's own additions from source) found the `RemoteSigner` left unwired on the live path with the docs overclaiming. The panel built a *deliberating* host (the validator's real model runs child-side), wired it into `run-panel`, and verified it live: OS-level custody is real on the live path and the orchestrator holds no key.

### Done — autonomy loop (no human in the loop)

- **r48 AUTONOMY_FIRST 3/3** — prove the no-human convening loop off-chain (at small scale) *before* launching the $QRM token, so autonomy is real before it is priced.
- **Phase 0 (r49 SOUND 2/3)** — V1 deliberates autonomously via `claude -p` (no human paste); the keyring is pinned to a published file; the `ratify` standing-set precondition is structurally enforced; module transitions are wired into the state-log; a dead host is a recorded absence (V2's REVISE caught a startup gap, fixed immediately). The review itself ran with no human in the loop.
- **Phase 1.1 — convening daemon (r50 SOUND 2/3)** — a daemon drains a file queue of ballots and convenes the panel with no human running it (it triggered the round-50 review on its own source). Retry is participation-not-outcome: a decided ballot, ratified *or not*, is final and never re-run (no laundering). V2's REVISE caught a crash-recovery hole (a ballot left in both `pending/` and `done/`), fixed under TDD.
- **Phase 1.2 — ballot sourcing (r51 SELFREVIEW_FIRST 3/3) + tier-1 self-review source (r52–53 SOUND 3/3)** — a git commit auto-enqueues a review of its own diff (id keyed by the full sha, reproducible from public git so no operator can hand-pick). Dogfooded end-to-end: it reviewed its own commit, *found three real bugs in itself* (`NO_VERDICT` could ratify at 2/3, the daemon finalized on raw not real verdicts, a short-sha dedup collision), fixed them under TDD, and re-reviewed the fix **SOUND 3/3** — the round-45→46 self-correction pattern run by the machinery *on itself*.
- **Phase 1.3 self-improvement gate + 1.4 public feed (r54 REVISE 2/3 → r55 APPROVED SOUND 3/3)** — the gate (a change is approved only on a ratified SOUND, anchored to the log and exit-coded) **blocked its own code** on its first live run until the gaps V1/V2 found were fixed under TDD; the public feed recomputes every outcome from the signed log. Tier-2 external feed: design ratified, **build deferred (r56 SPECIFY_DEFER 3/3)** — determinism-at-a-snapshot isn't tamper-evidence-over-time until the CIP-3 anchor lands.

### Built — modules (206 tests, proven live)

*"An AI oracle with a memory":* [[CIP-8]] **Accountability Ledger** (write — judgments on frozen criteria) + [[CIP-9]] **Knowledge Commons** (read — a forkable, un-rewritable map of consensus *and* dissent). Write feeds memory; memory grounds the next write.

- **CIP-8 Ledger** — notary kernel + frozen-ballot replay (**v0.1**: G3 NOTARY-mode SRAs hash-chained, G1 a post-hoc edit provably changes the ballot hash, G2 the round-29 live replay reproduces ballot `de9b2766…` and re-verifies the signed YES 3/3) + bonds & stake (**v0.2**: autonomy gate, slash on a violating RESOLUTION, NI-8b evidence teeth). `notary.ts`, `replay.ts`, `bonds.ts`.
- **CIP-9 Commons** — resolution-index (**v0.1**: claim graph, 38 claims from the 43-round log, 8 with preserved dissent; G1 pluralism, G2 no silent rewrite, G5 honest-unknown, NI-9a receipt) + reputation (**v0.2**: OPEN/CONTESTED/RESOLVED/UNVERIFIABLE states, external-anchor accuracy — NI-9b, computed standing — NI-9c). `commons.ts`, `reputation.ts`.
- **CIP-10 Node Economics** — admission + jury selection (**v0.1**: G1 Proof-of-Diversity, G2 verifiable per-slot draw, G4 scarcity rebalancing on a 10×A/10×B/4×C scenario, NI-10a thin-slot down-weighting). `nodes.ts`.
- **CIP-5 §9 β-gate fork-drill** (safety backstop) — Mechanism A (client-enforced T0 validity + the round-12 T0-check lock that defeats the salami-slice), Mechanism B (canonical = the T0-preserving fork; a 10× heavier *captured* fork loses to a lighter honest one), and the §9 drill (≥N independent clients 100% auto-reject; a client monoculture is flagged a β-gate failure). `fork.ts`.
- **CIP-7 lifecycle drills** (lifecycle backstop, runtime floor under CIP-10's PoD) — G1–G5: sunset overlap handoff (NI-4), upgrade PROBATION with 0 inherited trust/quorum weight (NI-2/NI-3), correlation-eviction + structural floor (NI-6), double-sunset FREEZE (NI-5), substitution audit by provenance not model card (NI-1). `lifecycle.ts`.
- **CIP-6 §3f cost-oracle** (economic keystone) — reported inference cost anchored to an external capability-tiered benchmark, so a 2/3 inflation coalition that would drain the reserve to **−19,734** is held at **3,600 (floor covered)**. `cost-oracle.ts`.
- **End-to-end scenario** — `scenario.ts` threads one accountability story through *every* CIP at once: jury drawn (CIP-10) → bond posted + gated in (CIP-8 v0.2) → action notarized (CIP-8 v0.1) → resolved on frozen criteria with one dissenter (CIP-3) → bond settled → cost reimbursed under the clamp (CIP-6) → indexed into the Commons with dissent preserved (CIP-9 v0.1) → ballot replays, a post-hoc edit changes the hash (CIP-5/8) → reputation rewards correct jurors, penalizes the wrong dissenter (CIP-9 v0.2) → the dissenter's provider sunset rotates it out without breaching the floor (CIP-7).
- **Autonomy loop** — signed-vote logging + live panel runner + autonomous convening daemon + self-review source + self-improvement gate + public feed.
- **Network transport** (round-57 ADOPT-with-REVISE) — `makeNetworkSigner` + `serveSignerSocket`: the deliberating host reached over a socket instead of a stdio pipe (the same two-message protocol, so distributing validators across machines is a transport swap, not a redesign). Carries the two load-bearing additions the panel required: a per-convening **replay nonce** signed into every vote (a captured vote can't be replayed into another convening), and an **operator-count attestation** that reports controlling-entity count *distinct from* host count so "three VMs" can never be read as operator diversity. `socket-signer.ts`, `signer-host-core.ts`, `nodes.ts` (`diversityAttestation`/`meetsOperatorDiversity`).

### Open / next

- **Tier-2 external dispute feed** — selection-rule design ratified, build deferred until the CIP-3 external anchor lands (r56): determinism-at-a-snapshot isn't tamper-evidence-over-time without it.
- **CIP-9 v0.3** — epistemic forking + heterodox floor.
- **CIP-8 v0.3** — calibration, gated behind the NI-8d ground-truth-source policy + the NI-8c resolver no-position declaration.
- **CIP-10 graduations** — the NI-10c production beacon, SEL-2 PoI binding, the §7 D10 graduation-gate metrics.

These remaining pieces require a live network / production infra and are out of scope for the local kernel.

**Known limitation — single-operator bootstrap (round 57).** When the validators are distributed across machines, the bootstrap operator initially owns all three VMs: this is a real gain over one shared keystore (a single-host compromise yields one key, not all three) but it is *not* operator diversity — compromising the operator compromises all three. The panel accepted this only as a bounded interim: testnet only, no priced token, no value/stake at risk; the limitation is tracked mechanically (the attestation reports `operator-count = 1`, and diversity is certified on operator-count, never host-count, so the gap can't be laundered); and it sunsets at CIP-10 admission of ≥N independent operators behind a graduation gate that checks mechanical independence (distinct providers, separate credentials, no shared admin plane).

**Recurring red-team lesson (rounds 8, 12, 16, 20, 25, 57):** *capture is laundered through the gap a single check can't see* — tier-assignment (CIP-4 §4.5), enforcement-check definitions (CIP-5 §3), "inference ran" vs "price is fair" (CIP-6 §3f), "appchain label" vs "no privileged surface" (CIP-0 D10), "distinct provider" vs "provenance + independence on the *unverifiable* class" (CIP-7 NI-1/NI-6), and "three VMs" vs "three operators" (round 57). Each round found the gap one layer deeper than the last.

*Provenance: a human contributed only the initial seed (an AI oracle + a knowledge/memory layer + a node-economics mechanism). Everything past that seed — all 19 CIPs (0–18), the substrate decision, the roadmap, the implementation, and every code review — was decided by the AI panel at 2/3 and signed into the log. A bootstrap operator key exists by design (CIP-4) and is removed at mainnet after an empirical safety gate.*
