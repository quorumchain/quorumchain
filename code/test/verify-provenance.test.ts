import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyProvenance } from '../src/verify-provenance.ts';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { requestCommitment } from '../src/attestation.ts';

function unattestedVote(id: string, bh: string) {
  const k = generateValidatorKey();
  return signVote({ validatorId: id, privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r-' + id, attestation: { band: 'unattested', reason: 'NO_BACKEND' } });
}

test('a log of unattested votes reports the band distribution with zero verified-attested', () => {
  const bh = ballotHash('q', 'c');
  const res = verifyProvenance([unattestedVote('V1', bh), unattestedVote('V2', bh), unattestedVote('V3', bh)]);
  assert.equal(res.ok, true); // structurally valid
  assert.equal(res.bandCounts.unattested, 3);
  assert.equal(res.claimedAttested, 0);
  assert.equal(res.verifiedAttested, 0);
  assert.equal(res.reasons.length, 0);
});

test('an attested CLAIM with no artifact is reported PROOF_MISSING (claimed != verified)', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const vote = signVote({
    validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r',
    attestation: { band: 'attested', endpoint: 'api.x', responseHash: 'h', requestCommitment: 'rc' },
  });
  const res = verifyProvenance([vote]); // no hasArtifact resolver -> artifact missing
  assert.equal(res.claimedAttested, 1);
  assert.equal(res.verifiedAttested, 0);
  assert.match(res.reasons.join(' '), /PROOF_MISSING/);
});

test('an attested claim lacking proof substance is PROOF_MISSING even when an artifact resolves true', () => {
  // No proofHash/requestCommitment/responseHash: the verifier must demand the same substance
  // the monitor's hasProvenance requires before crediting verifiedAttested. A resolver that
  // returns true must NOT promote a substance-less claim to verified.
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const vote = signVote({
    validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r',
    attestation: { band: 'attested' },
  });
  const res = verifyProvenance([vote], { hasArtifact: () => true });
  assert.equal(res.claimedAttested, 1);
  assert.equal(res.verifiedAttested, 0);
  assert.match(res.reasons.join(' '), /PROOF_MISSING/);
});

test('an attested claim whose responseHash != rawOutputHash is reported PROOF_INVALID', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const vote = signVote({
    validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r',
    attestation: { band: 'attested', proofHash: 'pf', requestCommitment: 'rc', responseHash: 'WRONG' },
  });
  const res = verifyProvenance([vote], { hasArtifact: () => true });
  assert.equal(res.ok, false);
  assert.match(res.reasons.join(' '), /PROOF_INVALID/);
});

test('an attested claim with a matching responseHash + present artifact is verified-attested', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const rawOutput = 'the model said this';
  const tmp = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput });
  const rc = requestCommitment({ promptHash: 'ph', modelParam: 'm', ballotHash: bh, conveningNonce: 'cn', challengeNonce: 'xn' });
  const vote = signVote({
    validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput, nonce: 'cn',
    attestation: { band: 'attested', proofHash: 'pf', responseHash: tmp.rawOutputHash, requestCommitment: rc },
  });
  const res = verifyProvenance([vote], {
    hasArtifact: () => true,
    expectedRequestCommitment: () => rc,
  });
  assert.equal(res.verifiedAttested, 1);
  assert.equal(res.ok, true);
});

test('an attested claim whose requestCommitment does not match the expected ballot is PROOF_INVALID', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const rawOutput = 'x';
  const tmp = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput });
  const vote = signVote({
    validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput,
    attestation: { band: 'attested', proofHash: 'pf', responseHash: tmp.rawOutputHash, requestCommitment: 'SIGNER_CLAIMED' },
  });
  const res = verifyProvenance([vote], { hasArtifact: () => true, expectedRequestCommitment: () => 'EXPECTED_DIFFERENT' });
  assert.equal(res.ok, false);
  assert.match(res.reasons.join(' '), /requestCommitment/);
});

import { createHash, sign } from 'node:crypto';
import { zkWebProofAttestor } from '../src/zk-web-proof-attestor.ts';
import { referenceProofVerifier } from '../src/zk-web-proof-verifier.ts';
import { REFERENCE_PROVER_PRIVATE_PEM, REFERENCE_VK_ID } from '../src/zk-web-proof.ts';
import type { SignedVote } from '../src/signed-vote.ts';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

async function attestedVote(over: { challengeNonce: string }) {
  const transcriptBody = JSON.stringify({ content: [{ type: 'text', text: `VERDICT: YES\n${over.challengeNonce}` }] });
  const artifacts = new Map<string, Uint8Array>();
  const a = zkWebProofAttestor({
    fetchVendor: async () => ({ transcriptBody, endpoint: 'api.anthropic.com', modelVersion: 'claude-x' }),
    prover: (d) => sign(null, Buffer.from(d, 'utf8'), REFERENCE_PROVER_PRIVATE_PEM),
    writeArtifact: (h, b) => artifacts.set(h, b),
    extractionRule: 'anthropic-messages-v1', modelParam: 'claude-x', vkId: REFERENCE_VK_ID, digestAlg: 'sha256-v1',
  });
  const r = await a.invoke('V1', 'PROMPT', over.challengeNonce, { ballotHash: 'BH', conveningNonce: 'CN' });
  const vote = {
    validatorId: 'V1', ballotHash: 'BH', verdict: 'YES', rawOutput: r.rawOutput,
    rawOutputHash: sha(r.rawOutput), signature: 's', attestation: r.attestation,
  } as unknown as SignedVote;
  return { vote, artifacts, transcriptBody };
}

test('a genuine attested vote verifies (re-derived) and surfaces backend + vkId', async () => {
  const { vote, artifacts, transcriptBody } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote], {
    resolveArtifact: (v) => artifacts.get(v.attestation!.proofHash!),
    resolveTranscript: () => transcriptBody,
    verifierFor: (kind) => (kind === 'fixture-prover-signature' ? referenceProofVerifier() : undefined),
  });
  assert.equal(r.ok, true);
  assert.equal(r.verifiedAttested, 1);
  assert.ok(r.reasons.some((x) => x.includes('verified-attested') && x.includes('fixture-prover-signature') && x.includes('ref-ecdsa-v0') && x.includes('re-derived')));
});

test('verified proof-only (no transcript) still counts but is labelled proof-only', async () => {
  const { vote, artifacts } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote], {
    resolveArtifact: (v) => artifacts.get(v.attestation!.proofHash!),
    verifierFor: () => referenceProofVerifier(),
  });
  assert.equal(r.verifiedAttested, 1);
  assert.ok(r.reasons.some((x) => x.includes('proof-only')));
});

test('a swapped sidecar artifact fails proofHash integrity (PROOF_INVALID)', async () => {
  const { vote } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote], {
    resolveArtifact: () => new Uint8Array([1, 2, 3]),
    verifierFor: () => referenceProofVerifier(),
  });
  assert.equal(r.ok, false);
  assert.equal(r.verifiedAttested, 0);
  assert.ok(r.reasons.some((x) => x.includes('PROOF_INVALID') && x.includes('proofHash')));
});

test('a tampered transcript fails extraction re-derivation (PROOF_INVALID)', async () => {
  const { vote, artifacts } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote], {
    resolveArtifact: (v) => artifacts.get(v.attestation!.proofHash!),
    resolveTranscript: () => JSON.stringify({ content: [{ type: 'text', text: 'VERDICT: NO\nXN9' }] }),
    verifierFor: () => referenceProofVerifier(),
  });
  assert.equal(r.ok, false);
  assert.ok(r.reasons.some((x) => x.includes('PROOF_INVALID')));
});

test('no resolver supplied = increment-1 behaviour preserved (PROOF_MISSING, ok stays true)', async () => {
  const { vote } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote]);
  assert.equal(r.ok, true);
  assert.equal(r.verifiedAttested, 0);
  assert.ok(r.reasons.some((x) => x.includes('PROOF_MISSING')));
});

test('a verifier whose kind != claimed attestorBackend is rejected (PROOF_INVALID)', async () => {
  const { vote, artifacts } = await attestedVote({ challengeNonce: 'XN9' });
  const r = verifyProvenance([vote], {
    resolveArtifact: (v) => artifacts.get(v.attestation!.proofHash!),
    verifierFor: () => ({ kind: 'some-other-kind', verify: () => ({ ok: true }) }), // mis-wired dispatch
  });
  assert.equal(r.ok, false);
  assert.equal(r.verifiedAttested, 0);
  assert.ok(r.reasons.some((x) => x.includes('PROOF_INVALID') && x.includes('verifier kind')));
});
