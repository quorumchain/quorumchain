# Round 45 — Verification review of the round-44 fixes (REVISE → SOUND)

**Date:** 2026-06-04
**Type:** Verification review — do the six implemented fixes faithfully and correctly close the round-44 REVISE backlog, with no regression and no new intent-vs-check gap? Is the build now SOUND?
**Method:** Live convening via `code/src/run-panel.ts`. V1 (Claude) reviewed and pre-committed its vote; V2 (Codex) and V3 (Hermes) reviewed independently from a neutral build summary (`code/data/review-context-r45.txt`). Verdict tokens: SOUND / REVISE / INADEQUATE.
**Ballot hash:** `45de89efb218b5e6d522c4a66a799037ca58cc0f45e4df66cd35ba293c955238`
**Result:** **SOUND — 2/3** (tally `{SOUND:2, REVISE:1}`)
- V1 **SOUND** · `sig 86df24d276…` · `roh bd575e019f…`
- V2 **REVISE** · `sig a83ab053a4…` · `roh 9019f0c294…`
- V3 **SOUND** · `sig 6864e3ce90…` · `roh ba1ed278ef…`

Chain verified valid at 123 entries. V3 voted cleanly this round (no context-delivery mis-fire). Verbatim reasoning: `code/data/raw-45de89efb218.txt`.

---

## Verdict

The panel **ratified SOUND 2/3**: the six locally-buildable round-44 REVISE items (#1 identity, #2 signer, #3 NI-1 full vector, #4 NI-10a hard rule, #5 bond↔resolution binding, #7 2/3-in-ratify) are closed correctly and faithfully; the two deferrals (#2's OS-custody residual and #6 on-chain module state) are honest, disclosed, and non-fatal. This upgrades the round-44 REVISE — the build moved from "faithful but with real gaps" to "sound, with only the substrate-gated item (#6) outstanding."

## V2 (Codex) — dissent (REVISE): a real binding gap in the signer

V2 agreed the six items close mechanically, but voted REVISE on a **specific, correct finding** beyond the acknowledged OS-custody deferral:

> `Signer.signBallot(ballotHash, fullPrompt)` received the hash and prompt **separately**, invoked on `fullPrompt`, then signed the **caller-supplied `ballotHash` without recomputing or checking it corresponded to the judged prompt/context**. A malicious orchestrator could ask the signer to deliberate on one ballot but obtain a signature over a *different* ballot hash — exactly the bait-and-switch CIP-3 (§1c) exists to eliminate — and a `RemoteSigner` on the same interface would inherit it.

This is the same shape as every prior red-team finding: **capture laundered through the gap between a rule's intent and its mechanical check.** The Signer boundary (round-44 #2) was meant to remove the orchestrator as trust root, but it still trusted the orchestrator to supply a hash corresponding to the content the validator judged.

## Action taken (this round)

Fixed immediately via TDD (red→green), per the round-44 precedent:

- **`signer.ts`:** `signBallot` no longer accepts a hash. It takes the ballot **content** — `signBallot(prompt, context, verdicts?)` — and **derives the ballot hash itself** via `ballotHash(prompt, context)`, then has the validator's injected `deliberate(prompt, context, verdicts?)` build the prompt + invoke + parse over that *same* content. The orchestrator supplies no hash, so it cannot decouple the signature from the judged ballot. `convene`/`run-panel`/`panel.test` migrated to the content interface (the per-validator invoker is wrapped in a `deliberate` closure that builds the prompt and parses on the validator side).
- New regression test pins it: *the signer derives the ballot hash from the content it judged — no caller-supplied hash to spoof.*

Suite: **136 tests, all green.**

## V1 (Claude) — findings (SOUND, with operating-condition notes)

V1 voted SOUND but recorded non-blocking tradeoffs/operating conditions, not unclosed items:
1. The canonical Identity carries only `{id, slot}` — a *composition* key, not the full *lineage* record (#3's five-dimension provenance lives on the CIP-7 Validator). Defensible separation; the name should not be read as "carries all provenance."
2. **NI-1 full-vector strictness (tradeoff):** "share ANY dimension merges" means a deployment where every validator runs the same serving stack counts as ONE family and never reaches the ≥4 floor (permanent FREEZE). Arguably the correct reading of NI-1 (serving-layer diversity is required), but §5.7 should acknowledge it as an operating constraint.
3. **NI-10a:** the standard-only verdict is *stronger* than "never decisive" (a thin seat has zero verdict influence whenever a standard seat exists); the thin seat's dissent must remain recorded in the signed log so an advisory dissent stays auditable.
4. **2/3-in-ratify operating condition:** the denominator is `|keyring|`, so the keyring passed to `ratify` must be the STANDING set — a probation member (zero quorum weight, NI-3) must never appear in it. The live wiring satisfies this today.

## V3 (Hermes) — findings (SOUND)

V3 reasoned through each fix against CIP intent and found intent and check aligned in all six (identity eliminates a gap rather than adding one; NI-1 connected-components never over-counts independence; NI-10a is structural exclusion not weighting; bond binding rejects mismatched resolutions; 2/3 enforced structurally). It judged both deferrals transparent and non-fatal to a local/sound judgment.

## Status after round 45

- **Closed and panel-verified:** round-44 items #1, #3, #4, #5, #7 (fully) and #2 (protocol/type boundary) — plus the round-45 signer **binding** hardening from V2's dissent.
- **Outstanding:** #2's OS-level key custody (RemoteSigner) and #6 on-chain module state — both genuinely testnet/substrate-gated, the natural subject of a later round.
