// Quorumchain ($QRM) — CIP-10 auditor runner pure-planner tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { planAudit } from '../src/run-auditor.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };

function votesFor(bh: string) {
  return ['V1', 'V2', 'V3'].map((id) => signVote({ validatorId: id, privateKeyPem: (keys as any)[id].privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: `${id}:YES` }));
}

test('planAudit scopes non-SETTLED claims and assigns a deterministic auditor per ballot', () => {
  const bh = ballotHash('Q', 'C');
  const registry = [{ ballotHash: bh, prompt: 'Q', context: 'C', meta: { epistemicType: 'NORMATIVE' as const } }];
  const plan = planAudit(votesFor(bh), registry);
  assert.equal(plan.length, 1);
  assert.equal(plan[0].ballotHash, bh);
  assert.ok(['V1', 'V2', 'V3'].includes(plan[0].auditorId));
  assert.equal(plan[0].rule, 1);
});

test('planAudit skips SETTLED claims with no anchored contrary reference', () => {
  const bh = ballotHash('S', 'C');
  const registry = [{ ballotHash: bh, prompt: 'S', context: 'C', meta: { epistemicType: 'SETTLED' as const } }];
  assert.equal(planAudit(votesFor(bh), registry).length, 0);
});

test('auditor assignment is replay-stable (same votes+registry → same auditor)', () => {
  const bh = ballotHash('Q', 'C');
  const registry = [{ ballotHash: bh, prompt: 'Q', context: 'C', meta: { epistemicType: 'NORMATIVE' as const } }];
  const a = planAudit(votesFor(bh), registry)[0].auditorId;
  const b = planAudit(votesFor(bh), registry)[0].auditorId;
  assert.equal(a, b);
});

import { selectPending } from '../src/run-auditor.ts';

test('selectPending skips ballots that already have a dossier, and applies the limit', () => {
  const plan = [
    { ballotHash: 'a', auditorId: 'V1', rule: 1 as const, prompt: '', context: '', ratifiedVerdict: 'YES', epistemicType: null },
    { ballotHash: 'b', auditorId: 'V2', rule: 1 as const, prompt: '', context: '', ratifiedVerdict: 'YES', epistemicType: null },
    { ballotHash: 'c', auditorId: 'V3', rule: 1 as const, prompt: '', context: '', ratifiedVerdict: 'YES', epistemicType: null },
  ];
  const alreadyDone = new Set(['b']); // b already has a dossier
  // skip b → [a, c]; limit 1 → [a]
  assert.deepEqual(selectPending(plan, alreadyDone, 1).map(p => p.ballotHash), ['a']);
  // no limit → [a, c]
  assert.deepEqual(selectPending(plan, alreadyDone, undefined).map(p => p.ballotHash), ['a', 'c']);
  // limit larger than remaining → [a, c]
  assert.deepEqual(selectPending(plan, alreadyDone, 99).map(p => p.ballotHash), ['a', 'c']);
});

test('planAudit excludes in-scope claims that have no registry entry (cannot be audited/attached)', () => {
  const bh = ballotHash('Q', 'C');
  // votes exist for bh, but the registry is EMPTY (no entry for bh)
  const plan = planAudit(votesFor(bh), []);
  assert.equal(plan.length, 0);
});

test('planAudit includes a voted claim that DOES have a registry entry', () => {
  const bh = ballotHash('Q', 'C');
  const plan = planAudit(votesFor(bh), [{ ballotHash: bh, prompt: 'Q', context: 'C', meta: { epistemicType: 'NORMATIVE' as const } }]);
  assert.equal(plan.length, 1);
});
