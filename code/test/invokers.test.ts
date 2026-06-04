// Validator invokers extracted from run-panel so the DELIBERATING RemoteSigner host
// can run them child-side. Phase 0.1: V1 now deliberates AUTONOMOUSLY by shelling out
// to the `claude` CLI (no human-pasted file), symmetric with V2→codex, V3→hermes.
// The security-relevant property: invokerFor maps ONLY the three real validators to
// their real CLIs and throws on anything else — there is no env-supplied verdict path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { invokerFor } from '../src/invokers.ts';

// A fake CLI on PATH lets us exercise a real shell-out invoker deterministically,
// without calling the paid/nondeterministic model (same idea as the silent-host fixture).
function withFakeCli(name: string, body: string, fn: () => Promise<void>): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), 'qrm-bin-'));
    writeFileSync(join(dir, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
    const orig = process.env.PATH;
    process.env.PATH = `${dir}:${orig}`;
    try {
      await fn();
    } finally {
      process.env.PATH = orig;
    }
  };
}

test(
  "V1's invoker shells out to the claude CLI for autonomous deliberation (no human paste)",
  withFakeCli('claude', 'echo "V1 reasoned autonomously"; echo "VERDICT: WIRE_NOW"', async () => {
    const out = await invokerFor('V1')('the full ballot prompt');
    assert.match(out, /VERDICT: WIRE_NOW/); // the verdict came from the CLI, child-side
    assert.match(out, /reasoned autonomously/);
  }),
);

test('V1, V2 and V3 all map to real CLI invokers (functions), not env stand-ins', () => {
  for (const id of ['V1', 'V2', 'V3']) assert.equal(typeof invokerFor(id), 'function');
});

test('invokerFor throws for any non-validator id — there is NO env-verdict fallback', () => {
  assert.throws(() => invokerFor('VX'), /no invoker|unknown validator/i);
});
