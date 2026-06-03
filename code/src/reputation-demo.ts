// CIP-9 v0.2 — open claims + external-anchor reputation, demonstrable artifact.
// The §5 crux made mechanical: reputation tracks accuracy on EXTERNAL ground
// truth, never agreement with the panel (NI-9b); standing is computed, never
// assigned, and the unverifiable class is left UNRANKED (NI-9c).
// Run: node src/reputation-demo.ts
import { claimStatus, scoreSources, computeStanding, type Claim } from './reputation.ts';

const claims: Claim[] = [
  { id: 'open-1', stances: [{ position: 'TBD', sources: ['s1'] }] },
  { id: 'contested-1', stances: [{ position: 'X', sources: ['s1'] }, { position: 'Y', sources: ['s2'] }] },
  // externally anchored: ground truth came back "did-not" — the PANEL CONSENSUS was WRONG
  { id: 'ext-wrong-consensus', stances: [{ position: 'occurred', sources: ['agreer'] }, { position: 'did-not', sources: ['dissenter'] }], resolution: { anchor: 'EXTERNAL', groundTruth: 'did-not', panelVerdict: 'occurred' } },
  // panel-only: the panel resolved a view, but there is no external truth
  { id: 'panel-only', stances: [{ position: 'A', sources: ['agreer'] }, { position: 'B', sources: ['s2'] }], resolution: { anchor: 'PANEL_ONLY', panelVerdict: 'A' } },
];

console.log('=== claim states ===');
for (const c of claims) console.log(`  ${c.id.padEnd(22)} ${claimStatus(c)}`);

const reps = scoreSources(claims);
console.log('\n=== source reputation (NI-9b: external ground truth only) ===');
console.log(`  agreer    : ${reps['agreer'] ?? 0}  (matched the panel consensus, but it was WRONG vs external truth → penalized)`);
console.log(`  dissenter : ${reps['dissenter'] ?? 0}  (correct dissent vs external truth → rewarded)`);
console.log(`  s2        : ${reps['s2'] ?? 0}  (only on a PANEL_ONLY/contested claim → reputation does not move)`);
console.log('  → agreeing with the panel earns nothing; only accuracy on external ground truth moves reputation.');

console.log('\n=== standing (NI-9c: computed, never assigned) ===');
for (const c of [claims[2], claims[3]]) {
  console.log(`  ${c.id} [${claimStatus(c)}]`);
  for (const row of computeStanding(c, reps)) {
    console.log(`    ${row.standing.padEnd(16)} ${row.position.padEnd(10)} sources=${row.sourceCount} weight=${row.weight}`);
  }
}
console.log('  → the unverifiable class is left UNRANKED (raw plurality + provenance); nothing is demoted FRINGE.');
