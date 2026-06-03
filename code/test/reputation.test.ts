// CIP-9 v0.2 — open claims + external-anchor source reputation (§5 + §7 v0.2).
// The crux the round-39 red-team struck: a graph that rewards "agreement with the
// panel" silently converges to a monoculture of sources that agreed before.
//   NI-9b — reputation moves ONLY on ground truth EXTERNAL to the maintaining
//           panel; where the only "truth" is the panel's own resolution, it does
//           not move. "Agreement forbidden" is enforced by source-of-truth.
//   NI-9c — standing is COMPUTED from the provenance-weighted source distribution
//           by auditable criteria, never panel-assigned; on the unverifiable
//           class stances are shown UNRANKED (raw plurality), never demoted FRINGE.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimStatus, scoreSources, computeStanding, type Claim } from '../src/reputation.ts';

const open: Claim = { id: 'c-open', stances: [{ position: 'X', sources: ['s1'] }] };
const contested: Claim = { id: 'c-cont', stances: [{ position: 'X', sources: ['s1'] }, { position: 'Y', sources: ['s2'] }] };
const externalResolved: Claim = {
  id: 'c-ext',
  stances: [{ position: 'occurred', sources: ['s1', 's2'] }, { position: 'did-not', sources: ['s3'] }],
  resolution: { anchor: 'EXTERNAL', groundTruth: 'occurred', panelVerdict: 'occurred' },
};
const panelOnly: Claim = {
  id: 'c-panel',
  stances: [{ position: 'A', sources: ['s1'] }, { position: 'B', sources: ['s2'] }],
  resolution: { anchor: 'PANEL_ONLY', panelVerdict: 'A' },
};

test('claim states: OPEN / CONTESTED / RESOLVED / UNVERIFIABLE', () => {
  assert.equal(claimStatus(open), 'OPEN');
  assert.equal(claimStatus(contested), 'CONTESTED');
  assert.equal(claimStatus(externalResolved), 'RESOLVED');
  assert.equal(claimStatus(panelOnly), 'UNVERIFIABLE'); // panel can resolve a view, but there is no external truth
});

test('accuracy: a source right on an externally-anchored claim gains reputation; wrong loses it', () => {
  const reps = scoreSources([externalResolved]);
  assert.ok(reps['s1'] > 0); // cited "occurred" == external ground truth
  assert.ok(reps['s2'] > 0);
  assert.ok(reps['s3'] < 0); // cited "did-not" — wrong on external ground truth
});

test('G3 / G7 / NI-9b: agreement on a PANEL-ONLY resolution earns ZERO reputation', () => {
  // s1 agreed with the panel's verdict 'A' — but there is no external anchor
  const reps = scoreSources([panelOnly]);
  assert.equal(reps['s1'] ?? 0, 0);
  assert.equal(reps['s2'] ?? 0, 0); // and the dissenter is not penalized either — no signal exists
});

test('NI-9b accuracy-not-popularity: matching a WRONG consensus loses rep; a correct dissenter gains', () => {
  // panel consensus said "occurred" but external ground truth came back "did-not"
  const consensusWrong: Claim = {
    id: 'c-wrong',
    stances: [{ position: 'occurred', sources: ['agreer'] }, { position: 'did-not', sources: ['dissenter'] }],
    resolution: { anchor: 'EXTERNAL', groundTruth: 'did-not', panelVerdict: 'occurred' },
  };
  const reps = scoreSources([consensusWrong]);
  assert.ok(reps['agreer'] < 0); // agreed with the panel, but the panel was wrong vs ground truth
  assert.ok(reps['dissenter'] > 0); // correct dissent is rewarded — accuracy, not agreement
});

test('NI-9c: on an externally-RESOLVED claim, standing is computed (consensus = ground-truth match)', () => {
  const reps = scoreSources([externalResolved]);
  const standing = computeStanding(externalResolved, reps);
  const occurred = standing.find((s) => s.position === 'occurred')!;
  const didNot = standing.find((s) => s.position === 'did-not')!;
  assert.equal(occurred.standing, 'CONSENSUS');
  assert.equal(didNot.standing, 'CREDIBLE_MINORITY');
});

test('NI-9c: on the UNVERIFIABLE class, stances are UNRANKED (raw plurality), never demoted FRINGE', () => {
  const standing = computeStanding(panelOnly, scoreSources([panelOnly]));
  assert.ok(standing.every((s) => s.standing === 'UNRANKED'));
  assert.ok(standing.every((s) => s.standing !== 'FRINGE'));
  // raw provenance preserved: each stance reports its source count
  assert.deepEqual(standing.map((s) => s.sourceCount).sort(), [1, 1]);
});
