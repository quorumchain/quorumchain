// Quorumchain ($QRM) — HTTP transport for the deployable node (spec §7/§11). Node built-in
// http only. Enforces: bearer auth (timing-safe), body-size cap (413), per-IP+token rate
// limit, request/idle timeouts, connection cap. Routes to the pure handlers + inbox + the
// publish gate. NEVER holds validator keys. Zero dependencies.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { readLog } from './vote-log.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { NodeConfig } from './node-config.ts';
import { currentRelease, stageRelease, commitRelease, writeCheckpoint, readCheckpoint, readReleaseFile, type Snapshot } from './release-store.ts';
import { verifyPublish } from './publish-verify.ts';
import { handleHealth, handleVerify, handleLog, handleBallot, handleCommons } from './node-handlers.ts';
import { submit, listInbox, getSubmission, decide } from './inbox.ts';
import { screen, type Corpus } from './screening.ts';
import { ballotHash } from './signed-vote.ts';
import { loadRegistry } from './ballot-registry.ts';
import { audit } from './audit-log.ts';

function tokenEq(a: string, b: string): boolean {
  const ab = Buffer.from(a), bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
function bearer(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  return h && h.startsWith('Bearer ') ? h.slice(7) : null;
}
function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
function materialize(content: string | null, name: string): string | null {
  if (content === null) return null;
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-mz-')), name);
  writeFileSync(p, content);
  return p;
}

export interface NodeHandle { listen(): Promise<void>; close(): void; port(): number }

export function createNode(cfg: NodeConfig, getMode: () => 'live' | 'degraded' = () => 'live'): NodeHandle {
  const data = cfg.dataDir;
  const inboxPath = join(data, 'inbox.jsonl');
  const auditPath = join(data, 'audit.jsonl');
  const rate = new Map<string, number[]>();

  const allowed = (key: string): boolean => {
    const now = Date.now();
    const arr = (rate.get(key) ?? []).filter((t) => now - t < cfg.limits.rateWindowMs);
    arr.push(now);
    rate.set(key, arr);
    return arr.length <= cfg.limits.rateMaxPerWindow;
  };

  // On overflow we send 413 ourselves, FLUSH it, then destroy the request stream (spec §11:
  // body cap returns 413 and destroys the stream). Destroying before the response is flushed
  // resets the socket and the client never sees the 413, so respond-then-destroy is required.
  const readBody = (req: IncomingMessage, res: ServerResponse): Promise<string | null> =>
    new Promise((resolve) => {
      let size = 0; const chunks: Buffer[] = []; let over = false;
      req.on('data', (c: Buffer) => {
        if (over) return;
        size += c.length;
        if (size > cfg.limits.maxBodyBytes) {
          over = true;
          res.writeHead(413, { 'content-type': 'application/json', connection: 'close' });
          res.end(JSON.stringify({ error: 'body too large' }), () => req.destroy());
          resolve(null);
        } else chunks.push(c);
      });
      req.on('end', () => { if (!over) resolve(Buffer.concat(chunks).toString('utf8')); });
      req.on('error', () => { if (!over) resolve(null); });
    });

  const corpus = (): Corpus => {
    const ref = currentRelease(data);
    const rp = ref ? materialize(readReleaseFile(data, ref, 'ballots.jsonl'), 'ballots.jsonl') : null;
    const reg = rp ? loadRegistry(rp) : [];
    const pend = listInbox(inboxPath).map((s) => ({ p: `${s.raw.question} ${s.raw.context}`, h: s.ballotHash }));
    return { prompts: [...reg.map((e) => `${e.prompt} ${e.context}`), ...pend.map((x) => x.p)], hashes: [...reg.map((e) => e.ballotHash), ...pend.map((x) => x.h)] };
  };

  const reply = (res: ServerResponse, out: { status: number; body: any }) => send(res, out.status, out.body);

  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const path = url.pathname;
      const ip = req.socket.remoteAddress ?? 'unknown';
      const mode = getMode();
      const ref = currentRelease(data);

      if (req.method === 'GET' && path === '/healthz') return send(res, 200, handleHealth(data, ref, mode).body);
      if (mode === 'degraded' && (path === '/submit' || path.startsWith('/admin') || path.startsWith('/inbox')))
        return send(res, 503, { error: 'degraded: chain invalid' });
      if (!ref) return send(res, 503, { error: 'no chain published yet' });

      if (req.method === 'GET' && path === '/chain/verify') return send(res, 200, handleVerify(data, ref).body);
      if (req.method === 'GET' && path === '/commons') return reply(res, handleCommons(data, ref));
      if (req.method === 'GET' && path.startsWith('/commons/')) return reply(res, handleCommons(data, ref, path.slice('/commons/'.length)));
      if (req.method === 'GET' && path.startsWith('/ballot/')) return reply(res, handleBallot(data, ref, path.slice('/ballot/'.length)));
      if (req.method === 'GET' && path === '/log') return reply(res, handleLog(data, ref, Number(url.searchParams.get('from') ?? 0), Math.min(Number(url.searchParams.get('limit') ?? 100), 500)));
      if (req.method === 'GET' && path.startsWith('/submissions/')) {
        const s = getSubmission(inboxPath, path.slice('/submissions/'.length));
        return s ? send(res, 200, { id: s.id, status: s.status, ballotHash: s.ballotHash, reason: s.decision?.reason ?? null, convenedBallotHash: s.convenedBallotHash ?? null }) : send(res, 404, { error: 'not found' });
      }

      if (req.method === 'POST' && path === '/submit') {
        if (!bearer(req) || !tokenEq(bearer(req)!, cfg.submitToken)) return send(res, 401, { error: 'unauthorized' });
        if (!allowed(`submit:${ip}`)) return send(res, 429, { error: 'rate limited' });
        const raw = await readBody(req, res);
        if (raw === null) return; // 413 already sent by readBody on overflow
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
        const question = String(parsed.question ?? ''), context = String(parsed.context ?? '');
        if (question.length > cfg.limits.maxQuestionLen || context.length > cfg.limits.maxContextLen) return send(res, 413, { error: 'field too long' });
        const bh = ballotHash(question, context);
        const sig = screen({ question, context, ballotHash: bh }, corpus(), { minLen: 8, maxLen: cfg.limits.maxQuestionLen, nearDupThreshold: cfg.limits.nearDupThreshold }, !allowed(`subwin:${ip}`));
        const s = submit(inboxPath, { question, context, ballotHash: bh, screening: sig }, cfg.limits.inboxMaxBytes);
        return send(res, 200, { id: s.id, ballotHash: bh });
      }

      const isAdmin = bearer(req) && tokenEq(bearer(req)!, cfg.adminToken);
      if (path === '/inbox' || path.startsWith('/inbox/') || path === '/admin/publish') {
        if (!isAdmin) return send(res, 401, { error: 'unauthorized' });
      }
      if (req.method === 'GET' && path === '/inbox') return send(res, 200, { submissions: listInbox(inboxPath, (url.searchParams.get('status') as any) || undefined) });
      if (req.method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/decision')) {
        const id = path.slice('/inbox/'.length, -('/decision'.length));
        const raw = await readBody(req, res); if (raw === null) return; // 413 already sent
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(res, 400, { error: 'bad json' }); }
        const { decision, reason } = parsed;
        const s = decide(inboxPath, id, decision, reason);
        audit(auditPath, 'DECISION', { id, decision, reason: reason ?? null });
        return send(res, 200, { id: s.id, status: s.status });
      }
      if (req.method === 'POST' && path === '/admin/publish') {
        const raw = await readBody(req, res); if (raw === null) return; // 413 already sent
        let snap: Snapshot; try { snap = JSON.parse(raw) as Snapshot; } catch { return send(res, 400, { error: 'bad json' }); }
        const lp = materialize(snap.votesLog, 'votes.log')!;
        const staged = readLog(lp);
        const cur = ref ? readLog(materialize(readReleaseFile(data, ref, 'votes.log'), 'votes.log')!) : [];
        const r = verifyPublish({ staged, current: cur, checkpoint: readCheckpoint(data), keyring: cfg.pinnedKeyring, chainId: cfg.chainId, quorum: cfg.quorum });
        audit(auditPath, 'PUBLISH', { ok: r.ok, reason: r.reason ?? null, headHash: r.headHash, length: r.length });
        if (!r.ok) return send(res, 409, { error: r.reason });
        stageRelease(data, r.headHash, snap);
        commitRelease(data, r.headHash, { chainId: cfg.chainId, valid: true, length: r.length, headHash: r.headHash, verifiedAt: new Date().toISOString() });
        writeCheckpoint(data, { chainId: cfg.chainId, length: r.length, headHash: r.headHash, publishedAt: new Date().toISOString() });
        return send(res, 200, { headHash: r.headHash, length: r.length });
      }
      return send(res, 404, { error: 'not found' });
    } catch (e) {
      return send(res, 500, { error: (e as Error).message });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  server.maxConnections = 256;

  let bound = 0;
  return {
    listen: () => new Promise<void>((resolve) => server.listen(cfg.port, '0.0.0.0', () => { bound = (server.address() as any).port; resolve(); })),
    close: () => server.close(),
    port: () => bound,
  };
}
