// End-to-end scenario — the whole Quorumchain stack as one narrated story.
// Run:  node src/scenario-demo.ts
import { runScenario } from './scenario.ts';

function narrate(opts: { orderAmount: number; hasApproval: boolean; seed: string }, title: string) {
  const r = runScenario(opts);
  console.log(`\n══════════ ${title} ══════════`);
  console.log(`  [CIP-10] jury drawn (1 per slot): ${r.jury.seats.map((s) => s.nodeId).join(', ')}`);
  console.log(`  [CIP-8 v0.2] agent bonded $${r.bondStake}, authorized for high-value context: ${r.bondAuthorized}`);
  console.log(`  [agent acts] ${r.action}`);
  console.log(`  [CIP-8 v0.1] notarized: status=${r.attestation.status}, admissible=${r.attestationCheck.accepted} (authorship+timing only)`);
  console.log(`  [CIP-3] jury resolves on frozen criteria → ${r.resolution.verdict} ${JSON.stringify(r.resolution.tally)} (D dissents)`);
  console.log(`  [CIP-8 v0.2] bond settled: ${r.settledBond.status}, slashed ${r.settledBond.slashed}`);
  console.log(`  [CIP-6] inference reimbursed: ${r.reimbursedTotal} / benchmark ceiling ${r.benchmarkTotal} (D's 5× over-report clamped)`);
  console.log(`  [CIP-9 v0.1] indexed claim [${r.claim.status}] verdict=${r.claim.verdict}; stances:`);
  for (const s of r.claim.stances) console.log(`               ${s.standing.padEnd(17)} ${s.position.padEnd(13)} ${s.validators.join(', ')}`);
  console.log(`  [CIP-5/CIP-8] frozen ballot replays: ${r.replay.replayOk}; post-hoc edit changes the hash: ${r.tamperDiffers}`);
  console.log(`  [CIP-9 v0.2] reputation (external anchor): ${r.correctJurors.map((j) => `${j}:+${r.reputation[j]}`).join(' ')}  ${r.dissenter}:${r.reputation[r.dissenter]} (wrong dissent penalized)`);
  console.log(`  [CIP-7] ${r.dissenter}'s provider sunsets → rotated out; standing now {${r.rotation.standingIds.join(', ')}}, floorOk=${r.rotation.floorOk}, frozen=${r.rotation.frozen}`);
}

console.log('A single accountability story threaded through every CIP:');
narrate({ orderAmount: 42_300, hasApproval: true, seed: 'ballot-seed-01' }, 'CLEAN PATH — order within policy, approval attached');
narrate({ orderAmount: 80_000, hasApproval: false, seed: 'ballot-seed-02' }, 'VIOLATION PATH — over the cap, no sign-off');

console.log('\n→ write (CIP-8) feeds memory (CIP-9); memory is un-rewritable and keeps the dissent;');
console.log('  diversity (CIP-10/CIP-7) is admitted and rotated with no human; the economics (CIP-6) stay solvent;');
console.log('  and the whole thing is forkable (CIP-5) if the panel is ever captured. No single party holds the pen.');
