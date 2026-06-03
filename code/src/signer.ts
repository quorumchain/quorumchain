// Quorumchain ($QRM) — the validator signing boundary (round-44 backlog #2).
// CIP-3's deepest invariant is that the orchestrator is NOT the trust root. A
// Signer is the capability that enforces it: the validator's private key is
// captured behind this boundary, and the orchestrator can only ASK for a signed
// vote — it never holds the key, so it cannot mint a verdict the validator did
// not produce, nor re-sign one after the fact. The validator decides its own
// verdict and signs over it atomically (invoke → parse → sign on its side).
//
// `makeLocalSigner` is the in-process implementation: the key lives in a closure
// with no extraction path. NOTE (testnet item): locally the key is still loaded
// into the orchestrator PROCESS, so this achieves the type-level / protocol
// separation but not OS-level custody isolation — the drop-in is a RemoteSigner
// (separate process / enclave / signing service) that satisfies the SAME
// interface, so `convene` needs no change to get true custody separation.
// Zero dependencies.

import { signVote, type SignedVote, type ValidatorKey } from './signed-vote.ts';

export interface Signer {
  readonly validatorId: string;
  readonly publicKeyPem: string;
  /** Run this validator on the ballot and return its OWN signed vote: the model
   *  invocation, verdict parse, and signature all happen on the validator side. */
  signBallot(ballotHash: string, fullPrompt: string): Promise<SignedVote>;
}

export function makeLocalSigner(params: {
  validatorId: string;
  key: ValidatorKey; // consumed here; only the public half is ever exposed
  invoke: (fullPrompt: string) => Promise<string>;
  parseVerdict: (rawOutput: string) => string;
}): Signer {
  const { validatorId, invoke, parseVerdict } = params;
  const privateKeyPem = params.key.privateKeyPem; // closure-captured; no getter, no property
  const publicKeyPem = params.key.publicKeyPem;
  return {
    validatorId,
    publicKeyPem,
    async signBallot(ballotHash, fullPrompt) {
      const rawOutput = await invoke(fullPrompt);
      const verdict = parseVerdict(rawOutput);
      return signVote({ validatorId, privateKeyPem, ballotHash, verdict, rawOutput });
    },
  };
}
