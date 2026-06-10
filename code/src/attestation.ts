import { createHash } from 'node:crypto';

// Quorumchain ($QRM) — proof-of-inference taxonomy + attestation envelope (sub-project A,
// increment 1). The band is coarse provenance status; the reason is the real signal B-core
// and governance consume (codex review). Both are SIGNED into the vote via signed-vote.ts.
// Zero dependencies — Node built-in crypto only (used in requestCommitment, added later).

/** Provenance band: the signer's CLAIM about how this vote's output was obtained.
 *  'attested' is the signer's claim of a proof, NOT verified-by-consensus (§3). */
export type ProvenanceBand = 'attested' | 'unattested' | 'degraded' | 'unavailable';

/** Closed reason set. Unknown values are rejected at parse (canonicalAttestation). */
export type AttestReason =
  | 'NO_BACKEND'        // unattested: no attestor backend configured (mock / CLI path)
  | 'BACKEND_DOWN'      // unavailable: backend unreachable before the attempt
  | 'ATTESTOR_TIMEOUT'  // degraded: exceeded the attestation-latency budget
  | 'PROOF_FAILED'      // degraded: backend ran but proof generation errored
  | 'PROOF_MISSING'     // set by the VERIFIER: attested-claim with no retrievable artifact
  | 'PROOF_INVALID';    // set by the VERIFIER: attested-claim whose artifact failed verification

export const PROVENANCE_BANDS: ReadonlySet<ProvenanceBand> = new Set<ProvenanceBand>([
  'attested', 'unattested', 'degraded', 'unavailable',
]);
export const ATTEST_REASONS: ReadonlySet<AttestReason> = new Set<AttestReason>([
  'NO_BACKEND', 'BACKEND_DOWN', 'ATTESTOR_TIMEOUT', 'PROOF_FAILED', 'PROOF_MISSING', 'PROOF_INVALID',
]);

export function isProvenanceBand(x: unknown): x is ProvenanceBand {
  return typeof x === 'string' && PROVENANCE_BANDS.has(x as ProvenanceBand);
}
export function isAttestReason(x: unknown): x is AttestReason {
  return typeof x === 'string' && ATTEST_REASONS.has(x as AttestReason);
}

/** The optional, signed provenance envelope (signed-vote.ts §3). Non-'attested' bands
 *  carry only band + reason; the proof fields appear ONLY when band === 'attested'. */
export interface Attestation {
  band: ProvenanceBand;
  reason?: AttestReason;       // present when band !== 'attested'
  // present ONLY when band === 'attested' (increment-2 backends populate these):
  endpoint?: string;           // vendor host / SNI (e.g. api.anthropic.com)
  certChainHash?: string;      // sha256 of the presented TLS cert chain
  requestId?: string;          // vendor-returned request id
  modelVersion?: string;       // pinned model-version string the vendor reported
  requestCommitment?: string;  // sha256 over the full request (see requestCommitment())
  transcriptHash?: string;     // sha256 of the FULL raw vendor response body, pre-extraction
  responseHash?: string;       // sha256 of the EXTRACTED model text == this vote's rawOutputHash
  extractionRule?: string;     // identifier+version of the body→text extraction the proof commits to
  proofHash?: string;          // sha256 of the attestor proof artifact (enclave quote / zkTLS proof)
  challengeNonce?: string;     // orchestrator-generated token; must appear in the extracted text
  attestorBackend?: string;    // which backend produced the proof
  vkId?: string;               // verification-key id (whitelisted, zk-web-proof.ts §5)
  digestAlg?: string;          // versioned public-input digest algorithm (e.g. 'sha256-v1')
}

// The fields permitted ONLY on an 'attested' envelope, in addition to 'band'. Any other
// key (or any of these on a non-attested band) is a parse error — the schema is closed.
const ATTESTED_FIELDS = [
  'certChainHash', 'challengeNonce', 'digestAlg', 'endpoint', 'extractionRule', 'modelVersion',
  'proofHash', 'requestCommitment', 'requestId', 'responseHash', 'transcriptHash', 'attestorBackend', 'vkId',
] as const;
const ATTESTED_FIELD_SET: ReadonlySet<string> = new Set(ATTESTED_FIELDS);

/** The deterministic, signed representation of an attestation (codex MAJOR-6 / MINOR-9).
 *  Returns a NEW object with lexicographically sorted keys and undefined keys omitted, so
 *  the caller's JSON.stringify (insertion-order preserving) yields a canonical string.
 *  Enforces the band-specific whitelist and rejects unknown bands/reasons/fields at parse. */
export function canonicalAttestation(a: Attestation): Record<string, string> {
  if (!isProvenanceBand(a.band)) throw new Error(`unknown provenance band: ${String((a as { band?: unknown }).band)}`);
  const out: Record<string, string> = {};

  if (a.band === 'attested') {
    if (a.reason !== undefined) throw new Error('attested band carries no reason');
    for (const [k, v] of Object.entries(a)) {
      if (k === 'band') continue;
      if (v === undefined) continue;            // omit, never null
      if (!ATTESTED_FIELD_SET.has(k)) throw new Error(`unknown attestation field: ${k}`);
      // close the schema at the VALUE level too (codex MAJOR-1): every attested field is a
      // string, so a signed vote cannot smuggle null/number/array/nested-object — which would
      // break the "lexicographically sorted keys / never null" determinism guarantee.
      if (typeof v !== 'string') throw new Error(`attestation field ${k} must be a string`);
      out[k] = v;
    }
  } else {
    // non-attested bands carry ONLY band + reason; any extra key is a parse error, not a
    // silent strip (codex final review): a stripped key never enters the signed preimage, so an
    // attacker could append e.g. proofHash to a published {band,reason} vote and keep a valid
    // signature. Closing the envelope here makes that tamper fail verifyVote.
    if (a.reason === undefined) throw new Error(`band '${a.band}' requires a reason`);
    if (!isAttestReason(a.reason)) throw new Error(`unknown attest reason: ${String(a.reason)}`);
    for (const k of Object.keys(a)) {
      if (k === 'band' || k === 'reason') continue;
      if ((a as Record<string, unknown>)[k] === undefined) continue; // omit, never null
      throw new Error(`unknown attestation field: ${k}`);
    }
    out.reason = a.reason;
  }

  out.band = a.band;
  // sort keys lexicographically into a fresh object (insertion order == serialization order)
  const sorted: Record<string, string> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

export interface RequestCommitmentInput {
  promptHash: string;     // sha256 of the FULL built prompt sent to the model
  modelParam: string;     // the pinned model parameter the request named
  ballotHash: string;     // the ballot this vote is cast on
  conveningNonce: string; // the per-convening nonce (round-57)
  challengeNonce: string; // the orchestrator-generated freshness token (§5)
}

/** sha256 over the full request (codex MAJOR-5): proves the response answers THIS ballot,
 *  not just any fresh-looking response that echoes the token. Keys are fixed and ordered,
 *  so the commitment is deterministic across implementations. */
export function requestCommitment(i: RequestCommitmentInput): string {
  const canonical = JSON.stringify({
    ballotHash: i.ballotHash,
    challengeNonce: i.challengeNonce,
    conveningNonce: i.conveningNonce,
    modelParam: i.modelParam,
    promptHash: i.promptHash,
  });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}
