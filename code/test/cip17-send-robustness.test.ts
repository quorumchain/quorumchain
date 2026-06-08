// Quorumchain ($QRM) — CIP-17 Inc 2: send-path robustness (custom RPC URL override + bounded
// retry/backoff). Both are tested at the seam with NO network: withRetry drives a mock fn, and
// the URL override is asserted on clusterEndpoint/resolveRpcUrl (string-level, no Connection).
// These guard NI-17a degrade-open (retry exhaustion propagates so anchor-publish can catch it)
// and NI-17b (a URL override never changes cluster identity / anchor-of-record status).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clusterEndpoint,
  resolveRpcUrl,
  isAnchorOfRecord,
  withRetry,
} from '../src/solana-anchor.ts';

// --- withRetry (pure, injectable sleep so the suite never really waits) ---

test('withRetry succeeds after K transient failures (no real sleep)', async () => {
  let calls = 0;
  const slept: number[] = [];
  const out = await withRetry(
    async () => {
      calls++;
      if (calls < 3) throw new Error('blockhash expired');
      return 'ok';
    },
    { attempts: 4, baseDelayMs: 10, sleep: async (ms) => { slept.push(ms); } },
  );
  assert.equal(out, 'ok');
  assert.equal(calls, 3); // failed twice, succeeded on the third
  assert.deepEqual(slept, [10, 20]); // exponential backoff between the two retries
});

test('withRetry gives up after `attempts` and propagates the last error (degrade-open surface)', async () => {
  let calls = 0;
  const slept: number[] = [];
  await assert.rejects(
    () => withRetry(
      async () => { calls++; throw new Error('RPC 503'); },
      { attempts: 3, baseDelayMs: 5, sleep: async (ms) => { slept.push(ms); } },
    ),
    /RPC 503/,
  );
  assert.equal(calls, 3); // exactly `attempts` tries
  assert.deepEqual(slept, [5, 10]); // slept between attempts, not after the final failure
});

test('withRetry succeeds on the first try without sleeping', async () => {
  const slept: number[] = [];
  const out = await withRetry(
    async () => 'first',
    { attempts: 4, baseDelayMs: 10, sleep: async (ms) => { slept.push(ms); } },
  );
  assert.equal(out, 'first');
  assert.deepEqual(slept, []);
});

// --- custom RPC URL override ---

test('resolveRpcUrl returns the override when set, else the public cluster endpoint', () => {
  assert.equal(resolveRpcUrl('mainnet-beta', 'https://my.rpc'), 'https://my.rpc');
  assert.equal(resolveRpcUrl('mainnet-beta', undefined), clusterEndpoint('mainnet-beta'));
  assert.equal(resolveRpcUrl('devnet', ''), clusterEndpoint('devnet')); // empty -> public
});

test('clusterEndpoint(cluster, override) returns the override URL', () => {
  assert.equal(clusterEndpoint('mainnet-beta', 'https://my.rpc'), 'https://my.rpc');
  assert.match(clusterEndpoint('mainnet-beta'), /mainnet/); // unset -> public unchanged
});

test('a URL override does NOT flip cluster identity / anchor-of-record off mainnet-beta (NI-17b)', () => {
  // overriding the URL is purely transport; the logical cluster still decides anchor-of-record.
  clusterEndpoint('mainnet-beta', 'https://devnet-looking.example/rpc');
  assert.equal(isAnchorOfRecord('mainnet-beta'), true);
  assert.equal(isAnchorOfRecord('devnet'), false);
});
