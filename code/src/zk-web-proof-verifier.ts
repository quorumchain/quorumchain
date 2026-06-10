// Quorumchain ($QRM) — proof-of-inference increment 2: the REFERENCE ProofVerifier. It checks an
// Ed25519 signature by the reference prover key over publicInputsDigest. This is a STAND-IN for a
// real zk proving system: it exercises the full envelope + binding + verification FLOW
// deterministically, but does NOT prove a zk circuit or a TLS session. The production SNARK
// verifier replaces ONLY this module behind the same ProofVerifier interface — no protocol change.
// Zero external dependencies (Node crypto only).

import { verify as edVerify } from 'node:crypto';
import { type ProofVerifier, type ProofVerifyInput, publicInputsDigest, lookupVk } from './zk-web-proof.ts';

const KIND = 'fixture-prover-signature';

export function referenceProofVerifier(): ProofVerifier {
  return {
    kind: KIND,
    verify(input: ProofVerifyInput) {
      const vk = lookupVk(input.vkId);
      if (!vk || vk.verifierKind !== KIND) return { ok: false, reason: 'PROOF_INVALID' };
      let digest: string;
      try {
        digest = publicInputsDigest(input.publicInputs, input.digestAlg);
      } catch {
        return { ok: false, reason: 'PROOF_INVALID' }; // unsupported digestAlg
      }
      try {
        const ok = edVerify(null, Buffer.from(digest, 'utf8'), vk.vkPem, input.artifact);
        return ok ? { ok: true } : { ok: false, reason: 'PROOF_INVALID' };
      } catch {
        return { ok: false, reason: 'PROOF_INVALID' };
      }
    },
  };
}
