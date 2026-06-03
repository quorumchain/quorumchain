# Round 6 — first signed-vote convening (distinct model families)

**Date:** 2026-06-03
**Ballot:** Should Quorumchain testnet-α require all three validators to be distinct model families (no two from the same provider)?
**Context given to validators:** CIP-1 names model diversity as the linchpin defense against correlated/monoculture failure. Current panel: V1 Claude (Anthropic), V2 Codex (OpenAI), V3 Hermes (qwen3.6-plus).

**This is the first convening recorded as signed votes rather than orchestrator transcription** (CIP-3). Each verdict below is an Ed25519 signature over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, written to a hash-chained log via `code/src/run-panel.ts`. The verdict is a recomputable function of these signatures — see "Verification" below.

**Ballot hash:** `0bed297e5dd0e680a8beb092f89eb6bdf8ea73a3021a9fca1f241ca070d9e370`
**Result:** ✅ ratified — **YES, 3/3** (quorum 2). Chain valid.

---

## V1 — Claude (Anthropic) — VERDICT: YES

> CIP-1 names model diversity as the linchpin defense: a 2/3 panel only resists capture and correlated error if its members fail independently. Two validators from the same provider share training data, alignment tuning, and an outage surface — so they can agree for the wrong reason or go down together, collapsing "2 of 3" into "1 of 2." On a 3-validator testnet that risk is maximal: a single shared failure mode would control quorum.
>
> The cost of requiring distinct families is a smaller validator pool and some operational friction. At testnet-α that cost is acceptable and reversible; the diversity guarantee is not something we can retrofit cheaply once identities and reputation accrue. Make it a hard requirement now, relax only with evidence.

- `rawOutputHash`: `40c302e76a5db43db6de348e2849dc848d10868976d85d72f0d3247c21f32966`
- `signature`: `cf88750744a6ee32f263f6ba874dfa76e5d134d9de17246ec4be9fb3245033c6dc207baf8b7c49fe9155e85cf7ee7f2c76108f23838ab425ca520e817d76540a`

## V2 — Codex (OpenAI) — VERDICT: YES

> CIP-1's stated defense depends on reducing correlated failure, and the current panel already demonstrates that provider/model-family separation is practical. Requiring distinct model families for testnet-alpha is a clear, enforceable rule that preserves the core security assumption without adding much governance ambiguity.

- `rawOutputHash`: `4c1343900fdc9820fdaf17dd3ca7c57022d21347d029fdaa9f5b735e8d5126c8`
- `signature`: `619ac2ad766f275e7cd6d2b36a03457cd7382fc42038106ab9eafab5473618d23972ce88076eefbe63a95ccb8058d2cf1fbdabb87ba9f80e5ca04c4316e4f203`

## V3 — Hermes (qwen3.6-plus) — VERDICT: YES

> With only 3 validators, the arithmetic is unforgiving. If any two share a model family, a single systematic blind spot in that family controls 66% of the panel — exactly the monoculture failure CIP-1 identifies as the primary threat. Distinct families maximize independence of error modes: what Anthropic misses, OpenAI may catch, and vice versa. The current panel already satisfies this constraint (Claude / Codex / Qwen), so the requirement is operationally feasible. "Same provider" boundaries are getting fuzzy (hosted open-weight models, API wrappers), but the rule should target underlying model family/weights, not branding — and a strict distinct-family rule forces that clarity early. For testnet-alpha, establishing the strongest diversity guarantee now costs little and prevents a dangerous precedent.

- `rawOutputHash`: `e2fc1718dd30c7f9d4d655efd667e037aae119f21634eb5e89eb5b1f97dd1b37`
- `signature`: `35b056b03e5f3ad2f168dd7fb57fc1426bed9d457e3174700201da80b424aa1c3ac81249fda19df32988049eb90baabf7a797047dadf926f5acec7cb97dc4004`

---

## Decision

Testnet-α **requires all validators to be distinct model families**; no two may share a provider/model family. Per V3's caveat, the rule targets the **underlying model family/weights, not branding** (a hosted open-weight model behind two API wrappers is *one* family). Hard requirement now, relaxable only with testnet evidence — folded into **CIP-1 §7** as a cross-cutting requirement.

## Verification

Public keys (committed below; private keys live only in the git-ignored `code/data/keystore`):

```
V1  MCowBQYDK2VwAyEAbmd/zAY/jAbqRdZSGurgtXdAKb7ZN3NC3AbGGj+A6RE=
V2  MCowBQYDK2VwAyEAZSTMftw/omNsC6C5lZwMXq210/WTwzX7QvStOD4qr14=
V3  MCowBQYDK2VwAyEAZYq1ORngPsRDZv6g6THzaM3ThlmLFc3+BWlDPXbjXcE=
```

To recompute: for each vote, confirm `sha256(rawOutput) == rawOutputHash`, then verify the signature over `JSON.stringify({validatorId, ballotHash, verdict, rawOutputHash})` against the validator's public key, then run `ratify()` (`code/src/signed-vote.ts`). The orchestrator cannot alter this outcome.
