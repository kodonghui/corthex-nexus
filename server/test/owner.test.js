// The owner's projects and to-do (TASK-439; API-262, API-263, SPEC-015, SPEC-042, SPEC-048, SPEC-052, rule 5): every
// response the two operations list, their answers against the contract's ProjectList and OwnerTodo, the tables they
// touch (notes 22 and 23) and their log lines. The rows are written straight into the store with test/seed.js, the
// entries are opened by src/entries.js, and the backups of TBL-170 are written here as TASK-450's job (src/backups.js)
// writes them.

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { after, before, describe, test } from 'node:test';
import { backupWarning } from '../src/backups.js';
import { changeSetsChanged, confirmationsChanged, threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { confirmReason, ownerTodo, questionChoices } from '../src/owner.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { localGate, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const at = (minutes) => new Date(Date.parse('2026-11-23T00:00:00.000Z') + minutes * 60 * 1000).toISOString();

// A backup row as TASK-450's job writes one (TBL-170): its first attempt or its retry, running, succeeded or failed.
function backup(db, { name, attempt = 1, state, startedAt, finishedAt = state === 'running' ? null : startedAt }) {
  return Number(db.prepare(
    'INSERT INTO backups (name, attempt, state, bytes, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(name, attempt, state, state === 'succeeded' ? 1024 : null, startedAt, finishedAt).lastInsertRowid);
}

describe('the owner\'s projects and to-do', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  // The projects of the list and the to-do, and what each entry is about.
  let fixture;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const list = async (headers = owner()) => responses.note('listProjects', await server.send({ path: '/api/projects', headers }));
  const todo = async (headers = owner()) => responses.note('getOwnerTodo', await server.send({ path: '/api/todo', headers }));
  const sync = (change, space, args, time) => change(db, { project: space.id, time, ...args });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-owner-'));
    // A v2 store with a project sits in the data folder, as on a server that ran v2 (SPEC-015).
    const v2 = new DatabaseSync(join(folder, 'nexus.sqlite'));
    v2.exec("CREATE TABLE project_spaces (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO project_spaces VALUES (1, 'v2-project');");
    v2.close();
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, routes: ROUTES });
    // Only an agent credential: a new install has no project space.
    s = seed(db);
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('a new install lists no project and nothing to do, and never reads a v2 store beside it (SPEC-015)', async () => {
    const projects = await list();
    assert.equal(projects.status, 200);
    assert.deepEqual(projects.json, { projects: [], backup: null });
    const entries = await todo();
    assert.equal(entries.status, 200);
    assert.deepEqual(entries.json, { entries: [], morning: [], backup: null });
  });

  test('lists the projects newest send first, each with its head, what waits on the owner and its stages passed (SCR-143)', async () => {
    fixture = everyKind();
    const answer = await list();
    assert.equal(answer.status, 200);
    const { alpha, bravo, delta, echo } = fixture;
    assert.deepEqual(answer.json, {
      projects: [
        // Sent last, with its title from the snapshot it holds: its 5 owner entries, and 2 stages passed, since the
        // pass of 05-erd changed since.
        { name: 'alpha', title: 'Alpha', revision: 2, commit: alpha.commit, pushed_at: at(90), owner_todo: 5, stages_passed: 2 },
        // No title in its snapshot: the name.
        { name: 'bravo', title: 'bravo', revision: 2, commit: bravo.commit, pushed_at: at(75), owner_todo: 2, stages_passed: 0 },
        // Sent at the same time: by name.
        { name: 'delta', title: 'delta', revision: 1, commit: delta.commit, pushed_at: at(60), owner_todo: 0, stages_passed: 0 },
        { name: 'echo', title: 'echo', revision: 1, commit: echo.commit, pushed_at: at(60), owner_todo: 0, stages_passed: 13 },
        // A space that holds no snapshot yet comes last.
        { name: 'charlie', title: 'charlie', revision: null, commit: null, pushed_at: null, owner_todo: 0, stages_passed: 0 },
      ],
      backup: null,
    });
  });

  test('returns oldest first and selects morning priorities before the list cap', async () => {
    const answer = await todo();
    assert.equal(answer.status, 200);
    const { entries, morning } = answer.json;
    assert.equal(entries.length, 7);
    assert.deepEqual(entries.map((entry) => entry.since), [at(5), at(10), at(20), at(30), at(40), at(45), at(50)]);
    assert.deepEqual(morning.map((entry) => entry.kind), ['proposal', 'question', 'question', 'confirm', 'confirm']);
    assert.equal(morning[0].change_set, fixture.ids.proposal);
    assert.equal(morning[1].question_text, 'Should this table keep its last use?');
  });

  test('only explicit unchecked choices are exposed as answer buttons', () => {
    assert.deepEqual(questionChoices('Choose one\n- [ ] Three days\n- [ ] Seven days'), ['Three days', 'Seven days']);
    assert.deepEqual(questionChoices('Steps\n1. Gather items\n2. Review'), []);
    assert.deepEqual(questionChoices('- [ ] Just one'), []);
    assert.deepEqual(questionChoices('Choose one\n- [ ] Short\n- [ ] Another\n- [ ] ' + 'x'.repeat(201)), []);
  });

  test('an unrecognized stage cannot consume a morning slot or the inbox cap', () => {
    const project = s.project('unknown-stage');
    const diagram = s.diagram(project, { stage: '14-other' });
    sync(confirmationsChanged, project, { diagram: diagram.id }, at(1));
    const result = ownerTodo(db);
    assert.ok(result.morning.every((entry) => entry.stage !== '14-other'));
    assert.ok(result.entries.every((entry) => entry.stage !== '14-other'));
    db.prepare('DELETE FROM project_spaces WHERE id = ?').run(project.id);
  });

  test('a confirm entry says why the diagram waits: never confirmed, invalidated or cancelled', () => {
    assert.equal(confirmReason(null), 'new');
    assert.equal(confirmReason('invalidated'), 'invalidated');
    assert.equal(confirmReason('cancelled'), 'cancelled');
  });

  test('a removed diagram keeps its questions and proposals on the to-do, and its confirm entry is withdrawn (SPEC-027, note 4)', async () => {
    const space = s.project('foxtrot');
    const erd = s.diagram(space);
    sync(confirmationsChanged, space, { diagram: erd.id }, at(100));
    const question = s.thread(erd, { author: 'agent', at: at(101) });
    sync(threadChanged, space, { thread: question }, at(101));
    const proposalThread = s.thread(erd, { author: 'owner', at: at(102) });
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: proposalThread });
    sync(changeSetsChanged, space, { diagram: erd.id }, at(102));
    const kinds = async () => (await todo()).json.entries.filter((each) => each.project === 'foxtrot').map((each) => each.kind);
    assert.deepEqual(await kinds(), ['confirm', 'question', 'proposal']);

    s.removeDiagram(erd.id);
    sync(confirmationsChanged, space, { diagram: erd.id }, at(103));
    assert.deepEqual(await kinds(), ['question', 'proposal']);
    const listed = (await list()).json.projects.find((project) => project.name === 'foxtrot');
    assert.equal(listed.owner_todo, 2);
    assert.ok((await todo()).json.entries.some((each) => each.change_set === idOf('np', proposal)));
  });

  test('warns once the retry of a failed daily backup failed, until a backup succeeds (SPEC-042, SPEC-052)', async () => {
    const warnings = async () => {
      const [projects, entries] = [await list(), await todo()];
      assert.deepEqual(projects.json.backup, entries.json.backup);
      return entries.json.backup;
    };
    backup(db, { name: 'nexus-2026-11-21.sqlite', state: 'succeeded', startedAt: '2026-11-21T00:00:00.000Z', finishedAt: '2026-11-21T00:05:00.000Z' });
    assert.equal(await warnings(), null);
    // The first attempt failed: its retry is due within the hour, so nothing shows yet, nor while the retry runs.
    backup(db, { name: 'nexus-2026-11-22.sqlite', state: 'failed', startedAt: '2026-11-22T00:00:00.000Z', finishedAt: '2026-11-22T00:02:00.000Z' });
    assert.equal(await warnings(), null);
    const retry = backup(db, { name: 'nexus-2026-11-22.sqlite', attempt: 2, state: 'running', startedAt: '2026-11-22T00:30:00.000Z' });
    assert.equal(await warnings(), null);
    // The retry failed: the warning shows, with the last backup that succeeded.
    db.prepare("UPDATE backups SET state = 'failed', finished_at = '2026-11-22T00:31:00.000Z' WHERE id = ?").run(retry);
    const warning = { failed_at: '2026-11-22T00:31:00.000Z', last_succeeded_at: '2026-11-21T00:05:00.000Z' };
    assert.deepEqual(await warnings(), warning);
    // It stays while the next day's backup runs and when its first attempt fails.
    const next = backup(db, { name: 'nexus-2026-11-23.sqlite', state: 'running', startedAt: '2026-11-23T00:00:00.000Z' });
    assert.deepEqual(await warnings(), warning);
    db.prepare("UPDATE backups SET state = 'failed', finished_at = '2026-11-23T00:01:00.000Z' WHERE id = ?").run(next);
    assert.deepEqual(await warnings(), warning);
    // Until a backup succeeds: here the retry.
    backup(db, { name: 'nexus-2026-11-23.sqlite', attempt: 2, state: 'succeeded', startedAt: '2026-11-23T00:30:00.000Z', finishedAt: '2026-11-23T00:34:00.000Z' });
    assert.equal(await warnings(), null);
  });

  test('a backup warning with no backup that ever succeeded, and a failed retry that kept no finish time', (t) => {
    const store = testStore(t);
    assert.equal(backupWarning(store), null);
    backup(store, { name: 'nexus-2026-11-22.sqlite', state: 'failed', startedAt: '2026-11-22T00:00:00.000Z' });
    assert.equal(backupWarning(store), null);
    backup(store, { name: 'nexus-2026-11-22.sqlite', attempt: 2, state: 'failed', startedAt: '2026-11-22T00:30:00.000Z', finishedAt: null });
    assert.deepEqual(backupWarning(store), { failed_at: '2026-11-22T00:30:00.000Z', last_succeeded_at: null });
  });

  test('lists at most 1000 projects and the oldest 5000 entries', async () => {
    const space = s.project('golf');
    const erd = s.diagram(space);
    const insert = db.prepare(
      "INSERT INTO todos (project_id, side, kind, diagram_id, created_at) VALUES (?, 'owner', 'confirm', ?, ?)",
    );
    const spaces = db.prepare(
      "INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES (?, '2026-11-23T00:00:00.000Z', ?)",
    );
    db.exec('BEGIN');
    // Older than existing questions, so priority selection must look beyond the full-list cap.
    for (let i = 0; i < 5001; i += 1) insert.run(space.id, erd.id, new Date(Date.parse('2026-01-01T00:00:00.000Z') + i * 1000).toISOString());
    for (let i = 0; i < 1000; i += 1) spaces.run(`unsent-${String(i).padStart(4, '0')}`, s.agent.key);
    db.exec('COMMIT');
    try {
      const answer = (await todo()).json;
      const entries = answer.entries;
      assert.equal(entries.length, 5000);
      assert.ok(entries.every((each) => each.project === 'golf'));
      assert.equal(entries[0].since, '2026-01-01T00:00:00.000Z');
      assert.ok(answer.morning.some((each) => each.project === 'alpha' && each.kind === 'proposal'));
      assert.deepEqual(entries.map((each) => each.since), entries.map((each) => each.since).sort());
      const projects = (await list()).json.projects;
      assert.equal(projects.length, 1000);
      assert.equal(projects.find((project) => project.name === 'golf').owner_todo, 5001);
      // Those sent come first, newest first; the spaces without a snapshot fill the rest by name.
      const sent = projects.filter((project) => project.pushed_at !== null);
      assert.deepEqual(projects.slice(0, sent.length), sent);
      assert.deepEqual(sent.map((project) => project.pushed_at), sent.map((project) => project.pushed_at).sort().reverse());
      const unsent = Array.from({ length: 1000 - sent.length - 1 }, (_, i) => `unsent-${String(i).padStart(4, '0')}`);
      assert.deepEqual(projects.slice(sent.length).map((project) => project.name), ['charlie', ...unsent]);
    } finally {
      db.prepare("DELETE FROM project_spaces WHERE name LIKE 'unsent-%' OR name = 'golf'").run();
    }
  });

  test('a read writes nothing', async () => {
    const tables = ['project_spaces', 'snapshots', 'diagrams', 'confirmations', 'change_sets', 'stage_passes', 'todos', 'backups'];
    const rows = () => JSON.stringify(tables.map((table) => db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const before = rows();
    assert.equal((await list()).status, 200);
    assert.equal((await todo()).status, 200);
    assert.equal(rows(), before);
  });

  test('refuses a request without the owner\'s sign-in, of another person, or with an agent credential (SPEC-048)', async () => {
    for (const read of [list, todo]) {
      const none = await read({});
      assert.deepEqual([none.status, none.json.code], [401, 'unauthenticated']);
      const someone = await read({ 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) });
      assert.deepEqual([someone.status, someone.json.code], [403, 'not_owner']);
      const agent = await read(s.agent.headers);
      assert.deepEqual([agent.status, agent.json.code], [403, 'owner_only']);
      for (const answer of [none, someone, agent]) {
        for (const text of ['alpha', 'Alpha', 'FL-001']) assert.equal(answer.text.includes(text), false);
      }
    }
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    seed(store).project('broken');
    // A store whose backups cannot be read, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM backups')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    for (const [action, path] of [['listProjects', '/api/projects'], ['getOwnerTodo', '/api/todo']]) {
      const answer = responses.note(action, await other.send({ path, headers: owner() }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(2);
    for (const line of lines) assert.equal(line.error, 'Error');
    assert.equal(other.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never a project\'s text or the data folder (rule 5)', async () => {
    const title = `A title no log line may hold ${Date.now()}`;
    const name = `A diagram name no log line may hold ${Date.now()}`;
    const space = s.project('hotel');
    s.snapshot(space, { title });
    const erd = s.diagram(space, { name });
    sync(confirmationsChanged, space, { diagram: erd.id }, at(200));
    assert.equal((await list()).json.projects.find((project) => project.name === 'hotel').title, title);
    assert.ok((await todo()).json.entries.some((each) => each.diagram_name === name));
    const lines = (await server.logged(10)).filter((line) => ['listProjects', 'getOwnerTodo'].includes(line.action));
    assert.ok(lines.length >= 10);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [title, name, 'no log line may hold', 'nexus-2026-11-2', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false);
    }
  });

  test('answers every response API-262 and API-263 list', () => {
    responses.assertEvery('listProjects');
    responses.assertEvery('getOwnerTodo');
  });

  test('touches the tables their x-corthex.tables list, and admission only the layer\'s (notes 22 and 23)', () => {
    checkTables(recorder, 'listProjects');
    checkTables(recorder, 'getOwnerTodo');
    checkLayer(recorder);
  });

  // The projects of the list and the to-do: alpha with an owner entry of every kind and reason, of a stage picture of
  // its part, a file picture whose part only its snapshot's /snapshot document names, and an item table; bravo, a
  // project as a whole; delta and echo sent at the same time; charlie, a space without a snapshot.
  function everyKind() {
    const pictures = [{ part: 'nexus', stage: '03-user-flow', key: 'docs/03-user-flow/FL-001.md', commit: '' }];
    const alpha = s.project('alpha', { pictures });
    const erd = s.diagram(alpha, { sourceKey: '/pictures/05-erd/nexus' });
    const flow = s.diagram(alpha, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001.md', kind: 'user_flow', name: 'FL-001' });
    const table = s.diagram(alpha, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' });
    s.snapshot(alpha, { title: 'Alpha', pictures, at: at(90) });

    // Never confirmed, invalidated by a new drawing, and cancelled.
    sync(confirmationsChanged, alpha, { diagram: table.id }, at(10));
    const invalidated = s.confirm(alpha, erd);
    s.invalidate(invalidated, s.drawing(alpha, erd.id));
    sync(confirmationsChanged, alpha, { diagram: erd.id }, at(20));
    const cancelled = s.confirm(alpha, flow);
    s.cancel(cancelled);
    sync(confirmationsChanged, alpha, { diagram: flow.id }, at(30));
    // An AI proposal on a thread, and an agent's question.
    const proposalThread = s.thread(erd, { author: 'owner', at: at(40) });
    const proposal = s.changeSet(alpha, erd, { origin: 'proposal', threadId: proposalThread });
    sync(changeSetsChanged, alpha, { diagram: erd.id }, at(40));
    const question = s.thread(flow, { author: 'agent', target: 'diagram', at: at(50) });
    sync(threadChanged, alpha, { thread: question }, at(50));
    // A question the owner answered is closed, and the agent's entries are not the owner's.
    const answered = s.thread(erd, { author: 'agent', at: at(15) });
    sync(threadChanged, alpha, { thread: answered }, at(15));
    s.comment(answered, { author: 'owner', at: at(16) });
    sync(threadChanged, alpha, { thread: answered }, at(16));
    // Two stages passed, and one whose pass changed since.
    s.pass(alpha, '01-domain');
    s.pass(alpha, '02-prd');
    s.changePass(s.pass(alpha, '05-erd'));

    const bravo = s.project('bravo');
    const bravoErd = s.diagram(bravo);
    s.snapshot(bravo, { at: at(75) });
    sync(confirmationsChanged, bravo, { diagram: bravoErd.id }, at(5));
    const bravoQuestion = s.thread(bravoErd, { author: 'agent', at: at(45) });
    sync(threadChanged, bravo, { thread: bravoQuestion }, at(45));

    const delta = s.project('delta');
    const echo = s.project('echo');
    // Every stage passed, a stage that is none of the 13 counting for none.
    for (const stage of ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap',
      '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation', '14-other']) s.pass(echo, stage);
    db.prepare(
      "INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES ('charlie', '2026-11-23T00:00:00.000Z', ?)",
    ).run(s.agent.key);

    return {
      alpha, bravo, delta, echo,
      ids: {
        erd: idOf('dg', erd.id),
        flow: idOf('dg', flow.id),
        table: idOf('dg', table.id),
        proposal: idOf('np', proposal),
        proposalThread: idOf('nc', proposalThread),
        question: idOf('nc', question),
        bravoErd: idOf('dg', bravoErd.id),
        bravoQuestion: idOf('nc', bravoQuestion),
      },
    };
  }
});
