import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateValidatorKey, signVote, verifyVote, type SignedVote } from '../src/signed-vote.ts';
import {
  signIssuerArtifact, signTsaTimestamp, verifyIssuerSignature, verifyTimestampProof,
  structurallyAdmissible, anchorGatePasses, type Anchor, type AnchorPolicy,
} from '../src/anchor.ts';

// CIP-15 Phase-1 (Tier-1) anchor verifier — gates GP1a–e + criteria P1a–c (consult 02e3c6cb).
// Every check is hermetic: a pure function of (artifact, pinned policy), no network.

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function setup() {
  const issuerA = generateValidatorKey();   // an audit firm
  const issuerB = generateValidatorKey();   // an oracle network
  const tsa = generateValidatorKey();        // a pinned timestamp authority
  const validator = generateValidatorKey();  // a QRM validator key — must NEVER act as an issuer
  const policy: AnchorPolicy = {
    admissibleTypes: new Set(['signed_institutional_release']),
    issuerKeys: {
      'bdo-audit': { issuerId: 'bdo-audit', origin: 'bdo.global', publicKeyPem: issuerA.publicKeyPem },
      'chainlink-por': { issuerId: 'chainlink-por', origin: 'chain.link', publicKeyPem: issuerB.publicKeyPem },
    },
    tsaKeys: { freetsa: { tsaId: 'freetsa', publicKeyPem: tsa.publicKeyPem } },
    validatorKeyring: { V1: validator.publicKeyPem },
    requiredFamiliesFor: (t) => (t === 'NORMATIVE' ? 0 : 2),
  };
  return { issuerA, issuerB, tsa, validator, policy };
}

type Env = ReturnType<typeof setup>;
function validAnchor(env: Env, o: { issuerId: string; issuerPriv: string; content: string; time: number }): Anchor {
  const contentHash = sha(o.content);
  const anchorType = 'signed_institutional_release';
  return {
    anchorType,
    provenanceClass: 'STRUCTURED',
    issuer: o.issuerId,
    contentHash,
    citedAssertion: 'reserves >= liabilities at par',
    asOf: o.time,
    signature: signIssuerArtifact(o.issuerPriv, { contentHash, issuer: o.issuerId, anchorType }),
    provenanceTrace: [env.policy.issuerKeys[o.issuerId].origin],
    timestampProof: { scheme: 'ED25519_TSA', time: o.time, tsaId: 'freetsa', signature: signTsaTimestamp(env.tsa.privateKeyPem, { contentHash, time: o.time }) },
  };
}

// --- GP1a: a fully-valid Tier-1 anchor is admissible; corrupting any check fails it ---

test('GP1a: valid anchor credited; corrupting content/assertion/type/class fails it', () => {
  const env = setup();
  const a = validAnchor(env, { issuerId: 'bdo-audit', issuerPriv: env.issuerA.privateKeyPem, content: 'AUDIT-2026', time: 100 });
  assert.equal(structurallyAdmissible([a], 50, env.policy).credited.length, 1);
  assert.equal(structurallyAdmissible([{ ...a, contentHash: sha('OTHER') }], 50, env.policy).credited.length, 0); // sig no longer matches
  assert.equal(structurallyAdmissible([{ ...a, citedAssertion: '' }], 50, env.policy).credited.length, 0);
  assert.equal(structurallyAdmissible([{ ...a, anchorType: 'unknown' }], 50, env.policy).credited.length, 0);
  const doc = structurallyAdmissible([{ ...a, provenanceClass: 'DOCUMENT' }], 50, env.policy);
  assert.equal(doc.credited.length, 0);
  assert.equal(doc.deferred.length, 1); // class-2 logged, not dropped (NI-15d)
});

// --- GP1b (P1a): validator keys and issuer keys are non-interchangeable ---

test('GP1b: a validator key cannot act as an issuer, and the two signature domains are disjoint', () => {
  const env = setup();
  // an issuer entry whose key is ALSO a validator key is rejected (cross-trust forbidden)
  const poisoned: AnchorPolicy = { ...env.policy, issuerKeys: { ...env.policy.issuerKeys, evil: { issuerId: 'evil', origin: 'x', publicKeyPem: env.validator.publicKeyPem } } };
  const ch = sha('X');
  const a: Anchor = { anchorType: 'signed_institutional_release', provenanceClass: 'STRUCTURED', issuer: 'evil', contentHash: ch, citedAssertion: 'x', asOf: 1, provenanceTrace: ['x'], signature: signIssuerArtifact(env.validator.privateKeyPem, { contentHash: ch, issuer: 'evil', anchorType: 'signed_institutional_release' }) };
  assert.equal(verifyIssuerSignature(a, poisoned), false);

  // a vote signature does NOT verify as an issuer artifact (domain separation)
  const vote = signVote({ validatorId: 'V1', privateKeyPem: env.validator.privateKeyPem, ballotHash: 'bh', verdict: 'YES', rawOutput: 'r' });
  const a2: Anchor = { anchorType: 'signed_institutional_release', provenanceClass: 'STRUCTURED', issuer: 'bdo-audit', contentHash: sha('z'), citedAssertion: 'z', asOf: 1, provenanceTrace: ['bdo.global'], signature: vote.signature };
  assert.equal(verifyIssuerSignature(a2, env.policy), false);

  // an issuer artifact signature does NOT verify as a vote (reverse direction)
  const isig = signIssuerArtifact(env.issuerA.privateKeyPem, { contentHash: sha('z'), issuer: 'bdo-audit', anchorType: 'signed_institutional_release' });
  const fakeVote: SignedVote = { validatorId: 'V1', ballotHash: 'z', verdict: 'YES', rawOutput: 'r', rawOutputHash: sha('r'), signature: isig };
  assert.equal(verifyVote(fakeVote, env.issuerA.publicKeyPem), false);
});

// --- GP1c (NI-15f): surfacedAt must come from a verifiable timestamp proof, after the head ---

test('GP1c: timestamp proof grounds surfacedAt; self-asserted / unimplemented / pre-head are not credited', () => {
  const env = setup();
  const base = validAnchor(env, { issuerId: 'bdo-audit', issuerPriv: env.issuerA.privateKeyPem, content: 'A', time: 100 });
  assert.equal(structurallyAdmissible([base], 50, env.policy).credited.length, 1);   // surfaced 100 > head 50
  assert.equal(structurallyAdmissible([base], 150, env.policy).credited.length, 0);  // surfaced 100 ≤ head 150 → already available
  assert.equal(structurallyAdmissible([{ ...base, timestampProof: undefined }], 50, env.policy).credited.length, 0); // self-asserted only
  const ots: Anchor = { ...base, timestampProof: { scheme: 'OTS_BITCOIN', time: 100 } };
  assert.equal(structurallyAdmissible([ots], 50, env.policy).credited.length, 0);    // adapter not implemented → deferral-not-denial
  assert.equal(verifyTimestampProof({ ...base, timestampProof: { ...base.timestampProof!, time: 999 } }, env.policy).ok, false); // tampered time breaks sig
});

// --- GP1d (P1b): every result carries the honest verification-class label ---

test('GP1d: result is labeled tier1_structural_anchor_only and never content-verified', () => {
  const env = setup();
  const a = validAnchor(env, { issuerId: 'bdo-audit', issuerPriv: env.issuerA.privateKeyPem, content: 'A', time: 100 });
  const r = structurallyAdmissible([a], 50, env.policy);
  assert.equal(r.label, 'tier1_structural_anchor_only');
  assert.equal(r.contentVerified, false);
});

// --- GP1e (NI-15g): distinct pinned issuer-origins = distinct families; same origin = one ---

test('GP1e: families counted by verified origin (origin-not-key); requiredFamilies>=2 reachable now', () => {
  const env = setup();
  const a1 = validAnchor(env, { issuerId: 'bdo-audit', issuerPriv: env.issuerA.privateKeyPem, content: 'A', time: 100 });
  const a2 = validAnchor(env, { issuerId: 'chainlink-por', issuerPriv: env.issuerB.privateKeyPem, content: 'B', time: 110 });
  assert.equal(structurallyAdmissible([a1, a2], 50, env.policy).families, 2);
  const a3 = validAnchor(env, { issuerId: 'bdo-audit', issuerPriv: env.issuerA.privateKeyPem, content: 'C', time: 120 });
  assert.equal(structurallyAdmissible([a1, a3], 50, env.policy).families, 1); // same origin collapses

  assert.equal(anchorGatePasses([a1], 50, 'EMPIRICAL_LIVE', env.policy), false);     // 1 family < 2
  assert.equal(anchorGatePasses([a1, a2], 50, 'EMPIRICAL_LIVE', env.policy), true);  // 2 distinct families
  assert.equal(anchorGatePasses([], 50, 'NORMATIVE', env.policy), true);             // conventional needs 0
});
