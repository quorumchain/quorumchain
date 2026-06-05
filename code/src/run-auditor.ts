// Quorumchain ($QRM) — CIP-10 auditor runner. Retrospective (construction A): for every in-scope
// claim, select the auditor from the post-vote signature bundle, invoke that validator under the
// method-not-conclusion audit prompt, validate + sign the dossier, attach it to the registry.
//   QRM=dev? node src/run-auditor.ts
// Pure planning (planAudit) is unit-tested; the live host I/O is exercised manually.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SignedVote } from './signed-vote.ts';
import { readLog } from './vote-log.ts';
import { loadRegistry, attachDossier, type BallotRegistryEntry } from './ballot-registry.ts';
import { computeAuditScope, type ScopeClaim } from './audit-scope.ts';
import { selectAuditor } from './auditor-select.ts';
import { buildAuditPrompt, parseAuditorOutput } from './auditor.ts';
import { validateDossier } from './dossier-validate.ts';
import { makeRemoteSigner } from './signer.ts';
import { loadPinnedKeyring } from './keystore.ts';

export interface AuditPlanItem {
  ballotHash: string;
  auditorId: string;
  rule: 1 | 2;
  prompt: string;
  context: string;
  ratifiedVerdict: string;
}

/** PURE: from the signed votes + registry, compute scope and the deterministic auditor per ballot. */
export function planAudit(votes: SignedVote[], registry: BallotRegistryEntry[]): AuditPlanItem[] {
  const byBallot = new Map<string, SignedVote[]>();
  for (const v of votes) {
    const arr = byBallot.get(v.ballotHash) ?? [];
    arr.push(v);
    byBallot.set(v.ballotHash, arr);
  }
  // anchored contrary refs: any ballot whose meta.supersedes points at X and carries meta.anchors
  const anchoredContraryRefs = new Set<string>();
  for (const e of registry) {
    if (e.meta?.supersedes && e.meta.anchors && e.meta.anchors.length > 0) {
      anchoredContraryRefs.add(e.meta.supersedes);
    }
  }

  const metaByBallot = new Map(registry.map((e) => [e.ballotHash, e]));
  const scopeClaims: ScopeClaim[] = [];
  for (const [bh, vs] of byBallot) {
    const verdicts = new Set(vs.map((v) => v.verdict));
    const only = [...verdicts][0];
    const unanimousSubstantive = verdicts.size === 1 && !/^(ABSTAIN|NO_VERDICT)$/i.test(only);
    scopeClaims.push({
      ballotHash: bh,
      epistemicType: metaByBallot.get(bh)?.meta?.epistemicType ?? null,
      unanimousSubstantive,
    });
  }
  const scope = computeAuditScope(scopeClaims, anchoredContraryRefs);

  const plan: AuditPlanItem[] = [];
  for (const s of scope.inScope) {
    const vs = byBallot.get(s.ballotHash) ?? [];
    const signatures = Object.fromEntries(vs.map((v) => [v.validatorId, v.signature]));
    const auditorId = selectAuditor(s.ballotHash, signatures);
    const reg = metaByBallot.get(s.ballotHash);
    plan.push({
      ballotHash: s.ballotHash,
      auditorId,
      rule: s.rule,
      prompt: reg?.prompt ?? '',
      context: reg?.context ?? '',
      ratifiedVerdict: vs[0]?.verdict ?? '',
    });
  }
  return plan;
}

// ----- CLI shell (not unit-tested; live hosts) -----
async function main() {
  const HERE = dirname(fileURLToPath(import.meta.url));
  const DATA = join(HERE, '..', 'data');
  const dev = process.env.QRM === 'dev';
  const LOG = join(DATA, dev ? 'votes-dev.log' : 'votes.log');
  const REG = join(DATA, dev ? 'ballots-dev.jsonl' : 'ballots.jsonl');
  const KEYSTORE = join(DATA, 'keystore');
  const PINNED = join(HERE, '..', 'pinned-keyring.json');
  const DELIB_HOST = join(HERE, 'deliberating-signer-host.ts');

  loadPinnedKeyring(PINNED); // verify it exists; result used only for key-pin checks in run-panel

  const votes = readLog(LOG).map((e) => e.vote);
  const registry = loadRegistry(REG);
  const plan = planAudit(votes, registry);
  console.error(`[run-auditor] ${plan.length} in-scope claim(s)`);

  for (const item of plan) {
    const signer = await makeRemoteSigner({
      validatorId: item.auditorId,
      hostPath: DELIB_HOST,
      timeoutMs: 600_000,
      env: { QRM_KEYSTORE_DIR: KEYSTORE },
    });
    try {
      const raw = await signer.audit(buildAuditPrompt(item.prompt, item.context, item.ratifiedVerdict));
      const unsigned = parseAuditorOutput(raw, item.ballotHash, item.auditorId);
      const validity = validateDossier(unsigned, { eligible: true });
      if (!validity.valid) {
        console.error(`[run-auditor] ${item.ballotHash.slice(0, 12)} invalid dossier: ${validity.reason}`);
        continue;
      }
      const signed = await signer.signDossier(unsigned);
      attachDossier(REG, item.ballotHash, signed);
      console.error(`[run-auditor] ${item.ballotHash.slice(0, 12)} auditor=${item.auditorId} weight=${signed.assessedWeight} attached`);
    } finally {
      signer.close();
    }
  }
}
if (process.argv[1] && process.argv[1].endsWith('run-auditor.ts')) main();
