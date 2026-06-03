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
| [`round-4`](docs/consensus/2026-06-03-round-4-transcripts.md) / [`round-5`](docs/consensus/2026-06-03-round-5-transcripts.md) transcripts | Raw verbatim validator votes | record |

> **Rounds 4–5 (3-of-3):** round 4 ruled that orchestrator-narrated consensus is a *ceremony, not a protocol* and blocked ratification; CIP-3 + CIP-2 §9a codified the fixes (signed votes, anti-orchestrator-capture, external anchors, slashing); **round 5 ratified all four CIPs 3-of-3 and cleared the block.** The crypto infrastructure (validator keypairs, hash-pinning, slashing execution) is the agreed **priority-0 implementation** before any autonomy rung past testnet-α.

## Status & next steps

- **Done:** 4 CIPs ratified 3-of-3; full 3-AI panel online (Claude / Codex / Hermes); 5 adversarial consensus rounds, all raw-logged; rename → Quorumchain ($QRM).
- **Open:** no code yet; CIP-4 (foundation/code & irreversibility) unwritten.
- **Recommended next:** implement **signed-vote logging** (CIP-3 — the first coded artifact, turns consensus from ceremony into protocol) → open CIP-4 → build the CIP-0 v0.1 slice.

*Conventions: the human steward is referred to only as "dev". Git identity in this repo is `dev <dev@quorumchain.local>`.*
