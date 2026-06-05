import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { emptyDossier, signDossier, verifyDossier, dossierPayload, type ContraryDossier } from '../src/dossier.ts';

const k = generateValidatorKey();

function material(): ContraryDossier {
  return {
    ballotHash: 'bh', auditorId: 'V2',
    contraryAnchors: [
      { source: 'b.example/2', anchorType: 'court', claimItContradicts: 'X' },
      { source: 'a.example/1', anchorType: 'court', claimItContradicts: 'Y' },
    ],
    searchedRejectedAnchors: [{ source: 'blog', whyRejected: 'unanchored' }],
    assessedWeight: 'MATERIAL',
    falsificationConditions: [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'a higher-court reversal' }],
    negligibleCoSigners: [],
    signature: '',
  };
}

test('a signed dossier verifies against the auditor public key', () => {
  const d = signDossier(material(), k.privateKeyPem);
  assert.notEqual(d.signature, '');
  assert.equal(verifyDossier(d, k.publicKeyPem), true);
});

test('payload is canonical: anchor order does not change the signature', () => {
  const d1 = material();
  const d2 = material();
  d2.contraryAnchors = [d1.contraryAnchors[1], d1.contraryAnchors[0]]; // reversed
  assert.equal(dossierPayload(d1), dossierPayload(d2));
  const s1 = signDossier(d1, k.privateKeyPem);
  assert.equal(verifyDossier({ ...d2, signature: s1.signature }, k.publicKeyPem), true);
});

test('tampering any signed field fails verification', () => {
  const d = signDossier(material(), k.privateKeyPem);
  assert.equal(verifyDossier({ ...d, assessedWeight: 'DECISIVE' }, k.publicKeyPem), false);
  assert.equal(verifyDossier({ ...d, auditorId: 'V1' }, k.publicKeyPem), false);
});

test('a different key does not verify', () => {
  const other = generateValidatorKey();
  const d = signDossier(material(), k.privateKeyPem);
  assert.equal(verifyDossier(d, other.publicKeyPem), false);
});

test('canonical sort is unambiguous for prefix-colliding anchor fields (NI-AA2 determinism)', () => {
  const mk = (anchors: any[]): any => ({
    ballotHash: 'bh', auditorId: 'V2', contraryAnchors: anchors,
    searchedRejectedAnchors: [], assessedWeight: 'MATERIAL',
    falsificationConditions: [], negligibleCoSigners: [], signature: '',
  });
  const a1 = { source: 'ab', anchorType: 'court', claimItContradicts: 'c' };
  const a2 = { source: 'a', anchorType: 'court', claimItContradicts: 'bc' };
  // same two anchors, opposite input order → payload must be identical
  assert.equal(dossierPayload(mk([a1, a2])), dossierPayload(mk([a2, a1])));
});
