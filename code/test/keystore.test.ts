import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrCreateKeyring } from '../src/keystore.ts';
import { signVote, verifyVote, ballotHash } from '../src/signed-vote.ts';

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'qrm-ks-'));
}

test('loadOrCreateKeyring creates a key per requested validator', () => {
  const ks = loadOrCreateKeyring(tmpDir(), ['V1', 'V2', 'V3']);
  assert.deepEqual(Object.keys(ks.keys).sort(), ['V1', 'V2', 'V3']);
  assert.deepEqual(Object.keys(ks.keyring).sort(), ['V1', 'V2', 'V3']);
});

test('the keyring public key matches the stored private key (sign/verify roundtrip)', () => {
  const ks = loadOrCreateKeyring(tmpDir(), ['V1']);
  const vote = signVote({ validatorId: 'V1', privateKeyPem: ks.keys.V1.privateKeyPem, ballotHash: ballotHash('q', 'c'), verdict: 'YES', rawOutput: 'r' });
  assert.equal(verifyVote(vote, ks.keyring.V1), true);
});

test('keys are stable: a second load from the same dir returns identical keys', () => {
  const dir = tmpDir();
  const first = loadOrCreateKeyring(dir, ['V1', 'V2']);
  const second = loadOrCreateKeyring(dir, ['V1', 'V2']);
  assert.equal(first.keys.V1.privateKeyPem, second.keys.V1.privateKeyPem);
  assert.equal(first.keyring.V2, second.keyring.V2);
});

test('adding a new validator later keeps existing keys and creates only the new one', () => {
  const dir = tmpDir();
  const first = loadOrCreateKeyring(dir, ['V1']);
  const second = loadOrCreateKeyring(dir, ['V1', 'V2']);
  assert.equal(first.keys.V1.privateKeyPem, second.keys.V1.privateKeyPem); // unchanged
  assert.ok(second.keys.V2.privateKeyPem.includes('PRIVATE KEY')); // freshly created
});
