# Quorumchain Deployable Node — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Dockerizable, zero-dependency Quorumchain node that serves the existing consensus chain read-only over HTTP and accepts operator-screened ballot submissions — without ever holding keys or convening.

**Architecture:** "Operator-authoritative publish + intake" (spec `docs/superpowers/specs/2026-06-05-deployable-node-design.md`). The operator's machine stays the source of truth; the node serves an immutable, atomically-swapped release directory and collects screened submissions in an append-only inbox. The node verifies every published snapshot against **locally pinned** validator keys (`pinned-keyring.json`) and a durable anti-rollback checkpoint.

**Tech Stack:** TypeScript run via Node's native type-stripping (`node --test`, `node src/x.ts`). Node built-ins only (`node:http`, `node:crypto`, `node:fs`, `node:path`) — **zero runtime dependencies**, matching the existing codebase. Tests use `node:test` + `node:assert/strict`, temp dirs via `mkdtempSync`.

**Refinement note (NI-D3):** the publish gate verifies (a) the hash-chain links are intact and (b) **every vote is signed by a pinned validator key** (an unknown `validatorId` ⇒ reject the whole publish). It does **not** require every ballot to reach 2/3 — legitimately-failed convenings exist in the real log, and per-ballot ratification stays a projection concern (the Commons already records ratified-or-not). This is a precise reading of spec NI-D3 ("verify under pinned keys"); flag it to the operator/panel if a stricter all-ratified gate is wanted later.

---

## File Structure

**New production modules (`code/src/`):**
- `node-config.ts` — env + pinned-keyring loading; `chainId` derivation. Foundation.
- `vote-log.ts` *(modify)* — add a pure `verifyEntries(entries)` so the publish gate reuses the canonical chain check (DRY).
- `release-store.ts` — `releases/<headHash>/` + `current` pointer + `checkpoint.json`; atomic swap; cached `verify.json`.
- `publish-verify.ts` — the publish gate (NI-D1..D6): pure over `(stagedEntries, currentEntries, checkpoint, config)`.
- `inbox.ts` — append-only submission store; capability IDs; status lifecycle; byte-budget cap.
- `screening.ts` — deterministic signals (well-formed, exact/near-duplicate, rate flag).
- `audit-log.ts` — append-only `audit.jsonl` for admin decisions + publish attempts.
- `node-handlers.ts` — pure read handlers over the active release.
- `node-server.ts` — `node:http` transport: auth, limits, rate, routing.
- `run-node.ts` — entrypoint: load config, boot-verify, degraded mode, listen.
- `node-client.ts` — tiny shared HTTP client (operator CLIs) using global `fetch`.
- `review-inbox.ts` — operator CLI: list / accept / reject / mark-convened.
- `publish-node.ts` — operator CLI: package local snapshot, push to `/admin/publish`.

**New test files (`code/test/`):** one per module above (except CLIs share `node-client`), plus `node-server.test.ts` (integration) and `node-restart.test.ts` (durability).

**New packaging (repo root or `code/`):** `Dockerfile`, `docker-compose.yml`, `docs/DEPLOY-NODE.md`.

**Reused as-is:** `signed-vote.ts` (`verifyVote`, `ratify`, `ballotHash`), `ballot-registry.ts` (`loadRegistry`, `verifyEntry`), `vote-log.ts` (`readLog`), `pinned-keyring.json`.

**Conventions every task follows:** every module opens with a `// Quorumchain ($QRM) — …` header comment; every persisted JSONL record carries `{version, ...}`; reads happen only inside the active release dir; `:hash` params are validated against `^[0-9a-f]{64}$` before any filesystem use.

---

## Task 1: `vote-log.ts` — pure `verifyEntries` helper

**Files:**
- Modify: `code/src/vote-log.ts`
- Test: `code/test/vote-log.test.ts` (add cases)

- [ ] **Step 1: Write the failing test**

Add to `code/test/vote-log.test.ts`:

```ts
import { appendVote, readLog, verifyEntries } from '../src/vote-log.ts';
// ... existing imports: test, assert, mkdtempSync, tmpdir, join, a signed vote helper

test('verifyEntries: a clean chain verifies; a tampered entry is caught at its index', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'qrm-vl-')), 'votes.log');
  const v = makeVote('V1', 'YES'); // existing helper in this test file
  appendVote(path, v);
  appendVote(path, makeVote('V2', 'YES'));
  const entries = readLog(path);
  assert.deepEqual(verifyEntries(entries), { valid: true });

  const tampered = entries.map((e, i) => (i === 1 ? { ...e, vote: { ...e.vote, verdict: 'NO' } } : e));
  assert.deepEqual(verifyEntries(tampered), { valid: false, brokenAt: 1 });
});
```

(If `makeVote` does not already exist in the file, define it from `signVote`/`generateValidatorKey` as the other vote-log tests do.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/vote-log.test.ts`
Expected: FAIL — `verifyEntries` is not exported.

- [ ] **Step 3: Implement minimal code**

In `code/src/vote-log.ts`, refactor `verifyLog` to delegate to a new exported pure function (keep `verifyLog`'s signature unchanged):

```ts
export function verifyEntries(entries: LogEntry[]): { valid: boolean; brokenAt?: number } {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return { valid: false, brokenAt: i };
    if (e.entryHash !== computeEntryHash(e.prevHash, e.vote)) return { valid: false, brokenAt: i };
    prev = e.entryHash;
  }
  return { valid: true };
}

export function verifyLog(path: string): { valid: boolean; brokenAt?: number } {
  return verifyEntries(readLog(path));
}
```

Also export `GENESIS`: change `const GENESIS` to `export const GENESIS`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/vote-log.test.ts`
Expected: PASS. Then `node --test` (full suite) — still green (no behavior change to `verifyLog`).

- [ ] **Step 5: Commit**

```bash
git add code/src/vote-log.ts code/test/vote-log.test.ts
git commit -m "refactor(vote-log): extract pure verifyEntries; export GENESIS"
```

---

## Task 2: `node-config.ts` — config + pinned trust + chainId

**Files:**
- Create: `code/src/node-config.ts`
- Test: `code/test/node-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainIdFor, loadConfig, PROTOCOL_VERSION } from '../src/node-config.ts';

const KEYRING = { V1: 'PEM-1', V2: 'PEM-2', V3: 'PEM-3' };

test('chainIdFor is deterministic, order-independent, and changes if the key set changes', () => {
  const a = chainIdFor(KEYRING);
  const b = chainIdFor({ V3: 'PEM-3', V1: 'PEM-1', V2: 'PEM-2' }); // reordered
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, chainIdFor({ ...KEYRING, V3: 'DIFFERENT' })); // substituted key
  assert.notEqual(a, chainIdFor({ V1: 'PEM-1', V2: 'PEM-2' })); // dropped validator
});

test('loadConfig requires the two tokens and derives chainId from the keyring', () => {
  const env = { QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's', QRM_ADMIN_TOKEN: 'a' };
  const cfg = loadConfig(env, KEYRING);
  assert.equal(cfg.dataDir, '/tmp/x');
  assert.equal(cfg.submitToken, 's');
  assert.equal(cfg.chainId, chainIdFor(KEYRING));
  assert.equal(cfg.quorum, 2);
  assert.throws(() => loadConfig({ QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's' }, KEYRING), /QRM_ADMIN_TOKEN/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/node-config.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/node-config.ts`:

```ts
// Quorumchain ($QRM) — deployable node config + pinned trust root (spec NI-D1/D2).
// The node verifies published snapshots against keys PINNED HERE, never keys carried
// in an upload. chainId stamps the pinned validator set + protocol version so a
// wrong-chain volume is detectable. Zero dependencies.

import { createHash } from 'node:crypto';

export const PROTOCOL_VERSION = 'qrm-node-1';

export interface NodeLimits {
  maxBodyBytes: number; maxQuestionLen: number; maxContextLen: number;
  rateWindowMs: number; rateMaxPerWindow: number; inboxMaxBytes: number; nearDupThreshold: number;
}

export interface NodeConfig {
  dataDir: string; port: number; submitToken: string; adminToken: string;
  pinnedKeyring: Record<string, string>; chainId: string; quorum: number; limits: NodeLimits;
}

const DEFAULT_LIMITS: NodeLimits = {
  maxBodyBytes: 64 * 1024, maxQuestionLen: 2000, maxContextLen: 16000,
  rateWindowMs: 60_000, rateMaxPerWindow: 20, inboxMaxBytes: 8 * 1024 * 1024, nearDupThreshold: 0.8,
};

export function chainIdFor(keyring: Record<string, string>): string {
  const validators = Object.keys(keyring).sort().map((id) => ({ id, key: keyring[id] }));
  return createHash('sha256')
    .update(JSON.stringify({ namespace: 'quorumchain', protocolVersion: PROTOCOL_VERSION, validators }), 'utf8')
    .digest('hex');
}

export function loadConfig(env: Record<string, string | undefined>, keyring: Record<string, string>): NodeConfig {
  const require = (k: string): string => {
    const v = env[k];
    if (!v) throw new Error(`missing required env ${k}`);
    return v;
  };
  if (Object.keys(keyring).length === 0) throw new Error('empty pinned keyring');
  return {
    dataDir: require('QRM_NODE_DATA'),
    port: env.QRM_NODE_PORT ? Number(env.QRM_NODE_PORT) : 8787,
    submitToken: require('QRM_SUBMIT_TOKEN'),
    adminToken: require('QRM_ADMIN_TOKEN'),
    pinnedKeyring: keyring,
    chainId: chainIdFor(keyring),
    quorum: env.QRM_QUORUM ? Number(env.QRM_QUORUM) : 2,
    limits: DEFAULT_LIMITS,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/node-config.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/node-config.ts code/test/node-config.test.ts
git commit -m "feat(node): config loader + pinned-keyring chainId (NI-D1/D2)"
```

---

## Task 3: `release-store.ts` — immutable releases, atomic current, checkpoint

**Files:**
- Create: `code/src/release-store.ts`
- Test: `code/test/release-store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageRelease, commitRelease, currentRelease, readReleaseFile, readCheckpoint, writeCheckpoint, type Snapshot } from '../src/release-store.ts';

function tmpData() { return mkdtempSync(join(tmpdir(), 'qrm-rel-')); }
const SNAP: Snapshot = { votesLog: 'a\nb\n', ballots: 'x\n', commons: { 'INDEX.md': '# index' } };

test('stage then commit makes the release the atomic current; reads come from it', () => {
  const data = tmpData();
  const dir = stageRelease(data, 'deadbeef', SNAP);
  assert.equal(readFileSync(join(dir, 'votes.log'), 'utf8'), 'a\nb\n');
  assert.equal(currentRelease(data), null); // staged != current until committed
  commitRelease(data, 'deadbeef', { chainId: 'c', valid: true, length: 2, headHash: 'deadbeef', verifiedAt: 't' });
  assert.equal(currentRelease(data)?.headHash, 'deadbeef');
  assert.equal(readReleaseFile(data, currentRelease(data)!, 'votes.log'), 'a\nb\n');
  assert.equal(readReleaseFile(data, currentRelease(data)!, 'commons/INDEX.md'), '# index');
});

test('checkpoint round-trips and a second commit atomically repoints current', () => {
  const data = tmpData();
  stageRelease(data, 'aa', SNAP); commitRelease(data, 'aa', { chainId: 'c', valid: true, length: 2, headHash: 'aa', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 2, headHash: 'aa', publishedAt: 't1' });
  assert.equal(readCheckpoint(data)?.headHash, 'aa');
  stageRelease(data, 'bb', { ...SNAP, votesLog: 'a\nb\nc\n' }); commitRelease(data, 'bb', { chainId: 'c', valid: true, length: 3, headHash: 'bb', verifiedAt: 't' });
  assert.equal(currentRelease(data)?.headHash, 'bb');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/release-store.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/release-store.ts`:

```ts
// Quorumchain ($QRM) — immutable release store with an atomic `current` pointer (spec NI-D6).
// A published snapshot lands in releases/<headHash>/, is verified there, then `current`
// (a small pointer file) is repointed by write-temp + rename (atomic on one filesystem).
// Reads always resolve through `current`, so a crash mid-publish leaves the prior release
// serving and readers never observe a half-written chain. Zero dependencies.

import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { join, dirname } from 'node:path';

export interface Snapshot { votesLog: string; ballots: string; commons?: Record<string, string> }
export interface VerifyResult { chainId: string; valid: boolean; length: number; headHash: string; verifiedAt: string }
export interface Checkpoint { chainId: string; length: number; headHash: string; publishedAt: string }
export interface ReleaseRef { headHash: string; dir: string }

const RELEASES = (data: string) => join(data, 'releases');
const POINTER = (data: string) => join(data, 'current');

export function stageRelease(data: string, headHash: string, snap: Snapshot): string {
  const dir = join(RELEASES(data), headHash);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'votes.log'), snap.votesLog);
  writeFileSync(join(dir, 'ballots.jsonl'), snap.ballots);
  for (const [name, content] of Object.entries(snap.commons ?? {})) {
    const p = join(dir, 'commons', name);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  return dir;
}

export function commitRelease(data: string, headHash: string, verify: VerifyResult): void {
  writeFileSync(join(RELEASES(data), headHash, 'verify.json'), JSON.stringify(verify));
  const tmp = POINTER(data) + '.tmp';
  writeFileSync(tmp, headHash);
  renameSync(tmp, POINTER(data)); // atomic pointer swap
}

export function currentRelease(data: string): ReleaseRef | null {
  if (!existsSync(POINTER(data))) return null;
  const headHash = readFileSync(POINTER(data), 'utf8').trim();
  return { headHash, dir: join(RELEASES(data), headHash) };
}

export function readReleaseFile(data: string, ref: ReleaseRef, name: string): string | null {
  const p = join(ref.dir, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function readVerify(data: string, ref: ReleaseRef): VerifyResult | null {
  const raw = readReleaseFile(data, ref, 'verify.json');
  return raw ? (JSON.parse(raw) as VerifyResult) : null;
}

export function writeCheckpoint(data: string, cp: Checkpoint): void {
  const tmp = join(data, 'checkpoint.json.tmp');
  writeFileSync(tmp, JSON.stringify(cp));
  renameSync(tmp, join(data, 'checkpoint.json'));
}

export function readCheckpoint(data: string): Checkpoint | null {
  const p = join(data, 'checkpoint.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Checkpoint) : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/release-store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/release-store.ts code/test/release-store.test.ts
git commit -m "feat(node): immutable release store + atomic current pointer + checkpoint (NI-D6)"
```

---

## Task 4: `publish-verify.ts` — the publish gate (NI-D1..D5)

**Files:**
- Create: `code/src/publish-verify.ts`
- Test: `code/test/publish-verify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, signVote, type SignedVote } from '../src/signed-vote.ts';
import { appendVote, readLog, GENESIS } from '../src/vote-log.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyPublish } from '../src/publish-verify.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));
const QUORUM = 2;

function logWith(votes: SignedVote[]): string { // returns a votes.log file content
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-pv-')), 'votes.log');
  for (const v of votes) appendVote(p, v);
  return require('node:fs').readFileSync(p, 'utf8');
}
function vote(id: 'V1' | 'V2' | 'V3', bh: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: `${id}:YES` });
}
const parse = (s: string) => readLogFromString(s); // see helper note below
function readLogFromString(s: string) { return s.trim() ? s.trim().split('\n').map((l) => JSON.parse(l)) : []; }

test('accepts a valid forward-extension signed entirely by pinned validators', () => {
  const base = parse(logWith([vote('V1', 'bh1'), vote('V2', 'bh1')]));
  const ext = parse(logWith([vote('V1', 'bh1'), vote('V2', 'bh1'), vote('V3', 'bh2')]));
  // NOTE: build `ext` as a true extension of `base` — reuse the SAME first two entries:
  const r = verifyPublish({ staged: ext, current: base, checkpoint: null, keyring, chainId: 'c', quorum: QUORUM });
  // (If entryHashes differ because logWith re-chains independently, the test helper must
  //  construct ext by appending to base's file; see Step 3 note. Assert the happy path:)
  assert.equal(r.ok, true);
});

test('rejects a chain containing a vote from an unpinned validator (NI-D1 substitution)', () => {
  const rogue = generateValidatorKey();
  const bad = parse(logWith([signVote({ validatorId: 'VX', privateKeyPem: rogue.privateKeyPem, ballotHash: 'b', verdict: 'YES', rawOutput: 'x' })]));
  const r = verifyPublish({ staged: bad, current: [], checkpoint: null, keyring, chainId: 'c', quorum: QUORUM });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /unpinned|unknown/i);
});

test('rejects a tampered chain, a history rewrite, and a rollback below checkpoint', () => {
  const base = parse(logWith([vote('V1', 'bh1'), vote('V2', 'bh1')]));
  // tampered: flip a verdict so entryHash no longer matches
  const tampered = base.map((e: any, i: number) => (i === 0 ? { ...e, vote: { ...e.vote, verdict: 'NO' } } : e));
  assert.equal(verifyPublish({ staged: tampered, current: [], checkpoint: null, keyring, chainId: 'c', quorum: QUORUM }).ok, false);
  // history rewrite: a different chain that does not contain current[0]
  const fork = parse(logWith([vote('V3', 'other')]));
  assert.equal(verifyPublish({ staged: fork, current: base, checkpoint: null, keyring, chainId: 'c', quorum: QUORUM }).ok, false);
  // rollback below checkpoint
  assert.equal(verifyPublish({ staged: base, current: base, checkpoint: { chainId: 'c', length: 5, headHash: 'zz', publishedAt: 't' }, keyring, chainId: 'c', quorum: QUORUM }).ok, false);
});
```

> Helper note for Step 1/3: because `appendVote` re-chains from GENESIS, build an *extension* by appending to the SAME file the base was written to (don't write two independent files). The implementer should write a small `extend(baseFileContent, extraVotes)` helper in the test that writes base lines then appends, so `staged` shares `current`'s prefix entryHashes.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/publish-verify.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/publish-verify.ts`:

```ts
// Quorumchain ($QRM) — the publish gate (spec NI-D1..D5). A snapshot is accepted ONLY if:
//  D1 every vote is signed by a PINNED validator (unknown validatorId ⇒ reject);
//  D3 the GENESIS→entryHash chain links are intact (verifyEntries);
//  D4 it is a forward-extension of `current` (existing prefix byte-identical by entryHash);
//  D5 it does not roll back below the durable checkpoint.
// Pure: no filesystem, no network. Zero dependencies beyond the CIP-3 primitives.

import { verifyVote, type SignedVote } from './signed-vote.ts';
import { verifyEntries, type LogEntry } from './vote-log.ts';
import type { Checkpoint } from './release-store.ts';

export interface PublishInput {
  staged: LogEntry[]; current: LogEntry[]; checkpoint: Checkpoint | null;
  keyring: Record<string, string>; chainId: string; quorum: number;
}
export interface PublishResult { ok: boolean; headHash: string; length: number; reason?: string }

const head = (entries: LogEntry[]): string => (entries.length ? entries[entries.length - 1].entryHash : '0'.repeat(64));

export function verifyPublish(input: PublishInput): PublishResult {
  const { staged, current, checkpoint, keyring, quorum } = input;
  const result = (ok: boolean, reason?: string): PublishResult => ({ ok, headHash: head(staged), length: staged.length, reason });

  // D3 — chain integrity
  const chain = verifyEntries(staged);
  if (!chain.valid) return result(false, `chain broken at index ${chain.brokenAt}`);

  // D1 — every vote signed by a pinned validator
  for (const e of staged) {
    const v: SignedVote = e.vote;
    const pk = keyring[v.validatorId];
    if (!pk) return result(false, `unpinned validator ${v.validatorId}`);
    if (!verifyVote(v, pk)) return result(false, `invalid signature for ${v.validatorId}`);
  }

  // D4 — forward-extension of current (prefix identical, length non-decreasing)
  if (staged.length < current.length) return result(false, 'shorter than current (rewrite/rollback)');
  for (let i = 0; i < current.length; i++) {
    if (staged[i].entryHash !== current[i].entryHash) return result(false, `prefix diverges at index ${i} (history rewrite)`);
  }

  // D5 — checkpoint monotonicity (survives volume restore)
  if (checkpoint) {
    if (staged.length < checkpoint.length) return result(false, 'shorter than checkpoint (rollback)');
    if (checkpoint.length > 0 && staged[checkpoint.length - 1]?.entryHash !== checkpoint.headHash) {
      return result(false, 'checkpoint head not present at its index (rollback/fork)');
    }
  }

  void quorum; // reserved: a stricter "all ballots ratified" gate could use ratify() here (see plan note)
  return result(true);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/publish-verify.test.ts`
Expected: PASS (after the test helper builds `staged` as a true extension per the Step-1 note).

- [ ] **Step 5: Commit**

```bash
git add code/src/publish-verify.ts code/test/publish-verify.test.ts
git commit -m "feat(node): publish gate — pinned-key verify + extend + checkpoint (NI-D1/D3/D4/D5)"
```

---

## Task 5: `inbox.ts` — append-only submissions with status lifecycle

**Files:**
- Create: `code/src/inbox.ts`
- Test: `code/test/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { submit, listInbox, getSubmission, decide, markConvened, newId, type Signals } from '../src/inbox.ts';

function inbox() { return join(mkdtempSync(join(tmpdir(), 'qrm-ib-')), 'inbox.jsonl'); }
const SIG: Signals = { wellFormed: true, lengthOk: true, tokenCount: 5, exactDuplicate: false, nearestHash: null, similarity: 0, rateFlagged: false };

test('newId yields a 128-bit hex capability id', () => {
  const id = newId();
  assert.match(id, /^[0-9a-f]{32}$/);
  assert.notEqual(newId(), newId());
});

test('submit stores PENDING_REVIEW; decide and markConvened append new states (append-only)', () => {
  const path = inbox();
  const s = submit(path, { question: 'Q', context: 'C', ballotHash: 'bh', screening: SIG });
  assert.equal(s.status, 'PENDING_REVIEW');
  assert.equal(getSubmission(path, s.id)?.status, 'PENDING_REVIEW');
  decide(path, s.id, 'ACCEPT');
  assert.equal(getSubmission(path, s.id)?.status, 'ACCEPTED');
  markConvened(path, s.id, 'convened-bh');
  const final = getSubmission(path, s.id)!;
  assert.equal(final.status, 'CONVENED');
  assert.equal(final.convenedBallotHash, 'convened-bh');
});

test('reject records a reason and is retained; listInbox folds to the latest state per id', () => {
  const path = inbox();
  const a = submit(path, { question: 'A', context: 'C', ballotHash: 'a', screening: SIG });
  const b = submit(path, { question: 'B', context: 'C', ballotHash: 'b', screening: SIG });
  decide(path, b.id, 'REJECT', 'spam');
  assert.equal(getSubmission(path, b.id)?.status, 'REJECTED');
  assert.equal(getSubmission(path, b.id)?.decision?.reason, 'spam');
  assert.deepEqual(listInbox(path, 'PENDING_REVIEW').map((s) => s.id), [a.id]);
  assert.equal(listInbox(path).length, 2); // both retained
});

test('submit throws when the inbox exceeds the byte budget (NI-D9 cap)', () => {
  const path = inbox();
  assert.throws(() => submit(path, { question: 'Q', context: 'C', ballotHash: 'bh', screening: SIG }, 1), /budget/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/inbox.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/inbox.ts`:

```ts
// Quorumchain ($QRM) — append-only submission inbox (spec §9, NI-D9). Each accept/reject/
// convene appends a NEW full record; readers fold to the latest record per id, so history
// is never rewritten (matching the chain's ethos). Capability ids are 128-bit random, never
// content hashes. A byte-budget cap bounds public intake. Zero dependencies.

import { appendFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export interface Signals {
  wellFormed: boolean; lengthOk: boolean; tokenCount: number;
  exactDuplicate: boolean; nearestHash: string | null; similarity: number; rateFlagged: boolean;
}
export type SubStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CONVENED';
export interface Submission {
  version: 1; id: string; createdAt: string; ballotHash: string;
  raw: { question: string; context: string }; screening: Signals; status: SubStatus;
  decision?: { at: string; reason?: string }; convenedBallotHash?: string;
}

export function newId(): string { return randomBytes(16).toString('hex'); }

function now(): string { return new Date().toISOString(); }
function append(path: string, s: Submission): void { appendFileSync(path, JSON.stringify(s) + '\n'); }

export function readAll(path: string): Submission[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  return txt ? txt.split('\n').map((l) => JSON.parse(l) as Submission) : [];
}

function fold(path: string): Map<string, Submission> {
  const m = new Map<string, Submission>();
  for (const s of readAll(path)) m.set(s.id, s); // last write wins
  return m;
}

export function submit(
  path: string,
  input: { question: string; context: string; ballotHash: string; screening: Signals },
  maxBytes = Number.MAX_SAFE_INTEGER,
): Submission {
  if (existsSync(path) && statSync(path).size >= maxBytes) throw new Error('inbox byte budget exceeded');
  const s: Submission = {
    version: 1, id: newId(), createdAt: now(), ballotHash: input.ballotHash,
    raw: { question: input.question, context: input.context }, screening: input.screening, status: 'PENDING_REVIEW',
  };
  append(path, s);
  return s;
}

export function getSubmission(path: string, id: string): Submission | null { return fold(path).get(id) ?? null; }
export function listInbox(path: string, status?: SubStatus): Submission[] {
  return [...fold(path).values()].filter((s) => !status || s.status === status);
}

export function decide(path: string, id: string, decision: 'ACCEPT' | 'REJECT', reason?: string): Submission {
  const cur = getSubmission(path, id);
  if (!cur) throw new Error(`no submission ${id}`);
  if (cur.status !== 'PENDING_REVIEW') throw new Error(`cannot decide on ${cur.status}`);
  const next: Submission = { ...cur, status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', decision: { at: now(), reason } };
  append(path, next);
  return next;
}

export function markConvened(path: string, id: string, convenedBallotHash: string): Submission {
  const cur = getSubmission(path, id);
  if (!cur) throw new Error(`no submission ${id}`);
  if (cur.status !== 'ACCEPTED') throw new Error(`cannot convene from ${cur.status}`);
  const next: Submission = { ...cur, status: 'CONVENED', convenedBallotHash };
  append(path, next);
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/inbox.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/inbox.ts code/test/inbox.test.ts
git commit -m "feat(node): append-only submission inbox + lifecycle + byte cap (NI-D9)"
```

---

## Task 6: `screening.ts` — deterministic quality signals

**Files:**
- Create: `code/src/screening.ts`
- Test: `code/test/screening.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, jaccard, shingles } from '../src/screening.ts';

const OPTS = { minLen: 3, maxLen: 100, nearDupThreshold: 0.6 };
const empty = { prompts: [] as string[], hashes: [] as string[] };

test('jaccard/shingles: identical text ~1, disjoint text 0', () => {
  assert.equal(jaccard(shingles('the quick brown fox'), shingles('the quick brown fox')), 1);
  assert.equal(jaccard(shingles('alpha beta gamma'), shingles('xxxx yyyy zzzz')), 0);
});

test('well-formedness: empty question and out-of-bounds length are flagged', () => {
  assert.equal(screen({ question: '', context: 'c', ballotHash: 'h' }, empty, OPTS, false).wellFormed, false);
  assert.equal(screen({ question: 'ok question here', context: 'c', ballotHash: 'h' }, empty, OPTS, false).wellFormed, true);
});

test('exact duplicate flagged by ballotHash; near-duplicate flagged by similarity', () => {
  const corpus = { prompts: ['did the agent breach its staked bond on time'], hashes: ['known'] };
  assert.equal(screen({ question: 'q', context: 'c', ballotHash: 'known' }, corpus, OPTS, false).exactDuplicate, true);
  const near = screen({ question: 'did the agent breach its staked bond on time', context: '', ballotHash: 'new' }, corpus, OPTS, false);
  assert.equal(near.exactDuplicate, false);
  assert.equal(near.nearestHash, 'known');
  assert.ok(near.similarity >= OPTS.nearDupThreshold);
});

test('rateFlagged is passed through', () => {
  assert.equal(screen({ question: 'a valid q', context: 'c', ballotHash: 'h' }, empty, OPTS, true).rateFlagged, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/screening.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/screening.ts`:

```ts
// Quorumchain ($QRM) — deterministic submission screening signals (spec §10). Zero AI
// inference: well-formedness + exact-duplicate (by ballotHash) + near-duplicate (Jaccard
// over normalized token shingles vs the existing corpus) + a passed-in rate flag. Nothing
// auto-rejects; the operator decides. Zero dependencies.

import type { Signals } from './inbox.ts';

export function tokens(s: string): string[] {
  return s.toLowerCase().normalize('NFC').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
export function shingles(s: string, k = 3): Set<string> {
  const t = tokens(s);
  if (t.length < k) return new Set(t.length ? [t.join(' ')] : []);
  const out = new Set<string>();
  for (let i = 0; i + k <= t.length; i++) out.add(t.slice(i, i + k).join(' '));
  return out;
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface ScreenOpts { minLen: number; maxLen: number; nearDupThreshold: number }
export interface Corpus { prompts: string[]; hashes: string[] }

export function screen(
  input: { question: string; context: string; ballotHash: string },
  corpus: Corpus,
  opts: ScreenOpts,
  rateFlagged: boolean,
): Signals {
  const q = input.question.trim();
  const tks = tokens(`${input.question} ${input.context}`);
  const lengthOk = q.length >= opts.minLen && q.length <= opts.maxLen;
  const wellFormed = q.length > 0 && lengthOk;
  const exactDuplicate = corpus.hashes.includes(input.ballotHash);

  const mine = shingles(`${input.question} ${input.context}`);
  let nearestHash: string | null = null;
  let similarity = 0;
  for (let i = 0; i < corpus.prompts.length; i++) {
    const sim = jaccard(mine, shingles(corpus.prompts[i]));
    if (sim > similarity) { similarity = sim; nearestHash = corpus.hashes[i] ?? null; }
  }
  // nearestHash/similarity always report the closest corpus match; the operator (and the
  // opts.nearDupThreshold the server uses for flagging) decide what counts as "too similar".
  return { wellFormed, lengthOk, tokenCount: tks.length, exactDuplicate, nearestHash, similarity, rateFlagged };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/screening.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/screening.ts code/test/screening.test.ts
git commit -m "feat(node): deterministic screening signals — wellformed + dup + nearDup (§10)"
```

---

## Task 7: `audit-log.ts` — append-only admin/publish audit

**Files:**
- Create: `code/src/audit-log.ts`
- Test: `code/test/audit-log.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { audit, readAudit } from '../src/audit-log.ts';

test('audit appends typed events that read back in order', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'qrm-au-')), 'audit.jsonl');
  audit(path, 'DECISION', { id: 'x', decision: 'ACCEPT' });
  audit(path, 'PUBLISH', { ok: false, reason: 'rollback' });
  const ev = readAudit(path);
  assert.equal(ev.length, 2);
  assert.equal(ev[0].kind, 'DECISION');
  assert.equal(ev[1].detail.reason, 'rollback');
  assert.match(ev[0].at, /\d{4}-\d{2}-\d{2}T/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/audit-log.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/audit-log.ts`:

```ts
// Quorumchain ($QRM) — append-only operator audit log (spec §11). Admin decisions and
// publish attempts are recorded as events, never silent mutations. Zero dependencies.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';

export type AuditKind = 'DECISION' | 'PUBLISH';
export interface AuditEvent { version: 1; at: string; kind: AuditKind; detail: Record<string, unknown> }

export function audit(path: string, kind: AuditKind, detail: Record<string, unknown>): void {
  const ev: AuditEvent = { version: 1, at: new Date().toISOString(), kind, detail };
  appendFileSync(path, JSON.stringify(ev) + '\n');
}
export function readAudit(path: string): AuditEvent[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  return txt ? txt.split('\n').map((l) => JSON.parse(l) as AuditEvent) : [];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/audit-log.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/audit-log.ts code/test/audit-log.test.ts
git commit -m "feat(node): append-only admin/publish audit log (§11)"
```

---

## Task 8: `node-handlers.ts` — pure read handlers over the active release

**Files:**
- Create: `code/src/node-handlers.ts`
- Test: `code/test/node-handlers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { appendBallot } from '../src/ballot-registry.ts';
import { stageRelease, commitRelease, currentRelease } from '../src/release-store.ts';
import { handleHealth, handleVerify, handleBallot, handleLog, handleCommons, VALID_HASH } from '../src/node-handlers.ts';
import { readFileSync } from 'node:fs';

function buildRelease() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-h-'));
  const k = generateValidatorKey();
  const bh = ballotHash('Q', 'C');
  const tmpLog = join(mkdtempSync(join(tmpdir(), 'qrm-hl-')), 'votes.log');
  appendVote(tmpLog, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'V1:YES' }));
  const tmpReg = join(mkdtempSync(join(tmpdir(), 'qrm-hr-')), 'ballots.jsonl');
  appendBallot(tmpReg, 'Q', 'C');
  stageRelease(data, 'head1', { votesLog: readFileSync(tmpLog, 'utf8'), ballots: readFileSync(tmpReg, 'utf8'), commons: { 'INDEX.md': '# Commons', 'a.md': '# claim a' } });
  commitRelease(data, 'head1', { chainId: 'c', valid: true, length: 1, headHash: 'head1', verifiedAt: 't' });
  return { data, bh };
}

test('VALID_HASH accepts 64-hex, rejects path tricks', () => {
  assert.equal(VALID_HASH.test('a'.repeat(64)), true);
  assert.equal(VALID_HASH.test('../etc/passwd'), false);
});

test('health and verify reflect the active release', () => {
  const { data } = buildRelease();
  const ref = currentRelease(data)!;
  assert.equal(handleHealth(data, ref, 'live').body.chainValid, true);
  assert.equal(handleVerify(data, ref).body.headHash, 'head1');
});

test('ballot handler returns the entry + verifyEntry true; log paginates', () => {
  const { data, bh } = buildRelease();
  const ref = currentRelease(data)!;
  const b = handleBallot(data, ref, bh);
  assert.equal(b.status, 200);
  assert.equal(b.body.verified, true);
  assert.equal(handleLog(data, ref, 0, 10).body.entries.length, 1);
  assert.equal(handleBallot(data, ref, 'zz').status, 400); // invalid hash format
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/node-handlers.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/node-handlers.ts`:

```ts
// Quorumchain ($QRM) — pure read handlers over the active release (spec §7). Each returns
// {status, body}; the transport layer serializes. All reads resolve INSIDE the release dir;
// :hash params are validated against VALID_HASH before any path use (path-safety, §11).
// Reuses readLog/verifyEntries/loadRegistry/verifyEntry. Zero dependencies.

import { readLog, verifyEntries } from './vote-log.ts';
import { loadRegistry, verifyEntry } from './ballot-registry.ts';
import { readReleaseFile, readVerify, type ReleaseRef } from './release-store.ts';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

export const VALID_HASH = /^[0-9a-f]{64}$/;
export interface HandlerOut { status: number; body: any }

// readLog/loadRegistry want a file path; the release stores file CONTENT. Materialize the
// release's votes.log/ballots.jsonl to a temp path once per call (cheap at test scale).
function withFile(content: string | null, name: string): string | null {
  if (content === null) return null;
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-rd-')), name);
  writeFileSync(p, content);
  return p;
}

export function handleVerify(data: string, ref: ReleaseRef): HandlerOut {
  const cached = readVerify(data, ref);
  if (cached) return { status: 200, body: cached };
  const lp = withFile(readReleaseFile(data, ref, 'votes.log'), 'votes.log');
  const entries = lp ? readLog(lp) : [];
  const v = verifyEntries(entries);
  return { status: 200, body: { valid: v.valid, length: entries.length, headHash: ref.headHash } };
}

export function handleHealth(data: string, ref: ReleaseRef | null, mode: 'live' | 'degraded'): HandlerOut {
  if (!ref) return { status: 200, body: { ok: mode === 'live', mode, chainValid: false, length: 0, headHash: null } };
  const v = handleVerify(data, ref).body;
  return { status: 200, body: { ok: mode === 'live' && v.valid, mode, chainValid: v.valid, length: v.length, headHash: ref.headHash } };
}

export function handleLog(data: string, ref: ReleaseRef, from: number, limit: number): HandlerOut {
  const lp = withFile(readReleaseFile(data, ref, 'votes.log'), 'votes.log');
  const entries = lp ? readLog(lp) : [];
  return { status: 200, body: { total: entries.length, from, entries: entries.slice(from, from + limit) } };
}

export function handleBallot(data: string, ref: ReleaseRef, hash: string): HandlerOut {
  if (!VALID_HASH.test(hash)) return { status: 400, body: { error: 'invalid hash' } };
  const rp = withFile(readReleaseFile(data, ref, 'ballots.jsonl'), 'ballots.jsonl');
  const entry = (rp ? loadRegistry(rp) : []).find((e) => e.ballotHash === hash);
  if (!entry) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { entry, verified: verifyEntry(entry) } };
}

export function handleCommons(data: string, ref: ReleaseRef, hash?: string): HandlerOut {
  if (hash !== undefined && !VALID_HASH.test(hash)) return { status: 400, body: { error: 'invalid hash' } };
  const name = hash ? `commons/${hash}.md` : 'commons/INDEX.md';
  const md = readReleaseFile(data, ref, name);
  if (md === null) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { markdown: md } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/node-handlers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/node-handlers.ts code/test/node-handlers.test.ts
git commit -m "feat(node): pure read handlers over active release + path safety (§7/§11)"
```

---

## Task 9: `node-server.ts` — HTTP transport, auth, limits, routing

**Files:**
- Create: `code/src/node-server.ts`
- Test: `code/test/node-server.test.ts`

- [ ] **Step 1: Write the failing test** (integration, ephemeral port)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { createNode } from '../src/node-server.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function bootData() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-srv-'));
  const tmpLog = join(mkdtempSync(join(tmpdir(), 'qrm-sl-')), 'votes.log');
  appendVote(tmpLog, signVote({ validatorId: 'V1', privateKeyPem: keys.V1.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  stageRelease(data, 'h0', { votesLog: readFileSync(tmpLog, 'utf8'), ballots: '', commons: { 'INDEX.md': '# c' } });
  commitRelease(data, 'h0', { chainId: 'c', valid: true, length: 1, headHash: 'h0', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h0', publishedAt: 't' });
  return data;
}

async function startNode() {
  const data = bootData();
  const cfg = { dataDir: data, port: 0, submitToken: 'S', adminToken: 'A', pinnedKeyring: keyring, chainId: 'c', quorum: 2,
    limits: { maxBodyBytes: 1024, maxQuestionLen: 200, maxContextLen: 800, rateWindowMs: 60000, rateMaxPerWindow: 100, inboxMaxBytes: 1e9, nearDupThreshold: 0.8 } };
  const node = createNode(cfg);
  await node.listen();
  return { node, base: `http://127.0.0.1:${node.port()}`, data };
}

test('public reads work without a token; admin/submit require their token', async () => {
  const { node, base } = await startNode();
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/inbox`)).status, 401);
    assert.equal((await fetch(`${base}/submit`, { method: 'POST', body: '{}' })).status, 401);
    const ok = await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'a real question', context: 'ctx' }) });
    assert.equal(ok.status, 200);
    const { id } = await ok.json();
    assert.match(id, /^[0-9a-f]{32}$/);
    const st = await (await fetch(`${base}/submissions/${id}`)).json();
    assert.equal(st.status, 'PENDING_REVIEW');
  } finally { node.close(); }
});

test('oversized body is rejected 413; admin can list and decide', async () => {
  const { node, base } = await startNode();
  try {
    const big = await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: 'x'.repeat(5000) });
    assert.equal(big.status, 413);
    const sub = await (await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'keep me', context: 'c' }) })).json();
    const list = await (await fetch(`${base}/inbox?status=PENDING_REVIEW`, { headers: { authorization: 'Bearer A' } })).json();
    assert.ok(list.submissions.some((s: any) => s.id === sub.id));
    const dec = await fetch(`${base}/inbox/${sub.id}/decision`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'ACCEPT' }) });
    assert.equal(dec.status, 200);
  } finally { node.close(); }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/node-server.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/node-server.ts`:

```ts
// Quorumchain ($QRM) — HTTP transport for the deployable node (spec §7/§11). Node built-in
// http only. Enforces: bearer auth (timing-safe), body-size cap (413), per-IP+token rate
// limit, request/idle timeouts, connection cap. Routes to the pure handlers + inbox + the
// publish gate. NEVER holds validator keys. Zero dependencies.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { readLog } from './vote-log.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { NodeConfig } from './node-config.ts';
import { currentRelease, stageRelease, commitRelease, writeCheckpoint, readCheckpoint, readReleaseFile, type Snapshot } from './release-store.ts';
import { verifyPublish } from './publish-verify.ts';
import { handleHealth, handleVerify, handleLog, handleBallot, handleCommons, VALID_HASH } from './node-handlers.ts';
import { submit, listInbox, getSubmission, decide } from './inbox.ts';
import { screen, type Corpus } from './screening.ts';
import { ballotHash } from './signed-vote.ts';
import { loadRegistry } from './ballot-registry.ts';
import { audit } from './audit-log.ts';

function tokenEq(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}
function send(res: ServerResponse, status: number, body: unknown): void {
  const s = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(s);
}
function materialize(content: string | null, name: string): string | null {
  if (content === null) return null;
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-mz-')), name);
  writeFileSync(p, content);
  return p;
}

export interface NodeHandle { listen(): Promise<void>; close(): void; port(): number }

export function createNode(cfg: NodeConfig, getMode: () => 'live' | 'degraded' = () => 'live'): NodeHandle {
  const data = cfg.dataDir;
  const inboxPath = join(data, 'inbox.jsonl');
  const auditPath = join(data, 'audit.jsonl');
  const rate = new Map<string, number[]>();

  const allowed = (key: string): boolean => {
    const now = Date.now();
    const arr = (rate.get(key) ?? []).filter((t) => now - t < cfg.limits.rateWindowMs);
    arr.push(now);
    rate.set(key, arr);
    return arr.length <= cfg.limits.rateMaxPerWindow;
  };

  const readBody = (req: IncomingMessage): Promise<string | null> =>
    new Promise((resolve) => {
      let size = 0; const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => { size += c.length; if (size > cfg.limits.maxBodyBytes) { resolve(null); req.destroy(); } else chunks.push(c); });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', () => resolve(null));
    });

  const corpus = (): Corpus => {
    const ref = currentRelease(data);
    const rp = ref ? materialize(readReleaseFile(data, ref, 'ballots.jsonl'), 'ballots.jsonl') : null;
    const reg = rp ? loadRegistry(rp) : [];
    const pend = listInbox(inboxPath).map((s) => ({ p: `${s.raw.question} ${s.raw.context}`, h: s.ballotHash }));
    return { prompts: [...reg.map((e) => `${e.prompt} ${e.context}`), ...pend.map((x) => x.p)], hashes: [...reg.map((e) => e.ballotHash), ...pend.map((x) => x.h)] };
  };

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const path = url.pathname;
      const ip = req.socket.remoteAddress ?? 'unknown';
      const mode = getMode();
      const ref = currentRelease(data);

      // public reads
      if (req.method === 'GET' && path === '/healthz') return send(res, 200, handleHealth(data, ref, mode).body);
      if (mode === 'degraded' && (path === '/submit' || path.startsWith('/admin') || path.startsWith('/inbox')))
        return send(res, 503, { error: 'degraded: chain invalid' });
      if (!ref) return send(res, 503, { error: 'no chain published yet' });

      if (req.method === 'GET' && path === '/chain/verify') return send(res, 200, handleVerify(data, ref).body);
      if (req.method === 'GET' && path === '/commons') return reply(res, handleCommons(data, ref));
      if (req.method === 'GET' && path.startsWith('/commons/')) return reply(res, handleCommons(data, ref, path.slice('/commons/'.length)));
      if (req.method === 'GET' && path.startsWith('/ballot/')) return reply(res, handleBallot(data, ref, path.slice('/ballot/'.length)));
      if (req.method === 'GET' && path === '/log') return reply(res, handleLog(data, ref, Number(url.searchParams.get('from') ?? 0), Math.min(Number(url.searchParams.get('limit') ?? 100), 500)));
      if (req.method === 'GET' && path.startsWith('/submissions/')) {
        const s = getSubmission(inboxPath, path.slice('/submissions/'.length));
        return s ? send(res, 200, { id: s.id, status: s.status, ballotHash: s.ballotHash, reason: s.decision?.reason ?? null, convenedBallotHash: s.convenedBallotHash ?? null }) : send(res, 404, { error: 'not found' });
      }

      // submit (anti-spam token + rate)
      if (req.method === 'POST' && path === '/submit') {
        if (!bearer(req) || !tokenEq(bearer(req)!, cfg.submitToken)) return send(res, 401, { error: 'unauthorized' });
        if (!allowed(`submit:${ip}`)) return send(res, 429, { error: 'rate limited' });
        const raw = await readBody(req);
        if (raw === null) return send(res, 413, { error: 'body too large' });
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
        const question = String(parsed.question ?? ''), context = String(parsed.context ?? '');
        if (question.length > cfg.limits.maxQuestionLen || context.length > cfg.limits.maxContextLen) return send(res, 413, { error: 'field too long' });
        const bh = ballotHash(question, context);
        const sig = screen({ question, context, ballotHash: bh }, corpus(), { minLen: 8, maxLen: cfg.limits.maxQuestionLen, nearDupThreshold: cfg.limits.nearDupThreshold }, !allowed(`subwin:${ip}`));
        const s = submit(inboxPath, { question, context, ballotHash: bh, screening: sig }, cfg.limits.inboxMaxBytes);
        return send(res, 200, { id: s.id, ballotHash: bh });
      }

      // admin
      const isAdmin = bearer(req) && tokenEq(bearer(req)!, cfg.adminToken);
      if (path === '/inbox' || path.startsWith('/inbox/') || path === '/admin/publish') {
        if (!isAdmin) return send(res, 401, { error: 'unauthorized' });
      }
      if (req.method === 'GET' && path === '/inbox') return send(res, 200, { submissions: listInbox(inboxPath, (url.searchParams.get('status') as any) || undefined) });
      if (req.method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/decision')) {
        const id = path.slice('/inbox/'.length, -('/decision'.length));
        const raw = await readBody(req); if (raw === null) return send(res, 413, { error: 'body too large' });
        const { decision, reason } = JSON.parse(raw);
        const s = decide(inboxPath, id, decision, reason);
        audit(auditPath, 'DECISION', { id, decision, reason: reason ?? null });
        return send(res, 200, { id: s.id, status: s.status });
      }
      if (req.method === 'POST' && path === '/admin/publish') {
        const raw = await readBody(req); if (raw === null) return send(res, 413, { error: 'body too large' });
        const snap = JSON.parse(raw) as Snapshot;
        const lp = materialize(snap.votesLog, 'votes.log')!;
        const staged = readLog(lp);
        const cur = ref ? readLog(materialize(readReleaseFile(data, ref, 'votes.log'), 'votes.log')!) : [];
        const r = verifyPublish({ staged, current: cur, checkpoint: readCheckpoint(data), keyring: cfg.pinnedKeyring, chainId: cfg.chainId, quorum: cfg.quorum });
        audit(auditPath, 'PUBLISH', { ok: r.ok, reason: r.reason ?? null, headHash: r.headHash, length: r.length });
        if (!r.ok) return send(res, 409, { error: r.reason });
        stageRelease(data, r.headHash, snap);
        commitRelease(data, r.headHash, { chainId: cfg.chainId, valid: true, length: r.length, headHash: r.headHash, verifiedAt: new Date().toISOString() });
        writeCheckpoint(data, { chainId: cfg.chainId, length: r.length, headHash: r.headHash, publishedAt: new Date().toISOString() });
        return send(res, 200, { headHash: r.headHash, length: r.length });
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return send(res, 500, { error: (e as Error).message });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxConnections = 256;

  const reply = (res: ServerResponse, out: { status: number; body: any }) => send(res, out.status, out.body);

  let bound = 0;
  return {
    listen: () => new Promise<void>((resolve) => server.listen(cfg.port, '0.0.0.0', () => { bound = (server.address() as any).port; resolve(); })),
    close: () => server.close(),
    port: () => bound,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/node-server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/node-server.ts code/test/node-server.test.ts
git commit -m "feat(node): http transport — auth, body cap, rate limit, routing, publish gate (§7/§11)"
```

---

## Task 10: `run-node.ts` — entrypoint + boot-verify + degraded mode + restart durability

**Files:**
- Create: `code/src/run-node.ts`
- Create: `code/src/boot.ts` (the pure boot-verify, so it is testable without a process)
- Test: `code/test/node-restart.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { bootVerify } from '../src/boot.ts';

const k = generateValidatorKey();
const keyring = { V1: k.publicKeyPem };

function bootedData() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-boot-'));
  const lp = join(mkdtempSync(join(tmpdir(), 'qrm-bl-')), 'votes.log');
  appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  return { data, log: readFileSync(lp, 'utf8') };
}

test('bootVerify returns live for a valid current + matching checkpoint chainId', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h', publishedAt: 't' });
  assert.equal(bootVerify(data, 'c').mode, 'live');
});

test('bootVerify returns degraded for a checkpoint chainId mismatch (wrong-chain volume)', () => {
  const { data, log } = bootedData();
  stageRelease(data, 'h', { votesLog: log, ballots: '' });
  commitRelease(data, 'h', { chainId: 'c', valid: true, length: 1, headHash: 'h', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'WRONG', length: 1, headHash: 'h', publishedAt: 't' });
  assert.equal(bootVerify(data, 'c').mode, 'degraded');
});

test('bootVerify is live with no chain yet (nothing published) but not chainValid', () => {
  const { data } = bootedData();
  const b = bootVerify(data, 'c');
  assert.equal(b.mode, 'live');
  assert.equal(b.chainValid, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/node-restart.test.ts`
Expected: FAIL — `boot.ts` does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/boot.ts`:

```ts
// Quorumchain ($QRM) — boot verification (spec NI-D7). On start, verify the active release's
// chain and that the checkpoint's chainId matches this node's pinned chainId (wrong-chain
// volume detection). On any failure → degraded mode (writes refused). Zero dependencies.

import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readLog, verifyEntries } from './vote-log.ts';
import { currentRelease, readCheckpoint, readReleaseFile } from './release-store.ts';

export interface BootState { mode: 'live' | 'degraded'; chainValid: boolean; reason?: string }

export function bootVerify(data: string, expectedChainId: string): BootState {
  const cp = readCheckpoint(data);
  if (cp && cp.chainId !== expectedChainId) return { mode: 'degraded', chainValid: false, reason: 'checkpoint chainId mismatch' };
  const ref = currentRelease(data);
  if (!ref) return { mode: 'live', chainValid: false }; // nothing published yet — accepts a first publish
  const content = readReleaseFile(data, ref, 'votes.log');
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-bv-')), 'votes.log');
  writeFileSync(p, content ?? '');
  const v = verifyEntries(readLog(p));
  if (!v.valid) return { mode: 'degraded', chainValid: false, reason: `chain broken at ${v.brokenAt}` };
  if (cp && ref.headHash !== cp.headHash) return { mode: 'degraded', chainValid: false, reason: 'current head != checkpoint head' };
  return { mode: 'live', chainValid: true };
}
```

Create `code/src/run-node.ts`:

```ts
// Quorumchain ($QRM) — deployable node entrypoint. Loads pinned keyring + env config,
// boot-verifies (degraded mode on failure), and serves. The node holds NO validator keys.
//   QRM_NODE_DATA=/data QRM_SUBMIT_TOKEN=… QRM_ADMIN_TOKEN=… node src/run-node.ts

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './node-config.ts';
import { bootVerify } from './boot.ts';
import { createNode } from './node-server.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const keyringPath = process.env.QRM_KEYRING ?? join(HERE, '..', 'pinned-keyring.json');
const keyring = JSON.parse(readFileSync(keyringPath, 'utf8')) as Record<string, string>;
const cfg = loadConfig(process.env, keyring);

let state = bootVerify(cfg.dataDir, cfg.chainId);
console.error(`[run-node] boot: mode=${state.mode} chainValid=${state.chainValid}${state.reason ? ` reason=${state.reason}` : ''} chainId=${cfg.chainId.slice(0, 12)}`);

const node = createNode(cfg, () => state.mode);
node.listen().then(() => console.error(`[run-node] listening on :${node.port()} dataDir=${cfg.dataDir}`));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/node-restart.test.ts`
Expected: PASS. Then run the full suite: `node --test` — all green.

- [ ] **Step 5: Commit**

```bash
git add code/src/boot.ts code/src/run-node.ts code/test/node-restart.test.ts
git commit -m "feat(node): entrypoint + boot-verify + degraded mode + restart durability (NI-D7)"
```

---

## Task 11: Operator CLIs — `node-client.ts`, `review-inbox.ts`, `publish-node.ts`

**Files:**
- Create: `code/src/node-client.ts`
- Create: `code/src/review-inbox.ts`
- Create: `code/src/publish-node.ts`
- Test: `code/test/node-client.test.ts`

- [ ] **Step 1: Write the failing test** (drive the real server through the client)

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { createNode } from '../src/node-server.ts';
import { renderSubmission, packageSnapshot } from '../src/node-client.ts';

const k = generateValidatorKey();
const keyring = { V1: k.publicKeyPem };

test('renderSubmission escapes submission text as inert (no raw control/markup execution path)', () => {
  const line = renderSubmission({ id: 'abc', status: 'PENDING_REVIEW', ballotHash: 'h', raw: { question: 'hi `rm -rf` <b>x</b>', context: 'c' }, screening: { wellFormed: true, lengthOk: true, tokenCount: 3, exactDuplicate: false, nearestHash: null, similarity: 0, rateFlagged: false } } as any);
  assert.doesNotMatch(line, /<b>/); // angle brackets neutralized
  assert.match(line, /abc/);
});

test('packageSnapshot reads local votes.log + ballots.jsonl into a Snapshot', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-pkg-'));
  const lp = join(dir, 'votes.log'); appendVote(lp, signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  require('node:fs').writeFileSync(join(dir, 'ballots.jsonl'), '');
  const snap = packageSnapshot(dir);
  assert.equal(snap.votesLog, readFileSync(lp, 'utf8'));
  assert.equal(typeof snap.ballots, 'string');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd code && node --test test/node-client.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement minimal code**

Create `code/src/node-client.ts`:

```ts
// Quorumchain ($QRM) — operator-side helpers for the node CLIs. Uses global fetch (Node 22).
// renderSubmission ALWAYS neutralizes submission text (treated as hostile input, §11).
// packageSnapshot bundles the local authoritative chain for /admin/publish. Zero deps.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from './release-store.ts';

export function inert(s: string): string {
  return s.replace(/[ -]/g, ' ').replace(/[<>`]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '`': "'" }[c]!)).slice(0, 4000);
}
export function renderSubmission(s: { id: string; status: string; ballotHash: string; raw: { question: string; context: string }; screening: any }): string {
  const f = s.screening;
  return [
    `[${s.status}] ${s.id}  (ballot ${s.ballotHash.slice(0, 12)})`,
    `  Q: ${inert(s.raw.question)}`,
    `  C: ${inert(s.raw.context)}`,
    `  signals: wellFormed=${f.wellFormed} exactDup=${f.exactDuplicate} nearDup=${f.similarity.toFixed(2)}${f.nearestHash ? `→${f.nearestHash.slice(0, 8)}` : ''} rate=${f.rateFlagged}`,
  ].join('\n');
}
export function packageSnapshot(localDataDir: string): Snapshot {
  const v = join(localDataDir, 'votes.log'), b = join(localDataDir, 'ballots.jsonl');
  const commonsDir = join(localDataDir, '..', 'docs', 'commons');
  const commons: Record<string, string> = {};
  // commons pages are shipped from the operator's published commons dir if present
  if (existsSync(join(commonsDir, 'INDEX.md'))) {
    for (const f of require('node:fs').readdirSync(commonsDir)) if (f.endsWith('.md')) commons[f === 'INDEX.md' ? 'INDEX.md' : f] = readFileSync(join(commonsDir, f), 'utf8');
  }
  return { votesLog: existsSync(v) ? readFileSync(v, 'utf8') : '', ballots: existsSync(b) ? readFileSync(b, 'utf8') : '', commons };
}
export async function api(base: string, path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<any> {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
```

Create `code/src/review-inbox.ts`:

```ts
// Quorumchain ($QRM) — operator CLI: screen the public node's inbox. Runs on the OPERATOR's
// machine, not the node. Usage:
//   QRM_NODE_BASE=https://node QRM_ADMIN_TOKEN=… node src/review-inbox.ts list [status]
//   … node src/review-inbox.ts accept <id>
//   … node src/review-inbox.ts reject <id> "<reason>"

import { api, renderSubmission } from './node-client.ts';

const base = process.env.QRM_NODE_BASE!;
const token = process.env.QRM_ADMIN_TOKEN!;
const [cmd, id, reason] = process.argv.slice(2);

const run = async () => {
  if (cmd === 'list') {
    const r = await api(base, `/inbox${id ? `?status=${id}` : ''}`, { token });
    for (const s of r.body.submissions ?? []) console.log(renderSubmission(s) + '\n');
  } else if (cmd === 'accept' || cmd === 'reject') {
    const r = await api(base, `/inbox/${id}/decision`, { method: 'POST', token, body: { decision: cmd === 'accept' ? 'ACCEPT' : 'REJECT', reason } });
    console.log(r.status, JSON.stringify(r.body));
  } else {
    console.error('usage: review-inbox list [status] | accept <id> | reject <id> "<reason>"');
    process.exit(1);
  }
};
run();
```

Create `code/src/publish-node.ts`:

```ts
// Quorumchain ($QRM) — operator CLI: publish the local authoritative chain to the node.
// Runs on the OPERATOR's machine. Usage:
//   QRM_NODE_BASE=https://node QRM_ADMIN_TOKEN=… node src/publish-node.ts [localDataDir]

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, packageSnapshot } from './node-client.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.env.QRM_NODE_BASE!;
const token = process.env.QRM_ADMIN_TOKEN!;
const localData = process.argv[2] ?? join(HERE, '..', 'data');

const run = async () => {
  const snap = packageSnapshot(localData);
  const r = await api(base, '/admin/publish', { method: 'POST', token, body: snap });
  console.log(r.status, JSON.stringify(r.body));
  if (r.status !== 200) process.exit(1);
};
run();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd code && node --test test/node-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/node-client.ts code/src/review-inbox.ts code/src/publish-node.ts code/test/node-client.test.ts
git commit -m "feat(node): operator CLIs — inert review-inbox + publish-node (§11/§12)"
```

---

## Task 12: Packaging — Dockerfile, compose (TLS), and deploy doc

**Files:**
- Create: `code/Dockerfile`
- Create: `code/docker-compose.yml`
- Create: `docs/DEPLOY-NODE.md`

- [ ] **Step 1: Write the Dockerfile**

`code/Dockerfile`:

```dockerfile
# Quorumchain deployable node — zero runtime deps, runs the TS entrypoint via Node type-stripping.
FROM node:22-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY pinned-keyring.json ./pinned-keyring.json
ENV QRM_NODE_DATA=/data QRM_NODE_PORT=8787
VOLUME /data
EXPOSE 8787
# tokens are injected at runtime (never baked in): QRM_SUBMIT_TOKEN / QRM_ADMIN_TOKEN
CMD ["node", "src/run-node.ts"]
```

- [ ] **Step 2: Write compose with a TLS reverse proxy**

`code/docker-compose.yml`:

```yaml
services:
  node:
    build: .
    environment:
      QRM_NODE_DATA: /data
      QRM_SUBMIT_TOKEN: ${QRM_SUBMIT_TOKEN}
      QRM_ADMIN_TOKEN: ${QRM_ADMIN_TOKEN}
    volumes:
      - qrm-data:/data
    expose:
      - "8787"
    restart: unless-stopped
  proxy:
    image: caddy:2
    depends_on: [node]
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy-data:/data
    restart: unless-stopped
volumes:
  qrm-data:
  caddy-data:
```

And `code/Caddyfile`:

```
{$QRM_NODE_DOMAIN} {
	reverse_proxy node:8787
}
```

- [ ] **Step 3: Write the deploy doc**

`docs/DEPLOY-NODE.md` — must cover: (1) generate strong `QRM_SUBMIT_TOKEN`/`QRM_ADMIN_TOKEN` (`openssl rand -hex 32`), pass via an env file never committed; (2) `QRM_NODE_DOMAIN` for Caddy TLS; (3) first boot serves no chain until the operator runs `publish-node`; (4) operator loop: `review-inbox list` → `accept`/`reject` → convene locally (`run-panel`) → `publish-node`; (5) `/data` is the only stateful thing — back it up (inbox + checkpoint especially); (6) tokens are anti-spam/admin, not user identity. Include the exact commands.

- [ ] **Step 4: Verify the container builds and boots**

Run:
```bash
cd code && docker build -t qrm-node . \
  && docker run --rm -e QRM_SUBMIT_TOKEN=s -e QRM_ADMIN_TOKEN=a -e QRM_NODE_DATA=/data -p 8787:8787 -d --name qrm-test qrm-node \
  && sleep 2 && curl -s localhost:8787/healthz && docker rm -f qrm-test
```
Expected: `{"ok":...,"mode":"live","chainValid":false,...}` (no chain published yet), and the container logs show `boot: mode=live`.

- [ ] **Step 5: Commit**

```bash
git add code/Dockerfile code/docker-compose.yml code/Caddyfile docs/DEPLOY-NODE.md
git commit -m "feat(node): Docker packaging + Caddy TLS compose + deploy doc (§15)"
```

---

## Task 13: Full-suite green + the spec/plan commit

**Files:** (no new code)

- [ ] **Step 1: Run the entire suite**

Run: `cd code && node --test`
Expected: all tests pass (prior 301 + the new node tests).

- [ ] **Step 2: Private-key safety scan on everything new**

Run: `cd /Users/Andrew/ai-blockchain && grep -rlE "PRIVATE KEY|BEGIN .*PRIVATE" code/src/node-*.ts code/src/release-store.ts code/src/publish-verify.ts code/src/inbox.ts code/src/screening.ts code/src/audit-log.ts code/src/boot.ts code/src/run-node.ts code/src/review-inbox.ts code/src/publish-node.ts && echo "!! KEY FOUND !!" || echo "clean"`
Expected: `clean`.

- [ ] **Step 3: Commit the design spec + this plan**

```bash
git add docs/superpowers/specs/2026-06-05-deployable-node-design.md docs/superpowers/plans/2026-06-05-deployable-node.md
git commit -m "docs(node): deployable-node design spec + implementation plan"
```

---

## Self-Review (completed against the spec)

**Spec coverage:** §3 architecture → Tasks 9/10/11; §4 NI-D1/D2 → Task 2 (chainId) + Task 4 (pinned-key verify); NI-D3 → Task 4 (refined: pinned-key signatures + chain links, noted at top); NI-D4/D5 → Task 4; NI-D6 → Task 3; NI-D7 → Task 10; NI-D8 (schema versions) → records in Tasks 5/7; NI-D9 (inbox cap) → Task 5; NI-D10 (DoS caps) → Task 9; §7 endpoints → Tasks 8/9; §8 publish protocol → Task 9 `/admin/publish` + Task 4 gate; §9 lifecycle → Task 5; §10 screening → Task 6; §11 hardening (path safety/inert/audit/TLS) → Tasks 8/11/7/12; §12 workflow → Task 11; §13 tests → every task; §15 deploy → Task 12.

**Deferred (per spec §16, intentionally not tasked):** tombstone archival beyond the byte-cap, full multi-factor screening scores, distributed validators. Server-side commons rendering is not built — the operator ships rendered commons in the snapshot (spec §17 default), consumed by `packageSnapshot` (Task 11).

**Type consistency:** `Signals` defined in `inbox.ts` (Task 5), imported by `screening.ts` (Task 6) and `node-server.ts` (Task 9). `Snapshot`/`Checkpoint`/`VerifyResult`/`ReleaseRef` defined in `release-store.ts` (Task 3), used by Tasks 4/9/10/11. `NodeConfig`/`NodeLimits` from `node-config.ts` (Task 2) used by Task 9. `verifyEntries`/`GENESIS` from Task 1 used by Tasks 4/8/10. CLI helpers (`api`/`renderSubmission`/`packageSnapshot`) from `node-client.ts` (Task 11) used by both CLIs.

**Known test-helper caveat:** Task 4's test must build the `staged` chain as a true extension of `current` (append to the same file), because `appendVote` re-chains from GENESIS — called out inline in the task so the implementer doesn't write two independently-chained files and get false prefix mismatches.
