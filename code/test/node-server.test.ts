import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint } from '../src/release-store.ts';
import { createNode } from '../src/node-server.ts';

const keys = { V1: generateValidatorKey(), V2: generateValidatorKey(), V3: generateValidatorKey() };
const keyring = Object.fromEntries(Object.entries(keys).map(([id, k]) => [id, k.publicKeyPem]));

function bootData() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-srv-'));
  const tmpLog = join(mkdtempSync(join(tmpdir(), 'qrm-sl-')), 'votes.log');
  appendVote(tmpLog, signVote({ validatorId: 'V1', privateKeyPem: keys.V1.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  stageRelease(data, 'h0', { votesLog: readFileSync(tmpLog, 'utf8'), ballots: '', commons: { 'INDEX.md': '# c' } });
  commitRelease(data, 'h0', { chainId: 'c', valid: true, length: 1, headHash: 'h0', verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: 'h0', publishedAt: 't' });
  return data;
}

async function startNode() {
  const data = bootData();
  const cfg = { dataDir: data, port: 0, submitToken: 'S', adminToken: 'A', pinnedKeyring: keyring, chainId: 'c', quorum: 2,
    limits: { maxBodyBytes: 1024, maxQuestionLen: 200, maxContextLen: 800, rateWindowMs: 60000, rateMaxPerWindow: 100, inboxMaxBytes: 1e9, nearDupThreshold: 0.8 } };
  const node = createNode(cfg);
  await node.listen();
  return { node, base: `http://127.0.0.1:${node.port()}`, data };
}

test('public reads work without a token; admin/submit require their token', async () => {
  const { node, base } = await startNode();
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/inbox`)).status, 401);
    assert.equal((await fetch(`${base}/submit`, { method: 'POST', body: '{}' })).status, 401);
    const ok = await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'a real question', context: 'ctx' }) });
    assert.equal(ok.status, 200);
    const { id } = await ok.json();
    assert.match(id, /^[0-9a-f]{32}$/);
    const st = await (await fetch(`${base}/submissions/${id}`)).json();
    assert.equal(st.status, 'PENDING_REVIEW');
  } finally { node.close(); }
});

test('oversized body is rejected 413; admin can list and decide', async () => {
  const { node, base } = await startNode();
  try {
    const big = await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: 'x'.repeat(5000) });
    assert.equal(big.status, 413);
    const sub = await (await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'keep me', context: 'c' }) })).json();
    const list = await (await fetch(`${base}/inbox?status=PENDING_REVIEW`, { headers: { authorization: 'Bearer A' } })).json();
    assert.ok(list.submissions.some((s) => s.id === sub.id));
    const dec = await fetch(`${base}/inbox/${sub.id}/decision`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'ACCEPT' }) });
    assert.equal(dec.status, 200);
  } finally { node.close(); }
});

test('admin publish rejects a snapshot with an unpinned validator (409) and does not mutate the served chain', async () => {
  const { node, base } = await startNode();
  try {
    const before = await (await fetch(`${base}/chain/verify`)).json();
    const rogue = generateValidatorKey();
    const tmp = join(mkdtempSync(join(tmpdir(), 'qrm-rogue-')), 'votes.log');
    appendVote(tmp, signVote({ validatorId: 'VX', privateKeyPem: rogue.privateKeyPem, ballotHash: ballotHash('bad', ''), verdict: 'YES', rawOutput: 'x' }));
    const snap = { votesLog: readFileSync(tmp, 'utf8'), ballots: '', commons: { 'INDEX.md': '# x' } };
    const res = await fetch(`${base}/admin/publish`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify(snap) });
    assert.equal(res.status, 409);
    const after = await (await fetch(`${base}/chain/verify`)).json();
    assert.deepEqual(after, before); // served chain unchanged after a rejected publish
  } finally { node.close(); }
});

test('admin publish with malformed JSON returns 400, not 500', async () => {
  const { node, base } = await startNode();
  try {
    const res = await fetch(`${base}/admin/publish`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: '{not json' });
    assert.equal(res.status, 400);
  } finally { node.close(); }
});

test('degraded mode blocks writes but still serves /healthz', async () => {
  const data = bootData();
  const cfg = { dataDir: data, port: 0, submitToken: 'S', adminToken: 'A', pinnedKeyring: keyring, chainId: 'c', quorum: 2,
    limits: { maxBodyBytes: 1024, maxQuestionLen: 200, maxContextLen: 800, rateWindowMs: 60000, rateMaxPerWindow: 100, inboxMaxBytes: 1e9, nearDupThreshold: 0.8 } };
  const node = createNode(cfg, () => 'degraded');
  await node.listen();
  const base = `http://127.0.0.1:${node.port()}`;
  try {
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
    assert.equal((await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'q', context: 'c' }) })).status, 503);
  } finally { node.close(); }
});
