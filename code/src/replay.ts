// Quorumchain ($QRM) — CIP-8 frozen-ballot replay verifier (gates G1, G2).
// The product claim of CIP-8 §4 is that a resolution is bound to its criteria at
// creation by `ballotHash = sha256(question || frozenCriteria)`, so (G1) no one
// can add "additional context" afterward without producing a provably different
// ballot, and (G2) anyone holding the frozen criteria + the signed votes can
// recompute the ballotHash and re-verify the verdict. This module is that
// independent recomputation. Zero dependencies beyond the CIP-3 primitives.

import { ballotHash, verifyVote, ratify, type SignedVote, type RatifyResult } from './signed-vote.ts';

/** The resolution ballotHash: question bound to its frozen criteria at creation
 *  (CIP-3 `ballotHash(prompt, context)`, here prompt=question, context=criteria). */
export function recomputeBallotHash(question: string, frozenCriteria: string): string {
  return ballotHash(question, frozenCriteria);
}

export interface TamperDelta {
  originalHash: string;
  tamperedHash: string;
  differ: boolean;
}

/** G1: show that appending context after creation changes the ballotHash, i.e.
 *  the "Additional context added afterwards" attack cannot be done silently. */
export function tamperDelta(question: string, frozenCriteria: string, addedContext: string): TamperDelta {
  const originalHash = recomputeBallotHash(question, frozenCriteria);
  const tamperedHash = recomputeBallotHash(question, `${frozenCriteria}\n${addedContext}`);
  return { originalHash, tamperedHash, differ: originalHash !== tamperedHash };
}

export interface ReplayResult {
  recomputedHash: string;
  expectedHash: string;
  hashMatches: boolean; // G2: the frozen criteria reproduce the signed ballot
  voteResults: { validatorId: string; valid: boolean }[];
  allVotesValid: boolean;
  ratification: RatifyResult;
  replayOk: boolean; // criteria reproduce the ballot AND votes verify AND quorum holds
}

/** G2: replay a resolution from its frozen criteria and signed votes. Confirms
 *  the recomputed ballotHash matches what was signed, every counted vote's
 *  signature verifies, and ratification still holds — all recomputable by anyone. */
export function replayBallot(params: {
  question: string;
  frozenCriteria: string;
  expectedBallotHash: string;
  votes: SignedVote[];
  keyring: Record<string, string>;
  quorum: number;
}): ReplayResult {
  const recomputedHash = recomputeBallotHash(params.question, params.frozenCriteria);
  const hashMatches = recomputedHash === params.expectedBallotHash;

  const voteResults = params.votes.map((v) => ({
    validatorId: v.validatorId,
    valid: v.ballotHash === params.expectedBallotHash && v.validatorId in params.keyring && verifyVote(v, params.keyring[v.validatorId]),
  }));
  const allVotesValid = voteResults.length > 0 && voteResults.every((r) => r.valid);

  const ratification = ratify(params.expectedBallotHash, params.votes, params.keyring, params.quorum);

  return {
    recomputedHash,
    expectedHash: params.expectedBallotHash,
    hashMatches,
    voteResults,
    allVotesValid,
    ratification,
    replayOk: hashMatches && allVotesValid && ratification.ratified,
  };
}
