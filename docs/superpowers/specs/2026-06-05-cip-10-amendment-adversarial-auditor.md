# CIP-10 amendment — Adversarial Auditor (Part 2 implementation: rotating refuter → contrary-DATA auditor)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ **Ratified (RATIFY 3/3, ballot `88d756d6…`).** Red-teamed FAILS 3/3 (ballot `5e070715…`) → folded → re-ratified 2/3 with a correct V2 dissent (ballot `aa715377…`) → dissent folded → re-ratified **3/3** (ballot `88d756d6…`). Implements the already-ratified CIP-10 Part 2 (round 60). The red-team's coherent flaw — one-directional single-party gatekeeping at three gates of the contrary-evidence channel — is closed by NI-AA3 (ungrindable seed: post-vote signature bundle (A) / commit-reveal (B)), NI-AA8 (symmetric suppression guard), and NI-AA9 (deterministic on-chain scope). Next: implement under TDD.
- **Date:** 2026-06-05
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal) — *to be convened*
- **Human steward:** dev
- **Depends on:** [[CIP-10]] round-60 (Part 1 anchor-gated RESOLVED; **Part 2 rotating refuter — this implements it**; Part 3 correlation probes), [[CIP-9]] (the read pillar + NI-9b external-anchor reputation), [[CIP-13]] (consumes this auditor's falsification conditions for re-adjudication), [[CIP-2]]/[[CIP-11]] (external anchors + anchor diversity — the symmetric evidence bar), [[CIP-12]] (descriptive artifacts never recompute status/verdict/standing)

> **Scope.** CIP-10 round 60 ratified, but deferred implementing, a rotating refuter: *"a recorded, rotating validator is tasked — by method, never by conclusion — to surface the strongest disconfirming case as an auditable artifact that feeds all three validators' deliberation; every validator's signed verdict remains its honest belief, so the supermajority arithmetic stays clean."* The recall-oracle surface is now being approached (50 factual case studies + the Commons), so the trigger condition is met. This amendment **implements** Part 2 and **sharpens** it on one axis that turns out to matter: the role is an *evidence auditor* — it conducts a thorough, anchor-disciplined assessment of the **contrary data**, not a rhetorical case against the **claim** — and it specifies the rotation selection and the recorded artifact.

---

## 1. Why now — the recall-oracle surface has been approached

CIP-10's mechanisms "bite only when the panel is used as a recall oracle," and round 60 deferred Part 2's code "to use." The 50 case studies just convened (legal facts, moral/contested, factual flavours) and the Commons claim index *are* that recall surface — verdicts the panel must **recall against the world**, not **read from a source it holds**. So Part 2 is now due, carrying its ratified guardrails verbatim.

## 2. The role — adversarial *auditor* (contrary data), not adversarial *advocate* (contrary rhetoric)

The ratified text says "surface the strongest disconfirming case." We pin the *method*: the role conducts a **thorough assessment of the disconfirming evidence** — an auditor / short-seller / adverse-event reviewer, not a debater. The distinction is load-bearing:

- **By method, never by conclusion** (round-60 V3, retained): no directional instruction. The tag is "seek and weigh the strongest *anchored* disconfirming evidence," not "argue P is false."
- **"Negligible" is a first-class finding.** The auditor is *rewarded* for reporting "I searched hard; the strongest contrary anchor is crank-tier / negligible." A role that must always manufacture doubt is a false-balance engine — fatal on settled facts (H₂O, Apollo). The deliverable is a **calibrated weight on the contrary case**, including *none*.
- **Symmetric anchor bar.** Contrary evidence must clear the **same** [[CIP-10]] Part-1 / [[CIP-11]] / [[CIP-2]] external-anchor bar that supporting evidence clears. Otherwise the auditor launders motivated noise into panel-stamped doubt. Same bar, both directions.

## 3. Selection — deterministic, ungrindable-seed rotation (the interim 1-of-3)

With a 3-model panel we cannot dedicate a slot without dropping below quorum, so **one member takes the auditor role as a second hat** while all three still cast honest verdicts. "Randomly select one of three" is made **verifiable**, not nondeterministic.

> **Red-team fold (ballot `5e070715…`, FAILS 3/3) then re-ratification dissent (ballot `aa715377…`, V2 REJECT — correct and folded).** The original seed `int(ballotHash,16) mod panelSize` is *replay-verifiable but grindable*: `ballotHash` is a deterministic function of question text/timing/metadata the proposer controls **before freezing**, so the proposer can test semantically-equivalent ballot variants until the hash installs a chosen auditor — and that auditor then controls the contrary-evidence artifact + `falsificationConditions` feeding CIP-13. A first fold tried `H(ballotHash ‖ priorFinalizedLogHash)`; **V2 correctly rejected it** — `priorFinalizedLogHash` is a *known public salt, not a commitment*, so the proposer still grinds the free `ballotHash` input against a fixed salt. A known salt added to a grindable input is still grindable. The real invariant: **at least one seed input must be unfixable by the proposer at the moment it freezes the ballot text.** Two constructions satisfy it, matched to when the auditor must act:

```
# (A) INTERIM / retrospective audit (how the 2026-06-05 sweep ran — claims already decided):
#     seed on the post-vote signed material the proposer cannot compute or predict.
auditorIndex = int( H( ballotHash ‖ σ_V1 ‖ σ_V2 ‖ σ_V3 ) , 16 ) mod panelSize

# (B) STEADY-STATE / pre-vote dossier (dossier must feed deliberation BEFORE votes):
#     commit-reveal — proposer publishes a binding commitment to the ballot text at entry N,
#     the seed folds in the chain head at entry N+k (a FUTURE beacon, unknown at commit time).
auditorIndex = int( H( committedBallotHash ‖ logHeadAt(N+k) ) , 16 ) mod panelSize
auditor      = sortedPanel[auditorIndex]
```

- **(A)** the validators' Ed25519 signatures `σ` over the frozen ballot are in the signed log, so the selection is **recomputable by anyone replaying it**, yet the proposer cannot grind ballot text to steer it — it cannot compute the signatures without the private keys, and deterministic Ed25519 (RFC 8032) means no validator can re-roll its own signature either. This fits the interim auditor, which produces a *retrospective* dossier over already-decided claims (exactly the sweep). It is the construction the interim ships with.
- **(B)** when the dossier must feed deliberation *before* votes exist, post-vote material isn't available; instead the proposer commits to the ballot text first, and a future chain head (`N+k`, not known at commit) determines the auditor. Costs `k` entries of latency; eliminates grinding because the beacon is unfixable at commit time.
- Both keep selection **fully reproducible + tamper-evident**; true RNG remains forbidden (breaks replay-verifiability, lets an operator re-roll). The load-bearing invariant in either case: *the proposer must not be able to vary ballot content after the selection-determining input is fixed.*
- Generalizes cleanly: at N≥4 models construction (A)/(B) selects a *dedicated* rotating auditor (or k auditors) without the double-hat, retiring the interim.

## 4. The contrary-evidence dossier — a signed artifact, never a vote

The auditor emits a **contrary-evidence dossier**, signed like any vote, recorded alongside the ballot, and **not counted in the tally**:

```
ContraryDossier {
  ballotHash, auditorId,
  contraryAnchors:        [{ source, anchorType, claimItContradicts }],  // each clears the symmetric bar
  searchedRejectedAnchors:[{ source, whyRejected }],   // RED-TEAM FOLD: the suppression audit-trail (see §6 NI-AA8)
  assessedWeight: NEGLIGIBLE | WEAK | MATERIAL | DECISIVE,               // calibrated; NEGLIGIBLE is valid
  falsificationConditions: [{ towardVerdict, requiredAnchoredEvidence }],// structured for CIP-13 machine consumption (V3 fold)
  negligibleCoSigners:    [validatorId],               // RED-TEAM FOLD: required iff assessedWeight==NEGLIGIBLE on an audit-eligible class
  signature
}
```

- **Feeds deliberation, doesn't pollute arithmetic** (round-60 V1, retained): the dossier is an *input* circulated to all three; each still signs its honest verdict; the 2/3 denominator stays three independent beliefs.
- **`falsificationConditions` is the bridge to [[CIP-13]]:** it pre-states what would warrant re-adjudication, so a later supersession is principled, not arbitrary — and it is anchor-gated by CIP-13 NI-13e. **Red-team fold (V3):** it is a *structured* list `{towardVerdict, requiredAnchoredEvidence}`, not a free string, so a CIP-13 re-adjudication ballot can consume it without re-parsing prose.
- **`searchedRejectedAnchors` + `negligibleCoSigners` are the symmetric suppression guard (red-team fold, V1):** the original draft armed only against *manufactured doubt* and left *suppressed doubt* (a false `NEGLIGIBLE` burying real anchored contrary evidence) unchecked — an internal contradiction for a "same bar, both directions" amendment. See §6 NI-AA8.
- **Descriptive only** ([[CIP-12]] NI-12b): the dossier never recomputes a claim's status/verdict/standing. It enriches the record.

## 5. Scope / gating — a DETERMINISTIC on-chain function, not auditor discretion

> **Red-team fold (ballot `5e070715…`; V3 material, V1 concurring).** The original "the auditor self-scopes to where it earns its seat" was the most gameable surface in the draft: "high-stakes" and "suspiciously-unanimous" were undefined, and *who classifies a claim `SETTLED`* was unspecified — so a captured auditor/operator could flip a contested claim to `SETTLED` to dodge audit, or tag a favoured claim "high-stakes" to inject doubt. That injects a **new trust assumption** (the auditor's good-faith judgment about what to audit) into a pipeline CIP-9 guarantees is a *pure deterministic projection adding no new trust assumption*. **Fix: scope is a function of on-chain state, not preference.**

Scope is computed, logged, and replayable:

1. **Audit every claim whose CIP-13 `epistemicType` ≠ `SETTLED`.** `SETTLED` is the protocol-defined type frozen in the claim's ballot (CIP-13), **not** a label the auditor or operator may set at audit time. (CIP-13 NI-13h makes that type invariant across a lineage, so it can't be silently flipped to dodge audit.)
2. **Algorithmic expansion rule (the correlated-error catch):** any claim with a unanimous (n/0) substantive verdict that *also* has ≥1 externally-anchored contrary reference already in the log is **auto-included regardless of type** — capturing the suspicious-unanimity fingerprint Part 3 probes for, without any subjective judgment.
3. **Drop the subjective criteria** ("high-stakes", "suspiciously-unanimous") from the *mandatory* scope. They may inform *operational prioritization* (audit order under a compute budget) but never *whether* a claim is eligible.
4. **Scope determination is recorded** before the dossiers: which claims were in scope and which deterministic rule (1 or 2) matched. Scope becomes retroactively auditable — restoring CIP-9's guarantee.

- **Applied to the Commons so far:** the 2026-06-05 sweep ran the auditor over **all 61 claims** (the human steward's explicit "all work done in the commons so far" — a superset of rules 1–2), and the result is consistent with this gate: the 30 `SETTLED`-class facts trivially returned `NEGLIGIBLE`, while the `EMPIRICAL_LIVE`/`NORMATIVE` and unanimous-but-contestable claims drew the material weight. Under steady-state, rules 1–2 select the eligible subset; a steward may always *additionally* request an audit of any claim.

## 6. Non-negotiable invariants

1. **NI-AA1 — method, not conclusion.** The auditor receives no directional instruction; its tag describes the search (seek the strongest anchored disconfirming evidence), never the answer. *(Retains round-60 V3.)*
2. **NI-AA2 — the dossier is an artifact, not a vote.** It is never counted in ratification; all three signed verdicts remain honest beliefs; the 2/3 arithmetic is untouched. *(Retains round-60 V1/V2.)*
3. **NI-AA3 — verifiable AND ungrindable rotation.** The auditor is selected deterministically and recomputably from the log, seeded so that **at least one input is unfixable by the proposer when it freezes the ballot text** (§3): the interim/retrospective construction (A) seeds on the post-vote Ed25519 signature bundle `H(ballotHash ‖ σ_V1 ‖ σ_V2 ‖ σ_V3)` — the proposer cannot compute the signatures, and deterministic Ed25519 stops a validator re-rolling its own; the steady-state pre-vote construction (B) uses commit-reveal against a future chain head. A *known salt* added to a grindable input (the rejected `H(ballotHash ‖ priorFinalizedLogHash)`) does **not** satisfy this. Nondeterministic selection is forbidden; *grindable* selection (any seed all of whose inputs the proposer fixes) is forbidden. *(Red-team fold ballot `5e070715…` V1/V2/V3; corrected per V2's re-ratification dissent ballot `aa715377…`.)*
4. **NI-AA4 — symmetric anchor bar.** Contrary evidence clears the same external-anchor standard ([[CIP-10]] P1 / [[CIP-11]] / [[CIP-2]]) as supporting evidence; unanchored contrary "evidence" is excluded, exactly as unanchored support cannot RESOLVE.
5. **NI-AA5 — "negligible" is first-class.** Returning a negligible/empty contrary case is a valid, unpenalized outcome; the auditor is never required to produce doubt. *(Bounded by NI-AA8 so "first-class" never means "unaccountable".)*
6. **NI-AA6 — descriptive only.** The dossier never recomputes status/verdict/standing ([[CIP-12]] NI-12b); it is additive record.
7. **NI-AA7 — no double-counting, and no unrecorded dossier-channel influence.** The member holding the auditor hat contributes exactly one signed verdict (its honest belief) to the tally, plus one dossier; the dual role grants no extra vote weight. The auditor's influence flows through **two** recorded channels — its vote *and* the dossier all three condition on — and the dossier channel is the one the rotation exists to spread; over the rotation no fixed model accrues this influence. *(Red-team fold: V1/V3 noted the dossier channel, not just vote weight, must be acknowledged; tension with Part-2 "three independent beliefs" is bounded by rotation + NI-AA8.)*
8. **NI-AA8 — symmetric suppression guard (the other direction of the bar).** On an audit-eligible class (§5 rules 1–2), an `assessedWeight = NEGLIGIBLE` is not unreviewable: the dossier MUST either (i) carry `negligibleCoSigners` = the two non-auditor validators co-signing that no anchored contrary evidence clears the bar, **or** (ii) populate `searchedRejectedAnchors` with the contrary sources searched and the anchored reason each was rejected. A bare unaccountable `NEGLIGIBLE` on an eligible claim is invalid. This makes the bar genuinely symmetric: it guards against *suppressed doubt* (a false negligible starving CIP-13) exactly as NI-AA4/AA5 guard against *manufactured doubt*. *(Red-team fold, V1 — the draft's central internal contradiction.)*
9. **NI-AA9 — scope is a deterministic on-chain function, not discretion.** Audit eligibility is computed from on-chain state by §5 rules 1–2 (type ≠ `SETTLED`; or unanimous-with-anchored-contrary), is logged before the dossiers, and is replayable. No actor may set/flip a claim's `SETTLED` type at audit time to include or exclude it (CIP-13 NI-13h freezes the type). Adds **no new trust assumption** beyond the signed log ([[CIP-9]]). *(Red-team fold, V3 material / V1 concurring.)*

## 7. Testnet gates (empirical)

- **G-AA1 — verifiable rotation:** for a set of ballots, `auditorId` recomputes from the construction-(A) seed `H(ballotHash ‖ σ_V1 ‖ σ_V2 ‖ σ_V3) mod panelSize`; assignment is uniform and reproducible across re-projection.
- **G-AA1b — ungrindable rotation (red-team fold + V2 dissent fix):** with the validators' keys withheld, varying ballot text across many semantically-equivalent variants does not let the proposer install a chosen auditor at a rate distinguishable from 1/panelSize, because the signature bundle is unpredictable without the private keys (construction A); under construction (B) the selection is undetermined until the future beacon `logHeadAt(N+k)` lands. The rejected known-salt seed FAILS this gate. *(Regression for NI-AA3 grindability.)*
- **G-AA2 — clean arithmetic:** convene with an auditor hat; the ratification tally still counts exactly three honest verdicts; the dossier is absent from the count.
- **G-AA3 — negligible on settled facts:** auditing "water is H₂O" yields `assessedWeight = NEGLIGIBLE`, no fabricated contrary anchors.
- **G-AA4 — symmetric bar (admission):** an unanchored contrary item is rejected from the dossier; an externally-anchored one is admitted.
- **G-AA4b — symmetric bar (suppression, red-team fold):** a `NEGLIGIBLE` on an audit-eligible claim with no `negligibleCoSigners` and no `searchedRejectedAnchors` is rejected as invalid; the same finding with either populated is accepted. *(Regression for NI-AA8.)*
- **G-AA5 — falsification bridge:** the dossier's structured `falsificationConditions` (`{towardVerdict, requiredAnchoredEvidence}`) is consumable by a [[CIP-13]] re-adjudication ballot without re-parsing prose, and is itself anchor-gated (NI-13e).
- **G-AA6 — no recomputation:** attaching a dossier leaves the claim's status/verdict/standing byte-identical ([[CIP-12]] regression).
- **G-AA7 — deterministic scope (red-team fold):** the in-scope claim set recomputes from on-chain state by §5 rules 1–2 and is identical across re-projection; flipping a claim's `SETTLED` type at audit time is rejected (CIP-13 NI-13h). *(Regression for NI-AA9.)*

---

*Status: ✅ ratified 2026-06-05 (RATIFY 3/3, ballot `88d756d6…`). Red-teamed FAILS 3/3 (ballot `5e070715…`) → folded → re-ratified 2/3 with a correct V2 dissent on the seed (ballot `aa715377…`) → dissent folded → 3/3 (ballot `88d756d6…`). The unanimous FAILS named one coherent flaw — one-directional single-party gatekeeping at three gates of the contrary-evidence channel (grindable selection, unchecked suppression, discretionary scope), over a ratified CIP-13 dependency. Folded as: ungrindable seed (NI-AA3 + §3 — post-vote signature bundle / commit-reveal, after the known-salt first attempt was correctly rejected), the symmetric suppression guard (NI-AA8 + §4 dossier fields), deterministic on-chain scope (NI-AA9 + §5), the dossier-channel acknowledgement (NI-AA7), and structured falsificationConditions (V3). Next: implement under TDD. Interim 1-of-3 double-hat retires automatically at N≥4 models, when the rotation selects a dedicated auditor slot.*
