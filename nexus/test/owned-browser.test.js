import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createBrowserRun} from './owned-browser.mjs';

for (const [name, initial] of [
  ['only the port has been written', '12345\n'],
  ['the port is outside the TCP range', '65536\n/devtools/browser/test-id\n'],
  ['the browser path is incomplete', '12345\n/devtools/browser/\n']
]) {
  test('CDP readiness waits when ' + name, {timeout: 5000}, async () => {
    const base = await fs.mkdtemp(path.join(tmpdir(), 'nexus-cdp-readiness-'));
    const run = await createBrowserRun(base);
    try {
      const file = path.join(run.profile, 'DevToolsActivePort');
      await fs.writeFile(file, initial);
      let completed = false;
      const pending = run.endpoint(2000).then(value => { completed = true; return value; });
      await new Promise(resolve => setTimeout(resolve, 50));
      assert.equal(completed, false, 'an incomplete or invalid address must not reach WebSocket');
      await fs.writeFile(file, '12345\n/devtools/browser/test-id\n');
      assert.deepEqual(await pending, ['12345', '/devtools/browser/test-id']);
    } finally {
      await run.removeProfile();
      await fs.rm(base, {recursive: true, force: true});
    }
  });
}

test('CDP readiness accepts a complete Windows line-ending address', async () => {
  const base = await fs.mkdtemp(path.join(tmpdir(), 'nexus-cdp-readiness-'));
  const run = await createBrowserRun(base);
  try {
    await fs.writeFile(path.join(run.profile, 'DevToolsActivePort'), '12345\r\n/devtools/browser/test-id\r\n');
    assert.deepEqual(await run.endpoint(1000), ['12345', '/devtools/browser/test-id']);
  } finally {
    await run.removeProfile();
    await fs.rm(base, {recursive: true, force: true});
  }
});
