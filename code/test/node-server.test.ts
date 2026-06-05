import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey, signVote, ballotHash } from '../src/signed-vote.ts';
import { appendVote } from '../src/vote-log.ts';
import { stageRelease, commitRelease, writeCheckpoint, isSafeCommonsName } from '../src/release-store.ts';
import { readLog } from '../src/vote-log.ts';
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

// Like bootData, but the staged pointer headHash EQUALS the real entryHash of the seeded
// vote, so a forward-extension snapshot (original entry + new pinned votes) is deterministic.
function bootDataReal() {
  const data = mkdtempSync(join(tmpdir(), 'qrm-srv-'));
  const tmpLog = join(mkdtempSync(join(tmpdir(), 'qrm-sl-')), 'votes.log');
  appendVote(tmpLog, signVote({ validatorId: 'V1', privateKeyPem: keys.V1.privateKeyPem, ballotHash: ballotHash('Q', 'C'), verdict: 'YES', rawOutput: 'V1:YES' }));
  const entries = readLog(tmpLog);
  const head = entries[0].entryHash;
  const votesLog = readFileSync(tmpLog, 'utf8');
  stageRelease(data, head, { votesLog, ballots: '', commons: { 'INDEX.md': '# c' } });
  commitRelease(data, head, { chainId: 'c', valid: true, length: 1, headHash: head, verifiedAt: 't' });
  writeCheckpoint(data, { chainId: 'c', length: 1, headHash: head, publishedAt: 't' });
  return { data, tmpLog };
}

// A forward-extension snapshot of bootDataReal's chain: original entry + N more pinned votes.
function extendSnapshot(seedLog: string, count: number): { votesLog: string; ballots: string; commons: Record<string, string>; head: string; length: number } {
  const ext = join(mkdtempSync(join(tmpdir(), 'qrm-ext-')), 'votes.log');
  writeFileSync(ext, readFileSync(seedLog, 'utf8'));
  const ids = ['V2', 'V3', 'V1'];
  for (let i = 0; i < count; i++) {
    const id = ids[i % ids.length] as 'V1' | 'V2' | 'V3';
    appendVote(ext, signVote({ validatorId: id, privateKeyPem: keys[id].privateKeyPem, ballotHash: ballotHash(`Q${i}`, `C${i}`), verdict: 'YES', rawOutput: `${id}:YES:${i}` }));
  }
  const entries = readLog(ext);
  return { votesLog: readFileSync(ext, 'utf8'), ballots: '', commons: { 'INDEX.md': '# c2' }, head: entries[entries.length - 1].entryHash, length: entries.length };
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

test('accepted submission can be marked CONVENED end-to-end; public read reflects it', async () => {
  const { node, base } = await startNode();
  try {
    const sub = await (await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'convene me please', context: 'ctx' }) })).json();
    const dec = await fetch(`${base}/inbox/${sub.id}/decision`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ decision: 'ACCEPT' }) });
    assert.equal(dec.status, 200);
    const cbh = 'a'.repeat(64);
    const conv = await fetch(`${base}/inbox/${sub.id}/convened`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ convenedBallotHash: cbh }) });
    assert.equal(conv.status, 200);
    assert.equal((await conv.json()).status, 'CONVENED');
    const st = await (await fetch(`${base}/submissions/${sub.id}`)).json();
    assert.equal(st.status, 'CONVENED');
    assert.equal(st.convenedBallotHash, cbh);
  } finally { node.close(); }
});

test('convening a non-accepted submission returns 409; a non-hex ballotHash returns 400', async () => {
  const { node, base } = await startNode();
  try {
    const sub = await (await fetch(`${base}/submit`, { method: 'POST', headers: { authorization: 'Bearer S', 'content-type': 'application/json' }, body: JSON.stringify({ question: 'still pending', context: 'ctx' }) })).json();
    // still PENDING_REVIEW (never accepted) → 409
    const bad = await fetch(`${base}/inbox/${sub.id}/convened`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ convenedBallotHash: 'a'.repeat(64) }) });
    assert.equal(bad.status, 409);
    // non-hex ballotHash → 400
    const badHash = await fetch(`${base}/inbox/${sub.id}/convened`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ convenedBallotHash: 'not-hex' }) });
    assert.equal(badHash.status, 400);
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

async function startNodeReal() {
  const { data, tmpLog } = bootDataReal();
  const cfg = { dataDir: data, port: 0, submitToken: 'S', adminToken: 'A', pinnedKeyring: keyring, chainId: 'c', quorum: 2,
    limits: { maxBodyBytes: 1 << 20, maxQuestionLen: 200, maxContextLen: 800, rateWindowMs: 60000, rateMaxPerWindow: 100, inboxMaxBytes: 1e9, nearDupThreshold: 0.8 } };
  const node = createNode(cfg);
  await node.listen();
  return { node, base: `http://127.0.0.1:${node.port()}`, data, tmpLog };
}

test('admin publish accepts a valid forward-extension and advances the served chain (200)', async () => {
  const { node, base, tmpLog } = await startNodeReal();
  try {
    const before = await (await fetch(`${base}/chain/verify`)).json();
    assert.equal(before.length, 1);
    const snap = extendSnapshot(tmpLog, 3);
    const res = await fetch(`${base}/admin/publish`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify({ votesLog: snap.votesLog, ballots: snap.ballots, commons: snap.commons }) });
    assert.equal(res.status, 200);
    const after = await (await fetch(`${base}/chain/verify`)).json();
    assert.equal(after.length, snap.length);
    assert.equal(after.headHash, snap.head);
    assert.equal(after.valid, true);
  } finally { node.close(); }
});

test('admin publish rejects commons path traversal (409) and does not overwrite the verified votes.log', async () => {
  const { node, base, tmpLog } = await startNodeReal();
  try {
    const before = await (await fetch(`${base}/chain/verify`)).json();
    const snap = extendSnapshot(tmpLog, 2); // a VALID forward-extension that would pass the gate
    // ...but smuggle a different, internally self-consistent log via a traversing commons name
    const evil = join(mkdtempSync(join(tmpdir(), 'qrm-evil-')), 'votes.log');
    appendVote(evil, signVote({ validatorId: 'V1', privateKeyPem: keys.V1.privateKeyPem, ballotHash: ballotHash('OTHER', 'CHAIN'), verdict: 'NO', rawOutput: 'V1:NO' }));
    const body = { votesLog: snap.votesLog, ballots: snap.ballots, commons: { 'INDEX.md': '# c2', '../votes.log': readFileSync(evil, 'utf8') } };
    const res = await fetch(`${base}/admin/publish`, { method: 'POST', headers: { authorization: 'Bearer A', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(res.status, 409);
    const after = await (await fetch(`${base}/chain/verify`)).json();
    assert.deepEqual(after, before); // served chain byte-identical: votes.log not overwritten
  } finally { node.close(); }
});

test('isSafeCommonsName allowlist + stageRelease throws on unsafe commons name', () => {
  assert.equal(isSafeCommonsName('../votes.log'), false);
  assert.equal(isSafeCommonsName('a/b'), false);
  assert.equal(isSafeCommonsName('..'), false);
  assert.equal(isSafeCommonsName('.'), false);
  assert.equal(isSafeCommonsName('INDEX.md'), true);
  assert.equal(isSafeCommonsName('a'.repeat(64) + '.md'), true);
  const data = mkdtempSync(join(tmpdir(), 'qrm-stage-'));
  assert.throws(() => stageRelease(data, 'h', { votesLog: '', ballots: '', commons: { '../votes.log': 'x' } }), /unsafe commons filename/);
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
