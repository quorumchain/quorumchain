// Quorumchain ($QRM) — Phase 1.1 daemon entrypoint. Drains the ballot queue with NO
// human running run-panel.ts: for each pending ballot it spawns the three deliberating
// signer hosts, pin-checks them, convenes, closes them, and records the result. This is
// run-panel.ts's body turned into a per-ballot function and looped over the queue.
//
//   node src/run-daemon.ts                 # drain ./data/queue once, then exit
//
// Same custody invariant as run-panel: this process holds NO key and supplies NO
// verdict. Drain-then-exit (round-48 small-scale loop) — re-run or schedule to continue.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convene, startSigners } from './panel.ts';
import { makeRemoteSigner } from './signer.ts';
import { loadPinnedKeyring, assertMatchesPin } from './keystore.ts';
import { verifyLog, readLog } from './vote-log.ts';
import { drainQueue, type RunResult } from './daemon.ts';
import { type Ballot } from './queue.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const KEYSTORE = join(DATA, 'keystore');
const LOG = join(DATA, 'votes.log');
const QUEUE = join(DATA, 'queue');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const DELIB_HOST = join(HERE, 'deliberating-signer-host.ts');

const QUORUM = 2;
const MAX_ATTEMPTS = 3;

// One convening, with no human in the loop. Throws if it could NOT run (no host came
// up, or a key was substituted) — the daemon treats a throw as a liveness failure and
// retries; it never invents a verdict. Returns the full ConveneResult otherwise.
async function liveRunBallot(ballot: Ballot): Promise<RunResult> {
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
    });
    const rawDump = r.votes.map((v) => `### ${v.validatorId} — ${v.verdict}\n${v.rawOutput}`).join('\n\n');
    writeFileSync(join(DATA, `raw-${r.ballotHash.slice(0, 12)}.txt`), rawDump);
    return r;
  } finally {
    for (const s of started) s.close();
  }
}

async function main() {
  mkdirSync(DATA, { recursive: true });
  console.error(`Draining queue: ${QUEUE}`);
  const summary = await drainQueue({ queueDir: QUEUE, quorum: QUORUM, maxAttempts: MAX_ATTEMPTS, runBallot: liveRunBallot });
  console.log('Done     :', JSON.stringify(summary.done));
  console.log('Retried  :', JSON.stringify(summary.retried));
  console.log('Failed   :', JSON.stringify(summary.failed));
  console.log('Log      :', LOG, '|', readLog(LOG).length, 'entries | chain valid:', verifyLog(LOG).valid);
}

main();
