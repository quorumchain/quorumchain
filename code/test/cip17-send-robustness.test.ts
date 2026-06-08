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
  sendConfirmMemo,
  type MemoSender,
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

// --- send/confirm split: a confirm-timeout must NEVER cause a duplicate send ---
// sendConfirmMemo drives a small MemoSender seam (send / confirm / status) so the
// dedup logic is unit-tested with NO network. The cardinal property: if the FIRST
// memo tx LANDS on-chain but its confirmation throws/times out, the function must
// discover that via a signature-status query and return the landed signature WITHOUT
// sending a second (duplicate, fee-wasting) memo.

/** Build a scriptable MemoSender mock. `confirmOutcomes[i]` decides attempt i's confirm:
 *  'ok' resolves, 'timeout' rejects. `statusFor(sig)` answers the pre-resend status query. */
function mockSender(opts: {
  confirmOutcomes: Array<'ok' | 'timeout'>;
  statusFor: (sig: string) => 'confirmed' | 'pending' | 'gone';
}): MemoSender & { sendCount: number; confirmCount: number; statusCount: number } {
  let sendCount = 0;
  let confirmCount = 0;
  let statusCount = 0;
  const self = {
    get sendCount() { return sendCount; },
    get confirmCount() { return confirmCount; },
    get statusCount() { return statusCount; },
    async send() {
      sendCount++;
      // a fresh blockhash per send; signature encodes which send produced it
      return { signature: `sig-${sendCount}`, blockhash: `bh-${sendCount}`, lastValidBlockHeight: 100 + sendCount };
    },
    async confirm() {
      const outcome = opts.confirmOutcomes[confirmCount] ?? 'timeout';
      confirmCount++;
      if (outcome === 'timeout') throw new Error('confirmation timed out');
    },
    async status(sig: string) {
      statusCount++;
      return opts.statusFor(sig);
    },
  };
  return self as MemoSender & { sendCount: number; confirmCount: number; statusCount: number };
}

const tinyRetry = { attempts: 4, baseDelayMs: 1, sleep: async () => {} };

test('land-then-confirm-timeout returns the landed sig with NO duplicate send', async () => {
  // send #1 lands (sig-1) but its confirm times out; the status query reports sig-1 CONFIRMED,
  // so we must return sig-1 and never send again.
  const sender = mockSender({
    confirmOutcomes: ['timeout'],
    statusFor: (sig) => (sig === 'sig-1' ? 'confirmed' : 'gone'),
  });
  const sig = await sendConfirmMemo(sender, tinyRetry);
  assert.equal(sig, 'sig-1');
  assert.equal(sender.sendCount, 1, 'must send exactly once — no duplicate memo / extra fee');
  assert.equal(sender.statusCount, 1, 'queried the prior sig status before any resend');
});

test('genuinely-dropped tx resends with a fresh blockhash and succeeds', async () => {
  // send #1 confirm times out AND its status shows it is gone (blockhash expired / not found);
  // a resend (send #2, fresh blockhash) then confirms.
  const sender = mockSender({
    confirmOutcomes: ['timeout', 'ok'],
    statusFor: () => 'gone',
  });
  const sig = await sendConfirmMemo(sender, tinyRetry);
  assert.equal(sig, 'sig-2', 'returned the freshly-resent, confirmed signature');
  assert.equal(sender.sendCount, 2, 'a second send happened because the first was genuinely gone');
});

test('total failure throws after the bound so anchor-publish can degrade-open (NI-17a)', async () => {
  // every confirm times out and statuses never confirm -> after `attempts` the error propagates.
  const sender = mockSender({
    confirmOutcomes: ['timeout', 'timeout', 'timeout', 'timeout'],
    statusFor: () => 'gone',
  });
  await assert.rejects(() => sendConfirmMemo(sender, tinyRetry), /confirm|timed out|send/i);
  assert.equal(sender.sendCount, 4, 'bounded: exactly `attempts` sends, then it gives up');
});

test('a still-pending tx is treated as not-yet-landed and retried within the bound', async () => {
  // judgment call: a 'pending' status is NOT proof the tx landed, so we keep retrying (resend)
  // rather than returning an unconfirmed sig. If it later confirms we return it.
  const sender = mockSender({
    confirmOutcomes: ['timeout', 'ok'],
    statusFor: () => 'pending',
  });
  const sig = await sendConfirmMemo(sender, tinyRetry);
  assert.equal(sig, 'sig-2');
  assert.ok(sender.sendCount >= 2, 'pending did not short-circuit into returning an unconfirmed sig');
});

// --- recovery-path guard: send() itself throwing on the first attempt must NOT deref an
// undefined signature. Before the guard, sendConfirmMemo declared `let sig: string` and ran
// `sender.status(sig!)` on EVERY failed attempt — so a first-attempt send() throw left sig
// undefined and the `sig!` assertion was unsound (status got an undefined "signature"). The
// fix makes sig optional and only queries status when a signature actually exists. This mock's
// status() asserts it is never handed a non-string sig, so the pre-guard code path would crash.

test('first-attempt send() throw does not deref an undefined sig, then resend confirms', async () => {
  // attempt 1: send() throws (no signature ever produced) -> must NOT call status(undefined).
  // attempt 2: send() succeeds (sig-1 here, since sendCount only advances on a successful send)
  // and confirms. The returned value must be a real signature, never undefined.
  let sendCount = 0;
  let statusCalls = 0;
  const sender: MemoSender = {
    async send() {
      sendCount++;
      if (sendCount === 1) throw new Error('send failed: connection refused');
      return { signature: `sig-${sendCount}`, blockhash: `bh-${sendCount}`, lastValidBlockHeight: 100 + sendCount };
    },
    async confirm() {
      // confirms whatever the (second) send produced
    },
    async status(sig) {
      statusCalls++;
      // hard guard: the orchestrator must never query status for a non-existent signature.
      assert.equal(typeof sig, 'string', 'status() must never be called with an undefined sig');
      return 'gone';
    },
  };
  const sig = await sendConfirmMemo(sender, tinyRetry);
  assert.equal(typeof sig, 'string', 'must return a real signature, never undefined');
  assert.equal(sig, 'sig-2');
  assert.equal(statusCalls, 0, 'no status query happened for the throwing first send (no sig existed)');
});

test('send() always throwing rejects after the bound (degrade-open, NI-17a) without an undefined deref', async () => {
  // every attempt's send() throws -> no signature ever exists -> status() must never be called
  // with undefined, and after `attempts` the last error propagates so anchor-publish degrades.
  let sendCount = 0;
  const sender: MemoSender = {
    async send() {
      sendCount++;
      throw new Error('send failed: RPC down');
    },
    async confirm() { /* never reached */ },
    async status(sig) {
      assert.fail(`status() must not be called when no send ever succeeded (got sig=${String(sig)})`);
    },
  };
  await assert.rejects(() => sendConfirmMemo(sender, tinyRetry), /send failed: RPC down/);
  assert.equal(sendCount, 4, 'bounded: exactly `attempts` send attempts, then degrade-open');
});
