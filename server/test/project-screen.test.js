// SCR-144, a project (TASK-457; SPEC-013, SPEC-035, SPEC-046, SPEC-047, SPEC-010): each state of its screen definition
// on test/fake-dom.js, against stubbed answers and against the server; how the page shows every response API-264,
// API-277, API-278, API-282 and API-283 list; the request keys of its writes; and the object particle after a project's
// name. The operations' own tests (project-read.test.js, removal.test.js and tool-links.test.js) have the server answer
// each of those responses; here each stubbed answer is checked against the contract instead. How the screen looks, at
// 360 and 1440 pixels in light and dark, is the browser walk of the pull request.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { newRequestKey, write } from '../web/api.js';
import { objectParticle } from '../web/korean.js';
import { STAGES } from '../web/stages.js';
import { clockOf, GATE_KEY, STALE_AFTER_MS } from '../web/states.js';
import { contract, validate } from './contract.js';
import { fakePage } from './fake-dom.js';
import { listedResponses } from './responses.js';
import { json, message, openPage, SCREENS, startShell, texts, TRACE } from './screen-page.js';
import { seed, TIME } from './seed.js';
import { localGate, startServer, waitFor } from './support.js';

// The local moment the screen is read at: the times it says are of this clock.
const NOW = new Date(2026, 10, 24, 9, 30).getTime();
const earlier = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const NAME = 'book-club';
const PATH = `/api/projects/${NAME}`;
const LINKS = `${PATH}/tool-links`;
const REMOVAL = `${PATH}/removal`;
const L1 = 'tl_0000000000a1';
const L2 = 'tl_0000000000a2';
const L3 = 'tl_0000000000a3';
const NOTION = 'https://www.notion.so/example/Meeting-notes-0123';
const JIRA = 'https://example.atlassian.net/browse/BOOK';
const NEW_URL = 'https://www.notion.so/example/Reading-list-4567';
const KEY = /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/;
const DELETE = '이 프로젝트 공간 지우기';
const PC_ONLY = '도구 잇기와 링크 지우기, 공간 지우기는 PC에서 하세요.';
// A pass late on 23 November, local time: the row says 11-23 in any time zone.
const PASSED_AT = new Date(2026, 10, 23, 23, 50).toISOString();
const READ_AT = new Date(2026, 10, 24, 8, 40).toISOString();

const PASSED = new Set(['passed', 'changed_since_pass']);
const stageRow = (stage, state, part = '') => ({ stage, part, state, passed_at: PASSED.has(state) ? PASSED_AT : null, diagrams: [] });
const toolLink = (id, scope, tool, url, status = null, readAt = null) => ({ id, scope, tool, url, status, status_read_at: readAt, added_at: earlier(60) });
// The mockup's project: 01 passed and changed since, 02 to 07 passed, 08 open and the rest not sent.
const MOCKUP_STATES = ['changed_since_pass', ...Array(6).fill('passed'), 'open', ...Array(5).fill('not_sent')];
const PROJECT = Object.freeze({
  name: NAME,
  title: '독서 모임 앱',
  repository: 'https://github.com/example/book-club',
  revision: 66,
  commit: 'a'.repeat(40),
  pushed_at: earlier(12),
  parts: [],
  stages: STAGES.map((stage, index) => stageRow(stage.id, MOCKUP_STATES[index])),
  tool_links: [toolLink(L1, '02-prd', 'notion', NOTION, '읽음', READ_AT), toolLink(L2, 'project', 'jira', JIRA)],
  workshop: null,
});
const COUNTS = { snapshots: 66, diagrams: 9, drawings: 70, threads: 20, comments: 41, change_sets: 5, confirmations: 12, positions: 9, workshops: 1, notes: 3, tool_links: 2 };
const PREVIEW = { project: NAME, revision: 66, commit: 'a'.repeat(40), deletes: COUNTS, open: { threads: 2, change_sets: 1, confirmations_to_record: 0 } };
const REMOVED = { project: NAME, removed: true, deleted: COUNTS };
const ADDED = toolLink(L3, 'project', 'notion', NEW_URL);
const SUMMARY = { name: NAME, title: '독서 모임 앱', revision: 66, commit: 'a'.repeat(40), pushed_at: earlier(12), owner_todo: 0, stages_passed: 7 };
const problemBody = (status, code) => ({ title: 'x', status, detail: 'x', code, traceId: TRACE });
const schemaOf = (name) => contract.components.schemas[name];

// A clock that reads at now and moves on in real time; it returns the function that puts the real one back.
function clockAt(at) {
  const realNow = Date.now;
  const start = realNow();
  Date.now = () => at + (realNow() - start);
  return () => {
    Date.now = realNow;
  };
}

// A stand-in for the server: answers by "METHOD path", each a function of the request that makes a Response, an Error
// to throw, or a promise of one; sent keeps each request the page made, its body parsed.
function stub(routes) {
  const sent = [];
  const answers = (path, init = {}) => {
    const method = init.method ?? 'GET';
    sent.push({ method, path, headers: init.headers ?? {}, body: init.body === undefined ? undefined : JSON.parse(init.body), init });
    const answer = routes[`${method} ${path}`];
    if (answer === undefined) throw new Error(`no answer for ${method} ${path}`);
    return answer({ method, path, init });
  };
  return { sent, answers };
}

const baseRoutes = (project) => ({
  'GET /api/projects': json(200, { projects: [SUMMARY], backup: null }),
  'GET /api/todo': json(200, { entries: [], backup: null }),
  [`GET ${PATH}`]: json(200, project),
  [`GET ${REMOVAL}`]: json(200, PREVIEW),
});

// SCR-144 of book-club on a fake page, read at NOW, with the routes given over the usual answers.
async function openProject({ routes = {}, project = PROJECT, session = {} } = {}) {
  const restore = clockAt(NOW);
  const server = stub({ ...baseRoutes(project), ...routes });
  try {
    const page = await openPage(`/p/${NAME}`, { answers: server.answers, session });
    page.sent = server.sent;
    const close = page.close;
    page.close = () => {
      close();
      restore();
    };
    return page;
  } catch (error) {
    restore();
    throw error;
  }
}

const mainOf = (page) => page.app.all('main')[0];
const byId = (page, id) => page.app.descendants().find((element) => element.getAttribute('id') === id) ?? null;
const buttonOf = (page, text) => mainOf(page).all('button').find((button) => button.textContent === text) ?? null;
// Off: disabled, or busy while its write runs (aria-disabled, so that it keeps the focus).
const off = (element) => element.getAttribute('disabled') !== null || element.getAttribute('aria-disabled') === 'true';
const busy = (element) => element.getAttribute('aria-disabled') === 'true' && element.getAttribute('disabled') === null;
const reads = (page, path = PATH) => page.sent.filter((each) => each.method === 'GET' && each.path === path).length;
const writes = (page) => page.sent.filter((each) => each.method !== 'GET');
const stageRows = (page) => mainOf(page).all('div', 'stg').map((row) => {
  const go = row.all('a', 'go')[0];
  const dot = row.all('span', 'dot')[0];
  return {
    name: go.textContent,
    href: go.getAttribute('href'),
    dot: dot.className,
    state: dot.textContent,
    checkpoint: row.all('span', 'cp')[0].textContent,
    tag: row.all('span', 'tag')[0]?.textContent ?? null,
    links: row.all('a', 'tl').map((link) => [link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]),
  };
});
const cardsOf = (page) => mainOf(page).all('div', 'card').map((card) => {
  const link = card.all('a')[0];
  return {
    title: card.all('b', 'tl')[0].textContent,
    link: link ? [link.textContent, link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')] : null,
    line: card.all('span', 'small')[0].textContent,
    remove: card.all('button').map((button) => button.textContent),
  };
});

function type(page, id, text) {
  const field = byId(page, id);
  field.value = text;
  field.dispatch('input');
}

function choose(page, id, value) {
  const select = byId(page, id);
  select.value = value;
  select.dispatch('change');
}

async function openPanel(page) {
  buttonOf(page, DELETE).click();
  await page.settle();
}

async function deleteSpace(page) {
  await openPanel(page);
  type(page, 'dn', NAME);
  buttonOf(page, '공간 지우기').click();
  await page.settle();
}

async function addLink(page) {
  type(page, 'ln', NEW_URL);
  buttonOf(page, '잇기').click();
  await page.settle();
}

async function removeFirst(page) {
  mainOf(page).all('div', 'card')[0].all('button')[0].click();
  await page.settle();
}

describe('the object particle after a project\'s name', () => {
  test('follows how the name\'s end is read aloud, by the coordinator\'s rule', () => {
    const cases = {
      을: ['book-club', 'club', 'app', 'chat', 'book', 'home', 'game', 'time', 'name', 'phone', 'line', 'table', 'song', 'spring', 'team',
        'plan', 'pool', 'demo-0', 'v1', 'app3', 'web6', 'r7', 'x8'],
      를: ['demo', 'nexus', 'desk', 'test', 'note', 'v2', 'app4', 'web5', 'r9'],
    };
    for (const [particle, names] of Object.entries(cases)) {
      for (const name of names) assert.equal(objectParticle(name), particle, name);
    }
    // Each final digit as Korean reads it: 영, 일, 삼, 육, 칠 and 팔 end in a consonant; 이, 사, 오 and 구 do not.
    assert.deepEqual([...'0123456789'].map((digit) => objectParticle(`p${digit}`)).join(''), '을을를을를를을을을를');
  });
});

describe('the writes of a page', () => {
  test('a request key is nw_ and 12 of the contract\'s characters, new each time', () => {
    const keys = Array.from({ length: 200 }, () => newRequestKey());
    for (const key of keys) assert.match(key, /^nw_[0-9a-hjkmnp-tv-z]{12}$/);
    assert.equal(new Set(keys).size, keys.length);
  });

  test('write sends the key in double quotes, JSON only with a body, from the page\'s own origin without following a redirect', async () => {
    const realFetch = globalThis.fetch;
    const sent = [];
    globalThis.fetch = async (path, init) => {
      sent.push({ path, init });
      return new Response(JSON.stringify({ id: L1, changed: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    try {
      const key = newRequestKey();
      assert.deepEqual(await write('POST', LINKS, { scope: 'project', url: JIRA }, key), { status: 200, body: { id: L1, changed: true } });
      await write('DELETE', `${LINKS}/${L1}`, null, key);
      const [post, remove] = sent;
      assert.deepEqual([post.path, post.init.method, post.init.headers, JSON.parse(post.init.body)], [
        LINKS, 'POST', { accept: 'application/json', 'idempotency-key': `"${key}"`, 'content-type': 'application/json' }, { scope: 'project', url: JIRA },
      ]);
      assert.deepEqual([remove.path, remove.init.method, remove.init.headers, remove.init.body], [
        `${LINKS}/${L1}`, 'DELETE', { accept: 'application/json', 'idempotency-key': `"${key}"` }, undefined,
      ]);
      for (const { init } of sent) {
        assert.deepEqual([init.credentials, init.redirect, init.cache, init.signal instanceof AbortSignal], ['same-origin', 'manual', 'no-store', true]);
      }
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});

describe('SCR-144', () => {
  test('the stubbed answers are the contract\'s', () => {
    assert.deepEqual(validate(contract, PROJECT, schemaOf('Project')), []);
    assert.deepEqual(validate(contract, PREVIEW, schemaOf('RemovalPreview')), []);
    assert.deepEqual(validate(contract, REMOVED, schemaOf('RemovalAnswer')), []);
    assert.deepEqual(validate(contract, ADDED, schemaOf('ToolLink')), []);
  });

  test('normal: the 13 stages with their state, last checkpoint and links, the tool links, the form and #data', async () => {
    const page = await openProject();
    try {
      assert.deepEqual(texts(page, 'h1'), ['독서 모임 앱']);
      assert.equal(page.document.title, '독서 모임 앱 · NEXUS');
      assert.deepEqual(mainOf(page).all('nav', 'crumb')[0].all('a').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트', '/p']]);
      assert.deepEqual(texts(page, 'p', 'sec')[0], 'book-club · 리비전 66 · 12분 전에 보냄');
      assert.equal(mainOf(page).all('time')[0].getAttribute('datetime'), PROJECT.pushed_at);
      // The project as a whole: one group, "단계" with "파트 없음 · 13단계".
      const groups = mainOf(page).all('section', 'group');
      assert.deepEqual(groups.map((group) => [group.all('h2')[0].textContent, group.all('div', 'gh')[0].all('span', 'small')[0]?.textContent ?? null]), [
        ['단계', '파트 없음 · 13단계'], ['도구 링크', null], ['데이터', null],
      ]);
      const notion = [`Notion · ${NOTION} ↗`, NOTION, '_blank', 'noopener noreferrer'];
      assert.deepEqual(stageRows(page), STAGES.map((stage, index) => ({
        name: `${stage.number} ${stage.name}`,
        href: `/p/${NAME}/_/${stage.id}`,
        dot: { changed_since_pass: 'dot done', passed: 'dot done', open: 'dot prog', not_sent: 'dot not' }[MOCKUP_STATES[index]],
        state: { changed_since_pass: '통과', passed: '통과', open: '진행 중', not_sent: '시작 전' }[MOCKUP_STATES[index]],
        checkpoint: index < 7 ? '마지막 체크포인트 11-23' : '',
        tag: index === 0 ? '통과 뒤 바뀜' : null,
        // A stage's link shows in its row; the project's does not.
        links: stage.id === '02-prd' ? [notion] : [],
      })));
      assert.equal(mainOf(page).all('span', 'tag').filter((tag) => tag.className === 'tag purple').length, 1);
      assert.equal(mainOf(page).textContent.includes('건너뜀'), false);
      assert.ok(mainOf(page).all('div', 'stg').every((row) => row.all('svg', 'chev').length === 1));
      // The tool links, oldest first: the address itself as the link, to a new tab that cannot reach this page.
      assert.deepEqual(cardsOf(page), [
        { title: `Notion · ${NOTION}`, link: [NOTION, NOTION, '_blank', 'noopener noreferrer'], line: `02 PRD · 읽음 · ${clockOf(READ_AT)}`, remove: ['지우기'] },
        { title: `Jira · ${JIRA}`, link: [JIRA, JIRA, '_blank', 'noopener noreferrer'], line: '프로젝트 · 아직 안 읽음', remove: ['지우기'] },
      ]);
      // Each 지우기 is described by its link.
      assert.deepEqual(mainOf(page).all('div', 'card').map((card) => byId(page, card.all('button')[0].getAttribute('aria-describedby')).textContent), [
        `Notion · ${NOTION}`, `Jira · ${JIRA}`,
      ]);
      // The form: the address, where, and 잇기.
      const field = byId(page, 'ln');
      assert.deepEqual([field.getAttribute('placeholder'), field.getAttribute('class'), field.value], ['https://', 'field', '']);
      assert.deepEqual(texts(page, 'label'), ['Notion 페이지나 Jira 프로젝트 주소', '어디에']);
      const select = byId(page, 'lt');
      assert.deepEqual(select.all('option').map((option) => [option.getAttribute('value'), option.textContent]), [
        ['project', '프로젝트 전체'], ...STAGES.map((stage) => [stage.id, `${stage.number} ${stage.name}`]),
      ]);
      assert.equal(select.value, 'project');
      assert.equal(off(buttonOf(page, '잇기')), false);
      // #data: the ghost button, the panel closed.
      const toggle = buttonOf(page, DELETE);
      assert.deepEqual([toggle.getAttribute('class'), toggle.getAttribute('aria-expanded'), toggle.getAttribute('aria-controls')], ['btn ghost start', 'false', null]);
      assert.equal(byId(page, 'delete-panel'), null);
      assert.equal(byId(page, 'data').getAttribute('data-pc-only'), '');
      // Names, not IDs (SPEC-010).
      assert.doesNotMatch(mainOf(page).textContent, /\btl_|\bdg_/);
      assert.deepEqual(writes(page), []);
    } finally {
      page.close();
    }
  });

  test('on a phone the form, each 지우기 and #data are left out with the line that says to use a PC; a narrow PC window keeps them', async () => {
    const page = await openProject();
    try {
      // The shell's CSS hides [data-pc-only] and shows [data-phone-only] on a touch screen narrower than 1056 px only.
      const pcOnly = mainOf(page).descendants().filter((element) => element.getAttribute('data-pc-only') !== null);
      assert.deepEqual(pcOnly.map((element) => element.getAttribute('id') ?? element.getAttribute('class')), [`rm-${L1}`, `rm-${L2}`, 'linking', 'data']);
      assert.deepEqual(pcOnly.slice(0, 2).map((button) => button.textContent), ['지우기', '지우기']);
      assert.deepEqual(pcOnly[2].all('input').map((field) => field.getAttribute('id')), ['ln']);
      const phoneOnly = mainOf(page).descendants().filter((element) => element.getAttribute('data-phone-only') !== null);
      assert.deepEqual(phoneOnly.map((element) => [element.getAttribute('class'), element.getAttribute('role'), element.textContent]), [['nt info', 'status', PC_ONLY]]);
      // The notice is in the tool links' group, under the cards.
      assert.equal(phoneOnly[0].parent.getAttribute('aria-labelledby'), 'links-h');
    } finally {
      page.close();
    }
  });

  test('a project in parts has a group per part, named by it, each with its 13 stages to its part\'s workbench', async () => {
    const project = {
      ...PROJECT,
      parts: ['web', 'api'],
      stages: ['web', 'api'].flatMap((part) => STAGES.map((stage, index) => stageRow(stage.id, index < 2 ? 'passed' : 'not_sent', part))),
      tool_links: [],
    };
    assert.deepEqual(validate(contract, project, schemaOf('Project')), []);
    const page = await openProject({ project });
    try {
      const groups = mainOf(page).all('section', 'group').slice(0, 2);
      assert.deepEqual(groups.map((group) => [group.all('h2')[0].textContent, group.all('div', 'gh')[0].all('span', 'small')[0].textContent, group.all('div', 'stg').length]), [
        ['web', '13단계', 13], ['api', '13단계', 13],
      ]);
      assert.deepEqual(groups.map((group) => group.all('a', 'go')[0].getAttribute('href')), [`/p/${NAME}/web/01-domain`, `/p/${NAME}/api/01-domain`]);
      assert.deepEqual(stageRows(page).map((row) => row.state).slice(0, 3), ['통과', '통과', '시작 전']);
    } finally {
      page.close();
    }
  });

  test('empty: every stage says "아직 보낸 것이 없어요", and with no tool link "아직 이은 도구가 없어요."', async () => {
    const project = { ...PROJECT, stages: STAGES.map((stage) => stageRow(stage.id, 'not_sent')), tool_links: [] };
    const page = await openProject({ project });
    try {
      assert.deepEqual(stageRows(page).map(({ dot, state, checkpoint, tag, links }) => ({ dot, state, checkpoint, tag, links })),
        STAGES.map(() => ({ dot: 'dot not', state: '아직 보낸 것이 없어요', checkpoint: '', tag: null, links: [] })));
      assert.deepEqual(cardsOf(page), []);
      assert.ok(texts(page, 'p', 'sec').includes('아직 이은 도구가 없어요.'));
      // The form and #data stay.
      assert.ok(byId(page, 'ln') && buttonOf(page, DELETE));
    } finally {
      page.close();
    }
  });

  test('a stage that is open says 진행 중 while others were not sent; the empty words are for a project with nothing sent only', async () => {
    const project = { ...PROJECT, stages: STAGES.map((stage, index) => stageRow(stage.id, index === 4 ? 'open' : 'not_sent')) };
    const page = await openProject({ project });
    try {
      assert.deepEqual([...new Set(stageRows(page).map((row) => row.state))], ['시작 전', '진행 중']);
    } finally {
      page.close();
    }
  });

  test('an address that is not https, which the server never keeps, shows as text and links nowhere', async () => {
    const project = { ...PROJECT, tool_links: [toolLink(L1, '02-prd', 'notion', 'javascript:alert(1)')] };
    const page = await openProject({ project });
    try {
      assert.deepEqual(mainOf(page).all('a').filter((link) => (link.getAttribute('href') ?? '').startsWith('javascript')), []);
      assert.equal(cardsOf(page)[0].title, 'Notion · javascript:alert(1)');
    } finally {
      page.close();
    }
  });

  test('a link read with no status shows "읽음" and the time it was read; a link not read yet shows "아직 안 읽음"', async () => {
    const counts = '할 일 3 · 진행 중 2 · 완료 10';
    const project = {
      ...PROJECT,
      tool_links: [
        // A Notion page with no status property, read at READ_AT (TASK-467).
        toolLink(L1, '02-prd', 'notion', NOTION, null, READ_AT),
        toolLink(L2, 'project', 'jira', JIRA, counts, READ_AT),
        toolLink(L3, 'project', 'notion', NEW_URL),
      ],
    };
    const page = await openProject({ project });
    try {
      assert.deepEqual(cardsOf(page).map((card) => card.line), [
        `02 PRD · 읽음 · ${clockOf(READ_AT)}`,
        `프로젝트 · ${counts} · ${clockOf(READ_AT)}`,
        '프로젝트 · 아직 안 읽음',
      ]);
    } finally {
      page.close();
    }
  });

  test('loading: thirteen grey rows, a grey link and grey #data, with the form that keeps what is typed and sends nothing yet', async () => {
    const held = [];
    const routes = baseRoutes(PROJECT);
    const page = fakePage({ pathname: `/p/${NAME}` });
    const restore = page.install();
    const realFetch = globalThis.fetch;
    globalThis.fetch = (path) => new Promise((resolve) => held.push(() => resolve(routes[`GET ${path}`]())));
    try {
      startShell(page.app, SCREENS['SCR-144'], { screen: 'SCR-144', project: NAME });
      await waitFor(() => held.length === 3);
      const main = mainOf(page);
      const [stages, links, data] = main.all('section', 'group');
      assert.deepEqual([stages.all('h2')[0].textContent, stages.all('span', 'mid').length, stages.getAttribute('aria-hidden')], ['단계', 13, 'true']);
      assert.deepEqual([links.all('h2')[0].textContent, links.all('span', 'row').length], ['도구 링크', 1]);
      assert.deepEqual([data.all('h2')[0].textContent, data.all('span', 'w240').length, data.getAttribute('data-pc-only')], ['데이터', 1, '']);
      assert.equal(off(main.all('button').find((button) => button.textContent === '잇기')), true);
      assert.equal(page.app.textContent.includes('독서 모임 앱'), false);
      // Typed while loading, kept once the page is read.
      const field = main.all('input')[0];
      field.value = NEW_URL;
      field.dispatch('input');
      for (const release of held) release();
      await waitFor(() => mainOf(page).all('div', 'stg').length === 13);
      assert.deepEqual(mainOf(page).all('span', 'sk'), []);
      assert.equal(mainOf(page).all('input')[0].value, NEW_URL);
    } finally {
      restore();
      globalThis.fetch = realFetch;
    }
  });

  test('stale: the read time shows after five minutes, and the tab coming back reads again', async () => {
    const page = await openProject();
    try {
      const readAt = Date.now();
      const realNow = Date.now;
      Date.now = () => realNow() + STALE_AFTER_MS + 60_000;
      for (const tick of page.ticks) tick();
      assert.equal(texts(page, 'span', 'tag').find((text) => text.endsWith('에 읽음')), `${clockOf(readAt)}에 읽음`);
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(reads(page), 2);
      assert.equal(texts(page, 'span', 'tag').some((text) => text.endsWith('에 읽음')), false);
      Date.now = realNow;
    } finally {
      page.close();
    }
  });

  test('a link: 잇기 sends API-282 with a request key and is off while it runs; then the field clears and the list is read again', async () => {
    let release = null;
    let project = PROJECT;
    const page = await openProject({
      routes: {
        [`GET ${PATH}`]: () => json(200, project)(),
        [`POST ${LINKS}`]: () => new Promise((resolve) => {
          release = () => {
            project = { ...PROJECT, tool_links: [...PROJECT.tool_links, ADDED] };
            resolve(json(201, ADDED)());
          };
        }),
      },
    });
    try {
      type(page, 'ln', NEW_URL);
      assert.equal(page.session.getItem(`nexus-draft:/p/${NAME} link`), NEW_URL);
      choose(page, 'lt', '02-prd');
      buttonOf(page, '잇기').click();
      await waitFor(() => release !== null);
      assert.equal(busy(buttonOf(page, '잇기')), true);
      // A second click while it runs sends nothing more.
      buttonOf(page, '잇기').click();
      const [post] = writes(page);
      assert.equal(writes(page).length, 1);
      assert.deepEqual([post.method, post.path, post.body, post.headers['content-type']], ['POST', LINKS, { scope: '02-prd', url: NEW_URL }, 'application/json']);
      assert.match(post.headers['idempotency-key'], KEY);
      release();
      await page.settle();
      assert.equal(byId(page, 'ln').value, '');
      assert.equal(page.session.getItem(`nexus-draft:/p/${NAME} link`), null);
      assert.equal(reads(page), 2);
      assert.deepEqual(cardsOf(page).map((card) => card.title), [`Notion · ${NOTION}`, `Jira · ${JIRA}`, `Notion · ${NEW_URL}`]);
      assert.equal(cardsOf(page)[2].line, '프로젝트 · 아직 안 읽음');
      // The scope chosen stays chosen.
      assert.equal(byId(page, 'lt').value, '02-prd');
      assert.equal(off(buttonOf(page, '잇기')), false);
    } finally {
      page.close();
    }
  });

  test('the same link again answers 200 and the list keeps one', async () => {
    const page = await openProject({ routes: { [`POST ${LINKS}`]: json(200, PROJECT.tool_links[1]) } });
    try {
      type(page, 'ln', JIRA);
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.equal(reads(page), 2);
      assert.equal(cardsOf(page).filter((card) => card.title === `Jira · ${JIRA}`).length, 1);
      assert.equal(byId(page, 'ln').value, '');
    } finally {
      page.close();
    }
  });

  test('a refused address keeps its text, marked, with the registry\'s message under it, and focus goes to it', async () => {
    const page = await openProject({ routes: { [`POST ${LINKS}`]: json(400, { ...problemBody(400, 'invalid_request'), field: 'url' }) } });
    try {
      type(page, 'ln', 'https://example.com/not-a-tool');
      buttonOf(page, '잇기').click();
      await page.settle();
      const field = byId(page, 'ln');
      assert.deepEqual([field.value, field.getAttribute('class'), field.getAttribute('aria-invalid'), field.getAttribute('aria-describedby')], [
        'https://example.com/not-a-tool', 'field bad', 'true', 'ln-err',
      ]);
      assert.equal(byId(page, 'ln-err').textContent, '표시한 입력을 확인하세요.');
      assert.equal(page.document.activeElement, field);
      assert.equal(reads(page), 1);
    } finally {
      page.close();
    }
  });

  test('request keys: the same key only again after a timeout or a lost connection, a new one after any answer or a changed input', async () => {
    const answers = [
      () => new DOMException('timed out', 'TimeoutError'),
      () => new TypeError('fetch failed'),
      json(400, problemBody(400, 'invalid_request')),
      json(400, problemBody(400, 'invalid_request')),
      () => new DOMException('timed out', 'TimeoutError'),
      json(201, ADDED),
    ];
    const page = await openProject({ routes: { [`POST ${LINKS}`]: (request) => answers.shift()(request) } });
    try {
      const keys = () => writes(page).map((each) => each.headers['idempotency-key']);
      type(page, 'ln', NEW_URL);
      buttonOf(page, '잇기').click();
      await page.settle();
      // No answer: a notice with 다시 시도, which sends the same input with the same key.
      const notice = mainOf(page).all('div', 'linking')[0];
      assert.deepEqual(notice.all('div', 'err').map((each) => each.textContent), ['문제가 생겼어요. 다시 해 보세요.']);
      notice.all('button').find((button) => button.textContent === '다시 시도').click();
      await page.settle();
      assert.equal(keys()[1], keys()[0]);
      // A lost connection again: 잇기 sends it with the same key too.
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.equal(keys()[2], keys()[0]);
      // An answer came: the next attempt, same input or not, has a new key.
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.notEqual(keys()[3], keys()[2]);
      // A timeout, then the input changes: a new key.
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.notEqual(keys()[4], keys()[3]);
      const kept = keys()[4];
      type(page, 'ln', JIRA);
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.notEqual(keys()[5], kept);
      assert.equal(new Set(keys()).size, 4);
      for (const key of keys()) assert.match(key, KEY);
      assert.equal(byId(page, 'ln').value, '');
    } finally {
      page.close();
    }
  });

  test('지우기 sends API-283 with a key and no body, is off while it runs, and the list read again leaves the link out', async () => {
    let release = null;
    let project = PROJECT;
    const page = await openProject({
      routes: {
        [`GET ${PATH}`]: () => json(200, project)(),
        [`DELETE ${LINKS}/${L1}`]: () => new Promise((resolve) => {
          release = () => {
            project = { ...PROJECT, tool_links: [PROJECT.tool_links[1]] };
            resolve(json(200, { id: L1, changed: true })());
          };
        }),
      },
    });
    try {
      mainOf(page).all('div', 'card')[0].all('button')[0].click();
      await waitFor(() => release !== null);
      assert.equal(busy(mainOf(page).all('div', 'card')[0].all('button')[0]), true);
      assert.equal(off(mainOf(page).all('div', 'card')[1].all('button')[0]), false);
      const [remove] = writes(page);
      assert.deepEqual([remove.method, remove.path, remove.body, remove.headers['content-type']], ['DELETE', `${LINKS}/${L1}`, undefined, undefined]);
      assert.match(remove.headers['idempotency-key'], KEY);
      release();
      await page.settle();
      assert.deepEqual(cardsOf(page).map((card) => card.title), [`Jira · ${JIRA}`]);
      assert.deepEqual(stageRows(page)[1].links, []);
    } finally {
      page.close();
    }
  });

  test('공간 지우기 stays off while API-277 could not be read, however the name is typed', async () => {
    const page = await openProject({ routes: { [`GET ${REMOVAL}`]: json(500, problemBody(500, 'internal')) } });
    try {
      await openPanel(page);
      const panel = byId(page, 'delete-panel');
      assert.deepEqual(panel.all('div', 'err').map((each) => each.textContent), [message('internal')]);
      type(page, 'dn', NAME);
      assert.equal(off(buttonOf(page, '공간 지우기')), true);
      buttonOf(page, '공간 지우기').click();
      await page.settle();
      assert.deepEqual(writes(page), []);
    } finally {
      page.close();
    }
  });

  test('a retry takes the old notice away while it runs, and the focus stays on 잇기', async () => {
    let release = null;
    const answers = [
      () => new DOMException('timed out', 'TimeoutError'),
      () => new Promise((resolve) => {
        release = () => resolve(json(400, problemBody(400, 'invalid_request'))());
      }),
    ];
    const page = await openProject({ routes: { [`POST ${LINKS}`]: (request) => answers.shift()(request) } });
    try {
      type(page, 'ln', NEW_URL);
      byId(page, 'ln-go').focus();
      byId(page, 'ln-go').click();
      await page.settle();
      const form = () => mainOf(page).all('div', 'linking')[0];
      assert.deepEqual(form().all('div', 'err').map((each) => each.textContent), [message('internal')]);
      assert.equal(page.document.activeElement, byId(page, 'ln-go'));
      const retry = form().all('button').find((button) => button.textContent === '다시 시도');
      retry.focus();
      retry.click();
      await waitFor(() => release !== null);
      // While the retry runs: no notice of the last attempt, 잇기 busy and focused in place of the button that went.
      assert.deepEqual(form().all('div', 'err'), []);
      assert.deepEqual([busy(byId(page, 'ln-go')), page.document.activeElement], [true, byId(page, 'ln-go')]);
      release();
      await page.settle();
      assert.equal(byId(page, 'ln-err').textContent, message('invalid_request'));
      assert.equal(page.document.activeElement, byId(page, 'ln'));
    } finally {
      page.close();
    }
  });

  test('지우기 keeps the focus while its removal runs and after a refusal, with the address being typed left as it was', async () => {
    let release = null;
    const page = await openProject({
      routes: {
        [`DELETE ${LINKS}/${L1}`]: () => new Promise((resolve) => {
          release = () => resolve(json(400, problemBody(400, 'invalid_request'))());
        }),
      },
    });
    try {
      type(page, 'ln', NEW_URL);
      byId(page, `rm-${L1}`).focus();
      byId(page, `rm-${L1}`).click();
      await waitFor(() => release !== null);
      assert.deepEqual([busy(byId(page, `rm-${L1}`)), page.document.activeElement], [true, byId(page, `rm-${L1}`)]);
      release();
      await page.settle();
      const card = mainOf(page).all('div', 'card')[0];
      assert.deepEqual(card.all('p', 'err-text').map((each) => each.textContent), [message('invalid_request')]);
      assert.deepEqual([off(byId(page, `rm-${L1}`)), page.document.activeElement], [false, byId(page, `rm-${L1}`)]);
      assert.equal(byId(page, 'ln').value, NEW_URL);
    } finally {
      page.close();
    }
  });

  test('a read again that draws the page anew keeps the focus where it was, in the address field', async () => {
    let project = PROJECT;
    const page = await openProject({ routes: { [`GET ${PATH}`]: () => json(200, project)() } });
    try {
      type(page, 'ln', NEW_URL);
      const before = byId(page, 'ln');
      before.focus();
      project = { ...PROJECT, revision: 67 };
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.ok(texts(page, 'p', 'sec')[0].includes('리비전 67'));
      assert.notEqual(byId(page, 'ln'), before);
      assert.deepEqual([page.document.activeElement, byId(page, 'ln').value], [byId(page, 'ln'), NEW_URL]);
    } finally {
      page.close();
    }
  });

  test('once a write finds the project gone, a read again still under way does not draw the page over it', async () => {
    let release = null;
    let first = true;
    const page = await openProject({
      routes: {
        [`GET ${PATH}`]: () => {
          if (first) {
            first = false;
            return json(200, PROJECT)();
          }
          return new Promise((resolve) => {
            release = () => resolve(json(200, PROJECT)());
          });
        },
        [`POST ${LINKS}`]: json(404, problemBody(404, 'project_not_found')),
      },
    });
    try {
      page.document.dispatch('visibilitychange');
      await waitFor(() => release !== null);
      // settle() would wait for the read under way, so this waits for the gone page instead.
      type(page, 'ln', NEW_URL);
      buttonOf(page, '잇기').click();
      await waitFor(() => texts(page, 'h1')[0] === 'NEXUS에 없는 프로젝트예요.');
      const gone = () => [texts(page, 'h1'), stageRows(page).length];
      assert.deepEqual(gone(), [['NEXUS에 없는 프로젝트예요.'], 0]);
      release();
      await page.settle();
      assert.deepEqual(gone(), [['NEXUS에 없는 프로젝트예요.'], 0]);
      // Nothing more is read once it is gone.
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.equal(reads(page), 2);
    } finally {
      page.close();
    }
  });

  test('a tool the contract does not name shows as it came, even a name that objects carry', async () => {
    const odd = { ...PROJECT, tool_links: [toolLink(L1, 'project', 'constructor', NOTION)] };
    const page = await openProject({ project: odd });
    try {
      assert.deepEqual(cardsOf(page).map((card) => card.title), [`constructor · ${NOTION}`]);
    } finally {
      page.close();
    }
  });

  test('delete: the button opens the panel, which reads API-277 with grey counts, then the five counts and the name to type', async () => {
    let release = null;
    const page = await openProject({
      routes: {
        [`GET ${REMOVAL}`]: () => new Promise((resolve) => {
          release = () => resolve(json(200, PREVIEW)());
        }),
        [`POST ${REMOVAL}`]: json(200, REMOVED),
      },
    });
    try {
      const toggle = buttonOf(page, DELETE);
      toggle.click();
      await waitFor(() => release !== null);
      assert.deepEqual([toggle.getAttribute('aria-expanded'), toggle.getAttribute('aria-controls')], ['true', 'delete-panel']);
      const panel = byId(page, 'delete-panel');
      assert.deepEqual([panel.getAttribute('class'), panel.getAttribute('aria-labelledby'), byId(page, 'dh').textContent], ['panel', 'dh', DELETE]);
      assert.equal(panel.all('p')[0].textContent, '지우면 NEXUS에서 아래 것이 모두 사라지고 되돌릴 수 없어요. Git 저장소의 문서는 그대로예요.');
      const grey = panel.all('ul', 'chg')[0];
      assert.deepEqual([grey.getAttribute('aria-busy'), grey.all('span', 'sk').length, grey.all('b').length], ['true', 5, 0]);
      assert.deepEqual(grey.all('span', 'grow').map((label) => label.textContent), ['스냅숏', '그림', '댓글', '확정', '레이아웃']);
      // What goes shows before the owner confirms (SPEC-013): the name typed while the counts load turns nothing on.
      byId(page, 'dn').focus();
      type(page, 'dn', NAME);
      assert.equal(off(buttonOf(page, '공간 지우기')), true);
      release();
      await page.settle();
      // The counts came: the name and the focus stay in the field, and the button turns on.
      assert.deepEqual([byId(page, 'dn').value, page.document.activeElement, off(buttonOf(page, '공간 지우기'))], [NAME, byId(page, 'dn'), false]);
      const counts = byId(page, 'delete-panel').all('ul', 'chg')[0];
      assert.deepEqual(counts.all('li').map((item) => [item.all('span', 'grow')[0].textContent, item.all('b')[0].textContent]), [
        ['스냅숏', '66개'], ['그림', '9개'], ['댓글', '41개'], ['확정', '12개'], ['레이아웃', '9개'],
      ]);
      assert.equal(counts.getAttribute('aria-busy'), null);
      const label = byId(page, 'delete-panel').all('label')[0];
      assert.deepEqual([label.textContent, label.getAttribute('for'), label.all('span', 'mono')[0].textContent], ['지우려면 프로젝트 이름 book-club을 적으세요', 'dn', NAME]);
      // The button turns on when the name is the project's, exactly.
      const button = () => buttonOf(page, '공간 지우기');
      for (const [text, on] of [['book-clu', false], ['Book-club', false], [' book-club', false], [NAME, true], ['', false]]) {
        type(page, 'dn', text);
        assert.equal(off(button()), !on, text);
      }
      assert.deepEqual(writes(page), []);
      type(page, 'dn', NAME);
      button().click();
      await page.settle();
      const [post] = writes(page);
      assert.deepEqual([post.method, post.path, post.body], ['POST', REMOVAL, { name: NAME }]);
      assert.match(post.headers['idempotency-key'], KEY);
      assert.deepEqual(page.location.assigned, [`/p?deleted=${NAME}`]);
      assert.equal(reads(page, REMOVAL), 1);
      // The typed name was never kept.
      assert.deepEqual([...page.session.entries.keys()].filter((key) => key.startsWith('nexus-draft:')), []);
    } finally {
      page.close();
    }
  });

  test('closing the panel forgets the typed name, and opening it again reads API-277 again', async () => {
    const page = await openProject();
    try {
      await openPanel(page);
      type(page, 'dn', NAME);
      buttonOf(page, DELETE).click();
      assert.deepEqual([buttonOf(page, DELETE).getAttribute('aria-expanded'), byId(page, 'delete-panel'), byId(page, 'data').all('div', 'cards')[0].hidden], ['false', null, true]);
      await openPanel(page);
      assert.equal(byId(page, 'dn').value, '');
      assert.equal(off(buttonOf(page, '공간 지우기')), true);
      assert.equal(reads(page, REMOVAL), 2);
    } finally {
      page.close();
    }
  });

  test('a read again that draws the page anew keeps the open panel, its counts and the typed name', async () => {
    let project = PROJECT;
    const page = await openProject({ routes: { [`GET ${PATH}`]: () => json(200, project)() } });
    try {
      await openPanel(page);
      type(page, 'dn', NAME);
      project = { ...PROJECT, revision: 67 };
      page.document.dispatch('visibilitychange');
      await page.settle();
      assert.ok(texts(page, 'p', 'sec')[0].includes('리비전 67'));
      assert.deepEqual([byId(page, 'dn').value, off(buttonOf(page, '공간 지우기')), reads(page, REMOVAL)], [NAME, false, 1]);
      assert.equal(byId(page, 'delete-panel').all('b')[0].textContent, '66개');
    } finally {
      page.close();
    }
  });
});

// What SCR-144 shows for each response of each operation it calls, as its screen definition gives it (SCR-144#normal,
// #error, #permission and #delete), and the step that makes the page call it.
const OPERATIONS = {
  getProject: { method: 'GET', path: PATH, act: async () => {}, success: { 200: PROJECT } },
  getRemovalPreview: { method: 'GET', path: REMOVAL, act: openPanel, success: { 200: PREVIEW } },
  deleteProject: { method: 'POST', path: REMOVAL, act: deleteSpace, success: { 200: REMOVED } },
  addToolLink: { method: 'POST', path: LINKS, act: addLink, success: { 200: ADDED, 201: ADDED } },
  removeToolLink: { method: 'DELETE', path: `${LINKS}/${L1}`, act: removeFirst, success: { 200: { id: L1, changed: true } } },
};

const SHOWS = {
  getProject: { 200: 'rows', 401: 'gate', 403: 'refused', 404: 'gone', default: 'page notice' },
  getRemovalPreview: { 200: 'counts', 401: 'gate', 403: 'refused', 404: 'gone', default: 'panel notice' },
  deleteProject: {
    200: 'deleted', 400: 'name field', 401: 'gate', 403: 'refused', 404: 'gone', 409: 'name field', 413: 'name field', 415: 'panel notice',
    default: 'panel notice',
  },
  addToolLink: {
    200: 'linked', 201: 'linked', 400: 'address field', 401: 'gate', 403: 'refused', 404: 'gone', 409: 'address field', 413: 'address field',
    415: 'link notice', default: 'link notice',
  },
  removeToolLink: { 200: 'removed', 400: 'card', 401: 'gate', 403: 'refused', 404: 'gone', 409: 'card', default: 'card notice' },
};

function shownAs(action, status, code) {
  if (code === 'cross_site') return 'reload';
  if (action === 'removeToolLink' && code === 'tool_link_not_found') return 'removed';
  return SHOWS[action][status];
}

const noticeIn = (element) => ({
  text: element.all('div', 'err').map((each) => each.textContent),
  retry: element.all('button').filter((button) => button.textContent === '다시 시도').length,
  trace: element.all('span', 'helper').map((each) => each.textContent),
});

const CHECKS = {
  rows: (page) => assert.equal(stageRows(page).length, 13),
  counts: (page) => assert.deepEqual(byId(page, 'delete-panel').all('b').map((each) => each.textContent), ['66개', '9개', '41개', '12개', '9개']),
  deleted: (page) => assert.deepEqual(page.location.assigned, [`/p?deleted=${NAME}`]),
  linked: (page) => {
    assert.deepEqual([reads(page), byId(page, 'ln').value, byId(page, 'ln-err')], [2, '', null]);
    assert.deepEqual(mainOf(page).all('div', 'err'), []);
  },
  removed: (page) => {
    assert.equal(reads(page), 2);
    assert.deepEqual([mainOf(page).all('p', 'err-text'), mainOf(page).all('div', 'err')], [[], []]);
  },
  gate: (page) => {
    assert.equal(page.location.reloads, 1);
    assert.equal(page.session.getItem(GATE_KEY) !== null, true);
  },
  refused: (page, code) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], []]),
  reload: (page, code) => assert.deepEqual([texts(page, 'h1'), texts(page, 'button')], [[message(code)], ['새로 고침']]),
  gone: (page) => {
    assert.deepEqual([texts(page, 'h1'), texts(page, 'p', 'sec')], [['NEXUS에 없는 프로젝트예요.'], ['지워졌거나 주소가 바뀌었어요.']]);
    assert.deepEqual(mainOf(page).all('a').map((link) => [link.textContent, link.getAttribute('href')]), [['프로젝트 목록', '/p']]);
  },
  'page notice': (page, code) => {
    assert.deepEqual(noticeIn(mainOf(page)), { text: [message(code)], retry: 1, trace: [`traceId ${TRACE}`] });
    assert.deepEqual(stageRows(page), []);
  },
  'panel notice': (page, code) => assert.deepEqual(noticeIn(byId(page, 'delete-panel')), { text: [message(code)], retry: 1, trace: [`traceId ${TRACE}`] }),
  'link notice': (page, code) => {
    assert.deepEqual(noticeIn(mainOf(page).all('div', 'linking')[0]), { text: [message(code)], retry: 1, trace: [`traceId ${TRACE}`] });
    assert.equal(byId(page, 'ln').value, NEW_URL);
  },
  'card notice': (page, code) => assert.deepEqual(noticeIn(mainOf(page).all('div', 'card')[0]), { text: [message(code)], retry: 1, trace: [`traceId ${TRACE}`] }),
  'name field': (page, code) => {
    const field = byId(page, 'dn');
    assert.deepEqual([field.value, field.getAttribute('class'), field.getAttribute('aria-invalid'), byId(page, 'dn-err').textContent], [NAME, 'field bad', 'true', message(code)]);
    assert.equal(off(buttonOf(page, '공간 지우기')), false);
    assert.deepEqual(page.location.assigned, []);
  },
  'address field': (page, code) => {
    const field = byId(page, 'ln');
    assert.deepEqual([field.value, field.getAttribute('class'), field.getAttribute('aria-invalid'), byId(page, 'ln-err').textContent], [NEW_URL, 'field bad', 'true', message(code)]);
    assert.equal(reads(page), 1);
  },
  card: (page, code) => {
    const card = mainOf(page).all('div', 'card')[0];
    assert.deepEqual([card.all('p', 'err-text').map((each) => each.textContent), off(card.all('button')[0])], [[message(code)], false]);
  },
};

describe('SCR-144 and each response it is given', () => {
  for (const [action, { method, path, act, success }] of Object.entries(OPERATIONS)) {
    test(`every response ${action} lists leads SCR-144 to the state its definition gives`, async () => {
      for (const listed of listedResponses(action)) {
        const status = listed.status === 'default' ? 500 : Number(listed.status);
        for (const code of listed.codes.length === 0 ? [null] : listed.codes) {
          const body = code === null ? success[listed.status] : problemBody(status, code);
          assert.ok(body, `${action} ${listed.status}`);
          assert.deepEqual(validate(contract, body, listed.schema), [], `${action} ${listed.status} ${code}`);
          const shows = shownAs(action, listed.status, code);
          assert.ok(CHECKS[shows], `${action} ${listed.status} ${code}`);
          // A 2xx of a write is followed by the read again, which answers as before.
          const page = await openProject({ routes: { [`${method} ${path}`]: json(status, body) } });
          try {
            await act(page);
            CHECKS[shows](page, code);
          } catch (error) {
            error.message = `${action} ${listed.status} ${code}: ${error.message}`;
            throw error;
          } finally {
            page.close();
          }
        }
      }
    });
  }

  test('a 401 of a write keeps the typed address for the page after the gate', async () => {
    const page = await openProject({ routes: { [`POST ${LINKS}`]: json(401, problemBody(401, 'unauthenticated')) } });
    try {
      await addLink(page);
      assert.equal(page.location.reloads, 1);
      assert.equal(page.session.getItem(`nexus-draft:/p/${NAME} link`), NEW_URL);
    } finally {
      page.close();
    }
  });
});

describe('SCR-144 against the server', () => {
  let folder;
  let db;
  let local;
  let server;
  let s;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-project-screen-'));
    ({ db } = openStore(folder));
    local = localGate();
    s = seed(db);
    server = await startServer({ routes: ROUTES, store: db, gate: local.gate, pages: createPages() });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  // SCR-144 of a project reading and writing the server through a stand-in for the gate that signs the owner in.
  async function openOn(name) {
    const realFetch = globalThis.fetch;
    const answers = (path, init = {}) => realFetch(`http://127.0.0.1:${server.port}${path}`, {
      method: init.method ?? 'GET',
      headers: { ...init.headers, ...owner() },
      body: init.body,
      redirect: 'manual',
    });
    return openPage(`/p/${name}`, { answers });
  }

  test('the server\'s project: its stages, a link added, added again, removed, removed meanwhile, and the space deleted', async () => {
    const space = s.project('garden-club', { title: '텃밭 모임' });
    s.changePass(s.pass(space, '01-domain'));
    s.pass(space, '02-prd');
    s.diagram(space, { stage: '05-erd' });
    s.toolLink(space, { scope: '02-prd', url: NOTION });
    const page = await openOn(space.name);
    try {
      assert.deepEqual(texts(page, 'h1'), ['텃밭 모임']);
      assert.ok(texts(page, 'p', 'sec')[0].startsWith('garden-club · 리비전 1 · '));
      const day = new Date(TIME);
      const checkpoint = `마지막 체크포인트 ${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      assert.deepEqual(stageRows(page).slice(0, 5).map(({ state, checkpoint: cp, tag }) => [state, cp, tag]), [
        ['통과', checkpoint, '통과 뒤 바뀜'], ['통과', checkpoint, null], ['시작 전', '', null], ['시작 전', '', null], ['진행 중', '', null],
      ]);
      assert.deepEqual(stageRows(page)[1].links, [[`Notion · ${NOTION} ↗`, NOTION, '_blank', 'noopener noreferrer']]);

      // A Jira project linked to the project as a whole, then the same again: one link.
      type(page, 'ln', JIRA);
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.deepEqual(cardsOf(page).map((card) => [card.title, card.line]), [[`Notion · ${NOTION}`, '02 PRD · 아직 안 읽음'], [`Jira · ${JIRA}`, '프로젝트 · 아직 안 읽음']]);
      assert.equal(byId(page, 'ln').value, '');
      type(page, 'ln', JIRA);
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.equal(cardsOf(page).length, 2);
      // A refused address keeps its text with the message.
      type(page, 'ln', 'https://example.com/not-a-tool');
      buttonOf(page, '잇기').click();
      await page.settle();
      assert.deepEqual([byId(page, 'ln').value, byId(page, 'ln-err').textContent], ['https://example.com/not-a-tool', '표시한 입력을 확인하세요.']);

      // The Notion link removed from the page.
      await removeFirst(page);
      assert.deepEqual(cardsOf(page).map((card) => card.title), [`Jira · ${JIRA}`]);
      // The Jira link removed meanwhile, as from another tab: 지우기 answers 404 tool_link_not_found, and the page reads
      // again as when it works.
      const [jira] = (await server.send({ path: `/api/projects/${space.name}`, headers: owner() })).json.tool_links;
      const gone = await server.send({ method: 'DELETE', path: `/api/projects/${space.name}/tool-links/${jira.id}`, headers: { ...owner(), 'Idempotency-Key': `"${newRequestKey()}"` } });
      assert.equal(gone.status, 200);
      await removeFirst(page);
      assert.deepEqual([cardsOf(page), texts(page, 'p', 'sec').includes('아직 이은 도구가 없어요.')], [[], true]);
      assert.deepEqual(mainOf(page).all('div', 'err'), []);

      // The space deleted after its counts, and the projects list opens.
      await openPanel(page);
      const preview = (await server.send({ path: `/api/projects/${space.name}/removal`, headers: owner() })).json;
      assert.deepEqual(byId(page, 'delete-panel').all('b').map((each) => each.textContent), ['snapshots', 'diagrams', 'comments', 'confirmations', 'positions'].map((key) => `${preview.deletes[key]}개`));
      assert.equal(byId(page, 'delete-panel').all('label')[0].textContent, '지우려면 프로젝트 이름 garden-club을 적으세요');
      type(page, 'dn', space.name);
      buttonOf(page, '공간 지우기').click();
      await page.settle();
      assert.deepEqual(page.location.assigned, ['/p?deleted=garden-club']);
      assert.equal((await server.send({ path: `/api/projects/${space.name}`, headers: owner() })).status, 404);
    } finally {
      page.close();
    }
  });
});
