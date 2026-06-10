import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mockAttestor, type Attestor, type RequestCtx } from '../src/attestor.ts';

test('mockAttestor returns the verbatim invoker output with an unattested/NO_BACKEND band', async () => {
  const invoke = async (prompt: string) => `echo: ${prompt}`;
  const att: Attestor = mockAttestor(invoke);
  const res = await att.invoke('V1', 'the prompt', 'challenge-xyz');
  assert.equal(res.rawOutput, 'echo: the prompt');
  assert.deepEqual(res.attestation, { band: 'unattested', reason: 'NO_BACKEND' });
});

test('mockAttestor surfaces an invoker error as the rawOutput (never throws into the vote path)', async () => {
  const invoke = async () => { throw new Error('CLI exploded'); };
  const att = mockAttestor(invoke);
  const res = await att.invoke('V1', 'p', 'n');
  assert.match(res.rawOutput, /CLI exploded/);
  assert.deepEqual(res.attestation, { band: 'unattested', reason: 'NO_BACKEND' });
});

import { attestWithBudget } from '../src/attestor.ts';
import type { AttestedResult } from '../src/attestor.ts';

const never = <T>() => new Promise<T>(() => {}); // a backend that hangs forever

test('attestWithBudget passes through a backend that beats the budget', async () => {
  const backend: Attestor = { async invoke() { return { rawOutput: 'real', attestation: { band: 'attested', endpoint: 'api.x' } }; } };
  const fallback = async (p: string) => `cli: ${p}`;
  const res = await attestWithBudget(backend, fallback, 1000).invoke('V1', 'p', 'n');
  assert.equal(res.rawOutput, 'real');
  assert.equal(res.attestation.band, 'attested');
});

test('attestWithBudget degrades to ATTESTOR_TIMEOUT and falls back to the CLI when the budget elapses', async () => {
  const backend: Attestor = { invoke: () => never<AttestedResult>() };
  const fallback = async (p: string) => `cli: ${p}`;
  const res = await attestWithBudget(backend, fallback, 20).invoke('V1', 'the prompt', 'n');
  assert.equal(res.rawOutput, 'cli: the prompt');
  assert.deepEqual(res.attestation, { band: 'degraded', reason: 'ATTESTOR_TIMEOUT' });
});

test('attestWithBudget degrades to PROOF_FAILED and falls back when the backend throws', async () => {
  const backend: Attestor = { async invoke() { throw new Error('proofgen boom'); } };
  const fallback = async (p: string) => `cli: ${p}`;
  const res = await attestWithBudget(backend, fallback, 1000).invoke('V1', 'p', 'n');
  assert.equal(res.rawOutput, 'cli: p');
  assert.deepEqual(res.attestation, { band: 'degraded', reason: 'PROOF_FAILED' });
});

test('attestWithBudget reports PROOF_FAILED + diagnostic when both backend and fallback fail', async () => {
  const backend: Attestor = { async invoke() { throw new Error('down'); } };
  const fallback = async () => { throw new Error('cli also dead'); };
  const res = await attestWithBudget(backend, fallback, 1000).invoke('V1', 'p', 'n');
  assert.match(res.rawOutput, /INVOCATION_ERROR/);
  assert.deepEqual(res.attestation, { band: 'degraded', reason: 'PROOF_FAILED' });
});

test('mockAttestor ignores requestCtx and still bands unattested/NO_BACKEND', async () => {
  const a = mockAttestor(async () => 'out');
  const r = await a.invoke('V1', 'p', 'xn', { ballotHash: 'bh', conveningNonce: 'cn' });
  assert.equal(r.rawOutput, 'out');
  assert.deepEqual(r.attestation, { band: 'unattested', reason: 'NO_BACKEND' });
});

test('a backend receives the requestCtx the caller passes', async () => {
  let seen: RequestCtx | undefined;
  const spy: Attestor = {
    async invoke(_v, _p, _x, ctx) { seen = ctx; return { rawOutput: 'o', attestation: { band: 'unattested', reason: 'NO_BACKEND' } }; },
  };
  await spy.invoke('V1', 'p', 'xn', { ballotHash: 'BH', conveningNonce: 'CN' });
  assert.deepEqual(seen, { ballotHash: 'BH', conveningNonce: 'CN' });
});
