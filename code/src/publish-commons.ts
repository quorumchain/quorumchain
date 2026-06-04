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

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const LOG = join(DATA, 'votes.log');
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

const withStatement = views.filter((v) => v.statement !== null).length;
console.log(`Wrote ${views.length} claim pages + INDEX.md to docs/commons/ (chain valid: ${chainValid}; ${withStatement} with recorded statements)`);
