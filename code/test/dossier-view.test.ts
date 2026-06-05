// code/test/dossier-view.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote, readLog } from '../src/vote-log.ts';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { emptyDossier, signDossier } from '../src/dossier.ts';
import { appendBallot, loadRegistry } from '../src/ballot-registry.ts';
import { buildViews } from '../src/commons-read.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

test('a verified dossier surfaces all auditor fields in the ClaimView', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-dv-'));
  const log = join(dir, 'votes.log');
  const reg = join(dir, 'ballots.jsonl');
  const bh = ballotHash('Q', 'C');
  for (const id of ['V1', 'V2', 'V3']) appendVote(log, signVote({ validatorId: id, privateKeyPem: (keys as any)[id].privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: `${id}:YES` }));
  const dossier = signDossier({ ...emptyDossier(bh, 'V2'), assessedWeight: 'MATERIAL',
    contraryAnchors: [{ source: 'court.example', anchorType: 'court', claimItContradicts: 'the YES finding' }],
    falsificationConditions: [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'an appellate reversal' }] }, keys.V2.privateKeyPem);
  appendBallot(reg, 'Q', 'C', { dossier });

  const views = buildViews(readLog(log).map((e) => e.vote), keyring, 2, loadRegistry(reg), true);
  const v = views.find((x) => x.ballotHash === bh)!;
  assert.equal(v.auditorId, 'V2');
  assert.equal(v.contraryWeight, 'MATERIAL');
  assert.equal(v.contraryAnchors.length, 1);
  assert.equal(v.contraryAnchors[0].claimItContradicts, 'the YES finding');
  assert.equal(v.falsificationConditions[0].towardVerdict, 'NO');
});

test('a claim with no dossier exposes null auditor fields', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-dv2-'));
  const log = join(dir, 'votes.log'); const reg = join(dir, 'ballots.jsonl');
  const bh = ballotHash('Q2', 'C2');
  for (const id of ['V1', 'V2', 'V3']) appendVote(log, signVote({ validatorId: id, privateKeyPem: (keys as any)[id].privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: `${id}:YES` }));
  appendBallot(reg, 'Q2', 'C2', {});
  const v = buildViews(readLog(log).map((e) => e.vote), keyring, 2, loadRegistry(reg), true).find((x) => x.ballotHash === bh)!;
  assert.equal(v.auditorId, null);
  assert.equal(v.contraryWeight, null);
  assert.deepEqual(v.contraryAnchors, []);
});
