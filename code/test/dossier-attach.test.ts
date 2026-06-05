import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendBallot, attachDossier, loadRegistry, deriveCip13Inputs, verifyEntry } from '../src/ballot-registry.ts';
import { emptyDossier } from '../src/dossier.ts';

test('attachDossier appends a verifiable entry whose dossier folds to latest', () => {
  const reg = join(mkdtempSync(join(tmpdir(), 'qrm-da-')), 'ballots.jsonl');
  appendBallot(reg, 'Q', 'C', {}); // ballot first, no dossier
  const bh = loadRegistry(reg)[0].ballotHash;
  const d = { ...emptyDossier(bh, 'V2'), assessedWeight: 'MATERIAL' as const,
    contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X' }], signature: 'deadbeef' };
  attachDossier(reg, bh, d);

  const entries = loadRegistry(reg);
  for (const e of entries) assert.equal(verifyEntry(e), true); // ballotHash still recomputes
  const { dossiers } = deriveCip13Inputs(entries);
  assert.equal(dossiers[bh].assessedWeight, 'MATERIAL');
  assert.equal(dossiers[bh].auditorId, 'V2');
});

test('a later attach overrides an earlier dossier (fold-latest)', () => {
  const reg = join(mkdtempSync(join(tmpdir(), 'qrm-da2-')), 'ballots.jsonl');
  appendBallot(reg, 'Q', 'C', {});
  const bh = loadRegistry(reg)[0].ballotHash;
  attachDossier(reg, bh, { ...emptyDossier(bh, 'V1'), assessedWeight: 'WEAK', signature: 'aa' });
  attachDossier(reg, bh, { ...emptyDossier(bh, 'V3'), assessedWeight: 'DECISIVE', signature: 'bb' });
  const { dossiers } = deriveCip13Inputs(loadRegistry(reg));
  assert.equal(dossiers[bh].assessedWeight, 'DECISIVE');
  assert.equal(dossiers[bh].auditorId, 'V3');
});

test('attachDossier throws if the ballot is not registered', () => {
  const reg = join(mkdtempSync(join(tmpdir(), 'qrm-da3-')), 'ballots.jsonl');
  assert.throws(() => attachDossier(reg, 'nope', { ...emptyDossier('nope', 'V1'), signature: 'x' }));
});
