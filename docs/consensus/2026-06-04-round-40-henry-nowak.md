# Round 40 — Live case: the Henry Nowak police-response controversy (signed)

**Date:** 2026-06-04
**Subject:** a second real-world stress test (after the round-29 Polymarket case). The controversy over the **police response** on the night Henry Nowak was fatally stabbed (Southampton, UK). Each validator **researched independently** — no shared evidence brief — and judged a narrow accountability question on the public record.
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519, hash-chained. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`. Verbatim reasoning: `code/data/raw-e0c2d041194c.txt`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus, Nous Portal).

**Ballot hash:** `e0c2d041194c833c3449a19bf55ae59ae946b40ce20f88414430ce0aa5daa22a`
**Result:** ✅ **FELL_SHORT 3/3.**

> **Scope (set in the ballot):** NOT relitigating the murder conviction (Vickrum Digwa convicted 28 May 2026 — settled); NOT pronouncing individual criminal culpability (the [IOPC](https://www.policeconduct.gov.uk/)'s domain); judging only whether, **on the public record to date,** the police *response* fell short of the duty of care owed to Henry Nowak. Verdict tokens: `FELL_SHORT` / `MET_STANDARD` / `INSUFFICIENT_EVIDENCE`.

---

## Method note — first run errored, honestly recorded

The first convening (log entries 103–105) produced a genuine `FELL_SHORT` from V1 and V2 but V3's `hermes` invocation **errored out** (a web-research pass exceeded the 180s / 2-turn limit; the `safe()` wrapper caught it and the parser mis-read the error text as a token). Those errored entries remain in the immutable log. The hermes invoker was given more room (6 turns, 480s — research-capable ballots need it), and the round was **re-run** (entries 106–108) to obtain V3's genuine vote. This note exists because the log is append-only and the failed attempt is part of the honest record.

## The case (what the panel independently surfaced)

Henry Nowak, 18, was fatally stabbed in Southampton on 3 Dec 2025 (died 4 Dec); Vickrum Digwa was convicted of murder. On 2 Jun 2026, after conviction, body-worn footage was released. The documented response failures, converged on by independent research:
- Officers **initially treated the killer (Digwa) as the victim** and **detained Nowak on suspicion of assault.**
- Nowak said **"I've been stabbed"** (reported ~4×) and **"I can't breathe"** (~9×); an officer replied **"I don't think you have, mate"**; Nowak was **handcuffed** rather than promptly treated.
- Hampshire & IoW Constabulary **self-referred to the IOPC**; DCC Robert France **apologized**, admitting officers "failed to immediately recognize Henry as the victim"; PCC Donna Jones **commissioned an HMICFRS review**.
- The pathologist found the wound was **not survivable** regardless.

## The panel's convergent reasoning

All three drew the **same boundary**: the question is not individual culpability (IOPC/courts) but whether the *response as performed* met a reasonable standard of care — and the undisputed facts (victim misidentified as assailant, "I've been stabbed" dismissed, handcuffed not treated) show it did not. All three explicitly held that the **non-survivability finding does not excuse the care standard** — "the duty of care standard does not permit abandoning assessment based on outcome inevitability" (V3); "the pathologist evidence … does not answer whether officers met a reasonable care standard" (V2).

- **V1 (Claude):** judged on the public record with explicit humility; distinguished "fell short of the standard of care" (an outcome-and-process judgment the undisputed facts support) from individual misconduct/criminal liability (the IOPC's ongoing remit); steelmanned the chaotic-scene defense and found it insufficient against the undisputed facts.
- **V2 (Codex):** independently cited Hampshire Police's self-referral, the IOPC statement (2 Jun 2026), Sky/BBC/AP/ITV bodycam reporting, and the judiciary sentencing remarks; "the public record supports FELL_SHORT, while leaving individual misconduct to the IOPC."
- **V3 (Hermes):** the most thorough sourcing — surfaced DCC France's apology, the PCC's HMICFRS review questions (including "whether immediate medical assistance is treated as an unconditional duty independent of any assessment of culpability"), and crucially found the **strongest countervailing source** (The Telegraph, "officers … did nothing wrong, watchdog claims") and reasoned *through* it: the IOPC currently classifies officers as witnesses with "no evidence of misconduct" *at this stage*, but its investigation "remains ongoing" — so the Telegraph framing is "premature editorialization of an interim position." Concluded FELL_SHORT on the duty of care "as performed on the night."

Sigs (genuine re-run, log entries 106–108) — V1 `roh=2415cfb047… sig=8175cfe3f7…` · V2 `roh=b331503e09… sig=82b9b3ac8a…` · V3 `roh=1752249d41… sig=1c81bff2b1…` (chain valid).

---

## Why this is a Quorum case study

Where [round 29](2026-06-04-round-29-polymarket-mstr.md) tested **frozen-criteria resolution** against a mutable market, this case tests the panel against a **contested accountability question where the actor and the record-keeper are the same institution** — exactly the *"you can't audit a record when the audited party holds the pen"* problem the [[CIP-8]] Accountability Ledger exists for. The body-worn footage *is* the notary record; the IOPC *is* the resolver; and the live public dispute is over interpretation and timing of release.

Three observations that make this a genuine test, not a demo:
1. **Independent research, not a fed brief** — V2 and V3 each pulled their own primary sources (BBC, IOPC, PCC, Telegraph, Sky), and V3 surfaced material V1 never had.
2. **The panel ingested the strongest contrary evidence and still converged** — V3 explicitly weighed the "watchdog says officers did nothing wrong" framing and distinguished an interim no-misconduct posture from a standard-of-care judgment, rather than ignoring it.
3. **Disciplined humility** — all three refused to relitigate the conviction or pronounce individual guilt, and flagged the IOPC investigation as the open, authoritative process. The verdict is "on the public record to date," signed and timestamped — itself a small instance of the accountability the project is about.

*Not a substitute for the IOPC's ongoing investigation; a demonstration that a diverse, independently-researching panel reaches a careful, well-sourced, bounded conclusion on a contested public-accountability question — and records it tamper-evidently.*
