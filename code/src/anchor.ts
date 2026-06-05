// Quorumchain ($QRM) — CIP-15 Phase-1 (Tier-1) anchor verifier (consult-ratified 02e3c6cb).
//
// Replaces CIP-13's unverified `newAnchor:boolean` re-adjudication gate with a typed anchor
// object whose STRUCTURAL admissibility is checked OFFLINE — a pure function of (artifact,
// pinned policy), no network. Only the proposer fetches the artifact (at proposal time); the
// verifier checks supplied bytes/signatures/timestamps against PINNED trust roots. Content
// truth / relevance / live-source reputation are NOT verified here — that is Tier-3 (testnet).
//
// Phase-1 reuses QRM's existing Ed25519 primitive (node:crypto sign/verify, as in signed-vote.ts)
// but keeps issuer/TSA trust roots STRICTLY separate from the validator keyring, with a
// domain-separation prefix in each signed payload (P1a) so a validator vote can never verify as
// an issuer/TSA signature or vice-versa. Zero dependencies beyond node:crypto.

import { sign as cryptoSign, verify as cryptoVerify, createPrivateKey, createPublicKey, createHash } from 'node:crypto';

export type ProvenanceClass = 'STRUCTURED' | 'DOCUMENT';

// Timestamp-proof scheme. ED25519_TSA is implemented in Phase-1 (a pinned TSA signs
// (contentHash, time)); OTS_BITCOIN / RFC3161_CMS are recognized but their adapters are Tier-1.5
// — an anchor carrying one is NOT credited yet (deferral-not-denial, NI-15d), never silently passed.
export type TimestampScheme = 'ED25519_TSA' | 'OTS_BITCOIN' | 'RFC3161_CMS';

export interface TimestampProof {
  scheme: TimestampScheme;
  time: number; // the attested availability time — TSA-signed, NOT proposer-trusted (NI-15f)
  tsaId?: string; // which pinned TSA attested (ED25519_TSA)
  signature?: string; // hex Ed25519 over the TSA payload (ED25519_TSA)
}

export interface Anchor {
  anchorType: string; // must ∈ policy.admissibleTypes (the CIP-4 frozen policy)
  provenanceClass: ProvenanceClass;
  issuer: string; // pinned issuer id (looked up in policy.issuerKeys)
  contentHash: string; // sha256 hex of the exact cited artifact (NI-15a)
  citedAssertion: string; // the specific supersede claim this anchor supports (NI-15a)
  asOf: number | string; // content/effective date — staleness + family reasoning only, never the gate
  signature?: string; // hex Ed25519 over the issuer artifact payload
  provenanceTrace?: string[]; // upstream origins; in Tier-1 the verified issuer origin is the root
  timestampProof?: TimestampProof;
  surfacedAt?: number; // set ONLY by the verifier from a valid proof (never read from proposer input for credit)
}

export interface IssuerKey { issuerId: string; origin: string; publicKeyPem: string; }
export interface TsaKey { tsaId: string; publicKeyPem: string; }

export interface AnchorPolicy {
  admissibleTypes: Set<string>;
  issuerKeys: Record<string, IssuerKey>; // issuerId -> pinned key (CIP-4 policy)
  tsaKeys: Record<string, TsaKey>; // tsaId -> pinned TSA key (the surfacedAt trust root, P1c)
  validatorKeyring: Record<string, string>; // P1a: NO issuer/TSA key may also appear here
  requiredFamiliesFor: (epistemicType: string) => number; // CIP-11 N (NORMATIVE=0; empirical ≥2/≥1 floor)
}

export interface AdmissibleResult {
  credited: Anchor[]; // STRUCTURED anchors passing every offline check (surfacedAt filled in)
  deferred: Anchor[]; // DOCUMENT class or recognized-but-unimplemented scheme — logged (NI-15d)
  rejected: Anchor[]; // STRUCTURED anchors that failed a structural check
  families: number; // distinct VERIFIED origins among credited (NI-15g, origin-not-key)
  label: 'tier1_structural_anchor_only'; // P1b: honest verification class
  contentVerified: false; // P1b/NI-15b: structural pass is NEVER content-confirmed
}

// Domain-separation prefixes (P1a / P1c): a distinct context per signature purpose, so the byte
// strings a validator/issuer/TSA sign are pairwise disjoint and non-replayable across domains.
const ANCHOR_ARTIFACT_DOMAIN = 'QRM-ANCHOR-ARTIFACT-v1';
const ANCHOR_TSA_DOMAIN = 'QRM-ANCHOR-TSA-v1';

const sha256hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');
const isHash = (s: string): boolean => /^[0-9a-f]{64}$/.test(s);

/** The exact bytes an issuer signs over its artifact — domain-tagged, structurally disjoint from
 *  signed-vote's votePayload so the two can never cross-verify (P1a). */
export function issuerPayload(a: { contentHash: string; issuer: string; anchorType: string }): string {
  return JSON.stringify({ domain: ANCHOR_ARTIFACT_DOMAIN, contentHash: a.contentHash, issuer: a.issuer, anchorType: a.anchorType });
}
function tsaPayload(p: { contentHash: string; time: number }): string {
  return JSON.stringify({ domain: ANCHOR_TSA_DOMAIN, contentHash: p.contentHash, time: p.time });
}

/** Issuer side (proposer/issuer tooling): sign an artifact commitment with the issuer's key. */
export function signIssuerArtifact(privateKeyPem: string, a: { contentHash: string; issuer: string; anchorType: string }): string {
  return cryptoSign(null, Buffer.from(issuerPayload(a), 'utf8'), createPrivateKey(privateKeyPem)).toString('hex');
}
/** TSA side: sign (contentHash, time) so surfacedAt is attested, not self-declared (P1c). */
export function signTsaTimestamp(privateKeyPem: string, p: { contentHash: string; time: number }): string {
  return cryptoSign(null, Buffer.from(tsaPayload(p), 'utf8'), createPrivateKey(privateKeyPem)).toString('hex');
}

/** Recompute the content hash over supplied artifact bytes (NI-15a). */
export function contentHashMatches(artifactBytes: string, contentHash: string): boolean {
  return sha256hex(artifactBytes) === contentHash;
}

/** P1a: verify the issuer's Ed25519 signature against the PINNED issuer key. Rejects any issuer
 *  whose key also appears in the validator keyring (no cross-trust), and (via domain separation)
 *  any signature not produced over the issuer artifact payload. */
export function verifyIssuerSignature(a: Anchor, policy: AnchorPolicy): boolean {
  if (!a.signature) return false;
  const key = policy.issuerKeys[a.issuer];
  if (!key) return false;
  if (Object.values(policy.validatorKeyring).includes(key.publicKeyPem)) return false; // P1a cross-trust guard
  try {
    return cryptoVerify(null, Buffer.from(issuerPayload({ contentHash: a.contentHash, issuer: a.issuer, anchorType: a.anchorType }), 'utf8'), createPublicKey(key.publicKeyPem), Buffer.from(a.signature, 'hex'));
  } catch {
    return false;
  }
}

/** P1c / NI-15f: verify the timestamp proof and return the attested time. ED25519_TSA is real in
 *  Phase-1; other schemes are recognized but not yet verifiable → {ok:false} (deferral-not-denial). */
export function verifyTimestampProof(a: Anchor, policy: AnchorPolicy): { ok: boolean; time?: number } {
  const p = a.timestampProof;
  if (!p) return { ok: false };
  if (p.scheme !== 'ED25519_TSA') return { ok: false }; // OTS_BITCOIN / RFC3161_CMS adapters = Tier-1.5
  if (!p.tsaId || !p.signature || typeof p.time !== 'number') return { ok: false };
  const tsa = policy.tsaKeys[p.tsaId];
  if (!tsa) return { ok: false };
  if (Object.values(policy.validatorKeyring).includes(tsa.publicKeyPem)) return { ok: false }; // domain hygiene
  try {
    const ok = cryptoVerify(null, Buffer.from(tsaPayload({ contentHash: a.contentHash, time: p.time }), 'utf8'), createPublicKey(tsa.publicKeyPem), Buffer.from(p.signature, 'hex'));
    return ok ? { ok: true, time: p.time } : { ok: false };
  } catch {
    return { ok: false };
  }
}

/** The Tier-1 structural verifier. Hermetic and deterministic. `headAdjudicationTime` is when the
 *  superseded head sealed (NI-15f surfacing-monotonicity input). Families count distinct VERIFIED
 *  issuer ORIGINS among credited anchors (NI-15g — origin, not key). NEVER asserts content truth. */
export function structurallyAdmissible(anchors: Anchor[], headAdjudicationTime: number, policy: AnchorPolicy): AdmissibleResult {
  const credited: Anchor[] = [];
  const deferred: Anchor[] = [];
  const rejected: Anchor[] = [];
  for (const a of anchors) {
    if (a.provenanceClass !== 'STRUCTURED') { deferred.push(a); continue; } // class-2 logged (NI-15d)
    if (!policy.admissibleTypes.has(a.anchorType)) { rejected.push(a); continue; }
    if (!isHash(a.contentHash) || !a.citedAssertion) { rejected.push(a); continue; } // NI-15a
    if (!verifyIssuerSignature(a, policy)) { rejected.push(a); continue; }
    const ts = verifyTimestampProof(a, policy);
    if (!ts.ok || ts.time === undefined) { deferred.push(a); continue; } // unverifiable timestamp → deferred, not credited
    if (!(ts.time > headAdjudicationTime)) { rejected.push(a); continue; } // NI-15f: must surface AFTER the head sealed
    credited.push({ ...a, surfacedAt: ts.time });
  }
  const roots = new Set(credited.map((a) => policy.issuerKeys[a.issuer].origin)); // NI-15g: verified origin = family root
  return { credited, deferred, rejected, families: roots.size, label: 'tier1_structural_anchor_only', contentVerified: false };
}

/** The structural gate the lineage's reviewAdmissible() will call: do the cited anchors meet the
 *  per-type independent-family requirement? NORMATIVE needs none (conventional). This grants
 *  REVIEW admission only — it never moves the lineage head (NI-15b; head moves on CONTENT_CONFIRMED). */
export function anchorGatePasses(anchors: Anchor[], headAdjudicationTime: number, epistemicType: string, policy: AnchorPolicy): boolean {
  const need = policy.requiredFamiliesFor(epistemicType);
  if (need === 0) return true;
  return structurallyAdmissible(anchors, headAdjudicationTime, policy).families >= need;
}
