// RemoteSigner — OS-level key custody (closes the round-44/45 #2 residual).
// The signing key lives ONLY in a separate OS process; the orchestrator obtains
// valid signed votes over IPC but never holds the private key in its own process.
// This is the drop-in the Signer boundary pointed at — same interface, real
// custody isolation. These tests spawn the host as an actual child process.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { ballotHash, verifyVote } from '../src/signed-vote.ts';
import { makeRemoteSigner } from '../src/signer.ts';

const HOST = fileURLToPath(new URL('../src/remote-signer-host.ts', import.meta.url));

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
