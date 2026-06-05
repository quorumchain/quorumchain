// Quorumchain ($QRM) — operator CLI: publish the local authoritative chain to the node.
// Runs on the OPERATOR's machine. Usage:
//   QRM_NODE_BASE=https://node QRM_ADMIN_TOKEN=… node src/publish-node.ts [localDataDir]

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { api, packageSnapshot } from './node-client.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const base = process.env.QRM_NODE_BASE!;
const token = process.env.QRM_ADMIN_TOKEN!;
const localData = process.argv[2] ?? join(HERE, '..', 'data');
const commonsDir = process.env.QRM_COMMONS_DIR ?? join(HERE, '..', '..', 'docs', 'commons');

const run = async () => {
  const snap = packageSnapshot(localData, commonsDir);
  const r = await api(base, '/admin/publish', { method: 'POST', token, body: snap });
  console.log(r.status, JSON.stringify(r.body));
  if (r.status !== 200) process.exit(1);
};
run();
