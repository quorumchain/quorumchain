import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseVerdict, buildPrompt, convene, startSigners } from '../src/panel.ts';
import { makeLocalSigner, type Signer } from '../src/signer.ts';
import { generateValidatorKey, ballotHash, verifyVote, signVote } from '../src/signed-vote.ts';
import { readLog, verifyLog } from '../src/vote-log.ts';
import { loadRegistry, statementFor } from '../src/ballot-registry.ts';

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
    return makeLocalSigner({ validatorId: id, key: k, deliberate: async () => ({ verdict: parseVerdict(out), rawOutput: out }) });
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

// --- liveness (Phase 0.5): a dead validator process must not abort the convening ---

const deadSigner = (id: string): Signer => ({
  validatorId: id,
  publicKeyPem: `PLACEHOLDER_${id}`,
  signBallot: async () => { throw new Error('remote signer host exited before answering'); },
});

test('convene survives a dead validator: records the failure, ratifies on the standing quorum', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES' }); // 2 live
  keyring.V3 = 'PLACEHOLDER_V3'; // V3 is a registered validator whose host is down
  const logPath = tmpLog();
  const r = await convene({ prompt: 'q', context: 'c', signers: [...signers, deadSigner('V3')], keyring, quorum: 2, logPath });
  assert.equal(r.ratified, true); // 2/3 of the registered panel still met — a dead host does not hang or abort
  assert.equal(r.verdict, 'YES');
  assert.equal(r.votes.length, 2); // only the live validators produced signed votes
  assert.deepEqual(r.failures.map((f) => f.validatorId), ['V3']); // the absence is recorded, never fabricated
  assert.equal(readLog(logPath).length, 2); // the dead validator wrote nothing to the log
});

test('startSigners tolerates a host that fails its startup handshake: records it, returns the rest', async () => {
  // round-49 V2 finding: run-panel must not abort the whole convening if ONE host
  // dies at startup. A failed signer factory is a recorded startup absence, not a throw.
  const make = async (id: string): Promise<Signer> => {
    if (id === 'V2') throw new Error('remote signer host exited before answering');
    return { validatorId: id, publicKeyPem: `PK_${id}`, signBallot: async () => { throw new Error('unused'); } };
  };
  const { started, startupFailures } = await startSigners(['V1', 'V2', 'V3'], make);
  assert.deepEqual(started.map((s) => s.validatorId), ['V1', 'V3']); // the two that came up
  assert.deepEqual(startupFailures.map((f) => f.validatorId), ['V2']); // the dead one, recorded not thrown
  assert.match(startupFailures[0].error, /exited/);
});

test('convene does NOT ratify when failures drop it below the 2/3 bar', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES' }); // only 1 live
  keyring.V2 = 'PLACEHOLDER_V2';
  keyring.V3 = 'PLACEHOLDER_V3';
  const r = await convene({ prompt: 'q', context: 'c', signers: [...signers, deadSigner('V2'), deadSigner('V3')], keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.ratified, false); // 1 vote is below 2/3 of the 3 registered
  assert.equal(r.failures.length, 2);
});

// --- read surface (round-58): convene records the ballot statement to the registry ---

test('convene records the ballot to the registry when registryPath is set (verifiable statement)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES', V3: 'VERDICT: NO' });
  const registryPath = join(mkdtempSync(join(tmpdir(), 'qrm-cv-')), 'ballots.jsonl');
  await convene({ prompt: 'Did X occur?', context: 'evidence', signers, keyring, quorum: 2, logPath: tmpLog(), registryPath });
  const reg = loadRegistry(registryPath);
  assert.equal(statementFor(reg, ballotHash('Did X occur?', 'evidence')), 'Did X occur?'); // recoverable AND hash-verified
});

test('convene without registryPath writes no registry (back-compatible)', async () => {
  const { signers, keyring } = fakePanel({ V1: 'VERDICT: YES', V2: 'VERDICT: YES' });
  const r = await convene({ prompt: 'q', context: 'c', signers, keyring, quorum: 2, logPath: tmpLog() });
  assert.equal(r.votes.length, 2); // no throw, no registry required
});

// --- replay nonce (round-57): convene issues a per-convening nonce and rejects a
// vote that does not carry it, so a vote from one convening cannot be replayed into another ---

test('convene rejects a vote that does not carry the convening nonce (anti-replay)', async () => {
  // A signer that ignores the issued nonce and stamps a STALE one — i.e. a replayed
  // vote from a different convening. convene must not count it.
  const k = generateValidatorKey();
  const stale: Signer = {
    validatorId: 'V1',
    publicKeyPem: k.publicKeyPem,
    signBallot: async (p, c) =>
      signVote({ validatorId: 'V1', privateKeyPem: k.privateKeyPem, ballotHash: ballotHash(p, c), verdict: 'YES', rawOutput: 'VERDICT: YES', nonce: 'STALE' }),
  };
  const { signers, keyring } = fakePanel({ V2: 'VERDICT: YES', V3: 'VERDICT: YES' });
  keyring.V1 = k.publicKeyPem;
  const r = await convene({ prompt: 'q', context: 'c', signers: [stale, ...signers], keyring, quorum: 2, logPath: tmpLog() });
  assert.ok(r.failures.some((f) => f.validatorId === 'V1')); // the stale-nonce vote is rejected
  assert.equal(r.votes.length, 2); // only the two correctly-bound votes are counted
  assert.equal(r.verdict, 'YES'); // and they still carry the convening
});
