import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ClaimView } from '../src/commons-read.ts';
import { renderClaimMarkdown, renderIndexMarkdown } from '../src/commons-render.ts';

const resolved: ClaimView = {
  ballotHash: 'abc123def456',
  statement: 'Did X occur?',
  status: 'RESOLVED',
  stances: [
    { position: 'YES', standing: 'CONSENSUS', validators: ['V1', 'V2'], panelVotes: 2, support: null },
    { position: 'NO', standing: 'CREDIBLE_MINORITY', validators: ['V3'], panelVotes: 1, support: null },
  ],
  panelState: { validators: ['V1', 'V2', 'V3'], size: 3 },
  chainValid: true,
};

// --- renderClaimMarkdown: the round-58 presentation guardrails ---

test('a RESOLVED page shows BOTH stances at equal structural weight (dissent not omitted/demoted)', () => {
  const md = renderClaimMarkdown(resolved);
  assert.match(md, /^- \*\*YES\*\* — CONSENSUS/m);
  assert.match(md, /^- \*\*NO\*\* — CREDIBLE_MINORITY/m); // identical row structure → equal weight
  assert.ok(md.includes('V3')); // the dissenter is named, not flattened
});

test('support renders as "not externally anchored", never 0 (NI-9b)', () => {
  const md = renderClaimMarkdown(resolved);
  assert.match(md, /not externally anchored/);
  assert.doesNotMatch(md, /support:\s*0\b/);
});

test('the NI-9a panel-state receipt is always present', () => {
  assert.match(renderClaimMarkdown(resolved), /panel-state.*V1.*V2.*V3/is);
});

test('an INDETERMINATE claim renders raw plurality, all UNRANKED, never "FRINGE"', () => {
  const indet: ClaimView = {
    ballotHash: 'h', statement: 'Unknowable?', status: 'INDETERMINATE',
    stances: [
      { position: 'YES', standing: 'UNRANKED', validators: ['V1'], panelVotes: 1, support: null },
      { position: 'NO', standing: 'UNRANKED', validators: ['V2'], panelVotes: 1, support: null },
    ],
    panelState: { validators: ['V1', 'V2'], size: 2 }, chainValid: true,
  };
  const md = renderClaimMarkdown(indet);
  assert.doesNotMatch(md, /FRINGE/);
  assert.match(md, /INDETERMINATE/);
});

test('a statement-less (pre-registry) claim shows the hash + "statement not recorded", never a fake title', () => {
  const md = renderClaimMarkdown({ ...resolved, statement: null });
  assert.match(md, /statement not recorded/);
  assert.match(md, /abc123def456/);
});

test('a tampered log (chainValid false) renders a tamper banner', () => {
  const md = renderClaimMarkdown({ ...resolved, chainValid: false });
  assert.match(md, /❌|tamper|BROKEN/i);
});

// --- renderIndexMarkdown: no single-truth index ---

const contested: ClaimView = {
  ballotHash: 'c0ntested000', statement: 'Disputed?', status: 'CONTESTED',
  stances: [
    { position: 'YES', standing: 'UNRANKED', validators: ['V1'], panelVotes: 1, support: null },
    { position: 'NO', standing: 'UNRANKED', validators: ['V2'], panelVotes: 1, support: null },
  ],
  panelState: { validators: ['V1', 'V2'], size: 2 }, chainValid: true,
};

test('the index shows a CONTESTED claim AS contested, never as a winner-label (guardrail 2)', () => {
  const md = renderIndexMarkdown([resolved, contested]);
  assert.match(md, /Disputed\?.*CONTESTED/s);
  assert.match(md, /Did X occur\?.*RESOLVED/s);
});

test('the index carries the chain-validity banner', () => {
  assert.match(renderIndexMarkdown([resolved]), /Chain validity/);
  assert.match(renderIndexMarkdown([{ ...resolved, chainValid: false }]), /❌|BROKEN/);
});
