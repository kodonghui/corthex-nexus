// Tool links (TASK-451; API-282, API-283, SPEC-046, SPEC-047, rule 5): every response the two operations list, their
// answers against the contract's ToolLink and Removed, which addresses count as a Notion page or a Jira project, the
// same link again, the 200 links a project holds, the tables they touch (note 23) and their log lines. The server
// keeps the link only: no test reaches Notion, Jira or any network.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { toolLinkOf } from '../src/tool-links.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
const START = Date.parse('2026-11-24T01:00:00.000Z');
const at = (minutes) => new Date(START + minutes * 60 * 1000).toISOString();
const notion = () => `https://www.notion.so/example/Meeting-notes-${randomBytes(16).toString('hex')}`;
const JIRA = 'https://example.atlassian.net/jira/software/projects/BOOK/boards/1';
const NOT_A_TOOL = 'url must be the address of a Notion page or a Jira project';
const AT = '@';

describe('tool links', () => {
  const responses = responseRecord();
  const clock = { now: START };
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  // Headers with those given as undefined left out, so that a test can send a request without one.
  const clean = (headers) => Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
  const add = async (name, body, headers = {}) => responses.note('addToolLink', await server.send({
    method: 'POST',
    path: `/api/projects/${name}/tool-links`,
    headers: clean({ ...JSON_TYPE, ...owner(), ...key(), ...headers }),
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const remove = async (name, link, headers = {}) => responses.note('removeToolLink', await server.send({
    method: 'DELETE',
    path: `/api/projects/${name}/tool-links/${link}`,
    headers: clean({ ...owner(), ...key(), ...headers }),
  }));
  const listed = async (name) => (await server.send({ path: `/api/projects/${name}`, headers: owner() })).json.tool_links;
  const rows = (space) => db.prepare('SELECT id, scope, tool, url, removed_at FROM tool_links WHERE project_id = ? ORDER BY id').all(space.id);
  const refusedOn = (answer, field) => assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field]);

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-tool-links-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES, now: () => clock.now });
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('links a Notion page to a stage and a Jira project to the project, each "not read yet" (SPEC-046)', async () => {
    const space = s.project();
    const page = notion();
    clock.now = Date.parse(at(1));
    const first = await add(space.name, { scope: '02-prd', url: page });
    assert.equal(first.status, 201);
    const [row] = rows(space);
    assert.deepEqual(first.json, {
      id: idOf('tl', Number(row.id)), scope: '02-prd', tool: 'notion', url: page, status: null, status_read_at: null, added_at: at(1),
    });
    clock.now = Date.parse(at(2));
    const second = await add(space.name, { scope: 'project', url: JIRA });
    assert.equal(second.status, 201);
    assert.deepEqual([second.json.scope, second.json.tool, second.json.url, second.json.added_at], ['project', 'jira', JIRA, at(2)]);
    // The project read lists them, oldest first, as they were answered.
    assert.deepEqual(await listed(space.name), [first.json, second.json]);
  });

  test('counts an address by its host, whatever its path, and keeps it with its host in lower case and without :443 or its fragment', () => {
    for (const [text, tool, kept = text] of [
      ['https://notion.so/Page-0123', 'notion'],
      ['https://www.notion.so/example/Page-0123456789abcdef0123456789abcdef', 'notion'],
      // A database is a Notion address too: the server reads no tool, so it cannot tell a page from a database.
      ['https://www.notion.so/0123456789abcdef0123456789abcdef?v=fedcba9876543210', 'notion'],
      ['https://example.notion.site/Public-page-0123', 'notion'],
      ['https://app.notion.com/p/0123456789abcdef0123456789abcdef', 'notion'],
      ['https://notion.com/x', 'notion'],
      ['https://www.notion.so/모임-운영-노트-0123', 'notion'],
      ['https://www.notion.so', 'notion'],
      ['https://example.atlassian.net/browse/BOOK', 'jira'],
      // A board or a filter is a Jira address too.
      [JIRA, 'jira'],
      ['https://example.atlassian.net/issues/?filter=10001', 'jira'],
      ['https://example.atlassian.net/wikipedia', 'jira'],
      ['https://WWW.Notion.SO:443/Page-0123?pvs=4#block-1', 'notion', 'https://www.notion.so/Page-0123?pvs=4'],
      ['https://Example.Atlassian.NET/browse/BOOK#comment', 'jira', 'https://example.atlassian.net/browse/BOOK'],
      ['https://www.notion.so?pvs=4', 'notion'],
      [`https://www.notion.so/${'a'.repeat(1978)}`, 'notion'],
    ]) {
      assert.deepEqual(toolLinkOf(text), { tool, url: kept }, text);
    }
  });

  test('refuses an address that is not https, not Notion\'s or Jira\'s, or holds a user name, password or port', () => {
    for (const text of [
      'http://www.notion.so/Page-0123',
      'ftp://www.notion.so/Page-0123',
      'javascript:alert(1)',
      '',
      'https://',
      'https://notion.so.example.com/x',
      'https://evilnotion.so/x',
      'https://example.com/www.notion.so',
      'https://example.com/?next=https://www.notion.so',
      'https://atlassian.net/browse/BOOK',
      'https://example.atlassian.net.example.com/browse/BOOK',
      'https://example.atlassian.net/wiki/spaces/BOOK/overview',
      'https://example.atlassian.net/wiki',
      'https://example.atlassian.net/WIKI/spaces/BOOK',
      'https://example.atlassian.net/%77iki/spaces/BOOK',
      // A user name and a password before the host, joined at run time so that no text here reads as an e-mail address.
      ['https://user:pass', 'www.notion.so/x'].join(AT),
      ['https://user', 'www.notion.so/x'].join(AT),
      `https://${AT}www.notion.so/x`,
      'https://www.notion.so:8443/x',
      'https://evil.example\\@www.notion.so/x',
      'https://evil.example\\.notion.so/x',
      'https://www%2Enotion.so/x',
      'https://www.notion.so./x',
      'https:///www.notion.so/x',
      'https://Ünicode.atlassian.net/browse/BOOK',
      'https://www.notion.so/a b',
      'https://www.notion.so/x\u0000',
      'https://www.notion.so/x\u0085',
      'https://www.notion.so/\ud800',
      `https://www.notion.so/${'a'.repeat(1979)}`,
    ]) {
      assert.throws(() => toolLinkOf(text), (error) => error.code === 'invalid_request' && error.members.field === 'url', JSON.stringify(text));
    }
    assert.throws(() => toolLinkOf(42), (error) => error.code === 'invalid_request' && error.members.field === 'url');
  });

  test('refuses a body that breaks the contract, naming the field and never the address', async () => {
    const space = s.project();
    const secretish = `https://example.com/${randomBytes(12).toString('hex')}`;
    const refused = await add(space.name, { scope: 'project', url: secretish });
    refusedOn(refused, 'url');
    assert.equal(refused.json.detail, NOT_A_TOOL);
    assert.equal(refused.text.includes(secretish), false);
    for (const [body, field] of [
      [{ url: notion() }, 'scope'],
      [{ scope: '14-other', url: notion() }, 'scope'],
      [{ scope: 2, url: notion() }, 'scope'],
      [{ scope: 'project' }, 'url'],
      [{ scope: 'project', url: 42 }, 'url'],
      [{ scope: 'project', url: 'http://www.notion.so/x' }, 'url'],
      [{ scope: 'project', url: notion(), tool: 'notion' }, 'body'],
      ['{"scope":', 'body'],
      ['[]', 'body'],
    ]) {
      refusedOn(await add(space.name, body), field);
    }
    const unkeyed = await add(space.name, { scope: 'project', url: notion() }, { 'Idempotency-Key': undefined });
    refusedOn(unkeyed, 'Idempotency-Key');
    const wrongType = await add(space.name, { scope: 'project', url: notion() }, { 'Content-Type': 'text/plain' });
    assert.deepEqual([wrongType.status, wrongType.json.code], [415, 'json_required']);
    const { answers } = await exchange(server.port, [head('POST', `/api/projects/${space.name}/tool-links`, {
      ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 2 * MiB + 1,
    })]);
    assert.equal(answers.length, 1);
    responses.note('addToolLink', answers[0]);
    assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    assert.deepEqual(rows(space), []);
  });

  test('the same link again answers 200 with the link kept, however its host is written; another scope or query is another link', async () => {
    const space = s.project();
    const page = notion();
    const first = await add(space.name, { scope: '05-erd', url: page });
    assert.equal(first.status, 201);
    const loud = page.replace('https://www.notion.so', 'https://WWW.NOTION.SO:443');
    for (const url of [page, loud, `${page}#block-0123`]) {
      const again = await add(space.name, { scope: '05-erd', url });
      assert.equal(again.status, 200, url);
      assert.deepEqual(again.json, first.json);
    }
    const otherScope = await add(space.name, { scope: '06-api', url: page });
    const otherQuery = await add(space.name, { scope: '05-erd', url: `${page}?pvs=4` });
    assert.deepEqual([otherScope.status, otherQuery.status], [201, 201]);
    assert.equal(new Set([first.json.id, otherScope.json.id, otherQuery.json.id]).size, 3);
    assert.equal(rows(space).length, 3);
  });

  test('a request key repeats its first answer and writes nothing; used for another request it is refused', async () => {
    const space = s.project();
    const requestKey = key();
    const body = { scope: 'project', url: notion() };
    const first = await add(space.name, body, requestKey);
    assert.equal(first.status, 201);
    clock.now += 60_000;
    const repeat = await add(space.name, body, requestKey);
    assert.deepEqual([repeat.status, repeat.json], [201, first.json]);
    assert.equal(rows(space).length, 1);
    const reused = await add(space.name, { scope: 'project', url: notion() }, requestKey);
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    const removing = await remove(space.name, first.json.id, requestKey);
    assert.deepEqual([removing.status, removing.json.code], [409, 'request_key_reused']);
    const removeKey = key();
    const removed = await remove(space.name, first.json.id, removeKey);
    const removedAgain = await remove(space.name, first.json.id, removeKey);
    assert.deepEqual([removed.json, removedAgain.json], [{ id: first.json.id, changed: true }, { id: first.json.id, changed: true }]);
    assert.equal(rows(space).length, 1);
  });

  test('a project holds at most 200 live links: the 201st is refused, the same link still answers, and one removed makes room', async () => {
    const space = s.project();
    const urls = Array.from({ length: 200 }, () => notion());
    db.exec('BEGIN');
    try {
      for (const [n, url] of urls.entries()) s.toolLink(space, { url, addedAt: at(n) });
      // Removed links do not count.
      for (let n = 0; n < 3; n += 1) s.toolLink(space, { removed: true });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const full = await add(space.name, { scope: 'project', url: notion() });
    refusedOn(full, 'url');
    assert.equal(full.json.detail, 'a project holds at most 200 tool links');
    const same = await add(space.name, { scope: 'project', url: urls[7] });
    assert.equal(same.status, 200);
    assert.equal((await remove(space.name, same.json.id)).json.changed, true);
    const room = await add(space.name, { scope: 'project', url: notion() });
    assert.equal(room.status, 201);
    assert.equal((await listed(space.name)).length, 200);
  });

  test('removes a link, and removing it again changes nothing; added again, it is a new link (SPEC-047)', async () => {
    const space = s.project();
    const page = notion();
    const linked = await add(space.name, { scope: '09-mockup', url: page });
    const kept = await add(space.name, { scope: 'project', url: JIRA });
    clock.now = Date.parse(at(30));
    const removed = await remove(space.name, linked.json.id);
    assert.deepEqual([removed.status, removed.json], [200, { id: linked.json.id, changed: true }]);
    assert.deepEqual(await listed(space.name), [kept.json]);
    const removedAt = rows(space)[0].removed_at;
    assert.equal(removedAt, at(30));
    clock.now = Date.parse(at(40));
    const again = await remove(space.name, linked.json.id);
    assert.deepEqual([again.status, again.json], [200, { id: linked.json.id, changed: false }]);
    assert.equal(rows(space)[0].removed_at, removedAt);
    const relinked = await add(space.name, { scope: '09-mockup', url: page });
    assert.equal(relinked.status, 201);
    assert.notEqual(relinked.json.id, linked.json.id);
  });

  test('a link of another project or an ID no link has is tool_link_not_found, and a name no space has project_not_found, neither repeating it', async () => {
    const space = s.project();
    const other = s.project();
    const theirs = await add(other.name, { scope: 'project', url: notion() });
    for (const link of [theirs.json.id, idOf('tl', 999_999_999), 'tl_0000000000000', 'tl_short', 'not-a-link']) {
      const answer = await remove(space.name, link);
      assert.deepEqual([answer.status, answer.json.code], [404, 'tool_link_not_found'], link);
      assert.equal(answer.json.detail.includes(link), false);
    }
    assert.equal(rows(other)[0].removed_at, null);
    const missing = `nobody-${randomBytes(4).toString('hex')}`;
    for (const answer of [await add(missing, { scope: 'project', url: notion() }), await remove(missing, theirs.json.id)]) {
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found']);
      assert.equal(answer.text.includes(missing), false);
    }
    const unkeyed = await remove(space.name, theirs.json.id, { 'Idempotency-Key': undefined });
    refusedOn(unkeyed, 'Idempotency-Key');
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site', async () => {
    const space = s.project();
    const linked = await add(space.name, { scope: 'project', url: notion() });
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const [headers, status, code] of [
      [{ 'Cf-Access-Jwt-Assertion': undefined }, 401, 'unauthenticated'],
      [someone, 403, 'not_owner'],
      [{ 'Cf-Access-Jwt-Assertion': undefined, ...s.agent.headers }, 403, 'owner_only'],
      [{ 'Sec-Fetch-Site': 'cross-site' }, 403, 'cross_site'],
      [{ 'Sec-Fetch-Site': 'same-site' }, 403, 'cross_site'],
    ]) {
      const adding = await add(space.name, { scope: 'project', url: notion() }, headers);
      assert.deepEqual([adding.status, adding.json.code], [status, code]);
      const removing = await remove(space.name, linked.json.id, headers);
      assert.deepEqual([removing.status, removing.json.code], [status, code]);
    }
    assert.deepEqual(rows(space).map((row) => row.removed_at), [null]);
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    // A store whose tool link statements cannot be prepared, as when the disk fails.
    const failing = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('tool_links')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const broken = await startServer({ store: failing, gate: local.gate, routes: ROUTES });
    t.after(() => broken.close());
    const added = await broken.send({
      method: 'POST', path: '/api/projects/demo/tool-links', headers: { ...JSON_TYPE, ...owner(), ...key() }, body: JSON.stringify({ scope: 'project', url: notion() }),
    });
    const removed = await broken.send({ method: 'DELETE', path: `/api/projects/demo/tool-links/${idOf('tl', 1)}`, headers: { ...owner(), ...key() } });
    responses.note('addToolLink', added);
    responses.note('removeToolLink', removed);
    assert.deepEqual([added.status, added.json.code, removed.status, removed.json.code], [500, 'internal', 500, 'internal']);
    assert.deepEqual((await broken.logged(2)).map((line) => line.error), ['Error', 'Error']);
    assert.equal(broken.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s name, an address or the data folder (rule 5)', async () => {
    const name = `lima-${randomBytes(6).toString('hex')}`;
    const space = s.project(name);
    const page = notion();
    const linked = await add(space.name, { scope: 'project', url: page });
    await add(space.name, { scope: 'project', url: `https://example.com/${randomBytes(8).toString('hex')}` });
    await remove(space.name, linked.json.id);
    const lines = (await server.logged(3)).filter((line) => ['addToolLink', 'removeToolLink'].includes(line.action));
    assert.ok(lines.length >= 3);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [name, page, 'notion.so', 'example.com', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answers every response API-282 and API-283 list', () => {
    responses.assertEvery('addToolLink');
    responses.assertEvery('removeToolLink');
  });

  test('touches the tables their x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'addToolLink');
    checkTables(recorder, 'removeToolLink');
    checkLayer(recorder);
  });
});
