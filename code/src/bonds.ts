// Quorumchain ($QRM) — CIP-8 v0.2 bonds & stake (the "teeth" graduation, §6).
// The BOND mode of the Staked Resolvable Attestation: a subject posts a signed,
// staked commitment to a constraint BEFORE acting, bound to the ballotHash of the
// constraint's evaluation criteria. Users query a subject's bond record before
// granting it autonomy — unbonded / under-bonded agents are excluded from
// high-value contexts (the demand flywheel). A bond is slashed on a RESOLUTION
// that proves the constraint was violated. NI-8b: an evidence commitment has
// teeth or no weight — disclose within the window or forfeit; an unrevealed
// commitment carries zero evidentiary weight; there is no privileged decryptor.
// Zero dependencies — Node built-in crypto only.

import { createHash, sign as cryptoSign, verify as cryptoVerify, createPublicKey, createPrivateKey } from 'node:crypto';
import { ballotHash } from './signed-vote.ts';

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

export type BondStatus = 'ACTIVE' | 'SLASHED' | 'RELEASED';

export interface Bond {
  subject: string; // Ed25519 public key (PEM) of the bonded identity
  mode: 'BOND';
  constraint: string; // the committed constraint
  ballotHash: string; // sha256(constraint || criteria) — the evaluation criteria, frozen
  stake: number; // staked amount (CIP-6 asset)
  status: BondStatus;
  slashed: number; // amount forfeited at settlement
  timestamp: string;
  signature: string; // hex
}

function bondPayload(b: Omit<Bond, 'signature' | 'status' | 'slashed'>): string {
  return JSON.stringify({ subject: b.subject, mode: b.mode, constraint: b.constraint, ballotHash: b.ballotHash, stake: b.stake, timestamp: b.timestamp });
}

export function createBond(params: {
  subjectPublicKeyPem: string;
  subjectPrivateKeyPem: string;
  constraint: string;
  criteria: string;
  stake: number;
  timestamp: string;
}): Bond {
  const unsigned = {
    subject: params.subjectPublicKeyPem,
    mode: 'BOND' as const,
    constraint: params.constraint,
    ballotHash: ballotHash(params.constraint, params.criteria),
    stake: params.stake,
    timestamp: params.timestamp,
  };
  const signature = cryptoSign(null, Buffer.from(bondPayload(unsigned), 'utf8'), createPrivateKey(params.subjectPrivateKeyPem)).toString('hex');
  return { ...unsigned, status: 'ACTIVE', slashed: 0, signature };
}

export function verifyBond(bond: Bond): boolean {
  try {
    const { signature, status, slashed, ...unsigned } = bond;
    return cryptoVerify(null, Buffer.from(bondPayload(unsigned), 'utf8'), createPublicKey(bond.subject), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export interface BondRegistry {
  bonds: Bond[];
}

export function registerBond(reg: BondRegistry, bond: Bond): BondRegistry {
  if (!verifyBond(bond)) return reg; // an unverifiable bond never enters the registry
  return { bonds: [...reg.bonds, bond] };
}

/** The gate (§6 flywheel): a subject is authorized for a context only if it holds
 *  an ACTIVE bond with stake ≥ the context's requirement. Unbonded agents are
 *  excluded from high-value contexts. */
export function isAuthorized(reg: BondRegistry, subject: string, requiredStake: number): boolean {
  return reg.bonds.some((b) => b.subject === subject && b.status === 'ACTIVE' && b.stake >= requiredStake);
}

/** Settlement against a RESOLUTION verdict: a proven violation slashes the full
 *  stake; otherwise the bond is released. The resolution MUST be of the bond's own
 *  frozen-criteria ballot — its `ballotHash` is checked against the bond's, so a
 *  bond can only be settled by the resolution OF its committed criteria, never by
 *  a resolution of some other question (the link is by hash, not by convention). */
export function settleBond(bond: Bond, resolution: { ballotHash: string; violated: boolean }): Bond {
  if (resolution.ballotHash !== bond.ballotHash) {
    throw new Error(
      `refusing to settle: resolution ballotHash ${resolution.ballotHash.slice(0, 12)}… is not the bonded criteria ballotHash ${bond.ballotHash.slice(0, 12)}… — a bond is settled only by the resolution of its own frozen criteria`,
    );
  }
  return resolution.violated
    ? { ...bond, status: 'SLASHED', slashed: bond.stake }
    : { ...bond, status: 'RELEASED', slashed: 0 };
}

export interface CommitmentChallenge {
  disclosed: boolean;
  weight: number; // 0 unless disclosed-and-matching within the window
  forfeit: boolean;
}

/** NI-8b — evidence commitments have teeth or no weight. On challenge the holder
 *  must disclose (a preimage matching the committed hash) within the window, or
 *  forfeit; an unrevealed or non-matching commitment carries zero evidentiary
 *  weight. No privileged decryptor exists. */
export function challengeCommitment(commitmentHash: string, response: { disclosure: string | null; withinWindow: boolean }): CommitmentChallenge {
  if (!response.withinWindow || response.disclosure === null) return { disclosed: false, weight: 0, forfeit: true };
  if (sha256hex(response.disclosure) === commitmentHash) return { disclosed: true, weight: 1, forfeit: false };
  return { disclosed: false, weight: 0, forfeit: true };
}
