// Quorumchain ($QRM) — DELIBERATING RemoteSigner host (runs as a SEPARATE OS process).
// This is the production host the round-47 panel voted to wire in (WIRE_NOW 2/1): it
// closes OS-level key custody on the LIVE convening path without the regression the
// env-stub host (remote-signer-host.ts, kept only as a test fixture) would cause.
//
// Child-side, and ONLY child-side, it: (1) holds the validator's keystore key — the
// private half never enters the orchestrator; (2) builds the ballot prompt; (3) runs
// the validator's REAL invoker (V1→claude, V2→codex, V3→hermes — each its own CLI);
// (4) parses the verdict; (5) derives the ballot hash from content (round-45 binding);
// (6) signs. The orchestrator supplies NO verdict and holds NO key — the round-47
// binding condition. A child-side invocation failure becomes a signed NO_VERDICT
// (mirrors the local safe() wrapper), so a dead CLI never crashes the convening.
//
// Phase 0.1 (round 48 AUTONOMY_FIRST): V1 now deliberates autonomously via the `claude`
// CLI in its own host process — no human-pasted file — so all three are symmetric and
// no human is in the loop. This file is only ever SPAWNED.

import { createInterface } from 'node:readline';
import { ballotHash, signVote } from './signed-vote.ts';
import { loadOrCreateKeyring } from './keystore.ts';
import { invokerFor } from './invokers.ts';
import { buildPrompt, parseVerdict } from './panel.ts';

const validatorId = process.env.QRM_VALIDATOR_ID ?? 'V?';
const keystoreDir = process.env.QRM_KEYSTORE_DIR;
if (!keystoreDir) throw new Error('deliberating host requires QRM_KEYSTORE_DIR (stable validator identity)');
const key = loadOrCreateKeyring(keystoreDir, [validatorId]).keys[validatorId]; // private half lives ONLY here
const invoke = invokerFor(validatorId);

const rl = createInterface({ input: process.stdin });
rl.on('line', (line) => {
  let req: { id?: number; type?: string; prompt?: string; context?: string; verdicts?: string[] };
  try {
    req = JSON.parse(line);
  } catch {
    return; // ignore malformed input
  }
  void (async () => {
    let res: Record<string, unknown>;
    if (req.type === 'pubkey') {
      res = { publicKeyPem: key.publicKeyPem }; // public half only — never the private key
    } else if (req.type === 'sign') {
      const prompt = req.prompt ?? '';
      const context = req.context ?? '';
      // Deliberate CHILD-SIDE over the same content the hash binds. A CLI failure
      // becomes a NO_VERDICT (parsed from the error marker), never a fabricated vote.
      let rawOutput: string;
      try {
        rawOutput = await invoke(buildPrompt(prompt, context, req.verdicts));
      } catch (e) {
        rawOutput = `INVOCATION_ERROR (${validatorId}): ${(e as Error).message}`;
      }
      const verdict = parseVerdict(rawOutput); // decided here, not by the orchestrator
      const bh = ballotHash(prompt, context); // derived here, not caller-supplied
      res = { vote: signVote({ validatorId, privateKeyPem: key.privateKeyPem, ballotHash: bh, verdict, rawOutput }) };
    } else {
      res = { error: 'unknown request type' }; // there is NO request that returns the private key or sets a verdict
    }
    process.stdout.write(JSON.stringify({ id: req.id, ...res }) + '\n');
  })();
});
