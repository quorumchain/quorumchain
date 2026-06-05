// Quorumchain ($QRM) — live panel runner. Convenes the real validators
// (V1 Claude, V2 Codex, V3 Hermes) on one ballot, signs each verbatim output,
// writes them to the hash-chained log, and ratifies.
//
//   node src/run-panel.ts "<question>" "<context>"
//
// Each validator runs behind a RemoteSigner: a SEPARATE OS process
// (deliberating-signer-host.ts) that holds the validator's keystore key, runs its
// real CLI invoker child-side (V1→claude, V2→codex, V3→hermes), parses the verdict,
// derives the ballot hash, and signs. The orchestrator holds NO private key in this
// process and supplies NO verdict (CIP-3 — the orchestrator is not the trust root).
// Round 47 (WIRE_NOW 2/1) closed OS-level custody on this live path; round 48
// (AUTONOMY_FIRST) made V1 deliberate autonomously via `claude -p` — no human paste —
// so all three are symmetric and no human is in the loop.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { convene, startSigners } from './panel.ts';
import { makeRemoteSigner } from './signer.ts';
import { loadPinnedKeyring, assertMatchesPin } from './keystore.ts';
import { verifyLog, readLog } from './vote-log.ts';
import type { BallotMeta } from './commons.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, '..', 'data');
const KEYSTORE = join(DATA, 'keystore');
// Two chains. Core developmental decisions (CIPs) and AI verdicts destined for the
// Knowledge Commons land on the canonical, published chain (votes.log + ballots.jsonl,
// the only data/ files force-added to git). Editorial / scratch / test ballots route
// to a gitignored DEV chain via QRM=dev, so the published chain stays core-only.
// Default is core; each chain is an independent, self-verifying hash chain.
const CHAIN = process.env.QRM === 'dev' ? 'dev' : 'core';
const LOG = join(DATA, CHAIN === 'dev' ? 'votes-dev.log' : 'votes.log');
const REGISTRY = join(DATA, CHAIN === 'dev' ? 'ballots-dev.jsonl' : 'ballots.jsonl');
const PINNED = join(HERE, '..', 'pinned-keyring.json');
const DELIB_HOST = join(HERE, 'deliberating-signer-host.ts');

async function main() {
  const [prompt, context = ''] = process.argv.slice(2);
  if (!prompt) {
    console.error('usage: node src/run-panel.ts "<question>" "<context>"');
    process.exit(1);
  }
  mkdirSync(DATA, { recursive: true });

  // Optional multiple-choice ballot: QRM_VERDICTS="A,B,C" (default YES/NO/ABSTAIN).
  const verdicts = process.env.QRM_VERDICTS
    ? process.env.QRM_VERDICTS.split(',').map((s) => s.trim())
    : undefined;

  // CIP-13/CIP-10 declared meta (optional), recorded with the ballot in the registry so
  // the read path projects it natively. A type sub-claim sets QRM_TYPES_FOR (+ the ballot's
  // verdict, multiple-choice, IS the type); a supersede sets QRM_SUPERSEDES (+ QRM_NEW_ANCHOR).
  const E = process.env;
  const meta: BallotMeta = {};
  if (E.QRM_TYPE) meta.epistemicType = E.QRM_TYPE as BallotMeta['epistemicType'];
  if (E.QRM_EVIDENCE_TIME) meta.evidenceTime = E.QRM_EVIDENCE_TIME;
  if (E.QRM_SUPERSEDES) meta.supersedes = E.QRM_SUPERSEDES;
  if (E.QRM_SUPERSEDE_REASON) meta.supersedeReason = E.QRM_SUPERSEDE_REASON;
  if (E.QRM_NEW_ANCHOR) meta.newAnchor = E.QRM_NEW_ANCHOR === '1' || E.QRM_NEW_ANCHOR === 'true';
  if (E.QRM_TYPES_FOR) meta.typesClaimFor = E.QRM_TYPES_FOR;
  if (E.QRM_PROPOSED_TYPE) meta.proposedType = E.QRM_PROPOSED_TYPE as BallotMeta['proposedType'];
  // CIP-14: QRM_BIND_TYPE binds QRM_TYPE INTO the ballot hash (and every signature) — the
  // type becomes signed, not advisory. Opt-in, so QRM_TYPE alone stays v1/advisory.
  if ((E.QRM_BIND_TYPE === '1' || E.QRM_BIND_TYPE === 'true') && meta.epistemicType) meta.typeBinding = 'hashed';
  const ballotMeta = Object.keys(meta).length ? meta : undefined;

  // Spawn one deliberating host per validator. Each loads its OWN key from the
  // keystore child-side (creating it on first run); the private half never enters
  // this process. The timeout must exceed the slowest invoker (hermes ≈ 480s).
  // startSigners tolerates a STARTUP failure (round-49 V2 fix): a host that dies at
  // handshake is a recorded absence, not an abort of the whole convening.
  const pinned = loadPinnedKeyring(PINNED);
  const { started, startupFailures } = await startSigners(['V1', 'V2', 'V3'], (id) =>
    makeRemoteSigner({ validatorId: id, hostPath: DELIB_HOST, timeoutMs: 600_000, env: { QRM_KEYSTORE_DIR: KEYSTORE } }),
  );
  if (startupFailures.length) console.error('Startup failures:', JSON.stringify(startupFailures));
  // Pin check (Phase 0.2): every host that DID come up must present its published key
  // (no substitution); an absent validator counts against ratify's 2/3 bar, since the
  // keyring (denominator) is the full registered panel.
  const presented = Object.fromEntries(started.map((s) => [s.validatorId, s.publicKeyPem]));
  assertMatchesPin(presented, pinned);
  const keyring = pinned;

  console.error(`Convening panel [${CHAIN} chain] on: ${prompt}`);
  const r = await convene({ prompt, context, signers: started, keyring, quorum: 2, logPath: LOG, verdicts, registryPath: REGISTRY, meta: ballotMeta });
  for (const s of started) s.close();

  // Persist verbatim reasoning keyed by ballot hash. The log stores only the
  // sha256 of each rawOutput (tamper-evidence); this sidecar keeps the readable
  // text for transcripts. Gitignored under data/.
  const rawDump = r.votes
    .map((v) => `### ${v.validatorId} — ${v.verdict}\n${v.rawOutput}`)
    .join('\n\n');
  writeFileSync(join(DATA, `raw-${CHAIN === 'dev' ? 'dev-' : ''}${r.ballotHash.slice(0, 12)}.txt`), rawDump);

  console.log('\nBallot hash :', r.ballotHash);
  for (const v of r.votes) console.log(`  ${v.validatorId}: ${v.verdict}`);
  console.log('Ratified    :', r.ratified, '| verdict:', r.verdict, '| tally:', JSON.stringify(r.tally));
  if (r.rejected.length) console.log('Rejected    :', JSON.stringify(r.rejected));
  if (r.failures.length) console.log('Failures    :', JSON.stringify(r.failures)); // validators whose host failed (liveness)
  console.log('Log         :', LOG, '|', readLog(LOG).length, 'entries | chain valid:', verifyLog(LOG).valid);
}

main();
