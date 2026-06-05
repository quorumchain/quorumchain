# CIP-15 — Anchor Verification (enforcing the re-adjudication gate)

**Status:** DRAFT — direction consult-ratified 3/3 (`4d46f01a…`); full-spec consult-ratified 3/3 (`e1bef9df…`); red-team **3/3 NO** (`54830138bfb9557bd0a35cc9194596d445749cf5867174f9775b49c78cdbcc23`) found 5 flaws, **all now folded:** NI-15f grounded to a verifiable native timestamp (a); NI-15e canonicalization + append-domain separation pinned (c); NI-15g given a distinct-verified-root independence predicate + credit tiers + liveness posture (b); **NI-15b re-cut as an ENFORCED no-side-effects invariant — structural pass admits to content review only, the head moves solely on CONTENT_CONFIRMED** (d/e, per steward "admit-to-review-only"); the gate split into `reviewAdmissible()` vs `promotable()`. **RE-RATIFIED 3/3** (`085efcfcf9b57bec0f9918dda24a99e1fbee48b1939dc985b9dc5bd26d319eaa`) — all 5 findings confirmed closed, no new flaw; three V1 first-test obligations folded inline (empty-anchor-set forbidden; trace-root = origin not issuer; content/provenance bind the same artifact). **Spec is ratified and sound to implement under TDD** (consult → full-consult → red-team NO → fold → re-ratify YES). **Phase-1 implementable-now scope consult-ratified 3/3 (`02e3c6cb…`)** — see §10 (Tier-1: signed + content-addressed + OTS/RFC-3161-timestamped anchor, reusing Ed25519/pinned-keyring, with P1a–c acceptance criteria + gates GP1a–e).
**Date:** 2026-06-05
**Depends on:** CIP-13 (NI-13e anchor-gated supersession), CIP-11 (anchor diversity), CIP-2 §9a (external anchors), CIP-4 (frozen client-checkable policy), CIP-10 (halt-over-degrade).
**Closes:** the live trusted-flag hole — CIP-13's `promotable()` promotes a supersede on a bare self-declared `newAnchor:boolean` that nobody verifies.

---

## 1. Problem

CIP-13's lineage gate (`promotable()`, commons.ts) advances a re-adjudication only if the
superseding ballot clears the anchor gate. For non-NORMATIVE claims that gate is, today,
exactly one line:

```ts
return typeOf(head) === 'NORMATIVE' ? true : ballotMeta[s]?.newAnchor === true;
```

`newAnchor` is a **bare, self-declared boolean nobody verifies**. So "anchor-gated
re-adjudication" is advisory, not enforced — a proposer asserts `newAnchor:true` and the
supersede promotes. As V1 put it at the consult: **today's flag is itself the false comfort.**
CIP-15 replaces the boolean with a typed anchor object and a structural verifier.

## 2. The ratified definition (consult `4d46f01a`)

An **anchor** is an *external, verifiable, independently-governed reference to ground truth*.
Explicitly **not**: the panel's own judgment, another QRM ballot / Commons claim, or source
popularity (CIP-2 §1; NI-11d — reputation moves only on later-revealed external ground truth).
Two classes (CIP-11's own residual):

- **Class 1 — STRUCTURED / TRACEABLE:** signed price/data feeds, on-chain attestations/txns,
  content-addressed documents (hash/IPFS), signed institutional releases. Provenance is
  inspectable → NI-11b correlation check is operationally sound → **structurally verifiable now.**
- **Class 2 — DOCUMENT / NEWS / SCIENTIFIC:** reports, papers, filings, consensus claims.
  Provenance opaque (three "independent" reports may share one wire/brief) → handled by
  NI-11b's conservative *unprovable independence → one family* default → **deferred, not denied.**

## 3. Binding invariants (folded verbatim from the 3/3 consult — all three named these)

- **NI-15a — CLAIM-BOUND CONTENT HASH (what makes structural ≠ theater).** The anchor object
  carries `contentHash` = sha256 of the **exact cited artifact**, plus `citedAssertion` = the
  **specific supersede claim** the anchor is offered for. The hash must bind the *real cited
  artifact tied to this assertion*, never a free-floating digest. This pre-commitment is what
  the deferred oracle later checks against — the attacker cannot swap content after the fact.
  The deferred content check MUST verify the **same artifact** `contentHash` commits to and that
  `provenanceTrace` was checked against — one artifact bound to both — so re-derived verification
  inputs on a fixed ballot hash can never yield an inconsistent authoritative outcome (re-ratify
  TDD obligation, V1).
- **NI-15b — STRUCTURAL-PASS ≠ PROMOTION (the non-negotiable; ENFORCED, not labeled — folded
  from red-team (d)+(e) per steward decision "admit-to-review-only").** A structural pass
  **admits** a supersede to a `content-review-pending` state with **ZERO authoritative side
  effects**: it does **not** move the lineage head, change standing, reorder the published
  Commons, or dequeue from `reviewQueue`. The authoritative head advances **only** on
  `CONTENT_CONFIRMED` (the deferred testnet oracle). Stated plainly: pre-testnet a re-adjudication
  can be *admitted to review* but can **never take effect** — CIP-15 is a verified admission gate,
  and head-flip authority lives entirely in the content layer. NI-15b is a named-consumer
  obligation (enumerated in §5.2), not a render label that could become cosmetic. (CIP-10/CIP-11
  halt-over-degrade.)
- **NI-15c — TIGHTENING, NOT NEW COMFORT.** CIP-15 is a strict tightening of an already-
  unenforced gate. The verifier must be *strictly* more demanding than `newAnchor===true`
  along every axis (signed + hash-bound + fresh + independence-checked); it may never admit a
  supersede the boolean would have rejected.
- **NI-15d — CLASS-1-FIRST IS DEFERRAL, NOT DENIAL.** The schema admits class-2 anchors; only
  *structural crediting* is phased to class-1 first (their cryptographic form is offline-
  checkable). A class-2 anchor presented now is **logged as deferred, never silently dropped**
  — no cap that reads as permanent exclusion. Phasing is a verifiability choice, **not** an
  epistemic-neutrality ranking of financial-over-scientific truth (CIP-2 neutrality preserved).
- **NI-15e — ANCHOR-SET BINDING (folded from the consult; all three named it).** The anchor-set
  commitment `anchorCommitment = sha256(canonical(anchors))` is **bound into the ballot via the
  CIP-14 optional-append discipline**, so it enters every validator signature: a proposer cannot
  swap, add, or drop a cited anchor after votes are cast. **Canonicalization (folded from the
  red-team, surface (c) — the CIP-10-grindable-salt-shaped hole):** `canonical(anchors)` =
  deterministic JSON over anchors **sorted by `contentHash`**, each reduced to exactly
  `{contentHash, citedAssertion, anchorType, issuer}`, with **duplicate `contentHash` rejected**
  (not silently merged), all strings **NFC-normalized, UTF-8**, and **absent optional fields
  OMITTED, never emitted as null** (the precise edge CIP-14 §2.3 folded). **Append-domain
  separation:** the commitment enters the ballot preimage under a distinct key so a legacy
  (no-anchor) hash stays byte-stable, a typed-only (CIP-14) ballot cannot collide with a
  typed+anchored one, and the two optional-append fields compose without ambiguity. **The
  anchored region is appended ONLY when the set is non-empty — an empty `anchors[]` is forbidden,
  else a typed+anchored-with-zero-entries ballot would serialize identically to a typed-only one**
  (re-ratify TDD obligation, V1).
- **NI-15f — SURFACING-TIME MONOTONICITY, CRYPTOGRAPHICALLY GROUNDED (folded; freshness fix +
  red-team surface (a)).** The freshness gate is `anchor.surfacedAt > head.adjudicationTime` —
  "was this knowable when the head sealed?" — **not** `asOf > evidenceTime`; this admits
  legitimately older-*dated*, newly-*surfaced* evidence. **But `surfacedAt` is not proposer-
  trusted:** for a **credited** (family-contributing, re-adjudication-triggering) anchor,
  `surfacedAt` MUST equal the anchor's **own verifiable availability timestamp** — the Chainlink
  OCR round time, Pyth VAA publish time, chain-inclusion height/time, or an OpenTimestamps /
  RFC-3161 proof. An anchor carrying only a *self-asserted* `surfacedAt` may be recorded but
  **cannot by itself satisfy the monotonicity trigger** (else NI-15f is the `newAnchor:boolean`
  trusted flag reborn on the time axis — a postdated old anchor would force unlimited
  re-adjudication of any settled head). `asOf` (content date) is used only for staleness/family
  reasoning, never for the gate.
- **NI-15g — NO DIVERSITY CREDIT WITHOUT A VERIFIED, DISTINCT TRACE ROOT (folded; anti-gaming +
  red-team surface (b)).** An anchor counts toward `independentFamilies` **only if** its
  `provenanceTrace` (i) is present and cryptographically verifiable to a **trace root**, and
  (ii) that root is **distinct** from every other credited anchor's root (the offline
  independence predicate — two anchors wrapping the *same* upstream credit **one** family, not
  two; absent/unverifiable trace → **zero** credit). **A "trace root" is the provenance ORIGIN,
  not the issuer identity** (re-ratify TDD obligation, V1): N keys over one underlying source =
  one family; one issuer presenting two genuinely distinct verification methods = two. **Credit tiers:** *verified distinct root* →
  full family credit; *verified but shared root* → collapsed into that family; *asserted-only* →
  admissible evidence, **zero** diversity credit and no re-adjudication trigger. **Liveness
  posture (NI-11g, stated not hidden):** a claim whose anchors reduce to one verifiable family
  stays content-pending rather than promoting — `RESOLVED` stays reachable only for claims with
  ≥`requiredFamilies` verifiable-distinct-root anchors. This is halt-over-degrade by design;
  unreachable-for-the-under-anchored beats promoted-on-fake-diversity.

## 4. The anchor object (replaces `newAnchor:boolean`)

```ts
type ProvenanceClass = 'STRUCTURED' | 'DOCUMENT';

interface Anchor {
  anchorType: string;          // MUST ∈ the CIP-4 frozen admissible-anchor-type policy
  provenanceClass: ProvenanceClass;
  issuer: string;              // independently-governed source identity
  contentHash: string;        // sha256 of the EXACT cited artifact (NI-15a)
  citedAssertion: string;     // the specific supersede claim this anchor supports (NI-15a)
  asOf: number | string;      // the artifact's CONTENT / effective date (staleness + family reasoning)
  surfacedAt: number | string;// when it became AVAILABLE / attested — the freshness-gate input (NI-15f)
  signature?: string;         // STRUCTURED: a signature over contentHash...
  issuerKey?: string;         // ...verifiable against this key
  provenanceTrace?: string[]; // upstream origins, for the NI-11b family/correlation check
}
```

`BallotMeta.newAnchor?: boolean` → `BallotMeta.anchors?: Anchor[]`. (`newAnchor` is retained,
read-only, as a *deprecated legacy* input that maps to "1 unverified DOCUMENT anchor" — i.e.
it can no longer promote a structured-class supersede; see §6 migration.)

## 4.1 Admissible-anchor-type taxonomy — the concrete oracle/anchor seed (CIP-4 frozen policy)

The CIP-4 frozen `admissibleTypes` set is the protocol-policy list of what may be cited. It is
**not** abstract: it names real sources, each with a defined offline-verification path and a
defined provenance family. This seed taxonomy (steward-maintained per NI-11g, ratified, and
extensible) is what makes `structurallyAdmissible()` concrete:

| Anchor source / type | Provides | Offline structural verification | Class | Family (NI-11b) |
|---|---|---|---|---|
| **On-chain state / tx / EAS attestation** | a balance, tx, contract state, signed attestation | re-read the chain at a block height; hash the state | STRUCTURED | per chain; same chain = one family |
| **Chainlink** (Data Feeds, **Proof of Reserve**, Functions) | aggregated signed reports (OCR) | verify the OCR aggregate signature + on-chain round/timestamp; hash the report | STRUCTURED | **one family per feed** regardless of node count (shared aggregation contract + shared exchange upstream) |
| **Pyth Network** | first-party publisher prices (Wormhole VAA) | verify the VAA / publisher sigs + publish time | STRUCTURED | one family; correlated with Chainlink if both read the same venues |
| **UMA Optimistic Oracle** | dispute-bonded assertions of arbitrary facts | verify the on-chain assertion + that the liveness/dispute window resolved undisputed; hash the asserted claim | STRUCTURED (process-verifiable) | **distinct mechanism** (economic dispute) — a genuinely different family from price aggregators |
| **API3 / Chronicle / RedStone / Tellor** | first-party signed feeds / alt designs | verify source signature (e.g. Airnode) + timestamp | STRUCTURED | each network one family; check shared data providers |
| **zkTLS / TLSNotary** (Reclaim, DECO) | proof a specific HTTPS response came from a named origin | verify the TLS-session proof against the origin cert chain; hash the response | STRUCTURED — **bridges class-2 web docs into verifiable** | family = the origin server |
| **OpenTimestamps / RFC-3161 TSA** | proof a hash existed at/before a time | verify the timestamp proof (Bitcoin-anchored or TSA sig) | STRUCTURED (existence/freshness only) | orthogonal — proves *time*, not the fact |
| **Signed institutional release** (audit PDF, regulator filing, central-bank feed) | a signed doc from a named issuer | verify the issuer signature over the doc hash | STRUCTURED if signed, else DOCUMENT | issuer = family |
| **News / paper / consensus** (unsigned web) | reports, studies | none offline (provenance opaque) | DOCUMENT (class-2) | NI-11b conservative: unprovable → one family; *un-defer via zkTLS* |

## 4.2 Oracles are aggregators — the family-collapse subtlety (the sharpest oracle point)

A decentralized oracle's **internal node diversity is NOT anchor diversity.** One Chainlink
feed aggregates many node operators behind one aggregation contract and frequently a shared set
of upstream exchanges — so per NI-11b it counts as **one family**, exactly as same-base-model
validators count as one (CIP-7 NI-1). CIP-11's `requiredFamilies ≥ 2` therefore demands
*different oracle networks with demonstrably distinct data sourcing* — e.g. **Chainlink PoR +
Pyth + a zkTLS proof of the custodian's own statement** — and the pre-quorum correlation check
**collapses** any of them that trace to the same upstream (if Chainlink and Pyth both ultimately
read Binance/Coinbase prints, they are one family at the data-source layer). `provenanceTrace`
records each anchor's upstream venues/publishers so the collapse is mechanical, not declared.

And the honesty point oracles make unavoidable: **an oracle signature proves the oracle *said* X,
not that X is *true*.** A signed Chainlink report is structurally admissible (it exists, is fresh,
says X) — but content-truth still rests on the oracle's own decentralization **plus** cross-oracle
agreement (CIP-11) **plus** the deferred substrate (NI-15b). Oracles do not collapse the
structural/content split; they populate the structured class and make the family check operational.

## 5. The verifier and the revised `promotable()`

### 5.1 Structural verification (offline — no live fetch)

```ts
// Returns the credited, structurally-admissible anchor families, or [] if none qualify.
// Pure, deterministic; NO network. Class-2 anchors are recorded as deferred, never credited.
function structurallyAdmissible(anchors: Anchor[], head: Claim, policy: AnchorPolicy): {
  credited: Anchor[];          // class-1 anchors that passed every offline check
  deferred: Anchor[];          // class-2 anchors — logged (NI-15d), not credited yet
  families: number;            // independent families among `credited` (NI-11b)
} {
  const ok = anchors.filter((a) =>
    policy.admissibleTypes.has(a.anchorType) &&            // CIP-4 frozen policy
    a.provenanceClass === 'STRUCTURED' &&                  // class-1-first (NI-15d)
    isHash(a.contentHash) && a.citedAssertion.length > 0 && // NI-15a claim-bound hash
    after(a.surfacedAt, head.adjudicationTime) &&          // NI-15f: surfaced AFTER the head sealed (not content asOf)
    verifiesSig(a)                                         // signature over contentHash vs issuerKey
  );
  const deferred = anchors.filter((a) => a.provenanceClass === 'DOCUMENT'); // NI-15d: logged
  // NI-15g: only anchors with VERIFIED provenanceTrace can contribute an independent family.
  return { credited: ok, deferred, families: independentFamilies(ok.filter(hasVerifiedProvenance)) };
}
```

### 5.2 The gate splits — `reviewAdmissible()` (structural, NEW) vs `promotable()` (head authority)

Per NI-15b the structural verifier no longer promotes; it **admits to content review**. Two
predicates with disjoint authority:

```ts
// NEW: structural admission. Side-effect-free — sets anchorState + enters the content-review
// surface. Touches NONE of: lineage head, standing, published render order, reviewQueue membership.
const reviewAdmissible = (s: string, head: string): boolean => {
  if ((ballotMeta[s]?.supersedes ?? null) !== head) return false;
  if (!ratified(s)) return false;
  if (typeOf(s) !== typeOf(head)) return false;           // type cannot ride through (NI-13h)
  if (typeOf(head) === 'NORMATIVE') return true;          // conventional — no anchor (NI-13f)
  const a = structurallyAdmissible(ballotMeta[s]?.anchors ?? [], claimOf(head), anchorPolicy);
  return a.families >= policy.requiredFamiliesFor(typeOf(head));  // CIP-11 N, verified
};

// HEAD AUTHORITY: what actually moves the lineage current pointer (NI-15b).
const promotable = (s: string, head: string): boolean => {
  if (!reviewAdmissible(s, head)) return false;
  if (typeOf(head) === 'NORMATIVE') return true;          // conventional types resolve on ratification (no content layer)
  return anchorStateOf(s) === 'CONTENT_CONFIRMED';        // empirical/settled head moves ONLY on content (testnet)
};
```

A review-admitted supersede carries `anchorState:'STRUCTURALLY_ADMISSIBLE'`; **only** the deferred
content layer sets `'CONTENT_CONFIRMED'`. Pre-testnet, `promotable()` is therefore `true` for
NORMATIVE supersedes (conventional, no anchor) and `false` for every empirical/settled supersede
(content unconfirmable offline) — honest halt-over-degrade. The **named consumers bound by
NI-15b** (must read `reviewAdmissible` as *pending*, never as head/closed): the lineage head
selection, `standing`/status computation, the `publish-commons` render order, and `reviewQueue`
dequeue — each continues to act on `promotable`, never on `reviewAdmissible`.

## 6. Migration (forward-only, honest)

- `newAnchor:true` legacy ballots: the lineage they already promoted is **not** rewritten
  (forward-only, as with CIP-14). Going forward, `newAnchor` alone can promote **only**
  NORMATIVE heads (which need no anchor anyway); for EMPIRICAL_LIVE/SETTLED it is treated as
  a single *unverified DOCUMENT* anchor → deferred, not credited (NI-15c: strictly tighter).
- No existing core claim's status changes on adoption: today **zero** core supersedes carry
  `newAnchor` (verified below), so the gate tightening is purely prospective.

## 7. Worked candidates (real Commons claims this gate would govern)

The CIP-13 `reviewQueue` already surfaces the EMPIRICAL_LIVE claims with MATERIAL/DECISIVE
contrary weight — these are exactly the claims a future supersede would target, and their
backfilled falsification conditions already name the candidate anchors. Mapping them onto the
anchor classes shows the gate spanning both — and shows §3's deferral-not-denial in the live data:

| Claim (ballot) | Statement | Candidate anchor (from its falsification condition) | Class | Under CIP-15 |
|---|---|---|---|---|
| `9b53e408780d` / `70faad04b91a` | Tether (USDT) fully backed at par? | A **Chainlink Proof-of-Reserve feed** (on-chain, signed OCR) **+** an unqualified **Big-Four-equivalent GAAP/IFRS audit** (signed PDF) **+** optionally a zkTLS proof of the custodian statement | Class-1 — three *distinct families*: an oracle network, a named audit firm, a TLS origin. Each structurally verifiable offline | **Credited** — and the cleanest ≥2-families case: PoR-feed-alone is one family and would **not** meet `requiredFamilies≥2`; the audit + zkTLS add independent families. Content ("does the audit/PoR actually say fully-backed") → testnet; **admitted to content review, head does NOT move until `CONTENT_CONFIRMED`** (NI-15b). |
| `8e54337213e8` | AGI achieved before 2030-01-01? | A **major lab / regulator / court / standards body / accepted benchmark regime** anchoring that AGI was achieved | Mixed — a benchmark-regime result or signed regulator/court declaration is class-1; "broad acceptance" is class-2 | **Partly creditable** (the signed/benchmark part); the "broad consensus" part **deferred-logged**. |
| `6df153bcfe02` | Do LLMs perform genuine reasoning? | A **peer-reviewed study with broad consensus** on an operational definition of reasoning | Class-2 — scientific consensus, opaque/diffuse provenance | **Deferred, not denied** (NI-15d): logged as a pending class-2 anchor; gains no structural credit yet. This is the canonical neutrality test case. |
| `a9b59a4d8a9b` | Is the appendix purely vestigial? | **Strong new anchored evidence** on appendiceal lymphoid/microbiome (non)function | Class-2 — scientific literature | **Deferred, not denied** — same as LLM-reasoning. |

The split is honest: financial/AGI claims have a partly-structured anchor path that the gate
can enforce *now*; the two scientific claims are class-2 and the gate openly **defers** them
(logged) rather than pretending it can verify scientific consensus offline. That asymmetry is
*verifiability*, not a truth-ranking (NI-15d).

## 8. Gates (TDD)

- **G15a** — a supersede with `newAnchor:true` and no `anchors[]` does **not** promote an
  EMPIRICAL_LIVE/SETTLED head (boolean no longer enforces); a NORMATIVE head still promotes.
- **G15b** — a structured anchor that fails ANY offline check (bad type / not in CIP-4 policy /
  malformed hash / empty citedAssertion / bad signature / stale `asOf`) is **not** credited.
- **G15c** — a fully-valid structured anchor set meeting `requiredFamilies` **promotes**, and the
  promoted head carries `anchorState:'STRUCTURALLY_ADMISSIBLE'`, never `'CONTENT_CONFIRMED'`
  (NI-15b), and renders the content-pending label.
- **G15d** — N structured anchors sharing a `provenanceTrace` origin collapse to **one family**
  (NI-11b) → do not meet `requiredFamilies ≥ 2`; unknown provenance → one family. *Concrete: a
  Chainlink feed + a Pyth feed that both trace to the same exchange venues collapse to one
  family; a Chainlink PoR feed + an independent audit + a zkTLS proof count as three.* A single
  oracle network, however many internal nodes, is always one family.
- **G15e** — a class-2 (DOCUMENT) anchor is **recorded as deferred**, never silently dropped,
  and earns **zero** structural credit (NI-15d); the deferral is observable in the projection.
- **G15f** — NI-15c regression: the verifier admits **no** supersede that `newAnchor===true`
  would have rejected (strictly tighter on every axis).
- **G15g** — NI-13c regression: no EMPIRICAL_LIVE head reaches atemporal RESOLVED-as-truth via a
  structural-only promotion; `reviewQueue` keeps a content-pending head queued.
- **G15h** — NI-15e (binding): swapping/adding/dropping any anchor after the ballot is sealed
  changes `anchorCommitment` → the bound ballot hash no longer matches → `verifyEntry`/`verifyVote`
  fail. (Reordering the anchors or NFC-equivalent `citedAssertion` variants do NOT change it;
  duplicate `contentHash` is rejected at construction; a legacy no-anchor hash is byte-stable and
  a typed-only ballot's hash never collides with a typed+anchored one.)
- **G15i** — NI-15f (grounded freshness): a credited anchor whose `surfacedAt` does **not** equal
  its native verifiable timestamp (OCR round / VAA publish / chain-inclusion / OTS / RFC-3161) is
  **not credited** and cannot trigger re-adjudication; a *self-asserted-only* `surfacedAt` never
  satisfies the monotonicity trigger. With a verified `surfacedAt > adjudicationTime` and
  `asOf < adjudicationTime` (older-dated, newly-surfaced) the anchor **is** credited; `surfacedAt
  ≤ adjudicationTime` is rejected regardless of `asOf`.
- **G15j** — NI-15g (independence predicate): two anchors with verified but **shared** trace roots
  credit **one** family; an anchor with absent/unverifiable `provenanceTrace` credits **zero**
  (so two such anchors cannot fake `requiredFamilies ≥ 2`); only verified **distinct** roots add
  families.
- **G15k** — NI-15b (enforced, no side effects): a `reviewAdmissible` (structural-pass) supersede
  with `anchorState:'STRUCTURALLY_ADMISSIBLE'` does **not** move the lineage head, change standing,
  reorder the `publish-commons` output, or dequeue from `reviewQueue`; an **empirical/settled**
  supersede is `promotable` **only** at `anchorState:'CONTENT_CONFIRMED'`, while a **NORMATIVE**
  supersede still promotes on ratification. (Pre-testnet: no empirical head moves on structural pass.)

## 9. Out of scope (testnet-gated, exposed as a typed seam)

- **Content verification** — fetching the anchor and confirming it *says* `citedAssertion`.
  Deferred to the live oracle substrate CIP-11/CIP-2 §9a already wait on; surfaced as the
  `CONTENT_CONFIRMED` state the structural verifier never sets.
- Class-2 *structural crediting* (document-provenance graph tracing).
- Anchor-source reputation updates (NI-11d) — needs later-revealed ground truth.

## 10. Phase-1 — the implementable-now anchor set (consult-ratified 3/3, ballot `02e3c6cb822465eeec3bc41a6e3fc692a647fe7fd304d85705d20fa562429b8b`)

**The reframe.** Structural verification is a pure function of *(artifact, pinned-policy)* — it
needs **no network**. Only the *proposer* fetches the artifact (at proposal time). So the
testnet substrate is required only for (i) autonomous/trustless fetching and (ii) content-truth;
**not** for structurally verifying a supplied artifact. That makes a real first slice buildable now.

**Tiers.** *Tier-1 (build now):* self-contained crypto against a pinned root. *Tier-2 (defer):*
Chainlink OCR / Pyth VAA report parsing + signer-set rotation, zkTLS/TLSNotary, signed-PDF CAdES.
*Tier-3 (testnet):* live on-chain RPC reads, content verification, anchor-source reputation.

**The Phase-1 (Tier-1) anchor — every check offline, no live oracle:**
- `contentHash` = sha256 recomputed over the supplied bytes (reuses the registry hash discipline);
- `signature` = Ed25519 over the artifact, verified against a **pinned ISSUER key** — reuses
  QRM's existing `cryptoVerify`, but the issuer keys live in a policy file **strictly separate**
  from the validator `pinned-keyring.json`;
- `surfacedAt` grounded by an **OpenTimestamps (Bitcoin-anchored)** or **RFC-3161 TSA** proof,
  offline-verified against pinned BTC headers / pinned TSA root certs — the keystone that makes
  NI-15f's anti-forgery real (trust relocated from self-declaration to PoW / a pinned CA).

Two distinct pinned issuers ⇒ two independent families, so `requiredFamilies ≥ 2` is reachable now.

**Folded acceptance criteria (the 3 convergent consult conditions — TDD-binding):**
- **P1a — TYPE-LEVEL KEY DOMAIN SEPARATION (all three; the strongest condition).** A separate
  policy file is necessary but *not sufficient*. Enforce at the type level: a distinct `IssuerKey`
  type with **no shared lookup path** to the validator keyring; a **domain-separation
  context prefix in the signed payload** so a validator vote can never be replayed as an
  issuer-artifact signature or vice-versa; `verifyIssuerSignature()` MUST reject any key present
  in the validator `pinned-keyring`, and `verifyVote()` MUST reject any issuer key. Tests prove
  both directions of non-acceptance.
- **P1b — MANDATORY VERIFICATION-CLASS LABEL (all three).** Every Phase-1 anchor carries an
  explicit class label (`tier1_structural_anchor_only`) recording anchor type, issuer family,
  and timestamp-proof kind, and stating plainly that content-truth / relevance / live-source
  reputation are **NOT** verified. The admissible-type list is logged so coverage reads honestly
  — "this issuer signed these bytes at this time," never "this claim is true." Prevents Tier-1
  masquerading as full anchoring.
- **P1c — DOCUMENTED TIMESTAMP TRUST ASSUMPTION (all three).** NI-15f's anti-forgery now rests on
  pinned BTC headers (OpenTimestamps) / pinned TSA roots (RFC-3161) — recorded as the bounded,
  externally-auditable trust assumption that *replaces* the self-declared timestamp (a strict
  improvement, not relocation-in-disguise).

**Phase-1 gates (P1 acceptance tests, all offline/deterministic — ideal for TDD):**
- **GP1a** — a Tier-1 anchor with correct `contentHash` + valid issuer Ed25519 signature + valid
  OTS/RFC-3161 `surfacedAt` proof passes `structurallyAdmissible`; corrupting any one fails it.
- **GP1b** — P1a: a validator-keyring key cannot satisfy `verifyIssuerSignature`, and an issuer
  key cannot satisfy `verifyVote`; the domain-separation prefix makes the two payloads disjoint.
- **GP1c** — P1c: a `surfacedAt` not backed by a verifiable OTS/RFC-3161 proof is non-credited and
  cannot trigger re-adjudication (NI-15f); a self-asserted timestamp earns nothing.
- **GP1d** — P1b: every emitted anchor view carries the `tier1_structural_anchor_only` label and
  the "content/relevance/reputation NOT verified" statement; no path emits a Tier-1 anchor unlabeled.
- **GP1e** — two distinct pinned issuers yield two families (`requiredFamilies ≥ 2` reachable);
  two artifacts from the **same** pinned issuer collapse to one (NI-15g, origin-not-issuer-key).

**Implementation status.** Slice 1 — the hermetic Tier-1 verifier — is **BUILT** (`code/src/anchor.ts`,
`code/test/cip15-anchor.test.ts`; GP1a–e green, suite 286→291). It is standalone (no lineage
change yet, zero regression): the typed `Anchor`/`AnchorPolicy`, content-hash recompute, Ed25519
issuer-signature verification with P1a domain separation + validator-keyring rejection, the
ED25519_TSA timestamp scheme grounding `surfacedAt` (OTS_BITCOIN / RFC3161_CMS recognized but
deferred), `structurallyAdmissible` with the NI-15g origin-family count, the P1b
`tier1_structural_anchor_only` label, and `anchorGatePasses`. **Slice 2 (next):** wire
`anchorGatePasses` into the commons.ts lineage as the `reviewAdmissible()`/`promotable()` split
(NI-15b), add `BallotMeta.anchors[]` + the NI-15e `anchorCommitment` ballot-binding, and the
content-pending render label.
