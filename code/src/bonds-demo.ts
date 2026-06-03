// CIP-8 v0.2 bonds & stake — demonstrable artifact. BOND mode + the autonomy
// gate (unbonded agents excluded from high-value contexts) + slash-on-violation
// + NI-8b evidence teeth. Run: node src/bonds-demo.ts
import { createHash } from 'node:crypto';
import { generateValidatorKey } from './signed-vote.ts';
import { createBond, registerBond, isAuthorized, settleBond, challengeCommitment, type BondRegistry } from './bonds.ts';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const agent = generateValidatorKey();
const mkBond = (stake: number) => createBond({
  subjectPublicKeyPem: agent.publicKeyPem, subjectPrivateKeyPem: agent.privateKeyPem,
  constraint: 'procurement agent will not exceed a $50k order without human sign-off',
  criteria: 'violated iff an order > $50,000 settles with no linked approval token',
  stake, timestamp: '2026-06-04T12:00:00Z',
});

console.log('=== the autonomy gate (§6 flywheel) ===');
let reg: BondRegistry = { bonds: [] };
console.log(`  unbonded agent, $1000 context → authorized: ${isAuthorized(reg, agent.publicKeyPem, 1000)}`);
reg = registerBond(reg, mkBond(500));
console.log(`  bonded $500,  $1000 context → authorized: ${isAuthorized(reg, agent.publicKeyPem, 1000)} (under-bonded)`);
reg = registerBond(reg, mkBond(1000));
console.log(`  bonded $1000, $1000 context → authorized: ${isAuthorized(reg, agent.publicKeyPem, 1000)}`);

console.log('\n=== slash-on-violation (settled against a RESOLUTION) ===');
const b = mkBond(1000);
// the resolution must be of the bond's OWN frozen-criteria ballot (hash-bound)
const sl = settleBond(b, { ballotHash: b.ballotHash, violated: true });
const ok = settleBond(b, { ballotHash: b.ballotHash, violated: false });
console.log(`  RESOLUTION: constraint violated → status ${sl.status}, slashed ${sl.slashed} of ${b.stake}`);
console.log(`  RESOLUTION: no violation        → status ${ok.status}, slashed ${ok.slashed}`);
try {
  settleBond(b, { ballotHash: 'a'.repeat(64), violated: true });
} catch (e) {
  console.log(`  RESOLUTION of a DIFFERENT ballot → refused (${(e as Error).message.split('—')[0].trim()})`);
}

console.log('\n=== NI-8b — evidence commitments have teeth or no weight ===');
const evidence = 'tool-call-log: order #4471 $42,300 + approval token 0x9af';
const commitment = h(evidence);
console.log(`  disclosed (matches) in window → ${JSON.stringify(challengeCommitment(commitment, { disclosure: evidence, withinWindow: true }))}`);
console.log(`  never disclosed               → ${JSON.stringify(challengeCommitment(commitment, { disclosure: null, withinWindow: true }))}`);
console.log(`  disclosed after window closed → ${JSON.stringify(challengeCommitment(commitment, { disclosure: evidence, withinWindow: false }))}`);
console.log('\n  → a sealed commitment proves non-repudiation, never content; unrevealed = zero weight, no privileged decryptor.');
