# Round 46 — Verification of OS-level custody, the state-log interim, and the folded notes (SOUND 3/3)

**Date:** 2026-06-04
**Type:** Verification review — do #1 (RemoteSigner / OS-level key custody), #2 (state-log interim for on-chain module state), and #3 (the folded round-45 operating-condition notes) do what they claim, with no regression and no new intent-vs-check gap? Is the build still SOUND?
**Method:** Live convening via `code/src/run-panel.ts`. V1 (Claude) reviewed and pre-committed its vote; V2 (Codex) and V3 (Hermes) reviewed independently from a neutral build summary (`code/data/review-context-r46.txt`). Verdict tokens: SOUND / REVISE / INADEQUATE.
**Ballot hash:** `0d7d765b26c60a5292acefe54a22e6b13f51cceee3732d155831e3e8f820fd47`
**Result:** **SOUND — 3/3** (tally `{SOUND:3}`) — the first unanimous code review.
- V1 **SOUND** · `sig 7aa99c8a49…` · `roh f7b4464d8f…`
- V2 **SOUND** · `sig e37cd49a06…` · `roh b5dbfb2d63…`
- V3 **SOUND** · `sig 980ebf13c5…` · `roh b2111685a3…`

Chain verified valid at 126 entries. Verbatim reasoning: `code/data/raw-0d7d765b26c6.txt`.

---

## Verdict

**Unanimous SOUND.** All three items do what they claim; no regression; **no new intent-vs-check gap** was introduced. This is the first code-review round where V2 (Codex) found no new bug — it explicitly confirmed the round-45 notes were folded "without laundering intent through checks." After two prior reviews each surfaced a real defect (round 44 `completeRotation`, round 45 the signer hash binding), a clean unanimous pass is a meaningful signal.

## What was verified

- **#1 RemoteSigner (OS-level key custody).** The key is generated inside a separate OS process; there is no IPC op that returns it; the orchestrator holds only the public key and finished signed votes; the round-45 hash binding survives the process boundary (the host derives the hash from content). Two tests spawn a real child process. **The custody property is genuinely closed in code.** The disclosed caveat — locally the verdict is a fixed env stand-in, so the *deliberation source* is stubbed and a production host must invoke the model child-side — was judged an honest scope boundary by all three, not a custody defect.
- **#2 state-log (interim for #6).** The same hash-chain discipline as `vote-log`, applied to module state transitions; the demo proves a silent slash→release rewrite is caught at the edited entry. Honestly scoped: it is the *mechanism* (modules don't auto-emit yet), it gives tamper-*evidence* only (per-event authorization + on-chain anchoring are testnet). Additive, no regression.
- **#3 folded notes.** `tallyJury.advisory` surfaces a thin seat's dissent (V3: this *closes* a gap rather than opening one); CIP-7 §5.7 documents the NI-1 serving-stack FREEZE tradeoff; `ratify` documents the standing-set precondition.

## Notes from the panel (non-blocking)

- **V1** insisted on putting the RemoteSigner caveat on the record explicitly: custody (key isolation) is closed, but the stubbed env-verdict means *the spawner currently chooses the verdict* locally — fine for proving custody, but the model must decide child-side before the host is production-trustworthy. Disclosed up front, so no hidden gap.
- **V2** ran `npm test` in its sandbox; it hit `/tmp` EPERM write denials (environmental, correctly identified) — the inspected tests and the runnable RemoteSigner tests passed before the temp-write failures.
- **V3** flagged the one forward-looking item: the `ratify` standing-set precondition is now *documented* but not *structurally enforced* — a pre-existing gap (denominator inflation if a zero-weight probationer sits in the keyring). It judged honest disclosure acceptable for this stage and named it a **structural TODO for substrate integration**, not a fatal blocker.

## Status after round 46

- **Closed in code:** round-44/45 items #1–#5, #7; the #2 key-custody residual (RemoteSigner / OS process isolation); and a working local interim for #6 (state-log).
- **Outstanding — testnet/substrate only:** the RemoteSigner host invoking the real model child-side; auto-wiring module state-emission into the state-log; per-event authorization + on-chain anchoring; slashing execution; and structurally enforcing the `ratify` standing-set precondition at the CIP-7 caller (V3's structural TODO).

The local backlog is now exhausted. Every remaining item genuinely requires the testnet substrate.
