import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, ballotHash, signVote } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { buildFeed, renderFeedMarkdown } from '../src/feed.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function tmpLog(): string {
  return join(mkdtempSync(join(tmpdir(), 'qrm-feed-')), 'votes.log');
}
function cast(log: string, id: 'V1' | 'V2' | 'V3', bh: string, verdict: string) {
  appendVote(log, signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: bh, verdict, rawOutput: `${id}:${verdict}` }));
}

test('buildFeed groups votes into convenings and recomputes the ratified outcome', () => {
  const log = tmpLog();
  const bh1 = ballotHash('q1', 'c'), bh2 = ballotHash('q2', 'c');
  cast(log, 'V1', bh1, 'SOUND'); cast(log, 'V2', bh1, 'SOUND'); cast(log, 'V3', bh1, 'REVISE');
  cast(log, 'V1', bh2, 'NO'); cast(log, 'V2', bh2, 'NO'); cast(log, 'V3', bh2, 'NO');

  const feed = buildFeed(log, keyring, 2);
  assert.equal(feed.chainValid, true);
  assert.equal(feed.entryCount, 6);
  assert.equal(feed.convenings.length, 2);

  const c1 = feed.convenings.find((c) => c.ballotHash === bh1)!;
  assert.equal(c1.ratified, true);
  assert.equal(c1.verdict, 'SOUND');
  assert.equal(c1.tally.SOUND, 2);
  assert.deepEqual(
    c1.votes.map((v) => [v.validatorId, v.verdict]).sort(),
    [['V1', 'SOUND'], ['V2', 'SOUND'], ['V3', 'REVISE']],
  );
});

test('buildFeed reports chainValid:false when the log is tampered', () => {
  const log = tmpLog();
  const bh = ballotHash('q', 'c');
  cast(log, 'V1', bh, 'SOUND'); cast(log, 'V2', bh, 'SOUND');
  appendFileSync(log, JSON.stringify({ vote: { validatorId: 'V3', ballotHash: bh, verdict: 'SOUND' }, prevHash: 'bogus', entryHash: 'bogus' }) + '\n');
  assert.equal(buildFeed(log, keyring, 2).chainValid, false);
});

test('renderFeedMarkdown surfaces each convening verdict and the chain-validity proof', () => {
  const log = tmpLog();
  const bh = ballotHash('q', 'c');
  cast(log, 'V1', bh, 'SOUND'); cast(log, 'V2', bh, 'SOUND'); cast(log, 'V3', bh, 'SOUND');
  const md = renderFeedMarkdown(buildFeed(log, keyring, 2));
  assert.match(md, /chain valid/i);
  assert.match(md, /SOUND/);
  assert.match(md, new RegExp(bh.slice(0, 12)));
});
