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

## Run it

```bash
node src/demo.ts         # 3-validator panel signs, logs, ratifies, self-verifies (synthetic)
node src/notary-demo.ts  # CIP-8 v0.1: notary kernel (G3) + frozen-ballot integrity (G1) + round-29 replay (G2)
node src/commons-demo.ts # CIP-9 v0.1: project the verdict log into a claim graph (G1 pluralism, G2 projection)
node src/run-panel.ts "<question>" "<context>"   # LIVE convening: Claude + Codex + Hermes
node --test              # 63 tests
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
