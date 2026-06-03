// Canonical participant Identity (backlog #1 from the round-44 review).
// A validator/operator/slot was represented three incompatible ways — CIP-3
// validatorId, CIP-10 NodeOperator, CIP-7 Validator — and scenario.ts linked
// them by reusing a bare string. These tests pin the single source of truth: one
// Identity { id, slot } projects into each module's record so the linkage is
// structural, and the SAME slot label is the diversity axis CIP-10's jury draw
// and CIP-7's distinctness floor both range over (not two coincidentally-paired
// label spaces).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { asNodeOperator, asValidator, taxonomyOf, type Identity } from '../src/identity.ts';

const IDN: Identity = { id: 'A', slot: 'corpus-A' };

test('asNodeOperator projects id and uses the slot as the CIP-10 model, default STANDARD assurance', () => {
  const op = asNodeOperator(IDN);
  assert.equal(op.id, 'A');
  assert.equal(op.model, 'corpus-A');
  assert.equal(op.assurance, 'STANDARD');
});

test('asValidator projects id and uses the slot as the CIP-7 corpusFamily; calibration is passed, not inherited', () => {
  const v = asValidator(IDN, { version: 'A@v2', calibration: 0.91 });
  assert.equal(v.id, 'A');
  assert.equal(v.provenance.corpusFamily, 'corpus-A');
  assert.equal(v.version, 'A@v2');
  assert.equal(v.calibration, 0.91); // version-bound, supplied — never inherited from the Identity
});

test('structural composition: the two projections of one Identity agree on participant AND diversity slot', () => {
  const op = asNodeOperator(IDN);
  const v = asValidator(IDN, { version: 'A@v1', calibration: 0.8 });
  assert.equal(op.id, v.id); // same participant — the linkage scenario.ts used to do by string-matching
  assert.equal(op.model, v.provenance.corpusFamily); // ONE diversity axis: CIP-10 slot === CIP-7 family
});

test('taxonomyOf is the distinct slot set in first-seen order (the CIP-10 registry taxonomy)', () => {
  const idns: Identity[] = [
    { id: 'A', slot: 'corpus-A' },
    { id: 'B', slot: 'corpus-B' },
    { id: 'A2', slot: 'corpus-A' }, // a second operator on slot A — taxonomy still lists the slot once
  ];
  assert.deepEqual(taxonomyOf(idns), ['corpus-A', 'corpus-B']);
});
