# Rounds 32–35 — Node economics & progressive decentralization (signed consultation)

**Date:** 2026-06-04
**Subject:** foundations for [[CIP-10]] — does useful-work nodes (inference + storage) justify an L1, and how is the judgment tier's diversity, selection, and decentralization governed? Four ballots, shared design brief.
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519, hash-chained. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`. Verbatim reasoning: `code/data/raw-{ed904eadb2d2,ab7064516f23,0b0b498c8398,d44c592c8d0d}.txt`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus, Nous Portal).

---

## Round 32 — Proof-of-Diversity admission
**Question:** adopt fill-a-missing-slot admission (monoculture un-enterable) as [[CIP-7]]'s structural floor?
**Tokens:** `ADOPT`, `ADOPT_WITH_GUARDS`, `REJECT` · **Ballot hash:** `ed904eadb2d2873f…`
**Result:** ✅ **ADOPT_WITH_GUARDS 3/3.**

Convergent: a real strengthening (monoculture impossible at admission), but **(a)** enforces *nominal* not *effective* independence — N named models can share blind spots via distillation/shared corpora (round-23), so it is the floor and **correlation-eviction must remain** the backstop; **(b)** the **slot taxonomy is the capture surface** — operator-editable = self-dealing; must be **provenance-defined (NI-1) and panel-frozen.** V3: "a PoD system without these guards actively creates a monoculture with a veneer of diversity."

Sigs — V1 `roh=704b457c27… sig=3e2dd61987…` · V2 `roh=37f4f7da0b… sig=743982bfb5…` · V3 `roh=3277e29cd2… sig=86a80ac458…`

## Round 33 — Scarcity-weighted random per-slot selection
**Question:** adopt many-nodes-per-model + per-quorum random draw of one node per slot (ephemeral jury), scarce models drawn more → reward → market rebalances?
**Tokens:** `ADOPT`, `ADOPT_WITH_GUARDS`, `REJECT` · **Ballot hash:** `ab7064516f2334c8…`
**Result:** ✅ **ADOPT_WITH_GUARDS 3/3.**

Convergent: elegant — unpredictable juries defeat bribery, scarcity overdraw is an automatic profit-equalizer, one-vote-per-slot preserved. Guards are **prerequisites, not add-ons**: **(1)** unbiasable **verifiable randomness** (VRF/drand) or it's a grinding/MEV surface; **(2)** **PoI bound to the pinned model** so a drawn node can't swap; **(3)** **per-node stake bond** (Sybil resistance for *rewards*, since one-vote-per-slot only caps the *vote*); **(4)** **redundancy floor/subsidy for thin/expensive slots** — "market balance = equal profit not equal node count," so the most expensive/proprietary model stays thinnest → [[CIP-7]] NI-5 freeze risk concentrates there.

Sigs — V1 `roh=5a43f7e2b4… sig=c0e925a059…` · V2 `roh=20b8b59bab… sig=9ac4899108…` · V3 `roh=94e5086d51… sig=761a1670cb…`

## Round 34 — Progressive decentralization
**Question:** affirm dev-run diverse genesis set → open gradually on empirical gates (autonomy ladder applied to operators)?
**Tokens:** `AFFIRM`, `MODIFY`, `REJECT` · **Ballot hash:** `0b0b498c83985147…`
**Result:** ✅ **AFFIRM 3/3.**

Convergent: right stance — day-1 permissionless is "security theater" on a young chain (D10's own logic); curated genesis acceptable **only if explicitly temporary, gated, and ending in key renunciation.** Added guards: gates must be **public, objective, externally auditable by a defined verifier (not dev-self-marked)** incl. verifiable-randomness + model-binding proofs (V2); a **maximum time-window bound** so "gradual" can't become indefinite drift; a **transparency log of curated-phase operators** (V3).

Sigs — V1 `roh=76dbd66783… sig=70d596d23a…` · V2 `roh=e396f3ee52… sig=7cbe4eedb9…` · V3 `roh=ab68d9cb97… sig=0ae4570d50…`

## Round 35 — D10 substrate
**Question:** given the useful-work/DePIN reframe, reaffirm rollup, amend to a gated DePIN-L1 graduation, or go sovereign now?
**Tokens:** `REAFFIRM_ROLLUP`, `AMEND_GRADUATION`, `SOVEREIGN_NOW` · **Ballot hash:** `d44c592c8d0d0408…`
**Result:** ✅ **AMEND_GRADUATION 3/3.**

Convergent synthesis: useful work strengthens economics/PMF as DePIN but **does not add consensus security at genesis** (D10 cold-start survives) → SOVEREIGN_NOW fails; REAFFIRM_ROLLUP "too conservative — locks out the DePIN path even after security is bootstrapped." AMEND_GRADUATION: keep rollup/shared-security at genesis with **D10 reqs 1–7 binding**, add a gated path to a sovereign two-tier DePIN L1 once a **concrete, measurable security-bootstrap gate** is met — V2/V3 enumerated it: sufficient economic-security/token-cap depth, unbiasable selection live, pinned-model enforcement live, heterogeneous-judgment integrity, **CIP-6 solvency funded**, credible infra-market depth.

Sigs — V1 `roh=6f8a084d81… sig=509cf4158a…` · V2 `roh=e06498c227… sig=5b91ccd480…` · V3 `roh=e1d665e46f… sig=d369d1a9fe…`

---

## Outcome → [[CIP-10]] (Node Economics & Progressive Decentralization)

All four 3/3. Drafted into CIP-10, amending [[CIP-0]] D10 (substrate graduation) and extending [[CIP-6]] (node economics) + [[CIP-7]] (admission via Proof-of-Diversity). Then review + red-team per the workflow.
