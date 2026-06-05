// code/test/auditor-gates.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectAuditor } from '../src/auditor-select.ts';
import { computeAuditScope } from '../src/audit-scope.ts';
import { validateDossier } from '../src/dossier-validate.ts';
import { emptyDossier, signDossier, verifyDossier } from '../src/dossier.ts';
import { generateValidatorKey } from '../src/signed-vote.ts';

// G-AA1 — verifiable rotation: recomputes from the seed, uniform across re-projection.
test('G-AA1 rotation recomputes identically', () => {
  const sigs = { V1: 'a', V2: 'b', V3: 'c' };
  assert.equal(selectAuditor('bh', sigs), selectAuditor('bh', sigs));
});

// G-AA1b — ungrindable: without the keys the proposer can't steer the pick by varying ballot text
// (the seed depends on signatures it can't forge). Modeled: varying ballot text with FIXED sigs
// reaches >1 auditor and no single value dominates trivially.
test('G-AA1b varying ballot text does not let a fixed-signature proposer pin one auditor', () => {
  const sigs = { V1: 'a', V2: 'b', V3: 'c' };
  const counts: Record<string, number> = { V1: 0, V2: 0, V3: 0 };
  for (let i = 0; i < 300; i++) counts[selectAuditor(`b${i}`, sigs)]++;
  for (const id of ['V1', 'V2', 'V3']) assert.ok(counts[id] > 40);
});

// G-AA3 — negligible on settled facts: SETTLED claim is out of scope (no forced doubt).
test('G-AA3 settled facts are not force-audited', () => {
  const scope = computeAuditScope([{ ballotHash: 'h2o', epistemicType: 'SETTLED', unanimousSubstantive: true }], new Set());
  assert.equal(scope.inScope.length, 0);
});

// G-AA4b — symmetric bar (suppression): bare NEGLIGIBLE on eligible claim is invalid.
test('G-AA4b bare NEGLIGIBLE on eligible claim rejected; accountable accepted', () => {
  assert.equal(validateDossier(emptyDossier('bh', 'V1'), { eligible: true }).valid, false);
  assert.equal(validateDossier({ ...emptyDossier('bh', 'V1'), negligibleCoSigners: ['V2', 'V3'] }, { eligible: true }).valid, true);
});

// G-AA2/AA6 proxy — the dossier is a signed artifact, verifiable, and never a vote (no verdict field).
test('G-AA2/AA6 dossier is a signed artifact, not a vote', () => {
  const k = generateValidatorKey();
  const d = signDossier({ ...emptyDossier('bh', 'V1'), negligibleCoSigners: ['V2', 'V3'] }, k.privateKeyPem);
  assert.equal(verifyDossier(d, k.publicKeyPem), true);
  assert.equal('verdict' in (d as any), false); // a dossier carries no verdict — never tallied
});
