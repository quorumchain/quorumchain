// Quorumchain ($QRM) — CIP-17 verify-anchored CLI. A thin outsider-verifier wrapper: load the
// PUBLIC Layer-A log (votes.log) + the Layer-B anchor chain (anchors.jsonl), run verifyAnchored,
// and print its report honestly (the NI-17c/d boundary; confirmed anchors of record vs degraded/
// Layer-B-only). Offline by default (no RPC); --online builds a READ-ONLY RPC and confirms each
// mainnet-beta witness on-chain. Reading only — NO key, NO send, NO funds (NI-17a/b).
//
//   node src/run-verify-anchored.ts            # offline (default): Layer-A/B internal validity + boundary
//   node src/run-verify-anchored.ts --online   # also confirm mainnet-beta witnesses on-chain (read-only)
//   QRM=dev …                                  # use the dev chain (votes-dev.log / anchors-dev.jsonl)
//   QRM_ANCHOR_CLUSTER=mainnet-beta            # cluster for --online (default mainnet-beta)
//
// Exit code: 0 when verification is ok; non-zero when it reports a tamper/inconsistency
// (NI-17c violation: invalid chain or a committed tip with no Layer-A pre-image).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog } from './vote-log.ts';
import { readAnchors, type SolanaCluster } from './anchor-record.ts';
import { verifyAnchored, type VerifyAnchoredResult } from './verify-anchored.ts';
import type { SolanaRpc } from './solana-anchor.ts';

export interface RunVerifyAnchoredOpts {
  dataDir: string;
  online: boolean;
  cluster?: SolanaCluster; // only used when online; defaults to mainnet-beta
}

export interface RunVerifyAnchoredOutcome {
  report: VerifyAnchoredResult;
  exitCode: number;
}

/** PURE-ish core: load the two chains from dataDir, run verifyAnchored (with a read-only RPC
 *  when online), and map ok -> exit code. Tests drive this directly with the offline path. */
export async function runVerifyAnchored(opts: RunVerifyAnchoredOpts): Promise<RunVerifyAnchoredOutcome> {
  const log = readLog(join(opts.dataDir, 'votes.log'));
  const anchors = readAnchors(join(opts.dataDir, 'anchors.jsonl'));
  let rpc: SolanaRpc | null = null;
  if (opts.online) {
    const { readOnlyRpc } = await import('./solana-anchor.ts');
    rpc = readOnlyRpc(opts.cluster ?? 'mainnet-beta');
  }
  const report = await verifyAnchored(log, anchors, rpc);
  return { report, exitCode: report.ok ? 0 : 1 };
}

/** Render the report for a human: the verdict, the layer validities, anchors-of-record vs
 *  degraded, the NI-17c/d boundary, and the per-anchor reasons/notes. */
export function renderReport(r: VerifyAnchoredResult, online: boolean): string {
  const lines: string[] = [];
  lines.push(`verify-anchored: ${r.ok ? 'OK' : 'FAILED'} (${online ? 'online' : 'offline'})`);
  lines.push(`  Layer-A (vote log) valid:   ${r.layerAValid}`);
  lines.push(`  Layer-B (anchor chain) valid: ${r.layerBValid}`);
  lines.push(`  confirmed anchors of record: ${r.confirmedAnchorCount}` + (online ? '' : '  (offline: external witnesses unconfirmed)'));
  lines.push(`  anchored tip: ${r.anchoredTip ?? '(none)'}`);
  lines.push(`  anchored through Layer-A index: ${r.anchoredThroughIndex ?? '(none)'}`);
  lines.push(`  unanchored suffix length: ${r.unanchoredSuffixLength}`);
  if (r.boundaryNote) lines.push(`  boundary: ${r.boundaryNote}`);
  if (r.reasons.length) {
    lines.push('  notes:');
    for (const reason of r.reasons) lines.push(`    - ${reason}`);
  }
  return lines.join('\n');
}

// ----- CLI shell (not unit-tested; resolves the standard data dir + argv/env) -----
async function main() {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const dev = process.env.QRM === 'dev';
  const dataDir = join(HERE, '..', 'data');
  const online = process.argv.includes('--online');
  const cluster = (process.env.QRM_ANCHOR_CLUSTER as SolanaCluster | undefined) ?? 'mainnet-beta';

  // dev chain uses suffixed filenames; reuse runVerifyAnchored by pointing at the right files.
  const { report, exitCode } = dev
    ? await runDev(dataDir, online, cluster)
    : await runVerifyAnchored({ dataDir, online, cluster });

  console.log(renderReport(report, online));
  process.exit(exitCode);
}

/** Dev-chain variant: votes-dev.log / anchors-dev.jsonl. Kept here (CLI-only) so the core
 *  runVerifyAnchored stays a simple dataDir loader matching the other run-*.ts conventions. */
async function runDev(dataDir: string, online: boolean, cluster: SolanaCluster): Promise<RunVerifyAnchoredOutcome> {
  const log = readLog(join(dataDir, 'votes-dev.log'));
  const anchors = readAnchors(join(dataDir, 'anchors-dev.jsonl'));
  let rpc: SolanaRpc | null = null;
  if (online) {
    const { readOnlyRpc } = await import('./solana-anchor.ts');
    rpc = readOnlyRpc(cluster);
  }
  const report = await verifyAnchored(log, anchors, rpc);
  return { report, exitCode: report.ok ? 0 : 1 };
}

if (process.argv[1] && process.argv[1].endsWith('run-verify-anchored.ts')) main();
