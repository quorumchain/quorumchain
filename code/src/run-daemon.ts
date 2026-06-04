// Quorumchain ($QRM) — Phase 1.1 daemon entrypoint. Drains the ballot queue with NO
// human running run-panel.ts: for each pending ballot it spawns the three deliberating
// signer hosts, pin-checks them, convenes, closes them, and records the result (the
// per-ballot convening lives in live-ballot.ts, shared with the Phase 1.3 self-improve
// cycle). Drain-then-exit (round-48 small-scale loop) — re-run or schedule to continue.
//
//   node src/run-daemon.ts                 # drain ./data/queue once, then exit

import { verifyLog, readLog } from './vote-log.ts';
import { drainQueue } from './daemon.ts';
import { liveRunBallot, LOG, QUEUE, QUORUM, MAX_ATTEMPTS } from './live-ballot.ts';

async function main() {
  console.error(`Draining queue: ${QUEUE}`);
  const summary = await drainQueue({ queueDir: QUEUE, quorum: QUORUM, maxAttempts: MAX_ATTEMPTS, runBallot: liveRunBallot });
  console.log('Done     :', JSON.stringify(summary.done));
  console.log('Retried  :', JSON.stringify(summary.retried));
  console.log('Failed   :', JSON.stringify(summary.failed));
  console.log('Log      :', LOG, '|', readLog(LOG).length, 'entries | chain valid:', verifyLog(LOG).valid);
}

main();
