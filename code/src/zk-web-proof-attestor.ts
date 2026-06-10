// Quorumchain ($QRM) — proof-of-inference increment 2: the zkWebProof Attestor backend
// (fixtures-scope). Dependency-injected fetchVendor (fixtured transcript now, real HTTPS at the
// live step), prover (the reference prover — stand-in for a SNARK prover), and writeArtifact
// (sidecar writer). Produces a real attested envelope. Throws on fetch/extraction error;
// attestWithBudget converts that to degraded/PROOF_FAILED so it never throws into the vote path.
// Zero external dependencies.

import { createHash } from 'node:crypto';
import { type Attestor, type AttestedResult, type RequestCtx } from './attestor.ts';
import { type Attestation, requestCommitment } from './attestation.ts';
import { applyExtractionRule, extractionRuleHash, publicInputsDigest, type PublicInputs } from './zk-web-proof.ts';

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

export interface VendorResponse { transcriptBody: string; endpoint: string; modelVersion: string }

export interface ZkWebProofAttestorConfig {
  fetchVendor: (prompt: string, challengeNonce: string) => Promise<VendorResponse>;
  prover: (digestHex: string) => Uint8Array; // signs the public-input digest (reference stand-in)
  writeArtifact: (proofHash: string, bytes: Uint8Array) => void; // sidecar writer
  extractionRule: string;  // e.g. 'anthropic-messages-v1'
  modelParam: string;      // the pinned model parameter the request names
  vkId: string;            // e.g. REFERENCE_VK_ID
  digestAlg: string;       // e.g. 'sha256-v1'
}

export function zkWebProofAttestor(cfg: ZkWebProofAttestorConfig): Attestor {
  return {
    async invoke(_validatorId: string, prompt: string, challengeNonce: string, requestCtx?: RequestCtx): Promise<AttestedResult> {
      const ctx: RequestCtx = requestCtx ?? { ballotHash: '', conveningNonce: '' };
      const { transcriptBody, endpoint, modelVersion } = await cfg.fetchVendor(prompt, challengeNonce);
      const rawOutput = applyExtractionRule(cfg.extractionRule, transcriptBody);
      const transcriptHash = sha256(transcriptBody);
      const responseHash = sha256(rawOutput);
      const rc = requestCommitment({
        promptHash: sha256(prompt), modelParam: cfg.modelParam,
        ballotHash: ctx.ballotHash, conveningNonce: ctx.conveningNonce, challengeNonce,
      });
      const pi: PublicInputs = {
        requestCommitment: rc, transcriptHash, responseHash, challengeNonce,
        endpoint, modelVersion, extractionRuleHash: extractionRuleHash(cfg.extractionRule),
      };
      const artifact = cfg.prover(publicInputsDigest(pi, cfg.digestAlg));
      const proofHash = createHash('sha256').update(artifact).digest('hex');
      cfg.writeArtifact(proofHash, artifact);
      const attestation: Attestation = {
        band: 'attested', attestorBackend: 'fixture-prover-signature', vkId: cfg.vkId, digestAlg: cfg.digestAlg,
        endpoint, modelVersion, requestCommitment: rc, transcriptHash, responseHash,
        extractionRule: cfg.extractionRule, proofHash, challengeNonce,
      };
      return { rawOutput, attestation };
    },
  };
}
