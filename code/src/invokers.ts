// Quorumchain ($QRM) — the real validator invokers (extracted from run-panel so the
// DELIBERATING RemoteSigner host can run them CHILD-SIDE). Each turns the full ballot
// prompt into a validator's VERBATIM output by shelling out to that validator's own
// CLI: V1→claude, V2→codex, V3→hermes. Phase 0.1 (round 48 AUTONOMY_FIRST) made V1
// autonomous: it now invokes the `claude` CLI in non-interactive print mode in its own
// host process — NOT a human-pasted file — so all three deliberate symmetrically with
// no human in the loop. (The orchestrator cannot subprocess itself, but a host process
// running `claude -p` is a fresh, separate invocation.)
//
// SECURITY (round-47 binding condition): invokerFor maps ONLY V1/V2/V3 to their real
// CLI and throws on anything else. There is no env-supplied verdict path — the
// validator's CLI is resolved via PATH (the same trust model as codex/hermes); a CLI
// failure becomes NO_VERDICT in the host, never a fabricated verdict.
// Zero dependencies beyond Node built-ins.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { type ValidatorInvoker } from './panel.ts';

const execFileP = promisify(execFile);
// Code-review ballots are AGENTIC: the validator reads files and runs `git show`, which
// far exceeds a plain verdict's budget. The old 180s timeout KILLED claude/codex
// mid-review (round-52: V1 → "Command failed"), and a too-low turn cap cut V3 off before
// it concluded. Budgets must clear an agentic review, and a failure must surface WHY.
const EXEC_OPTS = { maxBuffer: 16 * 1024 * 1024, timeout: 480_000 };

// On a non-zero exit, execFile's error message is just "Command failed: ..." — useless
// for diagnosis. Re-throw with the child's stderr tail appended so the host's
// INVOCATION_ERROR (and thus the NO_VERDICT rawOutput) records the real cause.
async function runWithDiag(label: string, file: string, args: string[], opts: object): Promise<string> {
  try {
    const { stdout } = await execFileP(file, args, opts);
    return stdout;
  } catch (e) {
    const err = e as Error & { stderr?: string; signal?: string; code?: number };
    const detail = err.signal === 'SIGTERM' ? `timed out after ${(opts as { timeout?: number }).timeout}ms` : (err.stderr ?? '').trim().slice(-500);
    throw new Error(`${label} failed (${err.signal ?? err.code ?? '?'})${detail ? `: ${detail}` : ''}`);
  }
}

// All three go through `/bin/sh -c` with stdin redirected from /dev/null (codex blocks
// on "Reading additional input from stdin..." otherwise) and the prompt passed via env
// (not interpolated) to avoid any quoting/injection. The answer lands on stdout; the
// verbose banner goes to stderr.
export const claudeInvoke: ValidatorInvoker = (prompt) =>
  runWithDiag('claude', '/bin/sh', ['-c', 'claude -p "$QRM_PROMPT" </dev/null'], { ...EXEC_OPTS, env: { ...process.env, QRM_PROMPT: prompt } });

export const codexInvoke: ValidatorInvoker = (prompt) =>
  runWithDiag('codex', '/bin/sh', ['-c', 'codex exec --skip-git-repo-check "$QRM_PROMPT" </dev/null'], { ...EXEC_OPTS, env: { ...process.env, QRM_PROMPT: prompt } });

export const hermesInvoke: ValidatorInvoker = (prompt) =>
  // An agentic review (read several files → run tests → conclude) needs more turns than
  // a plain deliberation; 6 cut V3 off mid-investigation (round-52), so allow 12.
  runWithDiag('hermes', 'hermes', ['chat', '-q', prompt, '--max-turns', '12', '-Q'], EXEC_OPTS);

/** Select a validator's real invoker by id. Throws on any non-validator id — there
 *  is no env-verdict fallback, so the spawner cannot choose a real verdict. */
export function invokerFor(validatorId: string): ValidatorInvoker {
  switch (validatorId) {
    case 'V1': return claudeInvoke;
    case 'V2': return codexInvoke;
    case 'V3': return hermesInvoke;
    default: throw new Error(`no invoker for unknown validator ${validatorId}`);
  }
}
