# CIP-14 — Type-Bound Ballot Hash (closing the NI-13a ideal)

**Status:** RATIFIED 3/3 — core ballot `e0d17747c5145ea2e41a504265ee94c4cfce30a834d96d1db39f9e261e602b9b`. All three validators ratified YES *with one shared implementation caveat folded as §4 NI-14f + §2.3* (the `null`/`undefined` serialization edge). **IMPLEMENTED & LIVE-VERIFIED** (TDD, 8 new gate tests G14a–f, suite 278→286 green): `ballotHash` chokepoint binding, `verifyEntry`/`appendBallot`/`convene`/signer + host-core IPC all thread `boundType`; `QRM_BIND_TYPE` CLI knob; the daemon/queue path inherits binding via `Ballot.meta.typeBinding`. NI-14a verified on the live core chain (94 registry entries, 449 votes — 0 hash shifts). End-to-end live dev convene `be25ff60…` confirmed the type is bound through the real signer IPC: all 3 signatures verify over the v2 hash, and flipping the bound type breaks `verifyEntry`.
**Depends on:** CIP-13 (claim epistemic typing), CIP-9 (read surface / registry)
**Closes:** the NI-13a *ideal* — "the epistemic type is frozen and signed, never inferred."

---

## 1. Problem

CIP-13 requires (NI-13a) that a claim's epistemic type be **frozen and signed, never
inferred**. The implementation only half-meets this. Today:

```
ballotHash = sha256(JSON.stringify({ prompt, context }))
```

`epistemicType` is recorded in the registry as advisory `meta` and is **not** an input to
`ballotHash`. The signature each validator produces covers `{validatorId, ballotHash,
verdict, rawOutputHash, nonce?}` — so it covers the *claim framing* (prompt+context) but
**not** the type. Consequence: a registry edit can change a claim's declared type without
breaking any hash or any signature. The type is only as trustworthy as the registry file
(or, under CIP-13 v0.3, a separate panel-ratification sub-claim). The NI-13a *ideal* —
the type bound into the signed artifact itself — is unmet.

## 2. Design — optional-append, exactly like the round-57 nonce

The round-57 nonce added a field to the signed payload **without breaking legacy** by
appending it to the hashed JSON *only when present*; a vote signed without a nonce produces
a byte-identical payload to the pre-nonce format. CIP-14 applies the same discipline to
`ballotHash` itself.

```
ballotHash(prompt, context)                    = sha256(JSON.stringify({ prompt, context }))                  // v1, unchanged
ballotHash(prompt, context, boundType)         = sha256(JSON.stringify({ prompt, context, epistemicType }))   // v2, type-bound
```

- **No `boundType` supplied → byte-identical to today.** All 93 existing registry entries
  and every signature in `votes.log` verify unchanged, forever. This is forward-only,
  matching the chain's existing forward-only rule.
- **`boundType` supplied → the type is inside the hash**, hence inside every validator
  signature (the signature covers `ballotHash`). The type is now *signed*, not merely
  declared. NI-13a's ideal is met.

### 2.1 The discriminator (why a flag is required, not just type-presence)

The 61 backfilled claims (CIP-13 productionization) carry `meta.epistemicType` but were
hashed **without** it (they are v1). So "the entry has a type" cannot be the signal to
recompute-with-type — that would break their hashes. A v2 entry is marked explicitly:

```
meta.typeBinding = 'hashed'   // present  → recompute ballotHash WITH epistemicType (v2)
                              // absent   → recompute WITHOUT it (v1 / advisory backfill)
```

`verifyEntry` reads the flag: bound entries recompute `ballotHash(prompt, context,
epistemicType)`; everything else recomputes the v1 hash. No version integer is needed — the
flag's presence is the version, self-describing per entry.

### 2.3 Serialization contract (FOLDED from the 3/3 red-team — V1/V2/V3 all raised it)

`JSON.stringify` **omits** an `undefined` key but **emits** a `null` or empty-string key
(`"epistemicType":null` → a different preimage → a different hash). If the v2 path were
entered with a null/empty/invalid type, NI-14a byte-identity would silently break. Contract:

- The v2 preimage `{prompt, context, epistemicType}` is entered **iff** `boundType` is a
  present, non-null, non-empty **recognized** `EpistemicType` token (`SETTLED |
  EMPIRICAL_LIVE | NORMATIVE`). Anything else (absent / `undefined` / `null` / `''` /
  unrecognized) falls through to the v1 preimage `{prompt, context}` — the `epistemicType`
  key is **never** emitted as null/empty.
- `meta.typeBinding='hashed'` is set **if and only if** the type was actually hashed into
  the ballotHash. Flag-set-iff-hashed is the integrity contract verifiers rely on.

**Verification (V3's dual-hash mandate, V1's "self-authenticating" reframe).** The flag
selects which *preimage* a verifier reconstructs — it does **not** select a verification
algorithm (no JWT-`alg:none` downgrade). `verifyEntry` recomputes the preimage named by
`typeBinding` and compares to the stored `ballotHash`. For votes there is no flag to trust:
a wrong preimage yields a hash the signature does not cover, so `verifyVote`/`ratify` reject
it. The flag is therefore self-authenticating through the signature and correctly does not
live inside the signed payload.

### 2.2 The signer must hash the same way

For the type to be *signed*, it must be an input the signer hashes. `convene` passes the
bound type down to each `signBallot(prompt, context, verdicts, nonce, boundType?)`; the
signer derives `ballotHash(prompt, context, boundType)` and signs over it. The orchestrator
still holds no key and mints no hash (CIP-3) — it passes the type as part of the ballot
content, exactly as it already passes prompt/context/verdicts; each validator re-derives and
signs. A validator uncomfortable with the proposed type can ABSTAIN.

## 3. Consequences (the design choices the panel must judge)

1. **A type change becomes a supersession, not an edit.** Changing a v2 ballot's type
   changes its `ballotHash` → it is a *different ballot* → it must append as a new claim /
   supersession (NI-13d). Re-typing is first-class, append-only, and tamper-evident — never
   a silent registry mutation. This is the intended hardening.

2. **Binding ≠ ratification; the two layers coexist.** A v2 bound type is the *proposer's
   declaration*, now signed and tamper-evident. The CIP-13 v0.3 *authoritative* type still
   comes from a panel-ratified type sub-claim. Binding makes the declaration un-forgeable;
   ratification makes a type authoritative. Both are signed artifacts; neither replaces the
   other. `typeRatified` continues to mean "panel-ratified," independent of `typeBinding`.

3. **Scope: bind ONLY `epistemicType`.** `evidenceTime` / `supersedes` stay descriptive /
   anchor-gated and out of the hash (YAGNI; they are not the NI-13a subject).

4. **Migration: none for legacy.** The 61 backfilled advisory types are NOT re-convened —
   that would re-mint 61 claims and break lineage. They remain v1 advisory, rendered as
   declared (no panel-ratified marker), until/unless panel-ratified under v0.3. CIP-14
   binds **new** typed convenes only.

## 4. Invariants

- **NI-14a** — v1 hashing is unchanged: any ballot without a bound type produces a
  byte-identical hash and signature payload to the pre-CIP-14 format. (Legacy verifies.)
- **NI-14b** — a bound type is inside the hash and therefore inside every validator
  signature; tampering with a bound type fails `verifyEntry` AND `verifyVote`.
- **NI-14c** — the binding flag is per-entry and self-describing; a verifier needs no
  external version table to pick the right hash function.
- **NI-14d** — binding is orthogonal to ratification: `typeBinding='hashed'` does not set
  `typeRatified`, and a ratified type does not require binding.
- **NI-14e** — only `epistemicType` is hash-bound; other meta stays descriptive.
- **NI-14f** *(folded from the 3/3 red-team)* — the v2 preimage is entered iff `boundType`
  is a present, non-null, recognized `EpistemicType`; any other value falls through to the
  v1 preimage with no `epistemicType` key emitted, and `typeBinding='hashed'` is set iff the
  type was hashed. (Guarantees NI-14a; see §2.3.)

## 5. Gates

- **G14a** — `ballotHash('p','c')` is byte-identical before and after CIP-14.
- **G14b** — `ballotHash('p','c','EMPIRICAL_LIVE') !== ballotHash('p','c')` and differs per type token.
- **G14c** — a v2 entry whose `meta.epistemicType` is altered fails `verifyEntry`.
- **G14d** — a v2 vote whose ballotHash was derived from a different type fails `verifyVote`/`ratify`.
- **G14e** — a v1 backfilled entry (type present, `typeBinding` absent) still verifies.
- **G14f** — `convene` with a bound type writes a v2 entry whose round-tripped hash matches the signed votes.

## 6. Test plan (TDD)

1. **G14a/G14e regression:** existing `votes.log` + `ballots.jsonl` verify unchanged (load + `verifyLog` + `verifyEntry` over all 93).
2. **G14b:** `ballotHash` 3-arg is deterministic, type-sensitive, and ≠ the 2-arg hash.
3. **G14c:** flip a bound entry's `epistemicType` → `verifyEntry` false; flip a v1 entry's advisory type → still true.
4. **G14d:** sign a vote with `boundType=X`, verify it against a ballotHash derived with `boundType=Y` → false.
5. **G14f:** end-to-end `convene({meta:{epistemicType, typeBinding:'hashed'}})` with the fake panel → registry entry + votes share the v2 hash; `verifyEntry` + `verifyVote` + `ratify` all pass; `buildViews` surfaces the type.
6. **NI-14d:** a bound-but-unratified type renders as declared (no panel-ratified marker); ratification is still a separate sub-claim.

## 7. Out of scope

- Re-convening or re-hashing any existing ballot.
- Binding non-type metadata.
- Changing the CIP-13 v0.3 ratification mechanism (it sits on top, unchanged).
