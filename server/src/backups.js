// The daily backups (TBL-170; SPEC-042, SPEC-052) as the owner's reads show them: the warning on the owner's to-do and
// the project list while the last daily backup failed (TASK-439). The backups themselves are TASK-450's: it backs up
// once a day, retries a failed backup once within the hour, keeps each backup 30 days and records the rows read here.
//
// The warning (BackupWarning) shows once a backup failed for good, which is when its retry failed (attempt 2): a
// first attempt that failed is not the end while its retry is due (SPEC-052). It stays until a later backup succeeds
// (SPEC-042). So it is read from the latest backup that ended for good, by the time it started: a retry that failed
// shows the warning, a backup that succeeded shows none, and the rows still running or whose first attempt failed
// change nothing. A retry that never ran is TASK-450's to record. Nothing here logs: a backup's name is a file name.

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      ended: store.prepare(
        `SELECT state, started_at, finished_at FROM backups
         WHERE state = 'succeeded' OR (state = 'failed' AND attempt = 2)
         ORDER BY started_at DESC, id DESC LIMIT 1`,
      ),
      succeeded: store.prepare(
        "SELECT started_at, finished_at FROM backups WHERE state = 'succeeded' ORDER BY started_at DESC, id DESC LIMIT 1",
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The time a backup ended: when it finished, or when it started if it kept no finish.
const endOf = (row) => row.finished_at ?? row.started_at;

// The contract's BackupWarning while the last daily backup failed, or null: failed_at is when the failed retry ended,
// last_succeeded_at when the last backup that succeeded ended, or null when none ever did.
export function backupWarning(store) {
  const statements = statementsOf(store);
  const ended = statements.ended.get();
  if (ended === undefined || ended.state !== 'failed') return null;
  const succeeded = statements.succeeded.get();
  return { failed_at: endOf(ended), last_succeeded_at: succeeded === undefined ? null : endOf(succeeded) };
}
