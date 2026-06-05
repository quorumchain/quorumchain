# RE-RATIFY the folded CIP-15 spec — your prior red-team (ballot 54830138) voted 3/3 NO and named 5 flaws; confirm they are CLOSED, or NO if a fold is incomplete/wrong. The 5 folds: (a) surfacedAt FORGERY [NI-15f] — a CREDITED anchor's surfacedAt MUST equal its own verifiable native timestamp (Chainlink OCR round time / Pyth VAA publish time / chain-inclusion / OpenTimestamps / RFC-3161); a self-asserted-only surfacedAt is recorded but can NEVER satisfy the monotonicity/re-adjudication trigger. (c) anchorCommitment CANONICALIZATION [NI-15e] — canonical(anchors) = deterministic JSON over anchors sorted by contentHash, each reduced to {contentHash,citedAssertion,anchorType,issuer}, duplicate contentHash REJECTED (not merged), strings NFC-normalized UTF-8, absent optionals OMITTED never null; append-domain separation so a legacy no-anchor hash stays byte-stable and a CIP-14 typed-only ballot can't collide with a typed+anchored one. (b) INDEPENDENCE PREDICATE + liveness [NI-15g] — an anchor credits an independent family ONLY if its provenanceTrace verifies to a trace root AND that root is distinct from every other credited anchor's root; verified-shared-root collapses to one family; asserted-only credits zero; liveness posture stated: a claim reducing to one verifiable family stays content-pending (halt-over-degrade), RESOLVED reachable only with >=requiredFamilies verifiable-distinct-root anchors. (d)+(e) PROMOTION LEAKAGE [NI-15b, re-cut as ENFORCED] — per steward decision, a structural pass is ADMIT-TO-REVIEW-ONLY with ZERO authoritative side effects: it does NOT move the lineage head, change standing, reorder the published Commons, or dequeue from reviewQueue. The gate SPLIT into reviewAdmissible() (structural, side-effect-free) and promotable() (head authority); an empirical/settled head moves ONLY at anchorState=CONTENT_CONFIRMED (deferred testnet), NORMATIVE still promotes on ratification. Pre-testnet, no empirical head moves on a structural pass. Are all 5 closed and the spec now sound to implement under TDD?

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `085efcfcf9b57bec0f9918dda24a99e1fbee48b1939dc985b9dc5bd26d319eaa`

## Stances (the epistemic state — not a single truth)

- **YES** — CONSENSUS · held by V1, V2, V3 · panel votes: 3 · support: not externally anchored

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
