// Quorumchain ($QRM) — Phase 1.3 entrypoint. One standing self-improvement cycle with no
// human in the loop: source a review of HEAD (Phase 1.2 tier 1) -> convene the panel and
// drain it (Phase 1.1) -> apply the gate (a change is APPROVED only on a ratified SOUND)
// -> refresh the public feed (Phase 1.4). The agent proposes + builds + commits; this
// gates it; nothing is approved without 2/3 SOUND. Run after a commit, or on a cadence.
//
//   node src/run-self-improve.ts

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drainQueue } from './daemon.ts';
import { sourceSelfReview, reviewBallotFor } from './self-review-source.ts';
import { gateOf } from './self-improve.ts';
import { loadPinnedKeyring } from './keystore.ts';
import { buildFeed, renderFeedMarkdown } from './feed.ts';
import { liveRunBallot, QUEUE, LOG, QUORUM, MAX_ATTEMPTS } from './live-ballot.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const OUT_DIR = join(HERE, '..', '..', 'docs');

const git = (args: string[]) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();

async function main() {
  const head = { sha: git(['rev-parse', 'HEAD']), subject: git(['log', '-1', '--format=%s']), epoch: parseInt(git(['log', '-1', '--format=%ct']), 10) };
  const { id } = reviewBallotFor(head);
  const sourced = sourceSelfReview({ queueDir: QUEUE, head });
  console.error(sourced ? `Sourced self-review of ${head.sha.slice(0, 12)}: ${id}` : `HEAD ${head.sha.slice(0, 12)} already reviewed (${id})`);

  // Drain (convenes the review if pending). A liveness failure leaves it pending/failed.
  const summary = await drainQueue({ queueDir: QUEUE, quorum: QUORUM, maxAttempts: MAX_ATTEMPTS, runBallot: liveRunBallot });
  if (summary.retried.length || summary.failed.length) console.error('Liveness:', JSON.stringify({ retried: summary.retried, failed: summary.failed }));

  // Refresh the public feed regardless of outcome (Phase 1.4).
  const feed = buildFeed(LOG, loadPinnedKeyring(PINNED), QUORUM);
  writeFileSync(join(OUT_DIR, 'feed.json'), JSON.stringify(feed, null, 2) + '\n');
  writeFileSync(join(OUT_DIR, 'FEED.md'), renderFeedMarkdown(feed));

  // Apply the gate to HEAD's review.
  const donePath = join(QUEUE, 'done', `${id}.json`);
  if (!existsSync(donePath)) {
    console.log(`GATE: INCONCLUSIVE — HEAD's review did not reach a decision (liveness). Re-run.`);
    return;
  }
  const result = JSON.parse(readFileSync(donePath, 'utf8')).result as { ratified: boolean; verdict: string | null; tally: Record<string, number> };
  const gate = gateOf(result);
  console.log(`GATE: ${gate} — HEAD ${head.sha.slice(0, 12)} | verdict: ${result.verdict ?? 'none'} | tally: ${JSON.stringify(result.tally)}`);
  console.log(gate === 'APPROVED' ? 'The panel ratified this change SOUND (2/3). Approved.' : 'NOT approved — the change is gated until the panel ratifies it SOUND.');
}

main();
