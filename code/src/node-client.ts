// Quorumchain ($QRM) — operator-side helpers for the node CLIs. Uses global fetch (Node 22).
// renderSubmission ALWAYS neutralizes submission text (treated as hostile input, §11).
// packageSnapshot bundles the local authoritative chain for /admin/publish. Zero deps.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Snapshot } from './release-store.ts';

export function inert(s: string): string {
  return s
    .replace(/[\x00-\x1f]/g, ' ') // control chars (newlines/tabs/escapes) → space; no terminal injection
    .replace(/[<>`]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '`': "'" }[c]!)) // neutralize markup/backticks
    .slice(0, 4000);
}

export function renderSubmission(s: { id: string; status: string; ballotHash: string; raw: { question: string; context: string }; screening: any }): string {
  const f = s.screening;
  return [
    `[${s.status}] ${s.id}  (ballot ${s.ballotHash.slice(0, 12)})`,
    `  Q: ${inert(s.raw.question)}`,
    `  C: ${inert(s.raw.context)}`,
    `  signals: wellFormed=${f.wellFormed} exactDup=${f.exactDuplicate} nearDup=${f.similarity.toFixed(2)}${f.nearestHash ? `→${f.nearestHash.slice(0, 8)}` : ''} rate=${f.rateFlagged}`,
  ].join('\n');
}

export function packageSnapshot(localDataDir: string): Snapshot {
  const v = join(localDataDir, 'votes.log');
  const b = join(localDataDir, 'ballots.jsonl');
  const commonsDir = join(localDataDir, '..', 'docs', 'commons');
  const commons: Record<string, string> = {};
  if (existsSync(join(commonsDir, 'INDEX.md'))) {
    for (const f of readdirSync(commonsDir)) if (f.endsWith('.md')) commons[f] = readFileSync(join(commonsDir, f), 'utf8');
  }
  return {
    votesLog: existsSync(v) ? readFileSync(v, 'utf8') : '',
    ballots: existsSync(b) ? readFileSync(b, 'utf8') : '',
    commons,
  };
}

export async function api(base: string, path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    method: opts.method ?? 'GET',
    headers: { ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
