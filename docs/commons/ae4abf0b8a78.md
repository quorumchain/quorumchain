# CIP-10 (Correlated-error defense): to protect against correlated hallucinations across the three validators (shared training corpus -> identical confident errors -> a 3/3 consensus indistinguishable from verified truth), should Quorumchain adopt (1) anchor-gated RESOLVED — a ballot with no external verifiable anchor may resolve no higher than INDETERMINATE; (2) a recorded, rotating adversarial REFUTER role for one validator per ballot; and (3) periodic known-answer PROBE ballots that log a measured shared-error rate to bound what the oracle may be trusted for — all without re-introducing any editorial/truth-decree power the CIP-9 invariants forbid?

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `ae4abf0b8a7824d68f2724531d84e1610f3a396b41ec4b8391fcb34fafb3ba0d`

## Stances (the epistemic state — not a single truth)

- **REVISE** — CREDIBLE_MINORITY · held by V1 · panel votes: 1 · support: not externally anchored
- **ADOPT** — CONSENSUS · held by V2, V3 · panel votes: 2 · support: not externally anchored

## Adversarial review (CIP-10 auditor)

auditor: **V3** · contrary-evidence weight: **WEAK** — retrospective audit (Construction A) — produced after vote.

### Contrary anchors (each clears the symmetric anchor bar)

- **peer-reviewed empirical studies** — arXiv:2507.13874v1; OpenReview QmHT6f5txa: contradicts _Mechanism 2: Assigning an explicit adversarial 'refuter' role to an LLM reliably surfaces counter-evidence without degrading output integrity._
- **methodological consensus** — Standard ML evaluation literature (covariate shift / probe generalization bounds): contradicts _Mechanism 3: A measured shared-error rate on known-answer PROBE ballots reliably bounds the shared-error floor for live, novel oracle queries._

### Searched, rejected (suppression audit-trail, NI-AA8)

- Hypothesis: Multi-model consensus is mathematically indistinguishable from shared hallucination due to near-total training corpus overlap.: rejected — Rejected by Council Mode (arXiv:2604.02923v3), which empirically demonstrates that even with strong pairwise error correlation (ρ=0.32–0.38), heterogeneous 3-model consensus significantly reduces hallucination rates (16.7% → 10.7%, p<0.01) and improves truthfulness. Correlated errors exist but are not perfectly correlated (monoculture ≠ perfect overlap).
- Hypothesis: Anchor-gated resolution makes the oracle useless, creating a chicken-and-egg problem where nothing novel can be RESOLVED.: rejected — The claim explicitly limits the threat to the panel acting as a 'recall oracle' over external facts. For verification of facts, anchors are the definition of truth. The CIP-10 proposal correctly demotes un-anchored recall to INDETERMINATE rather than FALSE, preserving the panel's ability to reason about code/design where the repo itself is the anchor.
- Hypothesis: Adversarial role-play universally backfires, inducing structured hallucinations or toxic overcorrection.: rejected — Backfire effects are documented primarily on subjective, creative, or low-ground-truth tasks (OpenReview QmHT6f5txa). For factual recall and red-teaming, adversarial prompting is a validated technique that improves robustness. The risk is domain-dependent, requiring prompt engineering guards rather than rejecting the mechanism.

### Falsification conditions (what anchored evidence would warrant re-adjudication)

- toward **REJECT mechanism 2 (Refuter role)**: Empirical evidence that rotating adversarial 'refuter' roles systematically INCREASE the joint-hallucination rate across all three heterogeneous validators compared to neutral prompting on factual recall tasks.
- toward **REJECT mechanism 3 (Probes)**: Demonstration that shared-error rates on known-answer probe domains have zero or negative correlation with shared-error rates on live, novel oracle queries, making the probe metric actively misleading rather than conservatively bounding.
- toward **REJECT premise of CIP-10**: Evidence that RLHF/constitutional alignment forces heterogeneous models into 100% correlated error distributions on factual recall, negating the independence gains of vendor diversity.

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
