import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screen, jaccard, shingles } from '../src/screening.ts';

const OPTS = { minLen: 3, maxLen: 100, nearDupThreshold: 0.6 };
const empty = { prompts: [] as string[], hashes: [] as string[] };

test('jaccard/shingles: identical text ~1, disjoint text 0', () => {
  assert.equal(jaccard(shingles('the quick brown fox'), shingles('the quick brown fox')), 1);
  assert.equal(jaccard(shingles('alpha beta gamma'), shingles('xxxx yyyy zzzz')), 0);
});

test('well-formedness: empty question and out-of-bounds length are flagged', () => {
  assert.equal(screen({ question: '', context: 'c', ballotHash: 'h' }, empty, OPTS, false).wellFormed, false);
  assert.equal(screen({ question: 'ok question here', context: 'c', ballotHash: 'h' }, empty, OPTS, false).wellFormed, true);
});

test('exact duplicate flagged by ballotHash; near-duplicate flagged by similarity', () => {
  const corpus = { prompts: ['did the agent breach its staked bond on time'], hashes: ['known'] };
  assert.equal(screen({ question: 'q', context: 'c', ballotHash: 'known' }, corpus, OPTS, false).exactDuplicate, true);
  const near = screen({ question: 'did the agent breach its staked bond on time', context: '', ballotHash: 'new' }, corpus, OPTS, false);
  assert.equal(near.exactDuplicate, false);
  assert.equal(near.nearestHash, 'known');
  assert.ok(near.similarity >= OPTS.nearDupThreshold);
});

test('rateFlagged is passed through', () => {
  assert.equal(screen({ question: 'a valid q', context: 'c', ballotHash: 'h' }, empty, OPTS, true).rateFlagged, true);
});
