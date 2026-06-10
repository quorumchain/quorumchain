// Quorumchain ($QRM) — the Attestor seam (proof-of-inference, increment 1). An attestor
// wraps a validator invocation (the existing invokers.ts ValidatorInvoker) and returns the
// verbatim rawOutput PLUS a provenance envelope (or a degrade reason). The CLI invokers stay
// the degrade-open/developer path; real provenance backends (increment 2) slot in behind the
// SAME seam without changing the request path for other validators. Zero dependencies.

import type { Attestation } from './attestation.ts';
import type { ValidatorInvoker } from './panel.ts';

export interface AttestedResult {
  rawOutput: string;
  attestation: Attestation;
}

/** Context the signer supplies so a provenance backend can bind the request to THIS ballot
 *  (skeleton requestCommitment). modelParam/promptHash are the backend's own concern. */
export interface RequestCtx {
  ballotHash: string;
  conveningNonce: string;
}

export interface Attestor {
  /** challengeNonce is orchestrator-generated (§5), injected into the prompt upstream.
   *  requestCtx (increment 2) lets a real backend bind requestCommitment to this ballot;
   *  mockAttestor ignores it. */
  invoke(validatorId: string, prompt: string, challengeNonce: string, requestCtx?: RequestCtx): Promise<AttestedResult>;
}

/** The always-available fallback + test substrate: wraps an invoker, returns its verbatim
 *  output, and bands every vote 'unattested'/'NO_BACKEND'. Never throws into the vote path —
 *  an invoker error becomes the diagnostic rawOutput (mirrors signer-host-core's safe wrap). */
export function mockAttestor(invoke: ValidatorInvoker): Attestor {
  return {
    async invoke(_validatorId, prompt, _challengeNonce, _requestCtx) {
      let rawOutput: string;
      try {
        rawOutput = await invoke(prompt);
      } catch (e) {
        rawOutput = `INVOCATION_ERROR: ${(e as Error).message}`;
      }
      return { rawOutput, attestation: { band: 'unattested', reason: 'NO_BACKEND' } };
    },
  };
}

/** Race a real attestor backend against its latency budget. On timeout or backend error,
 *  DEGRADE (band 'degraded' with the precise reason) and fall back to the CLI invoker so the
 *  vote proceeds — provenance is best-effort and NEVER throws into the vote path (§7). This is
 *  the standing guard against the latency→absence→security inversion: attestation latency can
 *  never raise an absence, because the budget is bounded and the fallback always produces output.
 *  (Increment-2 backends are passed here; increment-1 ships only mockAttestor, which needs no
 *  budget — but the live wiring uses this so swapping in a real backend changes nothing else.) */
export function attestWithBudget(backend: Attestor, fallback: ValidatorInvoker, budgetMs: number): Attestor {
  return {
    async invoke(validatorId, prompt, challengeNonce, requestCtx) {
      const timeout = Symbol('timeout');
      let timer: ReturnType<typeof setTimeout> | undefined;
      const budget = new Promise<typeof timeout>((resolve) => { timer = setTimeout(() => resolve(timeout), budgetMs); });
      try {
        const r = await Promise.race([backend.invoke(validatorId, prompt, challengeNonce, requestCtx), budget]);
        if (r === timeout) return degrade('ATTESTOR_TIMEOUT', fallback, prompt);
        return r;
      } catch {
        return degrade('PROOF_FAILED', fallback, prompt);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

async function degrade(reason: 'ATTESTOR_TIMEOUT' | 'PROOF_FAILED', fallback: ValidatorInvoker, prompt: string): Promise<AttestedResult> {
  let rawOutput: string;
  try {
    rawOutput = await fallback(prompt);
  } catch (e) {
    rawOutput = `INVOCATION_ERROR: ${(e as Error).message}`;
  }
  return { rawOutput, attestation: { band: 'degraded', reason } };
}
