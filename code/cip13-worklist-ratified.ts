// CIP-13 v0.3 — re-run the review worklist with PANEL-RATIFIED types wired in as real
// type sub-claims. Combines the core verdict log + the 9 dev type-ballots, links each
// via ballotMeta.typesClaimFor, and lets buildClaimIndex derive the ratified type from
// each sub-claim's verdict (verdict-as-type). Pure read; no chain writes.
import { readFileSync, writeFileSync } from 'node:fs';
import { buildClaimIndex, reviewQueue, type BallotMeta, type ContraryDossier } from './src/commons.ts';
import type { SignedVote } from './src/signed-vote.ts';

const coreVotes: SignedVote[] = readFileSync('data/votes.log', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l).vote);
const devVotes: SignedVote[] = readFileSync('data/votes-dev.log', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l).vote);
const keyring = JSON.parse(readFileSync('pinned-keyring.json', 'utf8'));
const meta = JSON.parse(readFileSync('data/cip13-meta.json', 'utf8')) as { types: Record<string, BallotMeta['epistemicType']>; dossiers: Record<string, ContraryDossier> };
const typeclaims = readFileSync('data/cip13-typeclaims.jsonl', 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

const ballotMeta: Record<string, BallotMeta> = {};
for (const [bh, t] of Object.entries(meta.types)) ballotMeta[bh] = { epistemicType: t };
const typeBallotHashes = new Set<string>();
for (const tc of typeclaims) { ballotMeta[tc.typeBallotHash] = { typesClaimFor: tc.coreBallotHash }; typeBallotHashes.add(tc.typeBallotHash); }

const votes = [...coreVotes, ...devVotes.filter((v) => typeBallotHashes.has(v.ballotHash))];
const index = buildClaimIndex(votes, keyring, 2, {}, ballotMeta, meta.dossiers);
const queue = reviewQueue(index);
const byHash = new Map(index.map((c) => [c.ballotHash, c]));

console.log(`\nAfter panel-ratified typing — reviewQueue now flags ${queue.length} claims (was 9):\n`);
for (const q of queue) {
  const c = byHash.get(q.ballotHash)!;
  console.log(`  [${q.ballotHash.slice(0, 10)}] ${c.epistemicType} (ratified=${c.typeRatified})  verdict=${c.verdict}  ${q.reason}`);
}
console.log('\nDropped OUT (re-typed NORMATIVE by the panel — no external anchor to re-adjudicate):');
for (const tc of typeclaims) {
  const c = byHash.get(tc.coreBallotHash)!;
  if (c.epistemicType === 'NORMATIVE') console.log(`  [${tc.coreBallotHash.slice(0, 10)}] -> NORMATIVE (ratified=${c.typeRatified})  ${tc.claim.slice(0, 54)}`);
}
writeFileSync('data/cip13-review-worklist-ratified.json', JSON.stringify(queue, null, 1));
