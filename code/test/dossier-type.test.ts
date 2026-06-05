import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ContraryDossier, ContraryAnchor, SearchedRejectedAnchor } from '../src/dossier.ts';
import { emptyDossier } from '../src/dossier.ts';

test('emptyDossier builds a NEGLIGIBLE dossier skeleton with all arrays present', () => {
  const d: ContraryDossier = emptyDossier('bh', 'V1');
  assert.equal(d.ballotHash, 'bh');
  assert.equal(d.auditorId, 'V1');
  assert.equal(d.assessedWeight, 'NEGLIGIBLE');
  assert.deepEqual(d.contraryAnchors, []);
  assert.deepEqual(d.searchedRejectedAnchors, []);
  assert.deepEqual(d.falsificationConditions, []);
  assert.deepEqual(d.negligibleCoSigners, []);
  assert.equal(d.signature, '');
});

test('the sub-types carry the spec §4 fields', () => {
  const a: ContraryAnchor = { source: 's', anchorType: 't', claimItContradicts: 'c' };
  const r: SearchedRejectedAnchor = { source: 's', whyRejected: 'unanchored' };
  assert.equal(a.claimItContradicts, 'c');
  assert.equal(r.whyRejected, 'unanchored');
});
