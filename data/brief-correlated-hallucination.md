You are deliberating a proposed new improvement proposal — CIP-10, "Correlated-error
defense" — prompted by an external critique of Quorumchain's security premise. Vote
ADOPT (accept the proposal as the binding direction), REVISE (accept the problem framing
but a named part of the mechanism is wrong — say which and how), or REJECT (the premise
or the mechanism is unsound — say why). Reason from the architecture; do not defer.

## The problem

Quorumchain's security rests on model diversity: a 2/3 supermajority across Anthropic
(V1), OpenAI (V2), and Nous/open-weight (V3) is assumed to make validator ERRORS
uncorrelated, the way independent hardware failures are. The critique argues this
assumption is false for one error class: all three are trained on largely overlapping
internet corpora, so a misconception pervasive in that corpus can be confidently and
IDENTICALLY reproduced by all three. A 3/3 consensus on a shared hallucination is then
indistinguishable, at the signature layer, from a 3/3 consensus on a verified truth.
Vendor diversity is not distributional independence.

This does NOT threaten the chain's CURRENT job — validating its own code/design, where
the "ground truth" is the source itself, which every validator reads directly. It
threatens any FUTURE use of the panel as an oracle over facts it must RECALL rather than
read (real-world events, external claims). The CIP-9 read surface already refuses to
launder agreement into truth (it records "N/N agreed", not "true"; NI-9b accrues
reputation only from external anchors, never from agreement). That is containment. The
question is whether to add active defense before the panel is ever trusted as a recall
oracle.

## The proposed mechanism (three parts — you may ADOPT/REVISE/REJECT each on its merits)

1. **Anchor-gated RESOLVED.** The panel may return status RESOLVED only on a ballot that
   carries an EXTERNAL ANCHOR — a verifiable source the verdict is checked against (an
   on-chain value, a signed feed, a citable document). A ballot with no anchor, however
   unanimous, may resolve no higher than INDETERMINATE (recorded epistemic state, not a
   decree). This makes recall-only unanimity structurally unable to mint a RESOLVED claim.

2. **Methodological diversity (refuter role).** Instead of asking all three validators the
   same question the same way, one validator per ballot is assigned an adversarial REFUTER
   role: its task is to find the strongest case the proposition is FALSE. Correlated
   priors that survive an explicit refutation attempt are weaker evidence of shared
   hallucination than three identical confirmations. The role assignment is recorded so it
   is auditable and rotates.

3. **Correlation measurement (probes).** Periodically convene known-answer PROBE ballots
   (questions with a verifiable ground truth the validators are not told). The rate at
   which all three agree AND are all wrong is a direct, logged estimate of the shared-error
   floor. This converts "we assume errors are uncorrelated" into a measured number that
   bounds what the oracle may be trusted for, and surfaces in the read surface.

## Counterarguments to weigh honestly

- Anchor-gating narrows the oracle to questions that already have a checkable source —
  arguably it can then only confirm what is already verifiable, reducing its value-add.
  Is INDETERMINATE-by-default too conservative, or exactly right for a trust-minimized
  system?
- The refuter role injects a deliberate bias into one validator's vote; does that corrupt
  the honesty of the signed verdict, or is a recorded-and-rotated role a legitimate
  method rather than a thumb on the scale?
- Probe ballots cost inference and only estimate correlation on the probe distribution,
  which may not match the live question distribution. Is a biased estimate better than
  none?
- Does any part of this re-introduce an editorial/truth-decree power the CIP-9 invariants
  (NI-9a/b/c, no edit key) were built to forbid?

Vote ADOPT / REVISE / REJECT with reasoning. If REVISE, name the part and the fix. The
goal is a defense proportionate to the threat without betraying the record-not-decree
principle.
