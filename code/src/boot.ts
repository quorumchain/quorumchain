// Quorumchain ($QRM) — boot verification (spec NI-D7). On start, verify the active release's
// chain and that the checkpoint's chainId matches this node's pinned chainId (wrong-chain
// volume detection). On any failure → degraded mode (writes refused). Zero dependencies.

import { join } from 'node:path';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { readLog, verifyEntries } from './vote-log.ts';
import { currentRelease, readCheckpoint, readReleaseFile } from './release-store.ts';

export interface BootState { mode: 'live' | 'degraded'; chainValid: boolean; reason?: string }

export function bootVerify(data: string, expectedChainId: string): BootState {
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
  const v = verifyEntries(readLog(p));
  if (!v.valid) return { mode: 'degraded', chainValid: false, reason: `chain broken at ${v.brokenAt}` };
  if (cp && ref.headHash !== cp.headHash) return { mode: 'degraded', chainValid: false, reason: 'current head != checkpoint head' };
  return { mode: 'live', chainValid: true };
}
