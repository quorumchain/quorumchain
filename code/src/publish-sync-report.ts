// Quorumchain ($QRM) — thin impure shell around checkPublishSync: gather the committed
// votes.log blob from git HEAD, run the pure guard, and print any drift warnings. Shared by
// publish-commons.ts and publish-feed.ts. NEVER blocks publishing (NI-17a spirit) — it warns
// so a forgotten `git add -f code/data/votes.log` (or a stale anchor) is caught before push.

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { readLog } from './vote-log.ts';
import { readAnchors } from './anchor-record.ts';
import { checkPublishSync } from './publish-sync-check.ts';

/** The path of votes.log relative to the repo, as git tracks it. */
const TRACKED_PATH = 'code/data/votes.log';

/** Read votes.log as committed at git HEAD, or null if it is untracked / git is unavailable. */
function committedVotesLog(repoDir: string): string | null {
  const r = spawnSync('git', ['-C', repoDir, 'show', `HEAD:${TRACKED_PATH}`], { encoding: 'utf8' });
  if (r.status !== 0) return null; // untracked at HEAD, or not a git repo
  return r.stdout;
}

/** Resolve the repo root from a data dir (…/ai-blockchain/code/data → …/ai-blockchain). */
function repoRootFromDataDir(dataDir: string): string {
  return dirname(dirname(dataDir)); // data → code → repo root
}

export function reportPublishSync(logPath: string, anchorPath: string): void {
  const dataDir = dirname(logPath);
  const repoDir = repoRootFromDataDir(dataDir);
  const workingEntries = readLog(logPath);
  const anchors = existsSync(anchorPath) ? readAnchors(anchorPath) : [];
  const workingLogText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
  const committedLogText = committedVotesLog(repoDir);
  const r = checkPublishSync({ workingEntries, anchors, workingLogText, committedLogText });
  if (r.ok) {
    console.log('Publish sync: OK (head==anchor; committed votes.log matches the chain)');
  } else {
    console.warn('Publish sync: WARNING');
    for (const w of r.warnings) console.warn(`  - ${w}`);
  }
}
