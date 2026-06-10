// Quorumchain ($QRM) — verify-provenance: the standalone outsider PROVENANCE verifier
// (proof-of-inference §6, increment 1 = REPORTING SHELL). Mirrors verify-anchored.ts: no
// private state, never required for the chain to validate. It distinguishes CLAIMED-attested
// (the signer's band) from VERIFIED-attested (artifact present AND structural checks pass) —
// different trust levels (codex MAJOR-3). Increment 1 checks ONLY structure: taxonomy validity,
// responseHash == rawOutputHash, requestCommitment matches the expected ballot commitment, and
// reports attested-claims lacking an artifact as PROOF_MISSING. It does NOT verify endpoint
// provenance, re-apply extractionRule, or check proof artifacts — that is increment 2.
// Zero dependencies.

import { createHash } from 'node:crypto';
import type { SignedVote } from './signed-vote.ts';
import { isProvenanceBand, isAttestReason, type ProvenanceBand } from './attestation.ts';
import { applyExtractionRule, extractionRuleHash, type ProofVerifier, type PublicInputs } from './zk-web-proof.ts';

export interface VerifyProvenanceResult {
  ok: boolean; // every structural property held (no malformed envelope, no PROOF_INVALID)
  total: number;
  withAttestation: number;
  bandCounts: Record<ProvenanceBand, number>;
  claimedAttested: number;  // votes whose SIGNER band is 'attested'
  verifiedAttested: number; // claimed-attested votes that ALSO pass structure + have an artifact
  reasons: string[];        // per-vote notes: malformed envelopes, PROOF_MISSING, PROOF_INVALID
}

export interface VerifyProvenanceOpts {
  /** Resolve whether the proof artifact for a vote is retrievable. Increment 1 has no resolver,
   *  so the default returns false → every attested claim is PROOF_MISSING (the public log is
   *  descriptive, not externally verifiable). Increment 2 supplies a real resolver. */
  hasArtifact?: (vote: SignedVote) => boolean;
  /** The requestCommitment the ballot a vote is cast on SHOULD carry. When provided, a
   *  mismatch is PROOF_INVALID (the proof must commit THIS ballot, not any fresh response). */
  expectedRequestCommitment?: (vote: SignedVote) => string | undefined;
  /** Increment 2: resolve the proof artifact bytes for a vote (sidecar reader / fixture map). */
  resolveArtifact?: (vote: SignedVote) => Uint8Array | undefined;
  /** Increment 2: resolve the raw transcript body (enables extraction re-derivation). */
  resolveTranscript?: (vote: SignedVote) => string | undefined;
  /** Increment 2: dispatch a ProofVerifier by Attestation.attestorBackend. */
  verifierFor?: (kind: string) => ProofVerifier | undefined;
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function createHashBytes(b: Uint8Array): string {
  return createHash('sha256').update(b).digest('hex');
}

export function verifyProvenance(votes: SignedVote[], opts: VerifyProvenanceOpts = {}): VerifyProvenanceResult {
  const hasArtifact = opts.hasArtifact ?? (() => false);
  const reasons: string[] = [];
  const bandCounts: Record<ProvenanceBand, number> = { attested: 0, unattested: 0, degraded: 0, unavailable: 0 };
  let withAttestation = 0;
  let claimedAttested = 0;
  let verifiedAttested = 0;
  let malformed = false;
  let invalid = false;

  for (const v of votes) {
    const a = v.attestation;
    if (a === undefined) continue; // legacy vote — no provenance claim, nothing to check
    withAttestation++;

    if (!isProvenanceBand(a.band)) {
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: malformed — unknown band ${String(a.band)}`);
      malformed = true;
      continue;
    }
    bandCounts[a.band]++;
    if (a.band !== 'attested') {
      if (a.reason !== undefined && !isAttestReason(a.reason)) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: malformed — unknown reason ${String(a.reason)}`);
        malformed = true;
      }
      continue; // non-attested bands need no proof checks
    }

    // --- an 'attested' CLAIM: run the increment-1 structural checks ---
    claimedAttested++;
    let attestedOk = true;

    // Substance precondition (codex final review): a claim may only be credited as VERIFIED when
    // it actually carries the proof fields — mirrors provenance-monitor.hasProvenance. Without
    // proofHash + requestCommitment + responseHash there is nothing to verify, so it is
    // PROOF_MISSING (claimed-but-not-verified), never verifiedAttested.
    if (typeof a.proofHash !== 'string' || typeof a.requestCommitment !== 'string' || typeof a.responseHash !== 'string') {
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_MISSING — attested claim lacks proofHash/requestCommitment/responseHash`);
      continue; // claimed but NOT verified; PROOF_MISSING is not an `ok=false` cause
    }

    if (a.responseHash !== undefined && a.responseHash !== v.rawOutputHash) {
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — responseHash != rawOutputHash`);
      attestedOk = false; invalid = true;
    }
    if (sha256hex(v.rawOutput) !== v.rawOutputHash) {
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — rawOutput does not match rawOutputHash`);
      attestedOk = false; invalid = true;
    }
    const expected = opts.expectedRequestCommitment?.(v);
    if (expected !== undefined && a.requestCommitment !== expected) {
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — requestCommitment does not match the ballot`);
      attestedOk = false; invalid = true;
    }
    // --- artifact / proof checks ---
    if (opts.resolveArtifact && opts.verifierFor) {
      if (!attestedOk) continue; // a prior structural check (responseHash/rawOutput/requestCommitment) already failed
      const artifact = opts.resolveArtifact(v);
      if (artifact === undefined) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_MISSING — attested claim with no retrievable artifact`);
        continue; // claimed, not verified — not an ok=false cause
      }
      const contentHash = createHashBytes(artifact);
      if (contentHash !== a.proofHash) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — artifact content hash != proofHash`);
        invalid = true; continue;
      }
      const verifier = opts.verifierFor(a.attestorBackend ?? '');
      if (!verifier) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_MISSING — no verifier for backend ${String(a.attestorBackend)}`);
        continue;
      }
      if (verifier.kind !== a.attestorBackend) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — verifier kind ${verifier.kind} != claimed backend ${String(a.attestorBackend)}`);
        invalid = true; continue;
      }
      if (typeof a.transcriptHash !== 'string' || typeof a.challengeNonce !== 'string' ||
          typeof a.endpoint !== 'string' || typeof a.modelVersion !== 'string' ||
          typeof a.extractionRule !== 'string' || typeof a.digestAlg !== 'string' || typeof a.vkId !== 'string') {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — attested claim missing public-input fields`);
        invalid = true; continue;
      }
      const pi: PublicInputs = {
        requestCommitment: a.requestCommitment, transcriptHash: a.transcriptHash, responseHash: a.responseHash,
        challengeNonce: a.challengeNonce, endpoint: a.endpoint, modelVersion: a.modelVersion,
        extractionRuleHash: extractionRuleHash(a.extractionRule),
      };
      const verdict = verifier.verify({ publicInputs: pi, digestAlg: a.digestAlg, vkId: a.vkId, artifact });
      if (!verdict.ok) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — proof verification failed`);
        invalid = true; continue;
      }
      let method = 'proof-only';
      const transcript = opts.resolveTranscript?.(v);
      if (transcript !== undefined) {
        if (sha256hex(transcript) !== a.transcriptHash) {
          reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — transcript hash != transcriptHash`);
          invalid = true; continue;
        }
        let extracted: string;
        try { extracted = applyExtractionRule(a.extractionRule, transcript); }
        catch { reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — extraction rule failed`); invalid = true; continue; }
        if (sha256hex(extracted) !== a.responseHash) {
          reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — re-derived responseHash mismatch`);
          invalid = true; continue;
        }
        if (!extracted.includes(a.challengeNonce)) {
          reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_INVALID — challengeNonce absent from extracted text`);
          invalid = true; continue;
        }
        method = 're-derived';
      }
      reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: verified-attested (backend=${a.attestorBackend} vkId=${a.vkId} method=${method})`);
      verifiedAttested++;
    } else {
      // increment-1 fallback: structural presence only
      if (!hasArtifact(v)) {
        reasons.push(`${v.validatorId}/${v.ballotHash.slice(0, 8)}: PROOF_MISSING — attested claim with no retrievable artifact`);
        attestedOk = false;
      }
      if (attestedOk) verifiedAttested++;
    }
  }

  // ok is false ONLY on a malformed envelope or a PROOF_INVALID. PROOF_MISSING is honestly
  // reported but is NOT a failure — it is the expected increment-1 state (no artifact resolver).
  const ok = !malformed && !invalid;
  return { ok, total: votes.length, withAttestation, bandCounts, claimedAttested, verifiedAttested, reasons };
}
