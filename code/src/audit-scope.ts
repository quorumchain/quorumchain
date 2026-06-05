// Quorumchain ($QRM) — CIP-10 §5 / NI-AA9: audit eligibility is a DETERMINISTIC function of
// on-chain state, not auditor/operator discretion. Recorded before dossiers, replayable.
// Pure. Zero dependencies.

import type { EpistemicType } from './commons.ts';

export interface ScopeClaim {
  ballotHash: string;
  epistemicType: EpistemicType | null; // frozen in the ballot (CIP-13 NI-13h) — never set at audit time
  unanimousSubstantive: boolean;        // all counted votes agree on one substantive verdict (no dissent)
}

export interface ScopeEntry { ballotHash: string; rule: 1 | 2 }
export interface AuditScope { inScope: ScopeEntry[] }

/** `anchoredContraryRefs`: set of ballotHashes that have ≥1 anchored contrary reference already
 *  in the log (computed by the caller from the registry: any ballot whose meta.supersedes points
 *  here AND carries meta.anchors). Rule 1: type ≠ SETTLED. Rule 2: unanimous + anchored-contrary. */
export function computeAuditScope(claims: ScopeClaim[], anchoredContraryRefs: Set<string>): AuditScope {
  const inScope: ScopeEntry[] = [];
  for (const c of claims) {
    if (c.epistemicType !== 'SETTLED') inScope.push({ ballotHash: c.ballotHash, rule: 1 });
    else if (c.unanimousSubstantive && anchoredContraryRefs.has(c.ballotHash)) inScope.push({ ballotHash: c.ballotHash, rule: 2 });
  }
  inScope.sort((a, b) => (a.ballotHash < b.ballotHash ? -1 : a.ballotHash > b.ballotHash ? 1 : 0));
  return { inScope };
}

export function renderScopeRecord(scope: AuditScope): string {
  const lines = ['# Audit scope (CIP-10 NI-AA9 — deterministic, replayable)', '',
    '_Which claims are audit-eligible, and which on-chain rule matched. Rule 1 = type ≠ SETTLED; rule 2 = unanimous + anchored contrary reference._', ''];
  if (scope.inScope.length === 0) { lines.push('_No claims in scope._', ''); return lines.join('\n'); }
  lines.push('| claim | rule |', '|-------|------|');
  for (const s of scope.inScope) lines.push(`| \`${s.ballotHash.slice(0, 12)}\` | rule ${s.rule} |`);
  lines.push('');
  return lines.join('\n');
}
