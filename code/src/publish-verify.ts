// Quorumchain ($QRM) — the publish gate (spec NI-D1..D5). A snapshot is accepted ONLY if:
//  D1 every vote is signed by a PINNED validator (unknown validatorId ⇒ reject);
//  D3 the GENESIS→entryHash chain links are intact (verifyEntries);
//  D4 it is a forward-extension of `current` (existing prefix byte-identical by entryHash);
//  D5 it does not roll back below the durable checkpoint.
// Pure: no filesystem, no network. Zero dependencies beyond the CIP-3 primitives.

import { verifyVote, type SignedVote } from './signed-vote.ts';
import { verifyEntries, type LogEntry } from './vote-log.ts';
import type { Checkpoint } from './release-store.ts';

export interface PublishInput {
  staged: LogEntry[]; current: LogEntry[]; checkpoint: Checkpoint | null;
  keyring: Record<string, string>; chainId: string; quorum: number;
}
export interface PublishResult { ok: boolean; headHash: string; length: number; reason?: string }

const head = (entries: LogEntry[]): string => (entries.length ? entries[entries.length - 1].entryHash : '0'.repeat(64));

export function verifyPublish(input: PublishInput): PublishResult {
  const { staged, current, checkpoint, keyring } = input;
  const result = (ok: boolean, reason?: string): PublishResult => ({ ok, headHash: head(staged), length: staged.length, reason });

  // D3 — chain integrity
  const chain = verifyEntries(staged);
  if (!chain.valid) return result(false, `chain broken at index ${chain.brokenAt}`);

  // D1 — every vote signed by a pinned validator
  for (const e of staged) {
    const v: SignedVote = e.vote;
    const pk = keyring[v.validatorId];
    if (!pk) return result(false, `unpinned validator ${v.validatorId}`);
    if (!verifyVote(v, pk)) return result(false, `invalid signature for ${v.validatorId}`);
  }

  // D4 — forward-extension of current (prefix identical, length non-decreasing)
  if (staged.length < current.length) return result(false, 'shorter than current (rewrite/rollback)');
  for (let i = 0; i < current.length; i++) {
    if (staged[i].entryHash !== current[i].entryHash) return result(false, `prefix diverges at index ${i} (history rewrite)`);
  }

  // D5 — checkpoint monotonicity (survives volume restore)
  if (checkpoint) {
    if (staged.length < checkpoint.length) return result(false, 'shorter than checkpoint (rollback)');
    if (checkpoint.length > 0 && staged[checkpoint.length - 1]?.entryHash !== checkpoint.headHash) {
      return result(false, 'checkpoint head not present at its index (rollback/fork)');
    }
  }

  // chainId/quorum are accepted for caller ergonomics but NOT re-checked here, by design:
  //  - chainId: a snapshot carries no validator keys to recompute it from; chain IDENTITY is
  //    enforced at BOOT (boot.ts compares the persisted checkpoint.chainId to the pinned chainId),
  //    and NI-D1 (pinned-key signatures) already makes validator-set substitution impossible.
  //  - quorum: this gate verifies signatures + chain links + extension, NOT per-ballot 2/3. The
  //    real log legitimately contains failed convenings (sub-quorum ballots), so an all-ratified
  //    gate would reject the genuine chain; ratification stays recomputable by any consumer from
  //    the served votes (ratify() in signed-vote.ts), per "recompute, trust nothing".
  void input.chainId;
  void input.quorum;
  return result(true);
}
