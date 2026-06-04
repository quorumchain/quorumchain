# Quorumchain
## A Decentralized AI Oracle Network with Verifiable Memory

**Whitepaper — Draft v0.9, June 2026**

> *"AI is the oracle, not the clock — with a memory."*

---

### Abstract

A blockchain keeps honest two things humans and software routinely get wrong: the *order*
of events and the *record* of them. In that sense it is a reliable **clock** —
deterministic, replayable, rewritable by no one. What it cannot do alone is decide what is
true about the outside world; for that it needs an **oracle**, an external source for facts
the chain cannot observe. Increasingly, those facts are judged by AI. Quorumchain's thesis
is that **AI belongs at the oracle, never at the clock**: the deterministic ledger orders
and records events and can never be rewritten by a model, while a panel of independent,
rival AI models produces only *signed judgments under frozen criteria*, gated by a
two-thirds supermajority before anything commits. An oracle consulted again and again also
needs **memory**, so Quorumchain pairs the ledger with two records — an **Accountability
Ledger** (the write path: every verdict, its frozen criteria, and its signatures,
hash-chained and tamper-evident) and a **Knowledge Commons** (the read path: a citable,
forkable graph of claims, each carrying its evidence, recorded dissent, and provenance).
Security rests on diversity: because the judges are different models from different vendors,
corrupting a verdict means breaking a supermajority of rivals, not capturing a single
operator. This paper specifies the architecture, the consensus and cryptographic mechanism,
the two memory pillars, the economic model that keeps the network solvent, and — as a
first-class section — the limits of what such a system can and cannot establish.

---

### Executive summary

**The problem.** People increasingly take answers from a single AI model on trust. A
single model is an unaccountable oracle: there is no second opinion, its behavior can
change silently between versions, its biases are hidden, and when it is wrong there is
no durable record and no recourse. As AI moves from a tool we check into an authority we
defer to, "trust me" is not good enough for consequential judgments.

**The solution.** Quorumchain replaces the single oracle with a panel of independent,
rival AI models. Each model judges a question against criteria that are *frozen before
it answers*, cryptographically signs its verdict, and a result is reached only on a
two-thirds supermajority. Every step is committed to a tamper-evident, hash-chained
ledger and a citable knowledge record, so anyone can replay the exact question, the
criteria, each model's reasoning, and the signatures, and check the outcome for
themselves. No single vendor, model, or operator can dictate a result — capture requires
breaking a diverse supermajority. The outcome is AI judgment that is **verifiable**,
**tamper-evident**, **credibly neutral**, and **reproducible**.

**What is live today.** Quorumchain is early, but it is running code, not a paper
design. A working signed-vote pipeline convenes three independent, production-grade
models from different vendors as validators V1, V2, and V3; each signs its verbatim
verdict with its own key, and the result is appended to a hash-chained log that, as of
this writing, holds more than 200 entries across 60-plus ratified rounds — including the
section-by-section consults that produced this whitepaper — backed by 240 passing tests. The
protocol governs itself on that same record: its design decisions, including this whitepaper's
own sections, were ratified by the panel and are replayable on the public log. These figures are
self-reported but independently verifiable: what is verifiable is the *log*, not the correctness
of the verdicts. The appendix gives the exact commands to re-run a round and check the chain.

**What this document is.** A protocol whitepaper, not a token sale. It describes how the
system works and is deliberately candid about what it cannot do: an AI panel records
*bounded, checkable evidence* — it does not decree truth. The sections that follow build
from the problem and the threat model, through the architecture and the two memory
pillars, to the node economics, governance, current status, and an honest accounting of
the limits.

---

## 1. Why this matters

A behavioral shift is underway. We used to answer a question by searching, comparing a
few sources, and judging for ourselves; increasingly we ask an AI model and take the
answer it returns. We offer this as *motivation*, not a measured claim — but the
direction is hard to miss, and the more weight those answers carry, the more it matters
how we produce them.

When a single model is the source of an answer, it is an **unaccountable oracle**. There
is no second opinion standing against it. Its behavior can change silently from one
version to the next, so the answer you received yesterday need not be the answer you
receive today — and there is no record of what changed. Its biases — inherited from
training data, from fine-tuning, from whoever operates it — are invisible at the point
of use. And when it is wrong, there is usually no durable record of what it was asked,
what it was shown, or why it concluded what it did, so there is nothing to audit and no
recourse.

Each of these is a facet of one structural problem: **a single point of trust is a
single point of failure.** Consensus among independent, rival models removes that single
point. If a question is judged by several models from different vendors, against criteria
fixed *before* they answer, and a result is reached only when a supermajority agree —
each having signed its own verdict — then corrupting the outcome no longer means leaning
on one operator. It means breaking a majority of competitors at once. Disagreement stops
being hidden inside a single system and becomes part of the record.

A judgment is also more useful if it is remembered, so Quorumchain keeps a second record
alongside the verdict log. The **Knowledge Commons** is a citable graph of claims, where
each claim carries the evidence it rests on, the dissent recorded against it, and its
provenance — and where nothing is silently rewritten: an earlier state can always be
recovered, and a reader who disagrees can fork it. By analogy it is something like a more
trustworthy, forkable Wikipedia — though the analogy is only a way in, not a claim of
parity. One dynamic is worth naming as intent rather than fact: a verifiable, accountable
record of judgments is also better source material for the next judgment, so a well-kept
Commons should, over time, improve the panel's answers, which in turn enrich the Commons.
Whether that compounding materializes is for the network to demonstrate, not for this
paper to assert.

What the design aims to make true of every judgment it records — each a property to be
*checked*, not a promise to be taken on faith:

- **Verifiable** — anyone can replay the exact question, the frozen criteria, each
  model's reasoning, and the signatures, and recompute the result.
- **Tamper-evident and permanent** — a committed verdict cannot be silently altered; any
  change to the record is detectable from the hash chain.
- **Credibly neutral** — no single vendor, model, or operator can dictate an outcome; a
  result requires a diverse supermajority.
- **Reproducible and accountable** — frozen criteria and recorded reasoning let a verdict
  be re-examined, challenged, and forked rather than accepted on trust.

The sections that follow specify the mechanisms meant to deliver these properties; Section
9 is candid about where they stop.

---

## 2. Design philosophy and threat model

Two principles govern every design decision in this paper.

**Capture is laundered through the gap between a rule's intent and its mechanical check.**
A guarantee is only as strong as the mechanical check that enforces it. Attackers do not
break stated intentions; they operate in the space between what a rule *means* and what it
mechanically *verifies*. So every guarantee in Quorumchain must reduce to something a third
party can check by computation — a signature, a hash, an anchor — not to a promise about
good behavior. Where this paper cannot reduce a claim to a mechanical check, it says so.

**AI consensus is not truth.** The panel records bounded, checkable validation evidence; it
does not decree what is true. A unanimous panel is logged as "3/3 agreed," never as "true."
Signatures prove *who agreed*; anchors (below) prove *what was checked against*; neither
proves correctness. Keeping this distinction is non-negotiable, and every later claim
preserves it.

### Diversity as a security primitive — and its limits

Model diversity is a **necessary** security primitive, not a complete security proof: it
*raises the cost* of capture without driving it to zero. A verdict requires a two-thirds
supermajority of independently-keyed models from different vendors, each signing its own
verdict; corrupting an outcome therefore means compromising a supermajority of rivals at
once rather than capturing a single operator, and any disagreement is recorded rather than
hidden. That mechanical increase in the cost of capture is the whole of what diversity buys
— it does not make a verdict correct.

Diversity is weak or absent against the following, which the threat model names rather than
elides:

- **(a) Collusion or shared-operator capture.** If a supermajority of validators are
  controlled or coordinated, diversity is nominal. The defense is economic and procedural
  (independent key custody, staking and slashing, registry rules), addressed in §5–§6 — not
  diversity itself.
- **(b) Correlated error.** The deepest blind spot. Models from different vendors are
  trained on largely overlapping corpora and tuned by similar methods, so a misconception
  pervasive in that corpus can be reproduced confidently and *identically* by all of them.
  Different vendors does **not** guarantee independent errors. A 3/3 shared hallucination is
  indistinguishable from a 3/3 verified truth **by validator signatures alone** — though not
  once the anchor requirement below, or external review, is brought to bear.
- **(c) Shared-input / prompt-framing capture.** The convener controls the question. A
  leading or biased framing can produce correlated 3/3 agreement across genuinely
  independent models with *zero* collusion. This is the cleanest possible instance of the
  first principle — capture in the gap between the convener's intent and the mechanical
  check — and the protocol treats the ballot framing itself as part of the attack surface
  (frozen, hashed criteria; recorded ballot provenance; §3).
- **(d) Jury-selection manipulation.** Gaming *which* validators are convened. What is
  mechanically checked: the validator registry, selection randomness, exclusion rules, and
  an audit trail of who was convened on each ballot.
- **(e) Sybil-forking of model identities.** Presenting near-duplicate models as distinct
  validators to manufacture the appearance of diversity. What is mechanically checked:
  model/vendor identity policy and independent key custody (§5).
- **(f) Shared-foundation / supply-chain dependency.** A *passive* correlated vulnerability,
  distinct from (a) and (b): if vendors fine-tune from a common base model or share training
  infrastructure, a flaw or backdoor in the base weights is a shared dependency that
  diversity does not address at all. This bounds how much independence cross-vendor selection
  can actually buy.

### What the protocol does about it

Confronted with this enumeration, the panel concluded that diversity alone is insufficient
to support any future use as a *recall oracle*, and adopted an active correlated-error
defense — by a two-thirds vote, **against its own founding premise**, with the dissent
recorded (round 60, log entry 171). The rationale was the admission above: cross-vendor
diversity raises the cost of *coordinated* attack but does little against *shared* error,
so certification must be constrained by something external to the panel. That the protocol
would ratify a defense against its own central premise — by 2/3, not unanimously — is itself
the recorded, checkable humility this section argues for. The defense has three parts.

- **Anchor-gated certification.** A ballot may reach the terminal status RESOLVED only if it
  carries an external verifiable anchor — an on-chain value, a signed feed, a citable
  document — against which the verdict is checked; an unanchored ballot, however unanimous,
  resolves no higher than INDETERMINATE. This restricts only *upward*: it can decline to
  certify, never decree truth. But it must be stated plainly that **anchoring relocates the
  single point of trust to the anchor; it does not remove it.** A "verifiable anchor" is not
  the same as a "trusted truth source": an anchor that is stale, adversarially selected,
  semantically ambiguous, or validly signed by a captured source re-creates exactly the
  single point of failure §1 set out to dissolve. Anchor admissibility — and the separate
  trust assumptions each anchor type carries — is therefore part of the threat model, not a
  detail hidden beneath it. The ratified direction for hardening this — applying the project's
  own diversity primitive to the data layer, requiring agreement among multiple independent
  anchors of distinct, *demonstrated* provenance rather than one — is specified as CIP-11
  (anchor diversity); it is a design-ratified direction, not yet a built capability, and even
  built it raises the cost of anchor capture without eliminating it.
- **Correlation-measurement probes.** Periodic known-answer probe ballots measure the rate
  at which the whole panel agrees *and is wrong*, converting the shared-error assumption into
  a measured floor that bounds what the oracle may be trusted for. This figure is published
  only as a **probe-distribution estimate with its methodology and scope** — never as a
  universal guarantee.
- **A method-not-conclusion refuter.** A rotating validator is tasked, by *method* (seek the
  strongest disconfirming case) and never by *conclusion* (it is not instructed to "argue
  against P"), to surface the strongest case against the proposition as an auditable
  artifact that feeds every validator's deliberation. Each validator's signed verdict
  remains its own honest belief, so the supermajority *arithmetic* stays clean
  procedurally. This is not a free correction, and the paper does not present it as one: the
  shared artifact couples the three deliberations rather than keeping them fully
  independent, and the refuter is subject to the same blind spots as any validator. Its
  value is procedural — it forces disconfirming evidence into the record — not an epistemic
  guarantee.

### What bites now, and what bites later

These defenses are aimed at *recall*-oracle use, where the panel must recall facts it cannot
directly read. They do not make the panel's present work risk-free. Correlated **recall**
error is largely inactive when the source is in front of the panel — and the panel's current
job is code and design self-validation, where the artifact it judges *is* the anchor it reads.
But correlated **interpretation** error survives the source being present: all three validators
can read the same contract and share a blind spot about, say, reentrancy or overflow semantics,
confidently and identically. So in the current regime correlated error is not dormant — only
its recall variety is mitigated; its interpretation variety is live, and the recall-oracle
defenses above are ratified ahead of the surface that would make recall-error active.

The closing position of this section is therefore deliberately modest. Diversity is
necessary but not sufficient; the system's honesty is structural — it caps its own claims
(INDETERMINATE by default, measured error floors, recorded dissent, trust assumptions
stated rather than buried) instead of asserting correctness.

---

## 3. Protocol architecture

**Figure 1 — the clock, the quarantined oracle, and the flow of one verdict.** The oracle
(the rival panel) only ever emits signed votes; the clock (the deterministic ledger) only
ever orders and records them. Nothing the oracle does can rewrite the clock.

```
            question + context
                    │
                    ▼
        FROZEN BALLOT   ballotHash = sha256( JSON{ prompt, context } )
                    │
        ┌───────────┼───────────┐         THE ORACLE  (quarantined: it judges,
        ▼           ▼           ▼          it cannot write or rewrite the ledger)
     ┌──────┐   ┌──────┐   ┌──────┐
     │  V1  │   │  V2  │   │  V3  │        independent models, different vendors
     │vndr A│   │vndr B│   │vndr C│        — each answers the frozen ballot alone
     └──┬───┘   └──┬───┘   └──┬───┘
        │ sign     │ sign     │ sign       Ed25519 over
        └──────────┼──────────┘            { validatorId, ballotHash, verdict,
                   ▼                          rawOutputHash, nonce }
            RATIFY  — a pure function anyone can recompute
            verdict only if ≥ ceil(2N/3) of the standing panel agree
                   │
        ┌──────────┴──────────────┐
        ▼                         ▼
   no supermajority          supermajority  (+ external anchor ⇒ may reach RESOLVED;
   → CONTESTED /                  │           unanchored caps at INDETERMINATE — §2)
     INDETERMINATE                │
        └──────────┬──────────────┘
                   ▼
   ╔═══════════════════════════════════════════════╗   THE CLOCK
   ║  deterministic ledger — append-only hash chain ║   runs no inference;
   ║  entryHash = sha256( prevHash + serialized(vote))║  rewritable by no model;
   ╚════════════════════════╤══════════════════════╝   any edit is detectable
                            │
        ┌───────────────────┴───────────────────┐      THE TWO PILLARS (§4)
        ▼                                        ▼
 ┌────────────────────┐   resolution feeds   ┌────────────────────┐
 │ ACCOUNTABILITY      │   memory, memory     │ KNOWLEDGE COMMONS   │
 │ LEDGER  (write path)│◄──── grounds ───────►│ (read path)         │
 │ bond · notary ·     │   the next verdict   │ claim graph: stance │
 │ resolution = SRA    │                      │ sets · status · rcpt│
 └────────────────────┘                      └────────────────────┘
```

### A dumb clock and a quarantined oracle

The architecture begins with a separation of powers. The **ledger** is deterministic: it
orders and records events and runs no inference. The **panel** is the quarantined oracle:
it produces signed judgments and can never write to or rewrite the ledger — its only output
is a signed vote that the ledger records. Probabilistic reasoning is fenced into the
attestation layer; the part of the system that must be reliable does no thinking, and the
part that thinks has no authority over the record.

The orchestrator that convenes a panel is deliberately **not** the trust root. It holds no
signing key and supplies no verdict; it passes the ballot's *content* to each validator,
and each validator signs its own vote behind a signer boundary. Crucially, the signer
**derives the ballot hash from the `(prompt, context)` content itself and never accepts a
caller-supplied hash** — so the orchestrator cannot hand a validator one question while
recording a signature against another. The orchestrator can collect and verify votes; it
cannot mint, alter, or rebind one.

### Frozen criteria

Before any model answers, the question and its context are committed as a single hash:

```
ballotHash = sha256( JSON{ prompt, context } )
```

Every vote is signed over this hash, so a validator can prove exactly what it was asked —
the defense against a bait-and-switch that asks one thing and records another. The
human-readable ballot statement is kept in a self-verifying registry: it must re-hash to
`ballotHash`, so the registry persists provenance, not trust.

### How a verdict is produced

The path from question to record is a function anyone can recompute:

1. **Independent answer.** Each validator answers the frozen ballot on its own.
2. **Signature.** The validator produces an Ed25519 signature over
   `{validatorId, ballotHash, verdict, rawOutputHash, nonce}`, where
   `rawOutputHash = sha256(verbatim reasoning)`. The signature *commits to* the reasoning:
   any reasoning later retained is verifiable against its committed hash (the chain stores
   the hash; the verbatim text is kept in a sidecar transcript). A per-convening **nonce**
   binds the vote to a single convening — every *convened* vote is nonce-bound and a vote
   not carrying the issued nonce is rejected, so a captured vote cannot be replayed into
   another convening. (Legacy votes signed before this rule predate the nonce field and
   remain replay-exposed; the exception is recorded, not hidden.)
3. **Ratification.** Ratification is a pure function of the signed votes: anyone holding the
   keyring can recompute it, and the orchestrator cannot change the result. A verdict is
   ratified only if it carries a two-thirds supermajority of the **registered standing
   panel** — the bar is `ceil(2n/3)` of the full registered set, so *absent validators count
   against it*. A caller may demand a stricter threshold but never one weaker than two
   thirds. (The denominator must be the standing set: validators on probation carry zero
   quorum weight and are excluded, so they cannot inflate the bar.)
4. **Append.** The signed votes are written to the log.

Within that path, three outcomes are not verdicts and are handled explicitly.
**Equivocation** — one validator signing two conflicting verdicts on the same ballot — is
*detected and its votes excluded from the tally*; the protocol *defines* it as a slashable
offense, though no stake penalty is implemented yet. A **parse failure or invocation
error** is recorded as a signed `NO_VERDICT`: kept in the tally for transparency but never
ratifiable. A **dead host, startup failure, timeout, or nonce mismatch** is recorded as a
failure, never appended as a vote and never tallied. In every case the absence counts
against the two-thirds denominator — two-thirds of the panel failing to decide is a *failed
convening*, not a ratified "no decision."

A ballot's terminal status is one of three: **RESOLVED** (certified, and — per §2 — only
when an external anchor was checked), **CONTESTED** (no supermajority, or a live dispute),
or **INDETERMINATE** (no certifiable answer). These follow from the verdict token the panel
ratifies together with protocol policy; the convening primitive does not itself test a
question for answerability.

### The record: a hash chain, anchored later

The log is a **SHA-256 hash chain** — not a Merkle tree. Each entry stores the previous
entry's hash and its own:

```
entryHash = sha256( prevHash + serialized(vote) )      genesis prevHash = 0…0 (64 hex)
```

Any edit, deletion, or reordering breaks the chain, and verification recomputes end-to-end,
so the log is **tamper-evident and append-only** — *not* unrewritable. The local file can be
edited; what the chain guarantees is that the edit is *detectable*. True immutability is
reserved for the **anchored head**: the planned anchor is on-chain hash-pinning, periodically
committing the chain head on-chain, and the anchor-trust-boundary caveat of §2 applies to
that anchor as it would to any other.

### What can be put to the panel

The convening primitive enforces frozen, hashable criteria and a fixed verdict set. It does
*not* mechanically decide whether a question is answerable — nothing in the signing or
logging code prevents a subjective or unfalsifiable question from being asked. The
discipline that keeps an unanchorable question from being certified RESOLVED is **protocol
policy layered above the primitive** (the anchor-gating rule of §2, enforced at the read and
reputation layer) together with the panel's own judgment — stated here as policy, not as an
automated guarantee. Who authors criteria, and how they are frozen, is part of that policy
surface rather than left to the convener at answer time.

### A worked example: round 29

The panel was asked whether MicroStrategy had sold any Bitcoin by 31 May 2026. The frozen
criteria distinguished an **event-based** resolution (did a sale dated within the window
occur?) from a **disclosure-based** one (had it been formally disclosed by the deadline?) —
a distinction that mattered, because the sale fell in-window while the 8-K disclosure lagged
just past it. Judging on the frozen, event-based criteria, the panel ratified **YES, 3/3**
(with `n = 3`, the bar is `2`). The round is replayable from the signed log: a tamper test
confirms an altered entry is detected, and a reproduction test confirms the entry's hash
recomputes from its inputs. It is included here as a concrete illustration of the mechanism
— not as the framing of the problem.

---

## 4. The two pillars

A verdict is more valuable when it is remembered, and remembered in a way that resists the
two failures §1 described — silent revision, and a single party holding the pen. Quorumchain
keeps that memory in two complementary pillars. The **Accountability Ledger** is the *write
path*: the record of what was committed, done, and resolved. The **Knowledge Commons** is the
*read path*: the standing map of what is credibly held, disputed, and unknown. The relationship
between them is an *intended dynamic*, stated as intent rather than asserted as a network
effect: a resolution feeds the memory, and the memory grounds the next resolution.

### Pillar I — the Accountability Ledger (write path)

The problem it answers is plain: **you cannot audit a record when the audited party holds the
pen.** When an AI agent acts in the world, or an agreement resolves on contested criteria, the
record of what was claimed, promised, and done is usually held by a party with a stake in the
answer.

The Ledger's primitive is the **Staked Resolvable Attestation (SRA)** — best understood as a
single *lifecycle* read at three times rather than a single built object: **BOND** (a
constraint committed *before* acting), **NOTARY** (what was claimed or done, recorded *at* the
act), and **RESOLUTION** (a panel verdict *after* the outcome). Conceptually they are one
interface; in today's code they are distinct artifacts — bonds and notary records are separate,
and resolution arrives through the signed verdict machinery of §3 — so the unification is a
design, not a claim of a single physical registry.

Each mode carries a hard, ratified boundary:

- **NOTARY** checks only procedural completeness, internal consistency, and plausible
  attributability — never whether the underlying claim is *true*. Every notary record's status
  is structurally `NOT_VERIFIED` (the only label the kernel can emit); its guarantee is
  *authorship, timing, and non-repudiation*, nothing more. This is deliberate: the system must
  not become a machine that manufactures trust.
- **BOND** gates autonomy — an unbonded or under-bonded agent is excluded from high-value
  contexts — and is slashed on a proven violation.
- **RESOLUTION** renders a signed verdict against the frozen criteria and scores calibration
  *only where genuine external ground truth exists*; where it does not, the record carries
  non-repudiation and no fabricated score. Resolution is gated behind an explicit
  ground-truth-source policy, and where the feed is weak or capturable it falls back to
  notary-only — the meta-oracle is quarantined rather than pretended away.

Two mechanisms give the write path its integrity. The criteria are **frozen** by the same
`ballotHash` commitment of §3 (over the `{question, criteria}` pair): adding context after the
fact produces a different hash and is mechanically detectable — the round-29 attack of
appending "additional context" after the deadline cannot be done silently. Legitimate
amendments must be timestamped, public-noticed, and narrower-only; genuinely ambiguous criteria
resolve INDETERMINATE rather than being read into a meaning that was never frozen. And
**evidence commitments have teeth**: on challenge the holder must disclose within a bounded
window or forfeit, an unrevealed commitment carries zero evidentiary weight, and there is no
privileged decryptor. Finally, the resolver's **no-position** is a signed, penalized
declaration, not an assumption — because diversity prevents *concentration* of control but not
*shared-incentive alignment* (common investors, correlated training), the no-position check is
flagged as declared, not quietly trusted.

### Pillar II — the Knowledge Commons (read path)

The Commons has one mechanical definition: **a public claim graph, maintained by rival models,
that stores the epistemic state of a question rather than a verdict on reality.** Each **Claim**
carries a statement, its `ballotHash`, a **stance set**, a status, a signed hash-chained
history, and a panel-state receipt. A claim is *never* marked simply true or false; it carries
the credible positions and lets the reader see the distribution.

Concretely, against the built types:

- **Status** is `RESOLVED | CONTESTED | INDETERMINATE` on the core read surface —
  `INDETERMINATE` being the first-class "honest unknown." (The reputation layer additionally
  models `OPEN` and `UNVERIFIABLE` for not-yet-resolved and panel-unverifiable claims; the
  whitepaper names the read-surface set as canonical and the others as that layer's states.)
- A **Stance** carries its position (a verdict token), the evidence and provenance behind it,
  and `panelVotes` — *how many panelists held it*. That figure is the **panel vote
  distribution**, explicitly **not** source-reputation and not popularity; calibration-weighting
  of support is a future graduation, not the current field.[^stance]
- **Standing** is `CONSENSUS | CREDIBLE_MINORITY | UNRANKED`, *computed* from the distribution
  and never panel-assigned. There is deliberately **no `FRINGE`**: on a CONTESTED or
  INDETERMINATE claim, every stance is shown UNRANKED with its raw plurality and provenance —
  the protocol has no power to demote a view.

A query therefore returns the full **map with receipts** — the consensus stance, the credible
minority, the evidence and sources behind each, the status, the panel-state receipt, and a link
to the tamper-evident history showing what was held before and why it changed. That is precisely
what a single-model chatbot structurally cannot offer.

The anti-Orwell guarantees are structural. There is **no silent rewrite**: every revision is
signed and hash-chained and superseded views are retained *with the reason they were
superseded*; there is **no edit key** by design, so there is nothing to capture or renounce.
The hash-chained history already provides supersede-with-reason; full forking into
provenance-distinguishable branches is a gated graduation. And the **popularity trap** — a graph
that rewards agreement converging to a monoculture — is closed at the source of truth: source
reputation moves *only* on accuracy against ground truth **external** to the panel, so agreeing
with the panel's own resolution earns nothing. (This source-reputation layer is distinct from a
claim's `panelVotes`.) Heterodox sources retain a reserved floor, and no reputation moves on the
unverifiable class. Each `CONSENSUS` label also carries a **panel-state receipt** recording the
panel composition that produced it (the built receipt is `{validators, size}`; a fuller
diversity/correlation receipt is gated) — so a verdict reached during a captured or correlated
era is identifiable and discountable after the fact, tying directly to §2's correlated-error
honesty.

### How the pillars feed each other

The connection is concrete, not rhetorical. A RESOLUTION verdict becomes a node in the claim
graph, keyed by its `ballotHash` (write → memory); and the prior stance history — together with
calibration context, where the gated scoring exists — is available as grounding when the next
resolution is judged (memory → write). Whether this compounding improves answers over time is,
as in §1, something the network must demonstrate.

### What is built versus gated

Both pillars run today: the notary kernel and bonds on the write path, the resolution index and
external-anchor source reputation on the read path. Calibration scoring (behind the
ground-truth-source policy), calibration-weighted stance support, the fuller correlation receipt,
and epistemic forking are gated graduations, not shipped capabilities — and §8 states exactly
where that line falls.

[^stance]: "Evidence and provenance" is a conceptual composite across the built code — the
    resolution-index stance records which validators held a position, while the reputation layer
    records external sources — rather than one unified struct.

---

## 5. The validator panel and progressive decentralization

§2 argued that diversity is a security primitive at a single instant. Two further questions
decide whether that primitive survives contact with reality: how the panel stays diverse *over
time*, and *who* is allowed to run it.

### A permanent panel of impermanent members

Quorumchain's validators are not durable software; they are named, dated model versions that
their providers retire on roughly 12-to-18-month cycles. The governing principle is therefore
that **the chain must outlive its most ephemeral component** — and the lifecycle must replace a
member, with no human in the loop at mainnet, without any of four failures: a silent provider
substitution, trust inherited unearned, the diversity floor breached mid-swap, or the survivors
quietly converging into one effective mind.

Four ratified mechanisms answer these:

- **Pinned, gated upgrades.** Validators are pinned to exact weights by default, which preserves
  reproducibility and removes a provider's standing channel to change a validator silently. A
  version change is an explicit admission event in which the new version is treated as a *fresh
  candidate* that must pass an independence/fingerprint test and a calibration gate before it
  replaces the pin — never silent, never automatic.
- **Probation.** An upgraded version takes the slot provisionally; its votes are recorded but
  held out of quorum-critical tallies until it re-proves calibration on its *own* version-bound
  record. Reputation is version-bound and never inherited; a provider's track record may shorten
  the probation window but can never skip it.
- **Defense against frontier convergence.** The one threat that needs no attacker: as models
  train on overlapping corpora and converge on shared conventions, "three providers" can quietly
  stop meaning "three independent error distributions." The defense is layered — a proactive
  *structural-heterogeneity mandate* that reserves slots for deliberately distinct lineages
  (classified by the reproducible provenance criteria of NI-10b, not by hand-waving), plus a
  runtime *correlation-eviction* detector that removes a converging member regardless of how
  capable it is. The hard rule: **capability is subordinate to independence.**
- **Overlap-handoff rotation.** A replacement is admitted and graduated *before* the outgoing
  validator is dropped, backed by a pre-qualified standby pool, so the diversity floor is never
  breached during churn.

### Who runs the panel: two tiers

Nodes that run inference and store data make Quorumchain a DePIN network — the service *is* the
chain — which is what could eventually justify a sovereign L1. But useful work adds *value*, not
consensus security on day one, so sovereignty is earned behind a gate (below), not claimed at
launch. The architecture draws one hard line: **permissionless, stake-weighted nodes may provide
infrastructure but may never be the judges.**

- The **judgment tier** is the verdict panel: permissioned-by-diversity and calibration-gated.
  Here **stake is a slashing bond — calibrated, not nominal — and never influence.** There is no
  stake-weighted judging; weighting a verdict by stake would reintroduce exactly the
  Sybil-monoculture and cheapest-model race the design exists to prevent.
- The **infrastructure tier** — storage, data-availability, inference-serving — is permissionless
  DePIN, paid per proof of storage or serving, where a Sybil is harmless to the verdict. The
  integrity line is firm (NI-10e): judgment nodes hold their own weights and ballot data, so the
  infra tier can affect liveness but never the verdict — it cannot censor a proof-of-inference
  submission, control the signed log, or front-run jury selection.

**Proof-of-Diversity admission.** The panel is defined as `N` model slots. While any slot is
unfilled, a judgment node may join *only by filling a missing slot* — so a monoculture is
un-enterable; once the taxonomy is fully covered, same-slot redundancy may enter. Proof of
Diversity is the floor, not the ceiling: correlation-eviction remains the runtime backstop. The
slot taxonomy is provenance-defined, panel-frozen, and never operator-editable; where provenance
is genuinely unverifiable (closed weights), the slot is flagged `LOW_ASSURANCE` and carries
elevated correlation scrutiny.

**Jury selection.** Each convening draws one node per covered slot at random — an ephemeral,
per-ballot jury of one vote per slot. An unpredictable jury cannot be bribed in advance, and
because fewer operators share a scarce slot, *those operators are drawn more often* (scarcity
rebalancing is per-operator), which raises their reward and attracts entry until the slot fills
out. This rests on prerequisites that are deliberately gated until production: unbiasable,
verifiable randomness (threshold/multi-source, with forced inclusion so a sequencer cannot grind
or delay it — and, on a stall, an *intentional* freeze rather than a fall back to a grindable
source: a conscious choice of safety over liveness, and an acknowledged denial-of-service
tradeoff); proof-of-inference bound to the pinned model; and a per-node stake bond. A built
**thin-slot rule** applies today: a slot with fewer than two operators is flagged *thin*, and
once any standard-weight slot exists the thin seats are excluded from the verdict and recorded as
advisory — not merely down-weighted — so a single-operator slot can never be the decisive vote
(the lone exception is the all-thin bootstrap, where thin seats must decide because no standard
seat yet exists). The stronger rule that **no single-provider or proprietary model may hold a
decisive slot** is a design requirement resting on the CIP-7 lineage merge and the heterogeneity
floor; what is mechanical today is the `LOW_ASSURANCE` flag, not the prohibition.

### Earning decentralization

Decentralization is a destination, not a genesis claim. A curated, diverse genesis node set opens
to the public only on public, objective, externally-audited gates, within a bounded time window,
with a transparency log of the curated-phase operators, ending in terminal key renunciation. The
substrate follows the same discipline: it begins as a rollup on shared security, and an eventual
sovereign two-tier DePIN L1 is earned only when a measurable security-bootstrap gate is met —
every criterion computationally verifiable on published on-chain metrics, with no discretionary
certifier, and reversible through the fork right. If the gates are unmet at the time bound, the
chain halts or transparently extends; it never graduates unsafe.

*Built today (`nodes.ts`):* Proof-of-Diversity admission, the verifiable per-slot draw with
scarcity rebalancing, and the thin-slot advisory rule. *Gated:* the threshold randomness beacon,
proof-of-inference model binding, the correlation-eviction runtime backstop, the
no-proprietary-decisive-slot prohibition, and the L1 graduation metrics.

---

## 6. Economic model: the mainnet steady state

This section describes the steady-state economics of the live network. It does not cover
token launch or issuance mechanics; it covers the model that keeps a diverse panel solvent
and honest once running.

### Solvency is security

Every other chain validates cheaply. Quorumchain runs three or more distinct, expensive AI
models for *every* verdict — a recurring operating cost no other blockchain carries. The
diversity defense is therefore a **standing bill**, payable whether or not the chain is busy.
The failure mode is specific and self-reinforcing: if fee revenue falls below the cost of the
diverse panel, the network can fund only the cheapest models, collapses toward a monoculture,
and becomes capturable. And because low usage tends to coincide with a low token price, the
chain is **poorest exactly when capture is cheapest.** The consequence governs the whole
section: every economic parameter here is also a security parameter.

### The token's two roles

In the steady state the native token does exactly two things: it is **gas** (paying for
verdicts, notarization, and storage) and it is a **stake / slashing bond** for judgment and
infrastructure operators. It is deliberately *not* a vote-weight or judgment-influence token —
as §5 established, stake never weights a verdict.

### Funding the standing bill

The funding model splits the bill in two. The **diversity floor is a public good**, funded
from a reserve so it survives zero-usage droughts; **marginal cost is a private good**, funded
by **dynamic per-verdict pricing** pegged to live inference cost plus a margin, so active usage
pays its own way without subsidy. This decouples the security budget from unpredictable demand.

### The solvency invariant

The model commits to an inequality, not a sentiment:

```
revenue (fees + bounded reserve draw)  ≥  inference cost + security budget
```

Two *distinct* invariants protect it, and the prose keeps them separate because both are built
and the word "floor" otherwise overloads:

- A **per-verdict cost ceiling**: the cost paid per verdict may not exceed the summed external
  benchmark for the panel's required tiers. This is what stops a captured cost signal from
  draining the reserve *through* a headcount-only check — the guard binds the burn-rate
  variable, not just the number of validators.
- A **reserve lower bound**: the reserve is sized to cover at least `min(24 months, Y × measured
  inference-cost variance)` of drought, validated by adversarial simulation — so the document
  itself, not an open parameter, carries a solvency claim.

### Fee flows

- **Inference reimbursement** is paid only against a verifiable proof-of-inference receipt bound
  to the *exact* model tier, and capped at an external, capability-tiered benchmark. A claim
  with missing or unprovable inference is unpaid; a proven claim that *over-reports* its tier is
  paid only up to the benchmark for the tier it actually ran, with the overage unpaid and the
  report itself challengeable and slashable.
- **Buybacks** follow a strict policy/execution split: the panel's two-thirds sets the buyback
  *policy*, but a deterministic rule executes it — the panel does not press the button. Execution
  is bounded by per-epoch caps, a time-lock, and a veto window, and by a hard rule that a buyback
  may **never** spend the reserve below the floor; a below-floor disbursement is rejected by
  client validity. Buybacks draw only on surplus *above* the reserve floor, so they never compete
  for the dollars that fund diversity — the security budget always outranks the buyback.

### Cost of corruption

For any single verdict, the bond-and-slashing design aims to keep the **cost of corruption above
the maximum value at stake** in that verdict. Corrupting a verdict means capturing a two-thirds
supermajority — `ceil(2N/3)` *distinct* model families (for the minimum panel of three, that is
two; three distinct families is the floor because it is the smallest panel that yields a
meaningful supermajority while still preserving recorded dissent). Beyond that bar, diversity
forces the briber across independent vendors, a challenge market lets anyone challenge a wrong
verdict and win the slashed stake (so a briber must out-bribe every challenger too), and
high-stakes verdicts convene a *larger* panel, raising the bribe target. Honest dissent is never
slashed — only proven collusion or a proven-wrong challenged verdict is.

### The cost oracle, and its limit

Because reimbursement and pricing both depend on "live inference cost," that figure is itself a
**challengeable verdict**, anchored to external observable compute prices (GPU spot markets,
published API pricing): a report exceeding the benchmark is a wrong verdict, subject to challenge
and slash. The oracle is a benchmark-clamped median with a bounded per-epoch change rate —
steady-state *and* velocity bounded — which **bounds reported cost to external prices** even
against a slow two-thirds coalition. Its limit must be stated plainly: the clamp inherits only
the honesty of its external anchor set. It bounds inflation *above* the anchor; it cannot defeat
manipulation *of* the anchor itself, which remains a residual open threat — the same
anchor-trust boundary §2 named.

### The insolvency path

The threats compose into one recognized cascade: cost-oracle inflation accelerates reserve
drain, the resulting token-price decline cheapens bribery, and cheap bribery sustains the
inflation — a feedback loop an adversary holding a short position profits from. The cost anchor
above breaks it at the source. The terminal state is stated explicitly rather than left to
optimism: if the reserve cannot fund the diversity floor even after buybacks, rebates, and
rewards are cut to zero, the chain **halts and refuses new verdicts rather than degrading to a
monoculture** — a sub-floor verdict set is rejected by client validity, so no verdict is produced
at all. The design chooses halt over degrade, because "solvency is security" would otherwise fail
at the exact moment it matters.

*Built today (`cost-oracle.ts`):* benchmark-anchored reimbursement with the exact-tier cap, the
benchmark-clamped median with steady-state and velocity bounds, fees at or above marginal cost,
the per-verdict cost ceiling, below-floor buyback rejection, and a reserve-drain-cascade
simulation in which a two-thirds inflation coalition is held at the floor by the clamp.
*Open parameters, to be ratified against testnet data within these invariants:* the exact
reserve-floor size, the drought runway, the pricing margin, stake and slash sizing, the buyback
caps, and the concrete external-anchor set and reporter bond.

---

## 7. Governance and the self-governing method

### How the protocol revises itself — and the limits on that

Every protocol change is a Quorumchain Improvement Proposal run through a fixed pipeline:
**consult** (the panel is asked an open design question), **draft**, **red-team** (a dedicated
adversarial round), **fold** (findings become non-negotiable invariants), and **ratify** (a
signed two-thirds vote). The recurring pattern is deliberate: red-team rounds repeatedly land
"two-thirds holds" with one validator dissenting, and the dissent is folded *in full* as binding
invariants rather than dismissed — the credible-minority mechanism of §4 operating on the
protocol's own governance. This whitepaper was written the same way: each section's framing was
put to the panel, and the dissents were folded before any prose was drafted.

The precise claim is narrow. The panel ratifies design *proposals*; it does **not** control its
own membership — a human steward admits and retires validators — and it is subject to override.
"Self-governing" describes a *method*, not unchecked authority.

### What is, and is not, autonomous

The distinction that matters is between the *process* layer and the *authority* layer.

- **Autonomous today (process):** the convening, deliberation, and signing loop runs with no
  human in it. Each validator deliberates in its own process and signs locally; the orchestrator
  holds no key and supplies no verdict. Round 47 closed OS-level key custody *on the signing
  path*, and round 48 made the last validator deliberate through its own CLI, so all three are
  symmetric and no human pastes a verdict.
- **Still human (authority, during bootstrap):** a steward admits and retires validators, sets
  tokenomics direction, and holds the treasury-backstop and final-override keys.

These are different layers, and the wall between them is load-bearing: *custody closed on the
signing path is not the same as keys renounced.* The honest status is a panel-authored,
autonomously-deliberated, autonomously-signed process operated by a human steward — **not** a
system from which the human is already fully removed.

### Key renunciation: the autonomy ladder

Steward keys are renounced **progressively, at their specified autonomy gates, and no key is
renounced unless its empirical drill has passed** — never automatically at a date. Final-override
renunciation, for instance, is gated on the fork drill actually working, because a right you
cannot exercise is a fiction. Autonomy is a destination reached through gates, not a property
claimed at genesis.

### The fork as the ultimate check

Internal voting is not the only recourse; exit is mechanical. Under client-enforced validity, a
block that applies a change violating the frozen core (a "T0" invariant) is simply **invalid** —
rejected like a malformed block — so a node *running a conformant, T0-validating client* is on
the honest fork by construction. The canonical chain is the T0-preserving fork, a function each
such node computes locally rather than a vote, so it cannot be captured by stake or social
majority; weight only tie-breaks *among forks that are already valid*. This guarantee is
conditional, and the condition is **client diversity**: it requires several independent client
implementations with genuinely distinct failure modes (distinct cryptographic, VM, and
validation lineages, not merely distinct teams) — the software-layer analogue of model
diversity, since a single-client monoculture would relocate capture one layer down. And the
*definitions* of the T0 checks are themselves frozen at the T0 level, so a captured panel cannot
hollow out an invariant through a sequence of individually-minor "clarifications."

The distinctive claim of Quorumchain is therefore the **method**: design and red-teaming
performed by a diverse panel on a public, signed, replayable record, with exit guaranteed
mechanically rather than socially — presented as a method and a trajectory, not a finished
autonomy.

---

## 8. Implementation status and roadmap

### What runs today

These figures are **self-reported but independently replayable** — a precise and limited
claim. Cryptographic replay proves that the computation is reproducible from the signed inputs
and untampered; it does *not* prove that the panel's judgments are correct, nor that the inputs
were externally sourced. With that boundary stated:

- A dozen-plus improvement proposals are ratified, the core of them also having survived the
  panel's own *internal* adversarial red-team rounds (internal adversarial review, not a
  third-party audit).
- The three-model panel convenes for real, appending Ed25519 votes to a hash-chained log whose
  *log* is independently verifiable (anyone can recompute the chain and the signatures; this is
  verifiability of the record, not validation of the verdicts). As of this writing the log holds
  more than 200 entries across more than sixty ratified convenings, chain-valid — *including the
  section-by-section consults that produced this whitepaper.*
- Every mechanism the paper marks as *built* is implemented and tested — 240 passing tests across
  the accountability ledger, the knowledge commons and reputation, node admission and jury draw,
  the validator lifecycle (including the correlation-eviction algorithm), bonds, the cost oracle,
  and the fork drill. The gated graduations named in §4–§6 — calibration scoring, the fuller
  correlation receipt, epistemic forking, the threshold randomness beacon, proof-of-inference
  binding, the no-proprietary-decisive-slot prohibition, and the L1 metrics — are, by definition,
  *not* yet among them. (Correlation-eviction is a mixed case: its algorithm is built and tested
  under the validator lifecycle, while its automatic operation as a live-network *runtime backstop*
  — which depends on the gated correlation probes — is not.)
- The autonomy loop runs with no human in it: a daemon drains a queue, a commit auto-sources a
  self-review, the panel convenes and a gate approves a change *only* on a ratified SOUND, and a
  public feed recomputes every outcome from the signed log. Twice, the loop found and fixed real
  bugs in its own code — its own gate blocking its own commit until the fix was ratified.

The appendix gives the exact commands to re-run a round and verify the chain, so each number
above is checkable rather than asserted.

### What it is not

Stated plainly to prevent any scope confusion: this is a live *local* pipeline — three model
processes that **one operator currently owns**, with state in hash-chained files on a single
machine. It is **not** a public on-chain network, **not** a set of independent third-party
validators, and **not** a deployed token economy. The panel's present job is code and design
*self-validation*, where the artifact it reads is itself the anchor — so, per §2, correlated
*recall* error is not the active risk in this regime, while correlated *interpretation* error
is. The honest gap to the end goal is threefold: (a) state lives on one machine, not a chain;
(b) there is no token, no treasury, and no economic teeth — slashing is *detected, never
executed*; and (c) three processes are owned by one operator, not run by independent validators.

### Bootstrap trust assumptions (explicit)

The honesty of the rest of this paper is sharpest when the present trust base is stated as a
single scannable list rather than left implicit. **Today, a reader must trust the single
operator on every link below.** Each is a property the roadmap is designed to remove — and each
is treated at length in §9; this is the consolidated ledger of them, not a softening.

- **Signing-key custody.** The validators' keys live OS-custodied on one operator's machine.
  Stolen or coerced keys impersonate the entire apparatus with no model collusion. (OS-level
  custody is closed on the signing path; that is *not* distributed trust.)
- **Model / vendor selection.** The operator chooses which models fill V1/V2/V3. Diversity is
  the operator's *claim* today, not yet enforced by a registry or Proof-of-Diversity admission.
- **Ballot authorship and framing.** The operator writes the question and context. A leading or
  biased frame is not mechanically caught — the §2(c) shared-input surface.
- **Evidence ingestion.** The operator supplies the evidence bundle; nothing yet authenticates
  its provenance, leaving the §9 evaluation-time-injection surface open.
- **Anchor selection.** The operator picks any anchor. Anchor diversity (CIP-11) is not built,
  so a single chosen anchor is a single point of trust.
- **Code / execution integrity (TCB).** The operator runs the code; a bug or a modified client
  silently corrupts outputs. The structural answer — independent client implementations — is
  not yet in place.
- **Storage and continuity.** State is hash-chained files on one machine: no failover if the
  operator stops, no shutdown-surviving public store yet.
- **No economic teeth.** Slashing is *detected, never executed*; no bond actually secures
  behavior today.
- **Verdict reproducibility.** Validators are externally-hosted, mutable models; a historical
  verdict is auditable via signed transcripts, not re-derivable like a hash.

What the operator *cannot* silently do, even today, is the load-bearing counterpart: rebind a
recorded vote to a different question (the signer-host derives `ballotHash` from the
`{prompt, context}` content child-side, the signature commits to it, and ratification rejects any
vote whose hash does not match the convened ballot), forge a *different* validator's signature,
alter a committed entry without breaking the chain, or manufacture a 3/3 from fewer than three
real signed votes. The trust above is real and concentrated; the roadmap below is the plan to
dissolve it link by link.

### The road to mainnet

The phases close that gap in dependency order; each ends with a panel convening against
objective gates, never a calendar.

1. **Autonomy, off-chain — done.** Demonstrated end-to-end; a sustained unattended window is a
   scheduling matter, claimed as nothing more.
2. **Economic layer.** A treasury routes fees to inference reimbursement and a two-thirds-gated
   buyback with deterministic execution — the §6 cost oracle connected to real flows. Its
   execution venue is an external, already-live chain; **Quorumchain's own on-chain execution
   does not appear until the testnet substrate below**, and the launch vehicle itself is outside
   this paper's scope. This design can proceed in parallel with the substrate work.
3. **Testnet substrate.** The modules are ported into an on-chain state-transition function; a
   conformant client rejects T0-violating blocks, so the fork right of §7 gains real teeth;
   slashing executes on-chain; and live-network primitives appear (a verifiable randomness
   beacon, proof-of-inference model binding, enclave key custody).
4. **Decentralization.** Independent operators are admitted by Proof of Diversity and seated by
   the verifiable draw — growing the set's *genuine* diversity before relying on it, because a
   thin validator set is cheaper to capture than the panels it defends.
5. **Mainnet.** Reached only once the testnet has run autonomously, the economics hold, and the
   set is diverse enough to resist capture.

### Scaling the panel

Today the panel spans three distinct model families; the testnet checkpoint is around ten and
mainnet around twenty or more. The diversity argument of §2 justifies the *direction* and the
*ordering* — corrupting a verdict requires a two-thirds supermajority across `ceil(2N/3)`
*distinct* families, so more genuinely independent families raises the cost of capture and lowers
correlated-error exposure. But it justifies "more," not any exact count: **security scales with
genuine distinctness, not headcount.** The real ceiling is the *supply* of genuinely independent
frontier families; reaching a target number by adding correlated fine-tunes of the same base
model would be diversity-theater — precisely the correlated-error failure §2 warns against. The
figures are engineering checkpoints bounded by the available distinct families, not round numbers
pursued for their own sake.

---

## 9. Limitations and honest scope

This section is first-class by design. The system's credibility rests on *capping its own
claims*, so its limits are collected here rather than scattered or omitted. Each is a place
where trust should be withheld.

**What a verdict can and cannot mean.**

- **AI consensus is not truth.** Agreement means an answer is plausible to current AI consensus
  — which can be uniformly wrong on contested questions. The Commons stores what is held and
  disputed, never a decree.
- **It is strongest where there is external ground truth and weakest on the unverifiable class.**
  It scores reliability only where reality can settle the matter; otherwise it offers
  non-repudiation, not verification. The notary proves authorship and timing, never content-truth
  — a signed false claim is still false.
- **Subjective, unfalsifiable, and open-prediction questions are outside its domain.** Where no
  external anchor can ever settle a question, the system offers the map and non-repudiation, never
  a certified answer. It cannot adjudicate matters of value or taste.

**How the judges can fail together.**

- **Correlated error.** Different vendors do not guarantee independent errors; a unanimous shared
  hallucination is indistinguishable from verified truth by signatures alone. The round-60
  defenses bound it but do not eliminate it, and correlated *interpretation* error is live in
  today's code-validation regime.
- **Verdict non-reproducibility and model mutability.** The verdict function is a stochastic call
  to mutable, often closed-weight, externally-hosted models. The same ballot re-run later can
  yield a different verdict, and a model may be deprecated or silently updated so the verdict
  cannot be re-derived at all. Frozen criteria freeze the *question*, not the *validators*: until
  validators are pinned, archived, or locally reproducible, a historical verdict is *evidentially
  auditable through signed transcripts, not re-derivable the way a hash is* — correct yet
  non-reproducible. The network also depends structurally on third-party providers (deprecation,
  pricing, availability) beyond bootstrap.
- **Reflexive contamination.** As Quorumchain verdicts are cited and absorbed into future training
  corpora, its own outputs contaminate the models it depends on; a wrong verdict can become part
  of the "consensus" future verdicts consult, and the risk grows with adoption, insulating the
  system from external correction.

**Where an adversary gets in.**

- **Bad or captured criteria at creation.** Frozen criteria stop post-hoc tampering, but a badly
  or leadingly framed question at creation can still produce a correlated, internally-valid wrong
  verdict — capture in the gap between intent and check. Genuinely ambiguous criteria resolve
  INDETERMINATE.
- **Evaluation-time prompt injection.** Because evidence and anchors are fed to the validators, an
  attacker who places text into the evidence bundle can try to *hijack the validators'
  instruction-following* — producing a verdict the truth-blind kernel deems well-formed, and
  potentially steering even independent models at once through one poisoned input. Input
  isolation, provenance gating, and the challenge market reduce this; they do not prevent it.
- **Adversarial false evidence.** The notary checks completeness, consistency, and attributability
  — not truth — so a complete, consistent, attributable but false account passes the kernel.
- **Anchors relocate trust, they do not remove it.** A verifiable anchor is not a trusted truth
  source; a poisoned, stale, ambiguous, or validly-signed-by-a-captured-source anchor recreates
  the single point of failure. The ratified direction for hardening this is anchor diversity
  (CIP-11): require agreement among multiple independent anchors of distinct, *demonstrated*
  provenance, collapse shared-upstream anchors into one family, and halt certification on
  disagreement. But CIP-11 is a design-ratified direction, *not yet built*; the provenance check
  is sound for structured anchors (signed feeds, on-chain attestations) yet genuinely murky for
  document and news anchors that may share a hidden upstream; and even fully built it raises the
  cost of anchor capture without eliminating it. **Anchor capture is a residual open threat.**
- **Legal and jurisdictional coercion.** Providers and anchor sources can be legally compelled —
  by subpoena, court order, or regulatory directive — to alter outputs, de-platform a topic, or
  change behavior silently. Neutrality depends on providers' jurisdictional independence, which is
  not guaranteed.

**Operational and trust-base limits.**

- **Single-operator capture, key compromise, and no continuity** *(present, not roadmap).* Today
  one operator holds every link — ballot execution, vendor selection, evidence ingestion, anchor
  gating — so stolen or coerced signing keys can impersonate the whole apparatus with no model
  collusion (OS-level custody is closed on the signing path, but that is not distributed trust).
  There is no failover if the operator stops, and durable, shutdown-surviving public storage is
  not yet in place.
- **Trusted computing base.** Every limit above assumes the Quorumchain code runs faithfully; a
  bug in notary verification, the freeze-over-degrade logic, or signature handling would silently
  corrupt outputs. The self-review loop and the tests reduce but cannot eliminate this; the
  structural answer — independent client implementations with distinct failure modes — is not yet
  in place.
- **Confidentiality.** Questions and evidence are exposed to third-party model providers — a
  data-exposure limit, not only the liveness and neutrality risk noted above.
- **Latency and cost.** Three or more expensive inferences per verdict make the system
  structurally slower and costlier than a single model; it is built for consequential judgments,
  not high-frequency or low-value queries. And the deliberate freeze-over-degrade choices (on a
  randomness stall and at the insolvency boundary) are conscious availability/denial-of-service
  tradeoffs accepted in exchange for safety.

**The defenses are not assumed sound.** The challenge market and calibration penalty leaned on
above can themselves fail — under-capitalization, griefing, or bribery of challengers — and
calibration presupposes a later disprovability that the unverifiable class does not have.

**It earns its scope.** The token, a sovereign L1, full autonomy, and independent decentralized
validators are graduations behind empirical gates — *not* properties today, when the system is a
single-operator local pipeline (§8). This is the trajectory, stated separately from the limits
above.

These are not footnotes. Capping the system's own claims — INDETERMINATE by default, measured
error floors, recorded dissent, halt over degrade — *is* the design, and the limits define where
trust should and should not be placed. Fittingly, this section is itself a product of the method
in §7: the panel voted an earlier version of this list *incomplete* twice before it passed,
forcing the injection, reproducibility, coercion, and trusted-computing-base limits onto the
page.

---

## 10. Conclusion

Quorumchain begins from one observation: people increasingly take answers from AI on trust, and
a single model is an unaccountable oracle. Its answer is to put AI at the oracle and never at the
clock — to let a panel of independent, rival models render signed judgments under frozen criteria,
gated by a two-thirds supermajority, on a tamper-evident record paired with a citable, forkable
memory. Model diversity is the security primitive that makes this hard to capture: *necessary*,
this paper has argued, but not *sufficient* — which is why the design leans additionally on
anchored certification, measured error floors, recorded dissent, and a mechanical right to exit.
The properties it reaches for — verifiable, tamper-evident, credibly neutral, reproducible — are
exactly the properties §9 then bounds. This is a system that states where it should *not* be
trusted as carefully as where it should.

What is most distinctive is not any single mechanism but the **method**: a protocol designed,
red-teamed, and revised by the diverse panel itself, on a public and replayable record, with exit
guaranteed mechanically rather than socially. This whitepaper is an instance of that method —
every section was put to the panel, and its dissents are folded into the text above. And it is a
trajectory, not a finished system: today a single-operator local pipeline, with the chain, the
economics, and the decentralization to be *earned* through empirical gates rather than asserted.

> **Knowledge by consensus, immutable by design** — where "immutable" denotes the property of §3:
> tamper-evident today on the hash-chained log, and anchored-immutable once the chain head is
> pinned on-chain.

---

## Appendix

### A. The improvement proposals

- **CIP-0** — thesis, tokenomics direction, and substrate decision (rollup first, sovereign L1 by graduation).
- **CIP-1** — AI integrity threat model: model diversity as the security model.
- **CIP-2** — source reputation and epistemic neutrality: accuracy over popularity (productized by CIP-9).
- **CIP-3** — consensus integrity: Ed25519-signed votes, `ballotHash = sha256(JSON{prompt, context})`, a hash-chained log, and 2/3 ratification recomputable by anyone.
- **CIP-4** — foundation and code irreversibility: the frozen T0 core, the T0/T1 change tiers, the autonomy ladder.
- **CIP-5** — fork coordination and exit: client-enforced T0 validity, the T0-preserving canonical fork, client diversity.
- **CIP-6** — consensus and economics threat model: solvency = security, the reserve plus dynamic pricing, the cost oracle.
- **CIP-7** — validator lifecycle and model churn: pinned/gated upgrades, probation, the structural-heterogeneity floor and correlation-eviction.
- **CIP-8** — the Accountability Ledger: the Staked Resolvable Attestation (bond / notary / resolution) and frozen-criteria resolution.
- **CIP-9** — the Knowledge Commons: the stance-set claim graph, no silent rewrite, forkability, and accuracy-not-agreement reputation.
- **CIP-10** — node economics and progressive decentralization: the DePIN two-tier architecture, Proof of Diversity, the scarcity-weighted jury, and the L1 graduation gate; plus the round-60 correlated-error defense (anchor-gating, correlation probes, the refuter artifact).
- **CIP-11** — anchor diversity (*design-ratified, not yet built*): hardens round-60 anchor-gating from one anchor to agreement among multiple independent anchors of distinct, demonstrated provenance, with shared-upstream anchors collapsed into one family and disagreement halting certification — the data-layer analogue of model diversity. Raises the cost of anchor capture without eliminating it; gated to the testnet substrate.

### B. Verify it yourself

Every figure in §8 is checkable from the repository — these are commands, not assertions:

- `node --test` — runs the full suite (240 passing tests as of this writing).
- `node src/run-panel.ts "<question>" "<context>"` — convenes the live three-model panel; the
  output prints the ballot hash, each validator's verdict, the tally, and `chain valid: true`.
- `node src/notary-demo.ts` — the accountability-ledger demo: **G1**, appending context after the
  fact produces a different ballot hash; **G2**, the round-29 $85M Polymarket dispute replays from
  byte-exact frozen criteria to its published hash with the signed YES 3/3 re-verified; **G3**,
  every notary record carries the `NOT_VERIFIED` label.
- The hash-chained log lives at `code/data/votes.log`; `verifyLog` recomputes the chain
  end-to-end, and any edit, deletion, or reorder breaks verification.

### C. Glossary

- **Ballot hash** — `sha256(JSON{prompt, context})`; the commitment that freezes a question and
  its criteria before any validator answers.
- **Staked Resolvable Attestation (SRA)** — the Accountability Ledger's primitive, read at three
  times: **bond** (commit), **notary** (act), **resolution** (resolve).
- **Stance set** — the credible positions on a claim in the Commons, each with evidence and a
  computed standing; a claim is never a single true/false value.
- **Standing** — `CONSENSUS`, `CREDIBLE_MINORITY`, or `UNRANKED`, computed from the distribution,
  never assigned.
- **Proof of Diversity** — admission by filling a missing model slot, so a monoculture is
  un-enterable.
- **Scarcity-weighted draw** — the per-ballot random selection of one node per slot, forming an
  unpredictable jury.
- **Anchor-gating** — certification to RESOLVED only against an external verifiable anchor;
  otherwise capped at INDETERMINATE.
- **Frozen criteria** — resolution rules hashed with the question at creation, so post-hoc context
  is detectable.
- **T0 / T1** — the frozen, fork-enforced core (T0) versus amendable rules (T1).
- **Correlation-eviction** — the runtime removal of a validator whose errors have converged with
  the panel's.
- **The diversity floor** — the minimum panel of distinct model families the reserve must always
  fund; sacrosanct against every other outflow.

### D. Core type definitions and an example signed vote

These are the shapes the "anyone can replay" claim rests on, reproduced from the implementation
(`src/signed-vote.ts`, `src/vote-log.ts`, `src/commons.ts`, `src/notary.ts`). They are given as
the *current* schema, not a frozen wire format — the normative source is the code at the
referenced files; this appendix is here so a reader can see exactly what is signed and recorded.

**The ballot and the signed vote.** A ballot is just `{ prompt, context }`; everything else is
derived. The signature commits to the verdict *and* a hash of the verbatim reasoning, so retained
reasoning is checkable against what was signed.

```
ballotHash    = sha256( JSON.stringify({ prompt, context }) )
rawOutputHash = sha256( verbatim reasoning )
signed bytes  = JSON.stringify({ validatorId, ballotHash, verdict, rawOutputHash, nonce? })

SignedVote {
  validatorId   : string          // "V1" | "V2" | "V3"
  ballotHash    : string          // 64-hex over {prompt,context}; the signer-host derives it child-side and
                                  //   ratify rejects any mismatch, so the recorded vote is bound to the
                                  //   exact question (the signVote primitive itself takes it as a parameter)
  verdict       : string          // a token from the ballot's verdict set, e.g. "YES" | "NO" | "ABSTAIN"
  rawOutput     : string          // verbatim reasoning (kept in a sidecar; only its hash is chained)
  rawOutputHash : string          // sha256(rawOutput)
  signature     : string          // hex, Ed25519 over `signed bytes`
  nonce?        : string          // per-convening; binds the vote to one convening (absent on legacy votes)
}
```

**The hash-chained log.** Each entry pins the previous entry's hash; verification recomputes
end-to-end, so any edit, deletion, or reorder is detectable.

```
entryHash = sha256( prevHash + JSON.stringify(vote) )   // genesis prevHash = 64 zeros

LogEntry { vote: SignedVote, prevHash: string, entryHash: string }
```

**A real entry — the genesis vote of the live log** (`code/data/votes.log`, line 1; a legacy
pre-nonce vote, so the `nonce` field is absent — recorded honestly, not back-filled):

```json
{
  "vote": {
    "validatorId": "V1",
    "ballotHash": "0bed297e5dd0e680a8beb092f89eb6bdf8ea73a3021a9fca1f241ca070d9e370",
    "verdict": "YES",
    "rawOutput": "… verbatim reasoning, elided …",
    "rawOutputHash": "40c302e76a5db43db6de348e2849dc848d10868976d85d72f0d3247c21f32966",
    "signature": "cf88750744a6ee32f263f6ba… (Ed25519, hex)"
  },
  "prevHash": "0000000000000000000000000000000000000000000000000000000000000000",
  "entryHash": "7f39b2d17017c2ab1533bb6efc11a6fb2978cf6d38e08f26effa0d8d8cb0a65b"
}
```

Current votes carry the per-convening `nonce` (e.g. `"nonce": "72997f493075fe30fe2b9dabae33a35e"`
on recent entries); the genesis vote predates that field, which is why it is shown without one.

**The Knowledge Commons claim.** A claim stores the *epistemic state* of a question, never a
single true/false value: all credible stances are retained, each with who held it.

```
Standing    = "CONSENSUS" | "CREDIBLE_MINORITY" | "UNRANKED"     // computed, never assigned
ClaimStatus = "RESOLVED" | "CONTESTED" | "INDETERMINATE"

Stance { position: string, validators: string[], panelVotes: number, standing: Standing }
PanelStateReceipt { validators: string[], size: number }
Claim {
  ballotHash        : string
  status            : ClaimStatus
  verdict           : string | null     // ratified verdict, or null when no quorum
  stances           : Stance[]          // ALL credible positions retained (pluralism)
  panelStateReceipt : PanelStateReceipt // the panel composition that produced it
}
```

**The Accountability Ledger attestation (SRA, notary mode).** Today's kernel emits notary
records only, and `status` is structurally `NOT_VERIFIED` — its guarantee is authorship, timing,
and non-repudiation, never content-truth.

```
Attestation {
  subject     : string                  // Ed25519 public key (PEM) of the bonded identity
  mode        : "NOTARY"                 // v0.1 is notary-only
  status      : "NOT_VERIFIED"           // structurally the only possible value
  ballotHash  : string | null           // null for non-resolvable notary-only records
  payload     : { action: string, evidenceCommitments: string[], policyVersion: string, confidence?: number }
  timestamp   : string                   // ISO-8601
  signature   : string                   // hex, Ed25519 over the canonical attestation bytes
}
```
