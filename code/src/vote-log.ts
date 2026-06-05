// Quorumchain ($QRM) — tamper-evident append-only vote log (CIP-3 §2).
// Each entry is hash-chained to the previous one, so any edit, deletion, or
// reordering breaks verification. This is the interim "immutable transcript"
// substrate (CIP-3 §5) until on-chain hash-pinning lands. Zero dependencies.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { SignedVote } from './signed-vote.ts';

export const GENESIS = '0'.repeat(64);

export interface LogEntry {
  vote: SignedVote;
  prevHash: string;
  entryHash: string;
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function computeEntryHash(prevHash: string, vote: SignedVote): string {
  return sha256hex(prevHash + JSON.stringify(vote));
}

export function readLog(path: string): LogEntry[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  if (!txt) return [];
  return txt.split('\n').map((line) => JSON.parse(line) as LogEntry);
}

export function appendVote(path: string, vote: SignedVote): LogEntry {
  const entries = readLog(path);
  const prevHash = entries.length ? entries[entries.length - 1].entryHash : GENESIS;
  const entry: LogEntry = { vote, prevHash, entryHash: computeEntryHash(prevHash, vote) };
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return entry;
}

export function verifyEntries(entries: LogEntry[]): { valid: boolean; brokenAt?: number } {
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return { valid: false, brokenAt: i };
    if (e.entryHash !== computeEntryHash(e.prevHash, e.vote)) return { valid: false, brokenAt: i };
    prev = e.entryHash;
  }
  return { valid: true };
}

export function verifyLog(path: string): { valid: boolean; brokenAt?: number } {
  return verifyEntries(readLog(path));
}
