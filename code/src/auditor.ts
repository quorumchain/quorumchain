// Quorumchain ($QRM) — CIP-10 auditor production: the method-not-conclusion audit prompt
// (NI-AA1) and a defensive parser from CLI output to an UNSIGNED ContraryDossier. The host
// signs it afterwards (Task 11). Zero dependencies.

import { emptyDossier, type ContraryDossier, type ContraryAnchor, type SearchedRejectedAnchor } from './dossier.ts';
import type { AssessedWeight, FalsificationCondition } from './commons.ts';

const WEIGHTS: AssessedWeight[] = ['NEGLIGIBLE', 'WEAK', 'MATERIAL', 'DECISIVE'];

export function buildAuditPrompt(prompt: string, context: string, ratifiedVerdict: string): string {
  return [
    'You are the adversarial EVIDENCE AUDITOR for a ratified panel claim. Your job is METHOD, not conclusion:',
    'conduct a thorough, anchor-disciplined search for the strongest ANCHORED disconfirming evidence against the claim.',
    'You are an auditor / short-seller / adverse-event reviewer — NOT a debater. Do not manufacture doubt.',
    '"NEGLIGIBLE" (you searched hard and the strongest contrary anchor is crank-tier/absent) is a VALID, REWARDED finding.',
    'Contrary evidence must clear the SAME external-anchor bar that supporting evidence must clear; unanchored opinion does not count.',
    '',
    `CLAIM: ${prompt}`,
    `FROZEN CRITERIA / CONTEXT: ${context}`,
    `THE PANEL RATIFIED: ${ratifiedVerdict}`,
    '',
    'Output EXACTLY one fenced json block with this shape (omit nothing; use [] when empty):',
    '```json',
    '{',
    '  "assessedWeight": "NEGLIGIBLE|WEAK|MATERIAL|DECISIVE",',
    '  "contraryAnchors": [{"source":"","anchorType":"","claimItContradicts":""}],',
    '  "searchedRejectedAnchors": [{"source":"","whyRejected":""}],',
    '  "falsificationConditions": [{"towardVerdict":"","requiredAnchoredEvidence":""}],',
    '  "negligibleCoSigners": []',
    '}',
    '```',
    'If your weight is NEGLIGIBLE, you MUST populate searchedRejectedAnchors with the contrary sources you',
    'checked and the anchored reason each was rejected (this is your accountability trail).',
  ].join('\n');
}

function asArray<T>(v: unknown, map: (x: any) => T | null): T[] {
  if (!Array.isArray(v)) return [];
  return v.map(map).filter((x): x is T => x !== null);
}

export function parseAuditorOutput(raw: string, ballotHash: string, auditorId: string): ContraryDossier {
  const base = emptyDossier(ballotHash, auditorId);
  const m = raw.match(/```json\s*([\s\S]*?)```/);
  if (!m) {
    return { ...base, searchedRejectedAnchors: [{ source: '(none)', whyRejected: 'auditor produced no parseable dossier; recorded as a searched-empty result' }] };
  }
  let obj: any;
  try { obj = JSON.parse(m[1].trim()); } catch {
    return { ...base, searchedRejectedAnchors: [{ source: '(none)', whyRejected: 'auditor json did not parse; recorded as a searched-empty result' }] };
  }
  const weight: AssessedWeight = WEIGHTS.includes(obj.assessedWeight) ? obj.assessedWeight : 'NEGLIGIBLE';
  const contraryAnchors = asArray<ContraryAnchor>(obj.contraryAnchors, (a) =>
    a && typeof a.source === 'string' ? { source: a.source, anchorType: String(a.anchorType ?? ''), claimItContradicts: String(a.claimItContradicts ?? '') } : null);
  const searchedRejectedAnchors = asArray<SearchedRejectedAnchor>(obj.searchedRejectedAnchors, (r) =>
    r && typeof r.source === 'string' ? { source: r.source, whyRejected: String(r.whyRejected ?? '') } : null);
  const falsificationConditions = asArray<FalsificationCondition>(obj.falsificationConditions, (f) =>
    f && typeof f.towardVerdict === 'string' ? { towardVerdict: f.towardVerdict, requiredAnchoredEvidence: String(f.requiredAnchoredEvidence ?? '') } : null);
  const negligibleCoSigners = asArray<string>(obj.negligibleCoSigners, (s) => (typeof s === 'string' ? s : null));
  return { ...base, assessedWeight: weight, contraryAnchors, searchedRejectedAnchors, falsificationConditions, negligibleCoSigners };
}
