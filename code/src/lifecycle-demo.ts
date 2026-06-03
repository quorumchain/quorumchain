// CIP-7 validator lifecycle drills — demonstrable artifact. Runs the five
// testnet gates G1–G5 over a no-human procedure and the NI-1..6 invariants.
// Run:  node src/lifecycle-demo.ts
import {
  seedPanel, proposeUpgrade, graduate, effectiveQuorum, distinctStandingFamilies, floorOk,
  beginRotation, completeRotation, correlationEvict, auditSubstitutions, STANDING_FLOOR,
  type Validator, type Provenance,
} from './lifecycle.ts';

const prov = (corpus: string, provider = corpus): Provenance => ({ corpusFamily: corpus, teacher: null, weightDerivation: `${corpus}-base`, provider, servingStack: `${provider}-stack` });
const val = (id: string, corpus: string, cal = 0.8): Validator => ({ id, version: `${id}@v1`, status: 'STANDING', calibration: cal, provenance: prov(corpus, id) });
const base = () => seedPanel([val('A', 'corpus-A'), val('B', 'corpus-B'), val('C', 'corpus-C'), val('D', 'corpus-D')]);

console.log(`=== genesis panel (floor = ${STANDING_FLOOR} distinct families) ===`);
let p = base();
console.log(`  standing families: ${distinctStandingFamilies(p)} | quorum weight: ${effectiveQuorum(p)} | floorOk: ${floorOk(p)}`);

console.log('\n=== G2 upgrade drill — PROBATION (NI-3 zero weight, NI-4 always, NI-2 cap) ===');
let r = proposeUpgrade(p, 'A', { version: 'A@v2', calibration: 0.5, provenance: prov('corpus-A', 'A'), fingerprintIndependent: true });
console.log(`  upgrade A→A@v2: ${r.ok ? 'PROBATION' : 'REJECTED'} | its calibration=0.5 (NOT predecessor's 0.8) | quorum weight now ${effectiveQuorum(r.panel)} (shadowed)`);
const second = proposeUpgrade(r.panel, 'B', { version: 'B@v2', calibration: 0.9, provenance: prov('corpus-B', 'B'), fingerprintIndependent: true });
console.log(`  concurrent upgrade B→B@v2: ${second.ok ? 'ADMITTED' : 'QUEUED — ' + second.reason}`);
const grad = graduate(r.panel, 'A@v2', { predecessorCalibration: 0.8 });
console.log(`  graduate A@v2 (calib 0.5 < 0.8): ${grad.ok ? 'GRADUATED' : 'HELD — ' + grad.reason}`);

console.log('\n=== NI-1 — provenance, not a model card ===');
const gamed = proposeUpgrade(p, 'B', { version: 'E@v1', calibration: 0.99, provenance: prov('corpus-A', 'E'), fingerprintIndependent: true });
console.log(`  candidate E (new provider, but corpus-A lineage): ${gamed.ok ? 'ADMITTED' : 'REJECTED — ' + gamed.reason}`);

console.log('\n=== G1 sunset drill — overlap handoff, 0 floor breaches (NI-4) ===');
let rot = beginRotation(p, 'D', { version: 'E@v1', calibration: 0.85, provenance: prov('corpus-E', 'E'), fingerprintIndependent: true });
console.log(`  admit replacement E (probation) while D still standing: floorOk=${floorOk(rot.panel)} (no breach during handoff)`);
p = graduate(rot.panel, 'E@v1', { predecessorCalibration: 0 }).panel;
const done = completeRotation(p, 'D');
console.log(`  graduate E, then drop D: frozen=${done.panel.frozen}, standing families=${distinctStandingFamilies(done.panel)}, floorOk=${floorOk(done.panel)}`);

console.log('\n=== G4 double-sunset drill — FREEZE rather than breach (NI-5) ===');
const freeze = completeRotation(base(), 'C'); // at floor, no graduated replacement
console.log(`  retire C with undersized pool: frozen=${freeze.panel.frozen} | floor breached? ${!floorOk(freeze.panel)} | ${freeze.reason}`);

console.log('\n=== G3 convergence drill — eviction vs NI-6 structural fallback ===');
const ver = correlationEvict(base(), [{ a: 'A', b: 'B', correlation: 0.95 }], 'VERIFIABLE');
console.log(`  verifiable class, A~B corr 0.95: evicted ${JSON.stringify(ver.evicted)} — ${ver.note}`);
const unver = correlationEvict(base(), [{ a: 'A', b: 'B', correlation: 0.95 }], 'UNVERIFIABLE');
console.log(`  unverifiable class, same corr: evicted ${JSON.stringify(unver.evicted)} — ${unver.note}`);

console.log('\n=== G5 substitution audit — 0 silent substitutions ===');
const tampered = structuredClone(base());
tampered.validators.find((v) => v.id === 'A')!.version = 'A@v2-SILENT';
console.log(`  out-of-band swap of A with no T1 event: ${auditSubstitutions(base(), tampered).join('; ')}`);
console.log(`  legitimate panel: ${auditSubstitutions(base(), base()).length} findings`);
console.log('\n  → the chain outlives any single model, with no human: every member change is a logged, gated T1 event.');
