// Quorumchain ($QRM) — deterministic submission screening signals (spec §10). Zero AI
// inference: well-formedness + exact-duplicate (by ballotHash) + near-duplicate (Jaccard
// over normalized token shingles vs the existing corpus) + a passed-in rate flag. Nothing
// auto-rejects; the operator decides. Zero dependencies.

import type { Signals } from './inbox.ts';

export function tokens(s: string): string[] {
  return s.toLowerCase().normalize('NFC').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}
export function shingles(s: string, k = 3): Set<string> {
  const t = tokens(s);
  if (t.length < k) return new Set(t.length ? [t.join(' ')] : []);
  const out = new Set<string>();
  for (let i = 0; i + k <= t.length; i++) out.add(t.slice(i, i + k).join(' '));
  return out;
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface ScreenOpts { minLen: number; maxLen: number; nearDupThreshold: number }
export interface Corpus { prompts: string[]; hashes: string[] }

export function screen(
  input: { question: string; context: string; ballotHash: string },
  corpus: Corpus,
  opts: ScreenOpts,
  rateFlagged: boolean,
): Signals {
  const q = input.question.trim();
  const tks = tokens(`${input.question} ${input.context}`);
  const lengthOk = q.length >= opts.minLen && q.length <= opts.maxLen;
  const wellFormed = q.length > 0 && lengthOk;
  const exactDuplicate = corpus.hashes.includes(input.ballotHash);

  const mine = shingles(`${input.question} ${input.context}`);
  let nearestHash: string | null = null;
  let similarity = 0;
  for (let i = 0; i < corpus.prompts.length; i++) {
    const sim = jaccard(mine, shingles(corpus.prompts[i]));
    if (sim > similarity) { similarity = sim; nearestHash = corpus.hashes[i] ?? null; }
  }
  // nearestHash/similarity always report the closest corpus match; the operator (and the
  // opts.nearDupThreshold the server uses for flagging) decide what counts as "too similar".
  return { wellFormed, lengthOk, tokenCount: tks.length, exactDuplicate, nearestHash, similarity, rateFlagged };
}
