// Quorumchain ($QRM) — append-only operator audit log (spec §11). Admin decisions and
// publish attempts are recorded as events, never silent mutations. Zero dependencies.

import { appendFileSync, readFileSync, existsSync } from 'node:fs';

export type AuditKind = 'DECISION' | 'PUBLISH';
export interface AuditEvent { version: 1; at: string; kind: AuditKind; detail: Record<string, unknown> }

export function audit(path: string, kind: AuditKind, detail: Record<string, unknown>): void {
  const ev: AuditEvent = { version: 1, at: new Date().toISOString(), kind, detail };
  appendFileSync(path, JSON.stringify(ev) + '\n');
}
export function readAudit(path: string): AuditEvent[] {
  if (!existsSync(path)) return [];
  const txt = readFileSync(path, 'utf8').trim();
  return txt ? txt.split('\n').map((l) => JSON.parse(l) as AuditEvent) : [];
}
