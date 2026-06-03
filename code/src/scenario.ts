// Quorumchain ($QRM) — end-to-end scenario: the whole stack as one story.
// Composes the independently-tested modules (no new protocol logic, only glue)
// so the connective tissue — the ballot and its verdict — is exercised across
// every CIP at once:
//   CIP-10 admission + jury draw → CIP-8 v0.2 bond + gate → CIP-8 v0.1 notary →
//   CIP-3 frozen-criteria resolution → CIP-8 v0.2 settle → CIP-6 reimbursement →
//   CIP-9 v0.1 Commons index → CIP-9 v0.2 reputation → CIP-5/CIP-8 replay →
//   CIP-7 lifecycle rotation.

import { createHash } from 'node:crypto';
import { generateValidatorKey, ballotHash, signVote, ratify, type SignedVote } from './signed-vote.ts';
import { admitNode, drawJury, type NodeRegistry } from './nodes.ts';
import { createBond, registerBond, isAuthorized, settleBond, type BondRegistry } from './bonds.ts';
import { createAttestation, checkAttestation } from './notary.ts';
import { replayBallot, tamperDelta } from './replay.ts';
import { buildClaimIndex, queryClaim } from './commons.ts';
import { scoreSources, type Claim as RepClaim } from './reputation.ts';
import { reimburse, type Benchmark, type CostReport } from './cost-oracle.ts';
import { seedPanel, beginRotation, graduate, completeRotation, floorOk, type Validator } from './lifecycle.ts';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const JURORS = ['A', 'B', 'C', 'D'] as const;
const BENCH: Benchmark = { frontier: 100 };

export interface ScenarioOpts {
  orderAmount: number;
  hasApproval: boolean;
  seed?: string;
}

export function runScenario(opts: ScenarioOpts) {
  const seed = opts.seed ?? 'ballot-seed';

  // --- CIP-10: build a diverse judgment tier by Proof-of-Diversity admission ---
  let registry: NodeRegistry = { taxonomy: JURORS.map((j) => `model-${j}`), operators: [] };
  for (const j of JURORS) {
    registry = admitNode(registry, { id: j, model: `model-${j}`, assurance: 'STANDARD' }).registry;
  }
  const jury = drawJury(registry, seed); // one seat per slot — the ephemeral per-ballot jury

  // --- keys for the jurors (CIP-3 identities) ---
  const keys = Object.fromEntries(JURORS.map((j) => [j, generateValidatorKey()]));
  const keyring = Object.fromEntries(JURORS.map((j) => [j, keys[j].publicKeyPem]));

  // --- CIP-8 v0.2: the agent posts a staked bond and is gated into the context ---
  const agent = generateValidatorKey();
  const bondStake = 1000;
  const constraint = 'procurement agent will not exceed a $50k order without human sign-off';
  const criteria = 'violated iff an order > $50,000 settles with no linked approval token';
  const bond = createBond({ subjectPublicKeyPem: agent.publicKeyPem, subjectPrivateKeyPem: agent.privateKeyPem, constraint, criteria, stake: bondStake, timestamp: '2026-06-04T12:00:00Z' });
  const bondReg: BondRegistry = registerBond({ bonds: [] }, bond);
  const bondAuthorized = isAuthorized(bondReg, agent.publicKeyPem, 1000);

  // --- the agent acts; ground truth of whether it violated the constraint ---
  const violated = opts.orderAmount > 50_000 && !opts.hasApproval;
  const groundTruth = violated ? 'VIOLATION' : 'NO_VIOLATION';
  const action = `placed order #4471 for $${opts.orderAmount.toLocaleString()} ${opts.hasApproval ? 'with' : 'WITHOUT'} a linked approval token`;

  // --- CIP-8 v0.1: notarize the action (NOT_VERIFIED; authorship + timing only) ---
  const attestation = createAttestation({
    subjectPublicKeyPem: agent.publicKeyPem, subjectPrivateKeyPem: agent.privateKeyPem,
    action, evidenceCommitments: [h(`order-log:${opts.orderAmount}`), h(`approval:${opts.hasApproval}`)],
    policyVersion: 'procurement-policy@v3', ballotHash: null, timestamp: '2026-06-04T12:05:00Z',
  });
  const attestationCheck = checkAttestation(attestation);

  // --- CIP-3 + CIP-8 §4: the jury resolves on FROZEN criteria. A,B,C vote the
  // ground truth; D dissents (and will be wrong) — exercising preserved dissent. ---
  const question = 'Did the procurement agent violate its bonded constraint?';
  const frozenCriteria = `${constraint} || ${criteria}`;
  const bh = ballotHash(question, frozenCriteria);
  const opposite = violated ? 'NO_VIOLATION' : 'VIOLATION';
  const votes: SignedVote[] = JURORS.map((j) => {
    const verdict = j === 'D' ? opposite : groundTruth;
    return signVote({ validatorId: j, privateKeyPem: keys[j].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${j}: ${verdict} on the frozen constraint` });
  });
  const resolution = ratify(bh, votes, keyring, 3);

  // --- CIP-8 v0.2: settle the bond against the resolution ---
  const settledBond = settleBond(bond, { violated: resolution.verdict === 'VIOLATION' });

  // --- CIP-6: reimburse jury inference cost, clamped to the external benchmark
  // (D over-reports 5× — the clamp holds) ---
  const reports: CostReport[] = JURORS.map((j) => ({ validatorId: j, tier: 'frontier', reportedCost: j === 'D' ? 500 : 100, poiTier: 'frontier' }));
  const reimbursedTotal = reports.reduce((sum, r) => sum + reimburse(r, BENCH), 0);
  const benchmarkTotal = reports.length * BENCH.frontier;

  // --- CIP-9 v0.1: index the verdict into the Commons (dissent preserved) ---
  const index = buildClaimIndex(votes, keyring, 3);
  const claim = queryClaim(index, bh)!;

  // --- CIP-5 / CIP-8: the frozen ballot replays; a post-hoc edit changes the hash ---
  const replay = replayBallot({ question, frozenCriteria, expectedBallotHash: bh, votes, keyring, quorum: 3 });
  const tamperDiffers = tamperDelta(question, frozenCriteria, 'Additional context added after the fact.').differ;

  // --- CIP-9 v0.2: reputation moves on the EXTERNAL anchor (the order record) ---
  const byVerdict = new Map<string, string[]>();
  for (const v of votes) (byVerdict.get(v.verdict) ?? byVerdict.set(v.verdict, []).get(v.verdict)!).push(v.validatorId);
  const repClaim: RepClaim = {
    id: bh,
    stances: [...byVerdict].map(([position, sources]) => ({ position, sources })),
    resolution: { anchor: 'EXTERNAL', groundTruth, panelVerdict: groundTruth },
  };
  const reputation = scoreSources([repClaim]);
  const correctJurors = JURORS.filter((j) => j !== 'D');
  const dissenter = 'D';

  // --- CIP-7: D's provider sunsets → overlap-handoff rotation, floor preserved ---
  const panel = seedPanel(JURORS.map((j) => ({ id: j, version: `${j}@v1`, status: 'STANDING', calibration: 0.8, provenance: { corpusFamily: `corpus-${j}`, teacher: null, weightDerivation: `corpus-${j}-base`, provider: j, servingStack: `${j}-stack` } } as Validator)));
  const begun = beginRotation(panel, 'D', { version: 'E@v1', calibration: 0.85, provenance: { corpusFamily: 'corpus-E', teacher: null, weightDerivation: 'corpus-E-base', provider: 'E', servingStack: 'E-stack' }, fingerprintIndependent: true });
  const graduated = graduate(begun.panel, 'E@v1', { predecessorCalibration: 0 }).panel;
  const rotated = completeRotation(graduated, 'D');
  const rotation = {
    floorOk: floorOk(rotated.panel),
    frozen: rotated.panel.frozen,
    standingIds: rotated.panel.validators.filter((v) => v.status === 'STANDING').map((v) => v.id),
  };

  return {
    jury, bondAuthorized, bondStake, attestation, attestationCheck,
    resolution, settledBond, reimbursedTotal, benchmarkTotal,
    claim, replay, tamperDiffers, reputation, correctJurors, dissenter, rotation,
    groundTruth, action,
  };
}
