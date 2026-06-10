import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { convene, parseVerdict } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { mockAttestor } from '../src/attestor.ts';
import { readLog } from '../src/vote-log.ts';

function tmpLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-poi-')), 'votes.log');
}

function attestedPanel(outputs: Record<string, string>): { signers: Signer[]; keyring: Record<string, string> } {
  const keyring: Record<string, string> = {};
  const signers = Object.entries(outputs).map(([id, out]) => {
    const k = generateValidatorKey();
    keyring[id] = k.publicKeyPem;
    return makeLocalSigner({
      validatorId: id,
      key: k,
      deliberate: async () => ({ verdict: parseVerdict(out), rawOutput: out }),
      attestor: mockAttestor(async () => out),
    });
  });
  return { signers, keyring };
}

test('every vote in an attested convening reads unattested/NO_BACKEND and verifies', async () => {
  const outputs = { V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' };
  const { signers, keyring } = attestedPanel(outputs);
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.ratified, true);
  assert.equal(r.verdict, 'YES');
  assert.equal(r.tally.YES, 2);
  for (const v of r.votes) assert.deepEqual(v.attestation, { band: 'unattested', reason: 'NO_BACKEND' });
});

test('the 2/3 tally is byte-for-byte identical with vs without the attestation envelope', async () => {
  const outputs = { V1: 'VERDICT: YES', V2: 'VERDICT: NO', V3: 'VERDICT: YES' };
  const { signers: aSigners, keyring } = attestedPanel(outputs);
  const aLog = tmpLog();
  const a = await convene({ prompt: 'q', context: 'c', signers: aSigners, keyring, quorum: 2, logPath: aLog });

  const { signers: lSigners, keyring: lKeyring } = (function () {
    const kr: Record<string, string> = {};
    const ss = Object.entries(outputs).map(([id, out]) => {
      const k = generateValidatorKey();
      kr[id] = k.publicKeyPem;
      return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(out), rawOutput: out }) });
    });
    return { signers: ss, keyring: kr };
  })();
  const l = await convene({ prompt: 'q', context: 'c', signers: lSigners, keyring: lKeyring, quorum: 2, logPath: tmpLog() });

  assert.deepEqual(a.tally, l.tally);
  assert.equal(a.ratified, l.ratified);
  assert.equal(a.verdict, l.verdict);
  assert.equal(a.required, l.required);
  assert.deepEqual([...a.counted].sort(), [...l.counted].sort());

  assert.ok(readLog(aLog).every((e) => e.vote.attestation?.band === 'unattested'));
});
