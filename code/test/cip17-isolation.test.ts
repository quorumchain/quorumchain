// Quorumchain ($QRM) — CIP-17 §7.5 (key separation) and §7.6 (dependency isolation),
// asserted STRUCTURALLY (no network). These guard the two hard architectural invariants:
// the anchoring key reaches only Layer C, and @solana/web3.js leaks into no other module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as solanaAnchor from '../src/solana-anchor.ts';
import * as anchorRecord from '../src/anchor-record.ts';
import * as verifyAnchored from '../src/verify-anchored.ts';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

// §7.6 — @solana/web3.js is imported ONLY by solana-anchor.ts. No Solana import surface in
// panel.ts / vote-log.ts / commons.ts / anchor.ts (CIP-15), or anywhere else.
test('@solana/web3.js is imported only by solana-anchor.ts (§7.6 dependency isolation)', () => {
  const importers: string[] = [];
  for (const f of readdirSync(SRC)) {
    if (!f.endsWith('.ts')) continue;
    const txt = readFileSync(join(SRC, f), 'utf8');
    if (/from\s+['"]@solana\/web3\.js['"]|require\(\s*['"]@solana\/web3\.js['"]/.test(txt)) {
      importers.push(f);
    }
  }
  assert.deepEqual(importers, ['solana-anchor.ts']);
});

test('the CIP-15 anchor.ts and core modules carry no Solana import surface (§7.6)', () => {
  for (const f of ['anchor.ts', 'panel.ts', 'vote-log.ts', 'commons.ts']) {
    const txt = readFileSync(join(SRC, f), 'utf8');
    assert.ok(!/@solana\/web3\.js/.test(txt), `${f} must not reference @solana/web3.js`);
  }
});

test('the Layer-B chain and the verifier have no transitive Solana surface at module level', () => {
  // anchor-record.ts is zero-dep; verify-anchored imports the seam (types/helpers) from
  // solana-anchor.ts but must not itself import @solana/web3.js.
  const ar = readFileSync(join(SRC, 'anchor-record.ts'), 'utf8');
  const va = readFileSync(join(SRC, 'verify-anchored.ts'), 'utf8');
  assert.ok(!/@solana\/web3\.js/.test(ar));
  assert.ok(!/@solana\/web3\.js/.test(va));
  // sanity: the modules loaded (no transitive web3 import blew up at import time)
  assert.equal(typeof anchorRecord.appendAnchor, 'function');
  assert.equal(typeof verifyAnchored.verifyAnchored, 'function');
});

// §7.5 — the anchoring key cannot sign a vote / ratify a ballot; it is structurally a Solana
// keypair (64-byte secret), not a validator Ed25519 PEM keystore key.
test('the anchoring keypair is a Solana key with no vote/ratify capability (§7.5 key separation)', () => {
  const kp = solanaAnchor.newAnchoringKeypair();
  // structurally a Solana key: a 64-byte Uint8Array secret, never a PEM private key.
  assert.ok(kp.secretKey instanceof Uint8Array);
  assert.equal(kp.secretKey.length, 64);
  assert.ok(!JSON.stringify(Array.from(kp.secretKey)).includes('PRIVATE KEY'));
  // the solana-anchor module exposes ONLY anchoring capabilities — no signVote / ratify.
  const exported = Object.keys(solanaAnchor);
  assert.ok(!exported.some((k) => /signVote|ratify|appendVote/i.test(k)),
    'solana-anchor must export no vote/ratify capability');
});

test('the anchoring module does not import the validator signing/keystore primitives (§7.5)', () => {
  const txt = readFileSync(join(SRC, 'solana-anchor.ts'), 'utf8');
  assert.ok(!/from\s+['"]\.\/signed-vote\.ts['"]/.test(txt), 'must not import signed-vote');
  assert.ok(!/from\s+['"]\.\/keystore\.ts['"]/.test(txt), 'must not import keystore');
});
