import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ballotHash } from '../src/signed-vote.ts';
import { verifyEntry, loadRegistry, appendBallot, statementFor, type BallotRegistryEntry } from '../src/ballot-registry.ts';

function tmpRegistry(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-reg-')), 'ballots.jsonl');
}

// --- self-verification: a statement counts only if it re-hashes to the ballotHash ---

test('verifyEntry: an entry whose prompt+context re-hash to its ballotHash verifies', () => {
  const prompt = 'Did the agent breach its bond?';
  const context = 'evidence';
  const entry: BallotRegistryEntry = { ballotHash: ballotHash(prompt, context), prompt, context };
  assert.equal(verifyEntry(entry), true);
});

test('verifyEntry: a tampered statement fails (the hash no longer matches)', () => {
  const prompt = 'Did the agent breach its bond?';
  const context = 'evidence';
  const entry: BallotRegistryEntry = { ballotHash: ballotHash(prompt, context), prompt: 'a different question', context };
  assert.equal(verifyEntry(entry), false);
});

// --- load / append (dedup) / resolve statement ---

test('appendBallot then loadRegistry round-trips a verifiable entry', () => {
  const path = tmpRegistry();
  appendBallot(path, 'Q1', 'C1');
  const reg = loadRegistry(path);
  assert.equal(reg.length, 1);
  assert.equal(reg[0].prompt, 'Q1');
  assert.equal(verifyEntry(reg[0]), true);
});

test('appendBallot dedups by ballotHash (same prompt+context appended once)', () => {
  const path = tmpRegistry();
  appendBallot(path, 'Q1', 'C1');
  appendBallot(path, 'Q1', 'C1');
  assert.equal(loadRegistry(path).length, 1);
});

test('loadRegistry on a missing file is empty (no throw)', () => {
  assert.deepEqual(loadRegistry(tmpRegistry()), []);
});

test('statementFor returns the prompt only for a verified entry, else null', () => {
  const path = tmpRegistry();
  appendBallot(path, 'What happened?', 'ctx');
  const reg = loadRegistry(path);
  const bh = reg[0].ballotHash;
  assert.equal(statementFor(reg, bh), 'What happened?');
  assert.equal(statementFor(reg, 'unknown-hash'), null);
  const tampered = [{ ballotHash: bh, prompt: 'forged', context: 'ctx' }];
  assert.equal(statementFor(tampered, bh), null);
});
