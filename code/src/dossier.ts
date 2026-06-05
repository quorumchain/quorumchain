// Quorumchain ($QRM) — CIP-10 adversarial-auditor contrary-evidence dossier (spec §4).
// A SIGNED artifact (Ed25519 by the auditor's validator key), recorded alongside the ballot,
// NEVER counted in the tally (descriptive-only, CIP-12 NI-12b). Zero dependencies.

import type { AssessedWeight, FalsificationCondition } from './commons.ts';

export interface ContraryAnchor { source: string; anchorType: string; claimItContradicts: string }
export interface SearchedRejectedAnchor { source: string; whyRejected: string }

export interface ContraryDossier {
  ballotHash: string;
  auditorId: string;
  contraryAnchors: ContraryAnchor[];          // each must clear the symmetric anchor bar (NI-AA4)
  searchedRejectedAnchors: SearchedRejectedAnchor[]; // suppression audit-trail (NI-AA8)
  assessedWeight: AssessedWeight;              // NEGLIGIBLE is first-class (NI-AA5)
  falsificationConditions: FalsificationCondition[]; // structured CIP-13 bridge
  negligibleCoSigners: string[];              // required iff NEGLIGIBLE on an eligible class (NI-AA8)
  signature: string;                          // hex Ed25519 over dossierPayload (NI-AA2 — artifact, not vote)
}

export function emptyDossier(ballotHash: string, auditorId: string): ContraryDossier {
  return {
    ballotHash, auditorId,
    contraryAnchors: [], searchedRejectedAnchors: [],
    assessedWeight: 'NEGLIGIBLE', falsificationConditions: [], negligibleCoSigners: [],
    signature: '',
  };
}

import { createHash, sign as edSign, verify as edVerify, createPrivateKey, createPublicKey } from 'node:crypto';

const DOMAIN = 'QRM-CONTRARY-DOSSIER-v1';

// Canonical, order-independent projection of the SIGNED content (excludes `signature`).
// Arrays are sorted on a stable key and strings NFC-normalized, mirroring anchorCommitment.
export function dossierPayload(d: ContraryDossier): string {
  const anchors = d.contraryAnchors
    .map((a) => ({ source: a.source.normalize('NFC'), anchorType: a.anchorType.normalize('NFC'), claimItContradicts: a.claimItContradicts.normalize('NFC') }))
    .sort((x, y) => (x.source + x.claimItContradicts < y.source + y.claimItContradicts ? -1 : 1));
  const rejected = d.searchedRejectedAnchors
    .map((r) => ({ source: r.source.normalize('NFC'), whyRejected: r.whyRejected.normalize('NFC') }))
    .sort((x, y) => (x.source + x.whyRejected < y.source + y.whyRejected ? -1 : 1));
  const conditions = d.falsificationConditions
    .map((f) => ({ towardVerdict: f.towardVerdict.normalize('NFC'), requiredAnchoredEvidence: f.requiredAnchoredEvidence.normalize('NFC') }))
    .sort((x, y) => (x.towardVerdict + x.requiredAnchoredEvidence < y.towardVerdict + y.requiredAnchoredEvidence ? -1 : 1));
  const coSigners = [...d.negligibleCoSigners].sort();
  return JSON.stringify({
    domain: DOMAIN,
    ballotHash: d.ballotHash,
    auditorId: d.auditorId,
    contraryAnchors: anchors,
    searchedRejectedAnchors: rejected,
    assessedWeight: d.assessedWeight,
    falsificationConditions: conditions,
    negligibleCoSigners: coSigners,
  });
}

export function dossierHash(d: ContraryDossier): string {
  return createHash('sha256').update(dossierPayload(d), 'utf8').digest('hex');
}

export function signDossier(d: ContraryDossier, privateKeyPem: string): ContraryDossier {
  const sig = edSign(null, Buffer.from(dossierPayload(d), 'utf8'), createPrivateKey(privateKeyPem));
  return { ...d, signature: sig.toString('hex') };
}

export function verifyDossier(d: ContraryDossier, publicKeyPem: string): boolean {
  if (!d.signature) return false;
  try {
    return edVerify(null, Buffer.from(dossierPayload(d), 'utf8'), createPublicKey(publicKeyPem), Buffer.from(d.signature, 'hex'));
  } catch {
    return false;
  }
}
