// Quorumchain ($QRM) — CIP-9 read-surface ballot registry (round-58 planning discovery).
// The signed log stores only ballotHash = sha256(prompt,context), never the prompt, so a
// human-readable statement cannot be recovered from the log. This records {ballotHash, prompt,
// context} and accepts a statement ONLY if it hash-verifies to the ballotHash — the same
// recompute-trust-nothing discipline as the rest of the system, so a forged statement is rejected.
// Zero dependencies.

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { ballotHash } from './signed-vote.ts';

export interface BallotRegistryEntry {
  ballotHash: string;
  prompt: string;
  context: string;
}

/** True iff the entry's prompt+context actually hash to its ballotHash. */
export function verifyEntry(entry: BallotRegistryEntry): boolean {
  return ballotHash(entry.prompt, entry.context) === entry.ballotHash;
}

/** Read the JSONL registry; a missing file is an empty registry. Malformed lines are skipped. */
export function loadRegistry(path: string): BallotRegistryEntry[] {
  if (!existsSync(path)) return [];
  const out: BallotRegistryEntry[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as BallotRegistryEntry);
    } catch {
      continue;
    }
  }
  return out;
}

/** Append one ballot's statement, computing its ballotHash. Idempotent: a ballotHash already
 *  present is not appended again. */
export function appendBallot(path: string, prompt: string, context: string): void {
  const bh = ballotHash(prompt, context);
  if (loadRegistry(path).some((e) => e.ballotHash === bh)) return;
  appendFileSync(path, JSON.stringify({ ballotHash: bh, prompt, context }) + '\n');
}

/** The human-readable statement for a ballotHash — the registered prompt, but ONLY if the entry
 *  hash-verifies. A missing or tampered entry yields null (never a fabricated title). */
export function statementFor(registry: BallotRegistryEntry[], ballotHashHex: string): string | null {
  const entry = registry.find((e) => e.ballotHash === ballotHashHex);
  if (!entry || !verifyEntry(entry)) return null;
  return entry.prompt;
}
