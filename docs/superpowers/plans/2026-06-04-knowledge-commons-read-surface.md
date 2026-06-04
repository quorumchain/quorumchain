# Knowledge Commons Read Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build CIP-9's read surface — a canonical `ClaimView` projected from the signed log + a self-verifying ballot registry, rendered into browsable markdown pages — so the Knowledge Commons can be read by agents and humans without ever decreeing a single truth.

**Architecture:** Feed-pattern projection (mirrors `feed.ts`/`publish-feed.ts`): recompute everything from the signed log, trust nothing stored. A new `ballot-registry.ts` supplies human-readable statements, accepted only when they hash-verify to the ballot. `commons-read.ts` (pure) assembles `ClaimView` from `commons.ts`'s claim graph + the verified statement; `commons-render.ts` (pure) projects it to markdown; `publish-commons.ts` is the CLI.

**Tech Stack:** Zero-dependency native TypeScript, Node 22 `node --test`, `node:crypto`/`node:fs`. Run from `/Users/Andrew/ai-blockchain/code`.

**Spec:** `docs/superpowers/specs/2026-06-04-knowledge-commons-read-surface-design.md` (panel-ratified round 58, ADOPT 2/3). The implemented surface returns to the panel for SOUND/REVISE review.

---

## File structure

| File | Responsibility |
|---|---|
| `code/src/ballot-registry.ts` (new) | record + hash-verify `{ballotHash, prompt, context}`; resolve a verified statement |
| `code/src/panel.ts` (modify) | `convene` appends a registry entry per ballot when `registryPath` is set |
| `code/src/commons-read.ts` (new) | `ClaimView`/`StanceView` types + pure `viewClaim` / `buildViews` |
| `code/src/commons-render.ts` (new) | pure `renderClaimMarkdown` / `renderIndexMarkdown` |
| `code/src/publish-commons.ts` (new) | CLI: recompute from live log + registry, write `docs/commons/*.md` |
| `code/test/ballot-registry.test.ts` (new) | registry verify/load/append/statement |
| `code/test/commons-read.test.ts` (new) | ClaimView assembly |
| `code/test/commons-render.test.ts` (new) | render guardrails (golden-file) |
| `code/test/panel.test.ts` (modify) | convene writes a verifiable registry entry |

All commands run from `/Users/Andrew/ai-blockchain/code`.

---

### Task 1: Ballot registry — entry type + self-verification

**Files:**
- Create: `code/src/ballot-registry.ts`
- Test: `code/test/ballot-registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballotHash } from '../src/signed-vote.ts';
import { verifyEntry, type BallotRegistryEntry } from '../src/ballot-registry.ts';

test('verifyEntry: an entry whose prompt+context re-hash to its ballotHash verifies', () => {
  const prompt = 'Did the agent breach its bond?';
  const context = 'evidence';
  const entry: BallotRegistryEntry = { ballotHash: ballotHash(prompt, context), prompt, context };
  assert.equal(verifyEntry(entry), true);
});

test('verifyEntry: a tampered statement fails (the hash no longer matches)', () => {
  const prompt = 'Did the agent breach its bond?';
  const context = 'evidence';
  const entry: BallotRegistryEntry = { ballotHash: ballotHash(prompt, context), prompt: 'a different question', context };
  assert.equal(verifyEntry(entry), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ballot-registry.test.ts`
Expected: FAIL — `Cannot find module '../src/ballot-registry.ts'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// code/src/ballot-registry.ts
// Quorumchain ($QRM) — CIP-9 read-surface ballot registry (round-58 planning discovery).
// The signed log stores only ballotHash = sha256(prompt,context), never the prompt, so a
// human-readable statement cannot be recovered from the log. This records {ballotHash, prompt,
// context} and accepts a statement ONLY if it hash-verifies to the ballotHash — the same
// recompute-trust-nothing discipline as the rest of the system, so a forged statement is rejected.
// Zero dependencies.

import { ballotHash } from './signed-vote.ts';

export interface BallotRegistryEntry {
  ballotHash: string;
  prompt: string;
  context: string;
}

/** True iff the entry's prompt+context actually hash to its ballotHash. */
export function verifyEntry(entry: BallotRegistryEntry): boolean {
  return ballotHash(entry.prompt, entry.context) === entry.ballotHash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ballot-registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/ballot-registry.ts code/test/ballot-registry.test.ts
git commit -m "feat(commons): ballot registry entry + self-verification (round-58)"
```

---

### Task 2: Ballot registry — load, append (dedup), resolve statement

**Files:**
- Modify: `code/src/ballot-registry.ts`
- Test: `code/test/ballot-registry.test.ts`

- [ ] **Step 1: Write the failing test** (append to the existing file)

```typescript
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRegistry, appendBallot, statementFor } from '../src/ballot-registry.ts';

function tmpRegistry(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-reg-')), 'ballots.jsonl');
}

test('appendBallot then loadRegistry round-trips a verifiable entry', () => {
  const path = tmpRegistry();
  appendBallot(path, 'Q1', 'C1');
  const reg = loadRegistry(path);
  assert.equal(reg.length, 1);
  assert.equal(reg[0].prompt, 'Q1');
  assert.equal(verifyEntry(reg[0]), true);
});

test('appendBallot dedups by ballotHash (same prompt+context appended once)', () => {
  const path = tmpRegistry();
  appendBallot(path, 'Q1', 'C1');
  appendBallot(path, 'Q1', 'C1');
  assert.equal(loadRegistry(path).length, 1);
});

test('loadRegistry on a missing file is empty (no throw)', () => {
  assert.deepEqual(loadRegistry(tmpRegistry()), []);
});

test('statementFor returns the prompt only for a verified entry, else null', () => {
  const path = tmpRegistry();
  appendBallot(path, 'What happened?', 'ctx');
  const reg = loadRegistry(path);
  const bh = reg[0].ballotHash;
  assert.equal(statementFor(reg, bh), 'What happened?');
  assert.equal(statementFor(reg, 'unknown-hash'), null);
  // a tampered registry entry is not honored
  const tampered = [{ ballotHash: bh, prompt: 'forged', context: 'ctx' }];
  assert.equal(statementFor(tampered, bh), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ballot-registry.test.ts`
Expected: FAIL — `loadRegistry`/`appendBallot`/`statementFor` are not exported.

- [ ] **Step 3: Write minimal implementation** (append to `ballot-registry.ts`)

```typescript
import { existsSync, readFileSync, appendFileSync } from 'node:fs';

/** Read the JSONL registry; a missing file is an empty registry. Malformed lines are skipped. */
export function loadRegistry(path: string): BallotRegistryEntry[] {
  if (!existsSync(path)) return [];
  const out: BallotRegistryEntry[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as BallotRegistryEntry);
    } catch {
      continue;
    }
  }
  return out;
}

/** Append one ballot's statement, computing its ballotHash. Idempotent: a ballotHash already
 *  present is not appended again. */
export function appendBallot(path: string, prompt: string, context: string): void {
  const bh = ballotHash(prompt, context);
  if (loadRegistry(path).some((e) => e.ballotHash === bh)) return;
  appendFileSync(path, JSON.stringify({ ballotHash: bh, prompt, context }) + '\n');
}

/** The human-readable statement for a ballotHash — the registered prompt, but ONLY if the entry
 *  hash-verifies. A missing or tampered entry yields null (never a fabricated title). */
export function statementFor(registry: BallotRegistryEntry[], ballotHashHex: string): string | null {
  const entry = registry.find((e) => e.ballotHash === ballotHashHex);
  if (!entry || !verifyEntry(entry)) return null;
  return entry.prompt;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ballot-registry.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/ballot-registry.ts code/test/ballot-registry.test.ts
git commit -m "feat(commons): registry load/append(dedup)/statementFor"
```

---

### Task 3: `convene` records each ballot to the registry (opt-in)

**Files:**
- Modify: `code/src/panel.ts` (the `convene` function — add `registryPath?` param + append)
- Test: `code/test/panel.test.ts`

- [ ] **Step 1: Write the failing test** (append to `panel.test.ts`; it already imports `convene`, `tmpLog`, `fakePanel`)

```typescript
import { loadRegistry, statementFor } from '../src/ballot-registry.ts';
import { ballotHash as bhash } from '../src/signed-vote.ts';
import { mkdtempSync as mkdtmp } from 'node:fs';
import { tmpdir as tdir } from 'node:os';
import { join as pjoin } from 'node:path';

test('convene records the ballot to the registry when registryPath is set (verifiable statement)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' });
  const registryPath = pjoin(mkdtmp(pjoin(tdir(), 'qrm-cv-')), 'ballots.jsonl');
  await convene({ prompt: 'Did X occur?', context: 'evidence', signers, keyring, quorum: 2, logPath: tmpLog(), registryPath });
  const reg = loadRegistry(registryPath);
  const bh = bhash('Did X occur?', 'evidence');
  assert.equal(statementFor(reg, bh), 'Did X occur?'); // recoverable AND hash-verified
});

test('convene without registryPath writes no registry (back-compatible)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES' });
  // no throw, no registry required
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.votes.length, 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/panel.test.ts`
Expected: FAIL — `convene` does not accept `registryPath` / writes nothing.

- [ ] **Step 3: Write minimal implementation**

In `code/src/panel.ts`, add the import at the top (after the existing imports):

```typescript
import { appendBallot } from './ballot-registry.ts';
```

Add `registryPath?: string;` to the `convene` params type (the object after `verdicts?: string[];`). Then, immediately after the line `const bh = ballotHash(params.prompt, params.context);`, add:

```typescript
  // Record the human-readable statement for the read surface (round-58). The registry is
  // self-verifying (statement must re-hash to bh), so this persists provenance, not trust.
  if (params.registryPath) appendBallot(params.registryPath, params.prompt, params.context);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/panel.test.ts`
Expected: PASS (all existing panel tests + 2 new).

- [ ] **Step 5: Commit**

```bash
git add code/src/panel.ts code/test/panel.test.ts
git commit -m "feat(commons): convene records each ballot statement to the registry"
```

---

### Task 4: `commons-read.ts` — `ClaimView` types + pure `viewClaim`

**Files:**
- Create: `code/src/commons-read.ts`
- Test: `code/test/commons-read.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ballotHash } from '../src/signed-vote.ts';
import type { Claim } from '../src/commons.ts';
import { viewClaim } from '../src/commons-read.ts';

const bh = ballotHash('Did X occur?', 'evidence');
const resolvedClaim: Claim = {
  ballotHash: bh,
  status: 'RESOLVED',
  verdict: 'YES',
  stances: [
    { position: 'YES', validators: ['V1', 'V2'], panelVotes: 2, standing: 'CONSENSUS' },
    { position: 'NO', validators: ['V3'], panelVotes: 1, standing: 'CREDIBLE_MINORITY' },
  ],
  panelStateReceipt: { validators: ['V1', 'V2', 'V3'], size: 3 },
};

test('viewClaim maps a RESOLVED 2/1 claim, preserving the dissent as a named CREDIBLE_MINORITY', () => {
  const reg = [{ ballotHash: bh, prompt: 'Did X occur?', context: 'evidence' }];
  const v = viewClaim(resolvedClaim, reg, true);
  assert.equal(v.ballotHash, bh);
  assert.equal(v.statement, 'Did X occur?'); // hash-verified statement
  assert.equal(v.status, 'RESOLVED');
  assert.equal(v.chainValid, true);
  assert.deepEqual(v.stances.map((s) => [s.position, s.standing]), [['YES', 'CONSENSUS'], ['NO', 'CREDIBLE_MINORITY']]);
  assert.equal(v.stances[0].support, null); // NI-9b: never 0, no external anchor in v0.1
  assert.deepEqual(v.panelState.validators, ['V1', 'V2', 'V3']);
});

test('viewClaim statement is null when the registry has no (or a tampered) entry', () => {
  assert.equal(viewClaim(resolvedClaim, [], true).statement, null);
  const tampered = [{ ballotHash: bh, prompt: 'forged', context: 'evidence' }];
  assert.equal(viewClaim(resolvedClaim, tampered, true).statement, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commons-read.test.ts`
Expected: FAIL — `Cannot find module '../src/commons-read.ts'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// code/src/commons-read.ts
// Quorumchain ($QRM) — CIP-9 read surface, the one canonical core (round 58, ADOPT 2/3).
// A pure projection of commons.ts's claim graph into a ClaimView: the full epistemic state of a
// claim (stance set with computed standing, the NI-9a panel-state receipt, the verified statement,
// chain validity). The agent-facing read is this object; the human page is its markdown projection.
// support is null in v0.1 (NI-9b: no external anchors in the convening log — never 0). No edit key:
// every field is derived, nothing is assigned. Zero dependencies.

import type { Claim, ClaimStatus, Standing, PanelStateReceipt } from './commons.ts';
import { buildClaimIndex } from './commons.ts';
import { statementFor, type BallotRegistryEntry } from './ballot-registry.ts';
import type { SignedVote } from './signed-vote.ts';

export interface StanceView {
  position: string;
  standing: Standing; // CONSENSUS | CREDIBLE_MINORITY | UNRANKED — computed by commons.ts, never assigned
  validators: string[]; // who held it (provenance, never flattened)
  panelVotes: number; // panel distribution, NOT reputation/popularity
  support: number | null; // null = not externally anchored (NI-9b) — null in v0.1, never 0
}

export interface ClaimView {
  ballotHash: string;
  statement: string | null; // verified registry statement, else null (never fabricated)
  status: ClaimStatus; // RESOLVED | CONTESTED | INDETERMINATE
  stances: StanceView[];
  panelState: PanelStateReceipt; // NI-9a receipt
  chainValid: boolean;
}

/** Project one commons.ts Claim into a ClaimView. Pure: statement comes from the verified registry,
 *  chainValid is supplied by the caller (it recomputed verifyLog), everything else from the Claim. */
export function viewClaim(claim: Claim, registry: BallotRegistryEntry[], chainValid: boolean): ClaimView {
  return {
    ballotHash: claim.ballotHash,
    statement: statementFor(registry, claim.ballotHash),
    status: claim.status,
    stances: claim.stances.map((s) => ({
      position: s.position,
      standing: s.standing,
      validators: s.validators,
      panelVotes: s.panelVotes,
      support: null, // v0.1: no external anchor → null (NI-9b), never 0
    })),
    panelState: claim.panelStateReceipt,
    chainValid,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commons-read.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/commons-read.ts code/test/commons-read.test.ts
git commit -m "feat(commons): ClaimView + pure viewClaim projection"
```

---

### Task 5: `commons-read.ts` — `buildViews` over a vote set

**Files:**
- Modify: `code/src/commons-read.ts`
- Test: `code/test/commons-read.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```typescript
import { generateValidatorKey, signVote } from '../src/signed-vote.ts';
import { buildViews } from '../src/commons-read.ts';

test('buildViews produces one ClaimView per ballot, chainValid threaded through', () => {
  const k1 = generateValidatorKey(), k2 = generateValidatorKey(), k3 = generateValidatorKey();
  const keyring = { V1: k1.publicKeyPem, V2: k2.publicKeyPem, V3: k3.publicKeyPem };
  const bhA = ballotHash('Q-A', 'ctx');
  const votes: SignedVote[] = [
    signVote({ validatorId: 'V1', privateKeyPem: k1.privateKeyPem, ballotHash: bhA, verdict: 'YES', rawOutput: 'r' }),
    signVote({ validatorId: 'V2', privateKeyPem: k2.privateKeyPem, ballotHash: bhA, verdict: 'YES', rawOutput: 'r' }),
    signVote({ validatorId: 'V3', privateKeyPem: k3.privateKeyPem, ballotHash: bhA, verdict: 'NO', rawOutput: 'r' }),
  ];
  const reg = [{ ballotHash: bhA, prompt: 'Q-A', context: 'ctx' }];
  const views = buildViews(votes, keyring, 2, reg, true);
  assert.equal(views.length, 1);
  assert.equal(views[0].statement, 'Q-A');
  assert.equal(views[0].status, 'RESOLVED');
  assert.equal(views[0].chainValid, true);
});
```

(Note: `SignedVote` is already imported in this file from Task 4's test? No — add `import type { SignedVote } from '../src/signed-vote.ts';` if not present.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commons-read.test.ts`
Expected: FAIL — `buildViews` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `commons-read.ts`)

```typescript
/** Build a ClaimView for every ballot in a vote set. Pure: caller supplies the loaded votes,
 *  keyring, registry, and the already-recomputed chainValid (from verifyLog). */
export function buildViews(
  votes: SignedVote[],
  keyring: Record<string, string>,
  quorum: number,
  registry: BallotRegistryEntry[],
  chainValid: boolean,
): ClaimView[] {
  return buildClaimIndex(votes, keyring, quorum).map((c) => viewClaim(c, registry, chainValid));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commons-read.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/commons-read.ts code/test/commons-read.test.ts
git commit -m "feat(commons): buildViews — ClaimViews for a whole vote set"
```

---

### Task 6: `commons-render.ts` — `renderClaimMarkdown` (the guardrails)

**Files:**
- Create: `code/src/commons-render.ts`
- Test: `code/test/commons-render.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClaimView } from '../src/commons-read.ts';
import { renderClaimMarkdown } from '../src/commons-render.ts';

const resolved: ClaimView = {
  ballotHash: 'abc123def456',
  statement: 'Did X occur?',
  status: 'RESOLVED',
  stances: [
    { position: 'YES', standing: 'CONSENSUS', validators: ['V1', 'V2'], panelVotes: 2, support: null },
    { position: 'NO', standing: 'CREDIBLE_MINORITY', validators: ['V3'], panelVotes: 1, support: null },
  ],
  panelState: { validators: ['V1', 'V2', 'V3'], size: 3 },
  chainValid: true,
};

test('a RESOLVED page shows BOTH stances at equal structural weight (dissent not omitted/demoted)', () => {
  const md = renderClaimMarkdown(resolved);
  // both stances rendered as identically-structured rows (guardrail 1: equal weight, no footnote)
  assert.match(md, /^- \*\*YES\*\* — CONSENSUS/m);
  assert.match(md, /^- \*\*NO\*\* — CREDIBLE_MINORITY/m);
  assert.ok(md.includes('V3')); // the dissenter is named, not flattened
});

test('support renders as "not externally anchored", never 0 (NI-9b)', () => {
  const md = renderClaimMarkdown(resolved);
  assert.match(md, /not externally anchored/);
  assert.doesNotMatch(md, /support:\s*0\b/);
});

test('the NI-9a panel-state receipt is always present', () => {
  assert.match(renderClaimMarkdown(resolved), /panel-state.*V1.*V2.*V3/is);
});

test('an INDETERMINATE claim renders raw plurality, all UNRANKED, never "FRINGE"', () => {
  const indet: ClaimView = {
    ballotHash: 'h', statement: 'Unknowable?', status: 'INDETERMINATE',
    stances: [
      { position: 'YES', standing: 'UNRANKED', validators: ['V1'], panelVotes: 1, support: null },
      { position: 'NO', standing: 'UNRANKED', validators: ['V2'], panelVotes: 1, support: null },
    ],
    panelState: { validators: ['V1', 'V2'], size: 2 }, chainValid: true,
  };
  const md = renderClaimMarkdown(indet);
  assert.doesNotMatch(md, /FRINGE/);
  assert.match(md, /INDETERMINATE/);
});

test('a statement-less (pre-registry) claim shows the hash + "statement not recorded", never a fake title', () => {
  const md = renderClaimMarkdown({ ...resolved, statement: null });
  assert.match(md, /statement not recorded/);
  assert.match(md, /abc123def456/);
});

test('a tampered log (chainValid false) renders a tamper banner', () => {
  const md = renderClaimMarkdown({ ...resolved, chainValid: false });
  assert.match(md, /❌|tamper|BROKEN/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commons-render.test.ts`
Expected: FAIL — `Cannot find module '../src/commons-render.ts'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// code/src/commons-render.ts
// Quorumchain ($QRM) — CIP-9 read surface, the human projection (round 58 guardrails).
// renderClaimMarkdown projects a ClaimView into a page where the stance SET is the body — every
// stance gets an IDENTICALLY-structured row (no headline/ordering hierarchy favoring the consensus
// stance, no demotion-to-footnote), the NI-9a receipt is always shown, support reads "not externally
// anchored" (never 0), and a missing statement shows the hash, never a fabricated title. Pure strings.

import type { ClaimView, StanceView } from './commons-read.ts';

function renderStance(s: StanceView): string {
  const who = s.validators.join(', ');
  const support = s.support === null ? 'not externally anchored' : String(s.support);
  // identical row structure for EVERY stance — equal structural weight (guardrail 1)
  return `- **${s.position}** — ${s.standing} · held by ${who} · panel votes: ${s.panelVotes} · support: ${support}`;
}

export function renderClaimMarkdown(view: ClaimView): string {
  const title = view.statement ?? `\`${view.ballotHash}\` — _statement not recorded (pre-registry)_`;
  const banner = view.chainValid
    ? '**Chain validity:** ✅ valid — recomputed from the signed log'
    : '**Chain validity:** ❌ BROKEN — log failed verification; this view may be tampered';
  return [
    `# ${title}`,
    '',
    banner,
    '',
    `**Status:** ${view.status}`,
    `**Ballot:** \`${view.ballotHash}\``,
    '',
    '## Stances (the epistemic state — not a single truth)',
    '',
    ...view.stances.map(renderStance),
    '',
    `**Panel-state receipt (NI-9a):** ${view.panelState.size} validators — ${view.panelState.validators.join(', ')}`,
    '',
    '_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._',
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commons-render.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/commons-render.ts code/test/commons-render.test.ts
git commit -m "feat(commons): renderClaimMarkdown with the round-58 presentation guardrails"
```

---

### Task 7: `commons-render.ts` — `renderIndexMarkdown` (no single-truth index)

**Files:**
- Modify: `code/src/commons-render.ts`
- Test: `code/test/commons-render.test.ts`

- [ ] **Step 1: Write the failing test** (append)

```typescript
import { renderIndexMarkdown } from '../src/commons-render.ts';

const contested: ClaimView = {
  ballotHash: 'c0ntested000', statement: 'Disputed?', status: 'CONTESTED',
  stances: [
    { position: 'YES', standing: 'UNRANKED', validators: ['V1'], panelVotes: 1, support: null },
    { position: 'NO', standing: 'UNRANKED', validators: ['V2'], panelVotes: 1, support: null },
  ],
  panelState: { validators: ['V1', 'V2'], size: 2 }, chainValid: true,
};

test('the index shows a CONTESTED claim AS contested, never as a winner-label (guardrail 2)', () => {
  const md = renderIndexMarkdown([resolved, contested]);
  // the contested row must read contested, not surface a single "winning" stance
  assert.match(md, /Disputed\?.*CONTESTED/s);
  // the resolved row may show its resolved verdict
  assert.match(md, /Did X occur\?.*RESOLVED/s);
});

test('the index carries the chain-validity banner', () => {
  assert.match(renderIndexMarkdown([resolved]), /Chain validity/);
  assert.match(renderIndexMarkdown([{ ...resolved, chainValid: false }]), /❌|BROKEN/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commons-render.test.ts`
Expected: FAIL — `renderIndexMarkdown` is not exported.

- [ ] **Step 3: Write minimal implementation** (append to `commons-render.ts`)

```typescript
/** One index row per claim. Per-status (guardrail 2): a non-RESOLVED claim reads as its status, never
 *  as a winner-label; a RESOLVED claim shows its consensus stance AND flags preserved dissent. */
function indexRow(view: ClaimView): string {
  const title = view.statement ?? `\`${view.ballotHash.slice(0, 12)}\``;
  const link = `commons/${view.ballotHash.slice(0, 12)}.md`;
  if (view.status === 'RESOLVED') {
    const consensus = view.stances.find((s) => s.standing === 'CONSENSUS');
    const dissent = view.stances.filter((s) => s.standing === 'CREDIBLE_MINORITY').length;
    const flag = dissent > 0 ? ` (+${dissent} credible dissent)` : '';
    return `| [${title}](${link}) | RESOLVED | ${consensus ? consensus.position : '—'}${flag} |`;
  }
  // CONTESTED / INDETERMINATE: read as the status with the count of stances — no winner-label
  return `| [${title}](${link}) | ${view.status} | ${view.stances.length} stances, no consensus |`;
}

export function renderIndexMarkdown(views: ClaimView[]): string {
  const allValid = views.every((v) => v.chainValid);
  const banner = allValid
    ? '**Chain validity:** ✅ valid — every page recomputed from the signed log'
    : '**Chain validity:** ❌ BROKEN — log failed verification';
  return [
    '# Quorumchain Knowledge Commons',
    '',
    banner,
    '',
    '_The epistemic state of every claim the panel has ruled on — consensus, credible dissent, and the honest unknown. Not a decree of truth._',
    '',
    '| claim | status | reading |',
    '|-------|--------|---------|',
    ...views.map(indexRow),
    '',
  ].join('\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commons-render.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/commons-render.ts code/test/commons-render.test.ts
git commit -m "feat(commons): renderIndexMarkdown — status-aware, no single-truth index"
```

---

### Task 8: `publish-commons.ts` — the CLI

**Files:**
- Create: `code/src/publish-commons.ts`
- Verify: run it against the live log and inspect output (no unit test — thin I/O wiring over tested pure functions, mirroring `publish-feed.ts`)

- [ ] **Step 1: Write the implementation**

```typescript
// code/src/publish-commons.ts
// Quorumchain ($QRM) — CIP-9 read surface CLI. Recomputes every claim from the live signed log +
// pinned keyring + ballot registry and writes browsable pages to docs/commons/. Pure recompute:
// a prior render is never an input; a tampered log surfaces as a banner, never silent content.
// Mirrors publish-feed.ts. Run: node src/publish-commons.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog, verifyLog } from './vote-log.ts';
import { loadRegistry } from './ballot-registry.ts';
import { buildViews } from './commons-read.ts';
import { renderClaimMarkdown, renderIndexMarkdown } from './commons-render.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const LOG = join(DATA, 'votes.log');
const REGISTRY = join(DATA, 'ballots.jsonl');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const OUT = join(HERE, '..', '..', 'docs', 'commons');
const QUORUM = 2;

const keyring = JSON.parse(readFileSync(PINNED, 'utf8')) as Record<string, string>;
const votes = readLog(LOG).map((e) => e.vote);
const chainValid = verifyLog(LOG).valid;
const registry = loadRegistry(REGISTRY);

const views = buildViews(votes, keyring, QUORUM, registry, chainValid);
mkdirSync(OUT, { recursive: true });
for (const v of views) {
  writeFileSync(join(OUT, `${v.ballotHash.slice(0, 12)}.md`), renderClaimMarkdown(v));
}
writeFileSync(join(OUT, 'INDEX.md'), renderIndexMarkdown(views));

console.log(`Wrote ${views.length} claim pages + INDEX.md to docs/commons/ (chain valid: ${chainValid})`);
```

- [ ] **Step 2: Run it against the live log**

Run: `node src/publish-commons.ts`
Expected: prints `Wrote N claim pages + INDEX.md to docs/commons/ (chain valid: true)`.

- [ ] **Step 3: Inspect the output**

Run: `ls docs/commons/ | head` and open `docs/commons/INDEX.md`.
Expected: one `<hash>.md` per ballot + an `INDEX.md`; statements show for any ballots in the registry, hashes for the 165 pre-registry ballots; CONTESTED rows read as contested.

- [ ] **Step 4: Full suite green**

Run: `node --test`
Expected: all tests pass (prior 206 + the new commons tests).

- [ ] **Step 5: Commit**

```bash
git add code/src/publish-commons.ts docs/commons/
git commit -m "feat(commons): publish-commons CLI — render the read surface from the live log"
```

---

## Self-review (against the spec)

**Spec coverage:**
- Ballot registry + self-verification → Tasks 1–2. ✅
- convene records statements → Task 3. ✅
- `ClaimView` core (statement/status/stances/panelState/chainValid; support null) → Tasks 4–5. ✅
- Guardrail 1 (equal structural weight) → Task 6 test. ✅
- Guardrail 2 (index not single-truth) → Task 7 test. ✅
- Guardrail 3 (support null not 0) → Tasks 4 + 6 tests. ✅
- Guardrail 4 (status pure derivation; INDETERMINATE never FRINGE) → Task 6 test. ✅
- Guardrail 5 (NI-9a receipt always) → Task 6 test. ✅
- Guardrail 6 (no edit key / pure projection) → publish recomputes from log (Task 8). ✅
- Data flow + tamper banner → Tasks 6/7 + 8. ✅
- Statement-less claim shows hash → Task 6 test. ✅

**Type consistency:** `ClaimView`/`StanceView` defined in Task 4, consumed unchanged in Tasks 6–8. `Claim`/`Stance`/`Standing`/`ClaimStatus`/`PanelStateReceipt` imported from the real `commons.ts`. `buildViews(votes, keyring, quorum, registry, chainValid)` signature consistent across Task 5 (def) and Task 8 (call). `statementFor(registry, hash)` consistent (Tasks 2, 4). `appendBallot(path, prompt, context)` consistent (Tasks 2, 3).

**Out of scope (not built, per spec §9):** reputation.ts wiring, multi-version history, subjectKey/topic grouping, live query service, v0.3 forking.

**Note:** `data/` is gitignored, so `data/ballots.jsonl` is local; the published `docs/commons/*.md` are committed artifacts. Third-party verification of statements (publishing the registry) is a later step.
