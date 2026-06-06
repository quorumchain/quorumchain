// CIP-16 — Distinct-Question Separator (ratified ballot be0a4006…, round 61, YES 3/3;
// root-disposition Option A by 2/1). Two ballots that share a CIP-13 supersede-root but
// declare distinct `questionId`s are projected as SEPARATE sibling lineages, never merged.
// The separator is an UNHASHED declared meta field in the same class as `supersedes`; it
// only PARTITIONS a group before the existing CIP-13/CIP-15 gates run (NI-16a / NI-16b).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { buildClaimIndex, queryClaim, type BallotMeta } from '../src/commons.ts';
import type { AnchorPolicy } from '../src/anchor.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

// As in commons-cip13.test.ts: these tests isolate GROUPING + head selection, so they stub the
// anchor gate OPEN (requiredFamilies=0 → passes) and set contentConfirmed on the supersede meant
// to promote. The anchor verifier itself is covered by cip15-anchor.test.ts.
const GATE_OPEN: AnchorPolicy = { admissibleTypes: new Set(), issuerKeys: {}, tsaKeys: {}, validatorKeyring: {}, requiredFamiliesFor: () => 0 };

function vote(id: 'V1' | 'V2' | 'V3', bh: string, verdict: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id}:${verdict}` });
}
function unanimous(bh: string, verdict: string): SignedVote[] {
  return [vote('V1', bh, verdict), vote('V2', bh, verdict), vote('V3', bh, verdict)];
}

// ---- Test 1 — sibling split reproduces the #38 case (FAILS pre-change) ----
test('CIP-16/NI-16a: two distinct-questionId ballots sharing a root are SEPARATE lineages', () => {
  const ROOT = ballotHash('original conflated convening', '#38');
  const FACTUAL = ballotHash('was X involved (factual)', 'restatement');
  const PROCEDURAL = ballotHash('was the override legitimate (procedural)', 'restatement');
  const votes = [...unanimous(ROOT, 'INDETERMINATE'), ...unanimous(FACTUAL, 'NO'), ...unanimous(PROCEDURAL, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [ROOT]: { epistemicType: 'NORMATIVE' },
    [FACTUAL]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: '38-factual' },
    [PROCEDURAL]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: '38-procedural' },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  const f = queryClaim(idx, FACTUAL)!;
  const p = queryClaim(idx, PROCEDURAL)!;
  // distinct lineages: neither is the other's prior version, neither shares a head
  assert.ok(!f.lineage.priorVersions.some((v) => v.ballotHash === PROCEDURAL), 'procedural is NOT a prior of factual');
  assert.ok(!p.lineage.priorVersions.some((v) => v.ballotHash === FACTUAL), 'factual is NOT a prior of procedural');
  assert.notEqual(f.lineage.current, p.lineage.current, 'the two questions have distinct heads');
});

// ---- Test 2 — backward-compat: no questionId projects exactly as today ----
test('CIP-16: ballots with no questionId group exactly as pre-change (back-compat)', () => {
  const B1 = ballotHash('Is X still true', 'v1');
  const B2 = ballotHash('Is X still true', 'v2 newer');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'NORMATIVE' },
    [B2]: { epistemicType: 'NORMATIVE', supersedes: B1, supersedeReason: 'reconsidered' },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  // same root, no questionId on either → ONE lineage, B2 promotes (NORMATIVE needs no anchor/content)
  const c2 = queryClaim(idx, B2)!;
  assert.equal(c2.lineage.current, B2);
  assert.ok(c2.lineage.priorVersions.some((v) => v.ballotHash === B1), 'B1 retained as prior (unchanged behavior)');
});

// ---- Test 3 — gate not relaxed (NI-16b): separator can only withhold, never grant ----
test('CIP-16/NI-16b: a successor the gate rejects is STILL rejected when a questionId is present', () => {
  const B1 = ballotHash('claim', 'v1');
  const B2 = ballotHash('claim', 'v2 type-flipped');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  // NI-13h: a type-mismatched supersede is rejected. Adding a (matching) questionId must NOT rescue it.
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'SETTLED', questionId: 'q' },
    [B2]: { epistemicType: 'NORMATIVE', supersedes: B1, questionId: 'q', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B1, 'type cannot ride through even with a questionId');
});

// ---- Test 4 — NI-13h holds per sibling (independent of the separator) ----
test('CIP-16: NI-13h type-invariance holds WITHIN a sibling group', () => {
  const ROOT = ballotHash('root', 'r');
  const OK = ballotHash('same-type successor', 's1'); // promotes
  const BAD = ballotHash('type-flipped successor', 's2'); // rejected by NI-13h, different question
  const votes = [...unanimous(ROOT, 'YES'), ...unanimous(OK, 'NO'), ...unanimous(BAD, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [ROOT]: { epistemicType: 'NORMATIVE', questionId: 'a' },
    [OK]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: 'a' }, // promotes within sibling a
    [BAD]: { epistemicType: 'SETTLED', supersedes: ROOT, questionId: 'b' }, // own sibling; type-invariant trivially, separate head
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  assert.equal(queryClaim(idx, OK)!.lineage.current, OK, 'same-type successor promotes in its sibling');
  assert.notEqual(queryClaim(idx, OK)!.lineage.current, queryClaim(idx, BAD)!.lineage.current, 'distinct-question sibling is a distinct lineage');
});

// ---- Test 5 — re-adjudication composes: in-sibling promote doesn't disturb the other sibling ----
test('CIP-16: an in-sibling supersede promotes its own head without disturbing the other sibling', () => {
  const ROOT = ballotHash('conflated root', '#x');
  const FAC0 = ballotHash('factual restatement', 'r');
  const FAC1 = ballotHash('factual re-adjudication', 'r2'); // supersedes FAC0 in the factual sibling
  const PROC = ballotHash('procedural restatement', 'r');
  const votes = [...unanimous(ROOT, 'NO'), ...unanimous(FAC0, 'NO'), ...unanimous(PROC, 'NO'), ...unanimous(FAC1, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [ROOT]: { epistemicType: 'NORMATIVE' },
    [FAC0]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: 'fac' },
    [PROC]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: 'proc' },
    [FAC1]: { epistemicType: 'NORMATIVE', supersedes: FAC0, questionId: 'fac' },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  assert.equal(queryClaim(idx, FAC1)!.lineage.current, FAC1, 'factual sibling head advances to FAC1');
  assert.equal(queryClaim(idx, PROC)!.lineage.current, PROC, 'procedural sibling head is undisturbed');
  assert.ok(!queryClaim(idx, PROC)!.lineage.priorVersions.some((v) => v.ballotHash === FAC0 || v.ballotHash === FAC1), 'no factual ballot leaks into the procedural lineage');
});

// ---- Test 6 — determinism: same log+meta → identical sibling lineages ----
test('CIP-16: projection is deterministic under the composite key', () => {
  const ROOT = ballotHash('root', 'r');
  const A = ballotHash('a', 'a');
  const B = ballotHash('b', 'b');
  const votes = [...unanimous(ROOT, 'NO'), ...unanimous(A, 'NO'), ...unanimous(B, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [ROOT]: { epistemicType: 'NORMATIVE' },
    [A]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: 'a' },
    [B]: { epistemicType: 'NORMATIVE', supersedes: ROOT, questionId: 'b' },
  };
  const i1 = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  const i2 = buildClaimIndex(votes, keyring, 2, {}, meta, {}, GATE_OPEN);
  assert.deepEqual(
    i1.map((c) => [c.ballotHash, c.lineage.current, c.lineage.priorVersions.map((p) => p.ballotHash)]),
    i2.map((c) => [c.ballotHash, c.lineage.current, c.lineage.priorVersions.map((p) => p.ballotHash)]),
  );
});
