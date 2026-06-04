// Quorumchain ($QRM) — RemoteSigner host (runs as a SEPARATE OS process).
// This is the OS-level custody isolation the round-44/45 Signer boundary pointed
// at (#2 residual). One validator's private key is generated HERE and never leaves
// this process — not in any IPC response, not in any log. The orchestrator speaks
// to this host over stdio (newline-delimited JSON) and can only: (a) read the
// PUBLIC key, and (b) ask it to sign a ballot it describes by CONTENT. The host
// derives the ballot hash itself (round-45 binding) and decides+signs its own
// verdict, so the orchestrator can neither see the key nor mint/alter a verdict.
//
// Deliberation: locally the verdict is a fixed stand-in supplied at spawn (env),
// which is enough to prove the CUSTODY + binding mechanics. A production host would
// invoke the real model HERE, child-side — same interface, no orchestrator change.
// This file is only ever SPAWNED, never imported (it reads stdin on load).

import { createInterface } from 'node:readline';
import { generateValidatorKey, ballotHash, signVote } from './signed-vote.ts';
import { loadOrCreateKeyring } from './keystore.ts';

const validatorId = process.env.QRM_VALIDATOR_ID ?? 'V?';
// Stable identity: when a keystore dir is given, load this validator's persistent
// key from disk (created child-side, private half never leaves this process) so the
// public key is the same across every spawn. Ephemeral only as a last resort.
const key = process.env.QRM_KEYSTORE_DIR
  ? loadOrCreateKeyring(process.env.QRM_KEYSTORE_DIR, [validatorId]).keys[validatorId]
  : generateValidatorKey(); // the private key lives ONLY in this process either way
const verdict = process.env.QRM_FIXED_VERDICT ?? 'NO_VERDICT';
const rawOutput = process.env.QRM_FIXED_RAW ?? `deliberation withheld\nVERDICT: ${verdict}`;

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let req: { id?: number; type?: string; prompt?: string; context?: string };
  try {
    req = JSON.parse(line);
  } catch {
    return; // ignore malformed input
  }
  let res: Record<string, unknown>;
  if (req.type === 'pubkey') {
    res = { publicKeyPem: key.publicKeyPem }; // public half only — never the private key
  } else if (req.type === 'sign') {
    const bh = ballotHash(req.prompt ?? '', req.context ?? ''); // derived here, not caller-supplied
    res = { vote: signVote({ validatorId, privateKeyPem: key.privateKeyPem, ballotHash: bh, verdict, rawOutput }) };
  } else {
    res = { error: 'unknown request type' }; // there is NO request that returns the private key
  }
  process.stdout.write(JSON.stringify({ id: req.id, ...res }) + '\n');
});
