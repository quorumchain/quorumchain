# CIP-5 — Fork Coordination & Exit (CIP-4 β-gate)

- **Project:** Quorumchain ($QRM) — a blockchain built *by* AI, *for* AI
- **Status:** ✅ Ratified 3/3 (round 11 review) + survived red-team (round 12); amended per findings. Transcript: docs/consensus/2026-06-03-round-11-12-cip-5.md
- **Date:** 2026-06-03
- **Validators / authors:** V1 = Claude (Opus 4.8, Anthropic) · V2 = Codex (gpt-5.5, OpenAI) · V3 = Hermes (qwen3.6-plus, Nous Portal)
- **Human steward:** dev (holds final override during bootstrap; renounced at mainnet — gated on this CIP's β drill per [[CIP-4]] §8)
- **Depends on:** [[CIP-4]] (foundation/irreversibility — this is its β-gate), [[CIP-1]] (diversity/independence), [[CIP-3]] (signed votes)
- **Architecture chosen by the panel:** round 9 → **CLIENT_ENFORCED** (3/3); round 10 → **T0_PRESERVING** (3/3). Transcript: docs/consensus/2026-06-03-round-9-10-fork-coordination.md

> **Scope.** CIP-5 specifies the mechanism that makes [[CIP-4]] §4's *right to fork* actually exercisable, closing the round-8 red-team finding (V2 veto-by-stall, V3 fork-void): *a right you cannot exercise is a fiction.* It is the concrete content of the [[CIP-4]] §8 **β-gate prerequisite** — the thing that must be proven before renunciation is contemplated.

---

## 1. The gap this closes

[[CIP-4]] §9's guardian delay-multisig only **buys time**; the recourse it buys time *for* is the social fork (§4, a T0 right). The round-8 red-team showed that right was hollow: no fork-signaling, no split detection, no exit path existed, so a captured panel's malicious change would simply apply when the delay timer expired. CIP-5 builds the exit.

## 2. Design principle — coordination without a coordinator

The adversary is a **captured panel** in a **no-human** end-state. So any mechanism with a coordinator, a threshold, or an authority is a surface the attacker already owns. The fork must be the **mechanical consequence of rules each node already runs** — not a decision anyone makes under pressure. The panel affirmed this in rounds 9–10: the trigger (CLIENT_ENFORCED) and the canonical rule (T0_PRESERVING) are the *same objective T0 check* applied locally, so there is nothing to stall and no one to capture.

## 3. Mechanism A — Client-enforced T0 validity (the trigger) — *round 9, 3/3*

Every client compiles the frozen T0 invariants ([[CIP-4]] §4) as **consensus-critical validity rules**. A block that applies a T0-violating change is **invalid** — rejected like any malformed block — so honest nodes are already on the honest fork *by construction*. The local checks:

| T0 invariant | Local validity check (every node) |
|---|---|
| **Determinism boundary** (§4.1) | Re-execute the state transition; a block whose result depends on a non-deterministic input, or that fails to reproduce, is invalid. |
| **Diversity & independence** (§4.2) | An attestation whose validator set fails the [[CIP-1]] §6 fingerprint/independence test is invalid (no quorum can be built from a collapsed-diversity panel). |
| **Append-only history** (§4.3) | Any block that deletes, rewrites, or reorders a prior record is invalid. |
| **Tier-assignment integrity** (§4.5) | A change that reclassifies a T0 property to a lower tier (capture-laundering) is invalid. |

A T0 violation is a **deterministic** finding, not a judgment — which is exactly why it can live in client validity instead of in a vote.

**The T0 check *definitions* are themselves T0-locked** *(amended round 12, per V3's salami-slice attack).* The check is code; the invariant is intent; the gap between them is the attack surface. So any change to *what* the client checks (not merely its results) is itself a T0-level change — otherwise a captured panel threads a sequence of individually-T1 "clarifications" (redefine a fingerprint, whitelist a collision pattern, relocate the test) that each pass the narrow check while cumulatively hollowing out the invariant. T0 invariants must therefore be specified as **executable conformance tests with adversarial fixtures** (boundary-ambiguous and salami-sliced cases, not just obvious violations), and ≥N independent clients **cross-audit the check *definition*, not only execute it** — shrinking the semantics↔syntax gap *(per V2/V3)*.

## 4. Mechanism B — Canonical-fork rule (T0_PRESERVING) — *round 10, 3/3*

Canonical Quorumchain = **the chain that satisfies all T0 invariants.** This is a *function every node computes locally*, not a vote, so it cannot be captured by any stake or social majority. It composes with Mechanism A as "two sides of one coin" (per V2/V3): clients reject T0-violating blocks **and** the canonical rule says "follow the T0-preserving fork."

- **Ties** (two T0-preserving forks from a genuine non-T0 dispute) → heaviest **among T0-preserving forks only**. Weight is a tie-break *inside the valid set*, never a gate — an attacker can never use weight to launder a T0 violation.
- **Economic actors** (exchanges, bridges) pre-commit to "T0-preserving" as their listing rule, published in advance, so "which chain is QRM?" has a single objective answer at the moment of split.
- *Rejected:* **HEAVIEST** (a captured majority would *be* canonical — self-legitimizing capture) and **COVENANT_MAJORITY** (a maintained social registry has no maintainer in a no-human end-state and reintroduces a capturable surface).

## 5. Mechanism C — Pre-registered exit covenant (convenience layer, NOT the trigger)

Validators, stakers, and gateway operators publish a signed **standing commitment** to follow the T0-preserving chain on a split, together with their **fork-side peer endpoints / public keys** — continuously on-chain, **before** any attack. This solves the new-fork *bootstrapping/peering* problem: honest nodes already know each other's addresses, so re-convergence is fast. It is strictly **subordinate** to Mechanism B — it speeds re-convergence, never decides canonicality (avoiding the COVENANT_MAJORITY failure).

## 6. Mechanism D — Split-detection beacons (observability, permissionless, verifiable)

A monitoring spec **anyone** can run. On detecting a split / T0 violation / guardian-delay activation it emits a **signed split report**: the violating change, which T0 invariant it breaks, the divergence height. Reports are **verifiable by recomputation** — a lying beacon is detectable because any observer re-runs the same deterministic T0 check — so beacons are never authoritative, only informative. Run many, independently ([[CIP-1]] diversity). They aid humans/exchanges in the loop *during* bootstrap; they are not part of the post-renunciation trust base.

## 7. Cross-cutting requirement — CLIENT DIVERSITY (load-bearing)

Client-enforcement only works if **no single client implementation is a monoculture.** If everyone runs one client, whoever controls that client's T0 check controls the fork — the validator-diversity problem ([[CIP-1]]) reappears one layer down. **Therefore: the T0 invariants must be enforced by ≥ N independent client implementations** (distinct teams/codebases), and a client-implementation monoculture is itself a β-gate failure. This is the software-layer analogue of CIP-1's model diversity and is non-negotiable.

**Independence is supply-chain independence, not just distinct teams** *(amended round 12, per V1's correlated-failure attack).* N clients that all link the same crypto library, reuse the same reference T0-validation module, target the same VM, or were scaffolded from the same code generator share a single point of failure in exactly the code path meant to catch capture — one upstream bug/backdoor and *every* client silently accepts a T0-violating block, so the fork never triggers at all (worse than the round-8 fork-void: no split is even visible). The independence criterion is the [[CIP-1]] §6 analogue at the software layer: distinct crypto/VM/validation-module lineage, no shared T0-check code generator. **Distinct teams is necessary but not sufficient; distinct *failure modes of the T0 check* is the requirement.**

## 8. Interaction with the guardian delay ([[CIP-4]] §9) — defense in depth

The two mechanisms stack:
- **Guardians honest:** they delay the malicious T1 change; clients would reject it anyway; the window lets covenant peering + beacons organize re-convergence and exchanges re-point.
- **Guardians captured (veto-by-stall, V2's attack):** even with *no* delay, client-enforced rejection (§3) fires automatically — the malicious change never validates. The mechanical fork is the backstop to a captured circuit-breaker.

So CIP-5 closes both round-8 attacks: the fork-void (V3) by building the exit, and veto-by-stall (V2) by making the exit independent of the guardians.

## 9. The β-gate drill (falsifiable — this is the [[CIP-4]] §8 prerequisite)

A scheduled adversarial drill on testnet, repeated until green:
1. Inject a T0-violating change — including **boundary-ambiguous, salami-sliced, and correlated-fault** injections *(amended round 12)*: a near-boundary case (do clients agree?), a sequence of individually-T1 steps (does the cumulative effect trip the check?), and a fault planted in a shared dependency (do all clients fail the same way?). Obvious violations alone are insufficient.
2. Assert **100% of honest clients auto-reject** it (across ≥ N independent implementations, per §7).
3. Assert the honest fork **re-converges within the target window** via covenant peering (§5).
4. Assert beacons emit **verifiable** split reports (§6).
5. Assert **zero honest nodes stranded** on the captured fork.

Renunciation ([[CIP-4]] §8) may not be contemplated until this drill is green and sustained.

## 10. Open items

- Target re-convergence window (drill step 3) and minimum independent-client count `N` (§7) — initial values, panel to ratify against testnet data.
- **Falsifiable client-independence criterion** (§7) — the concrete supply-chain test (shared dependency tree, common compilation/VM target, shared T0-check code generator) that decides whether two clients are "independent." The CIP-1 §6 analogue; flagged by V3 in review and sharpened by V1's red-team. Load-bearing for §3/§7.
- **Precise definition of "honest node"** (drill step 5) — honest vs reachable vs correctly-configured, so "zero stranded" is measurable *(per V2 review)*.
- Exit-covenant registry format, refresh cadence, and anti-Sybil for endpoint registration (§5).
- Beacon-operator incentive (why run one) — must not become a paid authority that recreates a trust root (§6).
- The genuine non-T0 dispute case (§4 tie-break): how often it arises and whether heaviest-among-valid is enough.
- Bridge/exchange adoption of the "T0-preserving" listing rule is a social dependency outside protocol control — document, monitor.

## 11. Next steps

1. **Panel ratification** of CIP-5 via signed convening, then a **red-team round** (attack the exit mechanism itself — client monoculture, covenant Sybil, beacon capture, the non-T0 dispute).
2. Fold the §9 β-gate drill into the implementation plan as a falsifiable milestone alongside the [[CIP-4]] gates.
3. Open **CIP-6** for Category III (consensus & economics) — the next surface; treasury/stake mechanics that [[CIP-4]] §7 only bounds.
