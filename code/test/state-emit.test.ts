// Phase 0.4 — wiring module transitions into the tamper-evident state-log. The
// modules stay pure (they return new state); these recorders are the canonical path
// that ALSO appends each transition to the shared hash-chained log, so a full
// accountability arc (bond CREATE → SETTLE, validator UPGRADE, reputation SCORE) is
// replayable and any silent rewrite is caught. (Per-event authorization + on-chain
// anchoring remain testnet, as disclosed.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { createBond, settleBond } from '../src/bonds.ts';
import { seedPanel, proposeUpgrade, type Validator } from '../src/lifecycle.ts';
import { scoreSources } from '../src/reputation.ts';
import { readStateLog, verifyStateLog } from '../src/state-log.ts';
import { recordBondCreate, recordBondSettlement, recordAdmissions, recordReputation } from '../src/state-emit.ts';

const TS = '2026-06-04T00:00:00Z';
const logPath = () => join(mkdtempSync(join(tmpdir(), 'qrm-se-')), 'state.log');
const val = (id: string): Validator => ({ id, version: `${id}@v1`, status: 'STANDING', calibration: 0.8, provenance: { corpusFamily: `c-${id}`, teacher: null, weightDerivation: `c-${id}-base`, provider: id, servingStack: `${id}-stack` } });

test('a full transition arc is recorded into one tamper-evident state-log', () => {
  const path = logPath();
  const subj = generateValidatorKey();

  const bond = createBond({ subjectPublicKeyPem: subj.publicKeyPem, subjectPrivateKeyPem: subj.privateKeyPem, constraint: 'no rug', criteria: 'frozen-criteria', stake: 100, timestamp: TS });
  recordBondCreate(path, bond);
  recordBondSettlement(path, settleBond(bond, { ballotHash: bond.ballotHash, violated: true }), TS);

  const p0 = seedPanel([val('A'), val('B'), val('C'), val('D')]);
  const up = proposeUpgrade(p0, 'A', { version: 'A@v2', calibration: 0.9, provenance: { corpusFamily: 'c-A', teacher: null, weightDerivation: 'c-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: true });
  assert.equal(up.ok, true);
  recordAdmissions(path, up.panel.admissionLog.slice(p0.admissionLog.length), TS); // only the NEW events

  const reps = scoreSources([{ id: 'c1', stances: [{ position: 'X', sources: ['s1'] }], resolution: { anchor: 'EXTERNAL', groundTruth: 'X', panelVerdict: 'X' } }]);
  recordReputation(path, 'epoch-1', reps, TS);

  const types = readStateLog(path).map((e) => `${e.module}:${e.type}`);
  assert.ok(types.includes('bond:CREATE'), types.join(','));
  assert.ok(types.includes('bond:SETTLE'), types.join(','));
  assert.ok(types.includes('lifecycle:UPGRADE'), types.join(','));
  assert.ok(types.includes('reputation:SCORE'), types.join(','));
  assert.equal(verifyStateLog(path).valid, true);
});

test('the recorded settlement carries the slash outcome and a silent rewrite is caught', () => {
  const path = logPath();
  const subj = generateValidatorKey();
  const bond = createBond({ subjectPublicKeyPem: subj.publicKeyPem, subjectPrivateKeyPem: subj.privateKeyPem, constraint: 'c', criteria: 'k', stake: 50, timestamp: TS });
  recordBondCreate(path, bond);
  recordBondSettlement(path, settleBond(bond, { ballotHash: bond.ballotHash, violated: true }), TS);

  const settle = readStateLog(path).find((e) => e.type === 'SETTLE')!;
  assert.equal(settle.payload.status, 'SLASHED');
  assert.equal(settle.payload.slashed, 50);

  // flip the recorded slash to a release in the raw file — the chain must break
  writeFileSync(path, readFileSync(path, 'utf8').replace('SLASHED', 'RELEASED'));
  assert.equal(verifyStateLog(path).valid, false);
});
