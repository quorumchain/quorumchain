// CIP-8 v0.1 notary kernel (NOTARY-mode Staked Resolvable Attestation).
// The kernel productizes the CIP-3 signed/hash-chained substrate for ACTION
// attestations. Its hard invariant is NI-8a: a notary record asserts authorship
// + timing + non-repudiation ONLY, never content-truth. These tests pin that
// the kernel cannot be made to claim a record is "verified".

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateValidatorKey } from '../src/signed-vote.ts';
import { createHash } from 'node:crypto';
import {
  createAttestation,
  verifyAttestation,
  checkAttestation,
  appendAttestation,
  readAttestationLog,
  verifyAttestationLog,
} from '../src/notary.ts';

const h = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

function freshAtt(overrides: Record<string, unknown> = {}) {
  const subject = generateValidatorKey();
  return createAttestation({
    subjectPublicKeyPem: subject.publicKeyPem,
    subjectPrivateKeyPem: subject.privateKeyPem,
    action: 'Procurement agent placed order #4471 for $42,300; under human-signoff policy.',
    evidenceCommitments: [h('tool-call-log'), h('approval-token')],
    policyVersion: 'procurement-policy@v3',
    ballotHash: null,
    timestamp: '2026-06-04T12:00:00Z',
    ...overrides,
  });
}

test('NI-8a: every notary record is labeled NOT_VERIFIED at creation', () => {
  const att = freshAtt();
  assert.equal(att.status, 'NOT_VERIFIED');
  assert.equal(att.mode, 'NOTARY');
});

test('NI-8a: createAttestation forces NOT_VERIFIED even if caller tries to override', () => {
  // @ts-expect-error — intentionally passing a forbidden field
  const att = freshAtt({ status: 'VERIFIED', mode: 'RESOLUTION' });
  assert.equal(att.status, 'NOT_VERIFIED');
  assert.equal(att.mode, 'NOTARY');
});

test('NI-8a: checkAttestation never emits a label other than NOT_VERIFIED', () => {
  const att = freshAtt();
  const res = checkAttestation(att);
  assert.equal(res.label, 'NOT_VERIFIED');
  // accepted means "admissible as a non-repudiable notary record", NOT "true"
  assert.equal(res.accepted, true);
  assert.equal(res.attributable, true);
  assert.equal(res.complete, true);
  assert.equal(res.consistent, true);
});

test('a well-formed attestation verifies against its subject key', () => {
  const att = freshAtt();
  assert.equal(verifyAttestation(att), true);
});

test('attributability fails if the signature does not bind to the subject key', () => {
  const att = freshAtt();
  const imposter = generateValidatorKey();
  const tampered = { ...att, subject: imposter.publicKeyPem };
  assert.equal(verifyAttestation(tampered), false);
  const res = checkAttestation(tampered);
  assert.equal(res.attributable, false);
  assert.equal(res.accepted, false);
  assert.equal(res.label, 'NOT_VERIFIED'); // label is still never "verified"
});

test('consistency fails if the action text is altered after signing', () => {
  const att = freshAtt();
  const tampered = { ...att, payload: { ...att.payload, action: 'a different action' } };
  assert.equal(verifyAttestation(tampered), false);
  assert.equal(checkAttestation(tampered).accepted, false);
});

test('completeness fails on a missing required field', () => {
  const att = freshAtt({ policyVersion: '' });
  const res = checkAttestation(att);
  assert.equal(res.complete, false);
  assert.equal(res.accepted, false);
  assert.ok(res.reasons.some((r) => r.includes('policyVersion')));
});

test('consistency fails on a malformed evidence commitment (not a sha256 hex)', () => {
  const att = freshAtt({ evidenceCommitments: ['not-a-hash'] });
  const res = checkAttestation(att);
  assert.equal(res.consistent, false);
  assert.equal(res.accepted, false);
});

test('empty evidence commitments are complete but flagged in reasons', () => {
  const att = freshAtt({ evidenceCommitments: [] });
  const res = checkAttestation(att);
  // an action with no evidence is still admissible (non-repudiation), but noted
  assert.equal(res.accepted, true);
  assert.ok(res.reasons.some((r) => r.toLowerCase().includes('no evidence')));
});

test('G3: attestations are hash-chained; any edit breaks the chain', () => {
  const logPath = join(mkdtempSync(join(tmpdir(), 'qrm-notary-')), 'attestations.log');
  const a1 = appendAttestation(logPath, freshAtt());
  const a2 = appendAttestation(logPath, freshAtt());
  assert.equal(a2.prevHash, a1.entryHash);
  assert.equal(verifyAttestationLog(logPath).valid, true);

  const entries = readAttestationLog(logPath);
  assert.equal(entries.length, 2);
  // every persisted record carries the NI-8a label
  assert.ok(entries.every((e) => e.attestation.status === 'NOT_VERIFIED'));
});

test('G3: chain detects an out-of-place / edited entry', () => {
  const dir = mkdtempSync(join(tmpdir(), 'qrm-notary-'));
  const logPath = join(dir, 'attestations.log');
  appendAttestation(logPath, freshAtt());
  appendAttestation(logPath, freshAtt());
  // hand-corrupt the middle of the chain by rewriting the file with a swapped action
  const entries = readAttestationLog(logPath);
  entries[0].attestation.payload.action = 'silently edited after the fact';
  writeFileSync(logPath, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  assert.equal(verifyAttestationLog(logPath).valid, false);
});
