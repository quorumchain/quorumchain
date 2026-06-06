# RE-RATIFY the folded CIP-15 spec — your prior red-team (ballot 54830138) voted 3/3 NO and named 5 flaws; confirm they are CLOSED, or NO if a fold is incomplete/wrong. The 5 folds: (a) surfacedAt FORGERY [NI-15f] — a CREDITED anchor's surfacedAt MUST equal its own verifiable native timestamp (Chainlink OCR round time / Pyth VAA publish time / chain-inclusion / OpenTimestamps / RFC-3161); a self-asserted-only surfacedAt is recorded but can NEVER satisfy the monotonicity/re-adjudication trigger. (c) anchorCommitment CANONICALIZATION [NI-15e] — canonical(anchors) = deterministic JSON over anchors sorted by contentHash, each reduced to {contentHash,citedAssertion,anchorType,issuer}, duplicate contentHash REJECTED (not merged), strings NFC-normalized UTF-8, absent optionals OMITTED never null; append-domain separation so a legacy no-anchor hash stays byte-stable and a CIP-14 typed-only ballot can't collide with a typed+anchored one. (b) INDEPENDENCE PREDICATE + liveness [NI-15g] — an anchor credits an independent family ONLY if its provenanceTrace verifies to a trace root AND that root is distinct from every other credited anchor's root; verified-shared-root collapses to one family; asserted-only credits zero; liveness posture stated: a claim reducing to one verifiable family stays content-pending (halt-over-degrade), RESOLVED reachable only with >=requiredFamilies verifiable-distinct-root anchors. (d)+(e) PROMOTION LEAKAGE [NI-15b, re-cut as ENFORCED] — per steward decision, a structural pass is ADMIT-TO-REVIEW-ONLY with ZERO authoritative side effects: it does NOT move the lineage head, change standing, reorder the published Commons, or dequeue from reviewQueue. The gate SPLIT into reviewAdmissible() (structural, side-effect-free) and promotable() (head authority); an empirical/settled head moves ONLY at anchorState=CONTENT_CONFIRMED (deferred testnet), NORMATIVE still promotes on ratification. Pre-testnet, no empirical head moves on a structural pass. Are all 5 closed and the spec now sound to implement under TDD?

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `085efcfcf9b57bec0f9918dda24a99e1fbee48b1939dc985b9dc5bd26d319eaa`

## Stances (the epistemic state — not a single truth)

- **YES** — CONSENSUS · held by V1, V2, V3 · panel votes: 3 · support: not externally anchored

## Adversarial review (CIP-10 auditor)

auditor: **V2** · contrary-evidence weight: **NEGLIGIBLE** — retrospective audit (Construction A) — produced after vote.

### Searched, rejected (suppression audit-trail, NI-AA8)

- src/anchor.ts:127-160: rejected — Primary implementation rejects absent, self-asserted, unimplemented, tampered, or pre-head timestamp proofs; credited surfacedAt is set only from verified ED25519_TSA proof time, so no credited self-asserted surfacedAt path was anchored.
- test/cip15-anchor.test.ts:87-96: rejected — Primary test anchor explicitly covers NI-15f: self-asserted-only and unimplemented OTS timestamps are not credited, and tampered timestamp time fails signature verification.
- src/anchor.ts:95-105: rejected — Primary implementation canonicalizes anchors deterministically by reduced four-field objects sorted by contentHash, NFC-normalizes citedAssertion, rejects duplicate contentHash, and forbids empty commitments; no collision/merge contrary anchor found.
- src/signed-vote.ts:69-75: rejected — Primary implementation composes CIP-14 and CIP-15 via distinct JSON keys with optional omission, preserving legacy no-anchor hashes while separating type-only, anchor-only, and typed+anchored preimages.
- test/cip15-binding.test.ts:38-60: rejected — Primary tests cover order independence, NFC stability, duplicate rejection, legacy byte stability, CIP-14 stability, and typed-only vs anchored/both noncollision. Two later binding tests could not execute in this read-only sandbox because mkdtemp was denied, but the failure was EPERM, not behavioral.
- src/anchor.ts:148-172: rejected — Primary implementation credits families only after full structural checks and counts distinct pinned issuer origins among credited anchors; same-origin inflation collapses. The code uses the pinned issuer origin as the Tier-1 verified root, so asserted provenanceTrace does not inflate credit.
- test/cip15-anchor.test.ts:108-120: rejected — Primary tests show two distinct issuer roots satisfy requiredFamilies>=2, same issuer/root collapses to one, one family fails empirical admission, and normative remains zero-family reachable.
- src/commons.ts:346-382: rejected — Primary implementation splits reviewAdmissible from promotable; only promotable moves lineage.current, and empirical/settled promotion requires contentConfirmed while normative promotes on ratification.
- test/cip15-lineage.test.ts:53-141: rejected — Primary tests cover structural-only empirical supersede becoming pendingReview with head unchanged, promotion only after contentConfirmed, insufficient-family non-admission, normative ratification promotion, honest pending render, and safe no-policy default.
- src/commons.ts:430-447: rejected — Primary reviewQueue filters only current EMPIRICAL_LIVE heads; because structural-only supersedes do not become lineage.current, no dequeue/head-leakage path was anchored.
- src/commons-render.ts:94-101: rejected — Primary render path labels structural-only supersedes as pending content verification and states the current verdict has not changed. The generic index still renders each ratified ballot's own status, but no anchor showed that this changes lineage authority or standing.

### Falsification conditions (what anchored evidence would warrant re-adjudication)

- toward **NO**: A primary spec, implementation path, or passing test showing a CREDITED anchor can satisfy monotonicity using proposer-supplied surfacedAt or an otherwise unverified/native-timestamp-free anchor.
- toward **NO**: A primary canonicalization counterexample showing duplicate contentHash merge, null/optional ambiguity, non-deterministic anchor ordering, Unicode non-normalization, legacy hash drift, or CIP-14 typed-only collision with typed+anchored ballots.
- toward **NO**: A primary implementation/test showing asserted-only provenanceTrace increases credited family count, shared verified roots count as multiple families, or realistic distinct-root anchors cannot reach requiredFamilies>=2.
- toward **NO**: A primary consumer path where reviewAdmissible rather than promotable moves lineage.current, changes standing, reorders Commons authority, dequeues reviewQueue, or otherwise presents a structural-only empirical supersede as the operative resolved head.

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
