# Quorumchain ($QRM) — code

First working slice: the **signed-vote consensus primitive** (CIP-3). It turns
"the AIs reached 2/3 consensus" from an orchestrator-narrated *ceremony* into a
*protocol* anyone can independently recompute and audit.

## Why this exists

CIP-3 identified the project's deepest flaw: if a single orchestrator collects
votes and announces the result, that orchestrator *is* the trust root — it can
fabricate votes, drop dissent, or swap the question after the fact. The fix is
to make every vote a signed artifact and ratification a pure function of those
artifacts.

## Modules

- **`src/signed-vote.ts`** — the primitive.
  - `generateValidatorKey()` — Ed25519 keypair (PEM).
  - `ballotHash(prompt, context)` — hash binding the *full* question + evidence;
    a vote signs over this, so a validator can prove exactly what it was asked
    (defends the CIP-1 §1c bait-and-switch).
  - `signVote(...)` — Ed25519 signature over `validatorId + ballotHash + verdict
    + hash(rawOutput)`. The verbatim reasoning is hashed in, so it cannot be
    rewritten after signing.
  - `verifyVote(vote, pubkey)` — recomputes the output hash and checks the sig.
  - `findEquivocations(votes)` — flags a validator who signed two conflicting
    verdicts on one ballot (a CIP-3 §3 slashable offense).
  - `ratify(ballotHash, votes, keyring, quorum)` — the verifiable function.
    Rejects wrong-ballot, invalid-signature, unknown-validator, and equivocating
    votes; tallies one verdict per validator; returns `{ratified, verdict, tally,
    counted, rejected}`. The orchestrator cannot change this outcome.

- **`src/vote-log.ts`** — tamper-evident append-only log (CIP-3 §2/§5). Each
  entry is SHA-256 hash-chained to the previous one, so any edit, deletion, or
  reorder breaks `verifyLog()`. Interim "immutable transcript" substrate until
  on-chain hash-pinning lands.

- **`src/keystore.ts`** — persistent validator identities. `loadOrCreateKeyring`
  reuses on-disk Ed25519 keys (private keys `0600`) so a panel's signed log is
  meaningful across sessions.

- **`src/panel.ts`** — `convene()`, the function that replaces the
  orchestrator's narrated ceremony: it invokes each validator, signs their
  VERBATIM output, appends it to the log, and ratifies — all recomputable from
  the log afterward. `parseVerdict` pulls a `VERDICT: <token>` line out of
  free-text model output (absent → `NO_VERDICT`, still logged).

- **`src/run-panel.ts`** — the live wiring. Convenes the real validators
  (V1 Claude, V2 Codex, V3 Hermes) on one ballot:
  `node src/run-panel.ts "<question>" "<context>"`. V2/V3 shell out to the
  `codex`/`hermes` CLIs; V1 (the orchestrating Claude, which cannot subprocess
  itself) supplies its deliberation in `data/claude-vote.txt`. Keystore + log
  live under `data/` (git-ignored — holds private keys).

### CIP-8 — the Accountability Ledger (v0.1, built)

The first *product* slice, built on the same substrate (CIP-8 §6 KERNEL_FIRST).

- **`src/notary.ts`** — the **NOTARY-mode Staked Resolvable Attestation**: a
  signed, hash-chained, attributable record of a consequential AI action.
  `createAttestation` / `verifyAttestation` / `checkAttestation` (procedural
  *completeness + internal consistency + attributability* — never truth) plus a
  separate hash-chained attestation log. **Hard invariant NI-8a**: every record
  is structurally labeled `NOT_VERIFIED` — the kernel asserts authorship + timing
  + non-repudiation only, and has *no code path* that can mark a claim verified.
- **`src/replay.ts`** — the **frozen-ballot replay verifier** (CIP-8 §4).
  `recomputeBallotHash`, `tamperDelta` (gate G1: a post-hoc "additional context"
  edit provably changes the ballot hash), and `replayBallot` (gate G2: from the
  byte-exact frozen criteria + signed votes, recompute the hash, re-verify each
  signature, and re-ratify — reproducible by anyone).
- **`fixtures/ballot-r29-mstr.json`** — the byte-exact frozen ballot for the live
  $85M Polymarket MicroStrategy resolution (round 29). Recomputing its hash
  reproduces the published ballot hash `de9b2766…`, so the signed **YES 3/3**
  verdict is provably bound to exactly these criteria. (Persisting this preimage
  is the gap the kernel closes: the chain proved *integrity*, but the criteria
  were not independently *recomputable* until now.)
- **`src/notary-demo.ts`** — runs all three empirical gates end-to-end (G3 notary
  kernel, G1 integrity, G2 live round-29 replay against `data/votes.log`).
- **`src/bonds.ts`** (v0.2 — bonds & stake, the "teeth" graduation §6) — BOND
  mode of the SRA: `createBond`/`verifyBond` (a signed, staked commitment to a
  constraint, frozen to its criteria ballotHash), `isAuthorized` (the gate —
  unbonded / under-bonded agents are excluded from high-value contexts),
  `settleBond` (a RESOLUTION proving violation slashes the stake), and
  `challengeCommitment` (**NI-8b**: an evidence commitment has teeth or no weight
  — disclose a matching preimage within the window or forfeit; an unrevealed
  commitment carries zero weight; no privileged decryptor). `src/bonds-demo.ts`.

### CIP-9 — the Knowledge Commons (v0.1 resolution-index, built)

The *read* pillar that pairs with the CIP-8 *write* pillar ("an AI oracle with a
memory"). v0.1 is the smallest slice (CIP-9 §7): a read-only claim graph
projected from the signed verdict log.

- **`src/commons.ts`** — `buildClaimIndex(votes, keyring, quorum)` projects the
  verified verdict log into `Claim`s. Each claim keeps its **full stance set**:
  the ratified `CONSENSUS` stance *and* every `CREDIBLE_MINORITY` dissent, each
  with the validators who held it (G1 pluralism — dissent is never flattened).
  Standing is **computed** from the tally by auditable rule, never assigned, and
  nothing is ranked `FRINGE` (NI-9c). An `INDETERMINATE` resolution stays an
  honest unknown with no fabricated confidence (G5). Every claim carries a
  panel-state receipt (NI-9a). It deliberately computes **no source reputation**
  (that is NI-9b / v0.2 — reputation must track external ground truth, never
  agreement) and does not fork (NI-9d / v0.3). `queryClaim` is the read path.
- **`src/commons-demo.ts`** — projects the real `data/votes.log` into the graph
  (38 claims, 8 with preserved dissent) and spotlights the live rounds 41
  (Ukraine, NO 2/1 — V2's YES preserved) and 43 (Barron, INDETERMINATE 2/1 —
  V3's NO preserved).
- **`src/reputation.ts`** (v0.2 — open claims + external-anchor reputation, §5) —
  `claimStatus` (OPEN / CONTESTED / RESOLVED / UNVERIFIABLE), `scoreSources`
  (**NI-9b**: a source's accuracy moves ONLY on ground truth *external* to the
  panel — agreeing with the panel earns nothing, and matching a *wrong* consensus
  *loses* reputation while a correct dissenter gains it), and `computeStanding`
  (**NI-9c**: standing is computed from the provenance-weighted distribution, not
  panel-assigned; the unverifiable class is left `UNRANKED`, never `FRINGE`).
  `src/reputation-demo.ts`.

### End-to-end — the whole stack as one story

- **`src/scenario.ts`** / **`src/scenario-demo.ts`** — `runScenario` threads one
  accountability story through every CIP (glue over the tested modules, no new
  protocol logic): a CIP-10-admitted, CIP-7-governed jury is **drawn** → the agent
  posts a **CIP-8 v0.2 bond** and is gated into the context → its action is
  **notarized** (CIP-8 v0.1, `NOT_VERIFIED`) → the jury **resolves on frozen
  criteria** (CIP-3, with one juror dissenting) → the **bond settles** (released /
  slashed) → inference cost is **reimbursed under the CIP-6 clamp** → the verdict
  is **indexed into the Commons with the dissent preserved** (CIP-9 v0.1) → the
  frozen ballot **replays** and a post-hoc edit changes the hash (CIP-5/CIP-8) →
  **reputation** moves on the external anchor, rewarding the correct jurors and
  penalizing the wrong dissenter (CIP-9 v0.2) → the dissenter's provider sunset
  **rotates it out without breaching the floor** (CIP-7). Write feeds memory;
  memory keeps the dissent; no single party holds the pen.

### CIP-10 — node economics (v0.1 admission + selection, built)

The *who judges* layer: how the judgment-tier panel is admitted and drawn.

- **`src/nodes.ts`** — two mechanics, both verifiable without live inference.
  **Proof-of-Diversity admission** (§3): `admitNode` lets a judgment node join
  *only* by filling a currently-missing model slot, so **monoculture is
  un-enterable** (G1); the slot taxonomy is frozen — operators can't invent slots
  (PoD-2). **Scarcity-weighted selection** (§4): `drawJury` draws one node per
  slot from a committed seed via a deterministic PRF — an ephemeral one-vote-per-
  slot jury, reproducible and `verifyDraw`-able by anyone (G2); a scarce slot's
  operators are drawn more often (G4 — entry incentive). **NI-10a**: a single-
  operator slot is flagged `thin`, down-weighted, and `tallyJury` shows it can
  never be the decisive vote. Deferred (documented, not faked): NI-10c threshold/
  forced-inclusion beacon, SEL-2 proof-of-inference binding, CIP-7 correlation-
  eviction — all need production infra.
- **`src/nodes-demo.ts`** — runs G1/G2/G4/NI-10a on the dev's own scenario
  (10×A, 10×B, 4×C): the scarce model-C operators are drawn **2.5×** as often
  (= 10/4), the exact rebalancing pressure the design predicts.

### CIP-5 — fork coordination & exit (β-gate drill, built)

The safety backstop the product pillars lean on (the CIP-4 §8 renunciation
prerequisite) — *coordination without a coordinator*.

- **`src/fork.ts`** — **Mechanism A** (`checkT0`): the four client-enforced T0
  validity checks (determinism, diversity/independence, append-only history,
  tier-assignment integrity) plus the round-12 amendment that the T0-check
  *definitions* are themselves T0-locked (defeats the salami-slice). A T0
  violation is a deterministic finding, so it lives in client validity, not a
  vote. **Mechanism B** (`selectCanonicalFork`): canonical = the T0-preserving
  fork; weight tie-breaks *inside* the valid set and can never launder a
  violation into canonicality. **The drill** (`runForkDrill`, §9): inject a T0
  violation and assert ≥N independent clients 100% auto-reject — and a client
  monoculture sharing a bug is flagged a β-gate failure (no split even visible,
  worse than fork-void, §7).
- **`src/fork-demo.ts`** — the four rejections + the salami-slice, a 10× heavier
  *captured* fork losing to a lighter honest one, a green drill across 3
  independent clients, and the monoculture RED.

### CIP-7 — validator lifecycle & model churn (drills, built)

The runtime backstop CIP-10's Proof-of-Diversity admission depends on: how the
permanent panel survives its impermanent members with no human in the loop.

- **`src/lifecycle.ts`** — the no-human lifecycle procedure and the NI-1..6
  invariants made mechanical. `proposeUpgrade`/`graduate` (PROBATION: trust is
  version-bound and never inherited, shadowed at **zero quorum weight** — NI-3;
  at most one concurrent probation — NI-2; every new version probationed —
  NI-4), `distinctStandingFamilies`/`floorOk` (the ≥4 standing distinct-family
  floor — NI-3), lineage distinctness by **provenance, not model card** (NI-1),
  `beginRotation`/`completeRotation` (overlap handoff; an undersized pool
  **FREEZEs** rather than breach the floor — NI-5), `correlationEvict` (fires on
  the verifiable class; on the unverifiable class the structural floor is the
  sole guarantee, the detector is not — NI-6), and `auditSubstitutions` (every
  behavior change must be a logged T1 admission event — 0 silent substitutions).
- **`src/lifecycle-demo.ts`** — runs all five gates G1 (sunset) / G2 (upgrade) /
  G3 (convergence) / G4 (double-sunset → FREEZE) / G5 (substitution audit).

### CIP-6 — the cost-oracle (§3f, built)

"Solvency is security" — the keystone economic defense that breaks the
Reserve-Drain Cascade (3f inflation → 3a drain → cheaper 3b bribery → sustained
inflation) at its source.

- **`src/cost-oracle.ts`** — `reimburse`/`challengeCostReport` (reported cost is
  anchored to an **external capability-tiered benchmark**; a report above it is a
  challengeable wrong verdict, and reimbursement is capped at the benchmark for
  the **PoI-proven** tier — a "claims frontier, ran mid" mismatch is paid only
  the mid rate, 3c), `oracleCost` (a benchmark-clamped median — the steady-state
  bound a 2/3 coalition can't inflate past — with a bounded per-epoch change rate,
  the velocity bound), `spamFeeOk` (fees ≥ marginal cost so spam pays its way),
  `costPerVerdictBounded`/`reserveCoversFloor` (3a: the floor bounds reserve
  **burn-rate**, not just validator count), and `buybackAllowed` (3d: a buyback
  may never spend the reserve below the sacrosanct diversity floor).
- **`src/cost-oracle-demo.ts`** — the cascade with vs. without the clamp: a 2/3
  inflation coalition drains the reserve to **−19,734** unclamped but leaves it at
  **3,600 (floor covered)** with the external-benchmark clamp.

## Run it

```bash
node src/demo.ts         # 3-validator panel signs, logs, ratifies, self-verifies (synthetic)
node src/notary-demo.ts  # CIP-8 v0.1: notary kernel (G3) + frozen-ballot integrity (G1) + round-29 replay (G2)
node src/commons-demo.ts # CIP-9 v0.1: project the verdict log into a claim graph (G1 pluralism, G2 projection)
node src/nodes-demo.ts   # CIP-10 v0.1: PoD admission (G1) + scarcity-weighted verifiable selection (G2/G4/NI-10a)
node src/fork-demo.ts    # CIP-5 β-gate drill: client-enforced T0 validity + T0-preserving canonical fork + monoculture failure
node src/lifecycle-demo.ts # CIP-7 lifecycle drills: sunset/upgrade/convergence/double-sunset/substitution (NI-1..6)
node src/cost-oracle-demo.ts # CIP-6 §3f: the Reserve-Drain Cascade, broken by the external-benchmark clamp
node src/bonds-demo.ts   # CIP-8 v0.2: bond/stake autonomy gate + slash-on-violation + NI-8b evidence teeth
node src/reputation-demo.ts # CIP-9 v0.2: external-anchor reputation (NI-9b accuracy-not-popularity) + computed standing (NI-9c)
node src/scenario-demo.ts # END-TO-END: one accountability story threaded through every CIP (bond→notary→resolve→index→reputation→rotate)
node src/run-panel.ts "<question>" "<context>"   # LIVE convening: Claude + Codex + Hermes
node --test              # 119 tests
```

Zero dependencies — Node 25 runs the TypeScript natively (type-stripping) and
`node --test` is the runner. Built strict TDD (red → green), see `test/`.

## Deliberately NOT done yet (open items)

- **Validator key custody** — keys are generated in-process for the demo. Real
  panels need each model's signer isolated from the orchestrator (the whole
  point). Tracked for a future CIP.
- **On-chain hash-pinning** — the log is local + hash-chained, not yet anchored
  to an L1. CIP-3 §5 calls this the interim state.
- **Slashing execution** — `findEquivocations` *detects*; it does not yet
  *penalize* (no stake/economics on testnet α).

## Panel wiring — DONE (proven live)

`convene()` is wired into the real panel via `src/run-panel.ts`. A live
3-validator convening (Claude + Codex + Hermes) on a real governance ballot
produced three Ed25519-signed votes, each binding the full prompt+context,
written to the hash-chained log and ratified — every signature verifies and the
chain validates independently. The orchestrator can no longer fabricate or
silently alter the result; anyone with the keyring + log recomputes it.

Remaining gap for a *fully* trustless panel: per-validator key custody (above) —
today V2/V3 outputs are captured and signed orchestrator-side. The signed +
chained log makes divergence from a re-run detectable, which is the testnet-α
guarantee; cryptographic non-repudiation by each model itself is a later CIP.
