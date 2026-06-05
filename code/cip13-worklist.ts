// CIP-13 data-plumbing runner (one-off; gitignored output). Projects the REAL core
// verdict log through the CIP-13 v0.1–v0.3 read path using the steward-proposed types
// + the CIP-10 adversarial-auditor dossiers (data/cip13-meta.json), and emits the
// reviewQueue worklist — the live EMPIRICAL_LIVE claims flagged for re-adjudication.
//
// Pure read: no chain writes. Types here are STEWARD-PROPOSED (typeRatified=false);
// panel ratification would be a v0.3 type sub-claim convene. Run: node cip13-worklist.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { buildClaimIndex, reviewQueue, type BallotMeta, type ContraryDossier } from './src/commons.ts';
import type { SignedVote } from './src/signed-vote.ts';

const votes: SignedVote[] = readFileSync('data/votes.log', 'utf8')
  .split('\n').filter((l) => l.trim())
  .map((l) => JSON.parse(l).vote);
const keyring: Record<string, string> = JSON.parse(readFileSync('pinned-keyring.json', 'utf8'));
const meta = JSON.parse(readFileSync('data/cip13-meta.json', 'utf8')) as {
  types: Record<string, BallotMeta['epistemicType']>;
  dossiers: Record<string, ContraryDossier>;
};

const ballotMeta: Record<string, BallotMeta> = {};
for (const [bh, t] of Object.entries(meta.types)) ballotMeta[bh] = { epistemicType: t };

const index = buildClaimIndex(votes, keyring, 2, {}, ballotMeta, meta.dossiers);
const queue = reviewQueue(index); // contrary-weight triggers (no cadence opts)

const byHash = new Map(index.map((c) => [c.ballotHash, c]));
console.log(`\nCIP-13 review worklist over the REAL Commons — ${index.length} ballots projected, ${Object.keys(meta.types).length} typed`);
console.log(`reviewQueue flagged ${queue.length} live EMPIRICAL_LIVE claims for re-adjudication:\n`);
const out = queue.map((q) => {
  const c = byHash.get(q.ballotHash)!;
  console.log(`  [${q.ballotHash.slice(0, 10)}] ${q.contraryWeight}/${q.reason}  verdict-of-record=${c.verdict}`);
  console.log(`     falsification: ${q.falsificationConditions[0]?.requiredAnchoredEvidence?.slice(0, 100) ?? '(none recorded)'}`);
  return { ballotHash: q.ballotHash, contraryWeight: q.contraryWeight, reason: q.reason, verdictOfRecord: c.verdict, falsificationConditions: q.falsificationConditions };
});
writeFileSync('data/cip13-review-worklist.json', JSON.stringify(out, null, 1));
console.log(`\nwrote data/cip13-review-worklist.json (${out.length} items)`);
