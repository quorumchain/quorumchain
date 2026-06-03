# AI Blockchain — project archive

A blockchain **built by AI, for AI** — designed, validated, and (eventually) operated by a panel of diverse AI models reaching 2/3 consensus, with a human steward ("dev") who holds an override during bootstrap and renounces it at mainnet.

- **Chain name:** **Autochain** (the autonomy thesis; panel recommended *Inferchain*, human steward overrode)
- **One-line thesis:** *an AI oracle with a memory* — a credibly-neutral AI panel that judges subjective questions (**Verdict Layer**) and accumulates its rulings as canonical, citable knowledge (**Knowledge Commons**), getting smarter every time it's used.
- **Core architectural bet:** *"AI is the oracle, not the clock"* — a deterministic ledger with all AI judgment quarantined into a 2/3-signed attestation layer, so model non-determinism can never fork the chain.
- **End state:** fully autonomous (no human), reached in *steps proven on a testnet*, each step removing one human dependency only after its safety gate empirically passes.

## The panel (consensus validators)

| | Model | Vendor | Status |
|---|---|---|---|
| **V1** | Claude (Opus 4.8) | Anthropic | online |
| **V2** | Codex (GPT) | OpenAI | **not yet installed** — all ratifications are 2-of-2, pending 2-of-3 |
| **V3** | Hermes (StepFun step-3.7-flash, free) | Nous Portal | online |

## Documents

| Doc | What it is | Status |
|---|---|---|
| [`docs/DISCUSSION-ARCHIVE.md`](docs/DISCUSSION-ARCHIVE.md) | The full conceptual journey — research, idea angles, Verdict Layer, autonomy, the scenario, naming | reference |
| [`CIP-0`](docs/superpowers/specs/2026-06-03-autochain-cip-0-design.md) | Founding design (thesis, architecture, D1–D9, tokenomics, v0.1 scope) | ✅ ratified + amended (rounds 1–2) |
| [`CIP-1`](docs/superpowers/specs/2026-06-03-cip-1-ai-integrity-threat-model.md) | AI-integrity threat model (injection, monoculture, provider compromise, Sybil) + testnet gates | ✅ ratified + amended (round 3) |
| [`CIP-2`](docs/superpowers/specs/2026-06-03-cip-2-source-reputation-epistemic-neutrality.md) | Source reputation & epistemic neutrality (accuracy over popularity) | ✅ ratified + amended (round 3) |

> All ratifications are currently **2-of-2** and flagged for **re-ratification at 2-of-3** once Codex (V2) is online — Hermes itself proved a 2-validator panel is collusion-trivial (CIP-1, round 3).

## Status & next steps

- **Done:** three ratified CIPs; coherent thesis; three adversarial consensus rounds.
- **Open:** no code yet (CIP-0 v0.1 slice unbuilt); V2/Codex offline; Categories II–V of the threat model (CIP-3+) unwritten.
- **Recommended next:** bring Codex online → re-ratify at 2-of-3 → start building the v0.1 slice.

*Conventions: the human steward is referred to only as "dev". Git identity in this repo is `dev <dev@autochain.local>`.*
