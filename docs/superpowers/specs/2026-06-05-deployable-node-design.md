# Quorumchain Deployable Node (Stage-1 Test Deployment) — Design

**Status:** DRAFT — design consult-reviewed by V2 (Codex), SOUND-WITH-FOLDS; folds incorporated. Awaiting operator review → implementation plan.
**Date:** 2026-06-05
**Topic:** A minimal, Dockerizable read-and-intake node that publishes the existing consensus chain to the public internet and accepts screened ballot submissions — the Stage-1 → Stage-2 "testing deployment" milestone.

---

## 1. Goal & scope

Build the smallest thing that proves **the Quorumchain artifact can be deployed and operated as a public service** without changing consensus. Concretely, once running it must:

- serve the **Knowledge Commons** and **verdicts/ballots** read-only over a real network socket;
- accept **ballot submissions** from external testers, held for **operator screening** (only higher-quality, operator-accepted submissions are ever convened);
- survive a **restart** with the chain still verifying;
- keep **validator keys and model CLIs entirely on the operator's machine**.

**Non-goals (explicitly out of scope):** no P2P/gossip, no block production, no fork-choice, no on-box convening, no second validator node, no token/value. This is the README's **Approach A — "operator-authoritative publish + intake."** A distributed-validator testnet (the README's Stage-2 proper) is a later, separate project.

## 2. Context

The existing stack (all zero-dependency, Node built-ins only) already provides everything the node *serves*:

- `signed-vote.ts` — Ed25519 votes + `ratify()` (2/3 supermajority, recomputable by anyone).
- `vote-log.ts` — append-only SHA-256 hash chain (`GENESIS = "0"×64` → `entryHash`); any edit/reorder breaks verification.
- `ballot-registry.ts` — self-verifying `{prompt, context, meta}` registry; `verifyEntry()`.
- `commons.ts` / `commons-read.ts` / `commons-render.ts` — claim-graph projection (consensus + preserved dissent).
- `queue.ts` / `enqueue.ts` — the submission/convening queue primitives.
- `run-panel.ts` — live convening (spawns the real validator model CLIs).
- `pinned-keyring.json` — the pinned validator public keys (the trust root the node reuses).

**Key grounding fact:** convening requires the real validator model CLIs (`codex`, `hermes`, Claude) authenticated *as the operator*. Those exist only on the operator's machine, never on a rented host — so the public node **cannot and must not** convene. It serves and intakes; the operator's machine remains the source of truth and the only place verdicts are produced.

## 3. Architecture

Two sides, one network boundary:

```
  Tester ──HTTPS──▶  PUBLIC NODE (Docker/VPS)            OPERATOR MACHINE (private)
                     - serves /data/current (read-only)   - holds validator keys + model CLIs
                     - POST /submit → inbox (screened)     - run-panel / daemon (convening)
                     - NO keys, NO convening               - source of truth for the chain
                          ▲   │                                 │
                          │   └── GET /inbox (admin) ───────────┤  review-inbox CLI (pull + screen)
                          └────── POST /admin/publish ◀─────────┘  publish CLI (push verified snapshot)
```

The operator pulls the inbox, screens it, convenes accepted submissions locally, then publishes the new verified chain snapshot to the node. The node only ever **serves a verified snapshot** and **collects screened intake**.

## 4. Trust model & invariants

**This is a serving + intake layer. It introduces no new consensus invariant and needs no CIP** — confirmed by the V2 design consult. The consensus rule is unchanged: 2/3 Ed25519 ratification over the hash-chained append-only log.

Submission states (`PENDING_REVIEW`/`ACCEPTED`/`REJECTED`/`CONVENED`) are **operational, not consensus, states** — they never enter the signed log, never affect ratification, ordering, or head selection. (A CIP would be required only if any of those properties later changed; this design keeps them strictly off-chain.)

The node's trustworthiness rests on these invariants (each maps to a test):

- **NI-D1 — Pinned trust.** Ratification is verified against validator public keys **pinned in local node config** (`pinned-keyring.json`), *never* keys carried in an uploaded snapshot. A publish that implies a different validator set is rejected. *(Closes validator-set substitution — Codex's top finding.)*
- **NI-D2 — Chain identity.** `chainId = sha256(canonical({namespace:"quorumchain", protocolVersion, validators: <pinned pubkey PEMs, sorted>}))` is pinned locally. A publish whose recomputed `chainId` ≠ the pinned `chainId` is rejected. *(Closes same-genesis-different-rules substitution.)*
- **NI-D3 — Verify-or-reject.** A published snapshot is accepted only if it fully re-verifies: every entry's signatures, every ballot's 2/3 ratify under pinned keys, and the unbroken `GENESIS→entryHash` chain.
- **NI-D4 — Forward-extension only.** The accepted snapshot must extend the current one: same `chainId`, length ≥ current, and the current head hash appears at its existing index in the new chain (existing prefix byte-identical). History rewrites are rejected.
- **NI-D5 — Durable anti-rollback checkpoint.** A monotonic `checkpoint.json {chainId, length, headHash, publishedAt}` persists across restarts/volume restores. A publish shorter than the checkpoint length, or that does not contain the checkpoint head at its index, is rejected — even if it independently verifies. *(Closes rollback-after-volume-loss / replay-of-old-payload.)*
- **NI-D6 — Atomic publish.** Snapshots land in `/data/releases/<headHash>/`, are verified **from staging**, then `/data/current` is atomically repointed. Live files are never mutated in place; a crash mid-publish leaves the previous release serving.
- **NI-D7 — Fail-loud.** On boot the node verifies `current` against pinned keys + checkpoint. If invalid, it enters **degraded/read-only mode**: it refuses `/submit` and `/admin/publish`, serves a clear error, and surfaces the state in `/healthz`.

## 5. Components & file layout

New, each with one responsibility (small, independently testable):

| File | Responsibility |
|---|---|
| `code/src/node-server.ts` | HTTP transport (Node built-in `http`): routing, auth, body/size limits, timeouts, JSON I/O. Thin; delegates. |
| `code/src/node-handlers.ts` | Pure read handlers over the active release: head, verify (cached), commons index, claim, ballot, log page, submission status. |
| `code/src/node-config.ts` | Loads + validates env config and pinned trust (`pinned-keyring.json` → derives `chainId`); fails loud on misconfig. |
| `code/src/release-store.ts` | The `/data/releases/<headHash>/` + `/data/current` pointer mechanism, `checkpoint.json`, atomic swap, per-release cached verification result. |
| `code/src/publish-verify.ts` | The publish gate: NI-D1..D6 (pinned-key verify, chainId match, full re-verify, forward-extension, checkpoint). Pure given (stagedSnapshot, currentSnapshot, pinnedConfig). |
| `code/src/inbox.ts` | Submission store: append-only JSONL, capability IDs, status lifecycle, retention cap/tombstones. |
| `code/src/screening.ts` | Deterministic signals: well-formedness, near-duplicate (Jaccard), spam/rate flags. Zero inference. |
| `code/src/audit-log.ts` | Append-only `audit.jsonl` for admin decisions + publish attempts (never silent mutate). |
| `code/src/run-node.ts` | Entrypoint: load config, boot-verify, start server. |
| `code/src/review-inbox.ts` | **Operator-side CLI:** pull inbox (admin token), render submissions + signals as inert text, accept/reject, mark convened. |
| `code/src/publish-node.ts` | **Operator-side CLI:** package the local chain snapshot and push it to `POST /admin/publish`. |
| `Dockerfile` + `docker-compose.yml` | Container build; volume `/data`; reverse-proxy/TLS wiring documented. |

## 6. Data model & persistence

Volume `/data` layout:

```
/data
  current            -> releases/<headHash>      (atomic pointer; the only thing reads touch)
  releases/
    <headHash>/
      votes.log
      ballots.jsonl
      commons/       (rendered pages + index)
      verify.json    (cached: {chainId, valid, length, headHash, verifiedAt})
  checkpoint.json    ({chainId, length, headHash, publishedAt})
  inbox.jsonl        (submissions; append-only)
  audit.jsonl        (admin decisions + publish attempts; append-only)
```

**Schema versioning (NI-D8):** every persisted JSONL record carries `{version, createdAt, id}` so future migrations aren't brittle.

**Submission record:** `{version, id (128-bit crypto.randomBytes hex), createdAt, ballotHash, raw:{question,context}, screening:{...}, status, decision?:{by,at,reason}, convenedBallotHash?}`. Raw text is stored in its own field and never interpolated into control paths.

**Canonical hashing:** the prospective `ballotHash` is computed with the **existing** `ballotHash()` (already key-order-controlled per CIP-14/15) — no second serialization is introduced anywhere.

## 7. Endpoints

**Public read (no auth; read from `/data/current` only):**
- `GET /healthz` → `{ok, mode: "live"|"degraded", chainValid, length, headHash}`
- `GET /chain/verify` → the **cached** per-release `verify.json` (full re-verify is an admin path, not per-request)
- `GET /commons` → index (JSON; markdown available)
- `GET /commons/:hash` → claim view (`:hash` strictly `^[0-9a-f]{64}$`)
- `GET /ballot/:hash` → registry entry + `verifyEntry` result + verdict
- `GET /log?from=&limit=` → paginated raw log entries
- `GET /submissions/:id` → status of one submission by its capability id (PENDING/ACCEPTED/REJECTED+reason/CONVENED+hash). No listing.

**Write (Bearer `SUBMIT_TOKEN` — anti-spam, *not* auth):**
- `POST /submit {question, context}` → size-capped (413), rate-limited; computes prospective `ballotHash`, stores `PENDING_REVIEW` + screening signals, returns `{id, ballotHash}`.

**Admin (Bearer `ADMIN_TOKEN`):**
- `GET /inbox?status=` → list submissions + signals (admin only; never public)
- `POST /inbox/:id/decision {decision, reason?}` → ACCEPT/REJECT; appends an `audit.jsonl` event
- `POST /admin/publish` → stage → verify (NI-D1..D6) → atomic swap; appends an `audit.jsonl` event with the outcome/failure-reason class
- `POST /admin/reverify` → force a full re-verify of `current` (the non-cached path)

## 8. Publish protocol (NI-D3..D6)

1. Operator runs `publish-node` → POSTs the snapshot (`votes.log` + `ballots.jsonl`, commons regenerated server-side or shipped).
2. Node writes it to `releases/<incoming-headHash>/` (staging) — never touches `current`.
3. `publish-verify.ts` checks, **from staging**: pinned-key full verify (NI-D3), `chainId` match (NI-D1/D2), forward-extension vs `current` (NI-D4), checkpoint monotonicity (NI-D5).
4. On pass: write `verify.json`, atomically repoint `/data/current` (NI-D6), update `checkpoint.json`, append a success audit event.
5. On fail: discard staging, append a failure audit event with a reason class, return 4xx. `current` is untouched.

## 9. Submission & curation lifecycle

`PENDING_REVIEW → ACCEPTED → CONVENED`, or `PENDING_REVIEW → REJECTED(reason)`. **Rejected submissions are kept** (audit), subject to a retention cap with tombstones for spam (NI-D9). Convening is **operator-initiated on the operator's machine**, so a submission flood can never trigger a convening flood. After the operator convenes an accepted submission locally and publishes, they mark it `CONVENED` with the resulting `ballotHash`, which `/submissions/:id` then surfaces.

## 10. Screening signals (deterministic, zero AI)

Attached to each submission for the operator's decision; **nothing auto-rejects except hard payload caps**:

- **well-formed:** non-empty question + context; within `[minLen, maxLen]`; token count sane.
- **exact-duplicate:** identical prospective `ballotHash` already in the registry or inbox → hard flag.
- **near-duplicate (kept — directly serves "higher quality"):** Jaccard similarity over normalized token shingles vs existing Commons claims + pending submissions → one `similarity` score + `nearestHash`. Flags re-asking a settled claim.
- **spam/rate:** submissions per IP/token per window; repeated identical content.

Everything else is stored as simple boolean flags (Codex's "simple flags first"); the only numeric is the dup `similarity`.

## 11. Security hardening

- **Inbox is hostile input:** 128-bit `crypto.randomBytes` capability ids (not content hashes); admin-only listing; raw text stored separately and rendered **inert/escaped** in the CLI and any HTML; `SUBMIT_TOKEN` is anti-spam only.
- **Transport DoS caps (NI-D10):** max body bytes, max header bytes, request + idle timeouts, concurrent-connection cap, per-IP & per-token rate limits, global write-rate cap, global inbox disk-byte budget.
- **Path safety:** `:hash` params strictly `^[0-9a-f]{64}$`; all reads resolved inside the active release dir — no path-derived filesystem access.
- **Audit:** admin decisions and publish attempts are append-only `audit.jsonl` events.
- **TLS & secrets (deploy/ops):** TLS terminated by a reverse proxy (Caddy/nginx/Traefik) in front — bearer tokens never traverse plain HTTP. Tokens injected via env/Docker secrets, rotatable, never baked into the image; logs carry only token *fingerprints*.

## 12. Operator workflow (end-to-end)

1. Tester `POST /submit` → `PENDING_REVIEW`.
2. Operator runs `review-inbox` → sees submissions + signals (inert), `ACCEPT`/`REJECT`.
3. For `ACCEPTED`: operator convenes locally (`run-panel`/daemon over the existing queue) → signed votes appended to the local authoritative log + ballots + regenerated commons.
4. Operator runs `publish-node` → node verifies + atomically swaps → public reads now show the new verdict; operator marks the submission `CONVENED`.
5. Tester `GET /submissions/:id` → `CONVENED` + hash; `GET /commons/:hash` → the verdict.

## 13. Testing strategy (TDD)

**Unit (pure modules):**
- `inbox.ts` — status transitions; illegal transitions rejected; rejected retained; tombstone/cap behavior; capability-id randomness/shape.
- `screening.ts` — well-formedness bounds; exact-dup flag; near-dup flags a near match and ignores a distinct one; rate flag.
- `publish-verify.ts` — accepts a valid forward-extension; rejects: non-verifying chain, wrong `chainId`, substituted validator set (pinned-key mismatch), history rewrite, shorter-than-checkpoint, checkpoint-head-absent.
- `release-store.ts` — atomic swap leaves a consistent `current` under simulated mid-publish failure; checkpoint monotonicity persists.
- `node-handlers.ts` — read projections correct; `verify` reflects cached result; `ballot` reflects `verifyEntry=false` on a tampered entry; path-regex rejects bad `:hash`.

**Integration (`node-server` on an ephemeral port + temp `/data`):**
- 401 without token on `/submit` and admin routes; 413 on oversized body; rate-limit trips.
- `/submit` happy path → `PENDING_REVIEW`; `/inbox` admin-only; decision appends audit.
- `/admin/publish` accepts a valid-extending snapshot and **rejects** non-verifying, substituted-validator, history-rewriting, and rolled-back snapshots (audit event written each time).
- Boot with an invalid `current` → degraded mode: writes refused, `/healthz` reports it.
- **Restart durability:** stop + restart against the same `/data` → chain still verifies, checkpoint intact.

## 14. Success criteria

The container builds and runs; over a real socket it serves the Commons + verdicts, accepts token-gated + screened submissions, enforces every publish invariant (NI-D1..D7), and **survives a restart with the chain still valid and the checkpoint intact** — with validator keys and model CLIs never present on the box.

## 15. Deploy / ops requirements

- **Docker** image (Node base, zero runtime deps); `docker-compose.yml` mounting a persistent `/data` volume and a reverse proxy for TLS.
- **Reverse proxy** (Caddy/nginx) terminates TLS in front of the node.
- **Secrets** via env/Docker secrets; rotation supported; never in the image.
- **Backups** of `/data` (inbox + checkpoint especially).

## 16. Deferred / YAGNI (explicitly not in this milestone)

- Distributed validators / node-to-node replication (the README's Stage-2 proper — a separate project; this design is its clean stepping-stone).
- On-box convening or any key custody on the node.
- AI/model-scored screening (kept deterministic for the test phase).
- Rich multi-factor screening scores (simple flags + the one dup score for now).
- Full per-request chain re-verification (cached per release; explicit admin re-verify path instead).

## 17. Open questions

- Exact numeric limits (body-byte cap, rate windows, retention cap, near-dup threshold) — set sensible defaults in the plan, tune during the test.
- Whether commons pages are rendered server-side on publish or shipped in the snapshot — default: shipped in the snapshot (operator already runs `publish-commons.ts`), node serves them verbatim from the release.
