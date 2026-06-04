// Quorumchain ($QRM) — live panel runner. Convenes the real validators
// (V1 Claude, V2 Codex, V3 Hermes) on one ballot, signs each verbatim output,
// writes them to the hash-chained log, and ratifies.
//
//   node src/run-panel.ts "<question>" "<context>"
//
// V2/V3 shell out to the codex/hermes CLIs. V1 is the orchestrating Claude,
// which cannot subprocess itself, so its verbatim deliberation is supplied
// out-of-band in data/claude-vote.txt (write it before running). Each validator
// signs its own vote behind a Signer boundary (CIP-3 — the orchestrator holds no
// key in code and cannot mint/alter a verdict). Testnet item: locally the keys
// are still loaded into THIS process via the keystore, so OS-level custody is not
// yet isolated; the drop-in is a RemoteSigner (separate process/enclave) on the
// same Signer interface, needing no change to convene.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convene, buildPrompt, parseVerdict, type ValidatorInvoker } from './panel.ts';
import { makeLocalSigner } from './signer.ts';
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
  // Research-capable ballots need more turns + time than a plain deliberation:
  // a web-research pass (search → read → answer) easily exceeds the default.
  const { stdout } = await execFileP('hermes', ['chat', '-q', prompt, '--max-turns', '6', '-Q'], { ...EXEC_OPTS, timeout: 480_000 });
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
  // Wrap a validator's raw invoker into a `deliberate` closure: it builds the
  // prompt and parses the verdict on the validator side, so the signer derives the
  // ballot hash from the same content the model judged (round-45 binding fix).
  const deliberateWith = (invoke: ValidatorInvoker) => async (prompt: string, context: string, verdicts?: string[]) => {
    const rawOutput = await invoke(buildPrompt(prompt, context, verdicts));
    return { verdict: parseVerdict(rawOutput), rawOutput };
  };
  const signers = [
    makeLocalSigner({ validatorId: 'V1', key: ks.keys.V1, deliberate: deliberateWith(safe('V1', claudeInvoke)) }),
    makeLocalSigner({ validatorId: 'V2', key: ks.keys.V2, deliberate: deliberateWith(safe('V2', codexInvoke)) }),
    makeLocalSigner({ validatorId: 'V3', key: ks.keys.V3, deliberate: deliberateWith(safe('V3', hermesInvoke)) }),
  ];

  // Optional multiple-choice ballot: QRM_VERDICTS="A,B,C" (default YES/NO/ABSTAIN).
  const verdicts = process.env.QRM_VERDICTS
    ? process.env.QRM_VERDICTS.split(',').map((s) => s.trim())
    : undefined;

  console.error(`Convening panel on: ${prompt}`);
  const r = await convene({ prompt, context, signers, keyring: ks.keyring, quorum: 2, logPath: LOG, verdicts });

  // Persist verbatim reasoning keyed by ballot hash. The log stores only the
  // sha256 of each rawOutput (tamper-evidence); this sidecar keeps the readable
  // text for transcripts. Gitignored under data/.
  const rawDump = r.votes
    .map((v) => `### ${v.validatorId} — ${v.verdict}\n${v.rawOutput}`)
    .join('\n\n');
  writeFileSync(join(DATA, `raw-${r.ballotHash.slice(0, 12)}.txt`), rawDump);

  console.log('\nBallot hash :', r.ballotHash);
  for (const v of r.votes) console.log(`  ${v.validatorId}: ${v.verdict}`);
  console.log('Ratified    :', r.ratified, '| verdict:', r.verdict, '| tally:', JSON.stringify(r.tally));
  if (r.rejected.length) console.log('Rejected    :', JSON.stringify(r.rejected));
  console.log('Log         :', LOG, '|', readLog(LOG).length, 'entries | chain valid:', verifyLog(LOG).valid);
}

main();
