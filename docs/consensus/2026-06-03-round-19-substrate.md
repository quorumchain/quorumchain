# Round 19 — eventual substrate (signed)

**Date:** 2026-06-03
**Subject:** [[CIP-0]] D10 — what should Quorumchain's eventual substrate be? (The $QRM token launches on pump.fun / Solana SPL first regardless; this decides what the *chain itself* becomes.)
**Mechanism:** multiple-choice signed-vote convening via `code/src/run-panel.ts` (`QRM_VERDICTS`), [[CIP-3]]. Ed25519 over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus).

**Options:** `CONTRACT_ON_L1` · `APPCHAIN_ROLLUP` · `SOVEREIGN_L1`
**Ballot hash:** `cf9b24b05acbaee7e36c2503af865781c2ad6a0503c5a4af228c46a711331515`
**Result:** ✅ **APPCHAIN_ROLLUP, 3/3.**

**Deciding criterion (in the ballot):** *who controls the validity rules?* [[CIP-4]] (frozen capture-defense core) and [[CIP-5]] (client-enforced fork — honest clients locally reject a T0-violating block) only have teeth if Quorumchain owns its **state-transition function and client**. The verdict-oracle itself runs on any substrate; this choice is purely about where the *safety guarantees* can be enforced.

- **V1 (Claude):** CONTRACT_ON_L1 fails exactly there — the host's validators decide validity and don't enforce our T0 rules, so a captured panel's bad transaction is accepted and CIP-5's mechanical fork degrades to a social fork of a contract. SOVEREIGN_L1 must bootstrap security from zero, and a thinly-secured chain is *easier* to attack than one inheriting a base layer. APPCHAIN_ROLLUP owns the STF+client (CIP-4/CIP-5 real) while inheriting settlement security; residual sequencer/base-layer dependency managed with a decentralized sequencer + forced-inclusion escape hatch.
- **V2 (Codex):** Must own the STF and client for CIP-4/CIP-5 to be enforceable rather than social norms. CONTRACT_ON_L1 fails the sovereignty test (host accepts host-valid txns even if they violate our rules); SOVEREIGN_L1 adds unnecessary early security risk (bootstrap from zero). APPCHAIN_ROLLUP gives real protocol-level validity control while inheriting stronger settlement.
- **V3 (Hermes):** CONTRACT_ON_L1 → "sovereignty is cosmetic" (validity belongs to the host; CIP-5 becomes a social split around a contract address). SOVEREIGN_L1 "passes on paper but introduces an existential vulnerability: a thin, newly-bootstrapped validator set is economically cheaper to capture or attack than the very panels the system defends against — **you trade captured panels for captured validators**; the frozen-core guarantee collapses if the chain itself can be 51%-attacked on day one." APPCHAIN_ROLLUP is the only option where CIP-4/CIP-5 function as designed *and* inherits a deep security layer; residual risk manageable via forced-inclusion + gradual sequencer decentralization.

Sigs — V1 `roh=7a09e18fd6a7… sig=4faced9ba6e6…` · V2 `roh=634aaa7f8a61… sig=cef48920a816…` · V3 `roh=fa0fc8bc8f68… sig=cec1eeca6658…`

---

## Outcome

Quorumchain's eventual substrate = **appchain / rollup** (own state-transition function + client, settlement inherited from a strong base layer). Folded into [[CIP-0]] as **D10** with rationale; D2 annotated. Staged path unchanged: pump.fun SPL token first (D5), migrate to the appchain/rollup substrate when CIP-4/CIP-5 enforcement is needed ([[CIP-6]] 3g). The sharpest argument — V3's — is that for a *capture-resistance* project, a from-scratch sovereign L1 is not merely costlier but actively dangerous: it relocates the capture target from the panel to an under-secured validator set.
