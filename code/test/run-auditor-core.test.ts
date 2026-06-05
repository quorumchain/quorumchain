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
