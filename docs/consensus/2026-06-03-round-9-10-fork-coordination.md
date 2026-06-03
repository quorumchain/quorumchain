# Rounds 9–10 — fork-coordination architecture (signed consultation)

**Date:** 2026-06-03
**Subject:** [[CIP-5]] — Fork Coordination & Exit (the [[CIP-4]] §8 β-gate). dev deferred both architecture decisions to the panel ("consult with the panel to determine this").
**Mechanism:** multiple-choice signed-vote convening via `code/src/run-panel.ts` (`QRM_VERDICTS`), [[CIP-3]]. Each verdict is an Ed25519 signature over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained in the vote log. Public keys: see `docs/consensus/2026-06-03-round-6-distinct-model-families.md`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus).

Both rounds **unanimous 3/3**. The two choices compose into one objective mechanism: clients reject T0-violating blocks (trigger) and the canonical chain is the T0-preserving one (selection) — "two sides of the same coin."

---

## Round 9 — fork TRIGGER model

**Options:** `CLIENT_ENFORCED` · `SIGNALED` · `BEACON`
**Ballot hash:** `d3de540c8685a598d4d95f252d564b286c117b408311b7ff7b0808930d90ed50`
**Result:** ✅ **CLIENT_ENFORCED, 3/3.**

- **V1 (Claude):** Any mechanism with a coordinator/threshold/authority is a surface the captured panel already owns. SIGNALED can be stalled/flooded; BEACON reintroduces the capturable trust root CIP-4 deleted. CLIENT_ENFORCED is leaderless by construction — a T0-violating block is simply invalid, so honest nodes are already on the honest fork. Turns §4's "right to fork" from a legal fiction into a mechanical guarantee.
- **V2 (Codex):** Trigger should be embedded in client validity, not social coordination. T0 invariants are objectively checkable and there is no human coordinator, so clients locally reject T0-violating changes — automatic, leaderless, resistant to threshold games or beacon capture.
- **V3 (Hermes):** BEACON "kicks the can down one hallway" — a diverse beacon set is just a re-created panel vulnerable to the same attack. SIGNALED is stallable/Sybil-able by the captor controlling the channel. CLIENT_ENFORCED has zero coordination surface, zero capturable coordinator, nothing to stall.

Sigs — V1 `roh=bc43e67adb92… sig=d8dbad6c53a7…` · V2 `roh=a229611a030e… sig=ef9313a84efc…` · V3 `roh=0574e7b8666c… sig=987e57698227…`

## Round 10 — CANONICAL-fork rule

**Options:** `T0_PRESERVING` · `COVENANT_MAJORITY` · `HEAVIEST`
**Ballot hash:** `d0cfa8dd48e2c6214e86a7d7ed294209fddab025ceaf13cfe77f1b87b3e73812`
**Result:** ✅ **T0_PRESERVING, 3/3.**

- **V1 (Claude):** Must compose with round 9. HEAVIEST hands the attacker canonical status by definition (self-legitimizing capture). COVENANT_MAJORITY is still a vote — a maintainable, Sybil-able, coercible surface. T0_PRESERVING is a *function, not a vote*; same T0 check as the trigger, so the two layers can't diverge. Ties → heaviest among T0-preserving forks only.
- **V2 (Codex):** HEAVIEST lets captured stake/work define legitimacy, defeating the threat model. COVENANT_MAJORITY reintroduces a maintained social registry into a no-human end-state. T0_PRESERVING stays local, objective, β-gate-aligned: preserve T0 first, use weight only inside the valid set.
- **V3 (Hermes):** HEAVIEST is "dead" — capture becomes canonical. COVENANT_MAJORITY has nobody to maintain the registry post-renunciation and contradicts the mechanical client check. T0_PRESERVING composes directly with CLIENT_ENFORCED: a deterministic function uncapturable by any stake or social influence. "The defense is uniform: everyone uses the same objective rule, applied the same way, forever."

Sigs — V1 `roh=b98d7fc3307d… sig=992a01545eaa…` · V2 `roh=ada055726b07… sig=a3a7b6d6d55a…` · V3 `roh=fa9de13bce39… sig=2f2ff029f399…`

---

## Outcome

The panel set CIP-5's architecture: **CLIENT_ENFORCED trigger + T0_PRESERVING canonical rule**, one objective mechanism with no capturable coordinator. Drafted into [[CIP-5]]; the spec adds the load-bearing **client-diversity** requirement (§7 — the T0 check must itself be implemented by ≥N independent clients, or the enforcement layer is a monoculture) and the falsifiable **β-gate drill** (§9). Next: ratification + red-team of CIP-5.
