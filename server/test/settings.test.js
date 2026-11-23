// Settings from the environment.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fullyAbsolute, readSettings, SettingsError } from '../src/settings.js';

// An absolute folder on this system; nothing is made there.
const DATA = join(tmpdir(), 'nexus-settings-data');

test('the defaults listen on loopback port 8787', () => {
  assert.deepEqual(readSettings({ NEXUS_DATA_DIR: DATA }), { host: '127.0.0.1', port: 8787, dataDirectory: DATA });
  assert.deepEqual(
    readSettings({ NEXUS_HOST: '', NEXUS_PORT: '', NEXUS_DATA_DIR: DATA }),
    { host: '127.0.0.1', port: 8787, dataDirectory: DATA },
  );
});

test('the environment sets the host, the port and the data folder', () => {
  assert.deepEqual(
    readSettings({ NEXUS_HOST: '::1', NEXUS_PORT: '9000', NEXUS_DATA_DIR: DATA }),
    { host: '::1', port: 9000, dataDirectory: DATA },
  );
  assert.deepEqual(
    readSettings({ NEXUS_HOST: 'localhost', NEXUS_PORT: '0', NEXUS_DATA_DIR: DATA }),
    { host: 'localhost', port: 0, dataDirectory: DATA },
  );
  // The folder is kept in its plain form.
  assert.equal(readSettings({ NEXUS_DATA_DIR: join(DATA, 'sub', '..') }).dataDirectory, DATA);
  assert.ok(Object.isFrozen(readSettings({ NEXUS_DATA_DIR: DATA })));
});

test('an invalid value names the setting and its rule, never the value', () => {
  const misplaced = randomBytes(16).toString('hex');
  const withData = (env) => ({ NEXUS_DATA_DIR: DATA, ...env });
  for (const [env, setting] of [
    [withData({ NEXUS_PORT: misplaced }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '65536' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '-1' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: ' 80' }), 'NEXUS_PORT'],
    [withData({ NEXUS_PORT: '8080a' }), 'NEXUS_PORT'],
    [withData({ NEXUS_HOST: misplaced }), 'NEXUS_HOST'],
    [withData({ NEXUS_HOST: 'nexus.example.com' }), 'NEXUS_HOST'],
    // The data folder has no default, and a relative path would depend on where the server starts.
    [{}, 'NEXUS_DATA_DIR'],
    [{ NEXUS_DATA_DIR: '' }, 'NEXUS_DATA_DIR'],
    [{ NEXUS_DATA_DIR: misplaced }, 'NEXUS_DATA_DIR'],
    [{ NEXUS_DATA_DIR: `./${misplaced}` }, 'NEXUS_DATA_DIR'],
    [{ NEXUS_DATA_DIR: `${join(DATA, misplaced)}\u0000` }, 'NEXUS_DATA_DIR'],
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
    assert.throws(() => readSettings({ NEXUS_DATA_DIR: '\\nexus-data' }), { setting: 'NEXUS_DATA_DIR' });
  }
});
