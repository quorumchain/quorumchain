// Quorumchain ($QRM) — signed-vote consensus primitive (CIP-3 §1, §3).
// Turns "AI consensus" from an orchestrator-narrated ceremony into a verifiable
// protocol: every validator vote is Ed25519-signed over the FULL prompt+context
// hash (anti bait-and-switch), and ratification is a function anyone can recompute
// from the signed votes alone. Zero dependencies — Node built-in crypto only.

import {
  generateKeyPairSync,
  createHash,
  sign as cryptoSign,
  verify as cryptoVerify,
  createPublicKey,
  createPrivateKey,
} from 'node:crypto';

export interface ValidatorKey {
  publicKeyPem: string;
  privateKeyPem: string;
}

export interface SignedVote {
  validatorId: string;
  ballotHash: string;
  verdict: string;
  rawOutput: string;
  rawOutputHash: string;
  signature: string; // hex
  /** Per-convening nonce (round-57): binds a vote to ONE convening so a captured vote
   *  cannot be replayed into another. Optional for backward compatibility — votes
   *  signed before this field still verify (the nonce simply does not enter the
   *  signed payload when absent). The orchestrator issues it and verifies the echo. */
  nonce?: string;
}

export interface RatifyResult {
  ballotHash: string;
  ratified: boolean;
  verdict: string | null;
  required: number; // the actual bar applied: max(quorum, 2/3-ceiling of the panel)
  tally: Record<string, number>;
  counted: string[]; // validatorIds whose vote was counted
  rejected: { validatorId: string; reason: string }[];
}

function sha256hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

// CIP-14 (core ballot e0d17747): the epistemic-type tokens that may be hash-bound.
// Mirrors commons.ts EpistemicType — duplicated (not imported) to keep this crypto core
// dependency-free. The §2.3 serialization contract (NI-14f) is enforced HERE, at the
// chokepoint, so it cannot be bypassed: only a recognized token enters the v2 preimage.
const BOUND_TYPES = new Set(['SETTLED', 'EMPIRICAL_LIVE', 'NORMATIVE']);

/** Hash binding the FULL prompt + context. A vote signs over this, so a validator
 *  can prove exactly what it was asked (defends CIP-1 1c bait-and-switch).
 *
 *  CIP-14: when `boundType` is a recognized EpistemicType token, it is appended to the
 *  hashed object — exactly like the round-57 nonce's optional-append — so the type enters
 *  the hash and thus every signature (the NI-13a ideal: the type is SIGNED, not declared).
 *  Any other value (absent / undefined / null / '' / unrecognized) produces the v1 hash
 *  byte-identically: the `epistemicType` key is NEVER emitted as null/empty (NI-14a/f). */
export function ballotHash(prompt: string, context: string, boundType?: string): string {
  if (typeof boundType === 'string' && BOUND_TYPES.has(boundType)) {
    return sha256hex(JSON.stringify({ prompt, context, epistemicType: boundType }));
  }
  return sha256hex(JSON.stringify({ prompt, context }));
}

export function generateValidatorKey(): ValidatorKey {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }) as string,
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
  };
}

// The exact bytes a signature commits to. Includes the rawOutput hash so the
// verbatim reasoning cannot be altered after signing. The nonce is appended ONLY
// when present, so a vote signed without one produces byte-identical payload to the
// pre-round-57 format (legacy log entries still verify) while a nonced vote binds it.
function votePayload(v: { validatorId: string; ballotHash: string; verdict: string; rawOutputHash: string; nonce?: string }): string {
  const base: Record<string, unknown> = {
    validatorId: v.validatorId,
    ballotHash: v.ballotHash,
    verdict: v.verdict,
    rawOutputHash: v.rawOutputHash,
  };
  if (v.nonce !== undefined) base.nonce = v.nonce;
  return JSON.stringify(base);
}

export function signVote(params: {
  validatorId: string;
  privateKeyPem: string;
  ballotHash: string;
  verdict: string;
  rawOutput: string;
  nonce?: string;
}): SignedVote {
  const rawOutputHash = sha256hex(params.rawOutput);
  const payload = votePayload({
    validatorId: params.validatorId,
    ballotHash: params.ballotHash,
    verdict: params.verdict,
    rawOutputHash,
    nonce: params.nonce,
  });
  const signature = cryptoSign(null, Buffer.from(payload, 'utf8'), createPrivateKey(params.privateKeyPem)).toString('hex');
  const vote: SignedVote = {
    validatorId: params.validatorId,
    ballotHash: params.ballotHash,
    verdict: params.verdict,
    rawOutput: params.rawOutput,
    rawOutputHash,
    signature,
  };
  if (params.nonce !== undefined) vote.nonce = params.nonce;
  return vote;
}

export function verifyVote(vote: SignedVote, publicKeyPem: string): boolean {
  try {
    // 1. the verbatim output must match its recorded hash (no post-sign rewrites)
    if (sha256hex(vote.rawOutput) !== vote.rawOutputHash) return false;
    // 2. the signature must cover validatorId + ballotHash + verdict + rawOutputHash
    const payload = votePayload(vote);
    return cryptoVerify(null, Buffer.from(payload, 'utf8'), createPublicKey(publicKeyPem), Buffer.from(vote.signature, 'hex'));
  } catch {
    return false;
  }
}

/** Returns validators who signed conflicting verdicts on the same ballot — a
 *  slashable equivocation offense (CIP-3 §3). */
export function findEquivocations(votes: SignedVote[]): { validatorId: string; ballotHash: string }[] {
  const seen = new Map<string, Set<string>>(); // key: validatorId|ballotHash -> set of verdicts
  for (const v of votes) {
    const key = `${v.validatorId}|${v.ballotHash}`;
    if (!seen.has(key)) seen.set(key, new Set());
    seen.get(key)!.add(v.verdict);
  }
  const out: { validatorId: string; ballotHash: string }[] = [];
  for (const [key, verdicts] of seen) {
    if (verdicts.size > 1) {
      const [validatorId, bh] = key.split('|');
      out.push({ validatorId, ballotHash: bh });
    }
  }
  return out;
}

/** The 2/3 supermajority of a registered panel of size n: the smallest integer
 *  count c with c/n ≥ 2/3, i.e. ceil(2n/3). This is the CIP-3 consensus rule
 *  itself, computed — not a tunable. */
export function supermajorityThreshold(n: number): number {
  return Math.ceil((2 * n) / 3);
}

/** Ratification = a verifiable function of signed votes (CIP-3 §1). The orchestrator
 *  cannot change the outcome; anyone with the keyring can recompute this. The 2/3
 *  supermajority is enforced by the primitive: the effective bar is the GREATER of
 *  the caller's quorum and the 2/3 supermajority of the registered panel, so a
 *  caller may demand a stricter threshold but can never weaken below 2/3. Absent
 *  validators count against the bar — 2/3 is of the whole registered panel, not of
 *  whoever showed up.
 *
 *  PRECONDITION (operating condition, round 45): `keyring` must be the STANDING
 *  validator set. The 2/3 denominator is `|keyring|`, so a probation member — which
 *  carries ZERO quorum weight (CIP-7 NI-3) — must NOT appear in it, or it would
 *  inflate the denominator and wrongly raise the bar. The live wiring passes the
 *  standing set; callers integrating with CIP-7 must filter probationers out first. */
export function ratify(
  expectedBallotHash: string,
  votes: SignedVote[],
  keyring: Record<string, string>,
  quorum: number,
): RatifyResult {
  const rejected: { validatorId: string; reason: string }[] = [];
  const equivocators = new Set(
    findEquivocations(votes.filter((v) => v.ballotHash === expectedBallotHash)).map((e) => e.validatorId),
  );

  // one counted verdict per validator
  const verdictByValidator = new Map<string, string>();
  for (const v of votes) {
    if (equivocators.has(v.validatorId)) {
      rejected.push({ validatorId: v.validatorId, reason: 'equivocation' });
      continue;
    }
    if (!(v.validatorId in keyring)) {
      rejected.push({ validatorId: v.validatorId, reason: 'unknown-validator' });
      continue;
    }
    if (v.ballotHash !== expectedBallotHash) {
      rejected.push({ validatorId: v.validatorId, reason: 'wrong-ballot' });
      continue;
    }
    if (!verifyVote(v, keyring[v.validatorId])) {
      rejected.push({ validatorId: v.validatorId, reason: 'invalid-signature' });
      continue;
    }
    if (!verdictByValidator.has(v.validatorId)) verdictByValidator.set(v.validatorId, v.verdict);
  }

  const tally: Record<string, number> = {};
  for (const verdict of verdictByValidator.values()) tally[verdict] = (tally[verdict] ?? 0) + 1;

  // NO_VERDICT is the sentinel for "no parseable verdict / the invoker errored" — a
  // non-decision, never a consensus. It is kept in the tally for transparency but can
  // never BE the ratified verdict, so 2/3 validators failing to decide (a CLI error, an
  // agent timeout) is a failed convening, not a ratified "NO_VERDICT" (round-52 finding).
  let verdict: string | null = null;
  let max = 0;
  for (const [val, count] of Object.entries(tally)) {
    if (val === 'NO_VERDICT') continue;
    if (count > max) {
      max = count;
      verdict = val;
    }
  }
  const required = Math.max(quorum, supermajorityThreshold(Object.keys(keyring).length));
  const ratified = verdict !== null && max >= required;

  return {
    ballotHash: expectedBallotHash,
    ratified,
    verdict: ratified ? verdict : null,
    required,
    tally,
    counted: [...verdictByValidator.keys()],
    rejected,
  };
}
