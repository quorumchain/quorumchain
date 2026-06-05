// Quorumchain ($QRM) — Task 11: signDossier + audit host RPCs (CIP-10 auditor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { makeHostHandler } from '../src/signer-host-core.ts';
import { emptyDossier, verifyDossier } from '../src/dossier.ts';

test('the host signs a dossier with its child-side key and never returns the private key', async () => {
  const key = generateValidatorKey();
  const handler = makeHostHandler({ validatorId: 'V2', key, invoke: async () => 'unused' });
  const unsigned = {
    ...emptyDossier('bh', 'V2'),
    assessedWeight: 'MATERIAL' as const,
    contraryAnchors: [{ source: 's', anchorType: 'court', claimItContradicts: 'X', provenanceClass: 'primary-document' }],
  };
  const res: any = await handler({ id: 1, type: 'signDossier', dossier: unsigned });
  assert.ok(res.dossier);
  assert.notEqual(res.dossier.signature, '');
  assert.equal(verifyDossier(res.dossier, key.publicKeyPem), true);
  assert.equal(JSON.stringify(res).includes('PRIVATE'), false);
});

test('signDossier refuses if the dossier auditorId != this host validatorId', async () => {
  const key = generateValidatorKey();
  const handler = makeHostHandler({ validatorId: 'V2', key, invoke: async () => 'unused' });
  const res: any = await handler({ id: 2, type: 'signDossier', dossier: { ...emptyDossier('bh', 'V1'), signature: '' } });
  assert.ok(res.error);
});

test('the audit RPC runs the host invoker and returns raw output', async () => {
  const key = generateValidatorKey();
  const handler = makeHostHandler({ validatorId: 'V2', key, invoke: async (p: string) => `ECHO:${p}` });
  const res: any = await handler({ id: 3, type: 'audit', prompt: 'find contrary evidence' });
  assert.equal(res.rawOutput, 'ECHO:find contrary evidence');
});
