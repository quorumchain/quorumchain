// CIP-5 §9 β-gate fork-drill — demonstrable artifact (the CIP-4 §8 renunciation
// prerequisite). Shows coordination-without-a-coordinator: T0 violations are
// rejected by objective local rules, the T0-preserving fork is canonical
// regardless of weight, and a client monoculture is itself a β-gate failure.
// Run:  node src/fork-demo.ts
import { checkT0, selectCanonicalFork, runForkDrill, type Block, type T0Params } from './fork.ts';

const P: T0Params = { diversityFloor: 3, t0Properties: ['determinism', 'diversity', 'append-only', 'tier-assignment'] };
const clean = (over: Partial<Block> = {}): Block => ({
  height: 10, prevHash: 'abc', recordOp: 'append', deterministic: true,
  attestation: { validators: [{ id: 'V1', fingerprint: 'anthropic' }, { id: 'V2', fingerprint: 'openai' }, { id: 'V3', fingerprint: 'nous' }] },
  ...over,
});

console.log('=== Mechanism A — client-enforced T0 validity (§3) ===');
const cases: [string, Block][] = [
  ['clean block', clean()],
  ['non-deterministic transition', clean({ deterministic: false })],
  ['collapsed diversity (3× same provider)', clean({ attestation: { validators: [{ id: 'V1', fingerprint: 'x' }, { id: 'V2', fingerprint: 'x' }, { id: 'V3', fingerprint: 'x' }] } })],
  ['history rewrite', clean({ recordOp: 'rewrite' })],
  ['tier-laundering (demote T0 "diversity" → T1)', clean({ change: { id: 'c', tier: 'T1', reclassifies: { property: 'diversity', fromTier: 'T0', toTier: 'T1' } } })],
  ['salami-slice (T1 edit to a T0-check definition)', clean({ change: { id: 'c', tier: 'T1', target: 'T0_CHECK_DEFINITION' } })],
];
for (const [label, b] of cases) {
  const r = checkT0(b, P);
  console.log(`  ${(r.valid ? 'ACCEPT' : 'REJECT').padEnd(7)} ${label}${r.valid ? '' : ' — ' + r.violations.join(', ')}`);
}

console.log('\n=== Mechanism B — canonical = T0-preserving fork; weight never launders (§4) ===');
const r = selectCanonicalFork([
  { id: 'honest', weight: 100, blocks: [clean()] },
  { id: 'captured', weight: 1000, blocks: [clean({ recordOp: 'rewrite' })] },
], P);
console.log(`  forks: honest(w=100, T0-clean) vs captured(w=1000, history-rewrite)`);
console.log(`  → canonical: ${r.canonicalId} (${r.reason}). The 10× heavier captured fork is excluded, not preferred.`);

console.log('\n=== §9 drill — inject a T0 violation, assert 100% auto-reject ===');
const injection = clean({ change: { id: 'cap', tier: 'T1', reclassifies: { property: 'diversity', fromTier: 'T0', toTier: 'T2' } } });
const independent = [{ name: 'client-rs', check: checkT0 }, { name: 'client-go', check: checkT0 }, { name: 'client-ts', check: checkT0 }];
const good = runForkDrill(independent, injection, P);
console.log(`  3 independent clients → allReject=${good.allReject}, GREEN=${good.green}`);
console.log(`  ${good.note}`);

console.log('\n=== §7 — a client monoculture is itself a β-gate failure ===');
const buggy = (b: Block, p: T0Params) => {
  const c = checkT0(b, p);
  const v = c.violations.filter((x) => x !== 'tier-assignment-integrity'); // shared bug: skips one check
  return { valid: v.length === 0, violations: v };
};
const mono = [{ name: 'client-a', check: buggy }, { name: 'client-b', check: buggy }, { name: 'client-c', check: buggy }];
const bad = runForkDrill(mono, injection, P);
console.log(`  3 clients sharing one bug → allReject=${bad.allReject}, GREEN=${bad.green}`);
console.log(`  ${bad.note}`);
console.log('\n  → Renunciation (CIP-4 §8) may not be contemplated until this drill is green and sustained.');
