// Demo: the tamper-evident STATE log (round-44 #6, local interim). Records the key
// state transitions of one accountability story — the same arc scenario.ts threads
// through the modules — into a single hash chain, verifies it, then shows that
// editing any past transition breaks the chain.  Run: node src/state-log-demo.ts
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendState, readStateLog, verifyStateLog } from './state-log.ts';

const path = join(mkdtempSync(join(tmpdir(), 'qrm-state-demo-')), 'state.log');
const ts = '2026-06-04T12:00:00Z';

console.log('=== module state transitions appended to one tamper-evident chain ===');
const events = [
  { module: 'registry', type: 'ADMIT', ref: 'corpus-A', payload: { operator: 'A' }, timestamp: ts },
  { module: 'bond', type: 'CREATE', ref: 'a79eb36d11f0', payload: { subject: 'agent', stake: 1000 }, timestamp: ts },
  { module: 'notary', type: 'ATTEST', ref: 'order#4471', payload: { status: 'NOT_VERIFIED' }, timestamp: ts },
  { module: 'bond', type: 'SETTLE', ref: 'a79eb36d11f0', payload: { status: 'SLASHED', slashed: 1000 }, timestamp: ts },
  { module: 'reputation', type: 'SCORE', ref: 'a79eb36d11f0', payload: { 'A': +1, 'D': -1 }, timestamp: ts },
  { module: 'lifecycle', type: 'ROTATE', ref: 'D', payload: { replacedBy: 'E', floorOk: true }, timestamp: ts },
];
for (const e of events) {
  const entry = appendState(path, e);
  console.log(`  [${e.module}] ${e.type} ${e.ref} → entry ${entry.entryHash.slice(0, 12)}…`);
}
console.log(`  chain valid: ${verifyStateLog(path).valid} (${readStateLog(path).length} entries)`);

console.log('\n=== tamper: silently rewrite the slash to release the stake ===');
const log = readStateLog(path);
log[3].payload = { status: 'RELEASED', slashed: 0 }; // pretend the violation never happened
writeFileSync(path, log.map((l) => JSON.stringify(l)).join('\n') + '\n');
const v = verifyStateLog(path);
console.log(`  chain valid: ${v.valid}  brokenAt: ${v.brokenAt}`);
console.log('  → the edit is detectable: rewriting any past transition breaks every hash after it.');
console.log('\n  (interim per CIP-3/CIP-4: tamper-EVIDENCE now; on-chain anchoring + per-event authorization at testnet.)');
