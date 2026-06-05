// Quorumchain ($QRM) — CIP-9 read-surface ballot registry (round-58 planning discovery).
// The signed log stores only ballotHash = sha256(prompt,context), never the prompt, so a
// human-readable statement cannot be recovered from the log. This records {ballotHash, prompt,
// context} and accepts a statement ONLY if it hash-verifies to the ballotHash — the same
// recompute-trust-nothing discipline as the rest of the system, so a forged statement is rejected.
// Zero dependencies.

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { ballotHash } from './signed-vote.ts';
import type { BallotMeta, ContraryDossier } from './commons.ts';

export interface BallotRegistryEntry {
  ballotHash: string;
  prompt: string;
  context: string;
  // CIP-13 / CIP-10: optional DECLARED metadata recorded with the ballot. These are
  // NOT bound by ballotHash (which hashes only prompt+context) — they are advisory at
  // declaration and become authoritative only when panel-ratified (a v0.3 type
  // sub-claim) or anchor-gated (a supersede). The read path projects them; trust still
  // rests on the signed verdicts, never on a registry field.
  meta?: BallotMeta; // epistemicType / supersedes / typesClaimFor / ...
  dossier?: ContraryDossier; // the CIP-10 adversarial-auditor contrary-evidence dossier
}

/** True iff the entry's prompt+context actually hash to its ballotHash. (Only prompt+context
 *  are hash-bound; the optional CIP-13 meta/dossier are declared, not hashed — see the type.) */
export function verifyEntry(entry: BallotRegistryEntry): boolean {
  return ballotHash(entry.prompt, entry.context) === entry.ballotHash;
}

/** CIP-13 production read path: project the registry's declared meta/dossier into the
 *  inputs `buildClaimIndex` consumes, keyed by ballotHash. Pure, deterministic. */
export function deriveCip13Inputs(registry: BallotRegistryEntry[]): {
  ballotMeta: Record<string, BallotMeta>;
  dossiers: Record<string, ContraryDossier>;
} {
  const ballotMeta: Record<string, BallotMeta> = {};
  const dossiers: Record<string, ContraryDossier> = {};
  for (const e of registry) {
    if (e.meta) ballotMeta[e.ballotHash] = e.meta;
    if (e.dossier) dossiers[e.ballotHash] = e.dossier;
  }
  return { ballotMeta, dossiers };
}

/** Read the JSONL registry; a missing file is an empty registry. Malformed lines are skipped. */
export function loadRegistry(path: string): BallotRegistryEntry[] {
  if (!existsSync(path)) return [];
  const out: BallotRegistryEntry[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      out.push(JSON.parse(line) as BallotRegistryEntry);
    } catch {
      continue;
    }
  }
  return out;
}

/** Append one ballot's statement, computing its ballotHash. Idempotent: a ballotHash already
 *  present is not appended again. Optional CIP-13/CIP-10 declared metadata (`meta`, `dossier`)
 *  is recorded alongside when supplied (legacy 3-arg callers are unchanged). */
export function appendBallot(
  path: string,
  prompt: string,
  context: string,
  extra: { meta?: BallotMeta; dossier?: ContraryDossier } = {},
): void {
  const bh = ballotHash(prompt, context);
  if (loadRegistry(path).some((e) => e.ballotHash === bh)) return;
  const entry: BallotRegistryEntry = { ballotHash: bh, prompt, context };
  if (extra.meta) entry.meta = extra.meta;
  if (extra.dossier) entry.dossier = extra.dossier;
  appendFileSync(path, JSON.stringify(entry) + '\n');
}

/** The human-readable statement for a ballotHash — the registered prompt, but ONLY if the entry
 *  hash-verifies. A missing or tampered entry yields null (never a fabricated title). */
export function statementFor(registry: BallotRegistryEntry[], ballotHashHex: string): string | null {
  const entry = registry.find((e) => e.ballotHash === ballotHashHex);
  if (!entry || !verifyEntry(entry)) return null;
  return entry.prompt;
}
