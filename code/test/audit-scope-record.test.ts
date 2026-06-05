// code/test/audit-scope-record.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderScopeRecord } from '../src/audit-scope.ts';

test('renderScopeRecord lists in-scope ballots with the matched rule', () => {
  const md = renderScopeRecord({ inScope: [{ ballotHash: 'aaaa1111bbbb2222', rule: 1 }, { ballotHash: 'cccc3333dddd4444', rule: 2 }] });
  assert.match(md, /# Audit scope/i);
  assert.match(md, /aaaa1111bbbb/);
  assert.match(md, /rule 1/i);
  assert.match(md, /cccc3333dddd/);
  assert.match(md, /rule 2/i);
});

test('empty scope renders a clear "no claims in scope" record', () => {
  assert.match(renderScopeRecord({ inScope: [] }), /no claims in scope/i);
});
