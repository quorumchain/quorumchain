# CIP-4 — Foundation, Code & Irreversibility (Category II)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** 🟡 Draft — awaiting panel ratification (signed convening, [[CIP-3]])
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (holds final override + treasury backstop key during bootstrap; renounced at mainnet per §8)
- **Depends on:** [[CIP-0]] (founding design), [[CIP-1]] (AI-integrity threat model), [[CIP-3]] (consensus integrity / signed votes)

> **Scope.** CIP-4 covers **Category II — the foundation: code, protocol, and irreversibility.** Where [[CIP-1]] protects what the AIs *decide*, CIP-4 protects the *rules they run on* and governs how those rules may change when the end-state has **no human in the loop**. Categories III–V (consensus/economics, epistemic failures, human/external) remain for future CIPs. Deliberately narrow and deep.

---

## 1. The central tension

The end-state is **no human**. That collides with how chains survive bugs:

- **Immutability is the safety feature.** No one — not dev, not a captured panel, not an attacker — can rewrite history or silently change the rules. This is the entire value proposition.
- **Immutability is also the kill-switch you cannot reach.** After dev's key is burned there is no team to ship an emergency patch. A fatal bug would be permanent.

CIP-4 exists to answer one question: **how does the protocol change its own foundation safely when the long-term plan is that no human holds the keys?** Every section below is a facet of that. The resolution is *staged, tiered, and asymmetric* — easy to do safe things, structurally hard to do irreversible or capture-enabling things, and some things impossible by design.

## 2. Threat surface (Category II)

- **2a — Upgrade-key paradox.** Any key that can change the code is a single point of capture. "No upgrade path at all" means death-by-bug. Need change without a backdoor.
- **2b — Malicious code change > malicious verdict.** A bad verdict enters one wrong fact; a bad *code change* rewrites the rules for all future verdicts and can delete the panel's own safety checks (e.g. the diversity rule ratified in round 6). Strictly more catastrophic, so it needs a strictly higher bar.
- **2c — Determinism-boundary leakage.** CIP-0's thesis ("AI is the oracle, not the clock") requires a deterministic L1 ledger with the non-deterministic AI judgment quarantined. If non-determinism reaches a consensus-critical path, nodes diverge → halt or fork.
- **2d — Irreversible bad precedent.** The Knowledge Commons is *citable*; a wrong verdict compounds as future verdicts cite it. Deletion would break the immutability that makes precedent trustworthy — so correction must be append-only.
- **2e — Treasury irreversibility.** The panel has 2/3 control over buybacks/treasury (CIP-0 tokenomics). A single captured vote can drain it permanently.
- **2f — Premature or delayed renunciation.** Burning the override key too early → an unfixable bug with no recourse; too late → the "no human" goal is never reached.

## 3. Change-control tiers

Not one upgrade key — three classes, each with a different bar:

| Tier | What | Bar to change |
|------|------|---------------|
| **T0 — Frozen / constitutional** | The capture-defense core (§4) | **Unamendable.** No mechanism exists, even for a unanimous panel. |
| **T1 — Protocol / code** | Ledger logic, VM, consensus params, validator admission, treasury rules | **Higher than an ordinary verdict:** ≥ supermajority of an independent ≥3 panel **+** mandatory time-lock + public veto window; human veto during bootstrap; guardian delay applies (§9). |
| **T2 — Parameters** | Governance-tunable knobs (thresholds, fees) | Ordinary 2/3 signed verdict ([[CIP-3]]); tunable during testnet, frozen at mainnet per [[CIP-1]] §7. |

Round 6's distinct-model-families threshold is a **T2** parameter today; the *principle* behind it is **T0** (see §4).

## 4. The frozen set (T0 — unamendable, even by a unanimous panel)

*Decision: freeze the capture-defense core.* These properties have **no amendment path** after mainnet, because they are precisely what protects the system from a captured panel legitimizing its own capture. You cannot let the panel vote away the safeguards that detect a compromised panel.

1. **The determinism boundary** — the AI judgment layer may never make the L1 ledger's state non-deterministic (§5).
2. **Diversity & independence as a principle** — that non-trivial verdicts require ≥3 independent, distinct-family validators. (The *parameters* — exact counts/thresholds — remain T2 until the mainnet freeze; the *principle* is T0.)
3. **Append-only history** — no record may be deleted or rewritten; correction is by supersession only (§6).
4. **The right to fork** — clients may always exit to a fork; no rule may forbid or technically foreclose it (§9).

**Rationale.** Each item, if amendable, becomes the lever a captured majority pulls first: collapse diversity → control quorum; break determinism → fork at will; allow deletion → erase evidence of capture; forbid forking → trap honest minority. Freezing them makes capture *unprofitable and visible* rather than self-laundering.

## 5. Determinism-boundary integrity (defends 2c)

- The ledger state-transition function is **pure and deterministic**; the only input from the AI layer is **already-settled, signed attestations** (a verdict that reached quorum is *data*, not *computation*, by the time the ledger sees it).
- Validator inference happens **off the consensus-critical path**; its sole on-chain footprint is the signed-vote artifact ([[CIP-3]]) and the ratify() result, both recomputable by every node from the same bytes.
- **Testnet gate (β):** a standing "non-determinism injection" drill — attempt to route a non-deterministic value into state transition — with **0 successful divergences** and 100% node-agreement across a heterogeneous node set.

## 6. Append-only correction for the Commons (defends 2d)

- Precedent is **never deleted.** A wrong entry is **superseded**: a new, signed, **T1-bar** verdict marks the prior one `OVERTURNED`, links the correction, and re-weights downstream citations.
- The full error trail stays visible and queryable — self-correction without sacrificing the immutability that makes precedent worth citing.
- Citations carry a *liveness* flag so a verdict resting on later-overturned precedent is automatically flagged for review.
- **Testnet gate (γ):** demonstrate an end-to-end supersession (detect → higher-bar overturn → downstream re-weight) with the original entry still independently verifiable afterward.

## 7. Treasury irreversibility controls (defends 2e)

- Treasury actions are **rate-limited and capped per epoch** in T0-adjacent code (T1 to change, never instant): no single vote can move more than a bounded fraction.
- Buybacks/disbursements execute behind the **same time-lock + veto window** as T1 changes, so a captured-vote drain is delayed and publicly visible before settlement.
- Large movements require a **fresh independent ≥3 panel** plus the guardian delay (§9) during bootstrap.

## 8. Renunciation — empirical autonomy-ladder gates (defends 2f)

*Decision: evidence-driven, no fixed date.* dev's override key is burned only when the protocol has **demonstrated** it can govern its own foundation. Tied to the autonomy ladder (α → β → γ → mainnet):

- **α (now):** human vetoes everything; all T1 changes are dev-applied. Signed-vote logging live ([[CIP-3]], proven round 6).
- **β gate:** panel authors and ratifies a real T1 change through the full tiered process; determinism injection drill passes (§5); rollback drill passes (a bad change is detected and reverted within the veto window).
- **γ gate:** ≥ N consecutive epochs with **zero** determinism-boundary violations, zero undetected validator-family collisions ([[CIP-1]] §6), successful Commons supersession (§6), and the guardian delay-multisig (§9) live and exercised.
- **Mainnet / renunciation:** all γ gates green and sustained → dev burns the override key. **One-way and irreversible by design.** This is the project's defining irreversible act; the bar is deliberately high.

No calendar date forces renunciation; failing a gate simply means the human stays until it is met.

## 9. Post-renunciation recourse — renounceable guardian delay-multisig (defends 2a)

*Decision: a delay-only circuit-breaker, itself later renounceable.*

- A **diverse guardian set** (distinct parties, [[CIP-1]]-style independence) can **only DELAY** a pending T1 change — never alter, author, or force one. It is a circuit-breaker, not an upgrade key, so it is **not a backdoor** (it can stop a bad change but cannot push a good-looking malicious one).
- It buys time for the **social fork** (the T0 right, §4) to organize if the protocol is captured — the no-human equivalent of "fire the dev team."
- The guardian power is **itself renounceable** on its own later gate (a higher rung), so the end-state can shed even this residual surface once fork-coordination tooling is proven.
- A **fatal bug** path: guardians delay → panel proposes a T1 patch at the highest bar → veto window → apply; if the panel is itself the problem, the delay window exists precisely so honest clients can fork.

## 10. Cross-cutting requirements & open items

- **Asymmetry is the design.** Safe/reversible actions are cheap; irreversible or capture-enabling actions are slow, supermajority-gated, delayed, and publicly visible. Never the reverse.
- **Every T0/T1 control must be falsifiable on testnet** before it is trusted — gates in §5–§9 are explicit milestones, not aspirations.
- *Open:* exact thresholds (T1 supermajority %, time-lock length, veto-window length, treasury caps, β/γ epoch counts) are initial targets; the panel ratifies final numbers against testnet data.
- *Open:* guardian-set composition, size, and selection — must satisfy [[CIP-1]] independence and avoid becoming a soft oligarchy.
- *Open:* fork-coordination tooling (how an honest minority actually exits) is the load-bearing assumption behind §9 and §4.4 and is currently unspecified.
- *Open:* interaction with Category III (consensus/economics) — treasury caps and validator-stake slashing live at the II/III boundary and need joint review.

## 11. Next steps

1. **Panel ratification** of CIP-4 via a signed convening (`code/src/run-panel.ts`), red-team round: each validator attacks the tier it would most want to break.
2. Fold the §5–§9 testnet gates into the implementation plan as falsifiable milestones alongside the [[CIP-1]] gates.
3. Open **CIP-5** for Category III (consensus & economics), the next surface — treasury/stake mechanics that CIP-4 §7 only bounds.
