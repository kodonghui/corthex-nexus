// Settings from the environment.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { readSettings, SettingsError } from '../src/settings.js';

test('the defaults listen on loopback port 8787', () => {
  assert.deepEqual(readSettings({}), { host: '127.0.0.1', port: 8787 });
  assert.deepEqual(readSettings({ NEXUS_HOST: '', NEXUS_PORT: '' }), { host: '127.0.0.1', port: 8787 });
});

test('the environment sets the host and the port', () => {
  assert.deepEqual(readSettings({ NEXUS_HOST: '::1', NEXUS_PORT: '9000' }), { host: '::1', port: 9000 });
  assert.deepEqual(readSettings({ NEXUS_HOST: 'localhost', NEXUS_PORT: '0' }), { host: 'localhost', port: 0 });
  assert.ok(Object.isFrozen(readSettings({})));
});

test('an invalid value names the setting and its rule, never the value', () => {
  const misplaced = randomBytes(16).toString('hex');
  for (const [env, setting] of [
    [{ NEXUS_PORT: misplaced }, 'NEXUS_PORT'],
    [{ NEXUS_PORT: '65536' }, 'NEXUS_PORT'],
    [{ NEXUS_PORT: '-1' }, 'NEXUS_PORT'],
    [{ NEXUS_PORT: ' 80' }, 'NEXUS_PORT'],
    [{ NEXUS_PORT: '8080a' }, 'NEXUS_PORT'],
    [{ NEXUS_HOST: misplaced }, 'NEXUS_HOST'],
    [{ NEXUS_HOST: 'nexus.example.com' }, 'NEXUS_HOST'],
  ]) {
    assert.throws(() => readSettings(env), (error) => {
      assert.ok(error instanceof SettingsError);
      assert.equal(error.setting, setting);
      assert.ok(!error.message.includes(misplaced));
      return true;
    }, JSON.stringify(env));
  }
});
