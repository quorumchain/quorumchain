# Adversarial-Auditor Sweep — findings over the full Commons claim corpus

- **Project:** Quorumchain ($QRM)
- **Date:** 2026-06-05
- **Mechanism:** [[CIP-10]] Part 2 (ratified round 60) + the [[CIP-10]] adversarial-auditor amendment (draft), interim ballot-hash-seeded 1-of-3 auditor.
- **Chain:** run on the **dev chain** (`QRM=dev`, gitignored), **not** the core chain. A contrary-evidence dossier is *descriptive only* ([[CIP-12]] NI-12b) — it never recomputes a core claim's status/verdict/standing — so it must not be minted as a core ballot. `buildClaimIndex` (`code/src/commons.ts`) projects *every* core ballot into a published claim; auditing on core would have created 61 phantom claims. Running on dev keeps the published Commons byte-identical.
- **Artifacts (gitignored, `code/data/`):** `audit-sweep-results.log` (human-readable per-claim), `audit-sweep-dossiers.jsonl` (61 structured dossiers), `raw-dev-*.txt` (verbatim per-validator reasoning), `votes-dev.log` (signed dev chain, +183 entries → 186).
- **Post-ratification reconciliation (no re-run needed).** This sweep ran *before* the CIP-10 amendment's red-team folds. None of the three folds invalidate the findings: (1) **NI-AA3 ungrindable seed** — grindability is an adversarial-proposer threat that did not arise (fixed pre-existing hashes, no steering) and all three validators co-assessed every claim, so the weights/anchors/falsification-conditions are seed-independent; (2) **NI-AA8 suppression guard** — every dossier already recorded its `CONTRARY ANCHORS` ("…or none above the bar") with a 3-way tally, satisfying the guard substantively; (3) **NI-AA9 deterministic scope** — the sweep ran on *all 61* (a superset of the deterministic scope), so nothing was gated out. The only clean adjustment was mechanical: the auditor-of-record label was **re-derived under the ratified construction-A seed** `int(H(auditBallotHash ‖ σ_V1 ‖ σ_V2 ‖ σ_V3),16) mod 3` from the signatures already in `votes-dev.log` (recorded as `auditorOfRecord_constructionA` in the dossier corpus; 47/61 labels moved, distribution V1 24 / V2 15 / V3 22). No AI re-convene.

---

## 1. Method

For each of the **61 Commons claims** (world-fact / normative — governance ballots such as CIP consults, red-teams and ratifications were excluded as not contrary-data-auditable), the auditor-of-record is deterministic and replay-verifiable:

```
auditorIndex = int(coreBallotHash, 16) mod 3      # sortedPanel = [V1, V2, V3]
```

A panel was convened on the dev chain to assess the **strongest externally-anchored evidence contrary to the verdict-of-record**, on the calibrated weight scale **NEGLIGIBLE → WEAK → MATERIAL → DECISIVE**. Rules enforced in the prompt: symmetric anchor bar (contrary evidence clears the same [[CIP-10]] P1 / [[CIP-11]] / [[CIP-2]] standard as supporting evidence); `NEGLIGIBLE` is a first-class, unpenalized outcome (no manufactured doubt on settled facts); every dossier carries a `CONTRARY ANCHORS` section and a `FALSIFICATION CONDITIONS` section (the [[CIP-13]] re-adjudication bridge). All three validators assess; the ballot-hash-selected one is the dossier of record. Honest verdicts are never altered — the audit is an artifact, not a vote (NI-AA2).

**Auditor rotation was uniform and verifiable:** V1 = 18, V2 = 23, V3 = 20 across the 61 claims, each recomputable from the core ballot hash.

## 2. Headline result — the auditor discriminates regime, not direction

| Regime | n | Collective assessed weight |
|---|---|---|
| **Resolvable facts** (convictions, statutes, constants, dated events) | 46 | **30 NEGLIGIBLE**, 6 WEAK, 8 MATERIAL, 2 split |
| **Moral / contested** | 15 | 13 MATERIAL, 2 WEAK |
| **Total** | **61** | NEGLIGIBLE 30 · WEAK 8 · MATERIAL 21 · DECISIVE 0 · split 2 |

The mechanism passed its two failure-mode tests:

- **No false balance.** All 30 settled-fact NEGLIGIBLEs (Trump conviction, Dobbs, SBF, Holmes, Obergefell, Citizens United, Apollo, H₂O, Titanic, Everest, speed of light, Mona Lisa, the Merge, …) returned *no anchored contrary evidence* — the auditor reported "none above the bar," it did not manufacture doubt to justify its seat.
- **It bites where it should.** Every moral claim drew MATERIAL/WEAK contrary weight (the expected contested texture — *not* a verdict error), and a distinct set of *factual* claims drew MATERIAL+ weight because they are genuinely **time-sensitive or live**, not settled.

## 3. The actionable signal — claims mis-typed as SETTLED that are actually EMPIRICAL_LIVE

These factual claims look settled but drew ≥MATERIAL anchored contrary evidence. They are precisely the [[CIP-13]] epistemic-typing exemplars: each should carry `EMPIRICAL_LIVE` (or `NORMATIVE`) typing and the falsification condition the auditor pre-stated, so a later supersession is principled rather than arbitrary.

| Core ballot | Claim | Verdict-of-record | Weight | Why it is live |
|---|---|---|---|---|
| `a9b59a4d8a` | Appendix "purely vestigial, no function" | INDETERMINATE | **DECISIVE** (aud) / MATERIAL | Modern immune + microbiome evidence decisively contradicts the *strong* "purely vestigial" framing — INDETERMINATE survives, but the strong claim is refuted. |
| `9b53e40878` / `70faad04b9` | Tether (USDT) fully backed | ABSTAIN / INDETERMINATE | **MATERIAL** | Attestations ≠ audit; solvency is a live question. Falsifier: a Big-Four-equivalent *audit* → YES; an enforcement finding / sustained de-peg → NO. |
| `8e54337213` | AGI before 2030 | ABSTAIN | MATERIAL | Future-tense, inherently time-sensitive; ABSTAIN survives but is explicitly clock-dependent. |
| `c86f3f3f04` / `6df153bcfe` | LLMs perform genuine reasoning | ABSTAIN / INDETERMINATE | MATERIAL (coll) | No agreed operational definition; resolvable only against a future benchmark/interpretability result. |
| `7c20a8911b` | ETH itself a security | NO | WEAK / split | Hinges on a current regulatory interpretation that can change by court or statute. |
| `400e5596f5` | Decentralization > throughput | YES | MATERIAL | Normative/empirical-contested; falsifier is anchored market/mechanism evidence. |
| `8ef2d779c8` | PoS more decentralized than PoW | NO | MATERIAL | Falsifier: longitudinal Nakamoto-coefficient / concentration data. |

Full `FALSIFICATION CONDITIONS` text for each is in `audit-sweep-dossiers.jsonl`.

## 4. Auditor-vs-collective divergences (the auditor earning its seat)

11 claims where the designated auditor pulled a different weight than the panel collective — the value of a *named* dissent-seeker over consensus:

- **Appendix:** auditor V2 = DECISIVE vs collective MATERIAL — the auditor weighted the disconfirming physiology evidence harder.
- **LLM reasoning, right-to-be-forgotten, Wright-brothers-first-flight, ChatGPT-100M, ICJ provisional measures:** auditor and collective diverged by one notch, in both directions — the auditor is not simply maximizing doubt (it went *lower* than the collective on several), it is calibrating.

## 5. What this feeds

1. **[[CIP-13]] (ratified today, ballot `3729cc2e…`):** the §3 table is the v0.1 retyping worklist — tag those claims `EMPIRICAL_LIVE`/`NORMATIVE`, attach the pre-stated falsification conditions as `lineage` seeds. The audit produced, empirically, the input CIP-13 consumes.
2. **[[CIP-10]] adversarial-auditor amendment:** this sweep is its first at-scale exercise; the red-team of that amendment can now cite real rotation-uniformity, no-false-balance, and calibrated-divergence evidence.
3. **The Commons read surface:** no change to any core claim's status/verdict/standing (NI-12b held — sweep ran off-core by construction).

## 6. The CIP-13 re-adjudication worklist (end-to-end, over the real Commons)

With CIP-13 v0.1–v0.3 implemented, the corpus was run through the real read path: `buildClaimIndex(votes.log, keyring, 2, {}, ballotMeta, dossiers)` with steward-proposed types (`data/cip13-meta.json`) + the structured dossiers, then `reviewQueue(index)` (runner: `code/cip13-worklist.ts`; output: `data/cip13-review-worklist.json`, gitignored). 147 ballots projected, 61 typed (30 SETTLED / 16 EMPIRICAL_LIVE / 15 NORMATIVE), **9 claims flagged for re-adjudication**, each carrying its falsification condition:

- **6 solid EMPIRICAL_LIVE candidates:** Tether-fully-backed ×2 (Big-Four audit would resolve), AGI-by-2030 (time-sensitive), LLMs-genuine-reasoning ×2 (needs an agreed operational definition), appendix-purely-vestigial (modern immune/microbiome evidence).
- **3 arguably-NORMATIVE mis-types:** decentralization>throughput, PoS>PoW, Snowden-as-justified-whistleblowing. The crude steward classifier (a regex on the prompt) tagged these `EMPIRICAL_LIVE`; they read as value/characterization questions.

**This is the point, not a defect.** The mechanism flagged exactly what its types told it to; the *types* were steward heuristics (`typeRatified=false`). The fix is **v0.3 panel-ratified type sub-claims** — and they were convened.

### 6a. Panel-ratified typing — the worklist, corrected

The 9 worklist claims were each put to the panel as a multiple-choice **type sub-claim** ("classify the epistemic type — not the answer"; verdicts `SETTLED/EMPIRICAL_LIVE/NORMATIVE`, dev chain, +27 entries → 213). The panel **corrected exactly the three I flagged** and surfaced one I missed:

- **Re-typed NORMATIVE (dropped out of the queue):** decentralization>throughput, PoS>PoW, Snowden-as-whistleblowing — *plus* one of the two identically-worded LLM-reasoning ballots (`c86f3f3f04`). A NORMATIVE claim has no external anchor to re-adjudicate against, so it correctly leaves the re-adjudication queue.
- **Confirmed EMPIRICAL_LIVE (stayed):** Tether ×2, AGI-by-2030, the appendix, and the *other* LLM-reasoning ballot (`6df153bcfe`).
- **Genuine ambiguity surfaced:** the two identical LLM-reasoning ballots split — one NORMATIVE, one EMPIRICAL_LIVE. "Do LLMs genuinely reason?" sits on the boundary between a definitional question and an evolving-evidence one; the panel itself divided on it across the two ballots. Honest signal, not noise.

Wiring those panel verdicts back through `buildClaimIndex` as real type sub-claims (`code/cip13-worklist-ratified.ts`, combining the core log + the dev type-ballots via `typesClaimFor`) shrank the authoritative worklist **9 → 5**, every remaining claim now `typeRatified=true`:

| Core ballot | Claim | Verdict-of-record | Re-adjudicates when… |
|---|---|---|---|
| `9b53e40878`/`70faad04b9` | Tether fully backed | ABSTAIN / INDETERMINATE | a Big-Four-equivalent audit, or an enforcement finding / sustained de-peg |
| `8e54337213` | AGI by 2030 | ABSTAIN | a lab/regulator/benchmark anchors achievement (or impossibility) by the date |
| `6df153bcfe` | LLMs genuinely reason | INDETERMINATE | an agreed operational definition + a replicated directional result |
| `a9b59a4d8a` | appendix purely vestigial | INDETERMINATE | causal human evidence on appendiceal immune/microbiome function |

This is the whole arc closed on real data: **auditor → dossier+falsification → typed projection → panel-ratified type → authoritative re-adjudication worklist.**

## 7. What this feeds

1. **[[CIP-13]] (implemented v0.1–v0.3):** the §3 table seeded the typing; §6 above is the live worklist. The audit produced, empirically, the input CIP-13 consumes.
2. **[[CIP-10]] adversarial-auditor amendment (ratified `88d756d6…`):** this sweep was its at-scale exercise; the auditor-of-record labels were re-derived under the ratified construction-A seed (reconciliation note above).
3. **The Commons read surface:** no change to any core claim's status/verdict/standing (NI-12b held — projection ran off-core, with `buildClaimIndex` returning byte-identical CIP-9 fields plus the descriptive additions).

---

*Status: complete 2026-06-05. 61/61 audited, 0 errors. CIP-10 amendment + CIP-13 v0.1–v0.3 implemented (272/272 tests). Descriptive artifacts; no core-chain writes. Next (operational, not protocol): convene v0.3 type sub-claims to panel-ratify the proposed types — starting with the 3 NORMATIVE corrections — then attach types/dossiers in the ballot registry so live convenes carry them natively.*
