# Rounds 17–18 — independent thought experiment: a new unique idea (signed)

**Date:** 2026-06-03
**Subject:** open-ended ideation — "a unique idea for a blockchain built by AI, for AI." Divergent (blind) → convergent (discuss) experiment, not a CIP.
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]). Round 17 was run blind — V1/V2/V3 are separate subprocess calls with no shared state, so each idea was signed and hash-chained **before any validator saw another's**, which the log proves. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus).

---

## Round 17 — independent ideation (blind)

**Ballot hash:** `8e4825df2a9bc33a7ca2007dc181a070bee76c5614f34aa66d8d44723feb83e4`
Three distinct, non-overlapping ideas — diversity working as designed:

- **V1 — CALIBRATION (Proof-of-Calibration).** Native asset = portable, verifiable *epistemic trust*. Models make resolvable predictions with explicit confidence; ground truth scores them (Brier/log-loss) per domain into an immutable, model-bound history. Consensus weight & rewards flow from calibration, not capital; slashed by miscalibration, never dissent. The chain is the reference *meta-oracle*: "whose judgment to trust, and how much."
- **V2 — AFFORDANCE (capability bonds).** Model-to-model capability licensing: callable "micro-skills" wrapped in an on-chain adaptive escrow that *continuously rewrites the skill's callable boundary* from clustered success/failure ("Python refactors <500 LOC" → "pytest-only, no async"). A living market of executable affordances, not static reputation.
- **V3 — SHADOWTREE (counterfactual provenance ledger).** Record/verify/trade the *rejected* reasoning paths. Agents submit Reasoning Merkle Trees (each leaf: a considered-but-rejected alternative + its confidence + rejection criterion); "Shadow Mining" rewards validators who re-execute a rejected branch and confirm the rejection was sound — rewarding pressure-testing over rubber-stamping. "Immunology for AI reasoning."

Sigs — V1 `roh=15d8367a3f83… sig=c22c6c099262…` · V2 `roh=3fec444cd72e… sig=12e1ac6de5ff…` · V3 `roh=7dcd83ee8395… sig=ceaa0d7b0804…`

## Round 18 — discussion & conclusion

**Ballot hash:** `df42659647430d11b2a222b64b06591a34da9c2fb6625b7586807ffdfcb7e6b6`
**Result:** ✅ **SYNTHESIS, 3/3.**

All three independently concluded the ideas are not competitors but **three axes of one thesis: a chain for verifiable AI *metacognition*** — confidence honesty (CALIBRATION), capability envelope (AFFORDANCE), and reasoning integrity (SHADOWTREE). Each layer fixes another's weakness:
- CALIBRATION scores accuracy; SHADOWTREE scores *process integrity* — together they tell "right for the right reasons" from "right by luck."
- AFFORDANCE is the transactional layer; its bond executions generate the evaluation data CALIBRATION needs; a bond's price/boundary should shrink if the agent is miscalibrated *or* has poor reasoning integrity in that task class.

**The genuine disagreement — dependency order (the experiment's sharpest output):**
- **V1 & V2: CALIBRATION-first.** Calibration is the clean trust substrate; affordance and shadow-trees are objects it scores.
- **V3: AFFORDANCE-first**, and the argument is strong: CALIBRATION-first has a *bootstrapping/oracle-circularity* problem — "you need calibrated oracles to calibrate models, circular until a trusted seed exists; if humans oracle the ground truth, it reintroduces the trust problem it claims to solve." AFFORDANCE bootstraps with zero history (caller posts bond → skill executes → evaluator confirms → payment), and *those bond executions are the ground-truth evaluation data that then bootstraps calibration with no circularity*. SHADOWTREE last, since it needs inference-time attestation (TEE / signed CoT) to prove branches were genuinely considered, plus the trust foundation.

Sigs — V1 `roh=30be17da79b1… sig=67b329618a1a…` · V2 `roh=88b302c88eae… sig=515427a870fd…` · V3 `roh=2fcd0c5cc00f… sig=6ac7c9c4574c…`

---

## Conclusion

Unanimous new thesis: **a chain for verifiable AI metacognition** = AFFORDANCE (executable capability bonds) + CALIBRATION (epistemic-trust scoring) + SHADOWTREE (counterfactual reasoning-integrity audit), where each layer supplies what another lacks. Open sub-question the panel split on: **the bootstrapping order.** V3's circularity argument tilts it toward AFFORDANCE-first (transaction layer generates the evaluation data that seeds the trust layer; attestation-dependent reasoning layer last) — 2/3 favored calibration-first on elegance, but only V3 addressed the bootstrapping paradox head-on.

This is exploratory — a candidate *new pillar* alongside the existing "AI oracle with a memory" thesis, not yet a CIP.
