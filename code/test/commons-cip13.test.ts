// CIP-13 v0.1 — Claim Epistemic Typing & Re-adjudication (ratified ballot 3729cc2e…).
// Extends the CIP-9 read path along the TIME axis: a frozen `epistemicType` per
// claim, an `evidenceTime`, and a supersession `lineage` (current/priorVersions),
// ALL pure projection over the signed log — descriptive only, never recomputing a
// ballot's status/verdict/standing (CIP-12 NI-12b). Gates G13a–h from §9.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateValidatorKey, ballotHash, signVote, type SignedVote } from '../src/signed-vote.ts';
import { buildClaimIndex, queryClaim, type BallotMeta } from '../src/commons.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function vote(id: 'V1' | 'V2' | 'V3', bh: string, verdict: string): SignedVote {
  return signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id}:${verdict}` });
}
function unanimous(bh: string, verdict: string): SignedVote[] {
  return [vote('V1', bh, verdict), vote('V2', bh, verdict), vote('V3', bh, verdict)];
}

const SET = ballotHash('Apollo landed on the Moon', 'c');
const EMP = ballotHash('mRNA vaccines are safe', 'c');
const NORM = ballotHash('Is euthanasia permissible', 'c');

// ---- G13a — type round-trips (NI-13a) ----
test('G13a: epistemicType round-trips from the frozen ballot meta', () => {
  const votes = [...unanimous(SET, 'YES'), ...unanimous(EMP, 'YES'), ...unanimous(NORM, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [SET]: { epistemicType: 'SETTLED' },
    [EMP]: { epistemicType: 'EMPIRICAL_LIVE' },
    [NORM]: { epistemicType: 'NORMATIVE' },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, SET)!.epistemicType, 'SETTLED');
  assert.equal(queryClaim(idx, EMP)!.epistemicType, 'EMPIRICAL_LIVE');
  assert.equal(queryClaim(idx, NORM)!.epistemicType, 'NORMATIVE');
});

test('NI-13a: a ballot with no meta is typed null (explicit-unknown, never inferred)', () => {
  const idx = buildClaimIndex(unanimous(SET, 'YES'), keyring, 2);
  assert.equal(queryClaim(idx, SET)!.epistemicType, null);
});

// ---- G13b — empirical provisionality (NI-13c) ----
test('G13b: an EMPIRICAL_LIVE resolved claim carries an evidenceTime (never atemporal)', () => {
  const votes = [...unanimous(SET, 'YES'), ...unanimous(EMP, 'YES')];
  const idx = buildClaimIndex(votes, keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  const c = queryClaim(idx, EMP)!;
  assert.equal(c.status, 'RESOLVED');
  assert.notEqual(c.evidenceTime, null);
  assert.notEqual(c.evidenceTime, undefined);
});

test('evidenceTime defaults to first-seen log index, or takes the declared value', () => {
  const votes = [...unanimous(SET, 'YES'), ...unanimous(EMP, 'YES')];
  const idx = buildClaimIndex(votes, keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE', evidenceTime: '2021-06' } });
  assert.equal(queryClaim(idx, SET)!.evidenceTime, 0); // first ballot in first-seen order
  assert.equal(queryClaim(idx, EMP)!.evidenceTime, '2021-06'); // declared overrides
});

// ---- G13c — supersession lineage (NI-13d) ----
test('G13c: a valid anchored supersede makes current=successor, prior retained', () => {
  const B1 = ballotHash('Is X still true', 'as of 2021');
  const B2 = ballotHash('Is X still true', 'as of 2023 with new data');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'new validated signal', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  const c2 = queryClaim(idx, B2)!;
  assert.equal(c2.lineage.current, B2);
  const prior = c2.lineage.priorVersions.find((p) => p.ballotHash === B1)!;
  assert.ok(prior, 'B1 retained in priorVersions');
  assert.equal(prior.verdict, 'YES'); // B1's original verdict intact (NI-13d)
  // B1's own existing fields are byte-identical — never edited
  const c1 = queryClaim(idx, B1)!;
  assert.equal(c1.verdict, 'YES');
  assert.equal(c1.status, 'RESOLVED');
  assert.equal(c1.lineage.current, B2); // the lineage view agrees current is B2
});

// ---- G13d — anchor-gated re-adjudication + type invariance (NI-13e, NI-13h) ----
test('G13d: a supersede WITHOUT a new anchor is not promoted (prior stays current)', () => {
  const B1 = ballotHash('Is X still true', 'v1');
  const B2 = ballotHash('Is X still true', 'v2 no anchor');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'just disagree', newAnchor: false },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B1); // prior stays current
});

test('G13d/NI-13h: a supersede with a valid anchor but a DIFFERENT type is not promoted', () => {
  const B1 = ballotHash('claim', 'v1');
  const B2 = ballotHash('claim', 'v2 retyped');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'SETTLED' },
    [B2]: { epistemicType: 'NORMATIVE', supersedes: B1, supersedeReason: 'relabel ride-along', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B1); // type cannot ride through
});

test('G13d: a supersede with a valid new anchor AND matching type IS promoted', () => {
  const B1 = ballotHash('claim', 'v1');
  const B2 = ballotHash('claim', 'v2 anchored');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'new court ruling', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B2);
});

test('NORMATIVE supersession needs no anchor (no external ground truth) but needs matching type', () => {
  const B1 = ballotHash('moral q', 'v1');
  const B2 = ballotHash('moral q', 'v2');
  const votes = [...unanimous(B1, 'NO'), ...unanimous(B2, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'NORMATIVE' },
    [B2]: { epistemicType: 'NORMATIVE', supersedes: B1, supersedeReason: 'shifted consensus', newAnchor: false },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B2);
});

// ---- G13h — explicit head rule, no silent tie-break (NI-13g) ----
test('G13h: with two valid successors to one prior, current is the latest in log order', () => {
  const B1 = ballotHash('claim', 'v1');
  const B2 = ballotHash('claim', 'v2');
  const B3 = ballotHash('claim', 'v3');
  // log order: B1, then B2, then B3 — both B2 and B3 validly supersede B1
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO'), ...unanimous(B3, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'r2', newAnchor: true },
    [B3]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'r3', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(queryClaim(idx, B1)!.lineage.current, B3); // latest valid successor in log order
});

// ---- G13f — determinism (NI-13g) ----
test('G13f: same log + meta -> byte-identical typed index', () => {
  const votes = [...unanimous(SET, 'YES'), ...unanimous(EMP, 'YES')];
  const meta: Record<string, BallotMeta> = { [SET]: { epistemicType: 'SETTLED' }, [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } };
  const a = buildClaimIndex(votes, keyring, 2, {}, meta);
  const b = buildClaimIndex(votes, keyring, 2, {}, meta);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

// ---- G13g — no recomputation: CIP-12 regression (NI-13b) ----
test('G13g: typing does not recompute status/verdict/stances/standing of any claim', () => {
  const votes = [...unanimous(SET, 'YES'), vote('V1', EMP, 'NO'), vote('V2', EMP, 'YES'), vote('V3', EMP, 'YES')];
  const withType = buildClaimIndex(votes, keyring, 2, {}, { [SET]: { epistemicType: 'SETTLED' }, [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  const plain = buildClaimIndex(votes, keyring, 2);
  for (const bh of [SET, EMP]) {
    const a = queryClaim(withType, bh)!;
    const b = queryClaim(plain, bh)!;
    assert.equal(a.status, b.status);
    assert.equal(a.verdict, b.verdict);
    assert.deepEqual(a.stances, b.stances); // standing included — byte-identical
    assert.deepEqual(a.panelStateReceipt, b.panelStateReceipt);
  }
});

// ---- v0.1 §7 read/render surfacing: provisional-as-of (EMPIRICAL_LIVE) / conventional-as-of (NORMATIVE) ----
import { buildViews, viewClaim } from '../src/commons-read.ts';
import { renderClaimMarkdown } from '../src/commons-render.ts';

test('ClaimView carries the CIP-13 fields (the agent-facing read is time-aware)', () => {
  const votes = unanimous(EMP, 'YES');
  const idx = buildClaimIndex(votes, keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE', evidenceTime: '2021-06' } });
  const view = viewClaim(idx[0], [], true);
  assert.equal(view.epistemicType, 'EMPIRICAL_LIVE');
  assert.equal(view.evidenceTime, '2021-06');
  assert.equal(view.lineage.current, EMP);
});

test('G13b render: an EMPIRICAL_LIVE claim renders a provisional / as-of / re-adjudication marker', () => {
  const votes = unanimous(EMP, 'YES');
  const idx = buildClaimIndex(votes, keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE', evidenceTime: '2021-06' } });
  const md = renderClaimMarkdown(viewClaim(idx[0], [], true));
  assert.match(md, /EMPIRICAL_LIVE/);
  assert.match(md, /provisional/i);
  assert.match(md, /2021-06/);
});

test('G13e render: a NORMATIVE supermajority renders "conventional, not truth", never settled', () => {
  const votes = unanimous(NORM, 'YES');
  const idx = buildClaimIndex(votes, keyring, 2, {}, { [NORM]: { epistemicType: 'NORMATIVE' } });
  const md = renderClaimMarkdown(viewClaim(idx[0], [], true));
  assert.match(md, /conventional/i);
});

test('render: a re-adjudicated claim shows its supersession history', () => {
  const B1 = ballotHash('claim', 'v1');
  const B2 = ballotHash('claim', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta: Record<string, BallotMeta> = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE', supersedes: B1, supersedeReason: 'new evidence', newAnchor: true },
  };
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta);
  const md = renderClaimMarkdown(viewClaim(idx.find((c) => c.ballotHash === B2)!, [], true));
  assert.match(md, /superseded|re-adjudicat|prior/i);
});

test('buildViews forwards ballotMeta so the typed read is available end-to-end', () => {
  const votes = unanimous(EMP, 'YES');
  const views = buildViews(votes, keyring, 2, [], true, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  assert.equal(views[0].epistemicType, 'EMPIRICAL_LIVE');
});

// ============================================================================
// CIP-13 v0.2 — falsification conditions from the CIP-10 auditor dossier (just
// ratified, ballot 88d756d6…) + operational review hooks for EMPIRICAL_LIVE claims.
// The dossier is descriptive (CIP-12 NI-12b): consuming it NEVER recomputes
// status/verdict/standing/lineage. Review hooks SURFACE candidates; they never
// auto-trigger a re-adjudication ballot (§5 — triggering is operational, not projection).
// ============================================================================
import { reviewCandidates, type ContraryDossier } from '../src/commons.ts';

const dossier = (bh: string, weight: 'NEGLIGIBLE' | 'WEAK' | 'MATERIAL' | 'DECISIVE', fc = [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'a Big-Four audit' }]): ContraryDossier => ({
  ballotHash: bh, auditorId: 'V2', assessedWeight: weight, falsificationConditions: fc,
});

test('v0.2: a dossier populates falsificationConditions + contraryWeight on the claim', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } }, { [EMP]: dossier(EMP, 'MATERIAL') });
  const c = queryClaim(idx, EMP)!;
  assert.equal(c.contraryWeight, 'MATERIAL');
  assert.equal(c.falsificationConditions.length, 1);
  assert.equal(c.falsificationConditions[0].requiredAnchoredEvidence, 'a Big-Four audit');
});

test('v0.2: a claim with no dossier has empty falsificationConditions and null contraryWeight', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  const c = queryClaim(idx, EMP)!;
  assert.deepEqual(c.falsificationConditions, []);
  assert.equal(c.contraryWeight, null);
});

test('v0.2 (NI-13b/CIP-12): attaching a dossier never recomputes status/verdict/stances/lineage', () => {
  const votes = [vote('V1', EMP, 'NO'), vote('V2', EMP, 'YES'), vote('V3', EMP, 'YES')];
  const meta = { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' as const } };
  const withDossier = buildClaimIndex(votes, keyring, 2, {}, meta, { [EMP]: dossier(EMP, 'DECISIVE') });
  const plain = buildClaimIndex(votes, keyring, 2, {}, meta);
  const a = queryClaim(withDossier, EMP)!, b = queryClaim(plain, EMP)!;
  assert.equal(a.status, b.status);
  assert.equal(a.verdict, b.verdict);
  assert.deepEqual(a.stances, b.stances);
  assert.deepEqual(a.lineage, b.lineage);
});

test('v0.2 review hook: an EMPIRICAL_LIVE current claim with MATERIAL/DECISIVE contrary weight is a re-adjudication candidate', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } }, { [EMP]: dossier(EMP, 'MATERIAL') });
  const cands = reviewCandidates(idx);
  assert.equal(cands.length, 1);
  assert.equal(cands[0].ballotHash, EMP);
  assert.ok(cands[0].falsificationConditions.length > 0); // the candidate carries WHAT would warrant re-adjudication
});

test('v0.2 review hook: SETTLED is never a candidate; NEGLIGIBLE/WEAK is never a candidate', () => {
  const idxSettled = buildClaimIndex(unanimous(SET, 'YES'), keyring, 2, {}, { [SET]: { epistemicType: 'SETTLED' } }, { [SET]: dossier(SET, 'MATERIAL') });
  assert.equal(reviewCandidates(idxSettled).length, 0); // SETTLED is durable — not reviewed even at MATERIAL
  const idxWeak = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } }, { [EMP]: dossier(EMP, 'WEAK') });
  assert.equal(reviewCandidates(idxWeak).length, 0); // weak contrary evidence does not warrant review
});

test('v0.2 review hook: a SUPERSEDED (non-current) version is not a candidate — only the live head', () => {
  const B1 = ballotHash('live claim', 'v1');
  const B2 = ballotHash('live claim', 'v2');
  const votes = [...unanimous(B1, 'YES'), ...unanimous(B2, 'NO')];
  const meta = {
    [B1]: { epistemicType: 'EMPIRICAL_LIVE' as const },
    [B2]: { epistemicType: 'EMPIRICAL_LIVE' as const, supersedes: B1, supersedeReason: 'new anchor', newAnchor: true },
  };
  // B1 carries a MATERIAL dossier, but B1 has been superseded by B2 — only the current head is reviewable
  const idx = buildClaimIndex(votes, keyring, 2, {}, meta, { [B1]: dossier(B1, 'MATERIAL') });
  const cands = reviewCandidates(idx);
  assert.ok(!cands.some((c) => c.ballotHash === B1)); // superseded version not re-reviewed
});

test('v0.2 render: a re-adjudication candidate surfaces its falsification conditions', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } }, { [EMP]: dossier(EMP, 'MATERIAL') });
  const md = renderClaimMarkdown(viewClaim(idx[0], [], true));
  assert.match(md, /falsification|re-adjudicat/i);
  assert.match(md, /Big-Four audit/);
});

// ============================================================================
// CIP-13 v0.3 — panel-ratified typing + review triggers (cadence).
// v0.1 lets the PROPOSER declare a type; v0.3 lets the PANEL ratify it via a type
// sub-claim (§6: "a type change is a CIP-5 fork OR a v0.3 panel-ratified type
// sub-claim"). reviewQueue adds staleness cadence on top of v0.2's contrary-weight.
// ============================================================================
import { reviewQueue } from '../src/commons.ts';

test('v0.3: a RATIFIED type sub-claim overrides the proposer-declared type (typeRatified=true)', () => {
  const X = ballotHash('claim X', 'c');
  const T = ballotHash('type sub-claim for X', 'is X EMPIRICAL_LIVE?');
  const votes = [...unanimous(X, 'YES'), ...unanimous(T, 'YES')]; // type sub-claim ratifies YES
  const meta: Record<string, BallotMeta> = {
    [X]: { epistemicType: 'SETTLED' }, // proposer declared SETTLED...
    [T]: { typesClaimFor: X, proposedType: 'EMPIRICAL_LIVE' }, // ...panel ratifies EMPIRICAL_LIVE
  };
  const c = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  assert.equal(c.epistemicType, 'EMPIRICAL_LIVE'); // panel-ratified type wins
  assert.equal(c.typeRatified, true);
});

test('v0.3: an UNRATIFIED type sub-claim (no quorum) does not change the declared type', () => {
  const X = ballotHash('claim X', 'c2');
  const T = ballotHash('type sub-claim', 'c2t');
  const votes = [
    ...unanimous(X, 'YES'),
    vote('V1', T, 'YES'), vote('V2', T, 'NO'), vote('V3', T, 'INDETERMINATE'), // 1/1/1 — no quorum
  ];
  const meta: Record<string, BallotMeta> = {
    [X]: { epistemicType: 'SETTLED' },
    [T]: { typesClaimFor: X, proposedType: 'NORMATIVE' },
  };
  const c = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  assert.equal(c.epistemicType, 'SETTLED'); // declared type stands
  assert.equal(c.typeRatified, false);
});

test('v0.3: the latest ratified type sub-claim wins (deterministic, log order)', () => {
  const X = ballotHash('claim X', 'c3');
  const T1 = ballotHash('type subclaim 1', 'c3a');
  const T2 = ballotHash('type subclaim 2', 'c3b');
  const votes = [...unanimous(X, 'YES'), ...unanimous(T1, 'YES'), ...unanimous(T2, 'YES')];
  const meta: Record<string, BallotMeta> = {
    [X]: { epistemicType: 'SETTLED' },
    [T1]: { typesClaimFor: X, proposedType: 'EMPIRICAL_LIVE' },
    [T2]: { typesClaimFor: X, proposedType: 'NORMATIVE' }, // later → wins
  };
  const c = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  assert.equal(c.epistemicType, 'NORMATIVE');
});

test('v0.3: a proposer-declared type without a sub-claim has typeRatified=false', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  assert.equal(queryClaim(idx, EMP)!.typeRatified, false);
});

test('v0.3 (NI-13b): panel-ratified typing never recomputes status/verdict/stances', () => {
  const X = ballotHash('claim X', 'c5');
  const T = ballotHash('tsub', 'c5t');
  const votes = [vote('V1', X, 'NO'), vote('V2', X, 'YES'), vote('V3', X, 'YES'), ...unanimous(T, 'YES')];
  const meta: Record<string, BallotMeta> = { [X]: { epistemicType: 'SETTLED' }, [T]: { typesClaimFor: X, proposedType: 'EMPIRICAL_LIVE' } };
  const a = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  const plain = queryClaim(buildClaimIndex(votes, keyring, 2), X)!;
  assert.equal(a.status, plain.status);
  assert.equal(a.verdict, plain.verdict);
  assert.deepEqual(a.stances, plain.stances);
});

test('v0.3 reviewQueue: a STALE EMPIRICAL_LIVE claim is queued with reason STALE', () => {
  // EMP is the first ballot (evidenceTime index 0); now=10, staleAfter=5 -> stale
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } });
  const q = reviewQueue(idx, { now: 10, staleAfter: 5 });
  const item = q.find((i) => i.ballotHash === EMP)!;
  assert.ok(item);
  assert.equal(item.reason, 'STALE');
});

test('v0.3 reviewQueue: contrary-weight takes priority and staleness never queues SETTLED', () => {
  const idx = buildClaimIndex(
    [...unanimous(EMP, 'YES'), ...unanimous(SET, 'YES')],
    keyring, 2, {},
    { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' }, [SET]: { epistemicType: 'SETTLED' } },
    { [EMP]: dossier(EMP, 'MATERIAL') },
  );
  const q = reviewQueue(idx, { now: 100, staleAfter: 1 });
  assert.ok(!q.some((i) => i.ballotHash === SET)); // SETTLED never queued, even when stale
  const emp = q.find((i) => i.ballotHash === EMP)!;
  assert.equal(emp.reason, 'CONTRARY_WEIGHT'); // contrary weight wins over staleness
});

test('v0.3 reviewQueue with no cadence opts == v0.2 contrary-weight candidates', () => {
  const idx = buildClaimIndex(unanimous(EMP, 'YES'), keyring, 2, {}, { [EMP]: { epistemicType: 'EMPIRICAL_LIVE' } }, { [EMP]: dossier(EMP, 'DECISIVE') });
  const q = reviewQueue(idx);
  assert.equal(q.length, 1);
  assert.equal(q[0].reason, 'CONTRARY_WEIGHT');
});

test('v0.3: a multiple-choice type sub-claim ratifies the type directly from the verdict', () => {
  const X = ballotHash('claim X', 'c6');
  const T = ballotHash('type ballot for X', 'c6t');
  // the type sub-claim's verdict IS the chosen type (verdicts SETTLED/EMPIRICAL_LIVE/NORMATIVE)
  const votes = [...unanimous(X, 'YES'), vote('V1', T, 'NORMATIVE'), vote('V2', T, 'NORMATIVE'), vote('V3', T, 'NORMATIVE')];
  const meta: Record<string, BallotMeta> = { [X]: { epistemicType: 'EMPIRICAL_LIVE' }, [T]: { typesClaimFor: X } };
  const c = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  assert.equal(c.epistemicType, 'NORMATIVE'); // panel picked NORMATIVE directly
  assert.equal(c.typeRatified, true);
});

test('v0.3: a multiple-choice type sub-claim with no quorum leaves the declared type', () => {
  const X = ballotHash('claim X', 'c7');
  const T = ballotHash('type ballot', 'c7t');
  const votes = [...unanimous(X, 'YES'), vote('V1', T, 'SETTLED'), vote('V2', T, 'EMPIRICAL_LIVE'), vote('V3', T, 'NORMATIVE')]; // 1/1/1
  const meta: Record<string, BallotMeta> = { [X]: { epistemicType: 'EMPIRICAL_LIVE' }, [T]: { typesClaimFor: X } };
  const c = queryClaim(buildClaimIndex(votes, keyring, 2, {}, meta), X)!;
  assert.equal(c.epistemicType, 'EMPIRICAL_LIVE'); // unchanged
  assert.equal(c.typeRatified, false);
});

// ============================================================================
// CIP-13 productionization — the ballot registry carries the declared CIP-13 meta
// + auditor dossier, and the live read path (buildViews / publish-commons) derives
// them from the registry automatically. The type/supersede/dossier travel with the
// ballot, not via a side-channel.
// ============================================================================
import { appendBallot, loadRegistry, deriveCip13Inputs } from '../src/ballot-registry.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('production: registry round-trips CIP-13 meta + dossier; buildViews derives them', () => {
  const reg = join(mkdtempSync(join(tmpdir(), 'qrm-reg-')), 'ballots.jsonl');
  const prompt = 'Is X still true', context = 'as of 2021';
  const bh = ballotHash(prompt, context);
  appendBallot(reg, prompt, context, {
    meta: { epistemicType: 'EMPIRICAL_LIVE' },
    dossier: { ballotHash: bh, auditorId: 'V2', assessedWeight: 'MATERIAL', falsificationConditions: [{ towardVerdict: 'NO', requiredAnchoredEvidence: 'a Big-Four audit' }] },
  });
  const registry = loadRegistry(reg);
  const { ballotMeta, dossiers } = deriveCip13Inputs(registry);
  assert.equal(ballotMeta[bh]!.epistemicType, 'EMPIRICAL_LIVE');
  assert.equal(dossiers[bh]!.assessedWeight, 'MATERIAL');
  // the production read path auto-derives from the registry — no explicit meta passed
  const views = buildViews(unanimous(bh, 'YES'), keyring, 2, registry, true);
  assert.equal(views[0].epistemicType, 'EMPIRICAL_LIVE');
  assert.equal(views[0].contraryWeight, 'MATERIAL');
  assert.equal(views[0].falsificationConditions[0]!.requiredAnchoredEvidence, 'a Big-Four audit');
});

test('production: a plain registered ballot (no meta) still verifies and reads untyped', () => {
  const reg = join(mkdtempSync(join(tmpdir(), 'qrm-reg-')), 'ballots.jsonl');
  const prompt = 'Did Apollo land', context = 'c';
  appendBallot(reg, prompt, context); // legacy 3-arg call — unchanged behavior
  const registry = loadRegistry(reg);
  const bh = ballotHash(prompt, context);
  assert.equal(registry[0].ballotHash, bh); // statement still recorded + hash-verifies
  const views = buildViews(unanimous(bh, 'YES'), keyring, 2, registry, true);
  assert.equal(views[0].epistemicType, null); // no declared type → untyped (NI-13a)
  assert.equal(views[0].statement, prompt);
});
