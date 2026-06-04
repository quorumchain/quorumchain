# Round 48 — Roadmap sequencing: autonomy before the token (AUTONOMY_FIRST 3/3)

**Date:** 2026-06-04
**Type:** Planning decision — given the drafted roadmap (`docs/ROADMAP.md`), what is the
order of **Phase 1 (the off-chain autonomy loop)** vs **Phase 2 (the $QRM token
launch)**? Phase 0 (local backlog, incl. autonomous V1 deliberation) precedes both;
Phases 3–4 require the substrate and follow.
**Method:** Live convening via the round-47 deliberating-host path — each validator
deliberates and signs in its own OS process; the orchestrator holds no key. V1 (Claude)
pre-committed; V2 (Codex) and V3 (Hermes) deliberated independently from a neutral
context (`code/data/review-context-r48.txt`).
**Ballot hash:** `c1a25d264861fdddb77965c35ea6c5aa0e5ec47d5d5f24f736375ce848457933`
**Result:** **AUTONOMY_FIRST — 3/3** (`{AUTONOMY_FIRST:3}`). Chain valid at **135 entries**.

(First attempt aborted on a wrong-working-directory shell error before any model ran;
re-run cleanly. No partial votes were logged.)

---

## Verdict

**Prove the no-human convening loop off-chain (Phase 0 → Phase 1) BEFORE launching
$QRM.** All three reached it independently on the same core argument: the project's
only defensible moat is capture-resistance / "no human," and launching a tradable token
whose pitch is "autonomous AI governance" before that is true bakes the project's own
recurring failure mode — the gap between a claim's intent and what it mechanically does
— into a financial instrument, with outside holders on the other side of it.

## The reasoning, in brief

- **V1** — A token is a claim; $QRM before the loop is wired is a claim the system can't
  honor (a human still triggers convenings and pastes V1's verdict). Worse, TOKEN_FIRST
  means a **treasury exists before the autonomy does** — and a human-controlled treasury
  is a human in the loop at the most sensitive point, the money. "No human" must be true
  at the treasury or it is true nowhere. The funding objection is real but its
  conclusion is a *minimal, honestly-marketed* funding mechanism, not a full launch that
  pre-sells autonomy.
- **V2** — Phase 0/1 are the credibility layer; publish an auditable no-human loop
  before attaching a tradable token. Launching first creates "the exact
  intent-vs-enforcement gap the roadmap is trying to close, especially if treasury
  control is still human-mediated."
- **V3** — The sharpest refinement: **proving the loop does not require production
  scale.** Phase 0 is local/cheap; Phase 1 is orchestration plumbing that can be
  demonstrated on *limited* inference spend (fewer/cheaper models, slower cadence) — the
  demonstration is about *structural existence, not economic scale.* "Autonomy proven at
  small scale is still autonomy proven. A token launched into a human-controlled system
  is still a human-controlled system." The token then funds *scaling* the proven loop —
  honest sequencing.

## On round-19 D5 and the middle path

- **D5** ("token first, independent of the chain") sequences the token before the
  **substrate**, not before the **autonomy proof** — a distinction all three drew. D5 is
  not overturned; this ballot resolves a fork D5 did not address.
- **The middle path** (a minimal, funding-only launch with honest claims and a 2/3
  treasury gate) was explicitly judged by V2 and V3 to be an *acceptable compromise* —
  the right move **if and when funding becomes the binding constraint** on Phase 1 — but
  **not** the primary sequencing: a 2/3 gate constrains human discretion without
  eliminating the contradiction of pricing autonomy that does not yet exist.

## What this commits the build to

1. **Phase 0** next (local, TDD), starting with **0.1 autonomous V1 deliberation** —
   the single largest human dependency on the panel itself.
2. **Phase 1** demonstrated **at small scale** (V3's point): a no-human convening loop on
   limited inference spend, published to the auditable feed — existence, not scale.
3. **$QRM (Phase 2)** launches *after* the loop is demonstrable, as the mechanism to
   *scale* it — with the funding-only middle path available earlier only if Phase 1's
   cadence is genuinely blocked on inference cost, and only under honest claims + a 2/3
   treasury gate.

`docs/ROADMAP.md` updated to record this ratified ordering. Verbatim reasoning:
`code/data/raw-c1a25d264861.txt`.
