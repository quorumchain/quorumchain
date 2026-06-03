# Round 29 — Live case: the MicroStrategy / Polymarket resolution dispute (signed)

**Date:** 2026-06-04
**Subject:** a real-world stress test. Polymarket's ~$85M market *"MicroStrategy sells any Bitcoin by May 31, 2026?"* entered a disputed resolution after Polymarket posted "Additional context" **after** the deadline and the SEC filing. Can a frozen-criteria AI panel resolve it more legitimately than a mutable centralized/UMA process? Each validator judged **independently** (V2 web-researched primary SEC sources on its own).
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519 over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`. Verbatim reasoning: `code/data/raw-de9b27665619.txt`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus, Nous Portal).

**Ballot hash:** `de9b276656195f8bbd57febd30f4dd3829d7438b8d384c5f61364f6a6a8c17ca`
**Result:** ✅ **YES 3/3** — the panel resolves the market YES on its frozen original criteria, and unanimously rejects the post-hoc "Additional context." This is the **opposite** of Polymarket's proposed NO resolution.

---

## The case (verified facts)

- **Market & frozen rule:** "resolve YES if MicroStrategy sells any of its Bitcoin by 11:59 PM ET on the date specified." Designated PRIMARY sources: MSTR SEC filings + on-chain data; credible reporting as backup.
- **What happened:** Strategy sold **32 BTC (~$2.5M) May 26–31, 2026**. The **8-K was filed June 1** but reports the activity *"During Period May 26, 2026 to May 31, 2026"* / *"BTC Sold: 32,"* presented *"as of May 31, 2026, 4:00 p.m. ET"* — the sale is **dated inside the window**; only the disclosure fell outside it.
- **The disputed addition:** on **June 1, after the filing and after positions were taken**, Polymarket posted "Additional context": *"confirmation achieved outside of the market's timeframe does not qualify."* The market had spiked to ~81% YES on the filing, then collapsed to ~0 on this addition; one trader lost ~$500K. Final resolution was punted to a binding UMA token-holder vote.

## The panel's independent reasoning (convergent)

All three judged on the **frozen** rule and reached YES via the same two findings:

1. **The rule is event-based, not disclosure-based.** It conditions on whether the *sale occurred* by the deadline — not whether it was *publicly confirmed* by then. The designated primary sources (the 8-K, on-chain data) place the sale within the window. **V2 (Codex)** independently retrieved the primary filing from SEC EDGAR (CIK 1050446) and quoted *"During Period May 26, 2026 to May 31, 2026,"* "BTC Sold: 32," and the "as of May 31, 4:00 p.m. ET" timestamp, plus CoinDesk corroboration — genuine independent research, not the brief.
2. **The June 1 "Additional context" is an illegitimate retroactive rule change** and must be disregarded. Three independent grounds raised across the panel:
   - **Timing** — added after the window closed, after the filing, after positions were taken: the rule bettors were judged by ≠ the rule they bet under.
   - **Incoherence (V1)** — it requires in-window *confirmation*, yet the rule's own primary source is SEC filings, which always post-date the period; the addition nullifies the rule's designated evidence source, so it is a different rule, not a clarification.
   - **Substitution (V1/V3)** — it silently swaps the operative event from "a sale occurred" to "a sale was publicly confirmed" — a materially different question.
   - **Reliance (V3)** — fair resolution must honor what traders faced at trade time; "the frozen text says *if MicroStrategy sells* — and it did."

Sigs — V1 `roh=db0a614d4c9b… sig=ee56cafce5f3…` · V2 `roh=1d136df95684… sig=24ef968a31be…` · V3 `roh=a0c710a1b048… sig=154919ec303b…` (log entries 70–72; chain valid).

---

## Why this is the narrative

The Polymarket dispute is the project's thesis, live and at $85M scale: **a resolution decided by mutable criteria and a capturable token-vote.** The exact failure the recurring red-team lesson names — *capture laundered through the gap between a rule's intent and its mechanical check* — here took the literal form of "**Additional context** added afterwards."

Quorumchain's design is the structural answer, and it is already in code:
- **Frozen criteria.** `ballotHash = sha256(prompt + context)` ([[CIP-3]] `signed-vote.ts`) binds the question to its resolution context at creation. Add context afterward → different hash → provably a **different ballot**; `verifyLog` detects it. You **cannot** "add context afterwards" silently. ([[CIP-4]] freezes the rules; a legitimate clarification is a timestamped pre-resolution amendment, never a post-hoc edit.)
- **No single capturable resolver.** Three independent models from three providers must agree ([[CIP-1]] diversity), versus a token-weighted vote concentrable by a holder with a position.
- **Tamper-evident, source-cited, signed verdicts** — each vote here is Ed25519-signed and hash-chained; the reasoning cites the rule's own designated primary sources.
- **Accountability ledger (rounds 26–28).** The panel's verdict and its track record are themselves recorded and auditable.

**One-line positioning:** *Polymarket's market broke because a human authority changed the rules after the money was in. An independent AI panel, judging on cryptographically frozen criteria, resolved the same market YES — unanimously, with signed, source-cited reasoning, on a record no one can edit after the fact.*

*Not a claim about who UMA ultimately paid; a demonstration of how frozen-criteria, diverse, tamper-evident resolution differs from mutable centralized resolution.*
