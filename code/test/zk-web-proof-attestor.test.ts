import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, sign } from 'node:crypto';
import { zkWebProofAttestor } from '../src/zk-web-proof-attestor.ts';
import {
  publicInputsDigest, applyExtractionRule, extractionRuleHash,
  REFERENCE_PROVER_PRIVATE_PEM, REFERENCE_VK_ID, type PublicInputs,
} from '../src/zk-web-proof.ts';
import { requestCommitment } from '../src/attestation.ts';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function fixture() {
  const transcriptBody = JSON.stringify({ id: 'msg_1', content: [{ type: 'text', text: 'VERDICT: YES\ntoken=XN123' }] });
  const artifacts = new Map<string, Uint8Array>();
  const attestor = zkWebProofAttestor({
    fetchVendor: async () => ({ transcriptBody, endpoint: 'api.anthropic.com', modelVersion: 'claude-x' }),
    prover: (digestHex) => sign(null, Buffer.from(digestHex, 'utf8'), REFERENCE_PROVER_PRIVATE_PEM),
    writeArtifact: (h, bytes) => { artifacts.set(h, bytes); },
    extractionRule: 'anthropic-messages-v1',
    modelParam: 'claude-x',
    vkId: REFERENCE_VK_ID,
    digestAlg: 'sha256-v1',
  });
  return { attestor, transcriptBody, artifacts };
}

test('zkWebProofAttestor produces a well-formed attested envelope bound to this ballot', async () => {
  const { attestor, transcriptBody, artifacts } = fixture();
  const r = await attestor.invoke('V1', 'PROMPT', 'XN123', { ballotHash: 'BH', conveningNonce: 'CN' });

  assert.equal(r.rawOutput, 'VERDICT: YES\ntoken=XN123');
  assert.equal(r.attestation.band, 'attested');
  assert.equal(r.attestation.responseHash, sha(r.rawOutput));
  assert.ok(r.rawOutput.includes('XN123'));

  assert.equal(r.attestation.requestCommitment, requestCommitment({
    promptHash: sha('PROMPT'), modelParam: 'claude-x', ballotHash: 'BH', conveningNonce: 'CN', challengeNonce: 'XN123',
  }));
  assert.equal(r.attestation.transcriptHash, sha(transcriptBody));
  assert.equal(r.attestation.endpoint, 'api.anthropic.com');
  assert.equal(r.attestation.modelVersion, 'claude-x');
  assert.equal(r.attestation.extractionRule, 'anthropic-messages-v1');
  assert.equal(r.attestation.attestorBackend, 'fixture-prover-signature');
  assert.equal(r.attestation.vkId, REFERENCE_VK_ID);
  assert.equal(r.attestation.digestAlg, 'sha256-v1');

  assert.equal(artifacts.size, 1);
  const [storedHash, bytes] = [...artifacts.entries()][0];
  assert.equal(r.attestation.proofHash, storedHash);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), storedHash); // proofHash = content hash

  const pi: PublicInputs = {
    requestCommitment: r.attestation.requestCommitment!, transcriptHash: r.attestation.transcriptHash!,
    responseHash: r.attestation.responseHash!, challengeNonce: 'XN123', endpoint: 'api.anthropic.com',
    modelVersion: 'claude-x', extractionRuleHash: extractionRuleHash('anthropic-messages-v1'),
  };
  assert.equal(applyExtractionRule('anthropic-messages-v1', transcriptBody), r.rawOutput);
  assert.match(publicInputsDigest(pi, 'sha256-v1'), /^[0-9a-f]{64}$/);
});

test('a fetchVendor error propagates (degrade is attestWithBudget\'s job, not the backend\'s)', async () => {
  const attestor = zkWebProofAttestor({
    fetchVendor: async () => { throw new Error('vendor down'); },
    prover: (d) => sign(null, Buffer.from(d, 'utf8'), REFERENCE_PROVER_PRIVATE_PEM),
    writeArtifact: () => {}, extractionRule: 'anthropic-messages-v1', modelParam: 'claude-x',
    vkId: REFERENCE_VK_ID, digestAlg: 'sha256-v1',
  });
  await assert.rejects(() => attestor.invoke('V1', 'p', 'xn', { ballotHash: 'BH', conveningNonce: 'CN' }), /vendor down/);
});
