// Quorumchain ($QRM) — operator CLI: screen the public node's inbox. Runs on the OPERATOR's
// machine, not the node. Usage:
//   QRM_NODE_BASE=https://node QRM_ADMIN_TOKEN=… node src/review-inbox.ts list [status]
//   … node src/review-inbox.ts accept <id>
//   … node src/review-inbox.ts reject <id> "<reason>"

import { api, renderSubmission } from './node-client.ts';

const base = process.env.QRM_NODE_BASE!;
const token = process.env.QRM_ADMIN_TOKEN!;
const [cmd, id, reason] = process.argv.slice(2);

const run = async () => {
  if (cmd === 'list') {
    const r = await api(base, `/inbox${id ? `?status=${id}` : ''}`, { token });
    for (const s of r.body.submissions ?? []) console.log(renderSubmission(s) + '\n');
  } else if (cmd === 'accept' || cmd === 'reject') {
    const r = await api(base, `/inbox/${id}/decision`, { method: 'POST', token, body: { decision: cmd === 'accept' ? 'ACCEPT' : 'REJECT', reason } });
    console.log(r.status, JSON.stringify(r.body));
  } else {
    console.error('usage: review-inbox list [status] | accept <id> | reject <id> "<reason>"');
    process.exit(1);
  }
};
run();
