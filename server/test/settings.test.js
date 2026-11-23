// Settings from the environment.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fullyAbsolute, readSettings, readStoreSettings, SettingsError } from '../src/settings.js';

// Absolute folders on this system; nothing is made there.
const DATA = join(tmpdir(), 'nexus-settings-data');
const BACKUPS = join(tmpdir(), 'nexus-settings-backups');
// The backups' settings when only the folder is set: the day's backup at 03:00 UTC.
const BACKUP = { directory: BACKUPS, hour: 3, minute: 0 };
// The gate's settings: placeholders, the audience made at run time.
const AUDIENCE = randomBytes(32).toString('hex');
const GATE_ENV = Object.freeze({
  NEXUS_ACCESS_ISSUER: 'https://team.example.com',
  NEXUS_ACCESS_AUD: AUDIENCE,
  NEXUS_OWNER_EMAIL: 'owner@example.com',
});
const GATE = { issuer: 'https://team.example.com', audience: AUDIENCE, owner: 'owner@example.com' };
const withGate = (env) => ({ ...GATE_ENV, NEXUS_BACKUP_DIR: BACKUPS, ...env });

test('the defaults listen on loopback port 8787', () => {
  assert.deepEqual(
    readSettings(withGate({ NEXUS_DATA_DIR: DATA })),
    { host: '127.0.0.1', port: 8787, dataDirectory: DATA, backup: BACKUP, gate: GATE },
  );
  assert.deepEqual(
    readSettings(withGate({ NEXUS_HOST: '', NEXUS_PORT: '', NEXUS_DATA_DIR: DATA })),
    { host: '127.0.0.1', port: 8787, dataDirectory: DATA, backup: BACKUP, gate: GATE },
  );
});

test('the environment sets the host, the port and the data folder', () => {
  assert.deepEqual(
    readSettings(withGate({ NEXUS_HOST: '::1', NEXUS_PORT: '9000', NEXUS_DATA_DIR: DATA })),
    { host: '::1', port: 9000, dataDirectory: DATA, backup: BACKUP, gate: GATE },
  );
  assert.deepEqual(
    readSettings(withGate({ NEXUS_HOST: 'localhost', NEXUS_PORT: '0', NEXUS_DATA_DIR: DATA })),
    { host: 'localhost', port: 0, dataDirectory: DATA, backup: BACKUP, gate: GATE },
  );
  // The folder is kept in its plain form.
  assert.equal(readSettings(withGate({ NEXUS_DATA_DIR: join(DATA, 'sub', '..') })).dataDirectory, DATA);
  assert.ok(Object.isFrozen(readSettings(withGate({ NEXUS_DATA_DIR: DATA }))));
  assert.ok(Object.isFrozen(readSettings(withGate({ NEXUS_DATA_DIR: DATA })).gate));
});

test('the environment sets the backups\' folder and time, which the restore rehearsal reads too', () => {
  const read = (env) => readSettings(withGate({ NEXUS_DATA_DIR: DATA, ...env })).backup;
  assert.deepEqual(read({ NEXUS_BACKUP_TIME: '' }), BACKUP);
  assert.deepEqual(read({ NEXUS_BACKUP_TIME: '00:00' }), { ...BACKUP, hour: 0, minute: 0 });
  assert.deepEqual(read({ NEXUS_BACKUP_TIME: '23:59' }), { ...BACKUP, hour: 23, minute: 59 });
  // The folder is kept in its plain form, and may be the data folder itself.
  assert.equal(read({ NEXUS_BACKUP_DIR: join(BACKUPS, 'sub', '..') }).directory, BACKUPS);
  assert.equal(read({ NEXUS_BACKUP_DIR: DATA }).directory, DATA);
  assert.ok(Object.isFrozen(read({})));
  // The rehearsal needs neither the address nor the gate.
  assert.deepEqual(
    readStoreSettings({ NEXUS_DATA_DIR: DATA, NEXUS_BACKUP_DIR: BACKUPS, NEXUS_BACKUP_TIME: '04:30' }),
    { dataDirectory: DATA, backup: { ...BACKUP, hour: 4, minute: 30 } },
  );
  assert.throws(() => readStoreSettings({ NEXUS_DATA_DIR: DATA }), (error) => error.setting === 'NEXUS_BACKUP_DIR');
});

test('the environment sets the gate\'s issuer, audience and owner', () => {
  const read = (env) => readSettings(withGate({ NEXUS_DATA_DIR: DATA, ...env })).gate;
  // The issuer is the origin the gate's tokens name, with or without a closing slash, its host in lower case.
  assert.equal(read({ NEXUS_ACCESS_ISSUER: 'https://team.example.com/' }).issuer, 'https://team.example.com');
  assert.equal(read({ NEXUS_ACCESS_ISSUER: 'https://Team.Example.COM' }).issuer, 'https://team.example.com');
  // The owner is matched without case.
  assert.equal(read({ NEXUS_OWNER_EMAIL: 'OWNER@example.com' }).owner, 'owner@example.com');
});

test('an invalid value names the setting and its rule, never the value', () => {
  const misplaced = randomBytes(16).toString('hex');
  const withData = (env) => withGate({ NEXUS_DATA_DIR: DATA, ...env });
  for (const [env, setting] of [
    [withData({ NEXUS_PORT: misplaced }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '65536' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '-1' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: ' 80' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '8080a' }), 'NEXUS_PORT'],
    [withData({ NEXUS_HOST: misplaced }), 'NEXUS_HOST'],
    [withData({ NEXUS_HOST: 'nexus.example.com' }), 'NEXUS_HOST'],
    // The data folder has no default, and a relative path would depend on where the server starts.
    [withGate({}), 'NEXUS_DATA_DIR'],
    [withGate({ NEXUS_DATA_DIR: '' }), 'NEXUS_DATA_DIR'],
    [withGate({ NEXUS_DATA_DIR: misplaced }), 'NEXUS_DATA_DIR'],
    [withGate({ NEXUS_DATA_DIR: `./${misplaced}` }), 'NEXUS_DATA_DIR'],
    [withGate({ NEXUS_DATA_DIR: `${join(DATA, misplaced)}\u0000` }), 'NEXUS_DATA_DIR'],
    // The backups' folder has no default either, and their time is a time of day.
    [{ ...GATE_ENV, NEXUS_DATA_DIR: DATA }, 'NEXUS_BACKUP_DIR'],
    [withData({ NEXUS_BACKUP_DIR: '' }), 'NEXUS_BACKUP_DIR'],
    [withData({ NEXUS_BACKUP_DIR: misplaced }), 'NEXUS_BACKUP_DIR'],
    [withData({ NEXUS_BACKUP_DIR: `./${misplaced}` }), 'NEXUS_BACKUP_DIR'],
    [withData({ NEXUS_BACKUP_DIR: `${join(BACKUPS, misplaced)}\u0000` }), 'NEXUS_BACKUP_DIR'],
    [withData({ NEXUS_BACKUP_TIME: misplaced }), 'NEXUS_BACKUP_TIME'],
    [withData({ NEXUS_BACKUP_TIME: '24:00' }), 'NEXUS_BACKUP_TIME'],
    [withData({ NEXUS_BACKUP_TIME: '03:60' }), 'NEXUS_BACKUP_TIME'],
    [withData({ NEXUS_BACKUP_TIME: '3:00' }), 'NEXUS_BACKUP_TIME'],
    [withData({ NEXUS_BACKUP_TIME: '03:00:00' }), 'NEXUS_BACKUP_TIME'],
    [withData({ NEXUS_BACKUP_TIME: ' 03:00' }), 'NEXUS_BACKUP_TIME'],
    // The gate's settings have no default: without them no owner could be admitted.
    [{ NEXUS_DATA_DIR: DATA, NEXUS_BACKUP_DIR: BACKUPS }, 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: '' }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: misplaced }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `http://${misplaced}.example.com` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://${misplaced}.example.com/cdn-cgi` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://${misplaced}.example.com:8443` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://user:${misplaced}@team.example.com` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://team.example.com?${misplaced}` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://team.example.com#${misplaced}` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: `https://team.example.com ${misplaced}` }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: 'https://192.0.2.1' }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_ISSUER: 'https://localhost' }), 'NEXUS_ACCESS_ISSUER'],
    [withData({ NEXUS_ACCESS_AUD: '' }), 'NEXUS_ACCESS_AUD'],
    [withData({ NEXUS_ACCESS_AUD: misplaced }), 'NEXUS_ACCESS_AUD'],
    [withData({ NEXUS_ACCESS_AUD: `${misplaced}${misplaced}`.toUpperCase() }), 'NEXUS_ACCESS_AUD'],
    [withData({ NEXUS_ACCESS_AUD: `${misplaced}${misplaced}0` }), 'NEXUS_ACCESS_AUD'],
    [withData({ NEXUS_OWNER_EMAIL: '' }), 'NEXUS_OWNER_EMAIL'],
    [withData({ NEXUS_OWNER_EMAIL: misplaced }), 'NEXUS_OWNER_EMAIL'],
    [withData({ NEXUS_OWNER_EMAIL: `${misplaced}@example.com other@example.com` }), 'NEXUS_OWNER_EMAIL'],
    [withData({ NEXUS_OWNER_EMAIL: `${misplaced}@@example.com` }), 'NEXUS_OWNER_EMAIL'],
  ]) {
    assert.throws(() => readSettings(env), (error) => {
      assert.ok(error instanceof SettingsError);
      assert.equal(error.setting, setting);
      assert.ok(!error.message.includes(misplaced));
      return true;
    }, JSON.stringify(env));
  }
});

test('the data folder names its drive on Windows, so it does not depend on where the server starts', () => {
  for (const [path, platform, expected] of [
    ['/var/lib/nexus', 'linux', true],
    ['relative/data', 'linux', false],
    ['C:\\nexus-data', 'win32', true],
    ['C:/nexus-data', 'win32', true],
    ['\\\\host\\share\\nexus-data', 'win32', true],
    // Absolute to Node on Windows, but on the drive of the start folder.
    ['\\nexus-data', 'win32', false],
    ['/nexus-data', 'win32', false],
    ['C:nexus-data', 'win32', false],
  ]) {
    assert.equal(fullyAbsolute(path, platform), expected, `${platform} ${path}`);
  }
  if (process.platform === 'win32') {
    assert.throws(() => readSettings(withGate({ NEXUS_DATA_DIR: '\\nexus-data' })), { setting: 'NEXUS_DATA_DIR' });
  }
});
