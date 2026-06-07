// Quorumchain ($QRM) — Phase 1.4 CLI. Render the live vote log into the public,
// committable convening feed: docs/FEED.md (human) + docs/feed.json (machine). Run after
// a convening (or on a cadence) to refresh the feed. The feed is a recomputed projection
// (chain validity + 2/3 tally re-derived from the signed votes and the pinned public
// keyring), so it adds no trust. Full independent re-verification additionally needs the
// signed log itself, which is published deliberately (`git add -f code/data/votes.log`).
//
//   node src/publish-feed.ts

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPinnedKeyring } from './keystore.ts';
import { buildFeed, renderFeedMarkdown } from './feed.ts';
import { anchorTipAtPublish, rpcFromEnv } from './anchor-publish.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const LOG = join(HERE, '..', 'data', 'votes.log');
const ANCHORS = join(HERE, '..', 'data', 'anchors.jsonl');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const OUT_DIR = join(HERE, '..', '..', 'docs');

const keyring = loadPinnedKeyring(PINNED);
const feed = buildFeed(LOG, keyring, 2);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, 'feed.json'), JSON.stringify(feed, null, 2) + '\n');
writeFileSync(join(OUT_DIR, 'FEED.md'), renderFeedMarkdown(feed));

console.log(`Published feed: ${feed.convenings.length} convenings, ${feed.entryCount} votes, chain ${feed.chainValid ? 'valid' : 'BROKEN'} → docs/FEED.md, docs/feed.json`);

// CIP-17: always write the Layer-B tip commitment; submit to Solana when configured.
// Anchoring NEVER blocks publishing — on outage it degrades to Layer-B-only (NI-17a).
const anchor = await anchorTipAtPublish({ logPath: LOG, anchorPath: ANCHORS, rpc: await rpcFromEnv(), now: Date.now() });
if (anchor.skipped) console.log(`Anchor: skipped (${anchor.note})`);
else console.log(`Anchor: seq ${anchor.anchorSeq} for tip ${anchor.tipHash?.slice(0, 12)} — ${anchor.degraded ? `DEGRADED to Layer-B-only (${anchor.note})` : `witnessed on Solana (${anchor.signature})`}`);
