# Round 57 — network-distributed deliberating hosts (operator-owned VMs at bootstrap)

**Ballot hash:** `e4c7be6af40b70be6f0d04bdb68d350e707be152d1dce91e67248079521c1f94`
**Verdicts:** ADOPT / REVISE / REJECT
**Result:** **REVISE 2/3** — V1 REVISE, V2 REVISE, V3 ADOPT (tally `{REVISE:2, ADOPT:1}`). Log entry 162, chain valid.

The split is procedural, not substantive: V3 voted ADOPT but attached the *same* conditions
V1/V2 made load-bearing. All three agree — build the transport, with the changes below.

## Question

> Quorumchain network-distribution security design: is it sound to build network-distributed
> deliberating hosts now (network transport + keystore split + mutual TLS + replay nonce),
> accepting that the bootstrap operator owns all three VMs as a documented early-stage interim?

## Ballot context (verbatim — the bytes hashed into the ballot)

# Decision brief — network-distributed deliberating hosts (operator-owned VMs at bootstrap)

## Background (current state)

All three deliberating signer hosts currently run as local child-processes on a single
machine under the bootstrap operator, sharing one keystore directory. The signer
boundary (rounds 44–47) already: holds each validator's private key child-side, keeps
the orchestrator from holding any key or supplying any verdict, and anchors verdict
integrity in the pinned keyring + signature verification (assertMatchesPin). The
orchestrator-to-host protocol is two messages over line-delimited JSON:
{type:"pubkey"} -> {publicKeyPem}, and {type:"sign", prompt, context, verdicts} -> {vote}.

## Proposal

Move each deliberating host onto its own machine and reach it over a network socket
instead of a stdin/stdout pipe. convene, ratify, signed-vote, and the protocol itself are
unchanged — this is a transport swap, not a redesign. Specifics:

1. **Keystore split.** Each machine holds ONLY its own validator's private key. No
   machine ever holds two validators' keys.
2. **Transport.** A `makeNetworkSigner({validatorId, address})` beside the existing
   `makeRemoteSigner`, returning the same Signer interface; the host reads/writes the same
   JSON lines over the socket. Built under TDD with a loopback integration test (a vote
   signed on a "remote" host verifies against the pin).
3. **Channel security.** Mutual TLS (confidentiality + endpoint auth) layered ON TOP OF
   the existing signature-only verdict integrity. Rationale: verdict integrity is already
   guaranteed by the pinned keyring — a host without the pinned private key cannot produce
   an acceptable vote, and a MITM altering the ballot is caught because the host signs over
   the content it received and the orchestrator checks the hash. mTLS adds confidentiality
   + impersonation/DoS resistance, NOT verdict integrity.
4. **Replay (open question).** Bind a per-convening nonce into the signed payload for
   auditability, or rely on vote idempotency? Proposal leans toward a nonce in the signed
   payload.
5. **Liveness.** Hosts run as long-lived services; a down host is a recorded absence
   (NO_VERDICT / startup failure) exactly as the daemon already handles. Existing timeout +
   participation-not-outcome retry carry over unchanged.

## The bootstrap-operator framing (explicit — the panel is asked to rule on this)

At this early stage the bootstrap operator will OWN all three VMs: three independent
hosts/clouds, but a single operator. This reduces single-machine compromise but does NOT
yet achieve operator/org diversity — compromising the operator compromises all three. The
proposal accepts this as a **documented bootstrap interim**, with the CIP-10 two-tier
admission + Proof-of-Diversity machinery as the path to independent operators. The panel is
asked whether this interim is acceptable now, and under what conditions — e.g. documented
as a known limitation, a sunset/graduation condition, and/or a cap on what the
operator-owned phase may legitimately be used for (testnet only, no priced token, etc.).

A recurring red-team lesson applies: capture is laundered through the gap between a rule's
intent and its mechanical check. "Three independent VMs" can mechanically pass a diversity
check while a single operator still holds all three keys — name that gap if it matters.

## Question

Is this design sound to BUILD NOW (network transport + keystore split + mTLS + replay
nonce), accepting operator-owned VMs as a documented bootstrap interim with whatever
conditions you attach?

## Verdicts

- **ADOPT** — sound to build as proposed.
- **REVISE** — sound direction, but specific changes are required (name them).
- **REJECT** — wrong approach (say why, and what instead).

---

## Verbatim votes

### V1 — REVISE

## Reasoning

**The transport swap is sound.** The signer boundary from rounds 44–47 already locates integrity in the right place: keys live child-side, the orchestrator holds none, and verdict integrity rests on the pinned keyring + signing-over-received-content (`assertMatchesPin`). Moving from a stdin/stdout pipe to a socket changes the channel, not the trust model. The keystore split (each machine holds only its own key) is *strictly better* than today's shared keystore directory. And the mTLS reasoning is correctly scoped — it adds confidentiality + endpoint auth + DoS/impersonation resistance, and the brief explicitly does **not** claim it provides verdict integrity. That's the right call: a host without the pinned key can't produce an acceptable vote regardless of TLS, and a tampered ballot is caught by the hash. So mTLS is correctly additive, not load-bearing.

This is also necessary scaffolding: you cannot reach independent-operator diversity without first having network transport and per-host keystores. Deferring the build until you have operator diversity is backwards. So this is not REJECT.

But two things in the proposal are unfinished in ways that matter, so it's not ADOPT-as-written:

**1. The replay nonce must be decided now, not left open.** Once you're on a network, replay stops being theoretical — a captured signed vote is a real artifact. Orchestrator-side idempotency doesn't give you auditability, because a recorded vote's meaning depends on it being bound to a specific convening. Decision: orchestrator issues a fresh per-convening nonce, the host signs over `{prompt, context, verdicts, nonce}`, the orchestrator verifies the nonce matches the convening it issued. The host already signs over content, so the marginal cost is near-zero — and doing it *at* the transport swap avoids a second protocol migration later.

**2. The diversity gap must be mechanically un-launderable, not just documented in prose.** This is the red-team lesson applied directly: "3 independent VMs/clouds" will mechanically pass a diversity check while one operator holds all three keys. A prose footnote does not stop the *next* system — CIP-10 two-tier admission / Proof-of-Diversity — from consuming a host-count attestation and reading it as operator diversity. Required: the attestation surface must represent **operator-count as distinct from host-count** and emit `operator-count = 1` during this phase. The operator-owned phase must not produce any attestation that downstream admission would accept as satisfying operator diversity; graduation flips that field. If the schema can't represent operator-count separately from host-count, *that* is the gap to close before building.

**3. Scope cap on the interim (the brief invited this).** Testnet only; no priced token, no mainnet value secured, no economically-final governance. Sunset condition tied to CIP-10 admission of ≥N independent operators.

Conditions 1 and 2 are load-bearing required changes; that makes this REVISE rather than ADOPT. The direction is right — build it.

VERDICT: REVISE

### V2 — REVISE

The direction is sound, but only if the interim is treated as a security improvement over single-machine custody, not as real quorum diversity.

Keystore split, network transport, mTLS, and a signed per-convening replay nonce are the right next engineering steps. They reduce blast radius from one host compromise, exercise the distributed signer interface, and preserve the existing pinned-key verdict integrity model.

The required revision is governance/security labeling: operator-owned VMs must not satisfy any meaningful diversity claim. The design should explicitly name this as **operator-capture laundering**: three machines mechanically appear distributed while one operator still controls all validator keys. Add clear conditions:

- require nonce binding in the signed payload, not optional idempotency;
- document single-operator control as a known limitation;
- cap this phase to bootstrap/testnet or non-priced/non-final authority use;
- define graduation/sunset criteria tied to CIP-10 admission and Proof-of-Diversity;
- ensure diversity checks distinguish machine/cloud independence from operator/key-control independence.

VERDICT: REVISE

### V3 — ADOPT

Reasoning:

**Keystore split is materially sound.** Even with one operator, moving from one machine with one keystore directory to three VMs each holding exactly one key is a real security step. A single-host compromise yields at most one validator's key, not the whole set. The attacker must pivot across VM/network boundaries. This is genuine defense-in-depth.

**mTLS is the correct layer.** The rationale that verdict integrity already lives in the signature+pinned-keyring is correct. mTLS adds confidentiality, endpoint authentication, and resistance to injection/DoS without being mistaken for the integrity mechanism. Good layering.

**Replay nonce should be included, not deferred.** Idempotency alone won't prevent replay of a vote from convening A into convening B. Binding a per-convening nonce into the signed payload prevents this, costs almost nothing, and strengthens the audit trail. Do it now.

**The operator-owned interim is an accepted risk, but it MUST carry conditions.** The gap is honestly named — "three VMs, one operator" is not real diversity. This is acceptable ONLY if bound by explicit graduation criteria:

1. Documented as a known limitation in the project's threat model, not handwaved away.
2. Restricted to testnet / no-priced-token phase. Never carry this to a state where stake or value is at risk.
3. A sunset clause: independent-operator admission (via CIP-10 two-tier + Proof-of-Diversity) is a prerequisite for mainnet progression.
4. A graduation gate that verifies mechanical independence: different cloud providers, separate auth credentials, no shared admin plane. These are cheap to check and make the graduation criterion measurable rather than aspirational.

The capture-laundering gap (mechanical "three VMs" vs. intended "three operators") is real but is properly addressed by naming it, bounding it in scope, and attaching a path out. No need to wait for operator diversity to build the transport and keystore split — those are valuable independently and ease the eventual handoff.

VERDICT: ADOPT

---

## Ratified outcome — build, with required changes

**Build now:** network transport (`makeNetworkSigner` + socket host, same protocol), keystore
split (one key per machine), mTLS layered on top of the pinned-key verdict integrity.

**Required changes (load-bearing):**

1. **Replay nonce is decided, not open.** The orchestrator issues a fresh per-convening
   nonce; the host signs over `{prompt, context, verdicts, nonce}`; the orchestrator verifies
   the nonce matches the convening it issued. Done at the transport swap to avoid a second
   protocol migration.
2. **The single-operator gap must be mechanically un-launderable.** The attestation surface
   must represent **operator-count distinct from host-count** and emit `operator-count = 1`
   during this phase. No attestation the operator-owned phase produces may be accepted by
   downstream CIP-10 admission as satisfying operator diversity; graduation flips the field.
   If the schema cannot represent operator-count separately, closing that is a prerequisite.
3. **Scope cap on the interim:** testnet only; no priced token; no mainnet value/stake
   secured; no economically-final governance. Documented as a known limitation in the threat
   model. Sunset tied to CIP-10 admission of ≥N independent operators, with a graduation gate
   that mechanically checks independence (distinct cloud providers, separate auth credentials,
   no shared admin plane).

**The user's framing was accepted:** operator-owned VMs are fine *now* — as a bounded,
documented, mechanically-gated bootstrap interim, not as a diversity claim.
