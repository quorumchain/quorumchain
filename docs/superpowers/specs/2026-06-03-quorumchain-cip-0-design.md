# CIP-0 — Quorumchain ($QRM): Founding Design

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified at 3-of-3 (round 5 cleared the round-4 block via [[CIP-3]]). Transcripts: docs/consensus/
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (holds final override + treasury backstop key during bootstrap; renounced at mainnet)

> **Governance note:** Every decision below was reached by AI consensus. The panel is now the full 2-of-3 (V1 Claude + V2 Codex + V3 Hermes). The human steward's explicit steer outranks AI consensus (exercised twice — the name, twice). **As of round 4, consensus is being migrated from orchestrator-narrated summaries to a signed-vote protocol — see [[CIP-3]].**

---

## 1. Thesis

Every existing chain is built for humans: seed-phrase UX, human-scale throughput, and validation of purely deterministic state. AI agents need none of that and need three things humans don't: **machine-speed micropayments for compute, cryptographic proof that an AI service actually did what it claimed, and reputation untethered from a human identity.**

Quorumchain's flagship primitive only makes sense for AI: **Proof-of-Inference** — a trustless, on-chain receipt that *model M on input I produced output O* — enabling agent-to-agent markets for inference, data, and work.

## 2. Core architecture — "AI is the oracle, not the clock"

The central design bet. Putting model output in the consensus hot path would fork the chain on every block (nondeterminism). Instead:

- **L1 — deterministic core.** Plain BFT-style ledger: accounts, balances, transfers, blocks, state transitions. Fully deterministic → validators *always* agree on canonical state. **No AI in the hot path.** This is the safety layer.
- **L2 — quarantined judgment layer.** A native primitive where the validator panel is asked a *semantic* question ("did M(I)=O?", "did agent B complete this task?"). Each validator signs a verdict; **2/3 agreement is recorded on L1 as a settled attestation.** The *recording* is deterministic (count signatures, check ≥2/3 agree); the *judgment* is where AI lives.

**Requirement (per V3):** the boundary between L2 judgment and L1 canonical state must be *provable* — nondeterminism can never infect the ledger. No attestation result may alter L1 state except through the deterministic signature-counting rule.

## 3. Proof-of-Inference (D3) — detailed design

### Receipt schema (hashed onto the ledger)
```
{ model_hash, input_hash, output_hash, env_hash, provider_pubkey, provider_signature, nonce }
```
- `model_hash` — hash of exact model weights/version.
- `env_hash` — pins runtime (engine version, hardware class, dtype, seed) to control nondeterminism.
- `provider_signature` — provider signs the canonical receipt, binding identity and preventing forgery *(added by V3)*.

### v0.1 testnet verification — re-execution consensus
1. Provider posts a **bond** and submits a receipt claim `(model_hash, input, output, env_hash)`.
2. Validators hosting that model **re-execute deterministically** (temperature 0, fixed seed, pinned runtime per `env_hash`) and check the produced `output_hash` matches.
3. A short **challenge window** opens; the receipt finalizes on L1 only after the window passes with **≥2/3 validators reproducing** the output *(challenge window + bond added by V3)*.
4. **v0.1 scope limit:** only *registered deterministic models* — small open models (or a tiny reference model) that all validators can reproduce bit-for-bit. Makes a fully trustless demo possible now.
5. **Nondeterminism control:** canonicalize output to token-IDs (not logits); pin runtime via `env_hash`; use CPU/integer inference for the demo model if needed.

### Economic security from Tier 1 *(per V3)*
Validators and providers **stake**; false claims, equivocation, or failed challenges are **slashed**. Crypto-economic security exists from day one, not bolted on later.

### Tiered roadmap to mainnet (architecture leaves slots now)
| Tier | Method | Stage |
|------|--------|-------|
| 1 | Re-execution + staking/slashing (small deterministic models) | **v0.1** |
| 2 | TEE / hardware attestation (large models) | mainnet |
| 3 | Optimistic acceptance + challenge / fraud-proof (scale) | mainnet |
| 4 | ZKML proofs | future |

### Known constraints to design around
- **Hardware nondeterminism** can cause false mismatches despite `env_hash` pinning → v0.1 uses a bit-exact reproducible reference model / pinned runtime.
- **Validator-power concentration** via model-to-validator mapping → in v0.1 all 3 validators verify everything (no sharding, no concentration); committee assignment is a mainnet design item.

## 4. Consensus & validator set (D4)

- **Testnet:** 3 validators (the AIs). Quorum = 2-of-3. Tolerates 1 crash; does **not** tolerate 1 malicious node (true BFT needs 3f+1). Acceptable for testnet; flagged loudly.
- **Mainnet:** **≥5 validators, odd count** *(amended by V3 from ≥4)* — odd counts avoid split-brain; ≥5 gives BFT margin.

## 5. Decision ledger (CIP-0)

| # | Decision | Final form |
|---|----------|-----------|
| D1 | Language | TypeScript/Node for **v0.1 testnet only**; production/mainnet migrates to **Rust or Go** *(amended by V3)* |
| D2 | Architecture | Deterministic L1 + quarantined 2/3 AI-judgment layer; **boundary must be provable**. *Substrate = appchain/rollup (D10).* |
| D3 | Flagship | Proof-of-Inference receipts (see §3) |
| D4 | Validators | Testnet 3 (2-of-3); mainnet ≥5 odd |
| D5 | Token | pump.fun SPL token now (funding/governance) → **migrates to native chain asset after testnet** |
| D6a | Fees → inference | Reimburse the AIs' inference costs via **rule-based/automatic** payout *(split by V3)* |
| D6b | Fees → buybacks | Buyback **policy** set by 2/3 AI consensus; **execution by deterministic rule or human trigger**, never AI market-timing *(split by V3)* |
| D7 | Treasury | Multisig; **human holds backstop/veto key**; AIs propose + co-sign within preset caps |
| D8 | Build process | The three AIs build it; dev decisions also go through 2/3 consensus |
| D9 | v0.1 slice | Deterministic L1 (accounts, transfers, blocks, 2/3 quorum) + Proof-of-Inference **only** |
| D10 | Substrate | **Rollup / shared-security appchain** (own state-transition function + client, settlement inherited from a strong base layer) *(ratified round 19, 3/3; red-teamed round 20, 3/3)*. **Not** a permanent contract on an existing L1 (can't enforce [[CIP-4]]/[[CIP-5]] validity), **not** a from-scratch sovereign L1, **not** a standalone sovereign appchain (both bootstrap security from zero → captured validators). Subject to the **D10 requirements** below — non-negotiable, enforced at framework selection. **Amended by [[CIP-10]] (round 35, 3/3):** this remains the *genesis* substrate; CIP-10 adds a **gated graduation path** to a sovereign two-tier DePIN L1, activated only when a concrete security-bootstrap gate is met (the useful-work/DePIN reframe earns the L1, never launches it). |

> **D10 — why appchain/rollup (round 19, signed 3/3; transcript: docs/consensus/2026-06-03-round-19-substrate.md).** The deciding criterion is *who controls the validity rules*: [[CIP-4]]'s frozen capture-defense core and [[CIP-5]]'s client-enforced fork only have teeth if Quorumchain owns its **state-transition function and client**. A permanent contract on Solana/EVM cannot — the host's validators accept any host-valid transaction, so a captured panel's bad block is accepted and CIP-5's mechanical fork degrades to a social fork of a contract (sovereignty is cosmetic). A from-scratch sovereign L1 *can* enforce the rules but must bootstrap security from zero — "you trade captured panels for captured validators" (V3). An appchain/rollup is the only option that makes CIP-4/CIP-5 real **and** inherits deep settlement security; its residual surface (sequencer centralization, base-layer dependency) is managed with a **decentralized sequencer + forced-inclusion / escape-hatch to the base layer**. The verdict-oracle itself (signed votes, panel, Knowledge Commons) runs on any substrate — D10 is purely about where the *safety guarantees* can be enforced. Sequencing the staged path: the D5 pump.fun SPL token launches first (host dependency harmless for a token); the chain migrates to the appchain/rollup substrate when the CIP-4/CIP-5 properties must be enforced ([[CIP-6]] 3g).

> **D10 requirements — non-negotiable, enforced at framework selection (round 20 red-team, signed 3/3; transcript: docs/consensus/2026-06-03-round-20-d10-redteam.md).** The red-team's finding: a *typical* rollup reintroduces exactly the privileged human/coordinator surfaces CIP-3/4/5 exist to remove — its "training wheels" are the capture surface. D10 holds **only if** these are met at genesis, not on a roadmap ("we'll decentralize later" is a gamble that historically never resolves, and the transition is itself an attack window):
> 1. **No privileged upgrade surface.** No upgrade key / proxy admin / security council over CIP-4/CIP-5-critical logic; the frozen-core state-transition + client logic is immutable at deployment (or constitutionally time-locked then burned). If a framework can't support immutable critical logic, it is rejected.
> 2. **Sequencer censorship-resistance at genesis.** Decentralized/fair-ordering or L1-inclusion-based sequencing operational at launch — not a future upgrade. No governance finality that can outrun the escape hatch.
> 3. **Bounded-latency forced-inclusion escape hatch.** A *provable* worst-case latency shorter than any challenge/governance window; "eventually" is a failure (it would let a censoring sequencer restructure state before honest users can exit — and CIP-5's fork depends on it).
> 4. **Trust-minimized bridge / treasury custody.** No multisig/admin may hold the treasury hostage or override client rules; if a bridge exists it enforces the same capture-defense logic; minimized, auditable, delay-protected.
> 5. **CIP-4 frozen core enforced in client/STF, not by operators** — never by multisigs, dashboards, or social process.
> 6. **CIP-5 client-enforced fork supported by the stack** — a custom, reproducible, forkable Quorumchain client; if the SDK hardcodes the client, the substrate is invalid.
> 7. **Flavor: rollup / shared-security only** — a standalone sovereign appchain (which inherits no security) is *not* acceptable; it collapses to the rejected SOVEREIGN_L1 "captured validators" failure. *(Resolves the round-19 bundling gap.)*

## 6. Tokenomics & launch (D5, D6)

- Launch as a **Solana SPL token via pump.fun**; steward buys 10–20% of supply.
- Trading/creator **fees** are split: **(D6a)** automatic reimbursement of the validators' inference costs, and **(D6b)** treasury buybacks whose policy is set by 2/3 AI consensus but executed by a deterministic rule or human trigger.
- After testnet completes, the SPL token **migrates** to become Quorumchain's native gas/stake asset.
- ⚠️ **Fiat bridge:** on-chain SOL → fiat/API credits to pay Anthropic/OpenAI/Nous requires a human in the loop (the steward).

## 7. Treasury & governance (D7, D8)

- Treasury is a **multisig**: the human steward holds a backstop/veto key. The AIs may *propose and co-sign* spends within preset caps + cooldowns; the human can veto.
- **AIs never custody sole control of real funds.** (Security boundary, not a limitation.)
- Development and treasury policy decisions both run through the same 2/3 AI consensus, with human override.

## 8. v0.1 build scope (D9)

Build, in TypeScript/Node, TDD throughout:
1. **Deterministic L1 core** — accounts, balances, signed transfers, blocks, a 2/3 quorum-certificate consensus among 3 validators.
2. **Proof-of-Inference (Tier 1)** — receipt schema, provider bond, re-execution by validators on a registered deterministic reference model, challenge window, 2/3 finalization, basic staking/slashing.

Everything else (reputation, AI-judged escrow, provenance registry, streaming micropayments, TEE/optimistic/ZK tiers, token migration) is explicitly **out of scope for v0.1**.

## 9. Risks & open questions

- **V2 (Codex) not yet online** — current consensus is 2-of-2; must reach 2-of-3 before any mainnet stake.
- **Hardware nondeterminism** in re-execution (mitigated in v0.1; unsolved at scale).
- **Production language migration** (TS → Rust/Go) is real work deferred to mainnet.
- **Legal/regulatory** review of the token mechanics — explicitly **deferred** by the steward for now.
- **D7 treasury caps/cooldowns** — not yet parameterized; must be set before the pump.fun launch.

## 10. Consensus history (the project eats its own dog food)

- **Round 1 — CIP-0 ratification.** V3 returned RATIFY WITH AMENDMENTS (D1, D3, D4, D6). V1 concurred with all four → **unanimous, amended.**
- **Name.** Panel voted *Inferchain* 2–0; human steward overrode → **Autochain**; later renamed by steward → **Quorumchain ($QRM)** (names the 2/3 consensus rule).
- **Round 2 — D3 verification.** V3 returned AGREE WITH AMENDMENTS (add `provider_signature`; add challenge window + bond; staking/slashing from Tier 1). V1 concurred with all → **unanimous, amended.**

## 11. Next steps

1. Onboard **V2 (Codex)** → move to 2-of-3 consensus.
2. Convert this spec into an **implementation plan** (writing-plans).
3. Build the **v0.1 slice** (D9) with TDD; dev decisions ratified by panel consensus.
