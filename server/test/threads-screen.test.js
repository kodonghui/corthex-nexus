// SCR-145's threads (TASK-459; SPEC-016, SPEC-017, SPEC-027, SPEC-028, SPEC-051): read, comment, reply and close,
// on a phone too (note 12 of the WBS), on stubbed answers and against the server. TASK-459's done condition: an
// unsent comment is kept when the sign-in expires; threads open and are answered on a phone at 360 px; every response
// API-266, API-267, API-268 and API-269 list has a passing test.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { createPages } from '../src/pages.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { stageHref } from '../web/address.js';
import { GATE_KEY } from '../web/states.js';
import { contract, validate } from './contract.js';
import { listedResponses, responseRecord } from './responses.js';
import { GATE, json, message, openPage, problem } from './screen-page.js';
import { seed } from './seed.js';
import { FORMAT_03, repositorySnapshot } from './snapshots.js';
import { localGate, startServer } from './support.js';

// The modules that import ./layout.js load once screen-page.js has taught the import where the server serves it from.
const { WORKBENCH_WORDS } = await import('../web/workbench.js');
const { THREAD_WORDS, countOf, draftKey, goneName, hashOf } = await import('../web/threads.js');

const P = 'reading-club';
const NOW = Date.now();
const ago = (minutes) => new Date(NOW - minutes * 60_000).toISOString();
const TIME = ago(120);
const stored = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), 'utf8'));
const asElement = (element) => ({
  key: element.key, trace_id: element.trace_id ?? null, kind: element.kind, name: element.name ?? '', parent: element.parent ?? null,
  status: element.status ?? null, detail: element.detail ?? {}, position: null,
});
const FLOWS = Object.values(stored('user-flow-expected.json'));
const ID = Object.freeze({ erd: 'dg_0000000000b5', table: 'dg_0000000000b2', flow: 'dg_0000000000c1', old: 'dg_0000000000c3' });
const STAGE = Object.freeze({ erd: '05-erd', table: '02-prd', flow: '03-user-flow', old: '03-user-flow' });
const KIND = Object.freeze({ erd: 'erd', table: 'item_table', flow: 'user_flow', old: 'user_flow' });
const NAME = Object.freeze({ erd: 'ERD', table: 'Item table', flow: FLOWS[0].name, old: FLOWS[2].name });
const ELEMENTS = Object.freeze({
  erd: stored('erd-expected.json').elements,
  flow: FLOWS[0].elements,
  old: FLOWS[2].elements,
  table: [
    { key: 'REQ-001', trace_id: 'REQ-001', kind: 'row', name: 'Owner signs in', detail: { status: 'Must', links: [], where: 'docs/02-prd/requirements.md:10' } },
    { key: 'REQ-002', trace_id: 'REQ-002', kind: 'row', name: 'Agent sends a snapshot', detail: { status: 'Must', links: [], where: 'docs/02-prd/requirements.md:11' } },
  ],
});
// Thread IDs, each a CommentId.
const T = Object.freeze({
  mine: 'nc_0000000000a1', whole: 'nc_0000000000a2', closed: 'nc_0000000000a3', gone: 'nc_0000000000a4', old: 'nc_0000000000a6',
  other: 'nc_0000000000a7', made: 'nc_0000000000a8', lost: 'nc_0000000000a9',
});
const brief = (id, target, element, state, waitsOn, minutes, entries, removedName = null) => ({
  id, target, element, removed_name: removedName, state, waits_on: waitsOn, last_at: ago(minutes), entries,
});
// API-265's threads of each diagram. On the ERD: an element's open thread, the diagram's own, a closed one, and one
// whose element left the drawing (SPEC-027).
const BRIEFS = Object.freeze({
  erd: [
    brief(T.closed, 'element', 'TBL-147', 'closed', null, 60, 2),
    brief(T.mine, 'element', 'TBL-146', 'open', 'owner', 10, 2),
    brief(T.whole, 'diagram', null, 'open', 'agent', 5, 1),
    brief(T.gone, 'diagram', 'TBL-999', 'open', 'owner', 20, 1, 'old_table'),
  ],
  old: [brief(T.old, 'diagram', null, 'open', 'owner', 30, 1)],
  table: [],
  flow: [],
});
const drawingOf = (which, fields = {}) => ({ id: `dw_${ID[which].slice(3)}`, revision: 3, version: 'a'.repeat(40), status: 'drawn', failed_at: null, drawn_at: TIME, ...fields });

// API-265's Diagram of one of ID, with its threads; fields replaces what it gives.
function diagramOf(which, fields = {}) {
  const body = {
    id: ID[which], project: P, part: '', stage: STAGE[which], kind: KIND[which], name: NAME[which], removed: which === 'old',
    drawing: drawingOf(which), last_drawn: null, elements: ELEMENTS[which].map(asElement), overlays: [], since_confirmation: null,
    confirmation: null, threads: structuredClone(BRIEFS[which]), ...fields,
  };
  assert.deepEqual(validate(contract, body, { $ref: '#/components/schemas/Diagram' }), [], which);
  return body;
}

// The entries of a thread: the owner's comment, then the agent's decision with its quote, what to look at first and
// the address where it is recorded.
const ENTRIES = Object.freeze([
  { seq: 1, author: 'owner', kind: 'comment', text: '토큰은 어디에 저장하나요?', made_at: ago(15) },
  {
    seq: 2, author: 'agent', kind: 'decision', text: '자격은 해시로만 저장했어요.', quote: '토큰은 어디에 저장하나요?', asks: 'answer',
    look_first: 'db/nexus.sql:12', link: 'https://github.com/example/demo/pull/7', made_at: ago(10),
  },
]);

// API-266's Thread of a brief on which's diagram; fields replaces what it gives.
function threadOf(which, from, fields = {}, check = true) {
  const entries = from.entries === 2 ? structuredClone(ENTRIES) : [{ seq: 1, author: 'agent', kind: 'comment', text: '이 표를 나눌까요?', made_at: from.last_at }];
  const body = {
    id: from.id, part: '', stage: STAGE[which], diagram: ID[which], drawing: drawingOf(which).id, version: 'a'.repeat(40),
    item: /^[A-Z]+-[0-9]+$/.test(from.element ?? '') ? from.element : '', target: from.target, element: from.element, removed_name: from.removed_name,
    state: from.state, waits_on: from.waits_on, closed_by: from.state === 'closed' ? 'owner' : null, opened_at: ago(90),
    closed_at: from.state === 'closed' ? from.last_at : null, last_at: from.last_at, entries, change_sets: [], ...fields,
  };
  if (check) assert.deepEqual(validate(contract, body, { $ref: '#/components/schemas/Thread' }), [], from.id);
  return body;
}

const STAGE_IDS = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap', '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];
// API-264's Project; lists replaces the diagrams listed by stage. The removed flow is listed last (SPEC-027).
function projectOf(lists = {}) {
  const listed = { '02-prd': ['table'], '03-user-flow': ['flow', 'old'], '05-erd': ['erd'], ...lists };
  return {
    name: P, title: '독서 모임 앱', repository: 'https://github.com/example/demo', revision: 3, commit: 'a'.repeat(40), pushed_at: TIME, parts: [],
    stages: STAGE_IDS.map((stage) => ({
      stage, part: '', state: listed[stage]?.length ? 'open' : 'not_sent', passed_at: null,
      diagrams: (listed[stage] ?? []).map((which) => ({
        id: ID[which], kind: KIND[which], name: NAME[which], removed: which === 'old', drawn: true, confirmation: 'none', waiting: 0,
        open_threads: BRIEFS[which].filter((each) => each.state === 'open').length,
      })),
    })),
    tool_links: [],
    workshop: null,
  };
}

const projectPath = `/api/projects/${P}`;
const diagramPath = (which) => `${projectPath}/diagrams/${ID[which]}`;
const threadPath = (id) => `${projectPath}/threads/${id}`;
const HEADER = {
  '/api/projects': json(200, { projects: [], backup: null }),
  '/api/todo': json(200, { entries: [], backup: null }),
};
// The answers of a page; more replaces some, by path.
function answersOf(more = {}) {
  const threads = Object.entries(BRIEFS).flatMap(([which, briefs]) => briefs.map((each) => [threadPath(each.id), json(200, threadOf(which, each))]));
  return {
    ...HEADER,
    [projectPath]: json(200, projectOf()),
    ...Object.fromEntries(Object.keys(ID).map((which) => [diagramPath(which), json(200, diagramOf(which))])),
    ...Object.fromEntries(threads),
    ...more,
  };
}

// The answers to the page's writes, by path: a new thread waiting on the agent (API-267), a reply (API-268), a close
// (API-269).
function written(path, body) {
  if (path.endsWith('/threads')) {
    const which = Object.keys(ID).find((each) => path === `${diagramPath(each)}/threads`);
    const made = brief(T.made, body.target, body.element ?? null, 'open', 'agent', 0, 1);
    const thread = threadOf(which, made, { drawing: body.drawing, entries: [{ seq: 1, author: 'owner', kind: 'comment', text: body.text, made_at: made.last_at }] });
    return json(201, thread)();
  }
  const id = path.split('/')[4];
  if (path.endsWith('/comments')) {
    return json(201, {
      thread: { id, state: 'open', waits_on: 'agent', closed_by: null, last_at: ago(0) },
      entry: { seq: 3, author: 'owner', kind: 'comment', text: body.text, made_at: ago(0) },
    })();
  }
  return json(200, { thread: { id, state: 'closed', waits_on: null, closed_by: 'owner', last_at: ago(0) }, changed: true })();
}

// Opens which's stage with answers by path, the writes answered by posts (a function of the path, the body and the
// key); every write is kept in page.sent as { path, body, key }.
async function openStage(which, { search = '', more = {}, posts = written, phone = false, session = {}, answers = null } = {}) {
  const known = answersOf(more);
  const sent = [];
  const page = await openPage(`/p/${P}/_/${STAGE[which]}`, {
    search,
    phone,
    session,
    answers: (path, init) => {
      if (init?.method === 'POST') {
        const body = JSON.parse(init.body);
        const key = init.headers['idempotency-key'];
        sent.push({ path, body, key });
        return posts(path, body, key);
      }
      const answer = answers?.(path) ?? known[path];
      if (answer === undefined) throw new Error(`no answer for ${path}`);
      return answer(path, init);
    },
  });
  page.sent = sent;
  return page;
}

const sectionOf = (page) => page.app.all('aside')[0].all('section').find((section) => section.getAttribute('aria-label') === WORKBENCH_WORDS.selected);
const textsIn = (node, tag, className = null) => node.all(tag, className).filter((element) => element.shown).map((element) => element.textContent);
// The threads listed: each by where it is and its state.
const rowsOf = (page) => (sectionOf(page).all('ul', 'threads')[0]?.all('button') ?? []).map((button) => [
  button.all('span', 'grow')[0].textContent, button.all('span', 'tag')[0]?.textContent ?? null,
]);
const rowNamed = (page, name) => sectionOf(page).all('ul', 'threads')[0].all('button').find((button) => button.all('span', 'grow')[0].textContent === name);
const shownThread = (page) => sectionOf(page).all('div', 'thread').find((element) => element.getAttribute('role') === 'group') ?? null;
const fieldOf = (page, id) => page.document.getElementById(id);
const formOf = (field) => {
  let node = field;
  while (node !== null && node.tagName !== 'FORM') node = node.parentNode;
  return node;
};
// Types text into a box and sends it, as the owner does.
async function send(page, id, text) {
  const field = fieldOf(page, id);
  field.value = text;
  field.dispatch('input');
  formOf(field).dispatch('submit');
  await page.settle();
}
const pictureButton = (page, className, name) => page.app.all('div', 'wb-picture')[0].all('button', className).find((button) => button.all('b').some((b) => b.textContent === name));
const buttonOf = (node, text) => node.all('button').find((button) => button.textContent === text);
const drafts = (page) => [...page.session.entries].filter(([key]) => key.startsWith('nexus-draft:'));

describe('SCR-145 threads', () => {
  test('with nothing chosen the section lists every thread of the diagram, open ones first, each named by where it is', async () => {
    const page = await openStage('erd');
    try {
      const section = sectionOf(page);
      assert.deepEqual(textsIn(section, 'b'), [THREAD_WORDS.whole]);
      assert.deepEqual(textsIn(section, 'h3'), [countOf(4, 6)]);
      assert.deepEqual(rowsOf(page), [
        [THREAD_WORDS.whole, THREAD_WORDS.agents],
        ['agent_credentials', THREAD_WORDS.mine],
        [goneName('old_table'), THREAD_WORDS.mine],
        ['project_spaces', THREAD_WORDS.closed],
      ]);
      // Each line says how long ago its thread moved, and no version.
      assert.deepEqual(section.all('ul', 'threads')[0].all('time').map((time) => time.textContent), ['5분 전', '10분 전', '20분 전', '1시간 전']);
      // The box at the end starts a thread on the diagram as a whole; nothing is read before a thread is chosen.
      assert.deepEqual([textsIn(section, 'label'), fieldOf(page, 'th-new').getAttribute('placeholder')], [[THREAD_WORDS.comment], THREAD_WORDS.fields.diagram]);
      assert.equal(shownThread(page), null);
      assert.ok(!page.calls.some((path) => path.includes('/threads/')));
    } finally {
      page.close();
    }
  });

  test('choosing a thread reads it, shows its entries and chooses its element; Escape and 그림 전체 스레드 go back to the whole list', async () => {
    const page = await openStage('erd');
    try {
      rowNamed(page, 'agent_credentials').click();
      await page.settle();
      assert.ok(page.calls.includes(threadPath(T.mine)));
      const chosen = pictureButton(page, 'tbl', 'agent_credentials');
      assert.equal(chosen.getAttribute('aria-pressed'), 'true');
      // The section is the element's now: only its threads, and its own is shown.
      assert.deepEqual(rowsOf(page), [['agent_credentials', THREAD_WORDS.mine]]);
      assert.deepEqual(textsIn(sectionOf(page), 'h3'), [countOf(1, 2)]);
      const thread = shownThread(page);
      const entries = thread.all('div', 'cmt');
      assert.deepEqual(entries.map((entry) => entry.all('span').find((span) => ['who', 'ai'].includes(span.className)).textContent), [THREAD_WORDS.owner, THREAD_WORDS.agent]);
      assert.deepEqual(textsIn(entries[1], 'blockquote'), ['토큰은 어디에 저장하나요?']);
      assert.deepEqual(textsIn(entries[1], 'span', 'tx'), ['자격은 해시로만 저장했어요.', `${THREAD_WORDS.lookFirst}db/nexus.sql:12`]);
      const [link] = entries[1].all('a');
      assert.deepEqual(['href', 'target', 'rel'].map((name) => link.getAttribute(name)), ['https://github.com/example/demo/pull/7', '_blank', 'noopener noreferrer']);
      assert.equal(link.textContent, 'https://github.com/example/demo/pull/7');
      // asks is not shown: the to-do tags the questions.
      assert.doesNotMatch(thread.textContent, /answer/);
      assert.deepEqual([fieldOf(page, 'th-reply').getAttribute('placeholder'), buttonOf(thread, THREAD_WORDS.close) !== undefined], [THREAD_WORDS.replyField, true]);
      assert.equal(fieldOf(page, 'th-new').getAttribute('placeholder'), THREAD_WORDS.fields.element);

      // Escape chooses nothing again.
      sectionOf(page).dispatch('keydown', { key: 'Escape' });
      assert.equal(chosen.getAttribute('aria-pressed'), 'false');
      assert.deepEqual([textsIn(sectionOf(page), 'b'), shownThread(page), rowsOf(page).length], [[THREAD_WORDS.whole], null, 4]);

      // The diagram's own thread shows under the list, with nothing chosen on the picture.
      rowNamed(page, THREAD_WORDS.whole).click();
      await page.settle();
      assert.deepEqual([shownThread(page).getAttribute('aria-label'), rowNamed(page, THREAD_WORDS.whole).getAttribute('aria-pressed')], [THREAD_WORDS.whole, 'true']);
      assert.ok(page.app.all('div', 'wb-picture')[0].all('button').every((button) => button.getAttribute('aria-pressed') !== 'true'));
      // A thread whose element left is shown the same way, marked.
      rowNamed(page, goneName('old_table')).click();
      await page.settle();
      assert.equal(shownThread(page).getAttribute('aria-label'), goneName('old_table'));

      // Choosing an element on the picture shows its newest thread; a closed one has no reply box.
      pictureButton(page, 'tbl', 'project_spaces').click();
      await page.settle();
      assert.deepEqual(rowsOf(page), [['project_spaces', THREAD_WORDS.closed]]);
      assert.deepEqual(textsIn(shownThread(page), 'span', 'tag'), [THREAD_WORDS.closed]);
      assert.deepEqual([fieldOf(page, 'th-reply'), buttonOf(shownThread(page), THREAD_WORDS.close)], [null, undefined]);
      // 그림 전체 스레드 goes back to the whole list.
      buttonOf(sectionOf(page), THREAD_WORDS.wholeThreads).click();
      assert.deepEqual([textsIn(sectionOf(page), 'b'), shownThread(page)], [[THREAD_WORDS.whole], null]);
    } finally {
      page.close();
    }
  });

  test('a reply is sent with a new request key, added at the end, and the thread then waits on the agent', async () => {
    const page = await openStage('erd');
    try {
      pictureButton(page, 'tbl', 'agent_credentials').click();
      await page.settle();
      await send(page, 'th-reply', '해시 방식도 적어 주세요.');
      assert.equal(page.sent.length, 1);
      assert.deepEqual([page.sent[0].path, page.sent[0].body], [`${threadPath(T.mine)}/comments`, { text: '해시 방식도 적어 주세요.' }]);
      assert.match(page.sent[0].key, /^"nw_[0-9a-hjkmnp-tv-z]{12}"$/);
      const entries = shownThread(page).all('div', 'cmt');
      assert.deepEqual([entries.length, textsIn(entries[2], 'span', 'tx')], [3, ['해시 방식도 적어 주세요.']]);
      assert.deepEqual(rowsOf(page), [['agent_credentials', THREAD_WORDS.agents]]);
      assert.deepEqual(textsIn(sectionOf(page), 'h3'), [countOf(1, 3)]);
      // Sent, the text is forgotten, here and in the tab.
      assert.deepEqual([fieldOf(page, 'th-reply').value, drafts(page)], ['', []]);
      await send(page, 'th-reply', '하나 더');
      assert.notEqual(page.sent[1].key, page.sent[0].key);
    } finally {
      page.close();
    }
  });

  test('a new comment goes on the element, the row or the diagram, at the drawing shown, and opens its thread', async () => {
    const erd = await openStage('erd');
    try {
      pictureButton(erd, 'tbl', 'snapshots').click();
      // An element without threads: no list, only the box.
      assert.deepEqual([rowsOf(erd), shownThread(erd)], [[], null]);
      await send(erd, 'th-new', '스냅숏을 나눠 주세요.');
      assert.deepEqual([erd.sent[0].path, erd.sent[0].body], [
        `${diagramPath('erd')}/threads`, { drawing: drawingOf('erd').id, target: 'element', element: 'TBL-148', text: '스냅숏을 나눠 주세요.' },
      ]);
      assert.deepEqual(rowsOf(erd), [['snapshots', THREAD_WORDS.agents]]);
      assert.deepEqual(textsIn(shownThread(erd), 'span', 'tx'), ['스냅숏을 나눠 주세요.']);
      assert.equal(fieldOf(erd, 'th-new').value, '');
      // Nothing chosen: the diagram as a whole, without an element.
      erd.app.all('div', 'wb-picture')[0].dispatch('keydown', { key: 'Escape' });
      await send(erd, 'th-new', '전체를 다시 봐 주세요.');
      assert.deepEqual(erd.sent[1].body, { drawing: drawingOf('erd').id, target: 'diagram', text: '전체를 다시 봐 주세요.' });
    } finally {
      erd.close();
    }
    const table = await openStage('table');
    try {
      table.app.all('div', 'wb-picture')[0].all('button', 'rowpick')[1].click();
      assert.equal(fieldOf(table, 'th-new').getAttribute('placeholder'), THREAD_WORDS.fields.row);
      await send(table, 'th-new', '이 요구를 나눠 주세요.');
      assert.deepEqual(table.sent[0].body, { drawing: drawingOf('table').id, target: 'row', element: 'REQ-002', text: '이 요구를 나눠 주세요.' });
    } finally {
      table.close();
    }
    // A failed drawing: an element names the last good drawing it is drawn from, the diagram as a whole the failed one.
    const failed = drawingOf('erd', { id: 'dw_00000000fa11', revision: 4, status: 'failed', failed_at: 'db/nexus.sql:40' });
    const page = await openStage('erd', { more: { [diagramPath('erd')]: json(200, diagramOf('erd', { drawing: failed, last_drawn: drawingOf('erd') })) } });
    try {
      await send(page, 'th-new', '어디가 깨졌나요?');
      pictureButton(page, 'tbl', 'snapshots').click();
      await send(page, 'th-new', '이 표는요?');
      assert.deepEqual(page.sent.map((each) => [each.body.target, each.body.drawing]), [['diagram', 'dw_00000000fa11'], ['element', drawingOf('erd').id]]);
    } finally {
      page.close();
    }
  });

  test('an empty comment is refused by the box with 댓글을 적어 주세요., and nothing is sent', async () => {
    const page = await openStage('erd');
    try {
      await send(page, 'th-new', '   ');
      const field = fieldOf(page, 'th-new');
      assert.deepEqual([field.getAttribute('aria-invalid'), field.getAttribute('class'), field.getAttribute('aria-describedby')], ['true', 'field bad', 'th-new-error']);
      assert.equal(page.document.getElementById('th-new-error').textContent, THREAD_WORDS.empty);
      assert.deepEqual(page.sent, []);
    } finally {
      page.close();
    }
  });

  test('closing asks nothing; the thread shows 닫힘 with no reply box', async () => {
    const page = await openStage('erd');
    try {
      pictureButton(page, 'tbl', 'agent_credentials').click();
      await page.settle();
      buttonOf(shownThread(page), THREAD_WORDS.close).click();
      await page.settle();
      assert.deepEqual([page.sent[0].path, page.sent[0].body], [`${threadPath(T.mine)}/close`, {}]);
      assert.deepEqual(textsIn(shownThread(page), 'span', 'tag'), [THREAD_WORDS.closed]);
      assert.deepEqual(rowsOf(page), [['agent_credentials', THREAD_WORDS.closed]]);
      assert.deepEqual([fieldOf(page, 'th-reply'), buttonOf(shownThread(page), THREAD_WORDS.close)], [null, undefined]);
      // The element still takes a new thread.
      assert.equal(fieldOf(page, 'th-new').getAttribute('placeholder'), THREAD_WORDS.fields.element);
    } finally {
      page.close();
    }
  });

  test('a reply to a thread closed meanwhile shows the bar over the picture, and its text moves to the new comment of the same place', async () => {
    const page = await openStage('erd', { posts: () => problem(409, 'thread_closed')() });
    try {
      pictureButton(page, 'tbl', 'agent_credentials').click();
      await page.settle();
      await send(page, 'th-reply', '그래도 확인해 주세요.');
      const bar = page.app.all('div', 'wb-notice')[0];
      assert.deepEqual([textsIn(bar, 'b'), textsIn(bar, 'span'), textsIn(bar, 'button')], [[message('thread_closed')], [THREAD_WORDS.kept], ['새로 고침']]);
      assert.deepEqual([fieldOf(page, 'th-reply'), fieldOf(page, 'th-new').value], [null, '그래도 확인해 주세요.']);
      assert.deepEqual(drafts(page), [[`nexus-draft:${draftKey({ project: P, id: ID.erd }, `comment element ${hashOf('TBL-146')}`)}`, '그래도 확인해 주세요.']]);
      // 새로 고침 reads the diagram again; the text stays.
      const before = page.calls.length;
      buttonOf(bar, '새로 고침').click();
      await page.settle();
      assert.ok(page.calls.slice(before).includes(diagramPath('erd')));
      assert.equal(fieldOf(page, 'th-new').value, '그래도 확인해 주세요.');
    } finally {
      page.close();
    }
  });

  test('an unsent comment is kept when the sign-in expires, and comes back in its box after the gate (TASK-459)', async () => {
    const page = await openStage('erd', { search: `?d=${ID.erd}&thread=${T.mine}`, posts: () => GATE() });
    let session;
    try {
      // A reply, typed and not sent.
      const reply = fieldOf(page, 'th-reply');
      reply.value = '로그인이 끝나도 남아야 해요.';
      reply.dispatch('input');
      // A new comment on another element, sent as the sign-in expires: the page goes through the gate once.
      pictureButton(page, 'tbl', 'snapshots').click();
      await send(page, 'th-new', '스냅숏 표를 봐 주세요.');
      assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
      session = Object.fromEntries(page.session.entries);
      // The keys hold the project, the diagram, the thread and the element's key only as a hash.
      assert.deepEqual(drafts(page).map(([key]) => key).sort(), [
        `nexus-draft:/p/${P} ${ID.erd} comment element ${hashOf('TBL-148')}`,
        `nexus-draft:/p/${P} ${ID.erd} reply ${T.mine}`,
      ]);
    } finally {
      page.close();
    }
    // Back from the gate, at the same address.
    const again = await openStage('erd', { search: `?d=${ID.erd}&thread=${T.mine}`, session });
    try {
      assert.equal(fieldOf(again, 'th-reply').value, '로그인이 끝나도 남아야 해요.');
      pictureButton(again, 'tbl', 'snapshots').click();
      assert.equal(fieldOf(again, 'th-new').value, '스냅숏 표를 봐 주세요.');
      // The read answered, so the gate's mark is dropped.
      assert.equal(again.session.getItem(GATE_KEY), null);
    } finally {
      again.close();
    }
  });

  test('on a phone at 360 px the threads open, are answered and closed in the sheet under the picture (SPEC-051)', async () => {
    const page = await openStage('erd', { phone: true });
    try {
      assert.ok(page.app.all('div', 'info').some((note) => note.textContent === WORKBENCH_WORDS.phone));
      rowNamed(page, 'agent_credentials').click();
      await page.settle();
      assert.equal(shownThread(page).all('div', 'cmt').length, 2);
      await send(page, 'th-reply', '휴대폰에서 답해요.');
      assert.deepEqual(rowsOf(page), [['agent_credentials', THREAD_WORDS.agents]]);
      buttonOf(shownThread(page), THREAD_WORDS.close).click();
      await page.settle();
      assert.deepEqual(page.sent.map((each) => each.path), [`${threadPath(T.mine)}/comments`, `${threadPath(T.mine)}/close`]);
      assert.deepEqual(rowsOf(page), [['agent_credentials', THREAD_WORDS.closed]]);
      // A new comment on the phone too.
      await send(page, 'th-new', '휴대폰 댓글');
      assert.deepEqual(page.sent[2].body.target, 'element');
    } finally {
      page.close();
    }
  });

  test('?thread= shows that thread with its element chosen; another diagram\'s or a gone one says so with 새로 고침 to the diagram', async () => {
    const page = await openStage('erd', { search: `?d=${ID.erd}&thread=${T.mine}` });
    try {
      assert.ok(page.calls.indexOf(threadPath(T.mine)) > page.calls.indexOf(diagramPath('erd')));
      assert.equal(pictureButton(page, 'tbl', 'agent_credentials').getAttribute('aria-pressed'), 'true');
      assert.equal(shownThread(page).getAttribute('aria-label'), 'agent_credentials');
      // Choosing another thread keeps the address.
      buttonOf(sectionOf(page), THREAD_WORDS.wholeThreads).click();
      rowNamed(page, THREAD_WORDS.whole).click();
      await page.settle();
      assert.deepEqual([page.location.search, page.history.pushed], [`?d=${ID.erd}&thread=${T.mine}`, []]);
    } finally {
      page.close();
    }
    const elsewhere = threadOf('flow', brief(T.other, 'diagram', null, 'open', 'owner', 3, 1));
    for (const answer of [json(200, elsewhere), problem(404, 'thread_not_found')]) {
      const gone = await openStage('erd', { search: `?d=${ID.erd}&thread=${T.other}`, more: { [threadPath(T.other)]: answer } });
      try {
        const note = sectionOf(gone).all('div', 'warn')[0];
        assert.deepEqual(textsIn(note, 'b'), [message('thread_not_found')]);
        assert.deepEqual([note.all('a')[0].textContent, note.all('a')[0].getAttribute('href')], ['새로 고침', stageHref(P, '', '05-erd', { diagram: ID.erd })]);
        assert.deepEqual(rowsOf(gone).length, 4);
      } finally {
        gone.close();
      }
    }
  });

  test('a removed diagram takes no new comment; closing its last thread opens the stage\'s first diagram with NEXUS에 없는 다이어그램이에요', async () => {
    let closed = false;
    const answers = (path) => (path === projectPath ? json(200, projectOf(closed ? { '03-user-flow': ['flow'] } : {})) : undefined);
    const page = await openStage('old', { search: `?d=${ID.old}`, answers, posts: (path, body) => {
      closed = true;
      return written(path, body);
    } });
    try {
      assert.equal(fieldOf(page, 'th-new'), null);
      rowNamed(page, THREAD_WORDS.whole).click();
      await page.settle();
      assert.ok(fieldOf(page, 'th-reply') !== null);
      buttonOf(shownThread(page), THREAD_WORDS.close).click();
      await page.settle();
      await page.settle();
      // Read again, the removed diagram is no longer listed: the first diagram opens in its place, its address
      // replacing the removed one's in the history.
      assert.deepEqual([page.location.search, page.history.pushed], ['', []]);
      assert.deepEqual(page.app.all('h1').map((h1) => h1.textContent), [NAME.flow]);
      assert.deepEqual(page.app.all('div', 'warn').map((note) => note.all('b')[0].textContent), [message('diagram_not_found')]);
    } finally {
      page.close();
    }
    // With no other diagram, the stage shows its empty state.
    let done = false;
    const alone = await openStage('old', {
      answers: (path) => (path === projectPath ? json(200, projectOf({ '03-user-flow': done ? [] : ['old'] })) : undefined),
      posts: (path, body) => {
        done = true;
        return written(path, body);
      },
    });
    try {
      rowNamed(alone, THREAD_WORDS.whole).click();
      await alone.settle();
      buttonOf(shownThread(alone), THREAD_WORDS.close).click();
      await alone.settle();
      await alone.settle();
      assert.deepEqual(alone.app.all('h2').map((h2) => h2.textContent), ['아직 보낸 것이 없어요.']);
    } finally {
      alone.close();
    }
  });

  test('an element drawn as unreadable takes no comment, and a thread marked removed with its key shows when it is chosen', async () => {
    const elements = ELEMENTS.erd.map(asElement).map((element) => (element.key === 'TBL-146' ? { ...element, status: 'unreadable', detail: { ...element.detail, where: 'db/nexus.sql:12' } } : element));
    const lost = brief(T.lost, 'diagram', 'TBL-146', 'open', 'owner', 2, 1, 'agent_credentials');
    const page = await openStage('erd', {
      more: {
        [diagramPath('erd')]: json(200, diagramOf('erd', { elements, threads: [lost] })),
        [threadPath(T.lost)]: json(200, threadOf('erd', lost)),
      },
    });
    try {
      assert.deepEqual(rowsOf(page), [[goneName('agent_credentials'), THREAD_WORDS.mine]]);
      pictureButton(page, 'tbl', 'agent_credentials').click();
      await page.settle();
      assert.deepEqual(textsIn(sectionOf(page), 'p', 'sec'), [THREAD_WORDS.unreadable]);
      assert.equal(fieldOf(page, 'th-new'), null);
      assert.deepEqual(rowsOf(page), [[goneName('agent_credentials'), THREAD_WORDS.mine]]);
      assert.equal(shownThread(page).getAttribute('aria-label'), goneName('agent_credentials'));
      assert.ok(buttonOf(sectionOf(page), THREAD_WORDS.wholeThreads) !== undefined);
    } finally {
      page.close();
    }
  });

  test('다시 시도 after a lost connection sends the same text under the same key, and a changed text under a new one', async () => {
    let fail = true;
    const page = await openStage('erd', { posts: (path, body) => (fail ? new Error('lost') : written(path, body)) });
    try {
      pictureButton(page, 'tbl', 'agent_credentials').click();
      await page.settle();
      await send(page, 'th-reply', '다시 보내요.');
      const thread = shownThread(page);
      assert.deepEqual(textsIn(thread, 'b'), [message('internal')]);
      buttonOf(thread, '다시 시도').click();
      await page.settle();
      assert.equal(page.sent[1].key, page.sent[0].key);
      // The text changed: another body takes another key.
      fieldOf(page, 'th-reply').value = '고쳐서 보내요.';
      fieldOf(page, 'th-reply').dispatch('input');
      fail = false;
      buttonOf(shownThread(page), '다시 시도').click();
      await page.settle();
      assert.deepEqual([page.sent[2].body.text, page.sent[2].key !== page.sent[0].key], ['고쳐서 보내요.', true]);
      assert.equal(shownThread(page).all('div', 'cmt').length, 3);
    } finally {
      page.close();
    }
  });

  test('a thread\'s text, quote and links go in as text, and only an https address becomes a link', async () => {
    const hostile = threadOf('erd', BRIEFS.erd[1], {
      entries: [
        { seq: 1, author: 'agent', kind: 'decision', text: '<img src=x onerror=alert(1)>', quote: '<b>q</b>', link: 'javascript:alert(1)', made_at: ago(3) },
        { seq: 2, author: 'agent', kind: 'decision', text: 'http', link: 'http://example.com/x', made_at: ago(2) },
      ],
    }, false);
    const page = await openStage('erd', { search: `?d=${ID.erd}&thread=${T.mine}`, more: { [threadPath(T.mine)]: json(200, hostile) } });
    try {
      const thread = shownThread(page);
      assert.deepEqual(textsIn(thread, 'span', 'tx'), ['<img src=x onerror=alert(1)>', 'http']);
      assert.deepEqual(textsIn(thread, 'blockquote'), ['<b>q</b>']);
      assert.deepEqual([thread.all('img'), thread.all('a')], [[], []]);
    } finally {
      page.close();
    }
  });
});

describe('SCR-145 threads against the server', () => {
  const responses = responseRecord();
  const NAME_ = 'nexus-threads';
  const realFetch = globalThis.fetch;
  let folder;
  let db;
  let local;
  let good;
  let broken;
  let s;
  let failing = false;
  let erd;
  let open;
  let shut;
  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const someone = () => ({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.com' }) });
  const headersOf = (who) => ({ owner: owner(), someone: someone(), agent: s.agent.headers, nobody: {} })[who];
  const ACTIONS = Object.freeze([[/\/threads$/, 'startThread'], [/\/comments$/, 'replyInThread'], [/\/close$/, 'closeThread']]);

  const json_ = { 'Content-Type': 'application/json' };
  let count = 0;
  const key = () => {
    count += 1;
    return { 'Idempotency-Key': `"nw_${String(count).padStart(12, '0')}"` };
  };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-threads-'));
    ({ db } = openStore(folder));
    local = localGate();
    s = seed(db);
    const store = new Proxy(db, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare' && failing) return () => { throw new Error('the store failed'); };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    good = await startServer({ routes: ROUTES, store: db, gate: local.gate, pages: createPages() });
    broken = await startServer({ routes: ROUTES, store, gate: local.gate });
    const pushed = await good.send({
      method: 'POST', path: '/api/snapshots', headers: { ...json_, ...s.agent.headers },
      body: JSON.stringify(repositorySnapshot(FORMAT_03, { name: NAME_ })),
    });
    assert.equal(pushed.status, 201);
    const project = (await good.send({ path: `/api/projects/${NAME_}`, headers: owner() })).json;
    const row = project.stages.find((each) => each.stage === '05-erd' && each.diagrams.length > 0);
    erd = (await good.send({ path: `/api/projects/${NAME_}/diagrams/${row.diagrams[0].id}`, headers: owner() })).json;
    erd.part = row.part;
    // An open thread to read, reply in and close, and one closed already.
    const start = async (text) => (await good.send({
      method: 'POST', path: `/api/projects/${NAME_}/diagrams/${erd.id}/threads`, headers: { ...json_, ...owner(), ...key() },
      body: JSON.stringify({ drawing: erd.drawing.id, target: 'diagram', text }),
    })).json;
    open = await start('열린 스레드');
    shut = await start('닫을 스레드');
    assert.equal((await good.send({ method: 'POST', path: `/api/projects/${NAME_}/threads/${shut.id}/close`, headers: { ...json_, ...owner(), ...key() }, body: '{}' })).status, 200);
  });

  after(async () => {
    await good.close();
    await broken.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  const stagePath = () => `/p/${NAME_}/${erd.part || '_'}/05-erd`;
  const readPath = (id) => `/api/projects/${NAME_}/threads/${id}`;
  const startPath = () => `/api/projects/${NAME_}/diagrams/${erd.id}/threads`;
  const replyPath = (id) => `${readPath(id)}/comments`;
  const closePath = (id) => `${readPath(id)}/close`;
  const replayOf = (answer) => () => new Response(answer.text, { status: answer.status, headers: { 'content-type': answer.headers['content-type'] } });
  // The listed responses' cases: those of each listed status, one for each Problem code it lists.
  const casesOf = (action, cases) => listedResponses(action).map((listed) => {
    const found = cases.filter((each) => (listed.status === 'default' ? each.status === 500 : String(each.status) === listed.status)
      && (listed.codes.length === 0 || listed.codes.includes(each.code)));
    assert.equal(found.length, Math.max(1, listed.codes.length), `${action} ${listed.status}`);
    return found;
  }).flat();

  // The page of the ERD's stage read as the owner, at search; a request in replay ("GET /api/..." or "POST /api/...")
  // gets that answer instead. Each write the page sends to the server is noted, and page.asked lists every request.
  async function openOn(search, { replay = {}, session = {} } = {}) {
    const asked = [];
    const answers = async (path, init) => {
      const method = init?.method ?? 'GET';
      asked.push(`${method} ${path}`);
      const stand = replay[`${method} ${path}`];
      if (stand !== undefined) return stand(path, init);
      const response = await realFetch(`http://127.0.0.1:${good.port}${path}`, {
        method, headers: { ...(init?.headers ?? {}), ...owner() }, body: init?.body, redirect: 'manual',
      });
      if (method !== 'POST' && !path.includes('/threads/')) return response;
      const text = await response.text();
      const action = method === 'GET' ? 'getThread' : ACTIONS.find(([pattern]) => pattern.test(path))[1];
      responses.note(action, { status: response.status, headers: Object.fromEntries(response.headers), text, json: JSON.parse(text) });
      return new Response(text, { status: response.status, headers: response.headers });
    };
    const page = await openPage(stagePath(), { search, answers, session });
    page.asked = asked;
    return page;
  }

  const permissionShows = (code, buttons = []) => (page) => assert.deepEqual(
    [page.app.all('h1').map((h1) => h1.textContent), page.app.all('button').map((button) => button.textContent)], [[message(code)], buttons],
  );
  const gateShows = (page) => assert.deepEqual([page.location.reloads, page.session.getItem(GATE_KEY) !== null], [1, true]);
  // By the box: the message, with the limit for a text too long or a body too large; the text is kept.
  const byBox = (id, code, limit = false) => (page) => {
    assert.equal(page.document.getElementById(`${id}-error`).textContent, limit ? `${message(code)} ${THREAD_WORDS.limit}` : message(code));
    assert.equal(fieldOf(page, id).getAttribute('aria-invalid'), 'true');
    assert.notEqual(fieldOf(page, id).value, '');
  };
  // In the place of what failed: the message and its button.
  const inPlace = (where, code, button) => (page) => {
    const box = sectionOf(page).all('div', where)[0];
    assert.deepEqual([box.all('b').map((b) => b.textContent), box.all('button').map((each) => each.textContent).filter((text) => text === button)], [[message(code)], [button]]);
  };
  // A 404 for the project or the diagram after a write: the page reads the diagram again first (SCR-145#error).
  const readAgain = (path) => (page) => {
    const sent = page.asked.indexOf(`POST ${path}`);
    assert.ok(sent !== -1 && page.asked.indexOf(`GET /api/projects/${NAME_}/diagrams/${erd.id}`, sent) > sent, page.asked.join(', '));
  };
  const post = (path, body, fields = {}) => ({ method: 'POST', path, headers: { ...json_, ...owner(), ...key() }, body: JSON.stringify(body), ...fields });
  const sendOf = async (each) => {
    failing = Boolean(each.fails);
    try {
      return await (each.fails ? broken : good).send(await each.request());
    } finally {
      failing = false;
    }
  };

  test('every response API-266 lists leads the thread shown to the state SCR-145 gives', async () => {
    const cases = casesOf('getThread', [
      { status: 200, own: true },
      { status: 401, code: 'unauthenticated', request: () => ({ path: readPath(open.id) }), shows: gateShows },
      { status: 403, code: 'not_owner', request: () => ({ path: readPath(open.id), headers: someone() }), shows: permissionShows('not_owner') },
      { status: 403, code: 'owner_only', request: () => ({ path: readPath(open.id), headers: s.agent.headers }), shows: permissionShows('owner_only') },
      {
        status: 404, code: 'project_not_found', request: () => ({ path: `/api/projects/no-such-project/threads/${open.id}`, headers: owner() }),
        shows: (page) => assert.deepEqual([page.app.all('h1').map((h1) => h1.textContent), page.app.all('a', 'btn').map((a) => a.textContent)], [[message('project_not_found')], ['프로젝트 목록']]),
      },
      {
        status: 404, code: 'thread_not_found', request: () => ({ path: readPath('nc_zzzzzzzzzzzz'), headers: owner() }),
        // The thread the address named: 새로 고침 opens the diagram without it.
        shows: (page) => {
          const note = sectionOf(page).all('div', 'warn')[0];
          assert.deepEqual([textsIn(note, 'b'), note.all('a').map((a) => [a.textContent, a.getAttribute('href')])], [
            [message('thread_not_found')], [['새로 고침', stageHref(NAME_, erd.part, '05-erd', { diagram: erd.id })]],
          ]);
        },
      },
      { status: 500, code: 'internal', fails: true, request: () => ({ path: readPath(open.id), headers: owner() }), shows: inPlace('th-shown', 'internal', '다시 시도') },
    ]);
    for (const each of cases) {
      if (each.own) {
        // The page reads the open thread from the server, by ?thread=.
        const page = await openOn(`?d=${erd.id}&thread=${open.id}`);
        try {
          assert.deepEqual(textsIn(shownThread(page), 'span', 'tx'), ['열린 스레드']);
        } finally {
          page.close();
        }
        continue;
      }
      const answer = responses.note('getThread', await sendOf(each));
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      const page = await openOn(`?d=${erd.id}&thread=${open.id}`, { replay: { [`GET ${readPath(open.id)}`]: replayOf(answer) } });
      try {
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('getThread');
  });

  test('every response API-267 lists leads a new comment to the state SCR-145 gives', async () => {
    const body = (fields = {}) => ({ drawing: erd.drawing.id, target: 'diagram', text: '새 댓글', ...fields });
    const reused = key();
    const id = 'th-new';
    const cases = casesOf('startThread', [
      { status: 201, own: true },
      { status: 400, code: 'invalid_request', request: () => post(startPath(), body({ target: 'row' })), shows: byBox(id, 'invalid_request') },
      { status: 400, code: 'text_too_long', request: () => post(startPath(), body({ text: 'x'.repeat(4001) })), shows: byBox(id, 'text_too_long', true) },
      { status: 401, code: 'unauthenticated', request: () => post(startPath(), body(), { headers: { ...json_, ...key() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(startPath(), body(), { headers: { ...json_, ...s.agent.headers, ...key() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(startPath(), body(), { headers: { ...json_, ...someone(), ...key() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(startPath(), body(), { headers: { ...json_, ...owner(), ...key(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/diagrams/${erd.id}/threads`, body()), shows: readAgain(startPath()) },
      { status: 404, code: 'diagram_not_found', request: () => post(`/api/projects/${NAME_}/diagrams/dg_zzzzzzzzzzzz/threads`, body()), shows: readAgain(startPath()) },
      { status: 404, code: 'drawing_not_found', request: () => post(startPath(), body({ drawing: 'dw_zzzzzzzzzzzz' })), shows: inPlace('th-add', 'drawing_not_found', '새로 고침') },
      { status: 404, code: 'element_not_found', request: () => post(startPath(), body({ target: 'element', element: 'TBL-999' })), shows: inPlace('th-add', 'element_not_found', '새로 고침') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post(startPath(), body(), { headers: { ...json_, ...owner(), ...reused } }));
          return post(startPath(), body({ text: '다른 글' }), { headers: { ...json_, ...owner(), ...reused } });
        },
        shows: byBox(id, 'request_key_reused'),
      },
      { status: 413, code: 'body_too_large', request: () => post(startPath(), body({ pad: 'x'.repeat(2 * 1024 * 1024) })), shows: byBox(id, 'body_too_large', true) },
      { status: 415, code: 'json_required', request: () => post(startPath(), body(), { headers: { 'Content-Type': 'text/plain', ...owner(), ...key() } }), shows: inPlace('th-add', 'json_required', '다시 시도') },
      { status: 500, code: 'internal', fails: true, request: () => post(startPath(), body()), shows: inPlace('th-add', 'internal', '다시 시도') },
    ]);
    for (const each of cases) {
      if (each.own) {
        // The page's own comment on the diagram as a whole, sent to the server.
        const page = await openOn(`?d=${erd.id}`);
        try {
          await send(page, id, '페이지에서 단 댓글');
          assert.deepEqual([textsIn(shownThread(page), 'span', 'tx'), textsIn(shownThread(page), 'span', 'tag')], [['페이지에서 단 댓글'], [THREAD_WORDS.agents]]);
        } finally {
          page.close();
        }
        continue;
      }
      const answer = responses.note('startThread', await sendOf(each));
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      const page = await openOn(`?d=${erd.id}`, { replay: { [`POST ${startPath()}`]: replayOf(answer) } });
      try {
        await send(page, id, '보낼 댓글');
        await page.settle();
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('startThread');
  });

  test('every response API-268 lists leads a reply to the state SCR-145 gives', async () => {
    const reused = key();
    const id = 'th-reply';
    const cases = casesOf('replyInThread', [
      { status: 201, own: true },
      { status: 400, code: 'invalid_request', request: () => post(replyPath(open.id), { text: '답', extra: 1 }), shows: byBox(id, 'invalid_request') },
      { status: 400, code: 'text_too_long', request: () => post(replyPath(open.id), { text: 'x'.repeat(4001) }), shows: byBox(id, 'text_too_long', true) },
      { status: 401, code: 'unauthenticated', request: () => post(replyPath(open.id), { text: '답' }, { headers: { ...json_, ...key() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(replyPath(open.id), { text: '답' }, { headers: { ...json_, ...s.agent.headers, ...key() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(replyPath(open.id), { text: '답' }, { headers: { ...json_, ...someone(), ...key() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(replyPath(open.id), { text: '답' }, { headers: { ...json_, ...owner(), ...key(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/threads/${open.id}/comments`, { text: '답' }), shows: readAgain(replyPath(open.id)) },
      { status: 404, code: 'thread_not_found', request: () => post(replyPath('nc_zzzzzzzzzzzz'), { text: '답' }), shows: inPlace('th-shown', 'thread_not_found', '새로 고침') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post(replyPath(open.id), { text: '답' }, { headers: { ...json_, ...owner(), ...reused } }));
          return post(replyPath(open.id), { text: '다른 답' }, { headers: { ...json_, ...owner(), ...reused } });
        },
        shows: byBox(id, 'request_key_reused'),
      },
      {
        status: 409, code: 'thread_closed', request: () => post(replyPath(shut.id), { text: '답' }),
        shows: (page) => {
          const bar = page.app.all('div', 'wb-notice')[0];
          assert.deepEqual([textsIn(bar, 'b'), textsIn(bar, 'span')], [[message('thread_closed')], [THREAD_WORDS.kept]]);
          assert.equal(fieldOf(page, 'th-new').value, '보낼 답');
        },
      },
      { status: 413, code: 'body_too_large', request: () => post(replyPath(open.id), { text: 'x', pad: 'x'.repeat(2 * 1024 * 1024) }), shows: byBox(id, 'body_too_large', true) },
      { status: 415, code: 'json_required', request: () => post(replyPath(open.id), { text: '답' }, { headers: { 'Content-Type': 'text/plain', ...owner(), ...key() } }), shows: inPlace('th-shown', 'json_required', '다시 시도') },
      { status: 500, code: 'internal', fails: true, request: () => post(replyPath(open.id), { text: '답' }), shows: inPlace('th-shown', 'internal', '다시 시도') },
    ]);
    for (const each of cases) {
      if (each.own) {
        const page = await openOn(`?d=${erd.id}&thread=${open.id}`);
        try {
          await send(page, id, '페이지에서 단 답');
          assert.deepEqual(textsIn(shownThread(page), 'span', 'tx').at(-1), '페이지에서 단 답');
          assert.deepEqual(textsIn(shownThread(page), 'span', 'tag'), [THREAD_WORDS.agents]);
        } finally {
          page.close();
        }
        continue;
      }
      const answer = responses.note('replyInThread', await sendOf(each));
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      const page = await openOn(`?d=${erd.id}&thread=${open.id}`, { replay: { [`POST ${replyPath(open.id)}`]: replayOf(answer) } });
      try {
        await send(page, id, '보낼 답');
        await page.settle();
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('replyInThread');
  });

  test('every response API-269 lists leads a close to the state SCR-145 gives', async () => {
    const reused = key();
    const cases = casesOf('closeThread', [
      { status: 200, own: true },
      { status: 400, code: 'invalid_request', request: () => post(closePath(open.id), {}, { headers: { ...json_, ...owner() } }), shows: inPlace('th-shown', 'invalid_request', '다시 시도') },
      { status: 401, code: 'unauthenticated', request: () => post(closePath(open.id), {}, { headers: { ...json_, ...key() } }), shows: gateShows },
      { status: 403, code: 'owner_only', request: () => post(closePath(open.id), {}, { headers: { ...json_, ...s.agent.headers, ...key() } }), shows: permissionShows('owner_only') },
      { status: 403, code: 'not_owner', request: () => post(closePath(open.id), {}, { headers: { ...json_, ...someone(), ...key() } }), shows: permissionShows('not_owner') },
      { status: 403, code: 'cross_site', request: () => post(closePath(open.id), {}, { headers: { ...json_, ...owner(), ...key(), 'Sec-Fetch-Site': 'cross-site' } }), shows: permissionShows('cross_site', ['새로 고침']) },
      { status: 404, code: 'project_not_found', request: () => post(`/api/projects/no-such-project/threads/${open.id}/close`, {}), shows: readAgain(closePath(open.id)) },
      { status: 404, code: 'thread_not_found', request: () => post(closePath('nc_zzzzzzzzzzzz'), {}), shows: inPlace('th-shown', 'thread_not_found', '새로 고침') },
      {
        status: 409, code: 'request_key_reused',
        request: async () => {
          await good.send(post(replyPath(open.id), { text: '키를 쓴 답' }, { headers: { ...json_, ...owner(), ...reused } }));
          return post(closePath(open.id), {}, { headers: { ...json_, ...owner(), ...reused } });
        },
        shows: inPlace('th-shown', 'request_key_reused', '다시 시도'),
      },
      { status: 413, code: 'body_too_large', request: () => post(closePath(open.id), { pad: 'x'.repeat(2 * 1024 * 1024) }), shows: inPlace('th-shown', 'body_too_large', '다시 시도') },
      { status: 415, code: 'json_required', request: () => post(closePath(open.id), {}, { headers: { 'Content-Type': 'text/plain', ...owner(), ...key() } }), shows: inPlace('th-shown', 'json_required', '다시 시도') },
      { status: 500, code: 'internal', fails: true, request: () => post(closePath(open.id), {}), shows: inPlace('th-shown', 'internal', '다시 시도') },
    ]);
    // The open thread stays open until the page's own close, the last case.
    const order = [...cases.filter((each) => !each.own), ...cases.filter((each) => each.own)];
    for (const each of order) {
      if (each.own) {
        const page = await openOn(`?d=${erd.id}&thread=${open.id}`);
        try {
          buttonOf(shownThread(page), THREAD_WORDS.close).click();
          await page.settle();
          assert.deepEqual([textsIn(shownThread(page), 'span', 'tag'), fieldOf(page, 'th-reply')], [[THREAD_WORDS.closed], null]);
        } finally {
          page.close();
        }
        continue;
      }
      const answer = responses.note('closeThread', await sendOf(each));
      assert.deepEqual([answer.status, answer.json.code], [each.status, each.code]);
      const page = await openOn(`?d=${erd.id}&thread=${open.id}`, { replay: { [`POST ${closePath(open.id)}`]: replayOf(answer) } });
      try {
        buttonOf(shownThread(page), THREAD_WORDS.close).click();
        await page.settle();
        await page.settle();
        each.shows(page);
      } finally {
        page.close();
      }
    }
    responses.assertEvery('closeThread');
  });
});
