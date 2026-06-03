# Rounds 41–43 — Three contested Polymarket resolutions (independent per-validator research)

**Date:** 2026-06-04
**Type:** Live case study — the Verdict Layer applied to three real, contested prediction-market resolutions.
**Method:** Per the standing instruction (round 40), **no shared evidence brief**. Each validator received only a minimal case identifier + the market's frozen criteria, and was instructed to research independently and apply the frozen wording. V1 (Claude) researched and pre-committed its vote; V2 (Codex) and V3 (Hermes) researched live via their own tools.
**Pipeline:** `run-panel.ts`, Ed25519 signed votes, SHA-256 hash-chained log (`code/data/votes.log`). Chain verified valid at 117 entries.

These three were chosen because they are the *hard* cases — the ones where "Polymarket got it wrong" is the popular narrative. The test was not whether the panel would condemn Polymarket, but whether three diverse judges, researching independently, would faithfully apply each market's **frozen criteria** to the facts. The result is the discernment signal the project exists to produce: **the panel defended Polymarket where the resolution was defensible (Venezuela, 3/3) and split on two genuinely contestable definitional questions** — with both dissents substantive, not noise.

---

## Round 41 — The $7M Ukraine mineral-deal bet

- **Ballot hash:** `0a95078997af6718bc17de4fd767613a03c9fa7b8970df71e6ad1a7e11f1183b`
- **Verdict:** **NO — 2/3** (tally `{NO:2, YES:1}`)
  - V1 **NO** · `sig d58899bc3f…` · `roh ba6548742b…`
  - V2 **YES** *(dissent)* · `sig d8f3f987c8…` · `roh 9ce80ad0e7…`
  - V3 **NO** · `sig b0eb981307…` · `roh 8da2a13d80…`

**The question (frozen criteria):** would a U.S.–Ukraine rare-earth / mineral deal occur by the market's late-March-2025 deadline? The market's clarification was broad: *any* deal involving rare earths counted, and **an announcement of a deal would qualify regardless of if/when it was enacted**.

**Majority (NO).** On the undisputed timeline, no deal was agreed or signed by the deadline: the 28 Feb 2025 Oval Office meeting **broke down** (Zelensky left without signing), and the actual agreement was not signed until **30 April 2025** — a month after the deadline. The market nonetheless resolved **YES** after probability spiked from ~9% to 100% on 24–25 March, when a **UMA governance whale cast ~5M UMA across three accounts (~25% of the vote)** and forced a premature YES, reportedly overriding the market's own clarification. That is **oracle/governance capture by a token-weighted vote** — the exact failure mode a diverse, position-free, frozen-criteria resolver is built to remove. Polymarket called the outcome "unprecedented" but refused refunds.

**Dissent (V2, YES) — and why it matters.** V2 read the *same* broad frozen text and reached a defensible opposite conclusion: the clarification said **an announcement qualifies even if not enacted**, and there *were* announcements before the deadline — the 26 Feb 2025 Ukrainian cabinet approval to sign, public descriptions of terms, and Trump's White House statements that a "very big agreement" was "coming to sign." On a literal reading of "an announcement of a deal qualifies," that is arguably satisfied. **V2 was not careless — it found a real gap between the broad clarification text and the stricter "a deal actually happened" reading the majority applied.**

**The crux.** The disagreement reduces to a single question: did the late-February announcements constitute "an announcement of a deal," or did the **28 Feb collapse** mean no deal was ever *agreed* to announce — making the February events an announcement of *intent* that then failed? The majority weights the collapse decisive (you cannot "announce a deal" that the parties then refused to sign); the dissent weights the literal clarification text decisive. **Reasonable, independently-researching judges diverged on application of frozen text — which is precisely the case for ≥3 resolvers and a transparent record over one capturable oracle.**

**What is effectively unanimous:** all three agree the **UMA whale resolution was illegitimately produced** (premature, capture-driven). The 2/3 split is only over what the *correct* answer should have been on the frozen text.

---

## Round 42 — U.S. intervention in Venezuela

- **Ballot hash:** `8d4bafc1400651ae618b0e00522079cd4726a9a8e143d647f013cb3751852845`
- **Verdict:** **NO — 3/3 unanimous** (tally `{NO:3}`)
  - V1 **NO** · `sig 6debc04952…` · `roh dbc86091dd…`
  - V2 **NO** · `sig 9970ac13ea…` · `roh d372dcb21a…`
  - V3 **NO** · `sig d3fa82e764…` · `roh 622dc28437…`

**The question (frozen criteria):** would the U.S. "invade Venezuela" by the deadline — with the frozen wording keyed to a **military offensive intended to establish control over any portion of Venezuelan territory** (territory defined by de-facto control as of 6 Sept 2025)?

**Unanimous (NO — and Polymarket was right).** On 3 Jan 2026, **Operation Absolute Resolve** struck military sites and **captured Maduro via a limited special-forces raid without seizing or holding territory** and without sustained occupation. On the frozen "establish control over territory" wording, a decapitation raid that holds no ground does **not** satisfy the criteria — so Polymarket's NO is **defensible, not a scandal**. All three validators independently found the territorial-control wording and mapped the snatch-and-extract raid to it the same way. V3 noted Polymarket explicitly stated that capturing the head of state alone does not qualify; V1 flagged the genuine ambiguity (capturing a head of state *is* a form of control, just not territorial) and noted that related markets framed as "military engagement" likely resolved YES correctly — conflating those with the narrower "invade/territorial-control" market is much of the public anger.

**Noted but immaterial to the resolution:** a separate **insider-trading** case (a soldier allegedly profiting ~$410k on classified operation-timing information) is a real integrity failure of the *trading*, but does not change the correct *resolution*.

**This is the discernment win.** Faced with a market the crowd called "wrong," three independent judges refused the reflex and **defended the resolution on its frozen criteria**. A panel that condemned every disputed Polymarket call would be worthless; this one distinguishes capture (R41) from a correct-but-unpopular ruling (R42).

---

## Round 43 — Barron Trump & the DJT memecoin

- **Ballot hash:** `b644657f7fc859712014083c295335b4917decd1e18af4ba4159f4dbbc569830`
- **Verdict:** **INDETERMINATE — 2/3** (tally `{INDETERMINATE:2, NO:1}`)
  - V1 **INDETERMINATE** · `sig 3692b83996…` · `roh 49c0435be2…`
  - V2 **INDETERMINATE** · `sig b74ee2f2ed…` · `roh 907dd49560…`
  - V3 **NO** *(dissent)* · `sig 782bd1b1d7…` · `roh 382d9d27ab…`

**The question (frozen criteria):** was Barron Trump "involved in some way" with the DJT/TrumpCoin memecoin — resolved under a **"preponderance of evidence"** standard?

**Majority (INDETERMINATE).** UMA's decentralized oracle repeatedly resolved **NO** (no demonstrated connection); Polymarket then **overrode its own oracle**, declared it "conclusive that he was, in fact, involved in some way," and refunded YES bettors. V1/V2 found the public evidence underdetermined: "involved in some way" is vague to the point of near-unfalsifiability; Barron issued no statement; the affirmative case could not be *confirmed*, but neither could it be conclusively *refuted*. Both flagged the deeper procedural failure — **a platform overriding its own trustless oracle is a centralized override that defeats the purpose of decentralized resolution**, independent of who was factually right. V2 explicitly stated it would not vote YES, but settled on INDETERMINATE because the claim could not be definitively disproved either.

**Dissent (V3, NO) — and why it may be the stronger reading.** V3 did the on-chain homework and applied the burden of proof the others under-weighted. Its findings: the entire YES case traces to **Martin Shkreli** (a convicted fraudster) who claimed "1,000 pieces of evidence" but **released none**; **ZachXBT's on-chain investigation tied the token to Shkreli, not to Barron**; there was no independent corroboration. V3's decisive move: the frozen standard was **"preponderance of evidence,"** and under a preponderance standard **an uncorroborated claim by a discredited single source does not establish the affirmative — so the claim fails and the correct resolution is NO** (UMA was right; Polymarket's override was the governance failure).

**The crux — and an honest note.** V3 surfaced the criterion that arguably decides the case: **with an explicit burden of proof, "we cannot confirm it" does not map to INDETERMINATE — it maps to the affirmative failing, i.e. NO.** INDETERMINATE is the right answer only if the market carried *no* burden-of-proof standard; if the "preponderance of evidence" standard is genuinely frozen into the criteria, V3's NO is **more faithful to the frozen text than the majority's INDETERMINATE.** This is recorded plainly because the project's value is not the tally — it is the reasoning trail. Here the *dissent* may have the better argument, and the immutable record preserves it for anyone to check.

---

## Why these three rounds matter

1. **No rubber-stamp.** Three independently-researched contested cases produced a unanimous NO, a 2/3 NO, and a 2/3 INDETERMINATE — full spread. The panel is discriminating, not reflexively contrarian and not reflexively deferential.
2. **Every disagreement is about frozen text.** Both dissents (V2's YES on Ukraine, V3's NO on Barron) turn on a *specific clause* the dissenter found and weighted — the broad "an announcement qualifies" clarification (R41) and the "preponderance of evidence" standard (R43). This is the thesis in miniature: **resolution is faithful application of frozen criteria, and diverse judges can legitimately differ on application** — which is the argument for ≥3 independent resolvers and a transparent, immutable record over a single capturable oracle.
3. **The failure mode is real and detectable.** R41 is a textbook UMA token-weighted governance capture (~25% of the vote, 9%→100% spike); R43 is a centralized platform override of its own oracle. Both are exactly the attacks CIP-8's frozen-criteria, position-free, diverse-resolver design exists to remove.
4. **The dissents were preserved, not buried.** R43 in particular records that the *losing* vote may be the stronger reading. An immutable hash-chained log that keeps its own minority reports is the Knowledge Commons (CIP-9) property — store the consensus *and* the opposing view — demonstrated on live data.

**Provenance:** all nine votes are Ed25519-signed and hash-chained in `code/data/votes.log` (entries 109–117); chain verified valid at 117 entries. Verbatim reasoning preserved in `code/data/raw-0a95078997af.txt`, `raw-8d4bafc14006.txt`, `raw-b644657f7fc8.txt`; V1 ballots in `code/data/cv-r41.txt`, `cv-r42.txt`, `cv-r43.txt`.
