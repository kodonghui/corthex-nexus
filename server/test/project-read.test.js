// The project read (TASK-440; API-264, SPEC-005, SPEC-027, SPEC-035, SPEC-046, rule 5): every response API-264 lists,
// its answer against the contract's Project, the tables it touches (note 23) and its log lines. Its rows are written
// straight into the store with test/seed.js, the stage passes and tool links included, as the operations of later
// tasks will write them (notes 19 and 25 of the WBS).

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { confirmationOf, projectTitle, stageGroups } from '../src/project.js';
import { ROUTES } from '../src/routes.js';
import { STAGES } from '../src/snapshot.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { REPOSITORY, seed, TIME } from './seed.js';
import { localGate, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const at = (minutes) => new Date(Date.parse('2026-11-23T00:00:00.000Z') + minutes * 60 * 1000).toISOString();
// The 13 rows of a group of the stage list, as a group with nothing in it shows them.
const group = (part) => STAGES.map((stage) => ({ stage, part, state: 'not_sent', passed_at: null, diagrams: [] }));

describe('the project read', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const read = async (name, headers = owner()) => responses.note('getProject', await server.send({ path: `/api/projects/${name}`, headers }));
  const rowOf = (answer, stage, part = '') => answer.json.stages.find((row) => row.stage === stage && row.part === part);
  const stateOf = (answer, stage, part = '') => {
    const { state, passed_at: passedAt } = rowOf(answer, stage, part);
    return { state, passed_at: passedAt };
  };

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-project-'));
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

  test('a stage shows passed from its pass record, and changed since the pass once a confirmation it rests on is invalidated (SPEC-035)', async () => {
    const space = s.project();
    const table = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' });
    const erd = s.diagram(space);
    // Each stage passed when the confirmation of its one diagram was recorded.
    s.record(s.confirm(space, table));
    const confirmation = s.confirm(space, erd);
    s.record(confirmation);
    s.pass(space, '02-prd', { passedAt: at(40) });
    const erdPass = s.pass(space, '05-erd', { passedAt: at(50) });

    let answer = await read(space.name);
    assert.equal(answer.status, 200);
    assert.deepEqual(stateOf(answer, '02-prd'), { state: 'passed', passed_at: at(40) });
    assert.deepEqual(stateOf(answer, '05-erd'), { state: 'passed', passed_at: at(50) });
    assert.equal(rowOf(answer, '05-erd').diagrams[0].confirmation, 'recorded');
    // A stage with no diagram and no pass was not sent.
    assert.deepEqual(stateOf(answer, '06-api'), { state: 'not_sent', passed_at: null });

    // A new snapshot changes the ERD's document: its drawing invalidates the confirmation (SPEC-033). The stage shows
    // what its pass record says, so it stays passed until TASK-435 marks the pass changed.
    s.snapshot(space);
    const redrawn = s.drawing(space, erd.id);
    s.invalidate(confirmation, redrawn);
    answer = await read(space.name);
    assert.deepEqual(stateOf(answer, '05-erd'), { state: 'passed', passed_at: at(50) });
    assert.equal(rowOf(answer, '05-erd').diagrams[0].confirmation, 'invalidated');
    s.changePass(erdPass, { at: at(70) });
    answer = await read(space.name);
    // The pass stays in the record, with its time.
    assert.deepEqual(stateOf(answer, '05-erd'), { state: 'changed_since_pass', passed_at: at(50) });
    assert.deepEqual(stateOf(answer, '02-prd'), { state: 'passed', passed_at: at(40) });

    // Confirmed and recorded again, the stage passes again, and its latest pass is the one shown.
    s.record(s.confirm(space, { id: erd.id, drawing: redrawn }));
    s.pass(space, '05-erd', { passedAt: at(90) });
    answer = await read(space.name);
    assert.deepEqual(stateOf(answer, '05-erd'), { state: 'passed', passed_at: at(90) });
    assert.equal(rowOf(answer, '05-erd').diagrams[0].confirmation, 'recorded');

    // A stage with a diagram and no pass is open.
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001-a.md', kind: 'user_flow', name: 'FL-001' });
    s.confirm(space, flow);
    answer = await read(space.name);
    assert.deepEqual(stateOf(answer, '03-user-flow'), { state: 'open', passed_at: null });
  });

  test('removed diagrams count for no state and are listed after the others only while they have open threads (SPEC-027, SPEC-005)', async () => {
    const space = s.project();
    const flow = (key, name, options = {}) => s.diagram(space, { stage: '03-user-flow', sourceKey: `docs/03-user-flow/${key}`, kind: 'user_flow', name, ...options });
    const second = flow('FL-002-b.md', 'FL-002');
    const first = flow('FL-001-a.md', 'FL-001');
    // Removed with an open thread, its name first: listed after the others, marked removed.
    const gone = flow('FL-000-gone.md', 'FL-000', { removed: true });
    s.thread(gone, { target: 'diagram' });
    // The item table that made way for the stage's pictures keeps its threads (SPEC-005).
    const items = s.diagram(space, { stage: '03-user-flow', sourceKey: '/items/03-user-flow', kind: 'item_table', name: '03-user-flow', removed: true });
    s.thread(items, { target: 'row', elementKey: 'FL-001' });
    // Removed with its threads closed: not listed.
    const closed = flow('FL-009-closed.md', 'FL-009', { removed: true });
    s.closeThread(s.thread(closed, { target: 'diagram' }));
    // Stage 05's only diagram is removed: listed for its open thread, but the stage holds no diagram.
    const erd = s.diagram(space, { removed: true });
    s.thread(erd);
    // Stage 07's only diagram is removed and confirmed, with no open thread: nothing is listed.
    const sitemap = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap', kind: 'sitemap', name: 'Sitemap', removed: true });
    s.record(s.confirm(space, sitemap));

    const answer = await read(space.name);
    assert.equal(answer.status, 200);
    const flows = rowOf(answer, '03-user-flow');
    assert.deepEqual(flows.diagrams.map((each) => [each.id, each.removed, each.open_threads]), [
      [idOf('dg', first.id), false, 0],
      [idOf('dg', second.id), false, 0],
      [idOf('dg', items.id), true, 1],
      [idOf('dg', gone.id), true, 1],
    ]);
    assert.equal(flows.state, 'open');
    assert.deepEqual(rowOf(answer, '05-erd'), {
      stage: '05-erd',
      part: '',
      state: 'not_sent',
      passed_at: null,
      diagrams: [{ id: idOf('dg', erd.id), kind: 'erd', name: 'ERD', removed: true, drawn: true, confirmation: 'none', waiting: 0, open_threads: 1 }],
    });
    assert.deepEqual(rowOf(answer, '07-sitemap'), { stage: '07-sitemap', part: '', state: 'not_sent', passed_at: null, diagrams: [] });
    assert.equal(answer.json.stages.flatMap((row) => row.diagrams).some((each) => each.id === idOf('dg', closed.id)), false);
  });

  test('a removed diagram is listed while a proposed AI proposal or a direct edit waiting for reflection keeps it, and not for an accepted proposal or a live confirmation (SPEC-027, SPEC-020, TASK-468)', async () => {
    const space = s.project();
    const flow = (key, name) => s.diagram(space, { stage: '03-user-flow', sourceKey: `docs/03-user-flow/${key}`, kind: 'user_flow', name, removed: true });
    // A thread on the diagram that the owner closed.
    const closedThread = (where) => {
      const id = s.thread(where, { target: 'diagram' });
      s.closeThread(id);
      return id;
    };
    // Kept, each with its threads closed: a proposed AI proposal; a direct edit waiting for reflection; and one in an
    // open pull request, which still waits.
    const proposed = flow('FL-001-proposed.md', 'FL-001');
    s.changeSet(space, proposed, { origin: 'proposal', threadId: closedThread(proposed) });
    const edited = flow('FL-002-edited.md', 'FL-002');
    s.changeSet(space, edited);
    const linked = flow('FL-003-linked.md', 'FL-003');
    s.changeSet(space, linked, { pullRequestId: s.pullRequest(space, { number: 7 }) });
    // Kept by nothing: an accepted AI proposal, which waits on the agent; a live confirmation, recorded or not; a
    // rejected and a withdrawn proposal; and a cancelled and a reflected edit; each with its threads closed.
    const accepted = flow('FL-004-accepted.md', 'FL-004');
    s.changeSet(space, accepted, { origin: 'proposal', threadId: closedThread(accepted), state: 'accepted' });
    const confirmed = flow('FL-005-confirmed.md', 'FL-005');
    s.confirm(space, confirmed);
    const recorded = flow('FL-006-recorded.md', 'FL-006');
    s.record(s.confirm(space, recorded));
    const answered = flow('FL-007-answered.md', 'FL-007');
    for (const state of ['rejected', 'cancelled']) s.changeSet(space, answered, { origin: 'proposal', threadId: closedThread(answered), state });
    const done = flow('FL-008-done.md', 'FL-008');
    s.changeSet(space, done, { state: 'cancelled' });
    s.setChangeSet(s.changeSet(space, done), { reflectedDrawing: done.drawing });
    // A rejected proposal's thread stays open (SPEC-020), so it keeps its diagram until the owner closes it.
    const rejected = flow('FL-009-rejected.md', 'FL-009');
    s.changeSet(space, rejected, { origin: 'proposal', threadId: s.thread(rejected, { target: 'diagram' }), state: 'rejected' });

    const answer = await read(space.name);
    assert.equal(answer.status, 200);
    const flows = rowOf(answer, '03-user-flow');
    assert.deepEqual(flows.diagrams.map((each) => [each.name, each.removed, each.waiting, each.open_threads]), [
      ['FL-001', true, 0, 0],
      ['FL-002', true, 1, 0],
      ['FL-003', true, 1, 0],
      ['FL-009', true, 0, 1],
    ]);
    // A removed diagram makes no row open, whatever keeps it listed.
    assert.deepEqual([flows.state, flows.passed_at], ['not_sent', null]);
  });

  test('groups the stages by part, and shows every diagram\'s state, the tool links and the latest workshop (SPEC-005, SPEC-046)', async () => {
    const pictures = [
      { part: 'web', stage: '09-mockup', key: 'design/web-mockup.html', commit: '' },
      { part: '', stage: '03-user-flow', key: 'docs/03-user-flow/FL-001-start.md', commit: '' },
    ];
    const head = { title: 'Demo', parts: ['nexus', 'web'], pictures };
    const space = s.project('demo', head);
    // A board whose only drawing failed, an item table whose confirmation was cancelled, a flow of no part, the ERD with
    // change sets and threads, an ERD of a part the project no longer declares, removed with an open thread, and a
    // mockup of the part web.
    const board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain/nexus', kind: 'ddd_board', name: 'DDD board', status: 'failed' });
    const table = s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' });
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001-start.md', kind: 'user_flow', name: 'FL-001' });
    const erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    const old = s.diagram(space, { sourceKey: '/pictures/05-erd/old', removed: true });
    const mockup = s.diagram(space, { stage: '09-mockup', sourceKey: 'design/web-mockup.html', kind: 'mockup', name: 'web-mockup.html' });

    const tableConfirmation = s.confirm(space, table);
    s.record(tableConfirmation);
    s.cancel(tableConfirmation);
    s.confirm(space, erd);
    s.record(s.confirm(space, mockup));
    const flowConfirmation = s.confirm(space, flow);
    s.record(flowConfirmation);
    s.changeSet(space, erd);
    s.changeSet(space, erd);
    s.changeSet(space, erd, { state: 'cancelled' });
    s.thread(erd);
    s.thread(erd, { author: 'agent' });
    s.closeThread(s.thread(erd));
    s.thread(old);

    // The next snapshot changes the flow: its new drawing invalidates its confirmation, and its stage's pass is
    // marked changed. Stage 02 passed.
    s.snapshot(space, { ...head, at: at(30) });
    s.invalidate(flowConfirmation, s.drawing(space, flow.id));
    s.pass(space, '02-prd', { passedAt: at(40) });
    s.changePass(s.pass(space, '03-user-flow', { passedAt: at(20) }));

    // Tool links, oldest first: a Jira project of stage 05 added after the project's Notion page, and a removed link.
    const jira = s.toolLink(space, { scope: '05-erd', tool: 'jira', url: 'https://example.atlassian.net/browse/DEMO', addedAt: at(20) });
    const notion = s.toolLink(space, {
      url: 'https://www.notion.so/example-0123456789abcdef', status: 'In progress', statusReadAt: at(25), addedAt: at(10),
    });
    s.toolLink(space, { addedAt: at(5), removed: true });
    // The latest workshop: a closed one, then an open one.
    s.closeWorkshop(s.workshop(space));
    const workshop = s.workshop(space);

    const answer = await read('demo');
    assert.equal(answer.status, 200);
    const summary = (where, kind, name, fields = {}) => ({
      id: idOf('dg', where.id), kind, name, removed: false, drawn: true, confirmation: 'none', waiting: 0, open_threads: 0, ...fields,
    });
    // A stage's pass belongs to the stage, so it shows on the stage's row in every group.
    const passes = (rows) => rows.map((row) => {
      if (row.stage === '02-prd') return { ...row, state: 'passed', passed_at: at(40) };
      if (row.stage === '03-user-flow') return { ...row, state: 'changed_since_pass', passed_at: at(20) };
      return row;
    });
    const set = (rows, stage, fields) => rows.map((row) => (row.stage === stage ? { ...row, ...fields } : row));
    let whole = set(group(''), '02-prd', { diagrams: [summary(table, 'item_table', '02-prd')] });
    whole = set(whole, '03-user-flow', { diagrams: [summary(flow, 'user_flow', 'FL-001', { confirmation: 'invalidated' })] });
    let nexus = set(group('nexus'), '01-domain', { state: 'open', diagrams: [summary(board, 'ddd_board', 'DDD board', { drawn: false })] });
    nexus = set(nexus, '05-erd', { state: 'open', diagrams: [summary(erd, 'erd', 'ERD', { confirmation: 'confirmed', waiting: 2, open_threads: 2 })] });
    const web = set(group('web'), '09-mockup', { state: 'open', diagrams: [summary(mockup, 'mockup', 'web-mockup.html', { confirmation: 'recorded' })] });
    const gone = set(group('old'), '05-erd', { diagrams: [summary(old, 'erd', 'ERD', { removed: true, open_threads: 1 })] });
    assert.deepEqual(answer.json, {
      name: 'demo',
      title: 'Demo',
      repository: REPOSITORY,
      revision: 2,
      commit: space.commit,
      pushed_at: at(30),
      parts: ['nexus', 'web'],
      stages: [...passes(whole), ...passes(nexus), ...passes(web), ...passes(gone)],
      tool_links: [
        {
          id: idOf('tl', notion), scope: 'project', tool: 'notion', url: 'https://www.notion.so/example-0123456789abcdef',
          status: 'In progress', status_read_at: at(25), added_at: at(10),
        },
        {
          id: idOf('tl', jira), scope: '05-erd', tool: 'jira', url: 'https://example.atlassian.net/browse/DEMO',
          status: null, status_read_at: null, added_at: at(20),
        },
      ],
      workshop: { id: idOf('ws', workshop), state: 'open' },
    });
  });

  test('a project with nothing drawn lists the 13 stages of the project as a whole, not sent, and a pass shows without a diagram', async () => {
    const space = s.project();
    let answer = await read(space.name);
    assert.deepEqual(answer.json, {
      name: space.name,
      title: space.name,
      repository: REPOSITORY,
      revision: 1,
      commit: space.commit,
      pushed_at: TIME,
      parts: [],
      stages: group(''),
      tool_links: [],
      workshop: null,
    });
    // A workshop's stage-01 checkpoint (SPEC-039) passes the stage before any domain document is sent; the workshop
    // is closed since.
    s.pass(space, '01-domain', { passedAt: at(10) });
    s.closeWorkshop(s.workshop(space));
    answer = await read(space.name);
    assert.deepEqual(stateOf(answer, '01-domain'), { state: 'passed', passed_at: at(10) });
    assert.equal(answer.json.workshop.state, 'closed');
    assert.deepEqual(answer.json.stages.filter((row) => row.state !== 'not_sent').map((row) => row.stage), ['01-domain']);
  });

  test('the title is the snapshot\'s, or the project\'s name when it gives none or an empty one', async () => {
    for (const [title, expected] of [['', null], ['   ', null], ['NEXUS v3', 'NEXUS v3']]) {
      const space = s.project(undefined, { title });
      const answer = await read(space.name);
      assert.equal(answer.json.title, expected ?? space.name, JSON.stringify(title));
    }
    assert.equal(projectTitle('demo', undefined), 'demo');
    assert.equal(projectTitle('demo', 42), 'demo');
    assert.equal(projectTitle('demo', '\t\n'), 'demo');
    assert.equal(projectTitle('demo', ' Demo '), ' Demo ');
    // At most 120 characters, a character being a code point.
    assert.equal(projectTitle('demo', 'x'.repeat(130)), 'x'.repeat(120));
    assert.equal(projectTitle('demo', '\u{1F600}'.repeat(121)), '\u{1F600}'.repeat(120));
  });

  test('the groups: the project as a whole when needed, the declared parts in order, then the others, at most 51', () => {
    assert.deepEqual(stageGroups([], []), ['']);
    assert.deepEqual(stageGroups([], ['', 'b']), ['', 'b']);
    assert.deepEqual(stageGroups(['nexus'], ['nexus']), ['nexus']);
    assert.deepEqual(stageGroups(['web', 'api'], ['zeta', 'api', '', 'alpha', 'zeta']), ['', 'web', 'api', 'alpha', 'zeta']);
    const many = Array.from({ length: 50 }, (_, index) => `p${index}`);
    assert.deepEqual(stageGroups(many, ['', 'extra']), ['', ...many]);
    assert.deepEqual(['confirmed', 'cancelled', 'invalidated', null].map((state) => confirmationOf(state, null)), ['confirmed', 'none', 'invalidated', 'none']);
    assert.equal(confirmationOf('confirmed', TIME), 'recorded');
  });

  test('lists at most 500 diagrams of a row, 200 tool links and 51 groups (663 rows)', async () => {
    const parts = Array.from({ length: 50 }, (_, index) => `p${index}`);
    const space = s.project(undefined, { parts });
    db.exec('BEGIN');
    try {
      // 501 flows of the project as a whole, the last a removed one with an open thread, which the limit leaves out.
      for (let n = 0; n < 500; n += 1) {
        s.diagram(space, { stage: '03-user-flow', sourceKey: `docs/03-user-flow/FL-${String(n).padStart(3, '0')}.md`, kind: 'user_flow', name: `FL-${n}` });
      }
      s.thread(s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-gone.md', kind: 'user_flow', name: 'A', removed: true }), { target: 'diagram' });
      // A picture of a part the project does not declare: its group is the 52nd, past the limit.
      s.diagram(space, { sourceKey: '/pictures/05-erd/extra' });
      for (let n = 0; n < 201; n += 1) s.toolLink(space, { addedAt: at(n) });
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    const answer = await read(space.name);
    assert.equal(answer.status, 200);
    assert.equal(answer.json.stages.length, 663);
    assert.deepEqual([...new Set(answer.json.stages.map((row) => row.part))], ['', ...parts]);
    const flows = rowOf(answer, '03-user-flow');
    assert.equal(flows.diagrams.length, 500);
    assert.equal(flows.diagrams.some((each) => each.removed), false);
    assert.equal(answer.json.tool_links.length, 200);
    assert.equal(answer.json.tool_links.at(-1).added_at, at(199));
  });

  test('a read writes nothing', async () => {
    const space = s.project('demo-unchanged', { title: 'Unchanged' });
    s.thread(s.diagram(space));
    s.pass(space, '05-erd');
    s.toolLink(space);
    const rows = () => JSON.stringify(['project_spaces', 'diagrams', 'comment_threads', 'confirmations', 'stage_passes', 'tool_links', 'workshops', 'todos']
      .map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const before = rows();
    assert.equal((await read(space.name)).status, 200);
    assert.equal(rows(), before);
  });

  test('refuses a request without the owner\'s sign-in, of another person, or with an agent credential', async () => {
    const space = s.project(undefined, { title: `Private title ${Date.now()}` });
    const none = await read(space.name, {});
    assert.deepEqual([none.status, none.json.code], [401, 'unauthenticated']);
    const someone = await read(space.name, { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) });
    assert.deepEqual([someone.status, someone.json.code], [403, 'not_owner']);
    const agent = await read(space.name, s.agent.headers);
    assert.deepEqual([agent.status, agent.json.code], [403, 'owner_only']);
    for (const answer of [none, someone, agent]) assert.equal(answer.text.includes('Private title'), false);
  });

  test('a name no project space has gets project_not_found, whose detail never repeats it', async () => {
    for (const name of ['no-such-project', 'Upper', 'a--b', 'x'.repeat(65), '%2e%2e']) {
      const answer = await read(name);
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], name);
      assert.equal(answer.json.detail.includes(name), false);
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    // A store whose stage passes cannot be read, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM stage_passes')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const answer = responses.note('getProject', await other.send({ path: `/api/projects/${space.name}`, headers: owner() }));
    assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    const [line] = await other.logged(1);
    assert.equal(line.error, 'Error');
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s text or the data folder (rule 5)', async () => {
    const title = `A title no log line may hold ${Date.now()}`;
    const space = s.project(undefined, { title });
    s.toolLink(space, { status: `A status no log line may hold ${Date.now()}` });
    assert.equal((await read(space.name)).json.title, title);
    const lines = (await server.logged(10)).filter((line) => line.action === 'getProject');
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [title, 'no log line may hold', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('answers every response API-264 lists', () => {
    responses.assertEvery('getProject');
  });

  test('touches the tables its x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'getProject');
    checkLayer(recorder);
  });
});
