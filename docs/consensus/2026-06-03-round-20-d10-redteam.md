# Round 20 — D10 substrate red-team (signed)

**Date:** 2026-06-03
**Subject:** adversarial round on [[CIP-0]] D10 (substrate = appchain/rollup, ratified round 19). Does it still hold, and what must become non-negotiable?
**Mechanism:** signed-vote convening via `code/src/run-panel.ts` ([[CIP-3]]); Ed25519 over `{validatorId, ballotHash, verdict, sha256(rawOutput)}`, hash-chained. Public keys: `docs/consensus/2026-06-03-round-6-distinct-model-families.md`.
**Validators:** V1 Claude (Anthropic) · V2 Codex (OpenAI) · V3 Hermes (qwen3.6-plus).

**Ballot hash:** `61c5ed0d29edb7bbe7804227b97a174604a2f0e5831773fc138e7c54957a3739`
**Result:** ✅ **YES 3/3 — D10 holds, conditional on the requirements below becoming non-negotiable.**

**Convergent finding:** a *typical* rollup reintroduces exactly the privileged human/coordinator surfaces CIP-3/4/5 exist to remove — **its "training wheels" are the capture surface.** D10 survives only because the alternatives fail the same deciding criterion (CONTRACT_ON_L1 can't own validity; SOVEREIGN_L1 bootstraps security from zero → captured validators).

### Attacks
- **V1 (Claude) — "the rollup rebuilds the orchestrator":** centralized sequencer can censor a challenge / fork-signal; the off-the-shelf rollup ships a security-council upgrade key (a literal human backdoor vs CIP-4 renunciation); the bridge holds the reserve (#1 hack class); CIP-5's escape hatch is slow and base-layer-conditional. Sharpest: round 19 *bundled* "appchain/rollup" — a sovereign appchain inherits no security (V3's SOVEREIGN_L1 critique bites), so the inherited-security benefit only exists for the rollup/shared-security flavor, which was unspecified.
- **V2 (Codex) — "Rollup Control-Plane Capture":** sequencer censor/reorder; security-council bypass of the frozen core; bridge as treasury choke point; base-layer governance failure modes; forced-inclusion "on paper" if latency outruns governance rounds. Holds because the deciding criterion is still control of validity rules — "only if 'rollup' does not mean discretionary operators with training wheels forever."
- **V3 (Hermes) — "Training Wheels Are the Capture Surface" (empirical):** every production rollup today ships a single sequencer, a proxy-admin/security-council multisig that can upgrade the STF / pause the bridge / override forced-inclusion, a bridge that's the most-exploited component, and hours-not-seconds forced-inclusion latency. Named the **decentralization-roadmap gamble**: "we'll decentralize later" is a gamble every rollup has so far failed, and the transition is itself an attack window. Holds because the alternatives fail the primary criterion; the attacks are *operational requirements*, not architectural disqualifiers.

Sigs — V1 `roh=7bc0ef54383b… sig=3fdddcafe695…` · V2 `roh=1b238bb453d9… sig=58ae1dc221c0…` · V3 `roh=20066ee58ec4… sig=afffc650658a…`

---

## Outcome — D10 requirements (folded into [[CIP-0]])

D10 holds, now conditional on these **non-negotiable, framework-selection-gating** requirements (union of V1/V2/V3, deduped), each to be met **at genesis, not on a roadmap**:

1. **No privileged upgrade surface** over CIP-4/CIP-5-critical logic — immutable at deployment (or time-locked then burned).
2. **Sequencer censorship-resistance at genesis** (decentralized / fair-ordering / L1-inclusion), no governance finality that outruns the escape hatch.
3. **Bounded-latency forced-inclusion** — provable worst-case shorter than any challenge/governance window.
4. **Trust-minimized bridge / treasury custody** — no admin can hold the treasury hostage or override client rules.
5. **CIP-4 frozen core in client/STF**, never by operators/multisigs/social process.
6. **CIP-5 client-enforced fork supported by the stack** — custom, reproducible, forkable client.
7. **Flavor = rollup / shared-security only** — standalone sovereign appchain rejected (resolves the round-19 bundling gap).

The recurring lesson holds once more: the danger is a privileged surface the design assumed away. Round 20 turned "appchain/rollup" from a label into a spec.
