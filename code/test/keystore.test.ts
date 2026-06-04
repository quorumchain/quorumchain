import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadOrCreateKeyring, loadPinnedKeyring, assertMatchesPin } from '../src/keystore.ts';
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

test('loadPinnedKeyring reads the published id→publicKey map; throws if not published', () => {
  const path = join(tmpDir(), 'pinned-keyring.json');
  assert.throws(() => loadPinnedKeyring(path), /not found|publish/i); // must publish first
  writeFileSync(path, JSON.stringify({ V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' }));
  assert.deepEqual(loadPinnedKeyring(path), { V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' });
});

test('assertMatchesPin passes when every pinned validator presented its pinned key', () => {
  const pinned = { V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' };
  assert.doesNotThrow(() => assertMatchesPin({ ...pinned }, pinned));
});

test('assertMatchesPin throws when a host substitutes a different key for a validator', () => {
  const pinned = { V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' };
  const presented = { V1: 'PUBKEY_1', V2: 'ATTACKER_KEY', V3: 'PUBKEY_3' };
  assert.throws(() => assertMatchesPin(presented, pinned), /V2.*pinned|substitution/i);
});

test('assertMatchesPin ALLOWS an absent validator (a liveness event, not a substitution)', () => {
  const pinned = { V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' };
  // V2's host failed to start, so it presents no key — that is an absence (handled by
  // quorum), not a key substitution. The pin only forbids serving a WRONG key.
  assert.doesNotThrow(() => assertMatchesPin({ V1: 'PUBKEY_1', V3: 'PUBKEY_3' }, pinned));
});

test('assertMatchesPin throws when a validator NOT in the pin presents a key (unknown)', () => {
  const pinned = { V1: 'PUBKEY_1', V2: 'PUBKEY_2', V3: 'PUBKEY_3' };
  assert.throws(() => assertMatchesPin({ V1: 'PUBKEY_1', VX: 'rogue' }, pinned), /VX.*pinned|unknown/i);
});
