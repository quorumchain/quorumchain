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
