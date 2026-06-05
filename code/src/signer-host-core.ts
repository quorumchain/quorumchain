// Quorumchain ($QRM) — the deliberating host's request handler, transport-agnostic.
// Extracted (round-57) so the SAME child-side logic serves both the stdio host
// (deliberating-signer-host.ts) and the network host (socket-signer.ts): the panel
// ratified distribution as a TRANSPORT swap, so the deliberation + signing must NOT
// be duplicated per transport. Child-side, and only child-side, it: holds the key,
// builds the prompt, runs the validator's real invoker, parses the verdict, derives
// the ballot hash from content (round-45 binding), binds the orchestrator's
// per-convening nonce (round-57), and signs. The orchestrator supplies NO verdict
// and NO key, and there is NO request that returns the private key (round-47).
// Zero dependencies.

import { ballotHash, signVote, type ValidatorKey } from './signed-vote.ts';
import { buildPrompt, parseVerdict, type ValidatorInvoker } from './panel.ts';

export interface HostRequest {
  id?: number;
  type?: string;
  prompt?: string;
  context?: string;
  verdicts?: string[];
  nonce?: string;
  boundType?: string; // CIP-14: a hash-bound epistemic type, derived into the hash child-side
  anchorCommitment?: string; // CIP-15 NI-15e: the canonical anchor-set commitment, derived into the hash child-side
}

/** Build the handler. `key`'s private half is captured in the closure; only the
 *  public half is ever returned (the `pubkey` reply). A child-side invoker failure
 *  becomes a signed NO_VERDICT, so a dead CLI never crashes the host. */
export function makeHostHandler(params: { validatorId: string; key: ValidatorKey; invoke: ValidatorInvoker }): (req: HostRequest) => Promise<Record<string, unknown>> {
  const { validatorId, invoke } = params;
  const privateKeyPem = params.key.privateKeyPem;
  const publicKeyPem = params.key.publicKeyPem;
  return async (req) => {
    if (req.type === 'pubkey') {
      return { publicKeyPem }; // public half only — never the private key
    }
    if (req.type === 'sign') {
      const prompt = req.prompt ?? '';
      const context = req.context ?? '';
      let rawOutput: string;
      try {
        rawOutput = await invoke(buildPrompt(prompt, context, req.verdicts));
      } catch (e) {
        rawOutput = `INVOCATION_ERROR (${validatorId}): ${(e as Error).message}`;
      }
      const verdict = parseVerdict(rawOutput); // decided here, not by the orchestrator
      const bh = ballotHash(prompt, context, req.boundType, req.anchorCommitment); // derived here, not caller-supplied (CIP-14 type + CIP-15 anchors when present)
      return { vote: signVote({ validatorId, privateKeyPem, ballotHash: bh, verdict, rawOutput, nonce: req.nonce }) };
    }
    return { error: 'unknown request type' }; // no request returns the private key or sets a verdict
  };
}
