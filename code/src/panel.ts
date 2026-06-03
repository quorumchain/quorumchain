// Quorumchain ($QRM) — panel runner (wires signed-vote logging into convening).
// convene() is the function that replaces the orchestrator's narrated ceremony:
// it invokes each validator, signs their VERBATIM output, appends it to the
// tamper-evident log, and ratifies — all recomputable from the log afterward.

import { ballotHash, ratify, type SignedVote, type RatifyResult } from './signed-vote.ts';
import { appendVote } from './vote-log.ts';
import { type Signer } from './signer.ts';

/** Runs a validator on the full ballot prompt and returns its VERBATIM output. */
export type ValidatorInvoker = (fullPrompt: string) => Promise<string>;

export interface ConveneResult extends RatifyResult {
  votes: SignedVote[];
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

export async function convene(params: {
  prompt: string;
  context: string;
  signers: Signer[];
  keyring: Record<string, string>;
  quorum: number;
  logPath: string;
  verdicts?: string[];
}): Promise<ConveneResult> {
  const bh = ballotHash(params.prompt, params.context);
  const fullPrompt = buildPrompt(params.prompt, params.context, params.verdicts);
  const votes: SignedVote[] = [];
  // Sequential: appendVote reads-then-writes the file, so concurrent appends
  // would race the hash chain. A 3-validator panel does not need parallelism.
  // The orchestrator holds NO key: each validator signs its own vote behind the
  // Signer boundary (CIP-3 — the orchestrator is not the trust root). It can
  // collect and verify, but cannot mint or alter a verdict.
  for (const s of params.signers) {
    const vote = await s.signBallot(bh, fullPrompt);
    appendVote(params.logPath, vote);
    votes.push(vote);
  }
  const result = ratify(bh, votes, params.keyring, params.quorum);
  return { ...result, votes };
}
