// Quorumchain ($QRM) — proof-of-inference anti-abuse monitor (§7, increment 1). Descriptive
// only — it NEVER gates consensus (the 2/3 bar is untouched). It raises a governance FLAG when
// a validator's missing-provenance rate (unattested + degraded + unavailable, or no envelope)
// over the last K convenings exceeds a threshold — otherwise an operator could prefer unattested
// votes to dodge B-core's correlation penalty. Pure function over signed votes. Zero deps.

import type { SignedVote } from './signed-vote.ts';

export interface AbuseFlag {
  validatorId: string;
  missingRate: number; // fraction of the validator's windowed convenings WITHOUT verified provenance
  convenings: number;  // how many of this validator's convenings are in the window
  flagged: boolean;
}

/** A vote has "present provenance" ONLY when it claims band 'attested' AND carries the mandatory
 *  proof material (proofHash + requestCommitment + responseHash). A BARE `{band:'attested'}` does
 *  NOT count (codex MAJOR-2): otherwise an operator dodges the flag by self-claiming attested with
 *  no verifiable substance. Every other band, and a legacy vote with no envelope, counts as missing
 *  — the conservative-pricing stance (§4). This is the increment-1 proxy; increment 2 should feed
 *  verify-provenance's VERIFIED-attested set here instead of the claim's proof-field presence. */
function hasProvenance(v: SignedVote): boolean {
  const a = v.attestation;
  return a?.band === 'attested'
    && typeof a.proofHash === 'string'
    && typeof a.requestCommitment === 'string'
    && typeof a.responseHash === 'string';
}

export function provenanceAbuseFlags(
  votes: SignedVote[],
  opts: { windowK: number; threshold: number },
): AbuseFlag[] {
  // ONE row per (validator, ballotHash) convening (codex MAJOR-3): dedupe so duplicate votes or
  // equivocations on one ballot can't skew the missing rate or the "last K convenings" window. A
  // convening is "missing" if ANY of the validator's votes on that ballot lack provenance
  // (conservative). A Map preserves first-seen ballot order, so slice(-K) is the most recent K.
  const byValidator = new Map<string, Map<string, boolean>>(); // validatorId -> (ballotHash -> missing)
  for (const v of votes) {
    if (!byValidator.has(v.validatorId)) byValidator.set(v.validatorId, new Map());
    const ballots = byValidator.get(v.validatorId)!;
    const prevMissing = ballots.get(v.ballotHash) ?? false;
    ballots.set(v.ballotHash, prevMissing || !hasProvenance(v));
  }
  const flags: AbuseFlag[] = [];
  for (const [validatorId, ballots] of byValidator) {
    const windowed = [...ballots.values()].slice(-opts.windowK); // most recent K convenings
    const convenings = windowed.length;
    const missingCount = windowed.filter((missing) => missing).length;
    const missingRate = convenings === 0 ? 0 : missingCount / convenings;
    flags.push({ validatorId, missingRate, convenings, flagged: missingRate > opts.threshold });
  }
  return flags;
}
