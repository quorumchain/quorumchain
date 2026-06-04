// Quorumchain ($QRM) — tamper-evident append-only STATE log (round-44 backlog #6,
// local interim). The new modules (bonds, node registry, reputation, lifecycle)
// hold their state in memory; CIP-3/CIP-4 call for it to live on the tamper-evident
// ledger. Full on-chain anchoring needs the substrate, but the INTERIM mechanism is
// the same one votes already use: append every state transition into a SHA-256 hash
// chain so the history is replayable and any edit, deletion, or reorder breaks
// verification. This is to module state what vote-log is to votes. Zero dependencies.
//
// Scope: this gives tamper-EVIDENCE (you cannot rewrite history undetected). WHO
// authorized each transition (a signature/quorum on the event) layers on top later,
// alongside on-chain anchoring; it is deliberately not faked here.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const GENESIS = '0'.repeat(64);

export interface StateEvent {
  module: string; // which module produced it: 'bond' | 'registry' | 'reputation' | 'lifecycle' | ...
  type: string; // transition kind: 'CREATE' | 'SETTLE' | 'ADMIT' | 'ROTATE' | 'EVICT' | ...
  ref: string; // a stable key for the subject (bond ballotHash, validator id, claim id, ...)
  payload: Record<string, unknown>; // the transition's data
  timestamp: string;
  prevHash: string;
  entryHash: string;
}

function sha256hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

// The chained content is everything except the entry hash itself.
function computeEntryHash(prevHash: string, e: Omit<StateEvent, 'entryHash'>): string {
  return sha256hex(prevHash + JSON.stringify({ module: e.module, type: e.type, ref: e.ref, payload: e.payload, timestamp: e.timestamp }));
}

export function readStateLog(path: string): StateEvent[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  if (!txt) return [];
  return txt.split('\n').map((line) => JSON.parse(line) as StateEvent);
}

export function appendState(path: string, event: Omit<StateEvent, 'prevHash' | 'entryHash'>): StateEvent {
  const entries = readStateLog(path);
  const prevHash = entries.length ? entries[entries.length - 1].entryHash : GENESIS;
  const withPrev = { ...event, prevHash };
  const entry: StateEvent = { ...withPrev, entryHash: computeEntryHash(prevHash, withPrev) };
  appendFileSync(path, JSON.stringify(entry) + '\n');
  return entry;
}

export function verifyStateLog(path: string): { valid: boolean; brokenAt?: number } {
  const entries = readStateLog(path);
  let prev = GENESIS;
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    if (e.prevHash !== prev) return { valid: false, brokenAt: i };
    if (e.entryHash !== computeEntryHash(e.prevHash, e)) return { valid: false, brokenAt: i };
    prev = e.entryHash;
  }
  return { valid: true };
}
