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

// CIP-13 (ballot 3729cc2e): how a verdict is presented along the TIME axis, by its
// frozen epistemic type. SETTLED is durable; EMPIRICAL_LIVE is provisional / as-of /
// open to anchored re-adjudication (NI-13c — the COVID/myocarditis fix); NORMATIVE is
// the panel's majority position as of D, conventional not true (NI-13f). Untyped
// (legacy) renders nothing — the type is never inferred (NI-13a).
function renderEpistemic(view: ClaimView): string[] {
  if (!view.epistemicType) return []; // null (untyped) or absent — never infer a type (NI-13a)
  const prov = view.typeRatified ? ' _(panel-ratified)_' : ''; // CIP-13 v0.3 provenance
  const asOf = `as of ${view.evidenceTime}`;
  const line =
    view.epistemicType === 'SETTLED'
      ? `**Epistemic type:** SETTLED${prov} — durable (${asOf}).`
      : view.epistemicType === 'EMPIRICAL_LIVE'
        ? `**Epistemic type:** EMPIRICAL_LIVE${prov} — provisional, ${asOf}; open to anchored re-adjudication, never settled-for-all-time.`
        : `**Epistemic type:** NORMATIVE${prov} — the panel's majority position ${asOf} (conventional, not truth — CIP-7 NI-6); dissent stays first-class.`;
  return [line, ''];
}

// CIP-13 v0.2 (§5): surface the CIP-10 auditor's contrary-evidence weight and the
// falsification conditions — WHAT anchored evidence would warrant re-adjudication.
// MATERIAL/DECISIVE on an EMPIRICAL_LIVE claim flags it as a re-adjudication candidate.
// Descriptive only (NI-12b): this records what the auditor found; it decrees nothing.
function renderFalsification(view: ClaimView): string[] {
  if (!view.contraryWeight && (!view.falsificationConditions || view.falsificationConditions.length === 0)) return [];
  const out: string[] = [];
  if (view.contraryWeight) {
    const candidate = view.epistemicType === 'EMPIRICAL_LIVE' && (view.contraryWeight === 'MATERIAL' || view.contraryWeight === 'DECISIVE');
    out.push(`**Contrary-evidence weight (CIP-10 auditor):** ${view.contraryWeight}${candidate ? ' — flagged as a re-adjudication candidate' : ''}.`, '');
  }
  if (view.falsificationConditions && view.falsificationConditions.length > 0) {
    out.push('### Falsification conditions (what anchored evidence would warrant re-adjudication)', '');
    for (const f of view.falsificationConditions) out.push(`- toward **${f.towardVerdict}**: ${f.requiredAnchoredEvidence}`);
    out.push('');
  }
  return out;
}

// CIP-13 NI-13d: a re-adjudicated claim shows its supersession history — what was
// held before and why it changed — never deleted. Rendered only when a lineage exists.
function renderLineage(view: ClaimView): string[] {
  const pending = view.lineage?.pendingReview ?? [];
  if (!view.lineage || (view.lineage.priorVersions.length === 0 && pending.length === 0)) return [];
  const out: string[] = [];
  if (view.lineage.priorVersions.length > 0) {
    const isCurrent = view.lineage.current === view.ballotHash;
    out.push(
      isCurrent
        ? '**Re-adjudication:** this is the *current* verdict in its lineage; prior versions are retained below (never deleted).'
        : `**Re-adjudication:** superseded — the current verdict in this lineage is \`${view.lineage.current.slice(0, 12)}\`. This version is retained for the record.`,
      '',
      '### Prior versions (retained, never deleted)',
      '',
      ...view.lineage.priorVersions.map(
        (p) => `- \`${p.ballotHash.slice(0, 12)}\` — verdict ${p.verdict ?? '—'} · as of ${p.evidenceTime}${p.supersededReason ? ` · reason: ${p.supersededReason}` : ''}`,
      ),
      '',
    );
  }
  // CIP-15 NI-15b: gate-cleared supersedes awaiting content verification — the head has NOT moved.
  if (pending.length > 0) {
    out.push(
      `**⏳ Re-adjudication pending content verification (CIP-15 NI-15b):** ${pending.length} supersede(s) cleared the structural anchor gate and are admitted to content review — but the current verdict has **NOT** changed (structural admissibility is never content confirmation; head movement awaits the deferred content layer).`,
      '',
      ...pending.map((bh) => `- \`${bh.slice(0, 12)}\` — anchor-structurally-admissible, content-verification-pending`),
      '',
    );
  }
  return out;
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
    ...renderEpistemic(view),
    `## Stances (the epistemic state — not a single truth)`,
    '',
    ...view.stances.map(renderStance),
    '',
    ...renderFalsification(view),
    ...renderLineage(view),
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
