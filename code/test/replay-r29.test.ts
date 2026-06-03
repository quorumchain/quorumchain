// CIP-8 G2 — durable round-29 replay binding.
// The committed fixture holds the byte-exact frozen ballot (question + criteria)
// for the live $85M Polymarket MicroStrategy resolution. This guards the CIP-8
// §4 guarantee: recomputing the ballotHash from the frozen criteria reproduces
// the published round-29 ballot hash, so the signed YES 3/3 verdict is provably
// bound to exactly these criteria — not to any later "additional context".
// Self-contained (no live log needed); the full signature re-verification runs
// against data/votes.log in src/notary-demo.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recomputeBallotHash, tamperDelta } from '../src/replay.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(HERE, '..', 'fixtures', 'ballot-r29-mstr.json'), 'utf8'));

test('G2: round-29 frozen criteria reproduce the published ballot hash', () => {
  const recomputed = recomputeBallotHash(manifest.question, manifest.frozenCriteria);
  assert.equal(recomputed, manifest.expectedBallotHash);
});

test('G1: the actual Polymarket "Additional context" post would have changed the hash', () => {
  const postHoc =
    "Additional context: No information from MSTR, on-chain data, or consensus of credible reporting confirmed that MicroStrategy sold Bitcoin within the market's timeframe; confirmation achieved outside of the market's timeframe does not qualify.";
  const d = tamperDelta(manifest.question, manifest.frozenCriteria, postHoc);
  assert.equal(d.originalHash, manifest.expectedBallotHash);
  assert.equal(d.differ, true);
  assert.notEqual(d.tamperedHash, d.originalHash);
});
