// Quorumchain ($QRM) — Phase 1.4: the public auditable feed. A read-only projection of
// the hash-chained vote log into a feed of convenings an outsider can audit. It adds no
// trust: the chain validity, the signatures, and the 2/3 tally are all RECOMPUTED here
// from the same primitives anyone can run (verifyLog, ratify) over the same public log +
// pinned keyring. The feed exposes the autonomy; it does not vouch for it.
//
// buildFeed is a pure projection (reads the log, groups by ballot, recomputes ratify).
// renderFeedMarkdown is a human-readable view; the JSON object is the machine view.
// The CLI (publish-feed.ts) writes both to a committable, publishable location.

import { readLog, verifyLog } from './vote-log.ts';
import { ratify } from './signed-vote.ts';

export interface FeedConvening {
  ballotHash: string;
  ratified: boolean;
  verdict: string | null;
  required: number;
  tally: Record<string, number>;
  votes: { validatorId: string; verdict: string }[];
}

export interface Feed {
  chainValid: boolean;
  entryCount: number;
  convenings: FeedConvening[];
}

/** Project the vote log into a feed of convenings, oldest-first (chain order). The
 *  outcome of each is RECOMPUTED via ratify over the same keyring — never read from a
 *  stored result — so the feed cannot misreport a verdict the signatures don't support. */
export function buildFeed(logPath: string, keyring: Record<string, string>, quorum: number): Feed {
  const entries = readLog(logPath);
  const order: string[] = [];
  const byBallot = new Map<string, typeof entries[number]['vote'][]>();
  for (const e of entries) {
    const bh = e.vote.ballotHash;
    if (!byBallot.has(bh)) {
      byBallot.set(bh, []);
      order.push(bh);
    }
    byBallot.get(bh)!.push(e.vote);
  }
  const convenings: FeedConvening[] = order.map((bh) => {
    const votes = byBallot.get(bh)!;
    const r = ratify(bh, votes, keyring, quorum);
    return {
      ballotHash: bh,
      ratified: r.ratified,
      verdict: r.verdict,
      required: r.required,
      tally: r.tally,
      votes: votes.map((v) => ({ validatorId: v.validatorId, verdict: v.verdict })),
    };
  });
  return { chainValid: verifyLog(logPath).valid, entryCount: entries.length, convenings };
}

/** Human-readable feed: a header with the chain-validity proof and one row per convening. */
export function renderFeedMarkdown(feed: Feed): string {
  const lines = [
    '# Quorumchain — public convening feed',
    '',
    `**Chain validity:** ${feed.chainValid ? '✅ valid' : '❌ BROKEN'} · ${feed.entryCount} signed votes · ${feed.convenings.length} convenings`,
    '',
    '| # | ballot | outcome | tally | votes |',
    '|---|--------|---------|-------|-------|',
  ];
  feed.convenings.forEach((c, i) => {
    const outcome = c.ratified ? `✅ ${c.verdict}` : '— not ratified';
    const tally = Object.entries(c.tally).map(([k, n]) => `${k}:${n}`).join(' ');
    const votes = c.votes.map((v) => `${v.validatorId}=${v.verdict}`).join(' ');
    lines.push(`| ${i + 1} | \`${c.ballotHash.slice(0, 12)}\` | ${outcome} | ${tally} | ${votes} |`);
  });
  return lines.join('\n') + '\n';
}
