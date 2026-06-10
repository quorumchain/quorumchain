import { test } from 'node:test';
import assert from 'node:assert/strict';
import { provenanceAbuseFlags } from '../src/provenance-monitor.ts';
import type { SignedVote } from '../src/signed-vote.ts';

// minimal vote shapes — the monitor reads only validatorId, ballotHash, attestation.
// An 'attested' vote carries the mandatory proof material (proofHash + requestCommitment +
// responseHash) so it counts as present provenance; see the BARE-attested dodge test below.
function v(validatorId: string, ballotHash: string, band: string, reason?: string): SignedVote {
  const attestation = band === 'attested'
    ? { band, proofHash: 'p', requestCommitment: 'rc', responseHash: 'rh' }
    : reason ? { band, reason } : { band };
  return { validatorId, ballotHash, verdict: 'YES', rawOutput: 'r', rawOutputHash: 'h', signature: 's', attestation } as unknown as SignedVote;
}

test('a validator unattested on more than half of the last K convenings is flagged', () => {
  const votes = [
    v('V1', 'b1', 'unattested', 'NO_BACKEND'),
    v('V1', 'b2', 'unattested', 'NO_BACKEND'),
    v('V1', 'b3', 'attested'),
    v('V2', 'b1', 'attested'),
    v('V2', 'b2', 'attested'),
    v('V2', 'b3', 'attested'),
  ];
  const flags = provenanceAbuseFlags(votes, { windowK: 3, threshold: 0.5 });
  assert.deepEqual(flags.find((f) => f.validatorId === 'V1'), { validatorId: 'V1', missingRate: 2 / 3, convenings: 3, flagged: true });
  assert.equal(flags.find((f) => f.validatorId === 'V2')?.flagged, false);
});

test('degraded and unavailable count as missing provenance alongside unattested', () => {
  const votes = [
    v('V3', 'b1', 'degraded', 'ATTESTOR_TIMEOUT'),
    v('V3', 'b2', 'unavailable', 'BACKEND_DOWN'),
    v('V3', 'b3', 'attested'),
  ];
  const flags = provenanceAbuseFlags(votes, { windowK: 3, threshold: 0.5 });
  assert.equal(flags.find((f) => f.validatorId === 'V3')?.flagged, true); // 2/3 missing > 0.5
});

test('the window keeps only the most recent K convenings (older ones do not count)', () => {
  const votes = [
    v('V1', 'old', 'unattested', 'NO_BACKEND'), // outside a window of 2
    v('V1', 'b1', 'attested'),
    v('V1', 'b2', 'attested'),
  ];
  const flags = provenanceAbuseFlags(votes, { windowK: 2, threshold: 0.5 });
  assert.equal(flags.find((f) => f.validatorId === 'V1')?.flagged, false);
});

test('a legacy vote with no attestation counts as missing provenance', () => {
  const legacy = { validatorId: 'V1', ballotHash: 'b1', verdict: 'YES', rawOutput: 'r', rawOutputHash: 'h', signature: 's' } as SignedVote;
  const flags = provenanceAbuseFlags([legacy], { windowK: 1, threshold: 0.5 });
  assert.equal(flags[0].missingRate, 1);
  assert.equal(flags[0].flagged, true);
});

test('a BARE attested claim (no proof material) counts as missing — no self-claim dodge (codex MAJOR-2)', () => {
  const bare = { validatorId: 'V1', ballotHash: 'b1', verdict: 'YES', rawOutput: 'r', rawOutputHash: 'h', signature: 's', attestation: { band: 'attested' } } as unknown as SignedVote;
  const flags = provenanceAbuseFlags([bare], { windowK: 1, threshold: 0.5 });
  assert.equal(flags[0].missingRate, 1);
  assert.equal(flags[0].flagged, true);
});

test('duplicate votes on one ballot collapse to a single convening (codex MAJOR-3)', () => {
  // three missing votes on the SAME ballot must count as ONE missing convening, not three
  const votes = [
    v('V1', 'b1', 'unattested', 'NO_BACKEND'),
    v('V1', 'b1', 'unattested', 'NO_BACKEND'),
    v('V1', 'b1', 'unattested', 'NO_BACKEND'),
    v('V1', 'b2', 'attested'),
  ];
  const flags = provenanceAbuseFlags(votes, { windowK: 10, threshold: 0.5 });
  const f = flags.find((x) => x.validatorId === 'V1')!;
  assert.equal(f.convenings, 2);      // b1 and b2 — NOT 4
  assert.equal(f.missingRate, 1 / 2); // b1 missing, b2 present
  assert.equal(f.flagged, false);
});

test('a convening is missing if ANY vote on that ballot lacks provenance (conservative dedup)', () => {
  const votes = [
    v('V1', 'b1', 'attested'),                 // present...
    v('V1', 'b1', 'unattested', 'NO_BACKEND'), // ...plus an equivocating missing vote on the same ballot
  ];
  const flags = provenanceAbuseFlags(votes, { windowK: 1, threshold: 0.5 });
  assert.equal(flags[0].missingRate, 1); // conservative: the convening counts as missing
});
