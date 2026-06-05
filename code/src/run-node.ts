// Quorumchain ($QRM) — deployable node entrypoint. Loads pinned keyring + env config,
// boot-verifies (degraded mode on failure), and serves. The node holds NO validator keys.
//   QRM_NODE_DATA=/data QRM_SUBMIT_TOKEN=… QRM_ADMIN_TOKEN=… node src/run-node.ts

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './node-config.ts';
import { bootVerify } from './boot.ts';
import { createNode } from './node-server.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const keyringPath = process.env.QRM_KEYRING ?? join(HERE, '..', 'pinned-keyring.json');
const keyring = JSON.parse(readFileSync(keyringPath, 'utf8')) as Record<string, string>;
const cfg = loadConfig(process.env, keyring);

const state = bootVerify(cfg.dataDir, cfg.chainId, cfg.pinnedKeyring);
console.error(`[run-node] boot: mode=${state.mode} chainValid=${state.chainValid}${state.reason ? ` reason=${state.reason}` : ''} chainId=${cfg.chainId.slice(0, 12)}`);

const node = createNode(cfg, () => state.mode);
node.listen().then(() => console.error(`[run-node] listening on :${node.port()} dataDir=${cfg.dataDir}`));
