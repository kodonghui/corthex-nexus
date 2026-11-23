// Starts the NEXUS server with the settings of the environment: node src/main.js

import { createNexusServer } from './app.js';
import { createBackups } from './backups.js';
import { createGate } from './gate.js';
import { errorKind, jsonLines, logCrashes } from './log.js';
import { ROUTES } from './routes.js';
import { readSettings, SettingsError } from './settings.js';
import { openStore, StoreError } from './store.js';
import { createQueue } from './writes.js';

const STOP_GRACE_MS = 10_000;

function start() {
  const log = jsonLines();
  const time = () => new Date().toISOString();
  logCrashes(process, log);

  let settings;
  try {
    settings = readSettings(process.env);
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    log({ time: time(), event: 'settings_invalid', setting: error.setting, rule: error.rule });
    process.exitCode = 1;
    return;
  }

  // The store opens before the server listens, so no request arrives before its migrations are applied. Its lines
  // name the reason or the kind of error, never the data folder (rule 5).
  let store;
  try {
    const opened = openStore(settings.dataDirectory);
    store = opened.db;
    log({ time: time(), event: 'store_opened', version: opened.version, applied: opened.applied });
  } catch (error) {
    if (error instanceof StoreError) {
      log({ time: time(), event: 'store_refused', reason: error.reason });
    } else {
      log({ time: time(), event: 'store_failed', error: errorKind(error) });
    }
    process.exitCode = 1;
    return;
  }

  // The gate's sign-in: its keys are read from the team's certs endpoint when an owner request first needs them.
  const gate = createGate(settings.gate);
  // The one queue of store writes: the requests' and the daily backup's (backups.js).
  const queue = createQueue();
  const server = createNexusServer({ settings, routes: ROUTES, log, store, gate, queue });
  const backups = createBackups({ store, settings: settings.backup, queue, log });
  server.once('error', (error) => {
    log({ time: time(), event: 'listen_failed', error: errorKind(error) });
    store.close();
    process.exit(1);
  });
  server.listen(settings.port, settings.host, () => {
    log({ time: time(), event: 'listening', host: settings.host, port: server.address().port });
    // The daily backup starts once the server listens: a day whose time has passed without a backup backs up now.
    backups.start().catch((error) => log({ time: time(), event: 'backup_job_failed', error: errorKind(error) }));
  });

  const stop = () => {
    log({ time: time(), event: 'stopping' });
    backups.stop();
    // The store closes after the writes in the queue, a running backup among them.
    server.close(() => {
      queue(() => {
        store.close();
        process.exit(0);
      });
    });
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), STOP_GRACE_MS).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

start();
