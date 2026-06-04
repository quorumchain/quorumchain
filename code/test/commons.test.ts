// CIP-9 v0.1 — the resolution-index (read pillar).
// A read-only claim graph projected from the signed CIP-3/CIP-8 verdict log:
// every resolved ballot becomes a Claim whose stance set PRESERVES the dissent
// (G1 pluralism), carries a panel-state receipt (NI-9a), and never fabricates a
// confidence on a non-resolution (G5 honest unknown). v0.1 deliberately computes
// NO source reputation — that is NI-9b/v0.2 — so these tests also pin its absence.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { buildClaimIndex, queryClaim } from '../src/commons.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function vote(id: 'V1' | 'V2' | 'V3', bh: string, verdict: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id} reasons: ${verdict}` });
}

const BH_UNANIMOUS = ballotHash('Q-unanimous', 'criteria');
const BH_SPLIT = ballotHash('Q-split', 'criteria'); // 2/1 — dissent must survive
const BH_INDET = ballotHash('Q-indeterminate', 'criteria');
const BH_NOQUORUM = ballotHash('Q-noquorum', 'criteria'); // 1/1/1 — no consensus
const BH_WITHFAIL = ballotHash('Q-withfail', 'criteria'); // 2 YES + 1 NO_VERDICT (a failed invoker)

function fullPanel(): SignedVote[] {
  return [
    vote('V1', BH_UNANIMOUS, 'YES'), vote('V2', BH_UNANIMOUS, 'YES'), vote('V3', BH_UNANIMOUS, 'YES'),
    vote('V1', BH_SPLIT, 'NO'), vote('V2', BH_SPLIT, 'YES'), vote('V3', BH_SPLIT, 'NO'),
    vote('V1', BH_INDET, 'INDETERMINATE'), vote('V2', BH_INDET, 'INDETERMINATE'), vote('V3', BH_INDET, 'NO'),
    vote('V1', BH_NOQUORUM, 'A'), vote('V2', BH_NOQUORUM, 'B'), vote('V3', BH_NOQUORUM, 'C'),
    vote('V1', BH_WITHFAIL, 'YES'), vote('V2', BH_WITHFAIL, 'YES'), vote('V3', BH_WITHFAIL, 'NO_VERDICT'),
  ];
}

test('a unanimous ballot becomes a RESOLVED claim with one CONSENSUS stance', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'YES');
  assert.equal(c.stances.length, 1);
  assert.equal(c.stances[0].standing, 'CONSENSUS');
  assert.deepEqual(c.stances[0].validators.sort(), ['V1', 'V2', 'V3']);
});

test('G1 pluralism: a 2/1 split preserves the dissenting stance as CREDIBLE_MINORITY', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_SPLIT)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'NO');
  assert.equal(c.stances.length, 2); // both positions retained
  const consensus = c.stances.find((s) => s.position === 'NO')!;
  const minority = c.stances.find((s) => s.position === 'YES')!;
  assert.equal(consensus.standing, 'CONSENSUS');
  assert.deepEqual(consensus.validators.sort(), ['V1', 'V3']);
  assert.equal(minority.standing, 'CREDIBLE_MINORITY');
  assert.deepEqual(minority.validators, ['V2']); // the dissent is named, not flattened
});

// Round-53 V1 finding: in a RESOLVED claim, a NO_VERDICT "position" (a validator whose
// invoker errored / timed out) must NOT be dignified as a CREDIBLE_MINORITY dissent — it
// is a non-position, not a credible opposing view. It stays UNRANKED.
test('a NO_VERDICT stance in a RESOLVED claim is UNRANKED, never CREDIBLE_MINORITY', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_WITHFAIL)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'YES');
  const consensus = c.stances.find((s) => s.position === 'YES')!;
  const failed = c.stances.find((s) => s.position === 'NO_VERDICT')!;
  assert.equal(consensus.standing, 'CONSENSUS');
  assert.equal(failed.standing, 'UNRANKED'); // a failed invoker is not a credible minority
});

test('G5 honest unknown: an INDETERMINATE resolution is UNRANKED, not ranked CONSENSUS (NI-9c)', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_INDET)!;
  assert.equal(c.status, 'INDETERMINATE');
  assert.equal(c.verdict, 'INDETERMINATE');
  // the dissenting NO stance is still preserved...
  assert.ok(c.stances.some((s) => s.position === 'NO'));
  // ...but on the unverifiable class NOTHING is ranked CONSENSUS (consistent with reputation.ts / NI-9c)
  assert.ok(c.stances.every((s) => s.standing === 'UNRANKED'));
});

test('no quorum becomes a CONTESTED claim with no CONSENSUS stance', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_NOQUORUM)!;
  assert.equal(c.status, 'CONTESTED');
  assert.equal(c.verdict, null);
  assert.equal(c.stances.length, 3);
  assert.ok(c.stances.every((s) => s.standing !== 'CONSENSUS')); // nothing earned consensus
});

test('NI-9a: every claim carries a panel-state receipt', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  assert.deepEqual(c.panelStateReceipt.validators.sort(), ['V1', 'V2', 'V3']);
  assert.equal(c.panelStateReceipt.size, 3);
});

test('NI-9c / v0.1 honesty: no stance carries a reputation score and none is ranked FRINGE', () => {
  const idx = buildClaimIndex(fullPanel(), keyring, 2);
  for (const c of idx) {
    for (const s of c.stances) {
      assert.equal('reputation' in s, false); // reputation is NI-9b/v0.2, deliberately absent
      assert.notEqual(s.standing, 'FRINGE'); // no demotion power in v0.1
      assert.equal(typeof s.panelVotes, 'number'); // support is panel distribution, NOT reputation
    }
  }
});

test('G2 / projection honesty: a vote that fails signature verification is excluded', () => {
  const votes = fullPanel();
  // tamper V3's verbatim output after signing -> its rawOutputHash no longer matches
  const i = votes.findIndex((v) => v.ballotHash === BH_UNANIMOUS && v.validatorId === 'V3');
  votes[i] = { ...votes[i], rawOutput: 'silently rewritten after signing' };
  const idx = buildClaimIndex(votes, keyring, 2);
  const c = queryClaim(idx, BH_UNANIMOUS)!;
  // V3 dropped; only V1/V2 counted -> still RESOLVED YES, receipt reflects the 2 valid signers
  assert.equal(c.verdict, 'YES');
  assert.deepEqual(c.stances[0].validators.sort(), ['V1', 'V2']);
  assert.deepEqual(c.panelStateReceipt.validators.sort(), ['V1', 'V2']);
});

test('the index is a deterministic projection (same log => same claims)', () => {
  const a = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2));
  const b = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2));
  assert.equal(a, b);
});

// ── CIP-12: the fuller correlation receipt (NI-12a..i) ──────────────────────
// composition + correlationBand on PanelStateReceipt. Descriptive only: the
// receipt records who produced a claim and under what correlation conditions,
// and MUST NOT alter status/verdict/standing/panelVotes (NI-12b).
import type { Provenance } from '../src/commons.ts';

const distinctProv: Record<string, Provenance> = {
  V1: { corpusFamily: 'cf1', teacher: null, weightDerivation: 'wd1', provider: 'pA', servingStack: 'ss1' },
  V2: { corpusFamily: 'cf2', teacher: null, weightDerivation: 'wd2', provider: 'pB', servingStack: 'ss2' },
  V3: { corpusFamily: 'cf3', teacher: null, weightDerivation: 'wd3', provider: 'pC', servingStack: 'ss3' },
};
// V2 shares V1's corpus family -> a known shared foundation (CIP-7 NI-1 sharesLineage)
const sharedProv: Record<string, Provenance> = {
  ...distinctProv,
  V2: { ...distinctProv.V2, corpusFamily: 'cf1' },
};

test('CIP-12 NI-12a: composition is populated from the provenance registry', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2, distinctProv), BH_UNANIMOUS)!;
  const comp = [...c.panelStateReceipt.composition].sort((a, b) => a.validatorId.localeCompare(b.validatorId));
  assert.deepEqual(comp, [
    { validatorId: 'V1', provider: 'pA', lineage: 'cf1' },
    { validatorId: 'V2', provider: 'pB', lineage: 'cf2' },
    { validatorId: 'V3', provider: 'pC', lineage: 'cf3' },
  ]);
});

test('CIP-12 NI-12g: absent provenance is recorded as explicit nulls, not omitted', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_UNANIMOUS)!;
  assert.equal(c.panelStateReceipt.composition.length, 3);
  for (const e of c.panelStateReceipt.composition) {
    assert.equal(e.provider, null);
    assert.equal(e.lineage, null);
  }
});

test('CIP-12 NI-12f: shared foundation floors the correlation band at ELEVATED', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2, sharedProv), BH_UNANIMOUS)!;
  assert.equal(c.panelStateReceipt.correlationBand, 'ELEVATED');
});

test('CIP-12 honesty: band is UNKNOWN (never LOW) absent probes / shared foundation', () => {
  const known = queryClaim(buildClaimIndex(fullPanel(), keyring, 2, distinctProv), BH_UNANIMOUS)!;
  const blind = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_UNANIMOUS)!;
  assert.equal(known.panelStateReceipt.correlationBand, 'UNKNOWN'); // distinct, but no probes -> never LOW
  assert.equal(blind.panelStateReceipt.correlationBand, 'UNKNOWN');
});

test('CIP-12 NI-12b: the receipt does not alter status/verdict/standing/panelVotes', () => {
  const withProv = buildClaimIndex(fullPanel(), keyring, 2, sharedProv);
  const without = buildClaimIndex(fullPanel(), keyring, 2);
  assert.equal(withProv.length, without.length);
  for (let i = 0; i < withProv.length; i++) {
    const a = withProv[i], b = without[i];
    assert.equal(a.status, b.status);
    assert.equal(a.verdict, b.verdict);
    assert.deepEqual(a.stances, b.stances); // positions, validators, panelVotes, standing — all identical
  }
});

test('CIP-12: the extended index is still a deterministic projection', () => {
  const a = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2, sharedProv));
  const b = JSON.stringify(buildClaimIndex(fullPanel(), keyring, 2, sharedProv));
  assert.equal(a, b);
});

test('CIP-12 backward-compat: the legacy 3-arg call still yields a valid receipt', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_UNANIMOUS)!;
  assert.deepEqual(c.panelStateReceipt.validators.sort(), ['V1', 'V2', 'V3']);
  assert.equal(c.panelStateReceipt.size, 3);
  assert.ok(Array.isArray(c.panelStateReceipt.composition));
  assert.equal(c.panelStateReceipt.correlationBand, 'UNKNOWN');
});

// ── CIP-9 amendment: status as a total function of substantive-verdict presence ──
// (ballot 5885f224, red-team 3/3). status is RESOLVED iff an enforceable substantive
// verdict holds a supermajority; CONTESTED is reserved for ≥2 competing substantive
// positions; the absence of any surviving substantive position (all-ABSTAIN,
// NO_VERDICT-only, a lone sub-supermajority position, ratified all-INDETERMINATE)
// is INDETERMINATE. Non-substantive set = {ABSTAIN, INDETERMINATE, NO_VERDICT}.
// Ratification is untouched — ABSTAIN stays tallied/ratifiable, it just never projects RESOLVED.
const BH_ALLABSTAIN = ballotHash('Q-allabstain', 'criteria'); // 3×ABSTAIN — was wrongly RESOLVED
const BH_ALLNOVERDICT = ballotHash('Q-allnoverdict', 'criteria'); // 3×NO_VERDICT — was wrongly CONTESTED
const BH_ONESUB = ballotHash('Q-onesub', 'criteria'); // 1×YES + 2×NO_VERDICT — no competitor
const BH_YESABSTAIN = ballotHash('Q-yesabstain', 'criteria'); // 2×YES + 1×ABSTAIN — real supermajority

function statusPanel(): SignedVote[] {
  return [
    vote('V1', BH_ALLABSTAIN, 'ABSTAIN'), vote('V2', BH_ALLABSTAIN, 'ABSTAIN'), vote('V3', BH_ALLABSTAIN, 'ABSTAIN'),
    vote('V1', BH_ALLNOVERDICT, 'NO_VERDICT'), vote('V2', BH_ALLNOVERDICT, 'NO_VERDICT'), vote('V3', BH_ALLNOVERDICT, 'NO_VERDICT'),
    vote('V1', BH_ONESUB, 'YES'), vote('V2', BH_ONESUB, 'NO_VERDICT'), vote('V3', BH_ONESUB, 'NO_VERDICT'),
    vote('V1', BH_YESABSTAIN, 'YES'), vote('V2', BH_YESABSTAIN, 'YES'), vote('V3', BH_YESABSTAIN, 'ABSTAIN'),
  ];
}

test('amendment: an all-ABSTAIN ballot is INDETERMINATE, not RESOLVED (surfaced bug)', () => {
  const c = queryClaim(buildClaimIndex(statusPanel(), keyring, 2), BH_ALLABSTAIN)!;
  assert.equal(c.status, 'INDETERMINATE'); // an honest non-answer is never a settled result
  assert.ok(c.stances.every((s) => s.standing === 'UNRANKED')); // nothing ranked CONSENSUS
});

test('amendment: a NO_VERDICT-only ballot is INDETERMINATE, not CONTESTED (latent twin)', () => {
  const c = queryClaim(buildClaimIndex(statusPanel(), keyring, 2), BH_ALLNOVERDICT)!;
  assert.equal(c.status, 'INDETERMINATE'); // three invocation failures are not a contest
});

test('amendment: 1 substantive + 2 failures is INDETERMINATE (no competitor, not a contest)', () => {
  const c = queryClaim(buildClaimIndex(statusPanel(), keyring, 2), BH_ONESUB)!;
  assert.equal(c.status, 'INDETERMINATE'); // a lone sub-supermajority YES is neither resolution nor contest
});

test('amendment regression guard: a genuine A/B/C split stays CONTESTED', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_NOQUORUM)!;
  assert.equal(c.status, 'CONTESTED'); // ≥2 competing SUBSTANTIVE positions, no supermajority
});

test('amendment regression guard: 2×YES + 1×NO_VERDICT stays RESOLVED', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_WITHFAIL)!;
  assert.equal(c.status, 'RESOLVED'); // a failed invoker never blocks a real supermajority
  assert.equal(c.verdict, 'YES');
});

test('amendment: 2×YES + 1×ABSTAIN stays RESOLVED/YES (ABSTAIN never blocks a supermajority)', () => {
  const c = queryClaim(buildClaimIndex(statusPanel(), keyring, 2), BH_YESABSTAIN)!;
  assert.equal(c.status, 'RESOLVED');
  assert.equal(c.verdict, 'YES');
});

test('amendment regression guard: a ratified all-INDETERMINATE ballot stays INDETERMINATE', () => {
  const c = queryClaim(buildClaimIndex(fullPanel(), keyring, 2), BH_INDET)!;
  assert.equal(c.status, 'INDETERMINATE');
});
