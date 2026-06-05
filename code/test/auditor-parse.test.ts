// code/test/auditor-parse.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAuditPrompt, parseAuditorOutput } from '../src/auditor.ts';

test('the prompt is method-not-conclusion: no directional instruction', () => {
  const p = buildAuditPrompt('Did X happen?', 'frozen criteria', 'YES');
  assert.match(p, /strongest.*anchored.*disconfirming|disconfirming.*evidence/i);
  assert.match(p, /NEGLIGIBLE/);
  assert.doesNotMatch(p, /argue that .* is false|prove .* wrong/i);
});

test('parses a well-formed json block into an unsigned dossier', () => {
  const out = [
    'Here is my assessment.',
    '```json',
    JSON.stringify({
      assessedWeight: 'MATERIAL',
      contraryAnchors: [{ source: 'court.example', anchorType: 'court', claimItContradicts: 'the YES finding' }],
      searchedRejectedAnchors: [],
      falsificationConditions: [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'an appellate reversal' }],
      negligibleCoSigners: [],
    }),
    '```',
  ].join('\n');
  const d = parseAuditorOutput(out, 'bh', 'V2');
  assert.equal(d.ballotHash, 'bh');
  assert.equal(d.auditorId, 'V2');
  assert.equal(d.assessedWeight, 'MATERIAL');
  assert.equal(d.contraryAnchors[0].source, 'court.example');
  assert.equal(d.signature, '');
});

test('malformed output degrades to an accountable NEGLIGIBLE skeleton', () => {
  const d = parseAuditorOutput('the model rambled with no json', 'bh', 'V1');
  assert.equal(d.assessedWeight, 'NEGLIGIBLE');
  assert.ok(d.searchedRejectedAnchors.length >= 1);
});

test('an unknown assessedWeight is coerced to NEGLIGIBLE (defensive)', () => {
  const out = '```json\n{"assessedWeight":"HUGE"}\n```';
  assert.equal(parseAuditorOutput(out, 'bh', 'V1').assessedWeight, 'NEGLIGIBLE');
});
