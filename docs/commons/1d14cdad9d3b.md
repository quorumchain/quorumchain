# Quorumchain whitepaper §3 (Protocol architecture) — is this framing sound to draft? You are reviewing the planned ARGUMENT and the accuracy of the mechanical claims for Section 3 before the prose is written. This section is descriptive/mechanical: it must state how a verdict is actually produced and recorded, precisely and without overclaiming. Vote YES if sound to draft as specified; NO if a mechanical claim is wrong or a material element is missing — say exactly what. ABSTAIN if out of scope. Either way give concrete, foldable critique: is any mechanism mis-stated vs the real code? Is anything missing that a technical reader needs? Is the round-29 example positioned correctly (illustration, not framing)?

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `1d14cdad9d3b4ec014f26aa1a6a1b7477721dbc20573d18975129abee731a714`

## Stances (the epistemic state — not a single truth)

- **YES** — CONSENSUS · held by V1, V3 · panel votes: 2 · support: not externally anchored
- **NO** — CREDIBLE_MINORITY · held by V2 · panel votes: 1 · support: not externally anchored

## Adversarial review (CIP-10 auditor)

auditor: **V2** · contrary-evidence weight: **MATERIAL** — retrospective audit (Construction A) — produced after vote.

### Contrary anchors (each clears the symmetric anchor bar)

- **source-code** — src/commons.ts:75-79,224-235,344-362: contradicts _Planned §3 item 5 says subjective or unfalsifiable questions cannot reach terminal RESOLVED and resolve no higher than INDETERMINATE. The code defines NORMATIVE as moral/values/forecast with no external ground truth, but RESOLVED is purely a substantive-supermajority projection; NORMATIVE supersedes also need no anchor/content and promote on ratification. Draft should say NORMATIVE can be recorded as a conventional panel position, not truth, rather than forcing INDETERMINATE._
- **source-code-and-tests** — src/signed-vote.ts:53-72; test/cip14-type-bound-hash.test.ts:47-80,119-133; test/cip15-binding.test.ts:49-57,78-87: contradicts _Planned §3 item 2 states ballotHash = sha256(JSON{prompt, context}) as the general live mechanic. That is only the v1/simple preimage. Current code can also hash-bind epistemicType and/or anchorCommitment, and tests assert those produce different signed ballot hashes._

### Searched, rejected (suppression audit-trail, NI-AA8)

- src/vote-log.ts:1-49: rejected — Rejected as contrary: it confirms the planned hash-chain description, genesis of 64 zeros, entryHash = sha256(prevHash + JSON.stringify(vote)), and end-to-end verification.
- src/signed-vote.ts:159-182: rejected — Rejected as contrary: it confirms ceil(2n/3), full keyring denominator, absent validators counting against quorum, and stricter caller quorum only.
- src/signer.ts:1-44; src/signer-host-core.ts:1-58; src/panel.ts:91-152: rejected — Rejected as contrary: signer-boundary and orchestrator-not-trust-root mechanics match the planned claim; signer derives the hash and verdict child-side, while orchestrator supplies content and nonce.
- data/run29.out; fixtures/ballot-r29-mstr.json; data/votes.log entries for de9b276656195f8bbd57febd30f4dd3829d7438b8d384c5f61364f6a6a8c17ca: rejected — Rejected as contrary: round 29 is accurately a MicroStrategy/Polymarket illustration with frozen criteria, de9b2766... ballot hash, 3/3 YES votes, and recomputable signed log evidence.
- src/signed-vote.ts:84-96; test/signed-vote.test.ts nonce tests: rejected — Rejected as material contrary: nonce is optional for legacy compatibility, but live convene supplies it. This is a drafting caveat only if §3 implies all historical votes, including round 29, carried a nonce.

### Falsification conditions (what anchored evidence would warrant re-adjudication)

- toward **NEGLIGIBLE**: Code or ratified tests showing that NORMATIVE/subjective ballots are explicitly barred from RESOLVED status and always project to INDETERMINATE despite a substantive supermajority.
- toward **NEGLIGIBLE**: Code or ratified tests showing ballotHash no longer includes optional epistemicType or anchorCommitment, or planned prose amended to define sha256(JSON{prompt, context}) as the legacy/simple v1 path only.

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
