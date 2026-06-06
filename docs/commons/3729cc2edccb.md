# RATIFICATION VOTE. This is the AMENDED CIP-13, after a prior red-team (ballot c5439212) returned FAILS 2/3 (V1, V2 FAILS; V3 HOLDS). The two material flaws have been folded:

(1) V1's flaw — NI-13e advertised "no burying a claim by re-typing it" but did not enforce it (a supersede could clear the anchor bar on substance while silently carrying a different epistemicType). FOLDED as NI-13h: epistemic type is INVARIANT across a supersession lineage; a type mismatch is rejected at admission even with a valid anchor; a type change must be a CIP-5 fork or a v0.3 panel-ratified sub-claim, never a ride-along.

(2) V2's flaw — the anchor gate (NI-13e) was deferred to v0.2 while v0.1 shipped the supersede lineage + "current = latest by log order", leaving one version where any later ballot becomes current before the gate exists. FOLDED: the anchor gate is now a v0.1 admission/projection-validity rule (a supersede is not promoted to current unless it passes the anchor check AND the type-invariance check); and the competing-successor head rule is now explicit (latest valid successor in log order is the stated adjudicated convention; divergence forks per CIP-5), not a silent tie-break.

Vote RATIFY if the amended draft is now sound to adopt as the binding direction; vote REJECT if a material flaw remains — and name it exactly. Do not rubber-stamp: verify the two folds actually close the prior findings and introduce no new gap. The FULL AMENDED DRAFT follows verbatim.

=====================================================================

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `3729cc2edccbd3c236458cb4114af71504c8830fa6848215d23b975ef70aef95`

## Stances (the epistemic state — not a single truth)

- **RATIFY** — CONSENSUS · held by V1, V2, V3 · panel votes: 3 · support: not externally anchored

## Adversarial review (CIP-10 auditor)

auditor: **V2** · contrary-evidence weight: **NEGLIGIBLE** — retrospective audit (Construction A) — produced after vote.

### Searched, rejected (suppression audit-trail, NI-AA8)

- src/commons.ts: lineage pass reviewAdmissible/promotable: rejected — Checked for the prior V2 sequencing flaw. The projection does not promote a supersede unless it is ratified, type-consistent, and anchor-gated; prior stays current when the gate fails.
- src/commons.ts: NI-13h typeOf(s) !== typeOf(head) guard: rejected — Checked for the prior V1 re-type ride-along flaw. Type mismatch prevents promotion even where other gate conditions could pass.
- test/commons-cip13.test.ts: G13d/NI-13h tests: rejected — Tests explicitly cover no-anchor non-promotion, different-type non-promotion, and matching-type valid promotion.
- test/commons-cip13.test.ts: G13h test: rejected — Checked for silent competing-successor ambiguity. Test anchors the stated convention: latest valid successor in log order becomes current.
- src/anchor.ts and test/cip15-anchor.test.ts: rejected — Later CIP-15 anchor verifier is stricter than CIP-13's draft-level anchor gate, not a contradiction: it structurally verifies anchor provenance and still does not move the head without content confirmation.
- src/signed-vote.ts and src/ballot-registry.ts: rejected — Checked for hash/signature binding gaps around epistemicType. CIP-14/CIP-15 add optional hash binding for type and anchor commitments; this is a downstream hardening path, not anchored evidence that the amended CIP-13 direction remains unsound.

### Falsification conditions (what anchored evidence would warrant re-adjudication)

- toward **REJECT**: Primary protocol text or implementation showing a superseding SETTLED/EMPIRICAL_LIVE ballot can become lineage.current in v0.1 without passing an external-anchor gate.
- toward **REJECT**: Primary protocol text or implementation showing a superseding ballot with a different epistemicType from its predecessor can be promoted within the same lineage.
- toward **REJECT**: Primary protocol text or implementation showing competing valid successors are resolved by an unstated or nondeterministic tie-break rather than the explicit latest-valid-successor log-order convention or a CIP-5 fork.

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
