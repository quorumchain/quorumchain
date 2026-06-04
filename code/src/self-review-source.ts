// Quorumchain ($QRM) — Phase 1.2 tier 1: the self-review ballot source (round-51
// SELFREVIEW_FIRST 3/3). On a DETERMINISTIC, PUBLISHED trigger — the latest git commit —
// it auto-enqueues a SOUND/REVISE/INADEQUATE review of that commit's diff, so the panel
// reviews its own changes with no human choosing the question.
//
// This satisfies the round-51 binding constraint: the selection rule is reproducible by
// any outsider from public inputs (the commit sha, subject, and date are all in public
// git history), so no operator can hand-pick, cherry-pick, or reorder ballots. The
// forcing function: a review keys off COMMITTED state — uncommitted working-tree changes
// are not public and so cannot be the basis of an outsider-reproducible review.
//
// reviewBallotFor is PURE (commit -> ballot). sourceSelfReview enqueues it at most once
// per commit (hasBallot dedup). The git read lives in the CLI (source-self-review.ts).

import { enqueue, hasBallot, type Ballot } from './queue.ts';

export interface Commit {
  sha: string;
  subject: string;
  epoch: number; // committer date, seconds — public (`git log -1 --format=%ct`)
}

const SHORT = 12;
const VERDICTS = ['SOUND', 'REVISE', 'INADEQUATE'];

/** The review ballot for one commit. Deterministic: same commit -> identical id and
 *  ballot. The id is `review-<epoch>-<full-sha>` — epoch-prefixed so ids sort
 *  oldest-commit-first, FULL-sha-suffixed so the dedup identity is collision-free and
 *  reproducible from public git (round-52 V2: a 12-char prefix can collide within a
 *  committer-second, silently suppressing a distinct commit's review). The short sha is
 *  used only for human-readable display in the prompt. */
export function reviewBallotFor(commit: Commit): { id: string; ballot: Ballot } {
  const short = commit.sha.slice(0, SHORT);
  const id = `review-${commit.epoch}-${commit.sha}`;
  const prompt =
    `Autonomous self-review of commit ${short} ("${commit.subject}"): is the change SOUND? ` +
    `Review it adversarially from source — find any gap between what it claims and what it does.`;
  const context =
    `Run \`git show ${commit.sha}\` to see the full diff, and read the surrounding files it ` +
    `touches. Judge the change on its merits and against the project's invariants (custody, ` +
    `no-laundering, liveness, tamper-evidence, TDD). SOUND = the change is correct as-is; ` +
    `REVISE = a real, fixable gap (name it precisely); INADEQUATE = the approach is wrong.`;
  return { id, ballot: { prompt, context, verdicts: VERDICTS } };
}

/** Enqueue a review of `head` unless that commit has already been reviewed (in any
 *  queue state). Returns the ballot id if enqueued, or null if it was a no-op. */
export function sourceSelfReview(params: { queueDir: string; head: Commit }): string | null {
  const { id, ballot } = reviewBallotFor(params.head);
  if (hasBallot(params.queueDir, id)) return null; // deterministic + idempotent: no flooding
  enqueue(params.queueDir, id, ballot);
  return id;
}
