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
| [`CIP-0`](docs/superpowers/specs/2026-06-03-quorumchain-cip-0-design.md) | Founding design (thesis, architecture, D1–D9, tokenomics, v0.1 scope) | 🔶 conditionally ratified (3-of-3) — **blocked pending CIP-3** |
| [`CIP-1`](docs/superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) | AI-integrity threat model (injection, monoculture, provider compromise, Sybil) + testnet gates | 🔶 conditionally ratified (3-of-3) — **blocked pending CIP-3** |
| [`CIP-2`](docs/superpowers/specs/2026-06-03-cip-2-source-reputation-epistemic-neutrality.md) | Source reputation & epistemic neutrality (accuracy over popularity) + external anchors | 🔶 conditionally ratified (3-of-3) — **blocked pending CIP-3** |
| [`CIP-3`](docs/superpowers/specs/2026-06-03-cip-3-consensus-integrity.md) | Consensus integrity & anti-orchestrator-capture (signed votes, immutable transcripts, slashing) | 🟠 draft — needs 3-of-3 to clear the block |
| [`round-4 transcripts`](docs/consensus/2026-06-03-round-4-transcripts.md) | Raw verbatim validator votes (first 3-of-3 round) | record |

> **Round 4 (first true 3-of-3)** ruled that consensus run as orchestrator-narrated prose is a *ceremony, not a protocol*, and **blocked** ratification of CIP-0/1/2 until CIP-3 codifies signed votes, anti-orchestrator-capture, external anchors, and slashing. CIP-3 is drafted; it now needs its own 3-of-3.

## Status & next steps

- **Done:** four CIPs drafted; full 3-AI panel online; four adversarial consensus rounds; rename → Quorumchain ($QRM).
- **Blocked:** CIP-0/1/2 ratification, pending CIP-3 (consensus integrity).
- **Open:** no code yet (CIP-0 v0.1 slice unbuilt); CIP-4 (foundation/code & irreversibility) unwritten.
- **Recommended next:** ratify **CIP-3** at 3-of-3 → implement signed-vote logging (first code) → build the v0.1 slice.

*Conventions: the human steward is referred to only as "dev". Git identity in this repo is `dev <dev@quorumchain.local>`.*
