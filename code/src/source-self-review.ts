// Quorumchain ($QRM) — Phase 1.2 tier 1 CLI. Reads the repo's HEAD commit and enqueues
// a self-review ballot of it (at most once per commit). The git read is the only impure
// part; the ballot is built deterministically by self-review-source.ts. Run this on a
// reproducible trigger (e.g. a post-commit hook or fixed cadence), then run-daemon.ts
// drains it — the autonomous loop: commit -> self-review enqueued -> panel convenes.
//
//   node src/source-self-review.ts        # enqueue a review of HEAD, or no-op if reviewed

import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceSelfReview } from './self-review-source.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..'); // inside the work tree; git resolves the toplevel
const QUEUE = join(HERE, '..', 'data', 'queue');

const git = (args: string[]) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' }).trim();
const sha = git(['rev-parse', 'HEAD']);
const subject = git(['log', '-1', '--format=%s']);
const epoch = parseInt(git(['log', '-1', '--format=%ct']), 10);

const id = sourceSelfReview({ queueDir: QUEUE, head: { sha, subject, epoch } });
console.log(id ? `Enqueued self-review: ${id}` : `HEAD (${sha.slice(0, 12)}) already reviewed — no-op`);
