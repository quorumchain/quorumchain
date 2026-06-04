// Independent validator key custody (round-44 backlog #2) + the round-45 binding
// fix (V2's dissent). The orchestrator must NOT be the trust root: it routes the
// ballot CONTENT and collects signed votes, but holds no private key and supplies
// NO ballot hash — the signer derives the hash from the same (prompt, context) it
// deliberates on, so the orchestrator can neither mint/alter a verdict nor obtain
// a signature over a ballot the validator did not actually judge (CIP-3).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, verifyVote, ratify } from '../src/signed-vote.ts';
import { makeLocalSigner } from '../src/signer.ts';
import { parseVerdict } from '../src/panel.ts';

const PROMPT = 'Did the agent breach its bond?';
const CONTEXT = 'evidence';
const bh = ballotHash(PROMPT, CONTEXT);

function signerFor(id: string, output: string) {
  return makeLocalSigner({
    validatorId: id,
    key: generateValidatorKey(),
    deliberate: async () => ({ verdict: parseVerdict(output), rawOutput: output }),
  });
}

test('a signer produces a vote that verifies against its public key, with the validator-decided verdict', async () => {
  const s = signerFor('V1', 'reasoning…\nVERDICT: NO');
  const vote = await s.signBallot(PROMPT, CONTEXT);
  assert.equal(vote.validatorId, 'V1');
  assert.equal(vote.verdict, 'NO'); // decided on the validator side, not by the orchestrator
  assert.equal(vote.ballotHash, bh);
  assert.equal(verifyVote(vote, s.publicKeyPem), true);
});

test('binding (round-45): the signer derives the ballot hash from the content it judged — no caller-supplied hash to spoof', async () => {
  const k = generateValidatorKey();
  let judged: { prompt: string; context: string } | null = null;
  const s = makeLocalSigner({
    validatorId: 'V1',
    key: k,
    deliberate: async (prompt, context) => {
      judged = { prompt, context }; // record exactly what the validator was shown
      return { verdict: 'NO', rawOutput: 'VERDICT: NO' };
    },
  });
  const vote = await s.signBallot('the real question', 'the real evidence');
  // the signature is over the hash of the SAME content the validator deliberated on
  assert.deepEqual(judged, { prompt: 'the real question', context: 'the real evidence' });
  assert.equal(vote.ballotHash, ballotHash('the real question', 'the real evidence'));
  assert.equal(verifyVote(vote, s.publicKeyPem), true);
});

test('custody: the signer exposes NO path to the private key (it is captured behind the boundary)', () => {
  const k = generateValidatorKey();
  const s = makeLocalSigner({ validatorId: 'V1', key: k, deliberate: async () => ({ verdict: 'YES', rawOutput: 'VERDICT: YES' }) });
  assert.equal('privateKeyPem' in s, false);
  // the private key string appears in none of the signer's own enumerable values
  const exposed = JSON.stringify(s) + Object.values(s).filter((v) => typeof v !== 'function').join('');
  assert.equal(exposed.includes(k.privateKeyPem), false);
});

test('no trust root: holding only the registered public key, an orchestrator cannot forge an acceptable vote', () => {
  const validator = generateValidatorKey();
  const keyring = { V1: validator.publicKeyPem }; // the only key the orchestrator knows
  // the orchestrator fabricates a verdict and signs it with a key IT controls
  const adversaryKey = generateValidatorKey();
  const forged = signVote({ validatorId: 'V1', privateKeyPem: adversaryKey.privateKeyPem, ballotHash: bh, verdict: 'YES', rawOutput: 'fabricated' });
  // the forged vote does not verify against V1's registered key, and ratify rejects it
  assert.equal(verifyVote(forged, keyring.V1), false);
  const r = ratify(bh, [forged], keyring, 1);
  assert.equal(r.ratified, false);
  assert.ok(r.rejected.some((x) => x.validatorId === 'V1' && x.reason === 'invalid-signature'));
});

test('the orchestrator cannot swap a signed verdict after the fact (no key to re-sign)', async () => {
  const s = signerFor('V1', 'VERDICT: NO');
  const vote = await s.signBallot(PROMPT, CONTEXT);
  const tampered = { ...vote, verdict: 'YES' }; // orchestrator flips the verdict
  assert.equal(verifyVote(tampered, s.publicKeyPem), false); // signature covers the verdict
});
