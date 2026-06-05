// Quorumchain ($QRM) — boot verification (spec NI-D7). On start, verify the active release's
// chain and that the checkpoint's chainId matches this node's pinned chainId (wrong-chain
// volume detection). On any failure → degraded mode (writes refused). Zero dependencies.

import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readLog, verifyEntries } from './vote-log.ts';
import { verifyVote, type SignedVote } from './signed-vote.ts';
import { currentRelease, readCheckpoint, readReleaseFile } from './release-store.ts';

export interface BootState { mode: 'live' | 'degraded'; chainValid: boolean; reason?: string }

export function bootVerify(data: string, expectedChainId: string, keyring: Record<string, string>): BootState {
  const cp = readCheckpoint(data);
  if (cp && cp.chainId !== expectedChainId) return { mode: 'degraded', chainValid: false, reason: 'checkpoint chainId mismatch' };
  const ref = currentRelease(data);
  if (!ref) {
    if (cp) return { mode: 'degraded', chainValid: false, reason: 'checkpoint present but no current release (rollback)' };
    return { mode: 'live', chainValid: false };
  }
  const content = readReleaseFile(data, ref, 'votes.log');
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-bv-')), 'votes.log');
  writeFileSync(p, content ?? '');
  const entries = readLog(p);
  const v = verifyEntries(entries);
  if (!v.valid) return { mode: 'degraded', chainValid: false, reason: `chain broken at ${v.brokenAt}` };
  // NI-D7/NI-D1 — every vote must be signed by a PINNED validator (mirrors publish-verify D1).
  for (const e of entries) {
    const vote: SignedVote = e.vote;
    const pk = keyring[vote.validatorId];
    if (!pk) return { mode: 'degraded', chainValid: false, reason: `unpinned validator ${vote.validatorId}` };
    if (!verifyVote(vote, pk)) return { mode: 'degraded', chainValid: false, reason: `invalid signature for ${vote.validatorId}` };
  }
  // NI-D7 — recompute the actual head/length on disk and compare to the durable checkpoint.
  const actualHead = entries.length ? entries[entries.length - 1].entryHash : '0'.repeat(64);
  if (cp) {
    if (entries.length !== cp.length) return { mode: 'degraded', chainValid: false, reason: 'current length != checkpoint length' };
    if (actualHead !== cp.headHash) return { mode: 'degraded', chainValid: false, reason: 'current head != checkpoint head' };
  }
  return { mode: 'live', chainValid: true };
}
