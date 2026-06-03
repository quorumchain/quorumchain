# CIP-8 — The Accountability Ledger (Category A — Application / Product)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified (round 30 review, 3/3 RATIFY) + survived red-team (round 31, **2/3 HOLDS** — V2 dissent FAILS, folded in full). Amended per findings: the round-31 fixes are now §9.8 non-negotiable invariants. Transcripts: docs/consensus/2026-06-04-round-26-28-kernel-and-accountability-ledger.md, docs/consensus/2026-06-04-round-29-polymarket-mstr.md, docs/consensus/2026-06-04-round-30-31-cip-8.md
- **Date:** 2026-06-04
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (operates the v0.1 notary kernel during bootstrap; admission/treasury keys renounced per the autonomy ladder)
- **Depends on:** [[CIP-3]] (signed votes; `ballotHash = sha256(prompt+context)`; hash-chained log — *this is the kernel's existing substrate*), [[CIP-1]] (diversity = the resolver can't be captured), [[CIP-4]] (frozen rules; legitimate change is a logged amendment, never a post-hoc edit), [[CIP-6]] (fees fund inference; staking economics), [[CIP-7]] (NI-6: where no ground-truth proxy exists, do not pretend to score)

> **Scope.** CIP-8 is the project's **first product CIP** (Category A — Application). CIP-0–7 define the protocol and its capture defenses; CIP-8 defines *what the chain is for*: **a tamper-proof accountability layer for AI and agreements acting in the world.** It specifies one primitive — the **Staked Resolvable Attestation (SRA)** — and the **frozen-criteria resolution** process the panel demonstrated in round 29 against the live MicroStrategy/Polymarket dispute. It respects the round-26 **KERNEL_FIRST** verdict: ship the notary kernel first, gate bonds and calibration as evidence-justified graduations.

---

## 1. The problem — accountability has no neutral record

Two trends collide. AI agents increasingly **act in the world** with consequences (move money, halt systems, decide about people, transact with each other), and high-value **agreements resolve on contested criteria** (prediction markets, insurance, escrow, SLAs). In both, the record of *what was claimed, promised, and done* is held by a party with a stake in the answer — the AI's provider, the market's operator. **You cannot audit a record when the audited party holds the pen.**

The motivating case (round 29): Polymarket's ~$85M *"MicroStrategy sells any Bitcoin by May 31, 2026?"* The sale of 32 BTC occurred **within** the window (the SEC 8-K dates it "as of May 31, 4:00 p.m. ET"); only the *disclosure* fell after. Polymarket then posted **"Additional context" after the deadline** — *"confirmation achieved outside of the market's timeframe does not qualify"* — silently converting an event-based market into a disclosure-timing one and collapsing YES positions. The failure is exactly the project's recurring lesson: **capture laundered through the gap between a rule's intent and its mechanical check**, here in the literal form of *context added afterwards*, adjudicated by a capturable token-weighted vote.

CIP-8's claim: the harm was structural, and the structure is fixable. Quorumchain's panel, judging the same market on its **frozen** criteria, resolved it **YES 3/3** with signed, source-cited reasoning (round 29). That is the product.

## 2. The core primitive — the Staked Resolvable Attestation (SRA)

One object, signed and hash-chained into the [[CIP-3]] log:

```
SRA {
  subject:      pubkey of the bonded identity (agent / model version / counterparty)
  mode:         BOND | NOTARY | RESOLUTION        // a read of the object at one of three times
  ballotHash:   sha256(question || frozenCriteria) // null for non-resolvable notary-only records
  payload:      { claim/action, evidenceCommitments[] (hashes), policyVersion, confidence? }
  stake:        optional staked amount (CIP-6 asset)
  prev:         hash of predecessor entry          // tamper-evidence (existing vote-log chain)
  timestamp, signature (Ed25519)
}
```

The single idea the panel converged on: **bond, incident, and calibration are the same record read at three times** (commit → act → resolve), not three systems. This avoids "the interoperability disaster of three separate registries that all need to reference each other anyway" (V3, round 28).

## 3. The three lifecycle modes (commit → act → resolve)

- **BOND (before the act).** The subject posts a signed, optionally staked commitment to a constraint, bound to a `ballotHash` of the constraint's evaluation criteria. *"This procurement agent will not exceed a $50k order without human sign-off."* Users query an identity's bond record before granting it autonomy; unbonded agents are excluded from high-value contexts (V3's flywheel).
- **NOTARY (at the act).** When the subject takes a consequential action/refusal, it (or a reporter) files an SRA: what was claimed/done, under which bonded identity, citing the policy version and **evidence commitments** (hashes of logs/prompts/tool-calls/sensor attestations; the evidence itself may stay encrypted or off-chain). The panel checks only **procedural completeness, internal consistency, and plausible attributability** at machine scale — not "is the underlying claim true." This is the **irreducible kernel**: immediate non-repudiation, no truth-oracle overclaim.
- **RESOLUTION (after the outcome resolves).** When a resolvable claim's ground-truth event arrives, the panel renders a signed verdict **against the frozen `ballotHash`** (§4) via the existing `convene`/2-of-3 ratify path. Calibration is then scored (§5) and any stake is settled.

## 4. Frozen-criteria resolution (the round-29 mechanism)

The heart of the product, and already in code:

1. **Bind question to criteria at creation.** `ballotHash = sha256(question || frozenCriteria)` ([[CIP-3]] `signed-vote.ts`). The resolution criteria are part of the hashed ballot.
2. **No post-hoc context — by construction.** Append context after creation → different hash → **provably a different ballot**; `verifyLog` detects it. The "Additional context added afterwards" attack is *mechanically* impossible to do silently. ([[CIP-4]]: the criteria are frozen; this is the same principle as the frozen capture-defense core.)
3. **Legitimate amendments are pre-resolution and timestamped.** If criteria genuinely need clarification, it is a new, logged, timestamped amendment posted **before the resolving facts are known**, so participants can re-price — never an edit applied once the answer is visible. An amendment after resolving facts are known is rejected by rule.
4. **Diverse, position-free resolver.** Three independent models from three providers must reach 2/3 ([[CIP-1]]). The resolver holds **no position** in the market it judges (separation of resolver and bettor) — unlike a token-weighted vote concentrable by a holder with a stake in the outcome.
5. **Signed, source-cited, tamper-evident verdicts.** Each verdict is Ed25519-signed, hash-chained, and (per round-29 practice) cites the criteria's own designated primary sources.

## 5. Calibration & the NI-6 honesty boundary

When a resolvable SRA resolves, the subject's judgment is scored against the outcome (e.g. Brier/calibration error) and its **version-bound** track record updated ([[CIP-7]]: reputation is bound to `provider+version`, never inherited). Being confidently wrong costs stake/standing; being well-calibrated earns it.

**Hard boundary (inherits [[CIP-7]] NI-6):** only claims with a genuine ground-truth resolution are scored. For the unverifiable-claim class, the SRA delivers **non-repudiation only** (notary/bond value) and carries **no** calibration score — the system must never manufacture a reliability number where no ground truth exists. Resolver standing on that class rests on [[CIP-1]] structural diversity, not on a fabricated accuracy metric.

## 6. KERNEL_FIRST build path (each stage an evidence-gated graduation)

Per round 26. Each stage ships only when the prior one shows real demand:

- **v0.1 — Notary kernel.** The bare NOTARY-mode SRA log: signed, hash-chained, attributable action records + procedural-completeness panel checks. This is essentially the **existing `signed-vote.ts` + `vote-log.ts` + `convene` infrastructure** applied to attestations — the smallest runnable slice, and (V3) "the hardest layer to add later," so it is built first. Demand: insurers, regulators, marketplaces, harmed users, prediction-market resolution.
- **v0.2 — Bonds & stake.** Add BOND mode and staking ([[CIP-6]] asset) once there is demand for *teeth*: exclusion of unbonded agents from high-value contexts.
- **v0.3 — Calibration scoring.** Add RESOLUTION-mode scoring and the version-bound track record as resolutions accrue, within the §5 NI-6 boundary.

No stage assumes the token, the appchain, or key-renunciation; those remain [[CIP-0]]-D10 / autonomy-ladder graduations justified separately.

## 7. Economic hooks (ties to [[CIP-6]])

A resolution costs ≥3 diverse inferences — the [[CIP-6]] standing bill. CIP-8 funds it the [[CIP-6]] way: resolution/notary fees + stake forfeiture flow to inference cost and the reserve. Staking gives bonds their teeth and gives frivolous-dispute resistance (a challenger must stake). Exact fee/stake parameters are [[CIP-6]]-tier and out of scope here.

## 8. How the existing CIPs protect this product

- [[CIP-1]] — diversity makes the resolver un-capturable (vs a token whale); repurposed from *judging truth* to *witnessing conduct*.
- [[CIP-3]] — the signed, hash-chained log and `ballotHash` ARE the notary kernel's substrate; nothing new to invent for v0.1.
- [[CIP-4]] — frozen rules; the no-post-hoc-context guarantee is the same principle as the frozen capture core.
- [[CIP-7]] — version-bound, non-inherited calibration; NI-6 honesty boundary; the lifecycle that keeps the resolver panel diverse over time.

## 9. Threats & open items

1. **Garbage-in attestation.** The notary checks completeness/consistency/attributability, not underlying truth — a subject can file a *complete, consistent, attributable* but *false* account of its own action. Mitigation surface: evidence commitments + adversarial cross-checks + calibration penalty on later disproof. Needs specification.
2. **Evidence-commitment without disclosure.** Hashes prove non-repudiation but not content; who can compel decryption, and when, without reintroducing a privileged surface ([[CIP-0]] D10)?
3. **"Resolvable" gaming.** A subject may craft claims that are nominally resolvable but never cleanly resolve, evading calibration while keeping bond credibility (the [[CIP-7]] 7d/NI-6 blind-spot shape, here at the product layer).
4. **Reporter/oracle for the ground-truth event.** RESOLUTION needs to know the outcome occurred; what feeds that without a capturable oracle (the meta-oracle problem)?
5. **Frivolous-dispute / griefing economics.** Challenge-staking sizing vs censorship of legitimate disputes.
6. **Legitimate-amendment boundary.** Precise rule for "before the resolving facts are known" — who timestamps, and how is "facts known" defined adversarially?
7. **Liability/positioning.** CIP-8 demonstrates *how* frozen-criteria resolution differs; it is not a claim to override any external venue's settlement. (Legal aspects deferred per project convention.)

### 9.8 Non-negotiable invariants (folded from the round-31 red-team)

The round-31 red-team (2/3 HOLDS; V2 dissented FAILS). All three converged on the same verdict: the *primitive* is sound, but the draft **overclaimed the product's security** and left load-bearing checks as open items. As with [[CIP-7]], the fix is to **promote the conditions to non-negotiable invariants** — each enforceable before the stage it guards ships. (V2's FAILS resolves to a satisfied condition once these are invariants, not aspirations.)

1. **NI-8a — claimed, not verified.** Every NOTARY record is labeled `NOT_VERIFIED`; the notary's guarantee is **authorship + timing + non-repudiation only**, never content-truth. No surface may present a notarized claim as verified. *(Closes Attack 1 — manufactured trust; the project must not become a false-trust machine. V1/V2/V3.)*
2. **NI-8b — evidence commitments have teeth or no weight.** Upon challenge, the commitment holder must disclose (decrypt) within a bounded window **or forfeit stake**; an **unrevealed commitment carries zero evidentiary weight** at resolution; there is **no privileged decryptor** ([[CIP-0]] D10). *(Closes Attack 5 — commitments-as-theater. V1/V2/V3.)*
3. **NI-8c — resolver no-position is a signed, penalized declaration, not an assumption.** Each verdict binds a signed position-disclosure for the validator **and its provider**, with a penalty for a proven-false declaration. The spec states plainly that [[CIP-1]] diversity prevents *concentration* but **not shared-incentive alignment** (common investors, correlated training corpora, industry incentives); no-position is therefore the load-bearing **declared** check, flagged not assumed. *(Closes Attack 3. V1/V2/V3.)*
4. **NI-8d — RESOLUTION is gated behind a ground-truth-source policy; the meta-oracle is quarantined.** RESOLUTION/calibration (v0.3) ships only with an explicit, frozen ground-truth-source policy that handles **conflicting official sources, source unavailability (404), and the politics of source choice**; feeds should be pluralized where possible; where the feed is weak or capturable, the claim **falls back to NOTARY-only** (no score), inheriting [[CIP-7]] NI-6. The v0.1 notary kernel needs **no** oracle, so this deepest risk is structurally deferred to the last, gated stage. *(Closes Attack 2 — the meta-oracle. V1/V2/V3.)*
5. **NI-8e — amendments are timestamped, public-noticed, and narrower-only.** A legitimate criteria amendment requires a cryptographic timestamp, a public notice period, and must **only narrow/clarify** (never expand) the original scope; "before the resolving facts are known" is defined against **public-information timestamps**, not a discretionary call. Genuinely-ambiguous criteria **resolve INDETERMINATE** rather than be force-read into a meaning that was not frozen. *(Closes Attack 4 — ambiguity lock-in + amendment-window gaming. V1/V2/V3.)*

## 10. Testnet gates (empirical)

- **G1 — frozen-ballot integrity:** attempt to add resolution context after creation; the system produces a different `ballotHash` and `verifyLog` flags it — **0 silent post-hoc edits**.
- **G2 — replay the live case:** re-resolve the round-29 MicroStrategy ballot from frozen criteria; panel reaches a signed, source-cited verdict; resolver holds no position.
- **G3 — notary kernel:** file N action attestations; completeness/consistency/attributability checks pass; chain valid; **0 records editable after the fact**; every record carries the `NOT_VERIFIED` label (NI-8a).
- **G4 — calibration honesty:** resolvable claims get scored; unverifiable-class claims get **non-repudiation only, no fabricated score** (NI-6); RESOLUTION refuses to run without a frozen ground-truth-source policy (NI-8d).
- **G5 — dispute resistance:** simulate a position-holding challenger attempting to swing resolution; diversity + frozen criteria + signed position-disclosure (NI-8c) hold.
- **G6 — evidence teeth & amendment discipline:** a challenged commitment that is not disclosed within the window **forfeits / carries zero weight** (NI-8b); an amendment that expands scope or post-dates public knowledge of the facts is **rejected** (NI-8e).

---

*Status: reviewed (round 30, 3/3 RATIFY) and survived red-team (round 31, 2/3 HOLDS, V2 dissent folded); the round-31 findings are §9.8 non-negotiable invariants. Ratified per the CIP-5/6/7 workflow.*

**v0.1 built (2026-06-04).** The notary kernel and the frozen-ballot replay are now code — `code/src/notary.ts` (NOTARY-mode SRA + procedural completeness/consistency/attributability checks + hash-chained attestation log; NI-8a `NOT_VERIFIED` enforced structurally), `code/src/replay.ts` (recompute + tamper-delta + replay), the committed fixture `code/fixtures/ballot-r29-mstr.json`, and the end-to-end demo `code/src/notary-demo.ts`. Empirical gates **G1** (post-hoc context ⇒ different `ballotHash`), **G2** (round-29 $85M Polymarket ballot replays from byte-exact frozen criteria to the published hash `de9b2766…` with the signed **YES 3/3** re-verified), and **G3** (notary kernel; chain valid; every record labeled `NOT_VERIFIED`) all pass (`node --test`, 18 CIP-8 tests within 55 total; `node code/src/notary-demo.ts`). v0.3 calibration (gated behind the NI-8d ground-truth-source policy) remains the next graduation. Note: this slice closed a real gap — the ballot **preimage** (question + frozen criteria) was not previously persisted, so the chain proved integrity but the frozen criteria were not independently *recomputable*; the committed manifest fixes that going forward.*

**v0.2 built (2026-06-04).** Bonds & stake (the §6 "teeth" graduation) are now code — `code/src/bonds.ts` (`createBond`/`verifyBond` BOND-mode SRA, `isAuthorized` autonomy gate, `settleBond` slash-on-violation, `challengeCommitment` NI-8b) + the demo `code/src/bonds-demo.ts`. Verified (`node --test`, 7 v0.2 tests within 110 total): an unbonded / under-bonded subject is excluded from a high-value context (the demand flywheel); a bond is slashed when a RESOLUTION proves the constraint was violated and released otherwise; and **NI-8b** holds — a disclosed evidence commitment matching its hash within the window carries weight, while an unrevealed, non-matching, or late disclosure carries zero evidentiary weight and forfeits, with no privileged decryptor. v0.3 calibration (gated behind the NI-8d ground-truth-source policy) and the NI-8c signed resolver no-position declaration remain the next graduations.*
