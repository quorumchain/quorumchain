// Quorumchain ($QRM) — the validator signing boundary (round-44 backlog #2,
// hardened in round-45 per V2's dissent). CIP-3's deepest invariant is that the
// orchestrator is NOT the trust root. A Signer is the capability that enforces it:
// the validator's private key is captured behind this boundary, and the
// orchestrator can only ASK for a signed vote on a ballot it describes by CONTENT
// (prompt + context). It never holds the key and never supplies a ballot hash —
// the signer DERIVES the hash from the same (prompt, context) it deliberates on,
// so the orchestrator can neither mint/alter a verdict nor obtain a signature over
// a ballot the validator did not actually judge (the round-45 binding fix: a
// caller-supplied hash was a bait-and-switch hole, exactly what CIP-3 forbids).
//
// `makeLocalSigner` is the in-process implementation: the key lives in a closure
// with no extraction path, and `deliberate` (the validator's own build-prompt +
// invoke + parse) runs on the validator side. NOTE (testnet item): locally the key
// is still loaded into the orchestrator PROCESS, so this achieves type/protocol
// separation but not OS-level custody isolation — the drop-in is a RemoteSigner
// (separate process / enclave / signing service) on the SAME interface, so nothing
// here changes to gain true custody separation.
// Zero dependencies.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { ballotHash, signVote, type SignedVote, type ValidatorKey } from './signed-vote.ts';
import { signDossier as signDossierFn, type ContraryDossier } from './dossier.ts';
import { type Attestor } from './attestor.ts';
import { buildPrompt, parseVerdict } from './panel.ts';

export interface Signer {
  readonly validatorId: string;
  readonly publicKeyPem: string;
  /** Run this validator on the ballot CONTENT and return its OWN signed vote. The
   *  signer derives the ballot hash from (prompt, context) itself — the caller
   *  supplies no hash. `verdicts` are the offered options for prompt presentation
   *  only (they do not enter the hash, which binds prompt + context per CIP-3).
   *  `nonce` (round-57) is the orchestrator's per-convening token: the signer binds
   *  it into the signed payload so the vote cannot be replayed into another convening.
   *  `boundType` (CIP-14) is a hash-bound epistemic type: when a recognized token, the
   *  signer derives the hash WITH it, so the type enters the signature (the NI-13a ideal).
   *  `anchorCommitment` (CIP-15 NI-15e) is the canonical commitment over the ballot's anchor
   *  set: when present, the signer derives the hash WITH it, so the anchors enter the signature
   *  and cannot be swapped post-vote. Both are derived by the orchestrator from the same declared
   *  meta the registry records, so the registry entry, every vote, and ratify share one preimage.
   *  `challengeNonce` (proof-of-inference) is the orchestrator-generated challenge: when an attestor
   *  is wired, the signer passes it to the attestor so the provenance envelope is bound to this
   *  convening's challenge (it does NOT enter the ballot hash). Absent an attestor it is ignored. */
  signBallot(prompt: string, context: string, verdicts?: string[], nonce?: string, boundType?: string, anchorCommitment?: string, challengeNonce?: string): Promise<SignedVote>;
  /** Sign a CIP-10 contrary-evidence dossier with this validator's key (child-side). */
  signDossier(dossier: ContraryDossier): Promise<ContraryDossier>;
  /** Run this validator's model invoker on a prompt and return raw output (CIP-10 audit). */
  audit(prompt: string): Promise<string>;
}

export function makeLocalSigner(params: {
  validatorId: string;
  key: ValidatorKey; // consumed here; only the public half is ever exposed
  /** The validator's own deliberation: build the prompt, invoke the model, parse
   *  its verdict — all on the validator side, over the SAME content the hash binds. */
  deliberate: (prompt: string, context: string, verdicts?: string[]) => Promise<{ verdict: string; rawOutput: string }>;
  /** Optional proof-of-inference attestor: when present it (not `deliberate`) supplies the
   *  rawOutput AND the signed provenance envelope, bound to `challengeNonce`. Absent, the signer
   *  is byte-identical to the legacy path (no attestation field on the vote). */
  attestor?: Attestor;
}): Signer {
  const { validatorId, deliberate, attestor } = params;
  const privateKeyPem = params.key.privateKeyPem; // closure-captured; no getter, no property
  const publicKeyPem = params.key.publicKeyPem;
  return {
    validatorId,
    publicKeyPem,
    async signBallot(prompt, context, verdicts, nonce, boundType, anchorCommitment, challengeNonce) {
      const bh = ballotHash(prompt, context, boundType, anchorCommitment); // derived here — never caller-supplied (CIP-14 type + CIP-15 anchors when present)
      if (attestor) {
        const built = buildPrompt(prompt, context, verdicts);
        const { rawOutput, attestation } = await attestor.invoke(validatorId, built, challengeNonce ?? '', { ballotHash: bh, conveningNonce: nonce ?? '' });
        const verdict = parseVerdict(rawOutput);
        return signVote({ validatorId, privateKeyPem, ballotHash: bh, verdict, rawOutput, nonce, attestation });
      }
      const { verdict, rawOutput } = await deliberate(prompt, context, verdicts);
      return signVote({ validatorId, privateKeyPem, ballotHash: bh, verdict, rawOutput, nonce });
    },
    async signDossier(dossier) {
      return signDossierFn(dossier, privateKeyPem);
    },
    async audit(_prompt) {
      throw new Error('audit not supported on local signer');
    },
  };
}

/** A Signer whose private key lives in a SEPARATE OS PROCESS (the host script at
 *  `hostPath`). This is the OS-level custody isolation the boundary pointed at: the
 *  orchestrator spawns the host, reads only its PUBLIC key, and asks it to sign
 *  ballots by content over stdio — the private key never enters this process. Same
 *  `Signer` interface as the local signer, so `convene` is unchanged; `close()`
 *  shuts the host down. */
export interface RemoteSigner extends Signer {
  close(): void;
}

export function makeRemoteSigner(params: { validatorId: string; hostPath: string; env?: Record<string, string>; timeoutMs?: number }): Promise<RemoteSigner> {
  const timeoutMs = params.timeoutMs ?? 30_000;
  const child = spawn(process.execPath, [params.hostPath], {
    env: { ...process.env, ...params.env, QRM_VALIDATOR_ID: params.validatorId },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  type Waiter = { resolve: (msg: Record<string, unknown>) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> };
  const pending = new Map<number, Waiter>();
  let nextId = 1;
  let dead: Error | null = null; // set once the host can no longer answer (error/exit)

  // Liveness floor: if the host crashes, fails to spawn, or exits, every in-flight
  // request rejects at once and all future ones fail fast — a dead validator process
  // can never hang the convening (the local signer turns failures into NO_VERDICT;
  // this is the remote equivalent).
  const failAll = (err: Error) => {
    dead = err;
    for (const [, w] of pending) { clearTimeout(w.timer); w.reject(err); }
    pending.clear();
  };
  child.on('error', (e) => failAll(new Error(`remote signer host failed to start: ${e.message}`)));
  child.on('exit', (code, signal) => failAll(new Error(`remote signer host exited before answering (code=${code}, signal=${signal})`)));

  createInterface({ input: child.stdout! }).on('line', (line) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(line); } catch { return; }
    const w = pending.get(msg.id as number);
    if (w) { clearTimeout(w.timer); pending.delete(msg.id as number); w.resolve(msg); }
  });
  const rpc = (req: Record<string, unknown>): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      if (dead) return reject(dead); // host already gone — never wait
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`remote signer host timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      pending.set(id, { resolve, reject, timer });
      child.stdin!.write(JSON.stringify({ id, ...req }) + '\n');
    });

  // one-time handshake: fetch the host's PUBLIC key (the private half stays in the child)
  return rpc({ type: 'pubkey' }).catch((err) => { child.kill(); throw err; }).then((res) => ({
    validatorId: params.validatorId,
    publicKeyPem: res.publicKeyPem as string,
    async signBallot(prompt: string, context: string, verdicts?: string[], nonce?: string, boundType?: string, anchorCommitment?: string, challengeNonce?: string) {
      const res = await rpc({ type: 'sign', prompt, context, verdicts, nonce, boundType, anchorCommitment, challengeNonce });
      return res.vote as SignedVote;
    },
    async signDossier(dossier: ContraryDossier) {
      const res = await rpc({ type: 'signDossier', dossier });
      return res.dossier as ContraryDossier;
    },
    async audit(prompt: string) {
      const res = await rpc({ type: 'audit', prompt });
      return res.rawOutput as string;
    },
    close() {
      child.stdin!.end();
      child.kill();
    },
  }));
}
