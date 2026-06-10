import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sign } from 'node:crypto';
import { convene, parseVerdict } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { verifyProvenance } from '../src/verify-provenance.ts';
import { zkWebProofAttestor } from '../src/zk-web-proof-attestor.ts';
import { referenceProofVerifier } from '../src/zk-web-proof-verifier.ts';
import { REFERENCE_PROVER_PRIVATE_PEM, REFERENCE_VK_ID, lookupVk } from '../src/zk-web-proof.ts';
import { readLog } from '../src/vote-log.ts';

const tmpLog = () => join(mkdtempSync(join(tmpdir(), 'qrm-poi2-')), 'votes.log');

// The fixture fetchVendor embeds the per-convening challengeNonce into the transcript text,
// simulating a real model echoing the verification token (spec §5). The same transcript is
// recorded for the verifier to re-derive against.
function attestedPanel(outputs: Record<string, string>, artifacts: Map<string, Uint8Array>, transcripts: Map<string, string>) {
  const keyring: Record<string, string> = {};
  const signers: Signer[] = Object.entries(outputs).map(([id, text]) => {
    const k = generateValidatorKey();
    keyring[id] = k.publicKeyPem;
    const attestor = zkWebProofAttestor({
      fetchVendor: async (_prompt, challengeNonce) => {
        const transcriptBody = JSON.stringify({ content: [{ type: 'text', text: `${text}\n${challengeNonce}` }] });
        transcripts.set(id, transcriptBody);
        return { transcriptBody, endpoint: 'api.anthropic.com', modelVersion: 'claude-x' };
      },
      prover: (d) => sign(null, Buffer.from(d, 'utf8'), REFERENCE_PROVER_PRIVATE_PEM),
      writeArtifact: (h, b) => artifacts.set(h, b),
      extractionRule: 'anthropic-messages-v1', modelParam: 'claude-x', vkId: REFERENCE_VK_ID, digestAlg: 'sha256-v1',
    });
    return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(text), rawOutput: text }), attestor });
  });
  return { signers, keyring };
}

test('a full attested convening: every vote verifies (re-derived) end-to-end', async () => {
  const outputs = { V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' };
  const artifacts = new Map<string, Uint8Array>();
  const transcripts = new Map<string, string>();
  const { signers, keyring } = attestedPanel(outputs, artifacts, transcripts);
  const logPath = tmpLog();
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath });
  assert.equal(r.ratified, true);
  assert.equal(r.verdict, 'YES');

  const votes = readLog(logPath).map((e) => e.vote);
  const res = verifyProvenance(votes, {
    resolveArtifact: (v) => artifacts.get(v.attestation!.proofHash!),
    resolveTranscript: (v) => transcripts.get(v.validatorId),
    verifierFor: (kind) => (kind === 'fixture-prover-signature' ? referenceProofVerifier() : undefined),
  });
  assert.equal(res.ok, true);
  assert.equal(res.claimedAttested, 3);
  assert.equal(res.verifiedAttested, 3);
});

test('the 2/3 tally is byte-for-byte identical with the REAL attestor vs a legacy panel', async () => {
  const outputs = { V1: 'VERDICT: YES', V2: 'VERDICT: NO', V3: 'VERDICT: YES' };
  const { signers: aSigners, keyring } = attestedPanel(outputs, new Map(), new Map());
  const a = await convene({ prompt: 'q', context: 'c', signers: aSigners, keyring, quorum: 2, logPath: tmpLog() });

  const lKeyring: Record<string, string> = {};
  const lSigners = Object.entries(outputs).map(([id, text]) => {
    const k = generateValidatorKey(); lKeyring[id] = k.publicKeyPem;
    return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(text), rawOutput: text }) });
  });
  const l = await convene({ prompt: 'q', context: 'c', signers: lSigners, keyring: lKeyring, quorum: 2, logPath: tmpLog() });

  assert.deepEqual(a.tally, l.tally);
  assert.equal(a.ratified, l.ratified);
  assert.equal(a.verdict, l.verdict);
  assert.equal(a.required, l.required);
});

test('key separation: the reference prover key is distinct from every validator signing key', () => {
  const k = generateValidatorKey();
  assert.notEqual(k.privateKeyPem, REFERENCE_PROVER_PRIVATE_PEM);
});

test('quarantine: the reference vk is flagged production:false', () => {
  assert.equal(lookupVk(REFERENCE_VK_ID)!.production, false);
});
