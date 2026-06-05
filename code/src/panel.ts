// Quorumchain ($QRM) — panel runner (wires signed-vote logging into convening).
// convene() is the function that replaces the orchestrator's narrated ceremony:
// it invokes each validator, signs their VERBATIM output, appends it to the
// tamper-evident log, and ratifies — all recomputable from the log afterward.

import { randomBytes } from 'node:crypto';
import { ballotHash, ratify, type SignedVote, type RatifyResult } from './signed-vote.ts';
import { appendVote } from './vote-log.ts';
import { appendBallot } from './ballot-registry.ts';
import { type Signer } from './signer.ts';
import type { BallotMeta, ContraryDossier } from './commons.ts';

/** Runs a validator on the full ballot prompt and returns its VERBATIM output. */
export type ValidatorInvoker = (fullPrompt: string) => Promise<string>;

export interface ConveneResult extends RatifyResult {
  votes: SignedVote[];
  failures: { validatorId: string; error: string }[]; // validators whose signer failed (e.g. dead host)
}

/** Pull a structured verdict out of free-text model output. Validators are asked
 *  to end with a `VERDICT: <token>` line; we take the last one, first token,
 *  stripped of surrounding markup, uppercased. Absent → NO_VERDICT (still logged). */
export function parseVerdict(rawOutput: string): string {
  const matches = [...rawOutput.matchAll(/^\s*VERDICT:\s*(\S+)/gim)];
  if (matches.length === 0) return 'NO_VERDICT';
  const token = matches[matches.length - 1][1];
  return token.replace(/^\W+|\W+$/g, '').toUpperCase();
}

/** Build the prompt sent to every validator: the question, the evidence, and the
 *  required structured ending so the verdict is machine-parseable. `verdicts`
 *  lets a ballot be multiple-choice (e.g. design options) rather than YES/NO. */
export function buildPrompt(prompt: string, context: string, verdicts: string[] = ['YES', 'NO', 'ABSTAIN']): string {
  return [
    'You are a Quorumchain validator judging one ballot. Reason briefly, then commit.',
    '',
    `QUESTION: ${prompt}`,
    `EVIDENCE/CONTEXT: ${context}`,
    '',
    'End your response with exactly one line:',
    `VERDICT: <${verdicts.join('|')}>`,
  ].join('\n');
}

/** Bring up one signer per validator id, tolerating STARTUP failures (round-49 V2
 *  finding): a host that fails its initial handshake is recorded as a startup absence
 *  instead of aborting the whole convening. The validators that came up are returned
 *  for `convene`; the absences count against ratify's 2/3 bar (the denominator is the
 *  full registered/pinned panel). `make` is the per-id signer factory (e.g. a
 *  makeRemoteSigner call). This is the live-path complement to convene's per-signing
 *  failure handling, so a dead host can abort the convening at NO stage. */
export async function startSigners(
  ids: string[],
  make: (id: string) => Promise<Signer>,
): Promise<{ started: Signer[]; startupFailures: { validatorId: string; error: string }[] }> {
  const results = await Promise.allSettled(ids.map((id) => make(id)));
  const started: Signer[] = [];
  const startupFailures: { validatorId: string; error: string }[] = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') started.push(r.value);
    else startupFailures.push({ validatorId: ids[i], error: r.reason instanceof Error ? r.reason.message : String(r.reason) });
  });
  return { started, startupFailures };
}

export async function convene(params: {
  prompt: string;
  context: string;
  signers: Signer[];
  keyring: Record<string, string>;
  quorum: number;
  logPath: string;
  verdicts?: string[];
  registryPath?: string;
  meta?: BallotMeta; // CIP-13: declared epistemic type / supersedes / typesClaimFor recorded with the ballot
  dossier?: ContraryDossier; // CIP-10: contrary-evidence dossier recorded with the ballot
}): Promise<ConveneResult> {
  const bh = ballotHash(params.prompt, params.context);
  // Record the human-readable statement for the read surface (round-58). The registry is
  // self-verifying (the statement must re-hash to bh), so this persists provenance, not trust.
  // CIP-13/CIP-10 declared meta/dossier travel with the ballot when supplied.
  if (params.registryPath) appendBallot(params.registryPath, params.prompt, params.context, { meta: params.meta, dossier: params.dossier });
  // Per-convening nonce (round-57): issued here, the signers bind it into their signed
  // payload, and a returned vote that does not carry THIS nonce is rejected — so a vote
  // captured from one convening cannot be replayed into another. Verdict integrity still
  // rests on the signature + keyring; the nonce adds convening-binding on top.
  const nonce = randomBytes(16).toString('hex');
  const votes: SignedVote[] = [];
  const failures: { validatorId: string; error: string }[] = [];
  // Sequential: appendVote reads-then-writes the file, so concurrent appends
  // would race the hash chain. A 3-validator panel does not need parallelism.
  // The orchestrator holds NO key and supplies NO hash: it passes the ballot
  // CONTENT, and each validator signs its own vote behind the Signer boundary,
  // deriving the hash from that content (CIP-3 — the orchestrator is not the trust
  // root; it can collect and verify, but cannot mint, alter, or rebind a verdict).
  // Liveness (Phase 0.5): a signer failure (e.g. a dead RemoteSigner host) is
  // RECORDED as an absence and the convening proceeds — it never hangs or aborts,
  // and a missing vote is never fabricated. ratify then decides on the votes that
  // arrived: 2/3 is of the whole registered panel, so absences count against the bar.
  for (const s of params.signers) {
    try {
      const vote = await s.signBallot(params.prompt, params.context, params.verdicts, nonce);
      if (vote.nonce !== nonce) {
        // a vote not bound to THIS convening (stale/replayed) is recorded as a failure,
        // never logged or counted — the orchestrator only accepts the nonce it issued
        failures.push({ validatorId: s.validatorId, error: 'nonce-mismatch (vote not bound to this convening)' });
        continue;
      }
      appendVote(params.logPath, vote);
      votes.push(vote);
    } catch (e) {
      failures.push({ validatorId: s.validatorId, error: (e as Error).message });
    }
  }
  const result = ratify(bh, votes, params.keyring, params.quorum);
  return { ...result, votes, failures };
}
