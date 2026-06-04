// Quorumchain ($QRM) — CIP-9 read surface, the human projection (round 58 guardrails).
// renderClaimMarkdown projects a ClaimView into a page where the stance SET is the body — every
// stance gets an IDENTICALLY-structured row (no headline/ordering hierarchy favoring the consensus
// stance, no demotion-to-footnote), the NI-9a receipt is always shown, support reads "not externally
// anchored" (never 0), and a missing statement shows the hash, never a fabricated title.
// renderIndexMarkdown reads per-status so a CONTESTED claim is never flattened to a winner-label.
// Pure strings, zero dependencies.

import type { ClaimView, StanceView } from './commons-read.ts';

function renderStance(s: StanceView): string {
  const who = s.validators.join(', ');
  const support = s.support === null ? 'not externally anchored' : String(s.support);
  // identical row structure for EVERY stance — equal structural weight (guardrail 1)
  return `- **${s.position}** — ${s.standing} · held by ${who} · panel votes: ${s.panelVotes} · support: ${support}`;
}

export function renderClaimMarkdown(view: ClaimView): string {
  const title = view.statement ?? `\`${view.ballotHash}\` — _statement not recorded (pre-registry)_`;
  const banner = view.chainValid
    ? '**Chain validity:** ✅ valid — recomputed from the signed log'
    : '**Chain validity:** ❌ BROKEN — log failed verification; this view may be tampered';
  return [
    `# ${title}`,
    '',
    banner,
    '',
    `**Status:** ${view.status}`,
    `**Ballot:** \`${view.ballotHash}\``,
    '',
    '## Stances (the epistemic state — not a single truth)',
    '',
    ...view.stances.map(renderStance),
    '',
    `**Panel-state receipt (NI-9a):** ${view.panelState.size} validators — ${view.panelState.validators.join(', ')}`,
    '',
    '_This page is a projection of the signed consensus log. It records the epistemic state — consensus, credible dissent, and the honest unknown — never a decree of truth._',
    '',
  ].join('\n');
}

/** One index row per claim. Per-status (guardrail 2): a non-RESOLVED claim reads as its status, never
 *  as a winner-label; a RESOLVED claim shows its consensus stance AND flags preserved dissent. */
function indexRow(view: ClaimView): string {
  const title = view.statement ?? `\`${view.ballotHash.slice(0, 12)}\``;
  // INDEX.md is written into docs/commons/ alongside the claim pages, so links are
  // same-directory relative — a `commons/`-prefix would resolve to docs/commons/commons/ (round 58, V1).
  const link = `./${view.ballotHash.slice(0, 12)}.md`;
  if (view.status === 'RESOLVED') {
    const consensus = view.stances.find((s) => s.standing === 'CONSENSUS');
    const dissent = view.stances.filter((s) => s.standing === 'CREDIBLE_MINORITY').length;
    const flag = dissent > 0 ? ` (+${dissent} credible dissent)` : '';
    return `| [${title}](${link}) | RESOLVED | ${consensus ? consensus.position : '—'}${flag} |`;
  }
  // CONTESTED / INDETERMINATE: read as the status with the count of stances — no winner-label
  return `| [${title}](${link}) | ${view.status} | ${view.stances.length} stances, no consensus |`;
}

export function renderIndexMarkdown(views: ClaimView[]): string {
  const allValid = views.every((v) => v.chainValid);
  const banner = allValid
    ? '**Chain validity:** ✅ valid — every page recomputed from the signed log'
    : '**Chain validity:** ❌ BROKEN — log failed verification';
  return [
    '# Quorumchain Knowledge Commons',
    '',
    banner,
    '',
    '_The epistemic state of every claim the panel has ruled on — consensus, credible dissent, and the honest unknown. Not a decree of truth._',
    '',
    '| claim | status | reading |',
    '|-------|--------|---------|',
    ...views.map(indexRow),
    '',
  ].join('\n');
}
