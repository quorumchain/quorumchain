// Quorumchain ($QRM) — proof-of-inference increment 2: the zkWebProof reference contract.
// The proof's PUBLIC INPUTS are the skeleton Attestation bindings reduced to a single
// publicInputsDigest the proof commits to. digestAlg is VERSIONED so a SNARK-friendly hash
// (e.g. poseidon-v1) slots in later WITHOUT an envelope/schema break. Zero dependencies.

import { createHash, generateKeyPairSync } from 'node:crypto';
import type { AttestReason } from './attestation.ts';

/** The canonical, ordered public-input set the proof commits to (spec §3). Every field is a
 *  string; extractionRuleHash = sha256(extractionRule) binds the extraction rule INTO the digest
 *  so a rule-swap forgery changes the digest and breaks the proof (spec §6 step 4). */
export interface PublicInputs {
  requestCommitment: string;
  transcriptHash: string;
  responseHash: string;
  challengeNonce: string;
  endpoint: string;
  modelVersion: string;
  extractionRuleHash: string;
}

/** A fresh object with lexicographically sorted keys — same discipline as canonicalAttestation,
 *  so JSON.stringify (insertion-order preserving) yields a canonical string. */
export function canonicalPublicInputs(pi: PublicInputs): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(pi).sort()) out[k] = (pi as Record<string, string>)[k];
  return out;
}

/** digest_{digestAlg}( canonicalJSON(publicInputs) ). The reference uses 'sha256-v1'. Unknown
 *  algorithms throw — a verifier must never silently accept a digest it did not compute. */
export function publicInputsDigest(pi: PublicInputs, digestAlg: string): string {
  if (digestAlg !== 'sha256-v1') throw new Error(`unsupported digestAlg: ${digestAlg}`);
  return createHash('sha256').update(JSON.stringify(canonicalPublicInputs(pi)), 'utf8').digest('hex');
}

/** sha256 of the extraction-rule id — the value bound into PublicInputs.extractionRuleHash. */
export function extractionRuleHash(ruleId: string): string {
  return createHash('sha256').update(ruleId, 'utf8').digest('hex');
}

/** Apply a registered body->text extraction rule. The transcript body is DATA: its contents are
 *  never re-parsed as a rule (injection-resistant). Unknown rule ids throw — the rule set is closed.
 *  'anthropic-messages-v1': concatenate the `text` of every {type:'text'} content block, in order. */
export function applyExtractionRule(ruleId: string, transcriptBody: string): string {
  if (ruleId !== 'anthropic-messages-v1') throw new Error(`unknown extraction rule: ${ruleId}`);
  const body = JSON.parse(transcriptBody) as { content?: { type?: string; text?: string }[] };
  const blocks = Array.isArray(body.content) ? body.content : [];
  return blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
}

export interface VkEntry {
  verifierKind: string; // must match the ProofVerifier.kind that consumes it
  vkPem: string;        // PEM public key (reference) / verification-key material (production)
  production: boolean;  // false = fixture/testing trust anchor; a production node refuses these
}

const VK_REGISTRY = new Map<string, VkEntry>();

export function registerVk(vkId: string, entry: VkEntry): void {
  if (VK_REGISTRY.has(vkId)) throw new Error(`vkId already registered: ${vkId}`);
  VK_REGISTRY.set(vkId, entry);
}
export function lookupVk(vkId: string): VkEntry | undefined {
  return VK_REGISTRY.get(vkId);
}

// The reference prover keypair (Ed25519). The PUBLIC half is the whitelisted reference vk; the
// PRIVATE half (REFERENCE_PROVER_PRIVATE_PEM) is the fixture prover used in tests + by the
// fixtured attestor. This is the STAND-IN for a real SNARK proving system — it is quarantined:
// vkId 'ref-ecdsa-v0' is production:false and must never be wired into a production node default.
const refProverKey = generateKeyPairSync('ed25519', {
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
export const REFERENCE_PROVER_PRIVATE_PEM = refProverKey.privateKey;
export const REFERENCE_VK_ID = 'ref-ecdsa-v0';
registerVk(REFERENCE_VK_ID, { verifierKind: 'fixture-prover-signature', vkPem: refProverKey.publicKey, production: false });

export interface ProofVerifyInput {
  publicInputs: PublicInputs;
  digestAlg: string;
  vkId: string;
  artifact: Uint8Array; // the resolved proof artifact bytes
}
export interface ProofVerifier {
  readonly kind: string; // matches Attestation.attestorBackend (e.g. 'fixture-prover-signature')
  verify(input: ProofVerifyInput): { ok: boolean; reason?: AttestReason };
}
