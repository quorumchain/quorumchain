import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVENANCE_BANDS,
  ATTEST_REASONS,
  isProvenanceBand,
  isAttestReason,
  type Attestation,
  canonicalAttestation,
} from '../src/attestation.ts';

test('the provenance band set is exactly the four spec bands', () => {
  assert.deepEqual([...PROVENANCE_BANDS].sort(), ['attested', 'degraded', 'unattested', 'unavailable']);
});

test('the attest-reason set is exactly the six spec reasons', () => {
  assert.deepEqual(
    [...ATTEST_REASONS].sort(),
    ['ATTESTOR_TIMEOUT', 'BACKEND_DOWN', 'NO_BACKEND', 'PROOF_FAILED', 'PROOF_INVALID', 'PROOF_MISSING'],
  );
});

test('isProvenanceBand / isAttestReason reject unknown tokens', () => {
  assert.equal(isProvenanceBand('unattested'), true);
  assert.equal(isProvenanceBand('bogus'), false);
  assert.equal(isAttestReason('NO_BACKEND'), true);
  assert.equal(isAttestReason('WHATEVER'), false);
});

test('an Attestation value type-checks for the unattested shape', () => {
  const a: Attestation = { band: 'unattested', reason: 'NO_BACKEND' };
  assert.equal(a.band, 'unattested');
});

test('canonicalAttestation sorts keys lexicographically and omits undefined', () => {
  const a: Attestation = { band: 'attested', endpoint: 'api.anthropic.com', requestId: undefined, modelVersion: 'claude-x' };
  const c = canonicalAttestation(a);
  assert.deepEqual(Object.keys(c), ['band', 'endpoint', 'modelVersion']); // sorted; requestId (undefined) omitted; no reason on attested
  assert.equal(JSON.stringify(c), '{"band":"attested","endpoint":"api.anthropic.com","modelVersion":"claude-x"}');
});

test('canonicalAttestation closes non-attested bands to band + reason only (rejects extras)', () => {
  assert.deepEqual(canonicalAttestation({ band: 'degraded', reason: 'ATTESTOR_TIMEOUT' } as Attestation), {
    band: 'degraded',
    reason: 'ATTESTOR_TIMEOUT',
  });
  assert.throws(
    () => canonicalAttestation({ band: 'degraded', reason: 'ATTESTOR_TIMEOUT', endpoint: 'api.anthropic.com', proofHash: 'deadbeef' } as unknown as Attestation),
    /unknown attestation field/,
  );
});

test('canonicalAttestation rejects an unknown band', () => {
  assert.throws(() => canonicalAttestation({ band: 'spoofed' } as unknown as Attestation), /unknown provenance band/);
});

test('canonicalAttestation rejects an unknown reason', () => {
  assert.throws(
    () => canonicalAttestation({ band: 'degraded', reason: 'NOPE' } as unknown as Attestation),
    /unknown attest reason/,
  );
});

test('canonicalAttestation rejects an unknown field on an attested envelope', () => {
  assert.throws(
    () => canonicalAttestation({ band: 'attested', bogusField: 'x' } as unknown as Attestation),
    /unknown attestation field/,
  );
});

test('canonicalAttestation requires a reason on non-attested bands', () => {
  assert.throws(() => canonicalAttestation({ band: 'unattested' } as Attestation), /requires a reason/);
});

test('canonicalAttestation rejects unknown fields on a non-attested envelope (closes the envelope, no strip)', () => {
  // An appended field must be a parse error, not silently stripped — else an attacker can
  // ride it on a still-valid signature (the stripped key never enters the signed preimage).
  assert.throws(
    () => canonicalAttestation({ band: 'unattested', reason: 'NO_BACKEND', proofHash: 'x' } as unknown as Attestation),
    /unknown attestation field/,
  );
  assert.throws(
    () => canonicalAttestation({ band: 'degraded', reason: 'ATTESTOR_TIMEOUT', endpoint: 'api.x' } as unknown as Attestation),
    /unknown attestation field/,
  );
});

test('canonicalAttestation rejects a reason on an attested band', () => {
  assert.throws(
    () => canonicalAttestation({ band: 'attested', reason: 'NO_BACKEND' } as Attestation),
    /attested band carries no reason/,
  );
});

import { generateValidatorKey, signVote, verifyVote, ballotHash } from '../src/signed-vote.ts';

test('a vote signed WITHOUT an attestation is byte-identical to the legacy payload and verifies', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r' });
  assert.equal(vote.attestation, undefined);
  assert.equal(verifyVote(vote, k.publicKeyPem), true);
  const k2 = generateValidatorKey();
  const a = signVote({ validatorId: 'V1', privateKeyPem: k2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r', nonce: 'n1' });
  assert.equal(a.nonce, 'n1');
  assert.equal(verifyVote(a, k2.publicKeyPem), true); // nonce-only legacy path unaffected
});

test('an attestation is signed into the vote and any field mutation breaks the signature', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const att = { band: 'unattested', reason: 'NO_BACKEND' } as const;
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r', attestation: att });
  assert.deepEqual(vote.attestation, { band: 'unattested', reason: 'NO_BACKEND' });
  assert.equal(verifyVote(vote, k.publicKeyPem), true);
  const tamperedBand = { ...vote, attestation: { band: 'attested' as const } };
  assert.equal(verifyVote(tamperedBand, k.publicKeyPem), false);
  const tamperedReason = { ...vote, attestation: { band: 'unattested' as const, reason: 'BACKEND_DOWN' as const } };
  assert.equal(verifyVote(tamperedReason, k.publicKeyPem), false);
  const stripped: typeof vote = { ...vote };
  delete (stripped as { attestation?: unknown }).attestation;
  assert.equal(verifyVote(stripped, k.publicKeyPem), false);
});

test('appending a field to a non-attested vote fails verifyVote (returns false, does not throw)', () => {
  // canonicalAttestation now throws on the injected key when verifyVote rebuilds the preimage;
  // verifyVote must catch that and return false — not propagate the throw.
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r', attestation: { band: 'unattested', reason: 'NO_BACKEND' } });
  const tampered = { ...vote, attestation: { ...vote.attestation, proofHash: 'fake' } as Attestation };
  let result: boolean | undefined;
  assert.doesNotThrow(() => { result = verifyVote(tampered, k.publicKeyPem); });
  assert.equal(result, false);
});

test('an attested envelope round-trips its proof fields through signing', () => {
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const att = { band: 'attested', endpoint: 'api.anthropic.com', requestCommitment: 'rc', responseHash: 'rh' } as const;
  const vote = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r', attestation: att });
  assert.equal(verifyVote(vote, k.publicKeyPem), true);
  assert.deepEqual(Object.keys(vote.attestation!).sort(), ['band', 'endpoint', 'requestCommitment', 'responseHash']);
});

import { requestCommitment } from '../src/attestation.ts';

test('requestCommitment is deterministic and binds every component', () => {
  const base = { promptHash: 'ph', modelParam: 'claude-x', ballotHash: 'bh', conveningNonce: 'cn', challengeNonce: 'xn' };
  const c = requestCommitment(base);
  assert.equal(c, requestCommitment({ ...base })); // deterministic
  assert.match(c, /^[0-9a-f]{64}$/);
  assert.notEqual(c, requestCommitment({ ...base, promptHash: 'PH2' }));
  assert.notEqual(c, requestCommitment({ ...base, modelParam: 'cheaper' }));
  assert.notEqual(c, requestCommitment({ ...base, ballotHash: 'bh2' }));
  assert.notEqual(c, requestCommitment({ ...base, conveningNonce: 'cn2' }));
  assert.notEqual(c, requestCommitment({ ...base, challengeNonce: 'xn2' }));
});

test('canonicalAttestation rejects a non-string value on an attested field (codex MAJOR-1)', () => {
  // null / number / array / nested-object must NOT be assignable into a string field — that
  // would break the deterministic sorted-string serialization the signature commits to.
  assert.throws(() => canonicalAttestation({ band: 'attested', proofHash: null } as unknown as Attestation), /must be a string/);
  assert.throws(() => canonicalAttestation({ band: 'attested', requestId: 7 } as unknown as Attestation), /must be a string/);
  assert.throws(() => canonicalAttestation({ band: 'attested', endpoint: ['a'] } as unknown as Attestation), /must be a string/);
  assert.throws(() => canonicalAttestation({ band: 'attested', responseHash: { x: 1 } } as unknown as Attestation), /must be a string/);
});

test('signing is deterministic — a no-attestation vote yields a byte-identical signature, and an attestation changes it', () => {
  // Ed25519 is deterministic (RFC 8032): same payload + key => same signature. So identical
  // signatures across two signings proves the no-attestation PREIMAGE is byte-stable (the
  // load-bearing legacy-compat invariant), and a differing signature proves the attestation
  // genuinely entered the signed payload.
  const k = generateValidatorKey();
  const bh = ballotHash('q', 'c');
  const a1 = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r' });
  const a2 = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r' });
  assert.equal(a1.signature, a2.signature); // byte-identical preimage
  const withAtt = signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'r', attestation: { band: 'unattested', reason: 'NO_BACKEND' } });
  assert.notEqual(a1.signature, withAtt.signature); // attestation is covered by the signature
});

test('an attested envelope round-trips vkId + digestAlg through canonicalAttestation', () => {
  const a = { band: 'attested', vkId: 'ref-ecdsa-v0', digestAlg: 'sha256-v1', proofHash: 'p', requestCommitment: 'rc', responseHash: 'rh' } as const;
  const c = canonicalAttestation(a as unknown as import('../src/attestation.ts').Attestation);
  assert.equal(c.vkId, 'ref-ecdsa-v0');
  assert.equal(c.digestAlg, 'sha256-v1');
  assert.deepEqual(Object.keys(c), [...Object.keys(c)].sort()); // still sorted
});

test('vkId/digestAlg are rejected on a non-attested band (whitelist closed)', () => {
  assert.throws(
    () => canonicalAttestation({ band: 'unattested', reason: 'NO_BACKEND', vkId: 'x' } as unknown as import('../src/attestation.ts').Attestation),
    /unknown attestation field/,
  );
});
