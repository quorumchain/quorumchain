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

## Run it

```bash
node src/demo.ts   # 3-validator panel signs, logs, ratifies, self-verifies
node --test        # 21 tests
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
- **Panel wiring** — not yet connected to the live Codex/Hermes invocation flow;
  this is the trust substrate that flow will write into.
