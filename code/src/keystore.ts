// Quorumchain ($QRM) — persistent validator identities.
// A panel's signed-vote log is only meaningful if validator identities are
// stable across sessions, so keys live on disk (private keys 0600) and are
// reused. Testnet-α custody is orchestrator-side; see code/README.md open items.

import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateValidatorKey, type ValidatorKey } from './signed-vote.ts';

export interface Keyring {
  keys: Record<string, ValidatorKey>; // id -> {publicKeyPem, privateKeyPem}
  keyring: Record<string, string>; // id -> publicKeyPem (what ratify() needs)
}

export function loadOrCreateKeyring(dir: string, validatorIds: string[]): Keyring {
  mkdirSync(dir, { recursive: true });
  const keys: Record<string, ValidatorKey> = {};
  for (const id of validatorIds) {
    const privPath = join(dir, `${id}.key.pem`);
    const pubPath = join(dir, `${id}.pub.pem`);
    if (existsSync(privPath) && existsSync(pubPath)) {
      keys[id] = { privateKeyPem: readFileSync(privPath, 'utf8'), publicKeyPem: readFileSync(pubPath, 'utf8') };
    } else {
      const k = generateValidatorKey();
      writeFileSync(privPath, k.privateKeyPem, { mode: 0o600 });
      writeFileSync(pubPath, k.publicKeyPem);
      keys[id] = k;
    }
  }
  const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));
  return { keys, keyring };
}

// --- Pinned / published keyring (Phase 0.2) ---------------------------------
// The keyring `ratify()` trusts must be a PUBLISHED artifact, not whatever a host
// hands back at handshake — otherwise a compromised orchestrator could spawn hosts
// with keys it generated and "ratify" a fake panel. The pinned keyring is committed
// (public keys only) and matches the round-6 published identities; anyone holding it
// + the log can verify a convening, and a silent key swap is visible in its history.

/** Load the published id→publicKeyPem map. Throws if it has not been published yet. */
export function loadPinnedKeyring(path: string): Record<string, string> {
  if (!existsSync(path)) throw new Error(`pinned keyring not found at ${path} — publish it first`);
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, string>;
}

/** Reject key SUBSTITUTION, allow ABSENCE. Every key a host actually presents must be
 *  a pinned validator presenting its published key — a wrong key (substitution) or a
 *  validator not in the pin (unknown) aborts. A pinned validator that presents NO key
 *  is an absence, not a breach: that is a liveness event handled by quorum (2/3 is of
 *  the registered panel), not a reason to abort the convening. This separates the
 *  pin's security property (no substitution) from liveness (round-49 V2 finding). */
export function assertMatchesPin(presented: Record<string, string>, pinned: Record<string, string>): void {
  for (const [id, key] of Object.entries(presented)) {
    if (!(id in pinned)) throw new Error(`validator ${id} is not in the pinned keyring (unknown validator)`);
    if (key !== pinned[id]) throw new Error(`validator ${id} key does not match the pinned keyring (substitution?)`);
  }
}
