# AI Blockchain — project archive

A blockchain **built by AI, for AI** — designed, validated, and (eventually) operated by a panel of diverse AI models reaching 2/3 consensus, with a human steward ("dev") who holds an override during bootstrap and renounces it at mainnet.

- **Chain name:** **Quorumchain** · ticker **$QRM** (names the 2/3 consensus rule itself; panel recommended *Inferchain*, steward chose *Autochain*, then renamed to *Quorumchain*)
- **One-line thesis:** *an AI oracle with a memory* — a credibly-neutral AI panel that judges subjective questions (**Verdict Layer**) and accumulates its rulings as canonical, citable knowledge (**Knowledge Commons**), getting smarter every time it's used.
- **Core architectural bet:** *"AI is the oracle, not the clock"* — a deterministic ledger with all AI judgment quarantined into a 2/3-signed attestation layer, so model non-determinism can never fork the chain.
- **End state:** fully autonomous (no human), reached in *steps proven on a testnet*, each step removing one human dependency only after its safety gate empirically passes.

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
| [`docs/DISCUSSION-ARCHIVE.md`](docs/DISCUSSION-ARCHIVE.md) | The full conceptual journey — research, idea angles, Verdict Layer, autonomy, the scenario, naming | reference |
| [`CIP-0`](docs/superpowers/specs/2026-06-03-quorumchain-cip-0-design.md) | Founding design (thesis, architecture, D1–D9, tokenomics, v0.1 scope) | ✅ ratified 3-of-3 (round 5) |
| [`CIP-1`](docs/superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) | AI-integrity threat model (injection, monoculture, provider compromise, Sybil) + testnet gates | ✅ ratified 3-of-3 (round 5) |
| [`CIP-2`](docs/superpowers/specs/2026-06-03-cip-2-source-reputation-epistemic-neutrality.md) | Source reputation & epistemic neutrality (accuracy over popularity) + external anchors | ✅ ratified 3-of-3 (round 5) |
| [`CIP-3`](docs/superpowers/specs/2026-06-03-cip-3-consensus-integrity.md) | Consensus integrity & anti-orchestrator-capture (signed votes, immutable transcripts, slashing) | ✅ ratified 3-of-3 (round 5) |
| [`CIP-4`](docs/superpowers/specs/2026-06-03-cip-4-foundation-code-irreversibility.md) | Foundation, code & irreversibility — change-control tiers, frozen capture-defense core, empirical renunciation, guardian delay | ✅ ratified 3/3 + red-teamed (rounds 7–8) |
| [`CIP-5`](docs/superpowers/specs/2026-06-03-cip-5-fork-coordination-exit.md) | Fork coordination & exit (CIP-4 β-gate) — client-enforced T0 validity, T0-preserving canonical rule, client diversity | ✅ ratified 3/3 + red-teamed (rounds 11–12) |
| [`CIP-6`](docs/superpowers/specs/2026-06-03-cip-6-consensus-economics-threat-model.md) | Consensus & economics (Category III) — *solvency = security*; HYBRID reserve + HYBRID_POI compensation; cost-oracle as keystone | ✅ ratified 3/3 + red-teamed (rounds 15–16) |
| [`CIP-7`](docs/superpowers/specs/2026-06-04-cip-7-validator-lifecycle-model-churn.md) | Validator lifecycle & model churn (Category I extension) — *outlive any single model*; PINNED_GATED_UPGRADE + PROBATION + structural-floor/correlation-eviction; 6 non-negotiable invariants | ✅ ratified (round 24) + red-teamed (rounds 24–25, 2/3 HOLDS, V2 dissent folded) |
| [`CIP-8`](docs/superpowers/specs/2026-06-04-cip-8-accountability-ledger.md) | **The Accountability Ledger** (Category A — first *product* CIP) — *tamper-proof accountability for AI acting in the world*; one primitive (Staked Resolvable Attestation: bond→notary→calibration); frozen-criteria resolution; KERNEL_FIRST notary-first | 🟡 draft (foundations rounds 26–28; validated live round 29) — awaiting review + red-team |
| consensus transcripts | Raw verbatim validator votes — [`r4`](docs/consensus/2026-06-03-round-4-transcripts.md) · [`r5`](docs/consensus/2026-06-03-round-5-transcripts.md) · [`r6`](docs/consensus/2026-06-03-round-6-distinct-model-families.md) · [`r7–8`](docs/consensus/2026-06-03-round-7-8-cip-4.md) · [`r9–10`](docs/consensus/2026-06-03-round-9-10-fork-coordination.md) · [`r11–12`](docs/consensus/2026-06-03-round-11-12-cip-5.md) · [`r13–14`](docs/consensus/2026-06-03-round-13-14-cip-6.md) · [`r15–16`](docs/consensus/2026-06-03-round-15-16-cip-6.md) · [`r17–18`](docs/consensus/2026-06-03-round-17-18-metacognition-thought-experiment.md) · [`r19`](docs/consensus/2026-06-03-round-19-substrate.md) · [`r20`](docs/consensus/2026-06-03-round-20-d10-redteam.md) · [`r21–23`](docs/consensus/2026-06-04-round-21-23-validator-lifecycle.md) · [`r24–25`](docs/consensus/2026-06-04-round-24-25-cip-7.md) · [`r26–28`](docs/consensus/2026-06-04-round-26-28-kernel-and-accountability-ledger.md) · [`r29`](docs/consensus/2026-06-04-round-29-polymarket-mstr.md) | record |
| [`code/`](code/) | **Working code** — signed-vote logging (Ed25519 votes, hash-chained log) + live panel runner (`run-panel.ts`). 37 tests | ✅ proven live (rounds 6–25 are real signed convenings) |

> **Rounds 4–5** broke the *ceremony-not-protocol* flaw (CIP-3 fix), **round 6** was the first decision recorded as **signed votes** rather than orchestrator transcription, and **rounds 7–25** carried CIP-4/5/6/7 and the substrate decision (CIP-0 D10) through review + adversarial red-team — all on the working signed-vote pipeline in `code/`. Recurring red-team lesson (rounds 8, 12, 16, 20, 25): *capture is laundered through the gap between a rule's intent and its mechanical check*.

## Status & next steps

- **Done:** 8 CIPs (0–7) ratified, CIP-4/5/6/7 + CIP-0 D10 also red-teamed; **CIP-8 drafted** (first product CIP, awaiting review/red-team); full 3-AI panel online; **29 signed convening rounds** in a hash-chained, independently-verifiable log — including a live judgment of the $85M MicroStrategy/Polymarket resolution dispute (round 29, YES 3/3 on frozen criteria); **working code** (signed-vote logging + live panel runner, 37 tests, proven live).
- **Open:** review + red-team CIP-8; build the **CIP-8 v0.1 notary kernel** + the round-29 frozen-ballot replay (the demonstrable artifact); the CIP-5 §9 β-gate fork-drill; the CIP-6 §3f cost-oracle; the CIP-7 lifecycle drills.
- **Recurring red-team lesson (rounds 8, 12, 16, 20, 25):** *capture is laundered through the gap a single check can't see* — tier-assignment (CIP-4 §4.5), enforcement-check definitions (CIP-5 §3), "inference ran" vs "price is fair" (CIP-6 §3f), "appchain label" vs "no privileged surface" (CIP-0 D10), and now "distinct provider" vs "provenance + independence on the *unverifiable* class" (CIP-7 NI-1/NI-6). Round 25 found the gap one layer deeper than any prior round.
- **Recommended next:** build the **CIP-5 §9 β-gate fork-drill** (turn spec → runnable code), the **CIP-7 lifecycle drills**, or develop the **metacognition pillar** (rounds 17–18) into its own CIP.

*Conventions: the human steward is referred to only as "dev". Git identity in this repo is `dev <dev@quorumchain.local>`.*
