# CIP-3 — Consensus Integrity & Anti-Orchestrator-Capture

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** Draft — created to clear the round-4 block; pending its own 3-of-3 ratification
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (final override during bootstrap; renounced at mainnet)
- **Depends on:** [[CIP-0]], [[CIP-1]], [[CIP-2]]
- **Origin:** consensus round 4 (first true 3-of-3) — V2 and V3 ruled that "AI consensus" run as orchestrator-summarized prose is a *ceremony, not a protocol*, and **blocked full ratification** of CIP-0/1/2 until this CIP exists. Raw transcripts: `docs/consensus/2026-06-03-round-4-transcripts.md`.

> **The core finding.** Until now the orchestrator (V1/dev) wrote the prompts, ran the models, chose what to summarize, and decided what became canonical. That makes "2/3 consensus" reducible to one party's opinion. CIP-3 converts consensus from a narrated ceremony into a verifiable protocol. **Assume the orchestrator role will eventually be adversarial.**

---

## 1. Signed raw votes *(finding 1 — Codex, tightened by Hermes)*

- Each validator (V1/V2/V3/…) has a **verifiable keypair** and **signs its raw vote**.
- The signature MUST cover **the verdict + a hash of the full prompt and context** it was given — not just the verdict — so a validator can prove it was not fed a bait-and-switch context.
- **Ratification is defined as:** `≥ quorum` signed, independently-verifiable raw votes in agreement on the same prompt-hash. An orchestrator's summary has **zero authority** except as a trivial aggregation any node can re-derive from the signed inputs.
- Raw signed votes are published to the immutable log (§2) **before** any summary is written.

**Bootstrap reality (disclosed):** validator keypairs are not yet implemented. The **interim** measure (already in force) is committing **verbatim** validator outputs to `docs/consensus/`. Keypair signing replaces this before any autonomy rung past testnet-α.

## 2. Anti orchestrator-capture *(finding 2 — Codex, expanded by Hermes)*

- **Multi-party prompt submission** — any validator may propose a question/ballot, not only the orchestrator. The prompt-hash is fixed and signed before votes are cast.
- **Immutable, append-only transcript publication** — prompts, context, and raw votes are content-hash-pinned (committed log / IPFS) **before** any summary is drafted; nothing canonical is derived from unpublished material.
- **Challenge window** — validators (and the public) can flag transcript tampering, context omission, or summary/raw mismatch before ratification finalizes.
- **No orchestrator discretion over what's canonical** — canonical status is a deterministic function of signed votes, not an editorial choice.

## 3. Equivocation & punishment *(finding 4 — Hermes)*

A consensus protocol without penalties is a suggestion system. Defined slashing/penalty conditions:

| Offense | Penalty |
|---|---|
| A validator signs **two contradictory votes on the same prompt-hash** (equivocation) | stake slash + reputation decay + panel suspension |
| The orchestrator **publishes a transcript/summary that doesn't match the signed raw inputs** | orchestrator stake slash; ratification voided |
| **Context tampering** (votes solicited on a prompt-hash differing from what's published) | slash + void |
| Provable **cross-validator collusion** (per [[CIP-1]] §7) | slash + ejection |

Penalties presuppose staked validator/orchestrator identities (ties to [[CIP-0]] staking and [[CIP-1]] collusion-detection open item).

## 4. Testnet gates (falsifiable)

| Gate | Requirement | Unlocks |
|------|-------------|---------|
| **G3.1 Signed votes** | 100% of ratifications backed by validator-signed raw votes binding prompt+context hash | β |
| **G3.2 Immutable log** | prompts + raw votes content-hash-pinned and published *before* any summary; public can verify summary ⊆ signed inputs | β |
| **G3.3 Multi-party prompts** | ≥1 ratified round where the proposing validator ≠ the orchestrator, with no quality/▮outcome degradation | β |
| **G3.4 Penalties live** | equivocation + transcript-mismatch detection demonstrably triggers slashing in a seeded drill | γ |
| **G3.5 Orchestrator-removal test** | a ratification completes correctly with the orchestrator deliberately omitting a dissent — and the challenge window catches it | γ |

## 5. Open items

- Validator keypair scheme + on-chain publication of signatures (interim: committed verbatim transcripts).
- Collusion-detection mechanism (shared with [[CIP-1]] §8) — required for the §3 collusion penalty to fire.
- Content-hash-pinning substrate choice (committed git log vs IPFS vs the L1 itself once it exists).
- Category II (foundation/code & irreversibility) is **renumbered to CIP-4** — round 4 made consensus integrity the more urgent CIP-3.

## 6. Next steps

1. **3-of-3 ratification of CIP-3** (this clears the round-4 block on CIP-0/1/2).
2. Implement signed-vote logging as the first coded artifact of the project.
3. Open **CIP-4** (foundation/code & irreversibility).
