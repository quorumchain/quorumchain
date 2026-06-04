# Round 49 — Phase 0 exit review (SOUND 2/3; V2's startup-liveness gap fixed)

**Date:** 2026-06-04
**Type:** Phase-0 exit gate — do the five local-backlog items (0.1–0.5) faithfully do
what they claim, with no regression and no new intent-vs-check gap, and is the no-human
panel loop genuinely achieved off-chain (the AUTONOMY_FIRST precondition for $QRM)?
**Method:** Live convening via the deliberating-host path — and the **first fully
autonomous substantive review**: V1 deliberated via `claude -p` in its own process (no
human-pasted vote), V2 via codex, V3 via hermes, each able to inspect the source.
**Ballot hash:** `846e9d17aa028bba2a229dde3012d2a3274fbf38610c1ff494263311b80d7738`
**Result:** **SOUND — 2/3** (`{SOUND:2, REVISE:1}`). Chain valid at **138 entries**.
- V1 **SOUND** · V3 **SOUND** · V2 **REVISE** (a real, actionable finding — now fixed).

This convening is itself evidence for the question it asked: three validators
deliberated and signed in their own OS processes with no human in the loop.

---

## V2's REVISE — a real live-path liveness gap (fixed under TDD)

V2 confirmed 0.1–0.4 faithful, then refused 0.5 as claimed:

> "`convene()` records signer failures after signers exist, but `run-panel.ts`
> constructs remote signers with `Promise.all`; a host that fails or times out during
> the initial pubkey handshake aborts the live convening before an absence can be
> recorded… Tests also only cover a fake `deadSigner` at `convene()` level, not startup
> failure in `run-panel`."

This was correct, and it is the project's recurring lesson again: 0.5's *intent* —
"a dead validator host is recorded as an absence; the convening proceeds" — was only
*checked* for failures DURING signing. A host dying at STARTUP hit two un-checked abort
points on the live path: `Promise.all` over `makeRemoteSigner` (rejects whole), and
`assertMatchesPin`, which threw if any pinned validator was absent — conflating the
pin's security property (no substitution) with liveness (all present). 0.2 and 0.5 were
in tension exactly at the startup boundary.

### The fix (TDD, red→green)
- **`assertMatchesPin` now rejects substitution/unknown but ALLOWS absence.** It
  iterates the keys actually presented: a wrong key or a non-pinned validator aborts; a
  pinned validator that presents no key is an absence handled by quorum, not a breach.
- **`startSigners(ids, make)`** brings up signers with `Promise.allSettled`: a host that
  fails its handshake is a recorded `startupFailure`, not a thrown abort.
- **`run-panel`** now uses `startSigners` + the corrected pin check, convening on the
  validators that came up; the keyring (ratify's 2/3 denominator) stays the full
  registered panel, so a startup absence counts against the bar exactly like a signing
  absence.
- Tests: `startSigners` tolerates a failed factory; `assertMatchesPin` allows absence
  and rejects unknown/substitution. **Suite 159 → 161, all green.**
- **Verified on the live path** (V2's exact scenario): a host pointed at a nonexistent
  path → `started: V1,V3 / startupFailures: V2`, and the pin check passes on the
  survivors. A dead host can now abort the convening at NO stage.

---

## What the panel affirmed (0.1–0.4, and 0.5's intent)

- **0.1 Autonomous V1** — V1 is child-side `claude -p`; no human paste. (This very
  review exercised it.)
- **0.2 Pinned keyring** — key pinning enforced before ratification; substitution
  rejected (now correctly allowing absence).
- **0.3 Standing-set** — `standingKeyring` excludes zero-weight probationers from
  ratify's denominator (V3's round-46 TODO, closed).
- **0.4 State-log wiring** — typed recorders append bond/lifecycle/reputation
  transitions to the tamper-evident chain.
- **0.5 Liveness** — the *intent* is right and the convene-level handling is sound; the
  startup-boundary gap V2 found is now closed too.

## Status

**Phase 0 is complete.** Local backlog (0.1–0.5) done under TDD; the no-human convening
loop is demonstrated off-chain (this review ran with no human in the loop). The
round-49 SOUND 2/3 stands with V2's startup-liveness gap folded (the round-45→46
pattern: a passing review whose dissent caught a real gap, fixed immediately). Next:
**Phase 1** — the small-scale autonomy loop.

Verbatim reasoning: `code/data/raw-846e9d17aa02.txt`.
