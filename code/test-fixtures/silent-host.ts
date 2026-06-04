// Test fixture: a "remote signer host" that starts, reads stdin, and NEVER replies.
// Used to prove makeRemoteSigner does not hang forever waiting on a dead/stuck host.
import { createInterface } from 'node:readline';
createInterface({ input: process.stdin }).on('line', () => {
  /* swallow every request; never write to stdout */
});
