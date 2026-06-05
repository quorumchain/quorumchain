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
    dossierConstruction: null,
  };
}

test('no dossier on an in-scope claim → "adversarial review pending"', () => {
  const md = renderClaimMarkdown(base()); // epistemicType NORMATIVE
  assert.match(md, /## Adversarial review \(CIP-10 auditor\)/);
  assert.match(md, /Adversarial review pending \(in-scope claim/i);
});

test('no dossier on a SETTLED claim → "out of audit scope"', () => {
  const v = base(); v.epistemicType = 'SETTLED';
  const md = renderClaimMarkdown(v);
  assert.match(md, /Out of audit scope \(SETTLED fact/i);
});

test('a Construction-A dossier is annotated as retrospective (produced after vote)', () => {
  const v = base();
  v.auditorId = 'V2'; v.contraryWeight = 'MATERIAL'; v.dossierConstruction = 'A';
  v.contraryAnchors = [{ source: 'court.example', anchorType: 'court', claimItContradicts: 'the YES finding', provenanceClass: 'court-record' }];
  const md = renderClaimMarkdown(v);
  assert.match(md, /retrospective audit \(Construction A\) — produced after vote/i);
});

test('a MATERIAL dossier renders auditor, weight, anchors, falsification', () => {
  const v = base();
  v.auditorId = 'V2'; v.contraryWeight = 'MATERIAL'; v.dossierConstruction = 'A';
  v.contraryAnchors = [{ source: 'court.example', anchorType: 'court', claimItContradicts: 'the YES finding', provenanceClass: 'court-record' }];
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
  v.dossierConstruction = 'A';
  const md = renderClaimMarkdown(v);
  assert.match(md, /NEGLIGIBLE/);
  assert.match(md, /co-signed by\s*V2,\s*V3/i);
});

test('searched-but-rejected anchors render as the suppression audit-trail', () => {
  const v = base();
  v.auditorId = 'V3'; v.contraryWeight = 'NEGLIGIBLE'; v.dossierConstruction = 'A';
  v.searchedRejectedAnchors = [{ source: 'random.blog', whyRejected: 'unanchored opinion' }];
  const md = renderClaimMarkdown(v);
  assert.match(md, /random\.blog/);
  assert.match(md, /unanchored opinion/);
});
