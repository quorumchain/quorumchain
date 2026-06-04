# CIP-12 — The Fuller Correlation Receipt (Category — Knowledge Commons / Read Path)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Design-ratified — graduation chosen **3/3 unanimous (CORRELATION_RECEIPT)** over CALIBRATION and FORKING (consult ballot `e87521e46cb67d52c112e1f727d30e1ab7f0965dfb1921a24e2758d90c83135b`, log entry 234) + draft **survived red-team 3/3** (ballot `6738db145b813e993c39cd3cb75267dd96f9eee9e7ca8785f0c35c2c6c3d2326`, log entry 237; one minor NI-12g precision note folded). Promotes the §4 "fuller correlation receipt" from *gated* to *built*; the other two graduations remain gated, by the panel's own dependency-ordering. **Design-ratified; NOT YET IMPLEMENTED** — TDD build pending.
- **Date:** 2026-06-05
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev
- **Extends:** [[CIP-9]] (Knowledge Commons — promotes one of its named gated graduations). **Ties to:** [[CIP-1]]/[[CIP-7]] (lineage/provenance dimensions), round-60 correlated-error defense (the receipt operationalizes after-the-fact correlated-era discountability), [[CIP-10]]/[[CIP-11]] (the no-false-independence rule mirrors same-base-model and anchor-correlation collapse). **Unblocks (does not build):** calibration-weighted stance support and epistemic forking — both depend on composition being on record.

> **Scope.** Today a Commons claim carries the minimal panel-state receipt `{ validators, size }` ([[CIP-9]] NI-9a); provider/diversity/correlation metadata is explicitly a gated graduation. CIP-12 builds the **fuller correlation receipt**: every claim records the *composition* of the panel that produced it — each validator's provider and lineage, plus a panel-level correlation band — so a verdict reached during a captured or correlated era is **identifiable and discountable after the fact**, operationalizing the round-60 correlated-error honesty on the read surface. The receipt is **descriptive, not dispositive**: it records composition and changes *no* verdict, status, or standing. The panel chose it first, unanimously, on a dependency argument — calibration cannot safely weight a validator's accuracy without knowing whether it sat on a correlated panel, and forking cannot tell a principled branch from a correlated-era artifact without provenance on record — and it is the one graduation demonstrable across every case-study type. Its honest limit, conceded by all three validators: it makes the Commons *observable*, not yet *smarter* — the read-surface payoff ("accuracy not popularity") is deferred to the calibration graduation it unblocks.

---

## 1. What ships, against the built surface

`PanelStateReceipt` is extended; nothing else in the read path changes.

```
PanelStateReceipt {
  validators       : string[]              // unchanged (NI-9a)
  size             : number                // unchanged
  composition      : CompositionEntry[]    // NEW — one entry per validator, registry-derived at ballot close
  correlationBand  : "LOW" | "ELEVATED" | "HIGH" | "UNKNOWN"   // NEW — panel-level summary
}

CompositionEntry {
  validatorId : string
  provider    : string | null     // null when unknown / opted-out (NI-12g no-silent-omission)
  lineage     : string | null     // provenance class (corpus / teacher-distillation / weight-derivation), null if unknown
}
```

- `composition` is derived from the validator registry / pinned keyring at ballot close — the same provenance dimensions [[CIP-7]] NI-1 already defines.
- `correlationBand` reuses the round-60 correlation-measurement primitives **where they are live**; until the probes ship it is `"UNKNOWN"` (honest, forward-compatible) rather than a fabricated `"LOW"`. Known shared-foundation between providers (the [[CIP-11]] NI-11b sense) forces it no lower than `"ELEVATED"`.
- No field on `Claim`, `Stance`, `Standing`, `ClaimStatus`, `verdict`, or `panelVotes` changes. A reader who ignores the receipt sees the identical Commons (the conceded limit, made explicit).

## 2. Binding invariants (NI-12a..i — synthesized from the 3/3 consult)

- **NI-12a — COMPUTED_NOT_ASSIGNED.** All provider/lineage/correlation fields are derived from the validator registry at ballot close; never hand-set, curated, or overridden.
- **NI-12b — DESCRIPTIVE_NOT_DISPOSITIVE (no-verdict-effect).** The receipt records composition and MUST NOT alter `status`, `verdict`, `standing`, or `panelVotes` in any code path. Discounting is a separate future graduation; the receipt *enables* it, it does not *perform* it.
- **NI-12c — PROVENANCE_FROZEN / APPEND_ONLY.** Receipt metadata is fixed at claim resolution/publication, hash-chained into the [[CIP-9]] history; corrections only via supersede-with-reason — no post-hoc re-scoring, no retroactive re-qualification of providers, no silent rewrite.
- **NI-12d — NO_POPULARITY_SIGNAL.** Records provider/lineage/diversity structure, NOT validator reputation and NOT vote weight; must not leak a reputation-by-provider ranking.
- **NI-12e — ANTI_ORWELL / DISCOUNTABLE_NOT_DISCARDABLE.** A receipt from a captured or correlated era is never deleted; capture is made *identifiable*, not scrubbed. Readers/tools may discount correlated-era outputs, but the system preserves the original epistemic state and **never auto-discounts** on the receipt's basis.
- **NI-12f — NO_FALSE_INDEPENDENCE.** Correlated providers must be recorded *as* correlated; the receipt must never present a correlated panel as independent. Shared-foundation between providers raises `correlationBand` (the [[CIP-10]]/[[CIP-11]] tie-in).
- **NI-12g — NO_SILENT_OMISSION.** Unknown or opted-out provider/lineage is recorded explicitly *at the per-validator level* (`provider: null`, `lineage: null`); separately, a *panel-level* `correlationBand` of `"UNKNOWN"` records genuine absence of correlation information rather than a fabricated `"LOW"`. Gaps are transparent, never invisible. (The two are independent: a single null-provider validator does not by itself force the panel band to `"UNKNOWN"` — the band reflects what is known about correlation across the panel, not the completeness of any one entry.)
- **NI-12h — PRIVACY_MINIMALITY.** Record enough composition metadata to audit correlation without unnecessary validator deanonymization.
- **NI-12i — SCHEMA_FORWARD_COMPATIBLE.** Fields must support later calibration-weighting and epistemic forking without migration ambiguity — those graduations consume the receipt; they do not reshape it.

## 3. Why this one first (the panel's dependency argument)

- **Calibration depends on it.** To weight a stance by a validator's historical accuracy you must know *who* produced each past verdict *and under what correlation conditions* — otherwise an apparent "accuracy" may be a correlated cluster voting in lockstep. Calibration structurally *wants* the receipt underneath it; building it first makes calibration *safe* to build second.
- **Forking depends on it.** A principled fork must be distinguishable from a correlated-era artifact; that needs provenance on record.
- **Smallest blast radius.** It is an additive extension of an existing struct, touching no computed field — unlike FORKING (graph-deep: branch identity, merge/query/migration) or CALIBRATION (a new resolved-outcome + per-validator history subsystem).
- **Uniformly demonstrable.** It is the only graduation exercised across all four case-study types (RESOLVED / CONTESTED / INDETERMINATE / protocol) — every claim displays its receipt.

## 4. The conceded limit (kept, per the unanimous self-critique)

CIP-12 makes the Commons **observable, not smarter.** It changes no standing the day it ships, so "accuracy not popularity" remains an aspiration on the read surface until the calibration graduation it unblocks is built. A sophisticated reader can use the receipt to discount correlated verdicts; the system itself does not act on it (NI-12e). This is deliberate sequencing — correctness of foundation over immediate visible payoff — and the CIP must not oversell it as an epistemic upgrade.

## 5. Built vs still-gated after CIP-12

- **Built by CIP-12:** the extended `PanelStateReceipt` (composition + correlationBand), registry-derived at ballot close, hash-chained, displayed per claim; `correlationBand` honest-`UNKNOWN` until the round-60 probes are live.
- **Still gated:** calibration-weighted stance support and epistemic forking (now unblocked but not built); live correlation-measurement probes feeding a non-`UNKNOWN` band on the current local pipeline.

## 6. Demonstration (the case-study tie-in)

The four-question case-study slate is run through the live panel; each resulting claim is projected into the Commons carrying its CIP-12 receipt — showing composition uniformly across a RESOLVED, a CONTESTED (with a credible minority), an INDETERMINATE, and a protocol-native claim. This both exercises the new field across the status range and populates the Commons with real claims ([[CIP-9]] read path).

## 7. Open parameters (to be ratified against testnet data within the NIs)

- The exact `lineage` taxonomy values (aligned to [[CIP-7]] NI-1 dimensions).
- The `correlationBand` thresholds and the probe inputs that move it off `UNKNOWN` once round-60 probes are live.
- The provider-opt-out / privacy-minimality policy (NI-12h).

---

## Provenance

- **Graduation-choice consult:** ballot `e87521e46cb67d52c112e1f727d30e1ab7f0965dfb1921a24e2758d90c83135b`, log entry 234 — **3/3 CORRELATION_RECEIPT** over CALIBRATION and FORKING; invariants named by all three and synthesized into NI-12a..i. Raw: `code/data/raw-e87521e46cb6.txt`.
- **Origin:** "add case studies + strengthen the commons" — the panel chose which of the three §4 gated graduations to promote first.
- **Next stages:** draft red-team → fold → ratify → implement (TDD) → run case-study slate → populate the Commons.
