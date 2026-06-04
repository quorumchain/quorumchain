// Quorumchain ($QRM) — network transport for the deliberating host (round-57).
// The panel ratified moving each validator host onto its OWN machine, reached over a
// socket instead of a stdin/stdout pipe. This is a transport swap: the two-message
// line protocol ({pubkey} / {sign}), the child-side handler, the pinned-key verdict
// integrity, and the per-convening nonce are all unchanged from the stdio host — only
// the bytes' path changes. `makeNetworkSigner` returns the SAME Signer interface as
// makeRemoteSigner, so convene/startSigners are unchanged; pointing the panel at three
// addresses instead of one host path is the whole difference.
//
// SECURITY SCOPE (round-57 ruling): verdict integrity rests on the signature + pinned
// keyring (assertMatchesPin), NOT on this channel — a host without the pinned key
// cannot produce an acceptable vote, and a tampered ballot is caught because the host
// signs over the content it received and the orchestrator checks the hash. Mutual TLS
// (confidentiality + endpoint auth + DoS resistance) is the DEPLOYMENT layer that wraps
// this socket: node's `tls` module is a drop-in for `net` with cert options, terminated
// here or by a sidecar. It is additive, not load-bearing, so it is provisioned at deploy
// rather than hardcoded — this module carries the transport + nonce binding the ruling
// made load-bearing. Zero dependencies — Node built-ins only.

import { createServer, connect, type Socket } from 'node:net';
import { createInterface } from 'node:readline';
import { makeHostHandler, type HostRequest } from './signer-host-core.ts';
import { type ValidatorKey, type SignedVote } from './signed-vote.ts';
import { type ValidatorInvoker } from './panel.ts';
import { type RemoteSigner } from './signer.ts';

/** Serve one validator's deliberating host on a TCP socket. `port: 0` picks an
 *  ephemeral port (returned). Each connection speaks the same line protocol as the
 *  stdio host. In production each host runs on its own machine with only its OWN key. */
export function serveSignerSocket(params: {
  validatorId: string;
  key: ValidatorKey;
  invoke: ValidatorInvoker;
  port: number;
  host?: string;
}): Promise<{ port: number; close: () => void }> {
  const handle = makeHostHandler({ validatorId: params.validatorId, key: params.key, invoke: params.invoke });
  const server = createServer((socket) => {
    socket.on('error', () => {}); // a client connection drop must never crash the host
    const rl = createInterface({ input: socket });
    rl.on('error', () => {}); // readline re-emits the socket's error; the socket handler covers it
    rl.on('line', (line) => {
      let req: HostRequest;
      try {
        req = JSON.parse(line);
      } catch {
        return; // ignore malformed input
      }
      void (async () => {
        const res = await handle(req);
        if (socket.writable) socket.write(JSON.stringify({ id: req.id, ...res }) + '\n');
      })();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(params.port, params.host ?? '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : params.port;
      resolve({ port, close: () => server.close() });
    });
  });
}

/** Connect to a remote deliberating host and present it as a Signer. Same liveness
 *  floor as makeRemoteSigner: a dead/unreachable host rejects in-flight and future
 *  requests at once, so a down validator is a recorded absence, never a hang. */
export function makeNetworkSigner(params: { validatorId: string; host: string; port: number; timeoutMs?: number }): Promise<RemoteSigner> {
  const timeoutMs = params.timeoutMs ?? 30_000;
  const socket: Socket = connect({ host: params.host, port: params.port });
  type Waiter = { resolve: (msg: Record<string, unknown>) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> };
  const pending = new Map<number, Waiter>();
  let nextId = 1;
  let dead: Error | null = null;

  const failAll = (err: Error) => {
    dead = err;
    for (const [, w] of pending) {
      clearTimeout(w.timer);
      w.reject(err);
    }
    pending.clear();
  };
  socket.on('error', (e) => failAll(new Error(`network signer host unreachable: ${e.message}`)));
  socket.on('close', () => failAll(new Error('network signer host closed the connection before answering')));

  const rl = createInterface({ input: socket });
  rl.on('error', () => {}); // readline re-emits the socket's error; failAll (socket handler) covers it
  rl.on('line', (line) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const w = pending.get(msg.id as number);
    if (w) {
      clearTimeout(w.timer);
      pending.delete(msg.id as number);
      w.resolve(msg);
    }
  });

  const rpc = (req: Record<string, unknown>): Promise<Record<string, unknown>> =>
    new Promise((resolve, reject) => {
      if (dead) return reject(dead);
      const id = nextId++;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`network signer host timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      pending.set(id, { resolve, reject, timer });
      socket.write(JSON.stringify({ id, ...req }) + '\n');
    });

  // one-time handshake: fetch the host's PUBLIC key (private half stays on the host)
  return rpc({ type: 'pubkey' })
    .catch((err) => {
      socket.destroy();
      throw err;
    })
    .then((res) => ({
      validatorId: params.validatorId,
      publicKeyPem: res.publicKeyPem as string,
      async signBallot(prompt: string, context: string, verdicts?: string[], nonce?: string) {
        const r = await rpc({ type: 'sign', prompt, context, verdicts, nonce });
        return r.vote as SignedVote;
      },
      close() {
        socket.end();
        socket.destroy();
      },
    }));
}
