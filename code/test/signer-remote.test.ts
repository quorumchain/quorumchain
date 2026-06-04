// RemoteSigner — OS-level key custody (closes the round-44/45 #2 residual).
// The signing key lives ONLY in a separate OS process; the orchestrator obtains
// valid signed votes over IPC but never holds the private key in its own process.
// This is the drop-in the Signer boundary pointed at — same interface, real
// custody isolation. These tests spawn the host as an actual child process.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ballotHash, verifyVote } from '../src/signed-vote.ts';
import { makeRemoteSigner } from '../src/signer.ts';
import { loadOrCreateKeyring } from '../src/keystore.ts';

const HOST = fileURLToPath(new URL('../src/remote-signer-host.ts', import.meta.url));
const DELIB_HOST = fileURLToPath(new URL('../src/deliberating-signer-host.ts', import.meta.url));
const SILENT_HOST = fileURLToPath(new URL('../test-fixtures/silent-host.ts', import.meta.url));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test('a RemoteSigner returns a vote that verifies — the key never enters this process', async () => {
  const s = await makeRemoteSigner({ validatorId: 'V1', hostPath: HOST, env: { QRM_FIXED_VERDICT: 'NO' } });
  try {
    const vote = await s.signBallot('Did the agent breach its bond?', 'evidence');
    assert.equal(vote.validatorId, 'V1');
    assert.equal(vote.verdict, 'NO'); // decided in the host process, not by the orchestrator
    assert.equal(vote.ballotHash, ballotHash('Did the agent breach its bond?', 'evidence'));
    assert.equal(verifyVote(vote, s.publicKeyPem), true); // verifies against the key held in the child
    // the orchestrator-side handle exposes only public material — no private key anywhere on it
    assert.equal('privateKeyPem' in s, false);
    const exposed = JSON.stringify(s) + Object.values(s).filter((v) => typeof v !== 'function').join('');
    assert.equal(/PRIVATE KEY/.test(exposed), false);
  } finally {
    s.close();
  }
});

test('makeRemoteSigner rejects (does not hang) when the host never answers', { timeout: 5000 }, async () => {
  // A silent host that starts but never writes a reply — without a timeout the
  // pubkey handshake promise would never settle and the orchestrator hangs forever.
  await assert.rejects(
    makeRemoteSigner({ validatorId: 'V1', hostPath: SILENT_HOST, timeoutMs: 300 }),
    /timed out/,
  );
});

test('signBallot rejects (does not hang) when the host has died mid-session', { timeout: 5000 }, async () => {
  const s = await makeRemoteSigner({ validatorId: 'V1', hostPath: HOST, env: { QRM_FIXED_VERDICT: 'YES' } });
  s.close(); // kill the host process
  await sleep(150); // let the child's 'exit' fire
  await assert.rejects(s.signBallot('q', 'c'), /exit|died|host/i); // a dead host fails fast, never hangs
});

test("the DELIBERATING host runs V1's autonomous claude invoker child-side and signs the parsed verdict", { timeout: 8000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-dh-'));
  const ks = loadOrCreateKeyring(dir, ['V1']);
  const bin = mkdtempSync(join(tmpdir(), 'qrm-bin-'));
  // A fake `claude` on the host's PATH: V1 deliberates by shelling out (round 48), so
  // this exercises the real autonomous pipeline deterministically without the model.
  writeFileSync(join(bin, 'claude'), '#!/bin/sh\necho "V1 reasoned autonomously about the ballot"\necho "VERDICT: WIRE_NOW"\n', { mode: 0o755 });
  const s = await makeRemoteSigner({ validatorId: 'V1', hostPath: DELIB_HOST, env: { QRM_KEYSTORE_DIR: dir, PATH: `${bin}:${process.env.PATH}` } });
  try {
    const vote = await s.signBallot('Round 47 decision?', 'the context', ['WIRE_NOW', 'DISCLOSE_DEFER']);
    assert.equal(vote.validatorId, 'V1');
    assert.equal(vote.verdict, 'WIRE_NOW'); // parsed CHILD-SIDE from the CLI output, not supplied by the spawner
    assert.equal(vote.ballotHash, ballotHash('Round 47 decision?', 'the context')); // hash derived from content in the child
    assert.equal(verifyVote(vote, ks.keyring.V1), true); // signed by the keystore key that never left the child
    assert.match(vote.rawOutput, /reasoned autonomously/); // verbatim deliberation preserved
  } finally {
    s.close();
  }
});

test('the host loads a STABLE identity from a keystore — two spawns expose the same public key', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-rs-'));
  const ks = loadOrCreateKeyring(dir, ['V1']); // persistent key on disk for V1
  const first = await makeRemoteSigner({ validatorId: 'V1', hostPath: HOST, env: { QRM_KEYSTORE_DIR: dir, QRM_FIXED_VERDICT: 'YES' } });
  const second = await makeRemoteSigner({ validatorId: 'V1', hostPath: HOST, env: { QRM_KEYSTORE_DIR: dir, QRM_FIXED_VERDICT: 'YES' } });
  try {
    assert.equal(first.publicKeyPem, second.publicKeyPem); // identity is stable across spawns
    assert.equal(first.publicKeyPem, ks.keyring.V1); // and it is the keystore's key, not an ephemeral one
    const vote = await first.signBallot('q', 'c');
    assert.equal(verifyVote(vote, ks.keyring.V1), true); // votes verify against the on-disk public key
  } finally {
    first.close();
    second.close();
  }
});

test('the host derives the ballot hash from content (round-45 binding holds across the process boundary)', async () => {
  const s = await makeRemoteSigner({ validatorId: 'V2', hostPath: HOST, env: { QRM_FIXED_VERDICT: 'YES' } });
  try {
    const a = await s.signBallot('question one', 'context one');
    const b = await s.signBallot('question two', 'context two');
    assert.equal(a.ballotHash, ballotHash('question one', 'context one'));
    assert.equal(b.ballotHash, ballotHash('question two', 'context two'));
    assert.notEqual(a.ballotHash, b.ballotHash); // each ballot binds its own content
    assert.equal(verifyVote(a, s.publicKeyPem), true);
    assert.equal(verifyVote(b, s.publicKeyPem), true);
  } finally {
    s.close();
  }
});
