// Quorumchain ($QRM) — HTTP transport for the deployable node (spec §7/§11). Node built-in
// http only. Enforces: bearer auth (timing-safe), body-size cap (413), per-IP+token rate
// limit, request/idle timeouts, connection cap. Routes to the pure handlers + inbox + the
// publish gate. NEVER holds validator keys. Zero dependencies.

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { join } from 'node:path';
import { readLog, verifyEntries } from './vote-log.ts';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import type { NodeConfig } from './node-config.ts';
import { currentRelease, stageRelease, commitRelease, writeCheckpoint, readCheckpoint, readReleaseFile, type Snapshot } from './release-store.ts';
import { verifyPublish } from './publish-verify.ts';
import { handleHealth, handleVerify, handleLog, handleBallot, handleCommons, VALID_HASH } from './node-handlers.ts';
import { submit, listInbox, getSubmission, decide, markConvened } from './inbox.ts';
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
// Resolve the single rate-limit "client IP". X-Forwarded-For is forgeable by any client, so
// it is honored ONLY when the immediate socket peer is a configured trusted proxy; otherwise
// it is ignored entirely and we key on the socket IP. When trusted, we take the RIGHTMOST XFF
// entry — the address the trusted proxy itself observed for its immediate peer. A standards-
// compliant proxy APPENDS the connecting client to the right, so a client that pre-seeds a
// spoofed `X-Forwarded-For: victim` only pollutes the LEFT; the rightmost remains the value the
// trusted proxy added. (We trust exactly ONE hop — the immediate proxy — which is the deploy
// model here: one website-backend proxy fronts the node.) A blank XFF falls back to socket IP.
function clientIp(req: IncomingMessage, trustedProxies: string[]): string {
  const socketIp = req.socket.remoteAddress ?? 'unknown';
  if (!trustedProxies.includes(socketIp)) return socketIp;
  const xff = req.headers['x-forwarded-for'];
  const raw = Array.isArray(xff) ? xff[xff.length - 1] : xff; // multiple XFF headers: last header
  const parts = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : socketIp; // rightmost entry = proxy's own peer
}
function sendRaw(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...extra });
  res.end(JSON.stringify(body));
}
function materialize(content: string | null, name: string): string | null {
  if (content === null) return null;
  const p = join(mkdtempSync(join(tmpdir(), 'qrm-mz-')), name);
  writeFileSync(p, content);
  return p;
}

export interface NodeHandle { listen(): Promise<void>; close(): void; port(): number; rateMapSize(): number }

export function createNode(cfg: NodeConfig, getMode: () => 'live' | 'degraded' = () => 'live'): NodeHandle {
  const data = cfg.dataDir;
  const inboxPath = join(data, 'inbox.jsonl');
  const auditPath = join(data, 'audit.jsonl');
  const rate = new Map<string, number[]>();
  // Bound the rate map so a public node can't be made to grow it without limit (one key per
  // distinct client IP x bucket). The Map is kept in least-recently-used order: every access
  // DELETES then re-SETS its key, so the most-recently-touched key is always last and the
  // least-recently-touched is always first. Three bounds: (1) a key whose timestamps have all
  // aged past the window is dropped on access; (2) a periodic full sweep drops every stale key;
  // (3) a HARD CAP enforced on EVERY insertion of a new key — when at the cap we evict the
  // least-recently-used key BEFORE inserting, so the cap holds even within a single window
  // (an evicted client simply gets a fresh window next time — fail-open, never a crash).
  const RATE_MAP_MAX = 100_000;
  let lastSweep = Date.now();
  const sweepRate = (now: number): void => {
    for (const [k, arr] of rate) {
      const live = arr.filter((t) => now - t < cfg.limits.rateWindowMs);
      if (live.length === 0) rate.delete(k);
      else rate.set(k, live);
    }
  };

  const allowed = (key: string): boolean => {
    const now = Date.now();
    // Periodic full sweep (at most once per window) reclaims keys for clients that fell silent.
    if (now - lastSweep >= cfg.limits.rateWindowMs) { sweepRate(now); lastSweep = now; }
    const existing = rate.get(key);
    const arr = (existing ?? []).filter((t) => now - t < cfg.limits.rateWindowMs);
    arr.push(now);
    // Refresh LRU order: delete first so re-set moves this key to the most-recent (last) slot.
    rate.delete(key);
    // Hard cap on a genuinely NEW key (one not already present): evict the LRU (first) key(s)
    // until there is room. Enforced here — not only in the periodic sweep — so a burst of
    // distinct keys within one window cannot exceed the cap.
    if (existing === undefined) {
      while (rate.size >= RATE_MAP_MAX) {
        const lru = rate.keys().next().value as string | undefined;
        if (lru === undefined) break;
        rate.delete(lru);
      }
    }
    rate.set(key, arr);
    return arr.length <= cfg.limits.rateMaxPerWindow;
  };

  // On overflow we send 413 ourselves, FLUSH it, then destroy the request stream (spec §11:
  // body cap returns 413 and destroys the stream). Destroying before the response is flushed
  // resets the socket and the client never sees the 413, so respond-then-destroy is required.
  const readBody = (req: IncomingMessage, res: ServerResponse, cors: Record<string, string> = {}): Promise<string | null> =>
    new Promise((resolve) => {
      let size = 0; const chunks: Buffer[] = []; let over = false;
      req.on('data', (c: Buffer) => {
        if (over) return;
        size += c.length;
        if (size > cfg.limits.maxBodyBytes) {
          over = true;
          res.writeHead(413, { 'content-type': 'application/json', connection: 'close', ...cors });
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

  // CORS (config-gated). When QRM_ALLOWED_ORIGINS is unset the allowlist is empty and NO CORS
  // header is ever emitted — byte-for-byte the prior behavior. An origin is allowed iff it
  // EXACTLY matches an allowlist entry; there is no wildcard branch. We also never echo a
  // literal '*' as the Origin (even if a non-browser client sends `Origin: *` and '*' was
  // listed), so a blanket '*' is never emitted and an allowlisted node stays a strict
  // allowlist. We echo the specific request Origin, never a blanket '*'.
  const allowlist = cfg.allowedOrigins ?? [];
  const corsFor = (req: IncomingMessage): Record<string, string> => {
    const origin = req.headers.origin;
    if (!origin || origin === '*' || allowlist.length === 0) return {};
    if (allowlist.includes(origin)) return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
    return {};
  };

  const server: Server = createServer(async (req, res) => {
    const cors = corsFor(req);
    const send = (status: number, body: unknown) => sendRaw(res, status, body, cors);
    const reply = (out: { status: number; body: any }) => send(out.status, out.body);
    try {
      const url = new URL(req.url ?? '/', 'http://x');
      const path = url.pathname;
      const ip = clientIp(req, cfg.trustedProxies);
      const mode = getMode();
      const ref = currentRelease(data);

      // CORS preflight: short-circuit with 204 ONLY when CORS is actually enabled for THIS
      // request (i.e. the Origin is allowlisted, so `cors` is non-empty). It carries no auth,
      // so this allowed-origin branch MUST precede auth/rate checks. When CORS is off or the
      // origin is not allowlisted, OPTIONS falls through to the SAME default routing as before
      // this change (404 / 401 on admin paths / 503 when no chain or degraded) — byte-identical.
      if (req.method === 'OPTIONS' && Object.keys(cors).length) {
        res.writeHead(204, { ...cors, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Max-Age': '86400' });
        return res.end();
      }

      if (req.method === 'GET' && path === '/healthz') return send(200, handleHealth(data, ref, mode).body);
      if (mode === 'degraded' && (path === '/submit' || path.startsWith('/admin') || path.startsWith('/inbox')))
        return send(503, { error: 'degraded: chain invalid' });
      if (!ref && path !== '/admin/publish') return send(503, { error: 'no chain published yet' });

      if (req.method === 'GET' && path === '/chain/verify') return send(200, handleVerify(data, ref).body);
      if (req.method === 'GET' && path === '/commons') return reply(handleCommons(data, ref));
      if (req.method === 'GET' && path.startsWith('/commons/')) return reply(handleCommons(data, ref, path.slice('/commons/'.length)));
      if (req.method === 'GET' && path.startsWith('/ballot/')) return reply(handleBallot(data, ref, path.slice('/ballot/'.length)));
      if (req.method === 'GET' && path === '/log') return reply(handleLog(data, ref, Number(url.searchParams.get('from') ?? 0), Math.min(Number(url.searchParams.get('limit') ?? 100), 500)));
      if (req.method === 'GET' && path.startsWith('/submissions/')) {
        const s = getSubmission(inboxPath, path.slice('/submissions/'.length));
        return s ? send(200, { id: s.id, status: s.status, ballotHash: s.ballotHash, reason: s.decision?.reason ?? null, convenedBallotHash: s.convenedBallotHash ?? null }) : send(404, { error: 'not found' });
      }

      if (req.method === 'POST' && path === '/submit') {
        if (!bearer(req) || !tokenEq(bearer(req)!, cfg.submitToken)) return send(401, { error: 'unauthorized' });
        if (!allowed(`submit:${ip}`)) return send(429, { error: 'rate limited' });
        const raw = await readBody(req, res, cors);
        if (raw === null) return; // 413 already sent by readBody on overflow
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(400, { error: 'bad json' }); }
        const question = String(parsed.question ?? ''), context = String(parsed.context ?? '');
        if (question.length > cfg.limits.maxQuestionLen || context.length > cfg.limits.maxContextLen) return send(413, { error: 'field too long' });
        const bh = ballotHash(question, context);
        const sig = screen({ question, context, ballotHash: bh }, corpus(), { minLen: 8, maxLen: cfg.limits.maxQuestionLen, nearDupThreshold: cfg.limits.nearDupThreshold }, !allowed(`subwin:${ip}`));
        const s = submit(inboxPath, { question, context, ballotHash: bh, screening: sig }, cfg.limits.inboxMaxBytes);
        return send(200, { id: s.id, ballotHash: bh });
      }

      const isAdmin = bearer(req) && tokenEq(bearer(req)!, cfg.adminToken);
      if (path === '/inbox' || path.startsWith('/inbox/') || path === '/admin/publish') {
        if (!isAdmin) return send(401, { error: 'unauthorized' });
      }
      if (req.method === 'GET' && path === '/inbox') return send(200, { submissions: listInbox(inboxPath, (url.searchParams.get('status') as any) || undefined) });
      if (req.method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/decision')) {
        const id = path.slice('/inbox/'.length, -('/decision'.length));
        const raw = await readBody(req, res, cors); if (raw === null) return; // 413 already sent
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(400, { error: 'bad json' }); }
        const { decision, reason } = parsed;
        const s = decide(inboxPath, id, decision, reason);
        audit(auditPath, 'DECISION', { id, decision, reason: reason ?? null });
        return send(200, { id: s.id, status: s.status });
      }
      if (req.method === 'POST' && path.startsWith('/inbox/') && path.endsWith('/convened')) {
        const id = path.slice('/inbox/'.length, -('/convened'.length));
        const raw = await readBody(req, res, cors); if (raw === null) return; // 413 already sent
        let parsed: any; try { parsed = JSON.parse(raw); } catch { return send(400, { error: 'bad json' }); }
        const { convenedBallotHash } = parsed;
        if (typeof convenedBallotHash !== 'string' || !VALID_HASH.test(convenedBallotHash)) return send(400, { error: 'invalid convenedBallotHash' });
        let s; try { s = markConvened(inboxPath, id, convenedBallotHash); } catch (e) { return send(409, { error: (e as Error).message }); }
        audit(auditPath, 'DECISION', { id, decision: 'CONVENE', convenedBallotHash });
        return send(200, { id: s.id, status: s.status, convenedBallotHash: s.convenedBallotHash });
      }
      if (req.method === 'POST' && path === '/admin/publish') {
        const raw = await readBody(req, res, cors); if (raw === null) return; // 413 already sent
        let snap: Snapshot; try { snap = JSON.parse(raw) as Snapshot; } catch { return send(400, { error: 'bad json' }); }
        const lp = materialize(snap.votesLog, 'votes.log')!;
        const staged = readLog(lp);
        const cur = ref ? readLog(materialize(readReleaseFile(data, ref, 'votes.log'), 'votes.log')!) : [];
        const r = verifyPublish({ staged, current: cur, checkpoint: readCheckpoint(data), keyring: cfg.pinnedKeyring, chainId: cfg.chainId, quorum: cfg.quorum });
        audit(auditPath, 'PUBLISH', { ok: r.ok, reason: r.reason ?? null, headHash: r.headHash, length: r.length });
        if (!r.ok) return send(409, { error: r.reason });
        try { stageRelease(data, r.headHash, snap); } catch (e) { audit(auditPath, 'PUBLISH', { ok: false, reason: (e as Error).message, headHash: r.headHash, length: r.length }); return send(409, { error: (e as Error).message }); }
        // Re-verify the staged votes.log ON DISK (defends NI-D3/NI-D6 against a commons write that
        // overwrote the just-verified log): it must be intact AND its head must still equal r.headHash.
        const stagedRef = { headHash: r.headHash, dir: join(data, 'releases', r.headHash) };
        const slp = materialize(readReleaseFile(data, stagedRef, 'votes.log'), 'votes.log');
        const sEntries = slp ? readLog(slp) : [];
        const sHead = sEntries.length ? sEntries[sEntries.length - 1].entryHash : '0'.repeat(64);
        if (!verifyEntries(sEntries).valid || sHead !== r.headHash) {
          audit(auditPath, 'PUBLISH', { ok: false, reason: 'staged votes.log re-verification failed', headHash: r.headHash, length: r.length });
          return send(409, { error: 'staged votes.log re-verification failed' });
        }
        commitRelease(data, r.headHash, { chainId: cfg.chainId, valid: true, length: r.length, headHash: r.headHash, verifiedAt: new Date().toISOString() });
        writeCheckpoint(data, { chainId: cfg.chainId, length: r.length, headHash: r.headHash, publishedAt: new Date().toISOString() });
        return send(200, { headHash: r.headHash, length: r.length });
      }
      return send(404, { error: 'not found' });
    } catch (e) {
      return send(500, { error: (e as Error).message });
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
    rateMapSize: () => rate.size,
  };
}
