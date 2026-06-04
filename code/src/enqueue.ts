// Quorumchain ($QRM) — Phase 1.1 enqueue CLI. Adds one ballot to the daemon's queue.
// This is a manual entrypoint so the daemon is runnable and testable; the AUTONOMOUS
// ballot sources (governance feed, scheduled self-reviews, disputes) are Phase 1.2.
//
//   node src/enqueue.ts "<question>" "<context>" "A,B,C"
//
// The id is a millisecond timestamp prefix so the queue drains oldest-first.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enqueue } from './queue.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const QUEUE = join(HERE, '..', 'data', 'queue');

const [prompt, context = '', verdictsArg] = process.argv.slice(2);
if (!prompt) {
  console.error('usage: node src/enqueue.ts "<question>" "<context>" "[A,B,C]"');
  process.exit(1);
}
const verdicts = verdictsArg ? verdictsArg.split(',').map((s) => s.trim()) : undefined;
const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
const id = `${Date.now()}-${slug}`;

enqueue(QUEUE, id, { prompt, context, verdicts });
console.log('Enqueued:', id);
