# Round 47 — Adversarial re-audit, the deliberating host, and live OS-level custody

**Date:** 2026-06-04
**Type:** Post-SOUND adversarial re-audit → fixes under TDD → panel decision → live verification.
**Trigger:** After round 46 ratified the build **SOUND 3/3** (the first unanimous code
review), V1 was asked to "check everything to see if the panel overlooked anything"
and re-audited round 46's OWN additions **from the source**, not from the builder's
summary the panel had reviewed.

---

## What the re-audit found

Round 46's review context (`code/data/review-context-r46.txt`) disclosed three
caveats but **omitted three real gaps**. The clean 3/3 was therefore partly a product
of the builder's own under-disclosure — this project's recurring lesson (capture
laundered through the gap between a rule's intent and its mechanical check) turned on
the disclosure itself: the review's *intent* was to verify the code; its *mechanical
check* was reading a summary the builder chose to write.

| # | Gap | Severity | Status |
|---|-----|----------|--------|
| **A** | `remote-signer-host.ts` generated a **new keypair on every spawn** (`generateValidatorKey()`), so a RemoteSigner had no stable identity across restarts — the keyring/signed-log model requires one. | Med-High | **Fixed (TDD)** |
| **C** | `makeRemoteSigner` had **no timeout, no `error`/`exit` handling** — a host that crashed, failed to spawn, or never answered left the pending promise unsettled, hanging the convening forever. The local signer turns failures into `NO_VERDICT`; the remote path had no liveness floor. | Med | **Fixed (TDD)** |
| **B** | `run-panel` still used `makeLocalSigner`; the RemoteSigner was proven in isolation but **wired into nothing on the live path**, and the docs overclaimed "custody closed in code / local backlog exhausted." | Med | **Panel decision → built** |

The older modules (`notary`, `replay`, `reputation`, `cost-oracle`) were re-read and
showed no logic defect.

### A and C — fixed under TDD (red → green)
- **A:** the host now loads its key from the keystore child-side when `QRM_KEYSTORE_DIR`
  is set (private half still never leaves the child). Test: two spawns against one
  keystore expose the **same** public key, matching the on-disk key.
- **C:** per-request timeout (default 30s, configurable) + `error`/`exit` reject all
  pending and fail-fast thereafter; a failed handshake kills the orphan child. Tests:
  a silent host **times out** (does not hang); a host killed mid-session makes
  `signBallot` **reject**, not hang.

---

## Ballot 1 — the B decision (WIRE_NOW 2/1)

**Ballot hash:** `4fef217749edb7ecdb272dba943cbd3d156723ad53d6a534c8a85d28d208591d`
**Result:** **WIRE_NOW — 2/1** (`{WIRE_NOW:2, DISCLOSE_DEFER:1}`).
- V1 **WIRE_NOW** — the overclaim exists because the work was mislabeled "testnet";
  the deliberating host shells the same local CLIs run today, so it is local and
  bounded. Retire an overclaim by making it true. Binding condition: a genuinely
  *deliberating* host, never the env-stub (which would let the spawner choose the
  verdict — strictly worse than today).
- V2 **WIRE_NOW** — A and C *should* have blocked round 46's SOUND **as stated**;
  dormant ≠ harmless when the status claim was "closed in code." A deliberating
  child-side host is local work that materially closes the live-path custody gap.
- V3 **DISCLOSE_DEFER** (dissent) — neither A nor C should have *blocked* the pass
  (they affected an unwired path; the system-as-shipped was sound) but both should
  have been **disclosed**. The deliberating host is the most architecturally
  sensitive boundary; the re-audit just caught what summary-level review missed, so
  don't rush boundary code to make docs accurate — build it next round with
  source-level review and TDD.

**Note:** all three agreed (a) the overclaims must be corrected regardless, and (b)
the host must deliberate child-side, never via an env verdict. V3's dissent was about
*sequencing/risk*, and its caution was honored: the host was built under strict TDD
with source-level care, and a live end-to-end verification (Ballot 2) was required
before claiming the property closed.

---

## What was built (honoring the binding condition)

- **`src/invokers.ts`** — the real validator invokers, extracted from `run-panel` so
  they run child-side. `invokerFor` maps **only** V1→file, V2→codex, V3→hermes and
  **throws on any other id** — there is no env-supplied verdict path for a real
  validator. (4 tests.)
- **`src/deliberating-signer-host.ts`** — a separate OS process that holds the
  keystore key, builds the prompt, runs the real invoker child-side, parses the
  verdict, derives the ballot hash, and signs. A child-side invocation failure
  becomes a signed `NO_VERDICT` (mirrors the local `safe()`), so a dead CLI never
  crashes the convening. (Integration test: the real V1 pipeline, deterministic via a
  temp `claude-vote.txt`.) `remote-signer-host.ts` is retained **only** as the
  fixed-verdict test fixture for the A/C tests.
- **`src/run-panel.ts`** — rewired to spawn three keystore-backed `RemoteSigner`s.
  The orchestrator now holds **no private key**; the keyring is each host's handshake
  public key. (Timeout 600s to cover hermes.)

**Process-runner bug found while verifying:** `node --test` auto-discovers every file
under `test/`. The new silent-host fixture (which reads stdin forever by design) was
being executed as a test and hung the whole suite (each file passed in isolation).
Moved to `code/test-fixtures/` (outside the discovery globs). **Suite: 150/150 green.**

---

## Ballot 2 — live verification (VERIFIED 3/3)

A real convening **through the newly wired deliberating-host path** — V2 and V3
deliberated and signed inside their own OS processes; the orchestrator held no key.

**Ballot hash:** `4955008a3522c40abfa1a53c46c1d27d048ef0d7d8408315e34794b9922f0ed2`
**Result:** **VERIFIED — 3/3** (`{VERIFIED:3}`). Chain valid at **132 entries**.
- V2 (codex) independently inspected `run-panel.ts` + `deliberating-signer-host.ts`
  and confirmed "no orchestrator-side private key or verdict injection path is
  present."
- V3 (hermes) confirmed the orchestrator "only collects the public keys and signed
  outputs … the private key never leaves the host."

This is the verification round 46 lacked: the custody property is now demonstrated on
the **live path**, not merely in isolation.

---

## Status after round 47

- **Closed on the live path:** OS-level key custody — every validator runs behind a
  deliberating RemoteSigner; `run-panel` holds no private key and cannot mint/alter a
  verdict. Verified live, VERIFIED 3/3.
- **Corrected overclaims:** the round-46 transcript is annotated (not erased);
  `PROJECT-OVERVIEW.md` and `code/README.md` now state custody is closed on the live
  path with the honest residuals below.
- **Recorded process fix:** a builder's own additions are reviewed from the
  **source/diff**, never from a summary the builder authored.
- **Honest residuals (genuinely testnet/substrate):** an isolated **V1 deliberation
  source** (Claude cannot subprocess itself, so V1's verdict is still a human-pasted
  file — its *key* is isolated, its *deliberation source* is not); a **pinned/
  published keyring** (locally taken from the host handshake); a hardware/enclave key
  store; on-chain anchoring + module state auto-emission; slashing execution; and the
  `ratify` standing-set precondition structurally enforced at the CIP-7 caller.

Verbatim reasoning: `code/data/raw-4fef217749ed.txt` (decision),
`code/data/raw-4955008a3522.txt` (verification).
