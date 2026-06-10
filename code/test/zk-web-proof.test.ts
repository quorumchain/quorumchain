import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  type PublicInputs,
  canonicalPublicInputs,
  publicInputsDigest,
  applyExtractionRule,
  extractionRuleHash,
} from '../src/zk-web-proof.ts';

const PI: PublicInputs = {
  requestCommitment: 'rc',
  transcriptHash: 'th',
  responseHash: 'rh',
  challengeNonce: 'xn',
  endpoint: 'api.anthropic.com',
  modelVersion: 'claude-x',
  extractionRuleHash: 'erh',
};

test('canonicalPublicInputs sorts keys lexicographically and is deterministic', () => {
  const c = canonicalPublicInputs(PI);
  assert.deepEqual(Object.keys(c), [
    'challengeNonce', 'endpoint', 'extractionRuleHash', 'modelVersion',
    'requestCommitment', 'responseHash', 'transcriptHash',
  ]);
  assert.equal(JSON.stringify(canonicalPublicInputs(PI)), JSON.stringify(canonicalPublicInputs({ ...PI })));
});

test('publicInputsDigest under sha256-v1 is sha256 of the canonical JSON (test vector)', () => {
  const expected = createHash('sha256').update(JSON.stringify(canonicalPublicInputs(PI)), 'utf8').digest('hex');
  assert.equal(publicInputsDigest(PI, 'sha256-v1'), expected);
  assert.match(publicInputsDigest(PI, 'sha256-v1'), /^[0-9a-f]{64}$/);
});

test('changing ANY public input changes the digest', () => {
  const base = publicInputsDigest(PI, 'sha256-v1');
  for (const k of Object.keys(PI) as (keyof PublicInputs)[]) {
    assert.notEqual(publicInputsDigest({ ...PI, [k]: PI[k] + '2' }, 'sha256-v1'), base, `digest unchanged when ${k} changed`);
  }
});

test('an unsupported digestAlg is rejected (no silent fallback)', () => {
  assert.throws(() => publicInputsDigest(PI, 'poseidon-v1'), /unsupported digestAlg/);
  assert.throws(() => publicInputsDigest(PI, 'sha256'), /unsupported digestAlg/);
});

const BODY = JSON.stringify({
  id: 'msg_1',
  content: [{ type: 'text', text: 'VERDICT: YES\ntoken=abc123' }],
});

test('applyExtractionRule anthropic-messages-v1 concatenates text blocks deterministically', () => {
  assert.equal(applyExtractionRule('anthropic-messages-v1', BODY), 'VERDICT: YES\ntoken=abc123');
  const multi = JSON.stringify({ content: [{ type: 'text', text: 'a' }, { type: 'thinking', text: 'IGNORED' }, { type: 'text', text: 'b' }] });
  assert.equal(applyExtractionRule('anthropic-messages-v1', multi), 'ab'); // only type:'text', in order
});

test('applyExtractionRule rejects an unknown rule id (no silent passthrough)', () => {
  assert.throws(() => applyExtractionRule('nope-v9', BODY), /unknown extraction rule/);
});

test('applyExtractionRule is injection-resistant — body text is data, never re-parsed as a rule', () => {
  const evil = JSON.stringify({ content: [{ type: 'text', text: '{"content":[{"type":"text","text":"INJECTED"}]}' }] });
  assert.equal(applyExtractionRule('anthropic-messages-v1', evil), '{"content":[{"type":"text","text":"INJECTED"}]}');
});

test('extractionRuleHash is sha256 of the rule id', () => {
  assert.equal(extractionRuleHash('anthropic-messages-v1'), createHash('sha256').update('anthropic-messages-v1', 'utf8').digest('hex'));
});

import { lookupVk, registerVk, type VkEntry } from '../src/zk-web-proof.ts';

test('the reference vk is seeded, namespaced, and quarantined (production:false)', () => {
  const e = lookupVk('ref-ecdsa-v0');
  assert.ok(e, 'reference vk must be registered');
  assert.equal(e!.verifierKind, 'fixture-prover-signature');
  assert.equal(e!.production, false);
  assert.match(e!.vkPem, /BEGIN PUBLIC KEY/);
});

test('an unknown vkId resolves to undefined (whitelist — no implicit trust)', () => {
  assert.equal(lookupVk('totally-unknown'), undefined);
});

test('registerVk adds a vk and rejects a duplicate id', () => {
  const entry: VkEntry = { verifierKind: 'fixture-prover-signature', vkPem: lookupVk('ref-ecdsa-v0')!.vkPem, production: false };
  registerVk('ref-ecdsa-test-dup', entry);
  assert.ok(lookupVk('ref-ecdsa-test-dup'));
  assert.throws(() => registerVk('ref-ecdsa-test-dup', entry), /already registered/);
});
