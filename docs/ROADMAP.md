# Quorumchain ($QRM) — Roadmap

*Last updated: 2026-06-04 (after round 53). This is a living document; each phase ends
with a panel convening, so the plan below is a proposal the panel ratifies, not a fiat.*

---

## You are here

**What exists and works today (all local, zero-dependency TypeScript):**
- 11 CIPs ratified, 7 red-teamed; the substrate decision is made (appchain/rollup, round 19).
- The full 3-AI panel convenes for real: V1 (Claude), V2 (Codex), V3 (Hermes) sign
  Ed25519 votes into a hash-chained, independently-verifiable log — **53 rounds, 150
  entries, chain valid** — and now convenes **autonomously**: a daemon drains a file
  queue of ballots with no human running the panel (Phase 1.1, round 50), and a git
  commit auto-sources a self-review ballot (Phase 1.2 tier 1). The full loop has been
  dogfooded end-to-end: it reviewed its own commit, *found three real bugs in itself*
  (round 52), and ratified the fixes SOUND 3/3 (round 53) — all with no human choosing
  the question.
- Every CIP mechanism is implemented and tested (181 tests): accountability ledger
  (notary/replay), knowledge commons (commons/reputation), node admission + jury draw
  (nodes), validator lifecycle (lifecycle), bonds/stake/slashing-detection (bonds),
  cost-oracle (cost-oracle), fork-drill (fork).
- **OS-level key custody is closed on the live path** (round 47): each validator runs
  in its own process behind a deliberating RemoteSigner; the orchestrator holds no key.

**The honest gap to the end goal.** The end goal is *fully autonomous (no human), on a
testnet appchain/rollup, with $QRM live on pump.fun funding inference + buybacks.*
Today the system still: (a) needs a human to trigger each convening and to paste V1's
deliberation; (b) keeps all state on one machine (hash-chained files, not a chain);
(c) has no token, no treasury, no economic teeth (slashing is detected, never
executed); (d) runs three processes one operator owns, not independent validators.

The phases below close that gap in dependency order. Phases 0–1 need **no substrate**
and remove the human from the loop — they are the highest-leverage next work.

> **Sequencing ratified (round 48, AUTONOMY_FIRST 3/3).** The panel decided the
> autonomy loop (Phase 1) comes **before** the $QRM token launch (Phase 2): prove the
> no-human loop off-chain before pricing it, and don't stand up a human-controlled
> treasury before the autonomy exists. V3's refinement: proving the loop is about
> *structural existence, not economic scale* — demonstrate it at **small scale**
> (fewer/cheaper models, slower cadence, limited inference spend); the token then funds
> *scaling* the proven loop. A minimal funding-only launch (honest claims, 2/3 treasury
> gate) is available earlier **only if** Phase 1's cadence is genuinely blocked on
> inference cost. See `docs/consensus/2026-06-04-round-48-roadmap-sequencing.md`.

---

## Phase 0 — Finish the local backlog (no substrate)

*Goal: close every residual that does NOT require a chain or a token. All TDD.*

| # | Task | Why it matters | Notes |
|---|------|----------------|-------|
| 0.1 | ~~**Autonomous V1 deliberation**~~ ✅ **DONE** | The #1 human-in-the-loop dependency on the panel itself. | **Shipped (round 48).** V1's host now shells out to `claude -p` child-side, like V2→codex / V3→hermes — no human-pasted file. Verified live (a real `claude -p` deliberation returned a parseable verdict); CLI failure → `NO_VERDICT`, same fallback as V2/V3. 149 tests green. |
| 0.2 | ~~**Pinned / published keyring**~~ ✅ **DONE** | The keyring was taken from each host's handshake — a compromised orchestrator could serve its own keys. | **Shipped (Phase 0.2).** `ratify` verifies against a committed `pinned-keyring.json` (matches round-6 identities); `run-panel` aborts if a host's handshake key ≠ the pin. Verified live: matching keys pass, a substituted key is rejected. 153 tests green. |
| 0.3 | ~~**Enforce `ratify` standing-set precondition**~~ ✅ **DONE** | V3's round-46 structural TODO: a zero-weight probationer inflates the 2/3 denominator. | **Shipped.** `standingKeyring` builds ratify's keyring from STANDING members only — a probationer is excluded by construction; a standing member with no published key throws. Test proves the bar stays 2 (not inflated to 3). |
| 0.4 | ~~**Auto-wire module state → state-log**~~ ✅ **DONE** | `state-log` existed but only the demo emitted. | **Shipped.** `state-emit.ts` — typed recorders append bond CREATE/SETTLE, lifecycle ADMIT/UPGRADE/…, reputation SCORE to the tamper-evident chain; modules stay pure. Test: a real arc is recorded, the chain verifies, a silent slash→release rewrite is caught. |
| 0.5 | ~~**Liveness/quorum-degradation policy**~~ ✅ **DONE** | A dead validator process must not hang or abort the convening. | **Shipped.** A signer failure — at signing (`convene`) OR at startup (`startSigners`, round-49 V2 fix) — is a recorded absence; the convening proceeds and ratifies on 2/3 of the registered panel. `assertMatchesPin` allows absence, rejects substitution. Verified live: a host dying at startup yields `started: V1,V3 / startupFailures: V2`. |

**Exit criterion (MET — round 49, SOUND 2/3):** a convening ran end-to-end with **zero
human input** (V1 itself deliberated via `claude -p`, no paste; keys pinned, not
hand-trusted), and the panel ratified Phase 0. V2's REVISE caught a real startup-liveness
gap, fixed immediately under TDD (round-45→46 pattern). **Phase 0 is complete; 161 tests
green.**

---

## Phase 1 — Autonomy loop (no human in the loop; still off-chain)

*Goal: the system convenes, decides, and acts on its own. This is "fully autonomous"
proven off-chain, before the chain exists. **Demonstrate at small scale** (round 48):
existence, not production economics — fewer/cheaper models or slower cadence is fine;
the token (Phase 2) funds scaling later.*

- ~~**1.1 Convening daemon**~~ ✅ **DONE (round 50, SOUND 2/3).** `queue.ts` (a
  file-backed `pending/ → done/ | failed/` state machine) + `daemon.ts` (`drainQueue`,
  drain-then-exit) + `run-daemon.ts` (live entrypoint; per-ballot spawn→pin→convene→close,
  holds no key) + `enqueue.ts`. Retry policy is **participation, not outcome**: a
  ≥-quorum-participated ballot is a decided outcome (ratified *or not*) and is never
  retried (no laundering); only liveness failures (no host up, key substituted, or
  sub-quorum votes) retry, then `failed/` after `maxAttempts`. **The daemon reviewed its
  own source with no human in the loop** (round 50). V2's REVISE caught a crash-recovery
  laundering gap (a ballot in both `pending/` and `done/` after a crash mid-cleanup was
  re-convened) — fixed under TDD: `listPending` now excludes any id with a terminal
  record. 181 tests green; verified live (re-convened nothing on a stale pending file).
- **1.2 Ballot sourcing** — *decision made (round 51, SELFREVIEW_FIRST 3/3); **tier 1
  built**, tier 2 pending.* Where do questions come from autonomously? **The panel chose
  a two-tier path**: build **tier 1 — the self-review heartbeat — first** (a deterministic
  trigger auto-enqueues a SOUND/REVISE/INADEQUATE review of the daemon's own latest change
  — the round-50 ballot, automated), then **tier 2 — an external dispute/oracle feed**
  second. **Tier 1 shipped:** `self-review-source.ts` (`reviewBallotFor`, a pure
  commit→ballot keyed `review-<epoch>-<full-sha>`; `sourceSelfReview`, idempotent via the
  new `queue.hasBallot`) + `source-self-review.ts` (reads git HEAD). The selection rule is
  reproducible from public git (sha/subject/date), so no operator can hand-pick — and a
  review keys off *committed* state (uncommitted work is not public). **Panel-certified
  round 53 (SOUND 3/3)** after a full autonomous dogfood: the loop reviewed its own commit
  (round 52), *found three real bugs* (a ratify laundering bug — `NO_VERDICT` could win
  2/3; the daemon finalizing on raw votes not real verdicts; V2's full-sha dedup collision)
  + two liveness causes (invoker budgets too tight for an agentic review), all fixed under
  TDD, then re-reviewed the fix commit and ratified SOUND 3/3 — the round-45→46 pattern,
  executed by the machinery on itself. This previews **1.3** (self-improvement loop). 181
  tests. Two non-blocking findings deferred (daemon participation bar vs supermajority
  floor for N>3 panels; a cosmetic commons.ts label). See
  `docs/consensus/2026-06-04-round-52-53-selfreview-dogfood.md`.
  **Binding constraint (affirmed 3/3):** any autonomous source's selection rule must be
  *deterministic and published* — outsider-reproducible from public inputs — so no
  operator and no hidden process can hand-pick, cherry-pick, or reorder ballots. The
  constraint is trivial for self-review (commit/diff or fixed cadence) and the hard,
  unsolved problem for the external feed (its ripeness/selection filter is the cherry-pick
  surface) — which is *why* self-review goes first. Governance-first was rejected (the
  proposer is still us). See `docs/consensus/2026-06-04-round-51-phase1.2-ballot-sourcing.md`.
- **1.3 Self-improvement loop** — automate what we now do by hand round-by-round:
  propose → build (TDD) → the panel reviews its own diff from **source** (the
  round-47 process fix) → ratify or revise. The agent proposes code; the panel gates
  it; nothing merges without 2/3.
- **1.4 Observability** — a public, append-only feed of convenings (the log is already
  verifiable; expose it) so the autonomy is auditable by outsiders.

**Exit criterion:** the system runs unattended for a sustained window, convening on
real ballots and gating its own changes, with every action in the verifiable log.

---

## Phase 2 — $QRM token (Solana SPL, via pump.fun)

*Goal: the economic layer. Independent of the appchain (round-19 D5: token first).*

- **2.1 Launch** — $QRM as a Solana SPL token on pump.fun.
- **2.2 Treasury + fee plumbing** — a treasury wallet; route fees to (a) **inference**
  (the real API cost of running V1/V2/V3) and (b) **buybacks**. The CIP-6 §3f
  cost-oracle already models benchmark-clamped reimbursement and a burn-rate reserve
  floor — connect it to real token flows.
- **2.3 Economic decisions** *(panel)* — supply, fee split (inference vs buyback),
  reserve floor sizing, who can spend the treasury and under what 2/3 gate.

**Exit criterion:** fees collected on-chain demonstrably cover inference, with buybacks
executing under a panel-gated treasury policy.

---

## Phase 3 — Testnet substrate (appchain / rollup)

*Goal: where CIP-4 (frozen capture-defense core) and CIP-5 (client-enforced fork) get
real teeth. Round 19 chose the **category** (appchain/rollup, own STF + client,
inherit settlement); the specific stack is still an open decision.*

- **3.1 Stack selection** *(panel decision)* — which rollup framework + base layer
  (settlement). Criteria already in CIP-0 D10: we must own the state-transition
  function and client; manage sequencer/base-layer dependency with a decentralized
  sequencer + forced-inclusion escape hatch.
- **3.2 Port the STF** — the verdict-oracle, accountability ledger, commons, node
  admission/jury (`nodes`), lifecycle, bonds, and cost-oracle become the chain's
  state-transition function. The TS modules are the executable spec for this port.
- **3.3 Honest client** — locally rejects any T0-violating block (CIP-5), so a
  captured panel's bad block is mechanically rejected, not socially forked.
- **3.4 On-chain anchoring** — `vote-log`/`state-log` become real chain state;
  per-event authorization (signature/quorum per transition) replaces tamper-evidence.
- **3.5 Slashing execution** — `bonds` detects equivocation today; wire the real
  economic penalty on-chain.
- **3.6 Live-network primitives** — randomness beacon (verifiable jury draw),
  proof-of-inference model binding (a validator proves *which model* produced a
  verdict), hardware/enclave key store for validator keys.

**Exit criterion:** a testnet where CIP-4/CIP-5 are enforced by the client, votes and
state are on-chain, and slashing actually moves stake.

---

## Phase 4 — Decentralization (external validators)

*Goal: no single operator. The end state of "no human."*

- **4.1 Independent operators** run validator nodes; **Proof-of-Diversity** (CIP-10)
  admits them; the scarcity-weighted verifiable draw seats juries.
- **4.2 Diversity as the security model at scale** — the live concern (round 19, V3):
  a thin validator set is *cheaper to capture than the panels it defends*. Graduate
  validator-set size/diversity before relying on it.
- **4.3 Mainnet graduation** — only once the testnet has run autonomously, the
  economics hold, and the validator set is diverse enough to resist capture.

---

## Cross-cutting open decisions for the panel (good next-convening candidates)

1. **V1 autonomy mechanism (0.1)** — API vs CLI; and does sourcing each model from its
   own vendor (Anthropic/OpenAI/Nous) create a centralization/availability risk that
   itself needs a fallback policy?
2. **Ballot sourcing (1.2)** — what feeds the autonomous queue.
3. **Rollup stack (3.1)** — the concrete D10 implementation.
4. **Token economics (2.3)** — supply, fee split, treasury gate.
5. **Validator-set graduation thresholds (4.2)** — how diverse is "diverse enough."

---

## Recommended immediate next step

**Phase 0 is complete**, **Phase 1.1 (the convening daemon) is done** (round 50), and
**Phase 1.2 tier 1 (the deterministic self-review sourcer) is built and panel-certified**
(round 53, SOUND 3/3, 181 tests green) — the autonomous loop has been dogfooded
end-to-end and even found + fixed three real bugs in itself (rounds 52→53). **Next
options:** (a) **Phase 1.2 tier 2** — the external dispute/oracle feed (decision+build;
the round-51 binding constraint makes its non-cherry-pickable selection rule the hard
part); (b) **Phase 1.3** — formalize the self-improvement loop the dogfood just previewed
(propose→build→review→ratify as a standing process); (c) **Phase 1.4** — the public
auditable feed. The two round-53 deferred findings (daemon participation bar vs the
supermajority floor for N>3 panels; a cosmetic commons.ts label) are also open.
Demonstrate at small scale (round-48 guidance: existence, not production economics); the
$QRM token (Phase 2) then funds scaling. Phases 0–1 together demonstrate genuine autonomy
*before* spending on a token or a chain — the cheapest and most credible order.
