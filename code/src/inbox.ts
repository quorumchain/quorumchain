// Quorumchain ($QRM) — append-only submission inbox (spec §9, NI-D9). Each accept/reject/
// convene appends a NEW full record; readers fold to the latest record per id, so history
// is never rewritten (matching the chain's ethos). Capability ids are 128-bit random, never
// content hashes. A byte-budget cap bounds public intake. Zero dependencies.

import { appendFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

export interface Signals {
  wellFormed: boolean; lengthOk: boolean; tokenCount: number;
  exactDuplicate: boolean; nearestHash: string | null; similarity: number; rateFlagged: boolean;
}
export type SubStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CONVENED';
export interface Submission {
  version: 1; id: string; createdAt: string; ballotHash: string;
  raw: { question: string; context: string }; screening: Signals; status: SubStatus;
  decision?: { at: string; reason?: string }; convenedBallotHash?: string;
}

export function newId(): string { return randomBytes(16).toString('hex'); }

function now(): string { return new Date().toISOString(); }
function append(path: string, s: Submission): void { appendFileSync(path, JSON.stringify(s) + '\n'); }

export function readAll(path: string): Submission[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  return txt ? txt.split('\n').map((l) => JSON.parse(l) as Submission) : [];
}

function fold(path: string): Map<string, Submission> {
  const m = new Map<string, Submission>();
  for (const s of readAll(path)) m.set(s.id, s);
  return m;
}

export function submit(
  path: string,
  input: { question: string; context: string; ballotHash: string; screening: Signals },
  maxBytes = Number.MAX_SAFE_INTEGER,
): Submission {
  if (existsSync(path) && statSync(path).size >= maxBytes) throw new Error('inbox byte budget exceeded');
  const s: Submission = {
    version: 1, id: newId(), createdAt: now(), ballotHash: input.ballotHash,
    raw: { question: input.question, context: input.context }, screening: input.screening, status: 'PENDING_REVIEW',
  };
  append(path, s);
  return s;
}

export function getSubmission(path: string, id: string): Submission | null { return fold(path).get(id) ?? null; }
export function listInbox(path: string, status?: SubStatus): Submission[] {
  return [...fold(path).values()].filter((s) => !status || s.status === status);
}

export function decide(path: string, id: string, decision: 'ACCEPT' | 'REJECT', reason?: string): Submission {
  const cur = getSubmission(path, id);
  if (!cur) throw new Error(`no submission ${id}`);
  if (cur.status !== 'PENDING_REVIEW') throw new Error(`cannot decide on ${cur.status}`);
  const next: Submission = { ...cur, status: decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED', decision: { at: now(), reason } };
  append(path, next);
  return next;
}

export function markConvened(path: string, id: string, convenedBallotHash: string): Submission {
  const cur = getSubmission(path, id);
  if (!cur) throw new Error(`no submission ${id}`);
  if (cur.status !== 'ACCEPTED') throw new Error(`cannot convene from ${cur.status}`);
  const next: Submission = { ...cur, status: 'CONVENED', convenedBallotHash };
  append(path, next);
  return next;
}
