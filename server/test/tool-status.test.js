// The tool status read (TASK-467; SPEC-046, REQ-058, REQ-061; TBL-168), with the tools' answers stubbed: no test has
// a real token or reaches Notion or Jira. The tokens, the cloud ID and the page IDs are made at run time, so that no
// token-like text is written into the repository; the site and the account are placeholders.

import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { idOf } from '../src/ids.js';
import {
  ANSWER_BYTES, categoryQuery, createToolStatus, GAP_MS, INTERVAL_MS, JIRA_API, jiraProjectOf, LOOK_MS, NOTION_API,
  NOTION_VERSION, notionPageOf, notionStatus, statusText, TRASHED,
} from '../src/tool-status.js';
import { createQueue } from '../src/writes.js';
import { seed } from './seed.js';
import { testStore } from './support.js';

const START = Date.parse('2026-11-24T01:00:00.000Z');
const SITE = 'example.atlassian.net';
const EMAIL = 'owner@example.com';
const NOTION_TOKEN = randomBytes(24).toString('hex');
const JIRA_TOKEN = randomBytes(24).toString('base64url');
const CLOUD_ID = randomUUID();
const BASIC = `Basic ${Buffer.from(`${EMAIL}:${JIRA_TOKEN}`).toString('base64')}`;
const SETTINGS = Object.freeze({
  notion: Object.freeze({ token: NOTION_TOKEN }),
  jira: Object.freeze({ site: SITE, cloudId: CLOUD_ID, email: EMAIL, token: JIRA_TOKEN }),
});
const COUNT_URL = `${JIRA_API}/ex/jira/${CLOUD_ID}/rest/api/3/search/approximate-count`;
const hex32 = () => randomBytes(16).toString('hex');
const projectKey = () => `K${randomBytes(4).toString('hex').toUpperCase()}`;
const notionLink = (page) => `https://www.notion.so/example/Meeting-notes-${page}`;
const jiraLink = (key) => `https://${SITE}/jira/software/projects/${key}/boards/1`;

const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', ...headers },
});
const page = (properties = {}, extra = {}) => json({ object: 'page', id: randomUUID(), properties, ...extra });
const statusProperty = (name) => ({ id: 'a', type: 'status', status: name === null ? null : { id: 'b', name, color: 'blue' } });
const selectProperty = (name) => ({ id: 'c', type: 'select', select: { id: 'd', name, color: 'red' } });
// A 200 answer whose body fails while it is read, as a timeout or a dropped connection makes it.
const broken = (error) => new Response(new ReadableStream({ pull(controller) { controller.error(error); } }), { status: 200 });

// A clock whose time moves only when the test moves it, with timers that fire as it passes them.
function fakeClock(start = START) {
  let current = start;
  let next = 0;
  const pending = new Map();
  const settle = async () => {
    for (let n = 0; n < 5; n += 1) await new Promise((resolve) => { setImmediate(resolve); });
  };
  return {
    now: () => current,
    pending: () => pending.size,
    timers: {
      setTimeout(callback, ms) {
        next += 1;
        pending.set(next, { at: current + Math.max(0, ms), callback });
        return next;
      },
      clearTimeout(id) {
        pending.delete(id);
      },
    },
    async advance(ms) {
      const until = current + ms;
      for (;;) {
        await settle();
        let due = null;
        for (const [id, timer] of pending) {
          if (timer.at <= until && (due === null || timer.at < due[1].at)) due = [id, timer];
        }
        if (due === null) break;
        pending.delete(due[0]);
        current = due[1].at;
        due[1].callback();
      }
      current = until;
      await settle();
    },
  };
}

// The tools' answers: notion(call) and jira(call) answer each request to their host; any other host fails, as an
// address the server must never ask would. calls lists every request, with its headers and body.
function stubTools({ notion = () => page(), jira = () => json({ count: 0 }) } = {}) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const call = { url: String(url), init, headers: init.headers ?? {}, body: init.body };
    calls.push(call);
    const { origin } = new URL(call.url);
    if (origin === NOTION_API) return notion(call);
    if (origin === JIRA_API) return jira(call);
    throw new TypeError('fetch failed');
  };
  return { fetch, calls };
}

// A store with one project space, the job over it with the stubbed tools and the fake clock, and helpers.
function setup(t, { settings = SETTINGS, notion, jira, queue = createQueue(), fetch } = {}) {
  const db = testStore(t);
  const space = seed(db).project('tools');
  const clock = fakeClock();
  const lines = [];
  const stub = stubTools({ notion, jira });
  const job = createToolStatus({
    store: db, settings, queue, log: (line) => lines.push(line), fetch: fetch ?? stub.fetch, now: clock.now, timers: clock.timers,
  });
  t.after(() => job.stop());
  const link = (tool, url) => Number(db.prepare(
    "INSERT INTO tool_links (project_id, scope, tool, url, added_at) VALUES (?, 'project', ?, ?, ?)",
  ).run(space.id, tool, url, new Date(clock.now()).toISOString()).lastInsertRowid);
  const row = (id) => ({ ...db.prepare('SELECT status, status_read_at FROM tool_links WHERE id = ?').get(id) });
  // One look, run to its end: the clock moves by the gap between requests until it is done.
  const round = async () => {
    let done = false;
    const running = job.round().then(() => { done = true; });
    for (let n = 0; n < 2000 && !done; n += 1) await clock.advance(GAP_MS);
    await running;
  };
  const at = () => new Date(clock.now()).toISOString();
  return { db, job, clock, stub, lines, link, row, round, at };
}

test('with no token set, nothing is called and every link keeps "not read yet"', async (t) => {
  const env = setup(t, { settings: { notion: null, jira: null } });
  const notion = env.link('notion', notionLink(hex32()));
  const jira = env.link('jira', jiraLink(projectKey()));
  env.job.start();
  assert.equal(env.clock.pending(), 0);
  await env.round();
  await env.clock.advance(2 * INTERVAL_MS);
  assert.deepEqual(env.stub.calls, []);
  assert.deepEqual([env.row(notion), env.row(jira)], [{ status: null, status_read_at: null }, { status: null, status_read_at: null }]);
  assert.deepEqual(env.lines, []);
});

test('a link gives a Notion page ID of exactly 32 hex digits, or a Jira project key of Jira\'s form on the one site', () => {
  const id = hex32();
  const dashed = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
  for (const [url, expected] of [
    [`https://www.notion.so/${id}`, id],
    [`https://www.notion.so/team/Page-title-${id}`, id],
    [`https://www.notion.so/team/Page-title-${id.toUpperCase()}`, id],
    [`https://app.notion.com/p/${dashed}`, id],
    [`https://team.notion.site/Title-${dashed}?pvs=4`, id],
    [`https://www.notion.so/team/%ED%9A%8C%EC%9D%98-${id}/`, id],
    // Not exactly 32 hex digits, a database view, or no ID.
    [`https://www.notion.so/team/Page-${id.slice(1)}`, null],
    [`https://www.notion.so/team/Page-a${id}`, null],
    [`https://www.notion.so/team/Page${id}`, null],
    [`https://www.notion.so/team/${id}?v=${hex32()}`, null],
    ['https://www.notion.so/team', null],
    ['https://www.notion.so/', null],
  ]) assert.equal(notionPageOf(url), expected, url);
  const key = 'BOOK_2';
  for (const [url, expected] of [
    [`https://${SITE}/browse/${key}`, key],
    [`https://${SITE}/browse/${key}-12`, key],
    [`https://${SITE}/browse/${key}/`, key],
    [`https://${SITE}/jira/software/projects/${key}/boards/1`, key],
    [`https://${SITE}/jira/software/c/projects/${key}/issues?filter=all`, key],
    [`https://${SITE}/jira/core/projects/${key}`, key],
    [`https://${SITE}/jira/servicedesk/projects/${key}/queues`, key],
    [`https://${SITE}/browse/${'A'.repeat(255)}`, 'A'.repeat(255)],
    // Another site, a key out of Jira's form, a query that a key would carry into JQL, or no key.
    [`https://other.atlassian.net/browse/${key}`, null],
    [`https://${SITE}/browse/book`, null],
    [`https://${SITE}/browse/B`, null],
    [`https://${SITE}/browse/1BOOK`, null],
    [`https://${SITE}/browse/${'A'.repeat(256)}`, null],
    [`https://${SITE}/browse/BOOK%22%20OR%20project%20%3D%20%22X`, null],
    [`https://${SITE}/browse/BOOK"OR"X`, null],
    [`https://${SITE}//browse/${key}`, null],
    [`https://${SITE}/issues/?jql=project%3DBOOK`, null],
    [`https://${SITE}/jira/dashboards/10000`, null],
  ]) assert.equal(jiraProjectOf(url, SITE), expected, url);
  assert.equal(categoryQuery('BOOK', 'To Do'), 'project = "BOOK" AND statusCategory = "To Do"');
  assert.throws(() => categoryQuery('BOOK" OR project = "X', 'Done'), TypeError);
});

test('Notion: the page\'s status property, else a select named Status or 상태, else none; the trash; names kept as text', async (t) => {
  const pages = new Map();
  const env = setup(t, { notion: (call) => pages.get(call.url.split('/').at(-1))() });
  const cases = [
    [() => page({ Name: { type: 'title', title: [] }, Stage: statusProperty('In progress'), Other: statusProperty('Later') }), 'In progress'],
    [() => page({ 상태: selectProperty('검토 중') }), '검토 중'],
    [() => page({ ' STATUS ': selectProperty('Draft'), Kind: selectProperty('Spec') }), 'Draft'],
    [() => page({ Kind: selectProperty('Spec') }), null],
    [() => page({ Stage: statusProperty(null) }), null],
    [() => page({}), null],
    [() => page({ Stage: statusProperty('Done') }, { in_trash: true }), TRASHED],
    [() => page({}, { archived: true }), TRASHED],
    [() => page({ Stage: statusProperty(`a\nb\u0000c d  ${'e'.repeat(200)}`) }), `a b c d ${'e'.repeat(111)}…`],
  ];
  const links = cases.map(([answer]) => {
    const id = hex32();
    pages.set(id, answer);
    return env.link('notion', notionLink(id));
  });
  await env.round();
  const readAt = env.row(links[0]).status_read_at;
  assert.ok(readAt !== null);
  assert.deepEqual(links.map((id) => env.row(id).status), cases.map(([, status]) => status));
  for (const id of links) assert.notEqual(env.row(id).status_read_at, null);
  assert.equal([...env.row(links.at(-1)).status].length, 120);
  assert.equal(env.stub.calls.length, cases.length);
  for (const call of env.stub.calls) {
    assert.equal(call.init.method, 'GET');
    assert.match(call.url, new RegExp(`^${NOTION_API}/v1/pages/[0-9a-f]{32}$`));
    assert.deepEqual(call.headers, { accept: 'application/json', authorization: `Bearer ${NOTION_TOKEN}`, 'notion-version': NOTION_VERSION });
  }
  assert.deepEqual(env.lines.map(({ event, tool, read, failed }) => [event, tool, read, failed]), [['tool_status_read', 'notion', cases.length, 0]]);
});

test('Jira: the project\'s work items by status category, from three counts on the gateway, for the one site only', async (t) => {
  const counts = { 'To Do': 3, 'In Progress': 2, Done: 10 };
  const env = setup(t, {
    jira: (call) => json({ count: counts[/statusCategory = "([^"]+)"/.exec(JSON.parse(call.body).jql)[1]] }),
  });
  const key = projectKey();
  const read = env.link('jira', jiraLink(key));
  const issue = env.link('jira', `https://${SITE}/browse/${key}-7`);
  const other = env.link('jira', `https://other.atlassian.net/browse/${key}`);
  const board = env.link('jira', `https://${SITE}/jira/dashboards/10000`);
  await env.round();
  assert.deepEqual(env.row(read).status, '할 일 3 · 진행 중 2 · 완료 10');
  assert.deepEqual(env.row(issue).status, '할 일 3 · 진행 중 2 · 완료 10');
  assert.deepEqual([env.row(other), env.row(board)], [{ status: null, status_read_at: null }, { status: null, status_read_at: null }]);
  assert.equal(env.stub.calls.length, 6);
  for (const [index, call] of env.stub.calls.entries()) {
    assert.equal(call.url, COUNT_URL);
    assert.equal(call.init.method, 'POST');
    assert.deepEqual(call.headers, { accept: 'application/json', 'content-type': 'application/json', authorization: BASIC });
    const category = ['To Do', 'In Progress', 'Done'][index % 3];
    assert.deepEqual(JSON.parse(call.body), { jql: `project = "${key}" AND statusCategory = "${category}"` });
  }
  assert.deepEqual(env.lines.map(({ tool, read: n, failed, no_id: none }) => [tool, n, failed, none]), [['jira', 2, 0, 2]]);
  // A count that is not a whole number is a bad answer: nothing is kept.
  const bad = setup(t, { jira: () => json({ count: -1 }) });
  const link = bad.link('jira', jiraLink(key));
  await bad.round();
  assert.deepEqual(bad.row(link), { status: null, status_read_at: null });
  assert.equal(bad.stub.calls.length, 1);
});

test('only the two fixed hosts are asked, no redirect is followed, and each token goes only to its own tool', async (t) => {
  const target = 'https://elsewhere.example.com/catch';
  let redirect = false;
  const env = setup(t, {
    notion: () => (redirect ? new Response(null, { status: 302, headers: { location: target } }) : page({ S: statusProperty('Live') })),
    jira: () => (redirect ? new Response(null, { status: 307, headers: { location: target } }) : json({ count: 1 })),
  });
  const notion = env.link('notion', notionLink(hex32()));
  const jira = env.link('jira', jiraLink(projectKey()));
  await env.round();
  const kept = [env.row(notion), env.row(jira)];
  assert.deepEqual(kept.map(({ status }) => status), ['Live', '할 일 1 · 진행 중 1 · 완료 1']);
  redirect = true;
  await env.clock.advance(INTERVAL_MS);
  await env.round();
  // The redirects were answers, not followed: the links keep what they had.
  assert.deepEqual([env.row(notion), env.row(jira)], kept);
  assert.equal(env.stub.calls.length, 6);
  for (const call of env.stub.calls) {
    const { origin } = new URL(call.url);
    assert.ok(origin === NOTION_API || origin === JIRA_API, 'only the two fixed hosts');
    assert.equal(call.init.redirect, 'manual');
    const sent = JSON.stringify(call);
    if (origin === NOTION_API) {
      assert.equal(call.headers.authorization, `Bearer ${NOTION_TOKEN}`);
      assert.equal(sent.includes(JIRA_TOKEN) || sent.includes(BASIC) || sent.includes(EMAIL), false);
    } else {
      assert.equal(call.headers.authorization, BASIC);
      assert.equal(sent.includes(NOTION_TOKEN), false);
    }
    for (const stored of ['www.notion.so', SITE, 'elsewhere.example.com']) assert.equal(call.url.includes(stored), false);
  }
  assert.deepEqual(env.lines.at(-2).failures.map(({ kind, status }) => [kind, status]), [['redirect', 302]]);
  assert.deepEqual(env.lines.at(-1).failures.map(({ kind, status }) => [kind, status]), [['redirect', 307]]);
});

test('Node\'s own fetch, as the server calls it, does not follow a tool\'s redirect', async (t) => {
  const seen = [];
  const server = createServer((request, response) => {
    seen.push([request.url, request.headers.authorization ?? null]);
    if (request.url.startsWith('/v1/pages/')) {
      response.writeHead(302, { location: `http://127.0.0.1:${server.address().port}/caught` });
    } else {
      response.writeHead(200, { 'content-type': 'application/json' });
    }
    response.end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const local = `http://127.0.0.1:${server.address().port}`;
  // The fixed host stands for the local server; every option is passed to Node's fetch as the job gives it.
  const fetch = (url, init) => globalThis.fetch(String(url).replace(NOTION_API, local), init);
  const env = setup(t, { settings: { notion: SETTINGS.notion, jira: null }, fetch });
  const link = env.link('notion', notionLink(hex32()));
  await env.round();
  assert.deepEqual(seen.map(([path]) => path.split('/').slice(0, 3).join('/')), ['/v1/pages']);
  assert.deepEqual(env.row(link), { status: null, status_read_at: null });
  assert.deepEqual(env.lines[0].failures.map(({ kind, status }) => [kind, status]), [['redirect', 302]]);
});

test('a tool that cannot be read keeps the last status and the time it was read (REQ-061)', async (t) => {
  let answer = () => page({ S: statusProperty('Ready') });
  const env = setup(t, { notion: () => answer() });
  const link = env.link('notion', notionLink(hex32()));
  const never = env.link('notion', notionLink(hex32()));
  answer = () => page({ S: statusProperty('Ready') });
  await env.round();
  const kept = env.row(link);
  assert.equal(kept.status, 'Ready');
  const failures = [
    [() => json({ message: 'boom' }, 500), 'server', 500],
    [() => json({ message: 'gone' }, 404), 'not_found', 404],
    [() => json({ message: 'bad' }, 400), 'rejected', 400],
    [() => { throw new DOMException('The operation timed out.', 'TimeoutError'); }, 'timeout', null],
    [() => { throw new TypeError('fetch failed'); }, 'network', null],
    // The answer's head came, and its body then timed out or dropped.
    [() => broken(new DOMException('The operation was aborted due to timeout', 'TimeoutError')), 'timeout', null],
    [() => broken(new TypeError('terminated')), 'network', null],
    [() => new Response('{not json', { status: 200 }), 'answer', 200],
    [() => json({ object: 'database' }), 'answer', 200],
    [() => json(['page']), 'answer', 200],
    [() => new Response(`{"object":"page","properties":{},"pad":"${'x'.repeat(ANSWER_BYTES)}"}`, { status: 200 }), 'answer', 200],
  ];
  for (const [failing, kind, status] of failures) {
    answer = failing;
    env.db.prepare('UPDATE tool_links SET status = NULL, status_read_at = NULL WHERE id = ?').run(never);
    await env.clock.advance(INTERVAL_MS);
    await env.round();
    assert.deepEqual(env.row(link), kept, kind);
    assert.deepEqual(env.row(never), { status: null, status_read_at: null }, kind);
    assert.deepEqual(env.lines.at(-1).failures.map((each) => [each.kind, each.status]), [[kind, status], [kind, status]], kind);
  }
  // Read again, it keeps the new status and time.
  answer = () => page({ S: statusProperty('Done') });
  await env.clock.advance(INTERVAL_MS);
  await env.round();
  assert.deepEqual(env.row(link), { status: 'Done', status_read_at: env.row(link).status_read_at });
  assert.ok(env.row(link).status_read_at > kept.status_read_at);
});

test('a refused token or a 429 leaves that tool alone until the next 30 minutes; the other tool is still read', async (t) => {
  let notionStatusCode = 401;
  const env = setup(t, { notion: () => json({ message: 'no' }, notionStatusCode) });
  const links = [1, 2, 3].map(() => env.link('notion', notionLink(hex32())));
  const jira = env.link('jira', jiraLink(projectKey()));
  for (const code of [401, 403, 429]) {
    notionStatusCode = code;
    const before = env.stub.calls.length;
    await env.round();
    const asked = env.stub.calls.slice(before);
    assert.equal(asked.filter((call) => call.url.startsWith(NOTION_API)).length, 1, `${code}: one Notion request`);
    assert.equal(env.row(jira).status, '할 일 0 · 진행 중 0 · 완료 0');
    const line = env.lines.findLast((each) => each.tool === 'notion');
    assert.deepEqual([line.read, line.failed, line.failures[0].status], [0, 1, code]);
    // A minute later the tool is still left alone, and nothing else is due.
    await env.clock.advance(LOOK_MS);
    const quiet = env.stub.calls.length;
    await env.round();
    assert.equal(env.stub.calls.length, quiet);
    await env.clock.advance(INTERVAL_MS);
  }
  assert.deepEqual(links.map((id) => env.row(id)), links.map(() => ({ status: null, status_read_at: null })));
});

test('a link that keeps being refused does not keep the other links of its tool waiting', async (t) => {
  const refused = hex32();
  const env = setup(t, {
    notion: (call) => (call.url.endsWith(refused) ? json({ message: 'no' }, 403) : page({ S: statusProperty('Live') })),
  });
  const first = env.link('notion', notionLink(refused));
  const others = [env.link('notion', notionLink(hex32())), env.link('notion', notionLink(hex32()))];
  await env.round();
  assert.deepEqual(others.map((id) => env.row(id).status), [null, null]);
  await env.clock.advance(INTERVAL_MS);
  await env.round();
  // The links never tried go first; the refused one comes after them and leaves the tool alone again.
  assert.deepEqual(others.map((id) => env.row(id).status), ['Live', 'Live']);
  assert.equal(env.row(first).status, null);
  assert.deepEqual(env.stub.calls.map((call) => call.url.endsWith(refused)), [true, false, false, true]);
});

test('after a restart, a link counts from the time the store keeps, so it is not read again before 30 minutes', async (t) => {
  const env = setup(t, { notion: () => page({ S: statusProperty('Live') }) });
  const recent = env.link('notion', notionLink(hex32()));
  const old = env.link('notion', notionLink(hex32()));
  const kept = env.db.prepare('UPDATE tool_links SET status = ?, status_read_at = ? WHERE id = ?');
  kept.run('Recent', new Date(START - 10 * 60_000).toISOString(), recent);
  kept.run('Old', new Date(START - 40 * 60_000).toISOString(), old);
  await env.round();
  assert.deepEqual([env.row(recent).status, env.row(old).status], ['Recent', 'Live']);
  await env.clock.advance(19 * 60_000);
  await env.round();
  assert.equal(env.row(recent).status, 'Recent');
  await env.clock.advance(LOOK_MS);
  await env.round();
  assert.equal(env.row(recent).status, 'Live');
  assert.equal(env.stub.calls.length, 2);
});

test('a round that stop() ends still logs the requests it made, and writes nothing after', async (t) => {
  const hold = Promise.withResolvers();
  const held = hex32();
  const env = setup(t, {
    notion: (call) => (call.url.endsWith(held) ? hold.promise : page({ S: statusProperty('Live') })),
  });
  const read = env.link('notion', notionLink(hex32()));
  const ended = env.link('notion', notionLink(held));
  const round = env.job.round();
  await env.clock.advance(GAP_MS);
  assert.equal(env.stub.calls.length, 2);
  env.job.stop();
  hold.resolve(page({ S: statusProperty('Late') }));
  await round;
  assert.deepEqual([env.row(read).status, env.row(ended).status], ['Live', null]);
  assert.deepEqual(env.lines.map(({ event, tool, read: n, failed }) => [event, tool, n, failed]), [['tool_status_read', 'notion', 1, 0]]);
});

test('the looks: a new link within a minute, each link every 30 minutes, a running round skips the next look, stop ends them', async (t) => {
  let hold = null;
  const env = setup(t, {
    notion: () => (hold === null ? page({ S: statusProperty('Live') }) : hold.promise.then((name) => page({ S: statusProperty(name) }))),
  });
  const first = env.link('notion', notionLink(hex32()));
  env.job.start();
  await env.clock.advance(GAP_MS);
  assert.equal(env.row(first).status, 'Live');
  assert.equal(env.stub.calls.length, 1);
  // A link added now is read at the next look, within a minute.
  const second = env.link('notion', notionLink(hex32()));
  await env.clock.advance(LOOK_MS);
  assert.equal(env.row(second).status, 'Live');
  assert.equal(env.stub.calls.length, 2);
  // Neither is read again before 30 minutes.
  await env.clock.advance(INTERVAL_MS - 2 * LOOK_MS);
  assert.equal(env.stub.calls.length, 2);
  await env.clock.advance(2 * LOOK_MS);
  assert.equal(env.stub.calls.length, 4);
  // A round that is still running when the next look is due makes that look skip, rather than run beside it: the
  // first link's read is held, and the second link, due a minute later, waits for it.
  hold = Promise.withResolvers();
  await env.clock.advance(INTERVAL_MS - LOOK_MS);
  assert.equal(env.stub.calls.length, 5);
  await env.clock.advance(5 * LOOK_MS);
  assert.equal(env.stub.calls.length, 5);
  hold.resolve('Held');
  await env.clock.advance(GAP_MS);
  assert.deepEqual([env.row(first).status, env.row(second).status], ['Held', 'Held']);
  assert.equal(env.stub.calls.length, 6);
  // Stopped, the job asks nothing more, and a request that runs then writes nothing.
  hold = Promise.withResolvers();
  await env.clock.advance(INTERVAL_MS);
  const asked = env.stub.calls.length;
  const running = env.stub.calls.at(-1);
  env.job.stop();
  assert.equal(running.init.signal.aborted, true);
  hold.resolve('Late');
  await env.clock.advance(4 * INTERVAL_MS);
  assert.equal(env.stub.calls.length, asked);
  assert.equal(env.row(first).status, 'Held');
  assert.equal(env.clock.pending(), 0);
});

test('a link removed while it is read keeps no status', async (t) => {
  let id;
  const env = setup(t, {
    notion: () => {
      env.db.prepare("UPDATE tool_links SET removed_at = '2026-11-24T01:00:00.000Z' WHERE id = ?").run(id);
      return page({ S: statusProperty('Live') });
    },
  });
  id = env.link('notion', notionLink(hex32()));
  await env.round();
  assert.deepEqual(env.row(id), { status: null, status_read_at: null });
});

test('the log: one line per tool and round, with counts and each failure\'s link, kind and status, and no token, address or ID', async (t) => {
  const page404 = hex32();
  const key = projectKey();
  const echo = () => `${NOTION_TOKEN} ${JIRA_TOKEN} ${EMAIL} ${SITE} ${CLOUD_ID} ${page404} ${key} ${notionLink(page404)}`;
  const env = setup(t, {
    notion: (call) => (call.url.endsWith(page404) ? json({ message: echo() }, 404) : page({ [echo()]: statusProperty(echo()) })),
    jira: () => json({ errorMessages: [echo()] }, 400),
  });
  const read = env.link('notion', notionLink(hex32()));
  const missing = env.link('notion', notionLink(page404));
  const jira = env.link('jira', jiraLink(key));
  const none = env.link('notion', 'https://www.notion.so/team');
  await env.round();
  const time = env.lines[0]?.time;
  assert.match(time, /^2026-11-24T01:00:0[0-9]\.[0-9]{3}Z$/);
  assert.deepEqual(env.lines, [
    {
      time, event: 'tool_status_read', tool: 'notion', read: 1, failed: 1, no_id: 1,
      failures: [{ link: idOf('tl', missing), kind: 'not_found', status: 404 }],
    },
    {
      time, event: 'tool_status_read', tool: 'jira', read: 0, failed: 1, no_id: 0,
      failures: [{ link: idOf('tl', jira), kind: 'rejected', status: 400 }],
    },
  ]);
  assert.equal(env.row(read).status, statusText(echo()));
  assert.deepEqual(env.row(none), { status: null, status_read_at: null });
  const text = JSON.stringify(env.lines);
  for (const value of [NOTION_TOKEN, JIRA_TOKEN, BASIC, EMAIL, SITE, CLOUD_ID, page404, key, 'notion.so', 'atlassian']) {
    assert.equal(text.includes(value), false, 'the log holds a token, an address or an ID');
  }
  // A round whose store cannot be read logs the kind of error only.
  const failing = setup(t, { queue: () => Promise.reject(new Error(`${NOTION_TOKEN} ${SITE}`)) });
  await failing.round();
  assert.deepEqual(failing.lines.map(({ event, error }) => [event, error]), [['tool_status_failed', 'Error']]);
});

test('a status as kept: text without control characters, at most 120 characters, none when empty', () => {
  assert.equal(statusText('  In\tprogress \n'), 'In progress');
  assert.equal(statusText('\u0000  '), null);
  assert.equal(statusText(42), null);
  assert.equal(statusText('a\ud800b'), 'a�b');
  assert.equal(statusText('가'.repeat(121)), `${'가'.repeat(119)}…`);
  assert.equal(notionStatus({ properties: { __proto__: statusProperty('Proto') } }), null);
  assert.equal(notionStatus(JSON.parse('{"properties":{"__proto__":{"type":"status","status":{"name":"Own"}}}}')), 'Own');
});
