// Quorumchain ($QRM) — CIP-9 read surface CLI. Recomputes every claim from the live signed log +
// pinned keyring + ballot registry and writes browsable pages to docs/commons/. Pure recompute:
// a prior render is never an input; a tampered log surfaces as a banner, never silent content.
// Mirrors publish-feed.ts. Run: node src/publish-commons.ts

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog, verifyLog } from './vote-log.ts';
import { loadRegistry } from './ballot-registry.ts';
import { buildViews } from './commons-read.ts';
import { renderClaimMarkdown, renderIndexMarkdown } from './commons-render.ts';
import { computeAuditScope, renderScopeRecord, type ScopeClaim } from './audit-scope.ts';
import { anchorTipAtPublish, rpcFromEnv } from './anchor-publish.ts';
import { reportPublishSync } from './publish-sync-report.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const LOG = join(DATA, 'votes.log');
const ANCHORS = join(DATA, 'anchors.jsonl');
const REGISTRY = join(DATA, 'ballots.jsonl');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const OUT = join(HERE, '..', '..', 'docs', 'commons');
const QUORUM = 2;

const keyring = JSON.parse(readFileSync(PINNED, 'utf8')) as Record<string, string>;
const votes = readLog(LOG).map((e) => e.vote);
const chainValid = verifyLog(LOG).valid;
const registry = loadRegistry(REGISTRY);

const views = buildViews(votes, keyring, QUORUM, registry, chainValid);
mkdirSync(OUT, { recursive: true });
for (const v of views) {
  writeFileSync(join(OUT, `${v.ballotHash.slice(0, 12)}.md`), renderClaimMarkdown(v));
}
writeFileSync(join(OUT, 'INDEX.md'), renderIndexMarkdown(views));

const scopeClaims: ScopeClaim[] = views.map((v) => ({
  ballotHash: v.ballotHash, epistemicType: v.epistemicType,
  unanimousSubstantive: v.status === 'RESOLVED' && v.stances.length === 1,
}));
const anchoredContraryRefs = new Set<string>(); // registry-derived; empty until anchored supersedes exist
const scope = computeAuditScope(scopeClaims, anchoredContraryRefs);
writeFileSync(join(OUT, 'AUDIT-SCOPE.md'), renderScopeRecord(scope));

const withStatement = views.filter((v) => v.statement !== null).length;
console.log(`Wrote ${views.length} claim pages + INDEX.md to docs/commons/ (chain valid: ${chainValid}; ${withStatement} with recorded statements)`);

// CIP-17: always write the Layer-B tip commitment; submit to Solana when configured.
// Anchoring NEVER blocks publishing — on outage it degrades to Layer-B-only (NI-17a).
const anchor = await anchorTipAtPublish({ logPath: LOG, anchorPath: ANCHORS, rpc: await rpcFromEnv(), now: Date.now() });
if (anchor.skipped) console.log(`Anchor: skipped (${anchor.note})`);
else console.log(`Anchor: seq ${anchor.anchorSeq} for tip ${anchor.tipHash?.slice(0, 12)} — ${anchor.degraded ? `DEGRADED to Layer-B-only (${anchor.note})` : `witnessed on Solana (${anchor.signature})`}`);

// Publish-time sync guard: head==anchor + committed votes.log matches the chain (catches a
// forgotten `git add -f code/data/votes.log`). Warns only — never blocks publishing.
reportPublishSync(LOG, ANCHORS);
