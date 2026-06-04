// Quorumchain ($QRM) — the live per-ballot convening, shared by run-daemon.ts (Phase
// 1.1) and run-self-improve.ts (Phase 1.3). Spawns the three deliberating signer hosts,
// pin-checks them, convenes, closes — holding NO key and supplying NO verdict. Throws if
// it could NOT run (no host up, or a key substituted), which the daemon treats as a
// liveness retry; otherwise returns the full ConveneResult.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convene, startSigners } from './panel.ts';
import { makeRemoteSigner } from './signer.ts';
import { loadPinnedKeyring, assertMatchesPin } from './keystore.ts';
import { type RunResult } from './daemon.ts';
import { type Ballot } from './queue.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DATA = join(HERE, '..', 'data');
export const KEYSTORE = join(DATA, 'keystore');
export const LOG = join(DATA, 'votes.log');
export const QUEUE = join(DATA, 'queue');
export const REGISTRY = join(DATA, 'ballots.jsonl'); // ballot statements for the read surface (CIP-9)
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const DELIB_HOST = join(HERE, 'deliberating-signer-host.ts');

export const QUORUM = 2;
export const MAX_ATTEMPTS = 3;

export async function liveRunBallot(ballot: Ballot): Promise<RunResult> {
  mkdirSync(DATA, { recursive: true });
  const pinned = loadPinnedKeyring(PINNED);
  const { started, startupFailures } = await startSigners(['V1', 'V2', 'V3'], (id) =>
    makeRemoteSigner({ validatorId: id, hostPath: DELIB_HOST, timeoutMs: 600_000, env: { QRM_KEYSTORE_DIR: KEYSTORE } }),
  );
  if (started.length === 0) throw new Error(`no signers started: ${JSON.stringify(startupFailures)}`);
  const presented = Object.fromEntries(started.map((s) => [s.validatorId, s.publicKeyPem]));
  assertMatchesPin(presented, pinned); // substitution -> throw -> retry/fail; absence allowed
  try {
    const r = await convene({
      prompt: ballot.prompt,
      context: ballot.context ?? '',
      signers: started,
      keyring: pinned,
      quorum: QUORUM,
      logPath: LOG,
      verdicts: ballot.verdicts,
      registryPath: REGISTRY, // record the statement so the read surface can show it (round-58)
    });
    const rawDump = r.votes.map((v) => `### ${v.validatorId} — ${v.verdict}\n${v.rawOutput}`).join('\n\n');
    writeFileSync(join(DATA, `raw-${r.ballotHash.slice(0, 12)}.txt`), rawDump);
    return r;
  } finally {
    for (const s of started) s.close();
  }
}
