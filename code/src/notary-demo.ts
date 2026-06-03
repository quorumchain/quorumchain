// CIP-8 v0.1 demonstrable artifact — runs the three empirical gates end-to-end:
//   G3  notary kernel: file attestations, run procedural checks, verify the chain
//   G1  frozen-ballot integrity: post-hoc "additional context" changes the hash
//   G2  replay the live case: re-resolve the round-29 $85M Polymarket ballot from
//       its byte-exact frozen criteria and re-verify the signed YES 3/3 verdict
// Run:  node src/notary-demo.ts
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { generateValidatorKey } from './signed-vote.ts';
import { createAttestation, checkAttestation, appendAttestation, verifyAttestationLog } from './notary.ts';
import { loadOrCreateKeyring } from './keystore.ts';
import { readLog } from './vote-log.ts';
import { replayBallot, tamperDelta } from './replay.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

// ---- G3: notary kernel -------------------------------------------------------
console.log('=== G3 — notary kernel (NOTARY-mode SRA, NI-8a) ===');
const subject = generateValidatorKey();
const logPath = join(mkdtempSync(join(tmpdir(), 'qrm-notary-')), 'attestations.log');
const samples = [
  { action: 'Procurement agent placed order #4471 for $42,300 under human-signoff policy.', ev: [h('tool-call-log'), h('approval-token')] },
  { action: 'Trading agent halted execution after drawdown breached the 4% circuit.', ev: [h('risk-engine-snapshot')] },
  { action: 'Support agent issued a $0 refund and escalated to a human reviewer.', ev: [] },
];
for (const s of samples) {
  const att = createAttestation({
    subjectPublicKeyPem: subject.publicKeyPem,
    subjectPrivateKeyPem: subject.privateKeyPem,
    action: s.action,
    evidenceCommitments: s.ev,
    policyVersion: 'agent-policy@v3',
    ballotHash: null,
    timestamp: '2026-06-04T12:00:00Z',
  });
  appendAttestation(logPath, att);
  const c = checkAttestation(att);
  console.log(`  [${att.status}] accepted=${c.accepted} attributable=${c.attributable} complete=${c.complete} consistent=${c.consistent} — ${s.action.slice(0, 52)}…`);
}
console.log('  chain valid:', verifyAttestationLog(logPath).valid, '| every record labeled NOT_VERIFIED (NI-8a: authorship+timing only, never truth)');

// ---- load the round-29 frozen ballot ----------------------------------------
const manifest = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'ballot-r29-mstr.json'), 'utf8'));

// ---- G1: frozen-ballot integrity ---------------------------------------------
console.log('\n=== G1 — frozen-ballot integrity (the "Additional context" attack) ===');
const postHoc = 'Additional context: confirmation achieved outside of the market\'s timeframe does not qualify.';
const d = tamperDelta(manifest.question, manifest.frozenCriteria, postHoc);
console.log('  frozen ballot hash :', d.originalHash.slice(0, 24), '…');
console.log('  after post-hoc edit:', d.tamperedHash.slice(0, 24), '…');
console.log('  hashes differ      :', d.differ, '— Polymarket\'s post-deadline edit is mechanically a DIFFERENT ballot; it cannot be done silently.');

// ---- G2: replay the live $85M case -------------------------------------------
console.log('\n=== G2 — replay the live round-29 Polymarket resolution ===');
const VOTES_LOG = join(DATA, 'votes.log');
if (!existsSync(VOTES_LOG)) {
  console.log('  (data/votes.log not present in this checkout — G2 live-signature replay skipped; the committed fixture binding is covered by test/replay-r29.test.ts.)');
} else {
  const ks = loadOrCreateKeyring(join(DATA, 'keystore'), ['V1', 'V2', 'V3']);
  const votes = readLog(VOTES_LOG)
    .map((e) => e.vote)
    .filter((v) => v.ballotHash === manifest.expectedBallotHash);
  const r = replayBallot({
    question: manifest.question,
    frozenCriteria: manifest.frozenCriteria,
    expectedBallotHash: manifest.expectedBallotHash,
    votes,
    keyring: ks.keyring,
    quorum: 2,
  });
  console.log('  recomputed hash == signed ballot :', r.hashMatches, `(${r.recomputedHash.slice(0, 24)}…)`);
  console.log('  signed votes re-verified         :', r.voteResults.map((v) => `${v.validatorId}:${v.valid ? 'ok' : 'BAD'}`).join(' '));
  console.log('  re-ratified verdict              :', r.ratification.verdict, JSON.stringify(r.ratification.tally));
  console.log('  REPLAY OK                        :', r.replayOk);
  console.log('  → anyone holding the frozen criteria + keyring + signed votes reproduces this YES, on a record no one can edit after the fact.');
}
