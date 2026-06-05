// code/test/auditor-render.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderClaimMarkdown } from '../src/commons-render.ts';
import type { ClaimView } from '../src/commons-read.ts';

function base(): ClaimView {
  return {
    ballotHash: 'b'.repeat(64), statement: 'Test claim?', status: 'RESOLVED',
    stances: [{ position: 'YES', standing: 'CONSENSUS', validators: ['V1', 'V2', 'V3'], panelVotes: 3, support: null }],
    panelState: { size: 3, validators: ['V1', 'V2', 'V3'] }, chainValid: true,
    epistemicType: 'NORMATIVE', typeRatified: false, evidenceTime: 't',
    lineage: { current: 'b'.repeat(64), priorVersions: [], pendingReview: [] },
    contraryWeight: null, falsificationConditions: [],
    auditorId: null, contraryAnchors: [], searchedRejectedAnchors: [], negligibleCoSigners: [],
  };
}

test('no dossier → explicit "no adversarial review on record yet" section', () => {
  const md = renderClaimMarkdown(base());
  assert.match(md, /## Adversarial review \(CIP-10 auditor\)/);
  assert.match(md, /No adversarial review on record yet/i);
});

test('a MATERIAL dossier renders auditor, weight, anchors, falsification', () => {
  const v = base();
  v.auditorId = 'V2'; v.contraryWeight = 'MATERIAL';
  v.contraryAnchors = [{ source: 'court.example', anchorType: 'court', claimItContradicts: 'the YES finding' }];
  v.falsificationConditions = [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'an appellate reversal' }];
  const md = renderClaimMarkdown(v);
  assert.match(md, /## Adversarial review \(CIP-10 auditor\)/);
  assert.match(md, /auditor:\s*\*\*V2\*\*/i);
  assert.match(md, /MATERIAL/);
  assert.match(md, /court\.example/);
  assert.match(md, /the YES finding/);
  assert.match(md, /toward \*\*NO\*\*: an appellate reversal/);
});

test('NEGLIGIBLE with co-signers shows the accountability line', () => {
  const v = base();
  v.auditorId = 'V1'; v.contraryWeight = 'NEGLIGIBLE'; v.negligibleCoSigners = ['V2', 'V3'];
  const md = renderClaimMarkdown(v);
  assert.match(md, /NEGLIGIBLE/);
  assert.match(md, /co-signed by\s*V2,\s*V3/i);
});

test('searched-but-rejected anchors render as the suppression audit-trail', () => {
  const v = base();
  v.auditorId = 'V3'; v.contraryWeight = 'NEGLIGIBLE';
  v.searchedRejectedAnchors = [{ source: 'random.blog', whyRejected: 'unanchored opinion' }];
  const md = renderClaimMarkdown(v);
  assert.match(md, /random\.blog/);
  assert.match(md, /unanchored opinion/);
});
