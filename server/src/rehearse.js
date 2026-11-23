// Rehearses a restore from the latest backup and records it for a release (SPEC-052, REQ-080):
//
//   node src/rehearse.js <release>
//
// with the server's NEXUS_DATA_DIR and NEXUS_BACKUP_DIR (see rehearsal.js). It writes one JSON line and exits 0 when
// the rehearsal succeeded, 1 when it failed or could not run, as with no backup to rehearse, and 2 when it was not
// called right. Its lines name no path (rule 5).

import { errorKind, jsonLines, logCrashes } from './log.js';
import { rehearse, RehearsalRefused } from './rehearsal.js';
import { readStoreSettings, SettingsError } from './settings.js';
import { openExistingStore, StoreError } from './store.js';

function main(argv, env) {
  const log = jsonLines();
  const time = () => new Date().toISOString();
  logCrashes(process, log);

  let settings;
  try {
    settings = readStoreSettings(env);
  } catch (error) {
    if (!(error instanceof SettingsError)) throw error;
    log({ time: time(), event: 'settings_invalid', setting: error.setting, rule: error.rule });
    return 2;
  }
  if (argv.length !== 1) {
    log({ time: time(), event: 'rehearsal_refused', reason: 'usage' });
    return 2;
  }

  let store;
  try {
    store = openExistingStore(settings.dataDirectory);
  } catch (error) {
    if (!(error instanceof StoreError)) throw error;
    log({ time: time(), event: 'store_refused', reason: error.reason });
    return 1;
  }
  try {
    const record = rehearse({ store, backupDirectory: settings.backup.directory, release: argv[0] });
    log({
      time: time(),
      event: 'rehearsal_recorded',
      release: record.release,
      backup: record.backup.day,
      result: record.result,
      note: record.note,
    });
    return record.result === 'succeeded' ? 0 : 1;
  } catch (error) {
    if (error instanceof RehearsalRefused) {
      log({ time: time(), event: 'rehearsal_refused', reason: error.reason });
      return error.reason === 'release_invalid' ? 2 : 1;
    }
    log({ time: time(), event: 'rehearsal_failed', error: errorKind(error) });
    return 1;
  } finally {
    store.close();
  }
}

process.exitCode = main(process.argv.slice(2), process.env);
