// Starts the NEXUS server with the settings of the environment: node src/main.js

import { createNexusServer } from './app.js';
import { errorKind, jsonLines, logCrashes } from './log.js';
import { readSettings, SettingsError } from './settings.js';

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

  const server = createNexusServer({ settings, log });
  server.once('error', (error) => {
    log({ time: time(), event: 'listen_failed', error: errorKind(error) });
    process.exit(1);
  });
  server.listen(settings.port, settings.host, () => {
    log({ time: time(), event: 'listening', host: settings.host, port: server.address().port });
  });

  const stop = () => {
    log({ time: time(), event: 'stopping' });
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), STOP_GRACE_MS).unref();
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

start();
