// Quorumchain ($QRM) — regression for the proof-of-inference verify merge (integ/poi-verify-merge).
// Loads the REAL committed core chain (data/votes.log) against the REAL pinned keyring and
// asserts the WHOLE verify path the node's publish gate uses (verifyEntries + per-vote verifyVote)
// accepts all 524 entries: BOTH the legacy votes 0–520 (no `attestation` field, must stay
// byte-identical / back-compatible) AND the 3 CIP-18 ratification votes 521–523 (ballot
// 6c833607…, round 63) which carry a signed `attestation` envelope. Before this merge, `main`'s
// committed votePayload had no `attestation`, so verifyVote could not reproduce the signed bytes
// of votes 521–523 and the node 409'd "invalid signature for V1" on the real head.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog, verifyEntries, type LogEntry } from '../src/vote-log.ts';
import { verifyVote, type SignedVote } from '../src/signed-vote.ts';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const VOTES = join(HERE, '..', 'data', 'votes.log');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const CIP18_BALLOT = '6c833607dc43d0e03a09bf0aa202044ba98aa059746122dc3bb6a8a06fc83563';

test('real committed head: all 524 entries verify (legacy + attestation-bearing)', () => {
  const entries: LogEntry[] = readLog(VOTES);
  const keyring = JSON.parse(readFileSync(PINNED, 'utf8')) as Record<string, string>;

  // sanity: this is the exact head we are merging to support.
  assert.equal(entries.length, 524, 'expected the real 524-entry committed head');

  // 1. the GENESIS→entryHash hash chain is intact end-to-end.
  const chain = verifyEntries(entries);
  assert.equal(chain.valid, true, `hash chain broken at ${chain.brokenAt}`);

  // 2. every vote's Ed25519 signature verifies against its PINNED validator key — this is the
  //    same per-vote check publish-verify (D1) / boot (NI-D1) run. None may fail.
  let attested = 0;
  let legacy = 0;
  for (let i = 0; i < entries.length; i++) {
    const v: SignedVote = entries[i].vote;
    const pk = keyring[v.validatorId];
    assert.ok(pk, `vote ${i} signed by unpinned validator ${v.validatorId}`);
    assert.equal(verifyVote(v, pk), true, `vote ${i} (${v.validatorId}) failed signature verify`);
    if (v.attestation !== undefined) attested++;
    else legacy++;
  }

  // 3. shape assertions: 521 legacy (no attestation) + 3 attestation-bearing = 524.
  assert.equal(legacy, 521, 'expected 521 pre-attestation votes');
  assert.equal(attested, 3, 'expected exactly 3 attestation-bearing votes (CIP-18 521–523)');

  // 4. the 3 attested votes are precisely the CIP-18 round-63 ratification, all unattested/NO_BACKEND
  //    (inc.1 mock path) — confirming inc.2 backend fields are NOT required to verify them.
  const cip18 = entries.filter((e) => e.vote.ballotHash === CIP18_BALLOT);
  assert.equal(cip18.length, 3, 'expected 3 votes on the CIP-18 ballot');
  for (const e of cip18) {
    const a = e.vote.attestation as { band?: string; reason?: string } | undefined;
    assert.deepEqual(a, { band: 'unattested', reason: 'NO_BACKEND' }, `${e.vote.validatorId} attestation shape`);
  }
});
