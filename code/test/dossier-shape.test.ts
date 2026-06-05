// Quorumchain ($QRM) — CIP-10 T2-a/T4 shape tests (ballot 8415ba86).
// T2-a (NI-AA4 interim): provenanceClass added to ContraryAnchor.
// T4: dossierConstruction added to ContraryDossier (always 'A' for Construction A).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyDossier, dossierPayload } from '../src/dossier.ts';
import { parseAuditorOutput } from '../src/auditor.ts';

test('emptyDossier defaults dossierConstruction to A', () => {
  assert.equal(emptyDossier('bh', 'V1').dossierConstruction, 'A');
});

test('dossierConstruction is signed (part of the payload)', () => {
  const base = { ...emptyDossier('bh', 'V1'), negligibleCoSigners: ['V2', 'V3'] };
  assert.notEqual(
    dossierPayload({ ...base, dossierConstruction: 'A' }),
    dossierPayload({ ...base, dossierConstruction: 'B' }),
  );
});

test('contrary anchor provenanceClass is signed', () => {
  const mk = (pc: string) => ({
    ...emptyDossier('bh', 'V1'),
    assessedWeight: 'MATERIAL' as const,
    contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X', provenanceClass: pc }],
  });
  assert.notEqual(dossierPayload(mk('court-record')), dossierPayload(mk('news')));
});

test('provenanceClass round-trips through a ContraryAnchor literal', () => {
  const anchor = { source: 's', anchorType: 'court', claimItContradicts: 'X', provenanceClass: 'court-record' };
  assert.equal(anchor.provenanceClass, 'court-record');
});

test('parser populates provenanceClass and sets dossierConstruction to A', () => {
  const out =
    '```json\n' +
    JSON.stringify({
      assessedWeight: 'MATERIAL',
      contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X', provenanceClass: 'court-record' }],
    }) +
    '\n```';
  const d = parseAuditorOutput(out, 'bh', 'V2');
  assert.equal(d.contraryAnchors[0].provenanceClass, 'court-record');
  assert.equal(d.dossierConstruction, 'A');
});

test('parser defaults provenanceClass to empty string when absent', () => {
  const out =
    '```json\n' +
    JSON.stringify({
      assessedWeight: 'MATERIAL',
      contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X' }],
    }) +
    '\n```';
  const d = parseAuditorOutput(out, 'bh', 'V2');
  assert.equal(d.contraryAnchors[0].provenanceClass, '');
});

test('malformed-skeleton early return also has dossierConstruction A', () => {
  const d = parseAuditorOutput('no json here', 'bh', 'V1');
  assert.equal(d.dossierConstruction, 'A');
});
