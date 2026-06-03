// End-to-end demo of the CIP-3 signed-vote protocol: a 3-validator panel signs
// votes on one ballot, the votes are appended to a tamper-evident log, and the
// ratification is computed as a function anyone can recompute. Run:
//   node src/demo.ts
import { generateValidatorKey, ballotHash, signVote, ratify } from './signed-vote.ts';
import { appendVote, verifyLog, readLog } from './vote-log.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const V = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(V).map(([id, k]) => [id, k.publicKeyPem]));

const prompt = 'Did model Llumo-3 exceed 80 on GPQA before Oct 1?';
const context = 'evidence: harnessA=81.4, harnessB=78.9, spec=no-named-harness';
const bh = ballotHash(prompt, context);

const votes = [
  signVote({ validatorId: 'V1', privateKeyPem: V.V1.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'Spec names no harness; 81.4 is a valid documented result.' }),
  signVote({ validatorId: 'V2', privateKeyPem: V.V2.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'Cleared 80 under a documented setup; flag harness ambiguity.' }),
  signVote({ validatorId: 'V3', privateKeyPem: V.V3.privateKeyPem, ballotHash: bh, verdict: 'NO', rawOutput: 'Standard GPQA harness gives 78.9; question implies the canonical eval.' }),
];

const logPath = join(mkdtempSync(join(tmpdir(), 'qrm-demo-')), 'votes.log');
for (const v of votes) appendVote(logPath, v);

const result = ratify(bh, votes, keyring, 2);

console.log('Ballot hash :', bh);
console.log('Ratified    :', result.ratified, '| verdict:', result.verdict, '| tally:', JSON.stringify(result.tally));
console.log('Counted     :', result.counted.join(', '));
console.log('Log         :', logPath);
console.log('Log entries :', readLog(logPath).length, '| chain valid:', verifyLog(logPath).valid);
console.log('\nAnyone holding the keyring + log can recompute this verdict; the orchestrator cannot fake or alter it.');
