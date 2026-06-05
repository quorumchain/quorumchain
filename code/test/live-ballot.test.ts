import { test } from 'node:test';
import assert from 'node:assert/strict';
import { liveConveneArgs } from '../src/live-ballot.ts';
import type { Ballot } from '../src/queue.ts';

// CIP-13 wiring through the autonomous path: a queued ballot may DECLARE an epistemic
// type / supersede / contrary-evidence dossier. liveConveneArgs is the seam that maps a
// queue Ballot to the CIP-13/CIP-10 inputs convene() consumes — so an autonomously
// convened ballot lands its declared type in the registry (and thus the read surface +
// reviewQueue), exactly as a manual run-panel convene does. liveRunBallot itself spawns
// real signer hosts and is integration-only; this tests the pure forwarding it relies on.

test('liveConveneArgs forwards a queued ballot CIP-13 meta + CIP-10 dossier to convene', () => {
  const ballot: Ballot = {
    prompt: 'Is BTC dominance above 50% right now?',
    context: 'as of the drain',
    verdicts: ['YES', 'NO'],
    meta: { epistemicType: 'EMPIRICAL_LIVE', evidenceTime: 1700 },
    dossier: { ballotHash: 'x', auditorId: 'V2', assessedWeight: 'MATERIAL', falsificationConditions: [] },
  };
  const args = liveConveneArgs(ballot);
  assert.deepEqual(args.verdicts, ['YES', 'NO']);
  assert.deepEqual(args.meta, { epistemicType: 'EMPIRICAL_LIVE', evidenceTime: 1700 });
  assert.equal(args.dossier?.assessedWeight, 'MATERIAL');
});

test('liveConveneArgs invents nothing for a bare ballot (no CIP-13 inputs fabricated)', () => {
  const args = liveConveneArgs({ prompt: 'ship it?' });
  assert.equal(args.verdicts, undefined);
  assert.equal(args.meta, undefined);
  assert.equal(args.dossier, undefined);
});
