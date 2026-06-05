import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { emptyDossier, signDossier } from '../src/dossier.ts';
import { deriveCip13InputsVerified, type BallotRegistryEntry } from '../src/ballot-registry.ts';

const v1 = generateValidatorKey();
const keyring = { V1: v1.publicKeyPem };

function entryWith(dossier: any): BallotRegistryEntry {
  return { ballotHash: 'bh', prompt: 'q', context: 'c', dossier };
}

test('a validly-signed dossier is projected', () => {
  const d = signDossier({ ...emptyDossier('bh', 'V1'), negligibleCoSigners: ['V2', 'V3'] }, v1.privateKeyPem);
  const { dossiers, dropped } = deriveCip13InputsVerified([entryWith(d)], keyring);
  assert.ok(dossiers['bh']);
  assert.equal(dropped.length, 0);
});

test('a tampered dossier is DROPPED, not projected', () => {
  const d = signDossier(emptyDossier('bh', 'V1'), v1.privateKeyPem);
  const tampered = { ...d, assessedWeight: 'DECISIVE' };
  const { dossiers, dropped } = deriveCip13InputsVerified([entryWith(tampered)], keyring);
  assert.equal(dossiers['bh'], undefined);
  assert.deepEqual(dropped, ['bh']);
});

test('a dossier whose auditorId is not in the keyring is DROPPED', () => {
  const rogue = generateValidatorKey();
  const d = signDossier(emptyDossier('bh', 'VX'), rogue.privateKeyPem);
  const { dossiers, dropped } = deriveCip13InputsVerified([entryWith(d)], keyring);
  assert.equal(dossiers['bh'], undefined);
  assert.deepEqual(dropped, ['bh']);
});

test('an entry with no dossier yields no projection and no drop', () => {
  const { dossiers, dropped } = deriveCip13InputsVerified([{ ballotHash: 'bh', prompt: 'q', context: 'c' }], keyring);
  assert.equal(Object.keys(dossiers).length, 0);
  assert.equal(dropped.length, 0);
});
