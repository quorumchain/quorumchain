import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stageRelease, commitRelease, currentRelease, readReleaseFile, readCheckpoint, writeCheckpoint, type Snapshot } from '../src/release-store.ts';

function tmpData() { return mkdtempSync(join(tmpdir(), 'qrm-rel-')); }
const SNAP: Snapshot = { votesLog: 'a\nb\n', ballots: 'x\n', commons: { 'INDEX.md': '# index' } };

test('stage then commit makes the release the atomic current; reads come from it', () => {
  const data = tmpData();
  const dir = stageRelease(data, 'deadbeef', SNAP);
  assert.equal(readFileSync(join(dir, 'votes.log'), 'utf8'), 'a\nb\n');
  assert.equal(currentRelease(data), null);
  commitRelease(data, 'deadbeef', { chainId: 'c', valid: true, length: 2, headHash: 'deadbeef', verifiedAt: 't' });
  assert.equal(currentRelease(data)?.headHash, 'deadbeef');
  assert.equal(readReleaseFile(data, currentRelease(data)!, 'votes.log'), 'a\nb\n');
  assert.equal(readReleaseFile(data, currentRelease(data)!, 'commons/INDEX.md'), '# index');
});

test('checkpoint round-trips and a second commit atomically repoints current', () => {
  const data = tmpData();
  stageRelease(data, 'aa', SNAP); commitRelease(data, 'aa', { chainId: 'c', valid: true, length: 2, headHash: 'aa', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 2, headHash: 'aa', publishedAt: 't1' });
  assert.equal(readCheckpoint(data)?.headHash, 'aa');
  stageRelease(data, 'bb', { ...SNAP, votesLog: 'a\nb\nc\n' }); commitRelease(data, 'bb', { chainId: 'c', valid: true, length: 3, headHash: 'bb', verifiedAt: 't' });
  assert.equal(currentRelease(data)?.headHash, 'bb');
});
