// Quorumchain ($QRM) — Phase 1.1 convening daemon (drain-then-exit).
//
// drainQueue makes ONE pass over the currently-pending ballots, oldest-first, and
// convenes the panel on each with no human in the loop. It overlaps NO convenings
// (the hash-chained log forbids concurrent appends), holds NO key (it only calls the
// injected `runBallot`, which spawns/convenes/closes the real signer hosts), and
// classifies each outcome by PARTICIPATION, not by the verdict:
//
//   • >= quorum validators voted  -> a real, decided outcome (ratified or not).
//     Moved to done/. NEVER retried — retrying a genuine NO would launder it.
//   • <  quorum validators voted, OR runBallot threw -> a liveness failure (hosts
//     down, transient). Attempt counter bumped; the ballot stays pending for the
//     next drain. After maxAttempts it is moved to failed/.
//
// Drain-then-exit: bumped ballots are retried on the NEXT invocation (each scheduled
// run is one attempt), so a single drain always terminates. Re-run or schedule to
// keep draining. This is the round-48 "small scale, existence not economics" loop.

import { listPending, bumpAttempt, complete, fail, type Ballot, type QueuedBallot } from './queue.ts';

/** What a single convening returns to the daemon. Only `votes.length` and the
 *  ratification fields are read here; the real runBallot returns a full ConveneResult. */
export interface RunResult {
  votes: { verdict: string }[];
  ratified: boolean;
  [k: string]: unknown;
}

export interface DrainSummary {
  done: string[];
  retried: string[];
  failed: string[];
}

/** Convene every pending ballot once. `runBallot` does the real work (spawn signers,
 *  pin-check, convene, close) and either returns a result or throws if it could not
 *  run at all. A throw is treated as a liveness failure (retry), never as a verdict. */
export async function drainQueue(params: {
  queueDir: string;
  quorum: number;
  maxAttempts: number;
  runBallot: (ballot: Ballot) => Promise<RunResult>;
}): Promise<DrainSummary> {
  const summary: DrainSummary = { done: [], retried: [], failed: [] };
  // Snapshot now: ballots bumped during this pass must NOT be reprocessed in it.
  const pending: QueuedBallot[] = listPending(params.queueDir);

  for (const { id, ballot, attempts } of pending) {
    let result: RunResult | undefined;
    let ranError: string | undefined;
    try {
      result = await params.runBallot(ballot); // sequential — convenings never overlap
    } catch (e) {
      ranError = (e as Error).message;
    }

    // Participation counts REAL verdicts only: a NO_VERDICT (the invoker errored or the
    // agent timed out) is a non-decision, not a vote. >= quorum REAL verdicts means the
    // outcome is meaningful (decided, ratified or not); fewer is a liveness failure to
    // retry — so 2/3 validators failing is never laundered into a finalized decision
    // (round-52 finding, the daemon-side complement to ratify excluding NO_VERDICT).
    const realVotes = result ? result.votes.filter((v) => v.verdict !== 'NO_VERDICT').length : 0;
    if (result && realVotes >= params.quorum) {
      complete(params.queueDir, id, result); // decided (ratified or not) — final, never retried
      summary.done.push(id);
      continue;
    }

    // Liveness failure: too few real verdicts, or the convening could not run at all.
    const reason = ranError ?? `only ${realVotes} of quorum ${params.quorum} validators produced a real verdict`;
    if (attempts + 1 >= params.maxAttempts) {
      fail(params.queueDir, id, reason);
      summary.failed.push(id);
    } else {
      bumpAttempt(params.queueDir, id);
      summary.retried.push(id);
    }
  }
  return summary;
}
