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
| consensus transcripts | Raw verbatim validator votes — [`r4`](docs/consensus/2026-06-03-round-4-transcripts.md) · [`r5`](docs/consensus/2026-06-03-round-5-transcripts.md) · [`r6`](docs/consensus/2026-06-03-round-6-distinct-model-families.md) · [`r7–8`](docs/consensus/2026-06-03-round-7-8-cip-4.md) · [`r9–10`](docs/consensus/2026-06-03-round-9-10-fork-coordination.md) · [`r11–12`](docs/consensus/2026-06-03-round-11-12-cip-5.md) | record |
| [`code/`](code/) | **Working code** — signed-vote logging (Ed25519 votes, hash-chained log) + live panel runner (`run-panel.ts`). 37 tests | ✅ proven live (rounds 6–12 are real signed convenings) |

> **Rounds 4–5** broke the *ceremony-not-protocol* flaw (CIP-3 fix), **round 6** was the first decision recorded as **signed votes** rather than orchestrator transcription (distinct-model-families rule), and **rounds 7–12** carried CIP-4 and CIP-5 through review + adversarial red-team — all on the working signed-vote pipeline in `code/`. Recurring red-team lesson (rounds 8 & 12): *capture is laundered through the gap between a rule's intent and its mechanical check* — hence the frozen tier-assignment (CIP-4 §4.5) and frozen enforcement-check definitions (CIP-5 §3).

## Status & next steps

- **Done:** 6 CIPs (0–5) ratified 3-of-3, CIP-4/5 also red-teamed; full 3-AI panel online; **12 signed convening rounds** in a hash-chained, independently-verifiable log; **working code** (signed-vote logging + live panel runner, 37 tests, proven live).
- **Open:** CIP-6 (Category III — consensus & economics); the load-bearing unbuilt pieces are the CIP-5 §9 β-gate fork-drill and the CIP-0 v0.1 ledger slice.
- **Recommended next:** **CIP-6** (the chain's unique economic existential risk — recurring AI-inference operating cost vs. fee solvency) → build the β-gate drill → CIP-0 v0.1 slice.

*Conventions: the human steward is referred to only as "dev". Git identity in this repo is `dev <dev@quorumchain.local>`.*
