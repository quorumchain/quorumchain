// CIP-9 v0.1 resolution-index — demonstrable artifact.
// Projects the real signed verdict log (data/votes.log) into a claim graph and
// shows the Commons property: consensus AND credible dissent preserved with
// provenance, on an un-rewritable record. The live rounds 41 (Ukraine, NO 2/1)
// and 43 (Barron, INDETERMINATE 2/1) are real preserved-dissent claims.
// Run:  node src/commons-demo.ts
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadOrCreateKeyring } from './keystore.ts';
import { readLog, verifyLog } from './vote-log.ts';
import { buildClaimIndex, queryClaim, type Claim } from './commons.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const VOTES_LOG = join(DATA, 'votes.log');

if (!existsSync(VOTES_LOG)) {
  console.log('data/votes.log not present in this checkout — see test/commons.test.ts for the projection on synthetic ballots.');
  process.exit(0);
}

const ks = loadOrCreateKeyring(join(DATA, 'keystore'), ['V1', 'V2', 'V3']);
const votes = readLog(VOTES_LOG).map((e) => e.vote);
const index = buildClaimIndex(votes, ks.keyring, 2);

const byStatus: Record<string, number> = {};
for (const c of index) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1;

console.log('=== CIP-9 v0.1 resolution-index (projected from data/votes.log) ===');
console.log('  log chain valid :', verifyLog(VOTES_LOG).valid, '(G2: the graph is a pure projection of an un-rewritable log)');
console.log('  claims indexed  :', index.length, '|', JSON.stringify(byStatus));

const splits = index.filter((c) => c.stances.length > 1);
console.log(`  claims with preserved dissent : ${splits.length} (G1: the losing stance is never flattened)`);

function show(label: string, prefix: string) {
  const c = index.find((x) => x.ballotHash.startsWith(prefix)) as Claim | undefined;
  if (!c) return;
  console.log(`\n  ${label} — ${c.ballotHash.slice(0, 12)}… [${c.status}] verdict=${c.verdict}`);
  for (const s of c.stances) {
    console.log(`    ${s.standing.padEnd(16)} ${s.position.padEnd(14)} held by ${s.validators.join(', ')} (panelVotes=${s.panelVotes})`);
  }
  console.log(`    panel-state receipt (NI-9a): {${c.panelStateReceipt.validators.join(', ')}}, size=${c.panelStateReceipt.size}`);
}

show('Round 41 — $7M Ukraine mineral deal', '0a95078997af');
show('Round 43 — Barron Trump DJT memecoin', 'b644657f7fc8');
show('Round 29 — MicroStrategy/Polymarket', 'de9b27665619');

console.log('\n  → The dissent (V2 YES on Ukraine; V3 NO on Barron) is a first-class CREDIBLE_MINORITY stance with its');
console.log('    author named — exactly what a single-model answer structurally cannot preserve. No reputation is');
console.log('    computed (NI-9b/v0.2); nothing is ranked FRINGE (NI-9c). This is the read pillar of "an AI oracle');
console.log('    with a memory": CIP-8 writes the verdicts, CIP-9 is the un-rewritable map they flow into.');
