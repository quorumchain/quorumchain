# Round 60 — CIP-10 correlated-error defense (ADOPT 2/3; refuter role amended by unanimous convergence)

**Date:** 2026-06-04
**Type:** New improvement proposal — a forward-looking defense against correlated
hallucination, prompted by an external critique of the model-diversity security premise.
Design ruling (ADOPT / REVISE / REJECT), not a code review.
**Method:** Live convening, no human in the loop. V1 (`claude -p`), V2 (codex), V3
(hermes) each read the neutral brief (problem framing + three-part mechanism + the
honest counterarguments) and signed child-side.
**Ballot hash:** `ae4abf0b8a7824d68f2724531d84e1610f3a396b41ec4b8391fcb34fafb3ba0d`
**Result:** **ADOPT — 2/3** (`{ADOPT:2, REVISE:1}`). Chain valid at **171 entries**, log entry 171.
- V2 **ADOPT** · V3 **ADOPT** · V1 **REVISE**.

---

## The threat (all three accepted the framing)

Quorumchain's security rests on the claim that validator errors are uncorrelated because
the models come from different vendors. For one error class this is false: V1/V2/V3 are
trained on largely overlapping corpora, so a misconception pervasive in that corpus can be
confidently and **identically** reproduced by all three. A 3/3 shared hallucination is
signature-indistinguishable from a 3/3 verified truth. V1: "the one critique that actually
bites." V3: "corpus overlap is a structural fact, not a contingent bug."

This does **not** threaten the panel's current job — validating its own code/design, where
the ground truth *is* the source every validator reads directly (the source is the
anchor). It threatens any FUTURE use as a **recall oracle** over facts the panel must
recall rather than read. CIP-9 already *contains* this (records "N/N agreed", not "true";
NI-9b accrues reputation only from external anchors, never agreement). CIP-10 adds active
defense before that future use is ever enabled.

## What was ADOPTED

**Part 1 — anchor-gated RESOLVED (adopted as-is).** A ballot may reach status RESOLVED only
if it carries an external verifiable anchor (an on-chain value, signed feed, citable
document) the verdict is checked against. An unanchored ballot, however unanimous, resolves
no higher than INDETERMINATE. All three judged this the **structural opposite of an edit
key**: it restricts only *upward* — it cannot decree truth, only decline to. V1: "for a
trust-minimized oracle, INDETERMINATE-by-default is exactly right." V3: "a recall-only
oracle without anchors is epistemically indistinguishable from confident noise."

**Part 3 — correlation-measurement probes (adopted, with a labeling requirement).**
Periodic known-answer probe ballots log the rate at which all three agree AND are all
wrong — a direct, measured estimate of the shared-error floor, converting an assumption
into a number that bounds what the oracle may be trusted for. **Folded requirement (V1,
V2, V3 all stated it):** the read surface MUST label this a *probe-distribution estimate
with its methodology/scope*, never a universal guarantee. A measured floor published with
its methodology strictly dominates an unexamined assumption.

## The amendment — Part 2 refuter role (the substance of V1's REVISE, echoed by both ADOPTs)

The proposal's instinct — break the symmetry of asking the same question the same way three
times — was judged the strongest of the three ideas. But as *written* ("one validator's
task is to find the strongest case the proposition is FALSE") it most naturally reads as
**overwriting that validator's signed vote with an adversarial one**. That corrupts the 2/3
denominator: a signature would no longer mean "this validator believes X," but "this
validator was assigned to disbelieve X" — a recorded, rotating thumb on the scale. Not a
truth-decree, but a violation of the same record-honesty principle from the other side.

All three converged on the same fix from independent angles:
- **V1:** separate the *role* from the *vote*. The rotating validator produces a recorded
  adversarial-refutation **artifact** (the strongest false-case), which becomes an *input*
  to every validator's deliberation — but each signed verdict remains that validator's
  honest belief. De-correlating benefit without polluting the consensus arithmetic.
- **V3:** the refuter must receive **no directional instruction** (a forced "argue against
  P" manufactures contrarian noise it doesn't hold); its role tag describes *method*
  (tasked with seeking disconfirming evidence), not *conclusion*. "Analogous to a court
  appointing an amicus — so long as the role is about method, not conclusion."
- **V2:** "the vote should distinguish role-conditioned reasoning from final status."

**Ratified form of Part 2:** a recorded, rotating validator is tasked — by *method*, never
by *conclusion* — to surface the strongest disconfirming case as an auditable artifact that
feeds all three validators' deliberation; every validator's signed verdict remains its
honest belief, so the supermajority arithmetic stays clean.

## CIP-9 invariant check (all three ran it; all three passed it)

No edit key is created; no validator overrides another; no truth is decreed. Parts 1–3 add
constraints on *escalation* (anchor-gating), *method* (refuter artifact), and *measurement*
(probes) — all consistent with "record bounded validation evidence, not decree truth."

## Status — ratified direction; implementation deferred to use

CIP-10 is the binding direction. Its mechanisms bite only when the panel is used as a
**recall oracle**, which is not the current job (code/design validation, where source is the
anchor). Implementation therefore follows the normal spec → plan → build cycle **when the
recall-oracle surface is first approached**, carrying the amended Part 2 and the Part 3
labeling requirement as ratified here. No code lands this round.

---

**Standing lesson, sharpened:** the panel adopted a defense against its own deepest
blind spot — and the strongest evidence it worked is that the defense's own weakest part
(a refuter role that could have re-introduced bias) was caught by *all three* validators,
including the two who voted to adopt. A 2/3 ADOPT that still unanimously names and fixes
the one flaw in the thing it's adopting is the diversity premise defending the very
mechanism meant to shore it up.
