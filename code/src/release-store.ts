// Quorumchain ($QRM) — immutable release store with an atomic `current` pointer (spec NI-D6).
// A published snapshot lands in releases/<headHash>/, is verified there, then `current`
// (a small pointer file) is repointed by write-temp + rename (atomic on one filesystem).
// Reads always resolve through `current`, so a crash mid-publish leaves the prior release
// serving and readers never observe a half-written chain. Zero dependencies.

import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export interface Snapshot { votesLog: string; ballots: string; commons?: Record<string, string> }
export interface VerifyResult { chainId: string; valid: boolean; length: number; headHash: string; verifiedAt: string }
export interface Checkpoint { chainId: string; length: number; headHash: string; publishedAt: string }
export interface ReleaseRef { headHash: string; dir: string }

const RELEASES = (data: string) => join(data, 'releases');
const POINTER = (data: string) => join(data, 'current');

// A safe commons filename is a single path segment: no separators, no traversal,
// conservative allowlist. Matches the only names the read path ever serves.
export function isSafeCommonsName(name: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(name) && name !== '.' && name !== '..';
}

export function stageRelease(data: string, headHash: string, snap: Snapshot): string {
  const dir = join(RELEASES(data), headHash);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'votes.log'), snap.votesLog);
  writeFileSync(join(dir, 'ballots.jsonl'), snap.ballots);
  mkdirSync(join(dir, 'commons'), { recursive: true });
  for (const [name, content] of Object.entries(snap.commons ?? {})) {
    if (!isSafeCommonsName(name)) throw new Error(`unsafe commons filename: ${name}`);
    writeFileSync(join(dir, 'commons', name), content);
  }
  return dir;
}

export function commitRelease(data: string, headHash: string, verify: VerifyResult): void {
  writeFileSync(join(RELEASES(data), headHash, 'verify.json'), JSON.stringify(verify));
  const tmp = POINTER(data) + '.tmp';
  writeFileSync(tmp, headHash);
  renameSync(tmp, POINTER(data));
}

export function currentRelease(data: string): ReleaseRef | null {
  if (!existsSync(POINTER(data))) return null;
  const headHash = readFileSync(POINTER(data), 'utf8').trim();
  return { headHash, dir: join(RELEASES(data), headHash) };
}

export function readReleaseFile(data: string, ref: ReleaseRef, name: string): string | null {
  const p = join(ref.dir, name);
  return existsSync(p) ? readFileSync(p, 'utf8') : null;
}

export function readVerify(data: string, ref: ReleaseRef): VerifyResult | null {
  const raw = readReleaseFile(data, ref, 'verify.json');
  return raw ? (JSON.parse(raw) as VerifyResult) : null;
}

export function writeCheckpoint(data: string, cp: Checkpoint): void {
  const tmp = join(data, 'checkpoint.json.tmp');
  writeFileSync(tmp, JSON.stringify(cp));
  renameSync(tmp, join(data, 'checkpoint.json'));
}

export function readCheckpoint(data: string): Checkpoint | null {
  const p = join(data, 'checkpoint.json');
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as Checkpoint) : null;
}
