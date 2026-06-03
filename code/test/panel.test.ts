import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseVerdict, buildPrompt, convene } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { generateValidatorKey, ballotHash, verifyVote } from '../src/signed-vote.ts';
import { readLog, verifyLog } from '../src/vote-log.ts';

function tmpLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-panel-')), 'votes.log');
}

// --- parseVerdict: pull a structured verdict out of free-text model output ---

test('parseVerdict extracts the VERDICT line', () => {
  assert.equal(parseVerdict('reasoning here\nVERDICT: YES'), 'YES');
});

test('parseVerdict is case-insensitive and uppercases the token', () => {
  assert.equal(parseVerdict('verdict: no'), 'NO');
});

test('parseVerdict takes only the first token and strips surrounding markup', () => {
  assert.equal(parseVerdict('VERDICT: **ABSTAIN** — low confidence'), 'ABSTAIN');
});

test('parseVerdict uses the last VERDICT line if the format is echoed earlier', () => {
  assert.equal(parseVerdict('format: VERDICT: <YES|NO>\n...\nVERDICT: NO'), 'NO');
});

test('parseVerdict returns NO_VERDICT when absent', () => {
  assert.equal(parseVerdict('I cannot decide.'), 'NO_VERDICT');
});

// --- buildPrompt: ballots can offer custom verdict options (multiple choice) ---

test('buildPrompt defaults to YES/NO/ABSTAIN', () => {
  assert.match(buildPrompt('q', 'c'), /VERDICT: <YES\|NO\|ABSTAIN>/);
});

test('buildPrompt offers custom verdict options when provided', () => {
  assert.match(buildPrompt('q', 'c', ['ALPHA', 'BETA', 'GAMMA']), /VERDICT: <ALPHA\|BETA\|GAMMA>/);
});

// --- convene: invoke validators, sign, log, ratify ---

function fakePanel(outputs: Record<string, string>): { signers: Signer[]; keyring: Record<string, string> } {
  const keyring: Record<string, string> = {};
  const signers = Object.entries(outputs).map(([id, out]) => {
    const k = generateValidatorKey();
    keyring[id] = k.publicKeyPem;
    return makeLocalSigner({ validatorId: id, key: k, invoke: async () => out, parseVerdict });
  });
  return { signers, keyring };
}

test('convene signs each validator output and reaches quorum', async () => {
  const { signers, keyring } = fakePanel({
    V1: 'looks right\nVERDICT: YES',
    V2: 'agree\nVERDICT: YES',
    V3: 'dissent\nVERDICT: NO',
  });
  const r = await convene({ prompt: 'Did M(I)=O?', context: 'evidence', signers, keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.ratified, true);
  assert.equal(r.verdict, 'YES');
  assert.equal(r.tally.YES, 2);
  assert.equal(r.votes.length, 3);
});

test('convene writes every vote to a tamper-evident log', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' });
  const logPath = tmpLog();
  await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath });
  assert.equal(readLog(logPath).length, 3);
  assert.equal(verifyLog(logPath).valid, true);
});

test('every logged vote verifies against the keyring and binds the ballot', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: NO', V3: 'VERDICT: YES' });
  const logPath = tmpLog();
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath });
  const expectedBallot = ballotHash('q', 'c');
  for (const entry of readLog(logPath)) {
    assert.equal(entry.vote.ballotHash, expectedBallot);
    assert.equal(verifyVote(entry.vote, keyring[entry.vote.validatorId]), true);
  }
  assert.equal(r.ballotHash, expectedBallot);
});

test('convene tallies custom verdict tokens (multiple-choice ballot)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: ALPHA', V2: 'VERDICT: ALPHA', V3: 'VERDICT: BETA' });
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: tmpLog(), verdicts: ['ALPHA', 'BETA', 'GAMMA'] });
  assert.equal(r.verdict, 'ALPHA');
  assert.equal(r.tally.ALPHA, 2);
  assert.equal(r.ratified, true);
});

test('convene records a non-voting validator as NO_VERDICT (counted but unparseable)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'I abstain from structure' });
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.tally.NO_VERDICT, 1);
  assert.equal(r.verdict, 'YES'); // 2 YES still carries quorum
});
