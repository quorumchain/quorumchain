// CIP-7 — validator lifecycle & model churn drills (the panel must outlive its
// most ephemeral member). Five drills map to the spec's testnet gates G1–G5 and
// exercise the non-negotiable invariants NI-1..6:
//   G1 sunset      — overlap-handoff keeps the diversity floor (0 breaches); the
//                    replacement goes through probation (NI-4).
//   G2 upgrade     — PROBATION: 0 inherited trust, 0 quorum weight (NI-3); a 2nd
//                    concurrent upgrade is queued, not admitted (NI-2).
//   G3 convergence — correlation-eviction fires where ground truth exists; on the
//                    unverifiable class the structural floor is the sole guarantee
//                    (NI-6), never the detector.
//   G4 double-sunset — undersized pool → FREEZE rather than a floor breach (NI-5).
//   G5 substitution  — 0 silent substitutions; an out-of-band version change with
//                    no logged T1 admission event is caught.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seedPanel,
  proposeUpgrade,
  graduate,
  effectiveQuorum,
  distinctStandingFamilies,
  floorOk,
  beginRotation,
  completeRotation,
  correlationEvict,
  auditSubstitutions,
  STANDING_FLOOR,
  type Validator,
} from '../src/lifecycle.ts';

function v(id: string, corpusFamily: string, calibration = 0.8, status: 'STANDING' | 'PROBATION' = 'STANDING'): Validator {
  return {
    id,
    version: `${id}@v1`,
    status,
    calibration,
    provenance: { corpusFamily, teacher: null, weightDerivation: `${corpusFamily}-base`, provider: id, servingStack: `${id}-stack` },
  };
}

// genesis: 4 distinct-family standing validators (NI-3 floor)
function basePanel() {
  return seedPanel([v('A', 'corpus-A'), v('B', 'corpus-B'), v('C', 'corpus-C'), v('D', 'corpus-D')]);
}

test('genesis panel holds the ≥4 distinct-family standing floor (NI-3)', () => {
  const p = basePanel();
  assert.equal(distinctStandingFamilies(p), 4);
  assert.equal(floorOk(p), true);
  assert.equal(effectiveQuorum(p), 4);
});

test('G2 / NI-3: an upgrade enters PROBATION with 0 inherited trust and 0 quorum weight', () => {
  const p = basePanel();
  const r = proposeUpgrade(p, 'A', { version: 'A@v2', calibration: 0.5, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: true });
  assert.equal(r.ok, true);
  const upgraded = r.panel.validators.find((x) => x.version === 'A@v2')!;
  assert.equal(upgraded.status, 'PROBATION');
  assert.equal(upgraded.calibration, 0.5); // its OWN score, not the predecessor's 0.8 (no inheritance)
  // probation carries zero quorum weight: standing count drops to 3 while shadowed
  assert.equal(effectiveQuorum(r.panel), 3);
});

test('G2 / NI-2: a second concurrent upgrade is queued, not admitted', () => {
  let p = basePanel();
  p = proposeUpgrade(p, 'A', { version: 'A@v2', calibration: 0.9, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: true }).panel;
  const r2 = proposeUpgrade(p, 'B', { version: 'B@v2', calibration: 0.9, provenance: { corpusFamily: 'corpus-B', teacher: null, weightDerivation: 'corpus-B-base', provider: 'B', servingStack: 'B-stack' }, fingerprintIndependent: true });
  assert.equal(r2.ok, false);
  assert.match(r2.reason!, /NI-2|probation.*cap|queued/i);
});

test('G2: a probation version graduates only when it re-proves calibration ≥ predecessor', () => {
  let p = basePanel();
  p = proposeUpgrade(p, 'A', { version: 'A@v2', calibration: 0.7, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: true }).panel;
  const tooLow = graduate(p, 'A@v2', { predecessorCalibration: 0.8 });
  assert.equal(tooLow.ok, false); // 0.7 < 0.8
  p = proposeUpgrade(basePanel(), 'A', { version: 'A@v2', calibration: 0.85, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: true }).panel;
  const ok = graduate(p, 'A@v2', { predecessorCalibration: 0.8 });
  assert.equal(ok.ok, true);
  assert.equal(ok.panel.validators.find((x) => x.version === 'A@v2')!.status, 'STANDING');
  assert.equal(effectiveQuorum(ok.panel), 4); // back to full standing
});

test('NI-1: a candidate sharing a corpus lineage is rejected even with a different name/provider', () => {
  const p = basePanel();
  // "E" looks distinct (own provider/name) but shares corpus-A's pretraining lineage
  const r = proposeUpgrade(p, 'B', { version: 'E@v1', calibration: 0.9, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'E', servingStack: 'E-stack' }, fingerprintIndependent: true });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /lineage|provenance|NI-1|distinct/i);
});

test('NI-1: failing the independence/fingerprint test is rejected', () => {
  const p = basePanel();
  const r = proposeUpgrade(p, 'A', { version: 'A@v2', calibration: 0.9, provenance: { corpusFamily: 'corpus-A', teacher: null, weightDerivation: 'corpus-A-base', provider: 'A', servingStack: 'A-stack' }, fingerprintIndependent: false });
  assert.equal(r.ok, false);
  assert.match(r.reason!, /independ|fingerprint/i);
});

test('G1 sunset: overlap-handoff never breaches the floor and the replacement is probationed (NI-4)', () => {
  let p = basePanel();
  // bring in a graduated 5th so retiring one still leaves the ≥4 floor
  const replacement = { version: 'E@v1', calibration: 0.85, provenance: { corpusFamily: 'corpus-E', teacher: null, weightDerivation: 'corpus-E-base', provider: 'E', servingStack: 'E-stack' }, fingerprintIndependent: true };
  const rot = beginRotation(p, 'D', replacement);
  assert.equal(rot.ok, true);
  assert.equal(rot.panel.validators.find((x) => x.version === 'E@v1')!.status, 'PROBATION'); // NI-4
  assert.equal(floorOk(rot.panel), true); // still 4 standing during handoff
  p = graduate(rot.panel, 'E@v1', { predecessorCalibration: 0.0 }).panel; // now 5 standing
  const done = completeRotation(p, 'D');
  assert.equal(done.ok, true);
  assert.equal(done.panel.frozen, false);
  assert.equal(floorOk(done.panel), true); // 4 standing after drop — 0 breaches
  assert.ok(!done.panel.validators.some((x) => x.id === 'D'));
});

test('overlap handoff: completeRotation refuses to retire while the replacement is still in probation (V2 review finding)', () => {
  // 5 standing families, so dropping one would NOT breach the >=4 floor on its own
  let p = seedPanel([v('A', 'corpus-A'), v('B', 'corpus-B'), v('C', 'corpus-C'), v('D', 'corpus-D'), v('F', 'corpus-F')]);
  // begin a rotation for D — the replacement E is admitted but still in PROBATION
  p = beginRotation(p, 'D', { version: 'E@v1', calibration: 0.85, provenance: { corpusFamily: 'corpus-E', teacher: null, weightDerivation: 'corpus-E-base', provider: 'E', servingStack: 'E-stack' }, fingerprintIndependent: true }).panel;
  // retiring D now would drop the handoff replacement on the floor — the protocol must refuse
  const premature = completeRotation(p, 'D');
  assert.equal(premature.ok, false);
  assert.match(premature.reason!, /probation|graduate|handoff/i);
  assert.ok(premature.panel.validators.some((x) => x.id === 'D')); // D not dropped
  // once E graduates, the rotation completes
  p = graduate(p, 'E@v1', { predecessorCalibration: 0 }).panel;
  const done = completeRotation(p, 'D');
  assert.equal(done.ok, true);
  assert.ok(!done.panel.validators.some((x) => x.id === 'D'));
});

test('G4 double-sunset: an undersized standby pool FREEZES rather than breach the floor (NI-5)', () => {
  const p = basePanel(); // exactly at floor (4), no standby graduated
  // retire two with no graduated diverse replacement available to hold the floor
  const r1 = completeRotation(p, 'C'); // would drop to 3 standing -> below floor
  assert.equal(r1.panel.frozen, true);
  assert.equal(floorOk(r1.panel), true); // floor never actually breached — froze instead
  assert.match(r1.reason!, /freeze|floor|NI-5/i);
});

test('G3 convergence: correlation-eviction fires on the verifiable class', () => {
  const p = basePanel();
  // A and B realized highly correlated errors on ground-truth-checkable claims
  const r = correlationEvict(p, [{ a: 'A', b: 'B', correlation: 0.95 }], 'VERIFIABLE');
  assert.ok(r.evicted.length >= 1);
  assert.match(r.note, /evict/i);
});

test('G3 / NI-6: on the unverifiable class the structural floor is the sole guarantee, not the detector', () => {
  const p = basePanel();
  const r = correlationEvict(p, [{ a: 'A', b: 'B', correlation: 0.95 }], 'UNVERIFIABLE');
  assert.deepEqual(r.evicted, []); // a passed/failed correlation test is NOT treated as proof either way
  assert.match(r.note, /structural|NI-6|margin/i);
});

test('G5 substitution audit: an out-of-band version change with no T1 admission event is caught', () => {
  const p = basePanel();
  // simulate a provider silently swapping A's weights with no logged admission event
  const tampered = structuredClone(p);
  tampered.validators.find((x) => x.id === 'A')!.version = 'A@v2-SILENT';
  const findings = auditSubstitutions(p, tampered);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /A@v2-SILENT|silent|unlogged/i);
  // the legitimate flow produces zero findings
  assert.deepEqual(auditSubstitutions(p, p), []);
});
