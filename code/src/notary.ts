// Quorumchain ($QRM) — CIP-8 v0.1 NOTARY-mode kernel.
// The Staked Resolvable Attestation (SRA) read at the "act" time: a signed,
// hash-chained, attributable record of a consequential action. This is the
// existing CIP-3 substrate (signed-vote + hash-chained log) productized for
// attestations, per CIP-8 §6/§8 — the smallest runnable slice.
//
// HARD INVARIANT — NI-8a (CIP-8 §9.8): a notary record asserts authorship +
// timing + non-repudiation ONLY, never content-truth. There is no code path in
// this module that can label a record "verified". The checks below establish
// only that a record is ADMISSIBLE as a non-repudiable notary entry
// (attributable, complete, internally consistent) — not that its claim is true.
// Zero dependencies — Node built-in crypto only.

import {
  createHash,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPublicKey,
  createPrivateKey,
} from 'node:crypto';
import { appendFileSync, readFileSync, existsSync } from 'node:fs';

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export interface AttestationPayload {
  action: string;
  evidenceCommitments: string[]; // sha256 hashes; content may stay off-chain/encrypted
  policyVersion: string;
  confidence?: number;
}

export interface Attestation {
  subject: string; // Ed25519 public key (PEM) of the bonded identity
  mode: 'NOTARY'; // v0.1 is notary-only
  status: 'NOT_VERIFIED'; // NI-8a — structurally the only possible value
  ballotHash: string | null; // null for non-resolvable notary-only records (§2)
  payload: AttestationPayload;
  timestamp: string; // ISO-8601, supplied by the caller
  signature: string; // hex, Ed25519 over the canonical attestation bytes
}

// The exact bytes a signature commits to. Includes mode + status so the NI-8a
// label and the notary mode cannot be altered after signing.
function attestationPayload(a: Omit<Attestation, 'signature'>): string {
  return JSON.stringify({
    subject: a.subject,
    mode: a.mode,
    status: a.status,
    ballotHash: a.ballotHash,
    payload: a.payload,
    timestamp: a.timestamp,
  });
}

export function createAttestation(params: {
  subjectPublicKeyPem: string;
  subjectPrivateKeyPem: string;
  action: string;
  evidenceCommitments: string[];
  policyVersion: string;
  ballotHash?: string | null;
  confidence?: number;
  timestamp: string;
}): Attestation {
  // NI-8a: mode and status are fixed here; callers cannot set them to anything else.
  const unsigned: Omit<Attestation, 'signature'> = {
    subject: params.subjectPublicKeyPem,
    mode: 'NOTARY',
    status: 'NOT_VERIFIED',
    ballotHash: params.ballotHash ?? null,
    payload: {
      action: params.action,
      evidenceCommitments: params.evidenceCommitments,
      policyVersion: params.policyVersion,
      ...(params.confidence !== undefined ? { confidence: params.confidence } : {}),
    },
    timestamp: params.timestamp,
  };
  const signature = cryptoSign(
    null,
    Buffer.from(attestationPayload(unsigned), 'utf8'),
    createPrivateKey(params.subjectPrivateKeyPem),
  ).toString('hex');
  return { ...unsigned, signature };
}

/** True iff the signature binds this exact record to the subject's key AND the
 *  NI-8a label/mode are intact. Never asserts the claim's truth. */
export function verifyAttestation(att: Attestation): boolean {
  try {
    if (att.status !== 'NOT_VERIFIED' || att.mode !== 'NOTARY') return false;
    const { signature, ...unsigned } = att;
    return cryptoVerify(
      null,
      Buffer.from(attestationPayload(unsigned), 'utf8'),
      createPublicKey(att.subject),
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}

export interface NotaryCheck {
  label: 'NOT_VERIFIED'; // NI-8a — the only label this kernel can ever emit
  attributable: boolean; // signature non-repudiably binds to the subject key
  complete: boolean; // all required fields present
  consistent: boolean; // signature valid + evidence commitments well-formed
  accepted: boolean; // admissible as a notary record (NOT "true")
  reasons: string[];
}

const SHA256_HEX = /^[0-9a-f]{64}$/;

/** The machine-scale notary check (CIP-8 §3): procedural completeness, internal
 *  consistency, and plausible attributability. It does NOT — and structurally
 *  cannot — assess whether the underlying claim is true (NI-8a). */
export function checkAttestation(att: Attestation): NotaryCheck {
  const reasons: string[] = [];

  // completeness — required fields present and non-empty
  const missing: string[] = [];
  if (!att.subject) missing.push('subject');
  if (!att.payload?.action) missing.push('action');
  if (!att.payload?.policyVersion) missing.push('policyVersion');
  if (!att.timestamp) missing.push('timestamp');
  if (!att.signature) missing.push('signature');
  if (!Array.isArray(att.payload?.evidenceCommitments)) missing.push('evidenceCommitments');
  const complete = missing.length === 0;
  for (const m of missing) reasons.push(`incomplete: missing ${m}`);

  // attributability — the record is bound to the subject's key by a valid signature
  const attributable = verifyAttestation(att);
  if (!attributable) reasons.push('not attributable: signature does not bind to subject key (or label/mode altered)');

  // consistency — evidence commitments are well-formed sha256 digests
  const commitments = Array.isArray(att.payload?.evidenceCommitments) ? att.payload.evidenceCommitments : [];
  const malformed = commitments.filter((c) => !SHA256_HEX.test(c));
  const consistent = attributable && malformed.length === 0;
  if (malformed.length) reasons.push(`inconsistent: ${malformed.length} evidence commitment(s) are not sha256 hex`);
  if (commitments.length === 0) reasons.push('note: no evidence commitments (non-repudiation only)');

  return {
    label: 'NOT_VERIFIED',
    attributable,
    complete,
    consistent,
    accepted: attributable && complete && consistent,
    reasons,
  };
}

// --- Hash-chained attestation log (mirrors the proven CIP-3 vote-log pattern;
// kept separate so the live vote pipeline stays untouched). ---

const GENESIS = '0'.repeat(64);

export interface AttestationLogEntry {
  attestation: Attestation;
  prevHash: string;
  entryHash: string;
}

function computeEntryHash(prevHash: string, att: Attestation): string {
  return sha256hex(prevHash + JSON.stringify(att));
}

export function readAttestationLog(path: string): AttestationLogEntry[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  if (!txt) return [];
  return txt.split('\n').map((line) => JSON.parse(line) as AttestationLogEntry);
}

export function appendAttestation(path: string, att: Attestation): AttestationLogEntry {
  const entries = readAttestationLog(path);
  const prevHash = entries.length ? entries[entries.length - 1].entryHash : GENESIS;
  const entry: AttestationLogEntry = { attestation: att, prevHash, entryHash: computeEntryHash(prevHash, att) };
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return entry;
}

export function verifyAttestationLog(path: string): { valid: boolean; brokenAt?: number } {
  const entries = readAttestationLog(path);
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return { valid: false, brokenAt: i };
    if (e.entryHash !== computeEntryHash(e.prevHash, e.attestation)) return { valid: false, brokenAt: i };
    prev = e.entryHash;
  }
  return { valid: true };
}
