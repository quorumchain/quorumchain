import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chainIdFor, loadConfig, PROTOCOL_VERSION } from '../src/node-config.ts';

const KEYRING = { V1: 'PEM-1', V2: 'PEM-2', V3: 'PEM-3' };

test('chainIdFor is deterministic, order-independent, and changes if the key set changes', () => {
  const a = chainIdFor(KEYRING);
  const b = chainIdFor({ V3: 'PEM-3', V1: 'PEM-1', V2: 'PEM-2' });
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, chainIdFor({ ...KEYRING, V3: 'DIFFERENT' }));
  assert.notEqual(a, chainIdFor({ V1: 'PEM-1', V2: 'PEM-2' }));
});

test('loadConfig requires the two tokens and derives chainId from the keyring', () => {
  const env = { QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's', QRM_ADMIN_TOKEN: 'a' };
  const cfg = loadConfig(env, KEYRING);
  assert.equal(cfg.dataDir, '/tmp/x');
  assert.equal(cfg.submitToken, 's');
  assert.equal(cfg.chainId, chainIdFor(KEYRING));
  assert.equal(cfg.quorum, 2);
  assert.throws(() => loadConfig({ QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's' }, KEYRING), /QRM_ADMIN_TOKEN/);
});

test('allowedOrigins defaults to empty and parses QRM_ALLOWED_ORIGINS (trim, drop blanks)', () => {
  const base = { QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's', QRM_ADMIN_TOKEN: 'a' };
  assert.deepEqual(loadConfig(base, KEYRING).allowedOrigins, []);
  const cfg = loadConfig({ ...base, QRM_ALLOWED_ORIGINS: ' http://a.test , ,https://b.test ' }, KEYRING);
  assert.deepEqual(cfg.allowedOrigins, ['http://a.test', 'https://b.test']);
});

test('maxBodyBytes defaults to 64KiB but is overridable via QRM_MAX_BODY_BYTES', () => {
  const base = { QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's', QRM_ADMIN_TOKEN: 'a' };
  assert.equal(loadConfig(base, KEYRING).limits.maxBodyBytes, 64 * 1024);
  assert.equal(loadConfig({ ...base, QRM_MAX_BODY_BYTES: '8388608' }, KEYRING).limits.maxBodyBytes, 8388608);
});

test('QRM_MAX_BODY_BYTES rejects non-finite/non-positive/non-integer/over-max values at load', () => {
  const base = { QRM_NODE_DATA: '/tmp/x', QRM_SUBMIT_TOKEN: 's', QRM_ADMIN_TOKEN: 'a' };
  // unset → default preserved exactly
  assert.equal(loadConfig(base, KEYRING).limits.maxBodyBytes, 64 * 1024);
  // valid override at the upper bound (64 MiB) is honored
  assert.equal(loadConfig({ ...base, QRM_MAX_BODY_BYTES: String(64 * 1024 * 1024) }, KEYRING).limits.maxBodyBytes, 64 * 1024 * 1024);
  // bad values throw a clear config error, never silently fall back
  for (const bad of ['abc', 'NaN', 'Infinity', '0', '-1', '1.5', String(64 * 1024 * 1024 + 1)]) {
    assert.throws(() => loadConfig({ ...base, QRM_MAX_BODY_BYTES: bad }, KEYRING), /QRM_MAX_BODY_BYTES/, `expected throw for ${bad}`);
  }
});
