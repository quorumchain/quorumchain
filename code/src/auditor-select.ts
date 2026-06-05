// Quorumchain ($QRM) — CIP-10 §3 construction (A): ungrindable, replay-verifiable auditor
// selection. Seed = H(ballotHash ‖ σ_sortedPanel); auditor = sortedPanel[seed mod panelSize].
// The proposer cannot grind ballot text to steer it (cannot forge the post-vote signatures);
// deterministic Ed25519 stops a validator re-rolling its own. Pure. Zero dependencies.

import { createHash } from 'node:crypto';

/** `signatures`: validatorId -> hex Ed25519 signature over the frozen ballot (from the log).
 *  Panel order is canonical (validatorIds sorted), so caller key order is irrelevant. */
export function selectAuditor(ballotHash: string, signatures: Record<string, string>): string {
  const panel = Object.keys(signatures).sort();
  if (panel.length === 0) throw new Error('selectAuditor: empty panel');
  const seedInput = ballotHash + panel.map((id) => signatures[id]).join('');
  const hex = createHash('sha256').update(seedInput, 'utf8').digest('hex');
  const index = Number(BigInt('0x' + hex) % BigInt(panel.length));
  return panel[index];
}
