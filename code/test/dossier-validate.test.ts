// code/test/dossier-validate.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDossier, type ContraryDossier } from '../src/dossier.ts';
import { validateDossier } from '../src/dossier-validate.ts';

test('bare NEGLIGIBLE on an eligible claim is INVALID (NI-AA8)', () => {
  const d = emptyDossier('bh', 'V1');
  const r = validateDossier(d, { eligible: true });
  assert.equal(r.valid, false);
  assert.match(r.reason!, /negligible/i);
});

test('NEGLIGIBLE accountable via co-signers is VALID', () => {
  const d: ContraryDossier = { ...emptyDossier('bh', 'V1'), negligibleCoSigners: ['V2', 'V3'] };
  assert.equal(validateDossier(d, { eligible: true }).valid, true);
});

test('NEGLIGIBLE accountable via searchedRejectedAnchors is VALID', () => {
  const d: ContraryDossier = { ...emptyDossier('bh', 'V1'), searchedRejectedAnchors: [{ source: 'blog', whyRejected: 'unanchored' }] };
  assert.equal(validateDossier(d, { eligible: true }).valid, true);
});

test('a contrary anchor missing a field is INVALID (NI-AA4 symmetric bar)', () => {
  const d: ContraryDossier = { ...emptyDossier('bh', 'V1'), assessedWeight: 'MATERIAL',
    contraryAnchors: [{ source: '', anchorType: 'court', claimItContradicts: 'X', provenanceClass: 'primary-document' }] };
  const r = validateDossier(d, { eligible: true });
  assert.equal(r.valid, false);
  assert.match(r.reason!, /anchor/i);
});

test('MATERIAL with a well-formed anchor is VALID', () => {
  const d: ContraryDossier = { ...emptyDossier('bh', 'V1'), assessedWeight: 'MATERIAL',
    contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X', provenanceClass: 'primary-document' }] };
  assert.equal(validateDossier(d, { eligible: true }).valid, true);
});

test('bare NEGLIGIBLE on a NON-eligible claim is allowed (the guard only binds on eligible classes)', () => {
  const d = emptyDossier('bh', 'V1');
  assert.equal(validateDossier(d, { eligible: false }).valid, true);
});
