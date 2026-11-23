// The mockup drawer and the mockup page (TASK-427; SPEC-009; API-293; TBL-149 to TBL-153). The done condition:
// - A test page that uses 3 tokens lists 3 token elements: one element of kind token for each CSS custom property the
//   page reads with var(), by the rules the coordinator chose (see src/mockup.js and the server's README).
// - A mockup that cannot be shown names the reason: a page that never drew answers 409 not_drawn, and the push names
//   where its drawing failed.
// - Every answer of API-293 carries the sandbox header and nosniff, its refusals and faults included.
// - Every response API-293 lists has a passing test.
// This repository's page draws as a stored expected list of 95 tokens: test/mockup-picture.json is the pinned hub's
// picture of design/mockup/nexus-mockup.html with the file's SHA-256, which tests/test_mockup_picture.py checks against
// the pinned hub; this test fails when the file changes and the picture does not. test/mockup-expected.json is its
// drawing, compared exactly, so this test fails when the drawing changes and its file does not. To make both again,
// from the repository's root:
//     CORTHEX_HUB_CHECKOUT=<the pinned hub checkout> python tests/test_mockup_picture.py --write
//     (cd server && node test/mockup-expected.js --write)

import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createRouter } from '../src/router.js';
import { DRAWERS, SourceFailure } from '../src/drawing.js';
import { idOf } from '../src/ids.js';
import { mockup } from '../src/mockup.js';
import { SANDBOX } from '../src/mockup-page.js';
import { Problem } from '../src/problem.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { drawingOf, STAGE, storedDrawing, storedPicture } from './mockup-expected.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { localGate, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const PAGE = 'design/mockup/nexus-mockup.html';
const ACTION = 'getMockupPage';
const NOSNIFF = 'nosniff';
const JSON_TYPE = { 'Content-Type': 'application/json' };
const AGAIN = 'make test/mockup-picture.json and test/mockup-expected.json again as test/mockup.test.js says at its top';

const sha256 = (data) => createHash('sha256').update(data).digest('hex');
// The tokens a page lists: [name, values, uses] in their order.
const tokensOf = (text) => mockup({ text }).elements.map(({ name, detail }) => [name, detail.values, detail.uses]);
const namesOf = (text) => mockup({ text }).elements.map(({ name }) => name);
// A page of style sheets.
const sheet = (...css) => css.map((text) => `<style>${text}</style>`).join('\n');
// A page that reads count custom properties, each once.
const manyTokens = (count) => sheet(`a{${Array.from({ length: count }, (_, index) => `--x:var(--t${index})`).join(';')}}`);

describe('the mockup drawer', () => {
  test('a test page that uses 3 tokens lists 3 token elements (done condition, SPEC-009)', () => {
    const page = [
      '<!doctype html><html><head><title>Three tokens</title>',
      '<style>:root { --brand: #0f62fe; --ink: #161616; --space: 8px; --unused: red }',
      'body { color: var(--ink); padding: var(--space) }</style></head>',
      '<body><button style="background: var(--brand); color: var(--ink)">Go</button></body></html>',
    ].join('\n');
    const { name, elements } = mockup({ stage: STAGE, part: 'nexus', key: 'design/a.html', kind: 'mockup', source: 'design/a.html', text: page, read: () => null, warnings: [] });
    // The diagram keeps drawing.js's name, the file's (Q7).
    assert.equal(name, undefined);
    assert.deepEqual(elements, [
      { key: 'token:--ink', kind: 'token', name: '--ink', detail: { values: ['#161616'], uses: 2 } },
      { key: 'token:--space', kind: 'token', name: '--space', detail: { values: ['8px'], uses: 1 } },
      { key: 'token:--brand', kind: 'token', name: '--brand', detail: { values: ['#0f62fe'], uses: 1 } },
    ]);
  });

  test('this repository\'s mockup page draws as the stored expected 95 tokens', () => {
    const stored = storedPicture();
    assert.equal(stored.sha256, sha256(readFileSync(new URL(`../../${PAGE}`, import.meta.url))), `${PAGE} changed: ${AGAIN}`);
    assert.deepEqual([stored.source, stored.part, stored.picture.key, stored.picture.stage], [PAGE, 'nexus', PAGE, STAGE]);
    const drawn = drawingOf(stored);
    assert.deepEqual(drawn, storedDrawing(), `the drawing of ${PAGE} changed: ${AGAIN}`);
    assert.equal(drawn.elements.length, 95);
    // Every token the page reads, it sets in both themes, the light one first, or in one place for both.
    for (const { kind, name, detail } of drawn.elements) {
      assert.equal(kind, 'token');
      assert.match(name, /^--[a-z0-9-]+$/);
      assert.ok(detail.values.length === 1 || detail.values.length === 2, name);
      assert.ok(detail.uses >= 1, name);
    }
    const background = drawn.elements.find((element) => element.name === '--background');
    assert.deepEqual(background.detail, { values: ['#f4f4f4', '#161616'], uses: 6 });
    // Six tokens are read only in style attributes of the page's templates.
    assert.ok(drawn.elements.some((element) => element.name === '--corthex-sticky-hotspot'));
  });

  test('reads var() in every style element and style attribute, templates included, and nowhere else (Q1)', () => {
    const page = [
      '<style>a { color: var(--sheet) } /* var(--css-comment) */ b::after { content: "var(--css-string)" }</style>',
      '<template><div style="color: var(--template)"></div><style>i { color: var(--template-sheet) }</style></template>',
      '<p STYLE=\'border-color: var(--upper)\' style="color: var(--second-style)">var(--text)</p>',
      '<!-- <p style="color: var(--html-comment)"> -->',
      '<script>el.style.color = "var(--script)"; const s = "<style>q{color:var(--script-sheet)}</style>";</script>',
      '<textarea><p style="color: var(--textarea)"></p></textarea><title>var(--title)</title>',
      '<noscript><p style="color: var(--noscript)"></p></noscript>',
      '<svg><rect style="fill: var(--svg)"/><style>rect { stroke: var(--svg-sheet) }</style></svg>',
      '<p style=color:var(--unquoted)>',
      '</p style="color: var(--end-tag)">',
      '<plaintext><p style="color: var(--plaintext)">',
    ].join('\n');
    assert.deepEqual(namesOf(page), ['--sheet', '--template', '--template-sheet', '--upper', '--svg', '--svg-sheet', '--unquoted']);
  });

  test('an HTML comment ends at its first "-->" or "--!>", or at once as "<!-->" and "<!--->"', () => {
    const style = (name) => `<p style="color: var(--${name})">`;
    const page = [
      `<!-- ${style('hidden-1')} --!>${style('after-bang')}`,
      `<!-- ${style('hidden-2')} --!> -->${style('after-both')}`,
      `<!-- ${style('hidden-3')} --> --!>${style('after-arrow')}`,
      `<!-->${style('abrupt')}<!--->${style('abrupt-dash')}`,
      `<!-- ${style('hidden-4')} --->${style('after-dashes')}`,
      `<!-- ${style('hidden-5')} -- ! > -- >${style('unclosed')}`,
    ].join('\n');
    assert.deepEqual(namesOf(page), ['--after-bang', '--after-both', '--after-arrow', '--abrupt', '--abrupt-dash', '--after-dashes']);
  });

  test('a fallback\'s var() reads its custom property too (Q2)', () => {
    assert.deepEqual(tokensOf(sheet('a { color: var(--a, var(--b, var(--c))); border: var(--d, 1px solid) }')), [
      ['--a', [], 1], ['--b', [], 1], ['--c', [], 1], ['--d', [], 1],
    ]);
  });

  test('a custom property set but never read is not listed, and one read but never set is, with no value (Q3, Q4)', () => {
    const page = sheet(':root { --set-only: red; --both: blue }', 'a { color: var(--both); background: var(--read-only) }');
    assert.deepEqual(tokensOf(page), [['--both', ['blue'], 1], ['--read-only', [], 1]]);
    for (const element of mockup({ text: page }).elements) assert.equal(element.status, undefined);
  });

  test('names a token as the page writes it, escapes resolved and case kept, in the order of first read (Q5)', () => {
    const page = [
      sheet('a { color: var(--Ink); x: var(--ink); y: VAR(--last); z: v\\61r(--esc\\:aped) }'),
      '<p style="color: var(--esc\\3a aped); background: var(&#45;&#x2d;ref&#x29;; border: var(--ink)">',
    ].join('');
    assert.deepEqual(tokensOf(page), [
      ['--Ink', [], 1], ['--ink', [], 2], ['--last', [], 1], ['--esc:aped', [], 2], ['--ref', [], 1],
    ]);
    // Not the var() function: another function, a name that only ends in var, or var() of no custom property.
    assert.deepEqual(namesOf(sheet('a { x: my-var(--no); y: -var(--no); z: var(-no); w: var(--); u: var( --spaced ) }')), ['--spaced']);
    // url() without quotes is one token: a var() in it is not read.
    assert.deepEqual(namesOf(sheet('a { background: url(var(--no)) var(--yes); b: url( "x" ) var(--also) }')), ['--yes', '--also']);
  });

  test('a token\'s values are the distinct values the page sets for it, in its order, up to 10, each cut to 200 characters (Q5)', () => {
    const long = 'x'.repeat(250);
    const page = [
      sheet(
        ':root { --a: red !important; --b: { nested: block }; --c :  1px   /* comment */ solid ; }',
        '@media (prefers-color-scheme: dark) { :root { --a: blue } }',
        'a { color: var(--a); x: var(--b); y: var(--c); z: var(--d); w: var(--e) } --d: no; a:hover { --d:yes }',
        `:root { --e: ${long}; ${Array.from({ length: 12 }, (_, index) => `--e: v${index}`).join('; ')}; --e: v0 }`,
        // A selector is no declaration.
        '--a: no {}',
      ),
      '<p style="--a: green; color: var(--a)"><i style="--a:red">',
    ].join('');
    const tokens = Object.fromEntries(tokensOf(page).map(([name, values, uses]) => [name, { values, uses }]));
    assert.deepEqual(tokens['--a'], { values: ['red', 'blue', 'green'], uses: 2 });
    assert.deepEqual(tokens['--b'].values, ['{ nested: block }']);
    assert.deepEqual(tokens['--c'].values, ['1px solid']);
    assert.deepEqual(tokens['--d'].values, ['yes']);
    assert.deepEqual(tokens['--e'].values, [`${'x'.repeat(199)}…`, 'v0', 'v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']);
  });

  test('a token has no box, no trace ID and no status, and its key is token: and its name (Q6)', () => {
    const [element] = mockup({ text: sheet('a { color: var(--ink) }') }).elements;
    assert.deepEqual(Object.keys(element).sort(), ['detail', 'key', 'kind', 'name']);
    assert.deepEqual(Object.keys(element.detail).sort(), ['uses', 'values']);
    // Names whose keys would meet get #2; a long name gets a key within the contract's 200 characters.
    const long = `--${'n'.repeat(300)}`;
    const keys = mockup({ text: sheet(`a { x: var(--a\\ \\ b); y: var(--a\\ b); z: var(${long}) }`) }).elements.map(({ key }) => key);
    assert.deepEqual(keys.slice(0, 2), ['token:--a b', 'token:--a b#2']);
    assert.ok([...keys[2]].length <= 200 && keys[2].startsWith('token:--nnn'));
  });

  test('a page fails at its source only when it reads more than 5000 tokens; any other text draws (Q8)', () => {
    assert.equal(mockup({ text: manyTokens(5000) }).elements.length, 5000);
    assert.throws(() => mockup({ text: manyTokens(5001) }), (error) => error instanceof SourceFailure && error.path === null && error.line === null);
    for (const text of ['', 'not HTML at all', '<style>a { color: var(</style>', '<p style="', '<!--', '<style>', '\u0000<style>a{x:var(--\u0000)}</style>']) {
      assert.doesNotThrow(() => mockup({ text }), JSON.stringify(text));
    }
    assert.deepEqual(namesOf('<style>a{x:var(--\u0000)}</style>'), ['--�']);
  });

  test('reads a page in time linear in its length: many comments, and a long value with white space', () => {
    // Each took minutes when a comment's end was searched to the page's end and !important by a pattern over the value.
    const comments = `${'<!--a-->'.repeat(100_000)}<style>a{x:var(--after)}</style>`;
    const blank = `<style>:root{--a:"${' '.repeat(500_000)}x"} a{x:var(--a)}</style>`;
    // Read in one pass, each takes milliseconds; the bound leaves a slow machine a wide margin.
    const timed = (read) => {
      const started = performance.now();
      const result = read();
      return { result, took: performance.now() - started };
    };
    const many = timed(() => namesOf(comments));
    assert.deepEqual(many.result, ['--after']);
    assert.ok(many.took < 5000, `100,000 comments took ${Math.round(many.took)} ms`);
    const long = timed(() => tokensOf(blank));
    assert.deepEqual(long.result.map(([name, values]) => [name, values[0].length]), [['--a', 200]]);
    assert.ok(long.took < 5000, `a value of 500,000 spaces took ${Math.round(long.took)} ms`);
  });

  test('leaves out a final !important by its tokens, escapes and white space included', () => {
    const values = (value) => tokensOf(sheet(`:root { --a: ${value} } a { x: var(--a) }`))[0][1];
    assert.deepEqual(values('red !important'), ['red']);
    assert.deepEqual(values('red ! IMPORTANT'), ['red']);
    assert.deepEqual(values('red!imp\\ortant'), ['red']);
    assert.deepEqual(values('red !important /* note */'), ['red']);
    assert.deepEqual(values('"!important"'), ['"!important"']);
    assert.deepEqual(values('red !notimportant'), ['red !notimportant']);
    assert.deepEqual(values('(!important)'), ['(!important)']);
  });

  test('is the server\'s drawer of the mockup kind', () => {
    assert.equal(DRAWERS.mockup, mockup);
  });
});

describe('a route\'s headers and media', () => {
  test('a route names its media for a GET only, and headers the server does not set itself', () => {
    const route = { method: 'GET', path: '/page', action: 'page', handle: () => ({}) };
    assert.doesNotThrow(() => createRouter([{ ...route, media: 'text/html', headers: { 'Content-Security-Policy': SANDBOX } }]));
    assert.throws(() => createRouter([{ ...route, media: 'text/plain' }]), /media/);
    assert.throws(() => createRouter([{ ...route, method: 'POST', media: 'text/html' }]), /media/);
    const own = ['Content-Type', 'content-length', 'Connection', 'X-Content-Type-Options', 'Transfer-Encoding', 'Keep-Alive', 'TE', 'Trailer', 'Upgrade', 'Proxy-Connection'];
    for (const name of own) {
      assert.throws(() => createRouter([{ ...route, headers: { [name]: 'x' } }]), /header/);
    }
    assert.throws(() => createRouter([{ ...route, headers: { 'X-Value': 'a\nb' } }]));
    assert.throws(() => createRouter([{ ...route, headers: [] }]), /headers/);
  });

  test('every answer of a route carries its headers, a refusal and a fault included, and a page is sent as its type', async (t) => {
    const handle = ({ request }) => {
      if (request.url === '/refused') throw new Problem('not_drawn');
      if (request.url === '/fault') return { text: 1 };
      return { text: '<p>page</p>', headers: { 'Cache-Control': 'private, no-store', 'Content-Security-Policy': 'not the route\'s' } };
    };
    const routes = ['/page', '/refused', '/fault'].map((path) => ({
      method: 'GET', path, action: `test ${path}`, family: 'none', media: 'text/html', headers: { 'Content-Security-Policy': SANDBOX }, handle,
    }));
    const server = await startServer({ routes });
    t.after(() => server.close());
    const page = await server.send({ path: '/page' });
    assert.deepEqual([page.status, page.text, page.headers['content-type'], page.headers['cache-control']], [200, '<p>page</p>', 'text/html; charset=utf-8', 'private, no-store']);
    const refused = await server.send({ path: '/refused' });
    assert.deepEqual([refused.status, refused.json.code, refused.headers['content-type']], [409, 'not_drawn', 'application/problem+json']);
    const fault = await server.send({ path: '/fault' });
    assert.deepEqual([fault.status, fault.json.code], [500, 'internal']);
    for (const answer of [page, refused, fault]) {
      assert.equal(answer.headers['content-security-policy'], SANDBOX);
      assert.equal(answer.headers['x-content-type-options'], NOSNIFF);
    }
    // A path the route does not match is not its answer.
    const other = await server.send({ path: '/elsewhere' });
    assert.deepEqual([other.status, other.headers['content-security-policy']], [404, undefined]);
  });
});

describe('API-293, the mockup page', () => {
  const responses = responseRecord();
  const answers = [];
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  // Every answer of the page: checked against the contract, and for the sandbox header and nosniff.
  const page = async (project, diagram, headers = owner(), on = server) => {
    const answer = responses.note(ACTION, await on.send({ path: `/api/projects/${project}/diagrams/${diagram}/page`, headers }));
    assert.equal(answer.headers['content-security-policy'], SANDBOX, `${answer.status}`);
    assert.equal(answer.headers['x-content-type-options'], NOSNIFF, `${answer.status}`);
    answers.push(answer);
    return answer;
  };
  const push = async (snapshot) => server.send({ method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...s.agent.headers }, body: JSON.stringify(snapshot) });
  // A corthex-hub/0.3 snapshot of this repository whose mockup page is text, or that has none.
  const snapshotWith = (name, text, options = {}) => {
    const snapshot = repositorySnapshot(FORMAT_03, { name, ...options });
    const at = snapshot.pictures.findIndex((picture) => picture.stage === STAGE);
    if (text === null) snapshot.pictures.splice(at, 1);
    else snapshot.pictures[at].source.text = text;
    return snapshot;
  };
  const diagramOf = (name, sourceKey = PAGE) => db.prepare(
    'SELECT d.* FROM diagrams d JOIN project_spaces p ON p.id = d.project_id WHERE p.name = ? AND d.source_key = ?',
  ).get(name, sourceKey);
  const idOfDiagram = (name, sourceKey) => idOf('dg', Number(diagramOf(name, sourceKey).id));
  const drawings = (diagramId) => db.prepare('SELECT * FROM drawings WHERE diagram_id = ? ORDER BY id').all(diagramId);
  const elements = (drawingId) => db.prepare('SELECT element_key, kind, name, detail FROM elements WHERE drawing_id = ? ORDER BY id').all(drawingId);
  // A page of its own, with a marker no log line may hold.
  const pageText = (marker) => `<!doctype html><title>${marker}</title><style>:root{--ink:#161616}main{color:var(--ink)}</style><main>${marker}</main>`;

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-mockup-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('serves the page the push kept, whole, as HTML in a sandbox with nosniff, and its tokens are the stored ones', async () => {
    const name = 'mockup-served';
    const stored = storedPicture();
    const pushed = await push(snapshotWith(name, stored.picture.source.text));
    assert.equal(pushed.status, 201);
    const diagram = diagramOf(name);
    assert.deepEqual([diagram.kind, diagram.name, diagram.stage], ['mockup', 'nexus-mockup.html', STAGE]);
    const [drawing] = drawings(diagram.id);
    assert.equal(drawing.status, 'drawn');
    // The server's own drawer drew the stored expected tokens.
    assert.deepEqual(elements(drawing.id).map((row) => ({ key: row.element_key, kind: row.kind, name: row.name, detail: JSON.parse(row.detail) })),
      storedDrawing().elements);

    const answer = await page(name, idOf('dg', Number(diagram.id)));
    assert.equal(answer.status, 200);
    assert.equal(answer.text, stored.picture.source.text);
    assert.equal(answer.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(answer.headers['cache-control'], 'private, no-store');
    assert.equal(Number(answer.headers['content-length']), Buffer.byteLength(stored.picture.source.text));
    // The policy is the contract's, sent once.
    assert.equal(answer.rawHeaders.filter((header) => header.toLowerCase() === 'content-security-policy').length, 1);
  });

  test('a failed drawing serves the last good page, and the push names where it failed', async () => {
    const name = 'mockup-failed';
    const first = pageText('the first page');
    const commit = newCommit();
    assert.equal((await push(snapshotWith(name, first, { commit }))).status, 201);
    const id = idOfDiagram(name, PAGE);
    const failing = await push(snapshotWith(name, manyTokens(5001), { replaces: commit }));
    assert.equal(failing.status, 200);
    assert.deepEqual(failing.json.failures.filter((failure) => failure.stage === STAGE), [{ diagram: id, part: 'nexus', stage: STAGE, where: PAGE }]);
    const [good, failed] = drawings(diagramOf(name).id);
    assert.deepEqual([good.status, failed.status, failed.failed_path, failed.failed_line], ['drawn', 'failed', PAGE, null]);
    const answer = await page(name, id);
    assert.deepEqual([answer.status, answer.text], [200, first]);
  });

  test('a mockup that never drew answers 409 not_drawn, which names the reason (done condition)', async () => {
    const name = 'mockup-never-drawn';
    const pushed = await push(snapshotWith(name, manyTokens(5001)));
    assert.equal(pushed.status, 201);
    const id = idOfDiagram(name, PAGE);
    assert.deepEqual(pushed.json.failures.filter((failure) => failure.stage === STAGE), [{ diagram: id, part: 'nexus', stage: STAGE, where: PAGE }]);
    const answer = await page(name, id);
    assert.deepEqual([answer.status, answer.json.code], [409, 'not_drawn']);
    assert.equal(answer.json.detail, 'the mockup\'s document has never drawn; fix it and push again');
    // The diagram is named by its file while it has never drawn.
    assert.equal(diagramOf(name).name, 'nexus-mockup.html');
  });

  test('a removed mockup still serves its last good page (Q9)', async () => {
    const name = 'mockup-removed';
    const text = pageText('a removed page');
    const commit = newCommit();
    assert.equal((await push(snapshotWith(name, text, { commit }))).status, 201);
    const id = idOfDiagram(name, PAGE);
    assert.equal((await push(snapshotWith(name, null, { replaces: commit }))).status, 200);
    assert.notEqual(diagramOf(name).removed_at, null);
    const answer = await page(name, id);
    assert.deepEqual([answer.status, answer.text], [200, text]);
  });

  test('an unknown project, a diagram that is no mockup of the project and a malformed ID get their 404s', async () => {
    const name = 'mockup-targets';
    const other = 'mockup-targets-other';
    assert.equal((await push(snapshotWith(name, pageText('target')))).status, 201);
    assert.equal((await push(snapshotWith(other, pageText('another project')))).status, 201);
    const mockupId = idOfDiagram(name, PAGE);
    for (const project of ['no-such-project', 'Upper', 'a--b', 'x'.repeat(65), '%2e%2e']) {
      const answer = await page(project, mockupId);
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], project);
      assert.equal(answer.json.detail.includes(project), false);
    }
    // Another kind's diagram, another project's mockup, an ID of no diagram, a malformed ID, and one past the keys the
    // store holds.
    const erdId = idOfDiagram(name, '/pictures/05-erd/nexus');
    const targets = [erdId, idOfDiagram(other, PAGE), idOf('dg', 999999), 'dg_x', 'abc', 'dg_zzzzzzzzzzzz', 'dg_ilou00000001'];
    for (const diagram of targets) {
      const answer = await page(name, diagram);
      assert.deepEqual([answer.status, answer.json.code], [404, 'diagram_not_found'], diagram);
      assert.equal(answer.json.detail.includes(diagram), false);
    }
    assert.equal((await page(name, erdId)).json.detail, 'no mockup has this ID in the project');
  });

  test('refuses a request without the owner\'s sign-in, of another person, or with an agent credential, and sends no page', async () => {
    const name = 'mockup-refused';
    const marker = `a page only the owner sees ${randomUUID()}`;
    assert.equal((await push(snapshotWith(name, pageText(marker)))).status, 201);
    const id = idOfDiagram(name, PAGE);
    const none = await page(name, id, {});
    assert.deepEqual([none.status, none.json.code], [401, 'unauthenticated']);
    const someone = await page(name, id, { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) });
    assert.deepEqual([someone.status, someone.json.code], [403, 'not_owner']);
    const agent = await page(name, id, s.agent.headers);
    assert.deepEqual([agent.status, agent.json.code], [403, 'owner_only']);
    for (const answer of [none, someone, agent]) assert.equal(answer.text.includes(marker), false);
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const space = seed(store).project('mockup-broken');
    // A store whose diagrams cannot be read, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM diagrams d')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const answer = await page(space.name, idOf('dg', 1), owner(), other);
    assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    const [line] = await other.logged(1);
    assert.equal(line.error, 'Error');
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('reads only: the store is the same after a page is served', async () => {
    const name = 'mockup-read-only';
    assert.equal((await push(snapshotWith(name, pageText('read only')))).status, 201);
    const tables = ['project_spaces', 'snapshots', 'snapshot_files', 'document_blobs', 'diagrams', 'drawings', 'elements', 'todos'];
    const rows = () => JSON.stringify(tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const before = rows();
    assert.equal((await page(name, idOfDiagram(name, PAGE))).status, 200);
    assert.equal(rows(), before);
  });

  test('logs one line per request with its sender, and never the page\'s text or the data folder (rule 5)', async () => {
    const name = 'mockup-logged';
    const marker = `A page text no log line may hold ${randomUUID()}`;
    assert.equal((await push(snapshotWith(name, pageText(marker)))).status, 201);
    assert.equal((await page(name, idOfDiagram(name, PAGE))).text.includes(marker), true);
    const lines = (await server.logged(10)).filter((line) => line.action === ACTION);
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [marker, 'no log line may hold', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('every answer carried the sandbox header and nosniff (done condition)', () => {
    assert.ok(answers.length >= 20);
    const statuses = new Set(answers.map((answer) => answer.status));
    assert.deepEqual([...statuses].sort(), [200, 401, 403, 404, 409, 500]);
    for (const answer of answers) {
      assert.deepEqual([answer.headers['content-security-policy'], answer.headers['x-content-type-options']], [SANDBOX, NOSNIFF]);
    }
  });

  test('answers every response API-293 lists', () => {
    responses.assertEvery(ACTION);
  });

  test('touches the tables its x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getMockupPage');
    checkLayer(recorder);
  });
});
