// Quorumchain ($QRM) — publish-time sync guard. The committed (version-controlled) votes.log
// stays in step with the live chain ONLY because the operator remembers to `git add -f
// code/data/votes.log` (data/ is gitignored). A forgotten add silently ships docs/anchors that
// commit to a tip the committed log does not contain. This is a PURE check (no FS, no git): the
// CLI gathers the inputs and passes them in. It reports drift; it never blocks publishing.
//
// Two properties:
//  - head == anchor: the working log's tip equals the latest Layer-B anchor's committed tipHash.
//  - committed == working: the git-HEAD blob of votes.log byte-matches the working votes.log,
//    i.e. there is no pending/forgotten `git add -f`.

import { verifyEntries, type LogEntry } from './vote-log.ts';
import type { AnchorEntry } from './anchor-record.ts';

export interface PublishSyncInput {
  /** The live working votes.log, parsed (what publishing/anchoring just read). */
  workingEntries: LogEntry[];
  /** The Layer-B anchor chain (anchors.jsonl), parsed. */
  anchors: AnchorEntry[];
  /** Raw bytes of the working votes.log as it is on disk now. */
  workingLogText: string;
  /** Raw bytes of votes.log as committed at git HEAD, or null if it is not tracked there. */
  committedLogText: string | null;
}

export interface PublishSyncResult {
  ok: boolean; // true iff there is no drift to warn about
  headHash: string; // working chain tip ('0'*64 for an empty chain)
  anchorTipHash: string | null; // latest anchor's committed tip, or null if no anchors
  /** head != anchor tip: the latest anchor does not commit to the current chain head. */
  headAnchorMismatch: boolean;
  /** committed votes.log differs from working (a forgotten `git add -f`), or is untracked. */
  committedDrift: boolean;
  warnings: string[]; // human-readable lines for the CLI to print
}

const GENESIS = '0'.repeat(64);
const headOf = (entries: LogEntry[]): string => (entries.length ? entries[entries.length - 1].entryHash : GENESIS);

export function checkPublishSync(input: PublishSyncInput): PublishSyncResult {
  const { workingEntries, anchors, workingLogText, committedLogText } = input;
  const headHash = headOf(workingEntries);
  const lastAnchor = anchors.length ? anchors[anchors.length - 1] : null;
  const anchorTipHash = lastAnchor ? lastAnchor.record.tipHash : null;
  const warnings: string[] = [];

  // head == anchor. An empty chain (nothing to anchor) is not drift. With a non-empty chain,
  // the latest anchor must commit to the current head.
  let headAnchorMismatch = false;
  if (workingEntries.length > 0) {
    if (anchorTipHash === null) {
      headAnchorMismatch = true;
      warnings.push(`head!=anchor: chain head ${headHash.slice(0, 12)} has no Layer-B anchor yet (re-run anchoring before pushing)`);
    } else if (anchorTipHash !== headHash) {
      headAnchorMismatch = true;
      warnings.push(`head!=anchor: chain head ${headHash.slice(0, 12)} but latest anchor commits ${anchorTipHash.slice(0, 12)} (anchor is stale)`);
    }
  }

  // committed == working. A mismatch means a pending `git add -f code/data/votes.log`.
  let committedDrift = false;
  if (committedLogText === null) {
    committedDrift = true;
    warnings.push('committed-drift: code/data/votes.log is not tracked at git HEAD — force-add it so the published log carries the chain');
  } else if (committedLogText !== workingLogText) {
    committedDrift = true;
    warnings.push('committed-drift: committed code/data/votes.log differs from the working log — `git add -f code/data/votes.log` before committing');
  }

  // A guard is only meaningful on an intact chain; flag a broken working log loudly too.
  if (workingEntries.length > 0 && !verifyEntries(workingEntries).valid) {
    warnings.push('chain-broken: working votes.log does not verify — do NOT publish/push');
  }

  return { ok: warnings.length === 0, headHash, anchorTipHash, headAnchorMismatch, committedDrift, warnings };
}
