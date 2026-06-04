// Network-distributed deliberating host (round-57 ADOPT-with-REVISE). The panel
// ratified moving each host onto its own machine reached over a socket instead of a
// stdin/stdout pipe — a TRANSPORT swap, not a protocol redesign. These tests prove
// the same two-message protocol works over a loopback socket with a fake invoker
// (no real CLI), that verdict integrity still rests on the signature + key, and that
// the per-convening nonce is bound across the network boundary.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, verifyVote, ballotHash } from '../src/signed-vote.ts';
import { serveSignerSocket, makeNetworkSigner } from '../src/socket-signer.ts';

test('a vote signed on a network host verifies against the pin and binds the convening nonce', async () => {
  const key = generateValidatorKey();
  const server = await serveSignerSocket({ validatorId: 'V1', key, invoke: async () => 'reasoned over the wire\nVERDICT: ADOPT', port: 0 });
  try {
    const signer = await makeNetworkSigner({ validatorId: 'V1', host: '127.0.0.1', port: server.port });
    assert.equal(signer.publicKeyPem, key.publicKeyPem); // pubkey handshake over the socket
    const vote = await signer.signBallot('q', 'c', ['ADOPT', 'REVISE', 'REJECT'], 'convening-XYZ');
    assert.equal(vote.verdict, 'ADOPT'); // parsed CHILD-SIDE (host process), not by the orchestrator
    assert.equal(vote.ballotHash, ballotHash('q', 'c')); // derived from content on the host, not caller-supplied
    assert.equal(vote.nonce, 'convening-XYZ'); // the host signed over the nonce the orchestrator issued
    assert.equal(verifyVote(vote, key.publicKeyPem), true); // integrity rests on the key, regardless of transport
    signer.close();
  } finally {
    server.close();
  }
});

test('the key stays host-side: the orchestrator handle exposes only public material', async () => {
  const key = generateValidatorKey();
  const server = await serveSignerSocket({ validatorId: 'V1', key, invoke: async () => 'VERDICT: ADOPT', port: 0 });
  try {
    const signer = await makeNetworkSigner({ validatorId: 'V1', host: '127.0.0.1', port: server.port });
    assert.equal('privateKeyPem' in signer, false);
    const exposed = JSON.stringify(signer) + Object.values(signer).filter((v) => typeof v !== 'function').join('');
    assert.equal(/PRIVATE KEY/.test(exposed), false);
    signer.close();
  } finally {
    server.close();
  }
});

test('a network host that is down fails fast (recorded absence, never a hang)', { timeout: 5000 }, async () => {
  // startSigners records this as a startup absence; it must reject, not hang.
  await assert.rejects(makeNetworkSigner({ validatorId: 'V1', host: '127.0.0.1', port: 1, timeoutMs: 500 }));
});
