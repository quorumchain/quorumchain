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

export interface Signer {
  readonly validatorId: string;
  readonly publicKeyPem: string;
  /** Run this validator on the ballot CONTENT and return its OWN signed vote. The
   *  signer derives the ballot hash from (prompt, context) itself — the caller
   *  supplies no hash. `verdicts` are the offered options for prompt presentation
   *  only (they do not enter the hash, which binds prompt + context per CIP-3). */
  signBallot(prompt: string, context: string, verdicts?: string[]): Promise<SignedVote>;
}

export function makeLocalSigner(params: {
  validatorId: string;
  key: ValidatorKey; // consumed here; only the public half is ever exposed
  /** The validator's own deliberation: build the prompt, invoke the model, parse
   *  its verdict — all on the validator side, over the SAME content the hash binds. */
  deliberate: (prompt: string, context: string, verdicts?: string[]) => Promise<{ verdict: string; rawOutput: string }>;
}): Signer {
  const { validatorId, deliberate } = params;
  const privateKeyPem = params.key.privateKeyPem; // closure-captured; no getter, no property
  const publicKeyPem = params.key.publicKeyPem;
  return {
    validatorId,
    publicKeyPem,
    async signBallot(prompt, context, verdicts) {
      const bh = ballotHash(prompt, context); // derived here — never caller-supplied
      const { verdict, rawOutput } = await deliberate(prompt, context, verdicts);
      return signVote({ validatorId, privateKeyPem, ballotHash: bh, verdict, rawOutput });
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

export function makeRemoteSigner(params: { validatorId: string; hostPath: string; env?: Record<string, string> }): Promise<RemoteSigner> {
  const child = spawn(process.execPath, [params.hostPath], {
    env: { ...process.env, ...params.env, QRM_VALIDATOR_ID: params.validatorId },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  let nextId = 1;
  createInterface({ input: child.stdout! }).on('line', (line) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(line); } catch { return; }
    const resolve = pending.get(msg.id as number);
    if (resolve) { pending.delete(msg.id as number); resolve(msg); }
  });
  const rpc = (req: Record<string, unknown>): Promise<Record<string, unknown>> =>
    new Promise((resolve) => {
      const id = nextId++;
      pending.set(id, resolve);
      child.stdin!.write(JSON.stringify({ id, ...req }) + '\n');
    });

  // one-time handshake: fetch the host's PUBLIC key (the private half stays in the child)
  return rpc({ type: 'pubkey' }).then((res) => ({
    validatorId: params.validatorId,
    publicKeyPem: res.publicKeyPem as string,
    async signBallot(prompt: string, context: string, verdicts?: string[]) {
      const res = await rpc({ type: 'sign', prompt, context, verdicts });
      return res.vote as SignedVote;
    },
    close() {
      child.stdin!.end();
      child.kill();
    },
  }));
}
