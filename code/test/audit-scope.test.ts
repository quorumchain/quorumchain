// code/test/audit-scope.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAuditScope, type ScopeClaim } from '../src/audit-scope.ts';

const settledUnanimous: ScopeClaim = { ballotHash: 'settled', epistemicType: 'SETTLED', unanimousSubstantive: true };
const liveClaim: ScopeClaim = { ballotHash: 'live', epistemicType: 'EMPIRICAL_LIVE', unanimousSubstantive: false };
const untyped: ScopeClaim = { ballotHash: 'untyped', epistemicType: null, unanimousSubstantive: false };

test('rule 1: non-SETTLED (incl. untyped) is in scope; SETTLED is not', () => {
  const scope = computeAuditScope([settledUnanimous, liveClaim, untyped], new Set());
  const ids = scope.inScope.map((s) => s.ballotHash);
  assert.ok(ids.includes('live'));
  assert.ok(ids.includes('untyped'));
  assert.ok(!ids.includes('settled'));
});

test('rule 2: a SETTLED + unanimous claim WITH an anchored contrary ref is auto-included', () => {
  const scope = computeAuditScope([settledUnanimous], new Set(['settled']));
  const hit = scope.inScope.find((s) => s.ballotHash === 'settled');
  assert.ok(hit);
  assert.equal(hit!.rule, 2);
});

test('rule attribution: non-SETTLED records rule 1', () => {
  const scope = computeAuditScope([liveClaim], new Set());
  assert.equal(scope.inScope[0].rule, 1);
});

test('scope is deterministic and stable across re-projection (sorted by ballotHash)', () => {
  const a = computeAuditScope([liveClaim, untyped], new Set());
  const b = computeAuditScope([untyped, liveClaim], new Set());
  assert.deepEqual(a.inScope.map((s) => s.ballotHash), b.inScope.map((s) => s.ballotHash));
});
