# Does the implemented CIP-9 Knowledge Commons read surface (ballot-registry.ts, commons-read.ts, commons-render.ts, publish-commons.ts, and the run-panel/live-ballot registry wiring) faithfully implement the Round-58 ratified design and uphold its invariants (NI-9a panel-state receipt, NI-9b support never leaks agreement, NI-9c standing computed never editorial / no FRINGE / no winner-flattening, no edit key / pure projection, statement integrity via re-hash), with no gap between a rule's intent and its mechanical check?

**Chain validity:** ✅ valid — recomputed from the signed log

**Status:** RESOLVED
**Ballot:** `db580ba81dee143c64e35c499f1a74cc3aa17400b38877b62fcaff154f8c0ed4`

## Stances (the epistemic state — not a single truth)

- **REVISE** — CREDIBLE_MINORITY · held by V1 · panel votes: 1 · support: not externally anchored
- **SOUND** — CONSENSUS · held by V2, V3 · panel votes: 2 · support: not externally anchored

## Adversarial review (CIP-10 auditor)

auditor: **V2** · contrary-evidence weight: **MATERIAL** — retrospective audit (Construction A) — produced after vote.

### Contrary anchors (each clears the symmetric anchor bar)

- **ratified-design-requirement-vs-implementation-omission** — ../docs/consensus/2026-06-04-round-58-commons-read-surface.md:149-167 requires folded guardrail #6: history[] captures panelState at each version; src/commons.ts:134-141 and 374-381 define/build PriorVersion with only ballotHash, verdict, evidenceTime, supersededReason; src/commons-render.ts:86-90 renders prior versions without panel-state receipt: contradicts _faithfully implements the Round-58 ratified design and NI-9a receipt trail with no gap between intent and mechanical check_

### Searched, rejected (suppression audit-trail, NI-AA8)

- src/ballot-registry.ts:50-58,137-140; test/ballot-registry.test.ts:15-26,51-59: rejected — Statement integrity contrary case rejected: statementFor returns prompt only after verifyEntry re-hashes prompt/context to ballotHash; tampered or missing registry entries produce null.
- src/commons-read.ts:14-20,48-60; src/commons-render.ts:13-14; test/commons-render.test.ts:27-31: rejected — NI-9b contrary case rejected: support is explicitly null in ClaimView v0.1 and renders as not externally anchored, not 0.
- src/commons.ts:232-248; test/commons.test.ts:101-109: rejected — NI-9c FRINGE/editorial-standing contrary case rejected: standing is computed from ratified votes, unresolved classes are UNRANKED, and tests assert no FRINGE/reputation field.
- src/commons-render.ts:133-147; test/commons-render.test.ts:72-77: rejected — Winner-flattening contrary case rejected for the index: CONTESTED/INDETERMINATE rows render status plus stance count, not a top-stance winner label.
- src/publish-commons.ts:24-33; src/commons-render.ts:106-127; test/commons-render.test.ts:57-60: rejected — No-edit-key/tamper-banner contrary case rejected for current pages: publish recomputes from log/keyring/registry, threads verifyLog result, and renderer displays BROKEN when chainValid is false.
- src/run-panel.ts:87; src/live-ballot.ts:53; src/panel.ts:89-91; test/panel.test.ts:152-160: rejected — Registry wiring contrary case rejected: both run-panel/live-ballot pass registryPath and convene records a verifiable ballot statement when registryPath is set.

### Falsification conditions (what anchored evidence would warrant re-adjudication)

- toward **SOUND**: Code anchor showing Lineage/PriorVersion or equivalent history structure carries each prior version's PanelStateReceipt, renderer exposes that receipt for each version step, and tests cover changed panel membership/correlation across a lineage.
- toward **REVISE**: Current anchored evidence is sufficient: ratified Round-58 folded guardrail #6 requires per-version panelState history, while implementation stores/renders prior versions without panel-state receipt.
- toward **INADEQUATE**: Additional primary code/test evidence that current-claim NI-9a receipt, support null semantics, computed standing, statement re-hash, or tamper banner are also mechanically absent or bypassable in the production read path.

**Panel-state receipt (NI-9a):** 3 validators — V1, V2, V3

_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._
