// Quorumchain ($QRM) — Phase 1.1 ballot queue. A file-backed state machine the
// convening daemon drains. A ballot is a JSON file that moves between directories:
//
//   queue/pending/<id>.json  -> queue/done/<id>.json    (convened; result attached)
//                            -> queue/failed/<id>.json   (could not run after N tries)
//
// State is the filesystem itself: durable across restarts, inspectable by eye, and
// crash-safe (a move is atomic; a half-written enqueue stays in pending and is retried).
// Ordering is lexical by id, so the daemon processes oldest-first when ids are sortable.
// This module owns ONLY the queue mechanics; what PUTS ballots here is Phase 1.2.

import { writeFileSync, readFileSync, readdirSync, unlinkSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface Ballot {
  prompt: string;
  context?: string;
  verdicts?: string[];
}

export interface QueuedBallot {
  id: string;
  ballot: Ballot;
  attempts: number;
}

const PENDING = 'pending';
const DONE = 'done';
const FAILED = 'failed';

function dir(queueDir: string, sub: string): string {
  const d = join(queueDir, sub);
  mkdirSync(d, { recursive: true });
  return d;
}

/** Add a ballot to the queue. `id` is caller-supplied and must be lexically
 *  sortable for oldest-first draining (the CLI uses a timestamp prefix). */
export function enqueue(queueDir: string, id: string, ballot: Ballot): void {
  const entry: QueuedBallot = { id, ballot, attempts: 0 };
  writeFileSync(join(dir(queueDir, PENDING), `${id}.json`), JSON.stringify(entry, null, 2));
}

function terminalIds(queueDir: string): Set<string> {
  const ids = new Set<string>();
  for (const sub of [DONE, FAILED]) {
    const d = join(queueDir, sub);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (f.endsWith('.json')) ids.add(f.slice(0, -'.json'.length));
  }
  return ids;
}

/** All pending ballots, oldest-first (lexical by id). A ballot that already has a
 *  terminal (done/ or failed/) record is EXCLUDED even if a pending file for it still
 *  exists — that is a ballot decided before a crash interrupted cleanup (round-50 V2):
 *  re-listing it would re-convene a decided ballot and launder its verdict. */
export function listPending(queueDir: string): QueuedBallot[] {
  const d = join(queueDir, PENDING);
  if (!existsSync(d)) return [];
  const terminal = terminalIds(queueDir);
  return readdirSync(d)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(d, f), 'utf8')) as QueuedBallot)
    .filter((entry) => !terminal.has(entry.id));
}

/** True if `id` exists in ANY state (pending/done/failed). The dedup primitive the
 *  self-review sourcer uses so a given commit is enqueued at most once — deterministic
 *  selection with no flooding (round-51 binding constraint). */
export function hasBallot(queueDir: string, id: string): boolean {
  return [PENDING, DONE, FAILED].some((sub) => existsSync(join(queueDir, sub, `${id}.json`)));
}

function readPending(queueDir: string, id: string): QueuedBallot {
  return JSON.parse(readFileSync(join(queueDir, PENDING, `${id}.json`), 'utf8')) as QueuedBallot;
}

/** Record one more failed attempt; the ballot stays pending for a later drain. */
export function bumpAttempt(queueDir: string, id: string): void {
  const entry = readPending(queueDir, id);
  entry.attempts += 1;
  writeFileSync(join(queueDir, PENDING, `${id}.json`), JSON.stringify(entry, null, 2));
}

/** Move a convened ballot to done/, attaching its result. Write-then-unlink is not
 *  atomic, but a crash between the two is safe: the done/ record is authoritative and
 *  listPending excludes any id with a terminal record, so a leftover pending file is
 *  never re-convened (round-50 V2 — a decided ballot, including a genuine NO, is final). */
export function complete(queueDir: string, id: string, result: unknown): void {
  const entry = readPending(queueDir, id);
  const out = { ...entry, status: DONE, result };
  writeFileSync(join(dir(queueDir, DONE), `${id}.json`), JSON.stringify(out, null, 2));
  unlinkSync(join(queueDir, PENDING, `${id}.json`));
}

/** Move a ballot that could not be run to failed/, with a reason. */
export function fail(queueDir: string, id: string, reason: string): void {
  const entry = readPending(queueDir, id);
  const out = { ...entry, status: FAILED, reason };
  writeFileSync(join(dir(queueDir, FAILED), `${id}.json`), JSON.stringify(out, null, 2));
  unlinkSync(join(queueDir, PENDING, `${id}.json`));
}
