// Quorumchain ($QRM) — pure read handlers over the active release (spec §7). Each returns
// {status, body}; the transport layer serializes. All reads resolve INSIDE the release dir;
// :hash params are validated against VALID_HASH before any path use (path-safety, §11).
// Reuses readLog/verifyEntries/loadRegistry/verifyEntry. Zero dependencies.

import { readLog, verifyEntries } from './vote-log.ts';
import { loadRegistry, verifyEntry } from './ballot-registry.ts';
import { readReleaseFile, readVerify, type ReleaseRef } from './release-store.ts';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

export const VALID_HASH = /^[0-9a-f]{64}$/;
export interface HandlerOut { status: number; body: any }

function withFile(content: string | null, name: string): string | null {
  if (content === null) return null;
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-rd-')), name);
  writeFileSync(p, content);
  return p;
}

export function handleVerify(data: string, ref: ReleaseRef): HandlerOut {
  const cached = readVerify(data, ref);
  if (cached) return { status: 200, body: cached };
  const lp = withFile(readReleaseFile(data, ref, 'votes.log'), 'votes.log');
  const entries = lp ? readLog(lp) : [];
  const v = verifyEntries(entries);
  return { status: 200, body: { valid: v.valid, length: entries.length, headHash: ref.headHash } };
}

export function handleHealth(data: string, ref: ReleaseRef | null, mode: 'live' | 'degraded'): HandlerOut {
  if (!ref) return { status: 200, body: { ok: mode === 'live', mode, chainValid: false, length: 0, headHash: null } };
  const v = handleVerify(data, ref).body;
  return { status: 200, body: { ok: mode === 'live' && v.valid, mode, chainValid: v.valid, length: v.length, headHash: ref.headHash } };
}

export function handleLog(data: string, ref: ReleaseRef, from: number, limit: number): HandlerOut {
  const lp = withFile(readReleaseFile(data, ref, 'votes.log'), 'votes.log');
  const entries = lp ? readLog(lp) : [];
  return { status: 200, body: { total: entries.length, from, entries: entries.slice(from, from + limit) } };
}

export function handleBallot(data: string, ref: ReleaseRef, hash: string): HandlerOut {
  if (!VALID_HASH.test(hash)) return { status: 400, body: { error: 'invalid hash' } };
  const rp = withFile(readReleaseFile(data, ref, 'ballots.jsonl'), 'ballots.jsonl');
  const entry = (rp ? loadRegistry(rp) : []).find((e) => e.ballotHash === hash);
  if (!entry) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { entry, verified: verifyEntry(entry) } };
}

export function handleCommons(data: string, ref: ReleaseRef, hash?: string): HandlerOut {
  if (hash !== undefined && !VALID_HASH.test(hash)) return { status: 400, body: { error: 'invalid hash' } };
  const name = hash ? `commons/${hash}.md` : 'commons/INDEX.md';
  const md = readReleaseFile(data, ref, name);
  if (md === null) return { status: 404, body: { error: 'not found' } };
  return { status: 200, body: { markdown: md } };
}
