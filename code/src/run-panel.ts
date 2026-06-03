// Quorumchain ($QRM) — live panel runner. Convenes the real validators
// (V1 Claude, V2 Codex, V3 Hermes) on one ballot, signs each verbatim output,
// writes them to the hash-chained log, and ratifies.
//
//   node src/run-panel.ts "<question>" "<context>"
//
// V2/V3 shell out to the codex/hermes CLIs. V1 is the orchestrating Claude,
// which cannot subprocess itself, so its verbatim deliberation is supplied
// out-of-band in data/claude-vote.txt (write it before running). This is the
// documented testnet-α custody model: the orchestrator holds all keys, but the
// signed + hash-chained log makes any divergence from a re-run detectable.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convene, type PanelValidator, type ValidatorInvoker } from './panel.ts';
import { loadOrCreateKeyring } from './keystore.ts';
import { verifyLog, readLog } from './vote-log.ts';

const execFileP = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const KEYSTORE = join(DATA, 'keystore');
const LOG = join(DATA, 'votes.log');
const CLAUDE_VOTE = join(DATA, 'claude-vote.txt');
const EXEC_OPTS = { maxBuffer: 16 * 1024 * 1024, timeout: 180_000 };

// Wrap an invoker so a CLI failure becomes a recorded NO_VERDICT (no fabricated
// verdict) rather than crashing the whole panel and leaving a partial log.
function safe(id: string, fn: ValidatorInvoker): ValidatorInvoker {
  return async (prompt) => {
    try {
      return await fn(prompt);
    } catch (e) {
      return `INVOCATION_ERROR (${id}): ${(e as Error).message}`;
    }
  };
}

// codex exec blocks on "Reading additional input from stdin..." unless stdin is
// an explicit /dev/null EOF — async execFile's stdin handling does not satisfy
// it, so we go through a shell that redirects stdin. The prompt is passed via
// env (not interpolated) to avoid any quoting/injection issues. The model's
// answer lands on stdout; the verbose banner goes to stderr (discarded).
const codexInvoke: ValidatorInvoker = async (prompt) => {
  const { stdout } = await execFileP(
    '/bin/sh',
    ['-c', 'codex exec --skip-git-repo-check "$QRM_PROMPT" </dev/null'],
    { ...EXEC_OPTS, env: { ...process.env, QRM_PROMPT: prompt } },
  );
  return stdout;
};

const hermesInvoke: ValidatorInvoker = async (prompt) => {
  const { stdout } = await execFileP('hermes', ['chat', '-q', prompt, '--max-turns', '2', '-Q'], EXEC_OPTS);
  return stdout;
};

const claudeInvoke: ValidatorInvoker = async () => {
  if (!existsSync(CLAUDE_VOTE)) {
    throw new Error(`write V1's deliberation to ${CLAUDE_VOTE} before convening`);
  }
  return readFileSync(CLAUDE_VOTE, 'utf8');
};

async function main() {
  const [prompt, context = ''] = process.argv.slice(2);
  if (!prompt) {
    console.error('usage: node src/run-panel.ts "<question>" "<context>"');
    process.exit(1);
  }
  mkdirSync(DATA, { recursive: true });
  const ks = loadOrCreateKeyring(KEYSTORE, ['V1', 'V2', 'V3']);
  const validators: PanelValidator[] = [
    { id: 'V1', privateKeyPem: ks.keys.V1.privateKeyPem, invoke: safe('V1', claudeInvoke) },
    { id: 'V2', privateKeyPem: ks.keys.V2.privateKeyPem, invoke: safe('V2', codexInvoke) },
    { id: 'V3', privateKeyPem: ks.keys.V3.privateKeyPem, invoke: safe('V3', hermesInvoke) },
  ];

  console.error(`Convening panel on: ${prompt}`);
  const r = await convene({ prompt, context, validators, keyring: ks.keyring, quorum: 2, logPath: LOG });

  console.log('\nBallot hash :', r.ballotHash);
  for (const v of r.votes) console.log(`  ${v.validatorId}: ${v.verdict}`);
  console.log('Ratified    :', r.ratified, '| verdict:', r.verdict, '| tally:', JSON.stringify(r.tally));
  if (r.rejected.length) console.log('Rejected    :', JSON.stringify(r.rejected));
  console.log('Log         :', LOG, '|', readLog(LOG).length, 'entries | chain valid:', verifyLog(LOG).valid);
}

main();
