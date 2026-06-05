import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { buildClaimIndex, queryClaim, type BallotMeta } from '../src/commons.ts';
import { signIssuerArtifact, signTsaTimestamp, type Anchor, type AnchorPolicy } from '../src/anchor.ts';
import { viewClaim } from '../src/commons-read.ts';
import { renderClaimMarkdown } from '../src/commons-render.ts';

// CIP-15 slice 2 — the lineage gate split (NI-15b) wired through buildClaimIndex: an
// empirical/settled supersede that clears the STRUCTURAL anchor gate is admitted to content
// review (lineage.pendingReview) but does NOT move the head; the head moves only on
// contentConfirmed (the deferred testnet content layer). NORMATIVE still promotes on ratification.

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function unanimous(bh: string, verdict: string): SignedVote[] {
  return (['V1', 'V2', 'V3'] as const).map((id) => signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id}:${verdict}` }));
}

// a real pinned anchor policy: two distinct issuers (two families) + one TSA; empirical needs 2 families
const issuerA = generateValidatorKey();
const issuerB = generateValidatorKey();
const tsa = generateValidatorKey();
const POLICY: AnchorPolicy = {
  admissibleTypes: new Set(['signed_institutional_release']),
  issuerKeys: {
    A: { issuerId: 'A', origin: 'audit.example', publicKeyPem: issuerA.publicKeyPem },
    B: { issuerId: 'B', origin: 'oracle.example', publicKeyPem: issuerB.publicKeyPem },
  },
  tsaKeys: { t: { tsaId: 't', publicKeyPem: tsa.publicKeyPem } },
  validatorKeyring: keyring,
  requiredFamiliesFor: (t) => (t === 'NORMATIVE' ? 0 : 2),
};

// a fully-valid anchor (signed by `issuer`, TSA-timestamped at `time`)
function anchor(issuerId: 'A' | 'B', issuerPriv: string, content: string, time: number): Anchor {
  const contentHash = sha(content);
  const anchorType = 'signed_institutional_release';
  return {
    anchorType, provenanceClass: 'STRUCTURED', issuer: issuerId, contentHash,
    citedAssertion: 'supersede assertion', asOf: time,
    signature: signIssuerArtifact(issuerPriv, { contentHash, issuer: issuerId, anchorType }),
    provenanceTrace: [POLICY.issuerKeys[issuerId].origin],
    timestampProof: { scheme: 'ED25519_TSA', time, tsaId: 't', signature: signTsaTimestamp(tsa.privateKeyPem, { contentHash, time }) },
  };
}

const twoFamilies = () => [anchor('A', issuerA.privateKeyPem, 'art-A', 1000), anchor('B', issuerB.privateKeyPem, 'art-B', 1000)];

// --- NI-15b: a gate-clearing but unconfirmed empirical supersede is admitted to review, head unchanged ---

test('an empirical supersede that clears the anchor gate but is NOT content-confirmed is pendingReview, head unchanged', () => {
  const B1 = ballotHash('Is X true', 'v1');
  const B2 = ballotHash('Is X true', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, anchors: twoFamilies() }, // no contentConfirmed
  };
  const c1 = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta, {}, POLICY), B1)!;
  assert.equal(c1.lineage.current, B1); // NI-15b: head did NOT move (no content confirmation)
  assert.deepEqual(c1.lineage.pendingReview, [B2]); // admitted to content review
});

// --- the head moves only when content-confirmed (the deferred testnet path) ---

test('the same supersede promotes once content-confirmed (head moves, no longer pending)', () => {
  const B1 = ballotHash('Is X true', 'v1');
  const B2 = ballotHash('Is X true', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, anchors: twoFamilies(), contentConfirmed: true },
  };
  const c1 = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta, {}, POLICY), B1)!;
  assert.equal(c1.lineage.current, B2); // promoted
  assert.deepEqual(c1.lineage.pendingReview, []);
});

// --- insufficient families: not even admitted to review ---

test('an empirical supersede with only one family does not clear the gate (not pendingReview)', () => {
  const B1 = ballotHash('Is X true', 'v1');
  const B2 = ballotHash('Is X true', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, anchors: [anchor('A', issuerA.privateKeyPem, 'only-A', 1000)] },
  };
  const c1 = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta, {}, POLICY), B1)!;
  assert.equal(c1.lineage.current, B1);
  assert.deepEqual(c1.lineage.pendingReview, []); // one family < requiredFamilies(2)
});

// --- NORMATIVE still promotes on ratification (no anchor / no content needed) ---

test('a NORMATIVE supersede still promotes on ratification (no anchor, no content)', () => {
  const B1 = ballotHash('moral q', 'v1');
  const B2 = ballotHash('moral q', 'v2');
  const votes = [...unanimous(B1, 'NO'), ...unanimous(B2, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'NORMATIVE' },
    [B2]: { epistemicType: 'NORMATIVE', supersedes: B1 },
  };
  const c1 = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta, {}, POLICY), B1)!;
  assert.equal(c1.lineage.current, B2);
});

// --- render: the pending-review head shows the honest NI-15b label, head NOT moved ---

test('render: a pending-review head shows the content-verification-pending label and no head move', () => {
  const B1 = ballotHash('Is X true', 'v1');
  const B2 = ballotHash('Is X true', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, anchors: twoFamilies() },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, {}, POLICY);
  const md = renderClaimMarkdown(viewClaim(queryClaim(idx, B1)!, [], true));
  assert.match(md, /pending content verification/i);
  assert.match(md, /content-verification-pending/);
  assert.match(md, /NOT\*\* changed/); // the head has not moved (NI-15b)
});

// --- safe default: with NO anchor policy, an empirical supersede is never admitted ---

test('with no anchor policy supplied, an empirical supersede cannot be credited (head unchanged, nothing pending)', () => {
  const B1 = ballotHash('Is X true', 'v1');
  const B2 = ballotHash('Is X true', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, anchors: twoFamilies(), contentConfirmed: true },
  };
  const c1 = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), B1)!; // no policy (7th arg omitted)
  assert.equal(c1.lineage.current, B1);
  assert.deepEqual(c1.lineage.pendingReview, []);
});
