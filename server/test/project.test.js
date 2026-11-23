// The server project: Node 24 with no dependency, its tests in the check workflow, and the check listed in AGENTS.md
// (TASK-413).

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const manifest = JSON.parse(read('server/package.json'));

test('the server is a Node 24 module with no dependency', () => {
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, 'module');
  assert.equal(manifest.engines.node, '>=24');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies', 'bundleDependencies', 'bundledDependencies']) {
    assert.equal(manifest[field], undefined, field);
  }
});

test('every module imports only Node\'s own modules and the server\'s files', () => {
  let modules = 0;
  let imports = 0;
  for (const folder of ['src', 'test']) {
    for (const name of readdirSync(new URL(`../${folder}/`, import.meta.url))) {
      if (!name.endsWith('.js')) continue;
      modules += 1;
      const text = read(`server/${folder}/${name}`);
      const specifiers = [...text.matchAll(/^import\s[^;]*?from\s+'([^']+)'|^import\s+'([^']+)'|\bimport\(\s*'([^']+)'/gm)]
        .map((match) => match[1] ?? match[2] ?? match[3]);
      imports += specifiers.length;
      for (const specifier of specifiers) {
        assert.match(specifier, /^(?:node:|\.\.?\/)/, `${folder}/${name} imports ${specifier}`);
      }
      assert.doesNotMatch(text, /\brequire\(/, name);
    }
  }
  assert.ok(modules >= 10 && imports >= 30, 'the modules were read');
});

test('the check workflow runs node --test in server/ on Node 24, and all-checks waits for it', () => {
  const workflow = read('.github/workflows/check.yml');
  const job = /^ {2}server:\n((?: {4}.*\n|\n)+)/m.exec(workflow);
  assert.ok(job, 'check.yml has a server job');
  assert.match(job[1], /uses: actions\/setup-node@[0-9a-f]{40} # v\d/);
  assert.match(job[1], /node-version: '24'/);
  assert.match(job[1], /- run: node --test\n {8}working-directory: server\n/);
  assert.match(workflow, /^ {4}needs: \[[^\]]*\bserver\b[^\]]*\]$/m);
});

test('AGENTS.md lists the check', () => {
  const agents = read('AGENTS.md');
  const checks = /^## Checks\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(agents);
  assert.ok(checks, 'AGENTS.md has its Checks section');
  assert.match(checks[1], /^\(cd server && node --test\)$/m);
  assert.match(checks[1], /Node 24/);
});
