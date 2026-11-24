// TASK-449: the v3 server for tests/test_hub_run.py, run with Node 24: node tests/hub_run_server.mjs <data folder> <log file>
//
// It opens a new store in the data folder, which must be empty, and serves every operation of server/src/routes.js on
// a free port of 127.0.0.1, with no pages, the daily backup or the tool status read. The gate is a local one, as the
// server's tests make it (localGate of server/test/support.js): its key pair is made here at run time, so the owner's
// sign-in is a stand-in that no real gate would take, and no Access team or AUD value is used. It writes one line to
// standard output, {"url": ..., "owner": ...}, the server's address and an owner sign-in for that gate, then serves
// until its standard input closes, and closes the store after the writes in its queue, as main.js does. The server's
// log lines go to the log file, which it empties first, so that the test can check that none of them holds what rule 5
// keeps out. Nothing here reaches the network beyond the loopback port.

import { once } from 'node:events';
import { createWriteStream, readdirSync } from 'node:fs';
import { createNexusServer } from '../server/src/app.js';
import { jsonLines } from '../server/src/log.js';
import { ROUTES } from '../server/src/routes.js';
import { openStore } from '../server/src/store.js';
import { createQueue } from '../server/src/writes.js';
import { localGate } from '../server/test/support.js';

const [folder, logFile] = process.argv.slice(2);
if (!folder || !logFile) {
  console.error('usage: node tests/hub_run_server.mjs <data folder> <log file>');
  process.exit(2);
}
// A store left in the folder would serve an earlier run's credentials, spaces and claims.
if (readdirSync(folder).length > 0) {
  console.error('the data folder is not empty');
  process.exit(2);
}

const { db } = openStore(folder);
const logStream = createWriteStream(logFile, { flags: 'w' });
const local = localGate();
const queue = createQueue();
const settings = Object.freeze({ host: '127.0.0.1', port: 0 });
const server = createNexusServer({ settings, routes: ROUTES, log: jsonLines(logStream), store: db, gate: local.gate, queue });
server.listen(settings.port, settings.host);
await once(server, 'listening');

process.stdout.write(`${JSON.stringify({ url: `http://127.0.0.1:${server.address().port}`, owner: local.token() })}\n`);

// The test closes standard input when it is done, or when it fails or ends early.
process.stdin.resume();
process.stdin.once('end', () => {
  server.close(() => {
    queue(() => {
      db.close();
      logStream.end(() => process.exit(0));
    });
  });
  server.closeAllConnections();
});
