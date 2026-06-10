import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sign } from 'node:crypto';
import {
  type PublicInputs,
  publicInputsDigest,
  REFERENCE_PROVER_PRIVATE_PEM,
  REFERENCE_VK_ID,
} from '../src/zk-web-proof.ts';
import { referenceProofVerifier } from '../src/zk-web-proof-verifier.ts';

const PI: PublicInputs = {
  requestCommitment: 'rc', transcriptHash: 'th', responseHash: 'rh', challengeNonce: 'xn',
  endpoint: 'api.anthropic.com', modelVersion: 'claude-x', extractionRuleHash: 'erh',
};
function proofFor(pi: PublicInputs): Uint8Array {
  return sign(null, Buffer.from(publicInputsDigest(pi, 'sha256-v1'), 'utf8'), REFERENCE_PROVER_PRIVATE_PEM);
}

test('reference verifier accepts a well-formed proof over the public-input digest', () => {
  const v = referenceProofVerifier();
  assert.equal(v.kind, 'fixture-prover-signature');
  assert.deepEqual(v.verify({ publicInputs: PI, digestAlg: 'sha256-v1', vkId: REFERENCE_VK_ID, artifact: proofFor(PI) }), { ok: true });
});

test('a proof over DIFFERENT public inputs fails (digest binding)', () => {
  const v = referenceProofVerifier();
  const r = v.verify({ publicInputs: { ...PI, responseHash: 'TAMPERED' }, digestAlg: 'sha256-v1', vkId: REFERENCE_VK_ID, artifact: proofFor(PI) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'PROOF_INVALID');
});

test('an unknown vkId is rejected (whitelist)', () => {
  const v = referenceProofVerifier();
  const r = v.verify({ publicInputs: PI, digestAlg: 'sha256-v1', vkId: 'unknown-vk', artifact: proofFor(PI) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'PROOF_INVALID');
});

test('a corrupted artifact fails verification', () => {
  const v = referenceProofVerifier();
  const bad = proofFor(PI); bad[0] ^= 0xff;
  assert.equal(v.verify({ publicInputs: PI, digestAlg: 'sha256-v1', vkId: REFERENCE_VK_ID, artifact: bad }).ok, false);
});
