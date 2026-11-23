// Deleting a project space (TASK-448; API-277, API-278, SPEC-013, rule 5): every response the two operations list,
// their answers against the contract's RemovalPreview and RemovalAnswer, the rows a deletion removes, table by table,
// the tables they touch (notes 18 and 23) and their log lines. The rows are written straight into the store with
// test/seed.js, a row in every table of a project, as the operations of later tasks will write them.

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { changeSetsChanged, confirmationsChanged, stepsChanged, threadChanged } from '../src/entries.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { responseRecord } from './responses.js';
import { seed, TIME } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

// The rows of each table that belong to the project space with the key given: every table of a project, by the
// schema's keys. The tables of no project are SHARED.
const OF_PROJECT = Object.freeze({
  project_spaces: 'SELECT count(*) AS n FROM project_spaces WHERE id = ?',
  snapshots: 'SELECT count(*) AS n FROM snapshots WHERE project_id = ?',
  snapshot_files: 'SELECT count(*) AS n FROM snapshot_files f JOIN snapshots s ON s.id = f.snapshot_id WHERE s.project_id = ?',
  diagrams: 'SELECT count(*) AS n FROM diagrams WHERE project_id = ?',
  drawings: 'SELECT count(*) AS n FROM drawings WHERE project_id = ?',
  elements: 'SELECT count(*) AS n FROM elements e JOIN drawings w ON w.id = e.drawing_id WHERE w.project_id = ?',
  element_positions: 'SELECT count(*) AS n FROM element_positions p JOIN diagrams d ON d.id = p.diagram_id WHERE d.project_id = ?',
  comment_threads: 'SELECT count(*) AS n FROM comment_threads h JOIN diagrams d ON d.id = h.diagram_id WHERE d.project_id = ?',
  comments: `SELECT count(*) AS n FROM comments c JOIN comment_threads h ON h.id = c.thread_id JOIN diagrams d ON d.id = h.diagram_id
             WHERE d.project_id = ?`,
  pull_requests: 'SELECT count(*) AS n FROM pull_requests WHERE project_id = ?',
  change_sets: 'SELECT count(*) AS n FROM change_sets WHERE project_id = ?',
  changes: 'SELECT count(*) AS n FROM changes c JOIN change_sets s ON s.id = c.change_set_id WHERE s.project_id = ?',
  confirmations: 'SELECT count(*) AS n FROM confirmations WHERE project_id = ?',
  stage_passes: 'SELECT count(*) AS n FROM stage_passes WHERE project_id = ?',
  workshops: 'SELECT count(*) AS n FROM workshops WHERE project_id = ?',
  workshop_steps: 'SELECT count(*) AS n FROM workshop_steps WHERE project_id = ?',
  sticky_notes: 'SELECT count(*) AS n FROM sticky_notes n JOIN workshops w ON w.id = n.workshop_id WHERE w.project_id = ?',
  sticky_links: 'SELECT count(*) AS n FROM sticky_links l JOIN workshops w ON w.id = l.workshop_id WHERE w.project_id = ?',
  todos: 'SELECT count(*) AS n FROM todos WHERE project_id = ?',
  claims: 'SELECT count(*) AS n FROM claims WHERE project_id = ?',
  tool_links: 'SELECT count(*) AS n FROM tool_links WHERE project_id = ?',
});
const SHARED = Object.freeze(['agent_credentials', 'document_blobs', 'request_keys', 'backups', 'restore_rehearsals']);

describe('deleting a project space', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;

  const owner = () => ({ 'Cf-Access-Jwt-Assertion': local.token() });
  const key = () => ({ 'Idempotency-Key': `"${newId('nw')}"` });
  const preview = async (name, headers = owner()) => responses.note(
    'getRemovalPreview', await server.send({ path: `/api/projects/${name}/removal`, headers }),
  );
  const remove = async (name, { body = JSON.stringify({ name }), headers = {} } = {}) => responses.note('deleteProject', await server.send({
    method: 'POST', path: `/api/projects/${name}/removal`, headers: { ...JSON_TYPE, ...owner(), ...key(), ...headers }, body,
  }));
  const tables = () => db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
    .map((row) => row.name);
  // Every row of every table, as JSON text by table.
  const dump = () => Object.fromEntries(tables().map((table) => [
    table, db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all().map((row) => JSON.stringify(row)),
  ]));
  const rowsOf = (space) => Object.fromEntries(Object.entries(OF_PROJECT).map(([table, sql]) => [table, db.prepare(sql).get(space.id).n]));

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-removal-'));
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

  // A project space with rows in every table of a project, and its expected preview. Its documents are two blobs of
  // its own, its /snapshot document and one other file, and the shared blob, which other projects may name too.
  function fill(name) {
    const sync = (change, args, time = TIME) => change(db, { project: space.id, time, ...args });
    const space = s.project(name);
    const file = (snapshot, path, text) => {
      db.prepare('INSERT INTO document_blobs (sha256, body, bytes) VALUES (?, ?, ?) ON CONFLICT (sha256) DO NOTHING')
        .run(sha256(text), text, Buffer.byteLength(text));
      db.prepare("INSERT INTO snapshot_files (snapshot_id, path, stage, blob_sha256) VALUES (?, ?, '02-prd', ?)").run(snapshot, path, sha256(text));
    };
    const erd = s.diagram(space);
    const flow = s.diagram(space, { stage: '03-user-flow', sourceKey: 'docs/03-user-flow/FL-001.md', kind: 'user_flow', name: 'FL-001', removed: true });
    // A second snapshot, which redraws the ERD.
    s.snapshot(space);
    file(space.snapshot, 'docs/02-prd/requirements.md', 'The same requirements, word for word.');
    file(space.snapshot, 'docs/02-prd/own.md', `Only ${name} has this document.`);
    const redrawn = s.drawing(space, erd.id);
    const element = db.prepare("INSERT INTO elements (drawing_id, element_key, kind, name) VALUES (?, ?, 'table', ?)");
    element.run(erd.drawing, 'TBL-146', 'agent_credentials');
    element.run(erd.drawing, 'TBL-147', 'project_spaces');
    const position = db.prepare('INSERT INTO element_positions (diagram_id, element_key, x, y, moved_at) VALUES (?, ?, 10, 20, ?)');
    position.run(erd.id, 'TBL-146', TIME);
    position.run(erd.id, 'TBL-147', TIME);
    position.run(flow.id, 'step:1', TIME);

    // Threads: one open on the owner with an answer and a reply, one closed: 4 comments.
    const question = s.thread(erd, { author: 'agent' });
    s.comment(question, { author: 'owner' });
    s.comment(question, { author: 'agent' });
    const closed = s.thread(flow);
    s.closeThread(closed);

    // Change sets: a proposal, a direct edit in a pull request, both open; a cancelled one.
    const pullRequest = s.pullRequest(space, { number: 7 });
    const proposal = s.changeSet(space, erd, { origin: 'proposal', threadId: question });
    db.prepare("INSERT INTO changes (change_set_id, seq, op, element_key, new_name) VALUES (?, 1, 'rename', 'TBL-146', 'credentials')").run(proposal);
    s.changeSet(space, erd, { pullRequestId: pullRequest });
    s.changeSet(space, erd, { state: 'cancelled' });

    // Confirmations: an invalidated one and a live one, neither recorded; a cancel of a recorded one to record; and a
    // recorded live one, which waits on nothing.
    const invalidated = s.confirm(space, erd);
    s.invalidate(invalidated, redrawn);
    s.confirm(space, erd);
    const cancelled = s.confirm(space, flow);
    s.record(cancelled);
    s.cancel(cancelled);
    s.record(s.confirm(space, flow));
    s.pass(space, '05-erd');

    // A workshop with a confirmed step, two notes, one removed, and a line between them.
    const workshop = s.workshop(space);
    s.confirmStep(workshop, '7');
    const note = db.prepare(
      `INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, created_at, removed_at)
       VALUES (?, '1', 'event', ?, 0, 0, 'owner', ?, ?)`,
    );
    const first = Number(note.run(workshop, 'Snapshot accepted', TIME, null).lastInsertRowid);
    const second = Number(note.run(workshop, 'Diagram drawn', TIME, TIME).lastInsertRowid);
    db.prepare("INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) VALUES (?, ?, ?, 'owner', ?)")
      .run(workshop, first, second, TIME);

    // The to-do entries those rows open, and a claim of one.
    sync(threadChanged, { thread: question });
    for (const where of [erd, flow]) {
      sync(changeSetsChanged, { diagram: where.id });
      sync(confirmationsChanged, { diagram: where.id });
    }
    sync(stepsChanged, { workshop });
    const entry = db.prepare("SELECT id FROM todos WHERE project_id = ? AND side = 'agent' ORDER BY id LIMIT 1").get(space.id);
    s.claim(space, Number(entry.id), { session: 'claude-code-4f2a91' });
    s.toolLink(space);
    s.toolLink(space, { removed: true });

    return {
      space,
      preview: {
        project: name,
        revision: 2,
        commit: space.commit,
        deletes: {
          snapshots: 2, diagrams: 2, drawings: 3, threads: 2, comments: 4, change_sets: 3, confirmations: 4, positions: 3,
          workshops: 1, notes: 2, tool_links: 2,
        },
        open: { threads: 1, change_sets: 2, confirmations_to_record: 3 },
      },
    };
  }

  test('every table of the store is a project\'s or shared', () => {
    assert.deepEqual([...Object.keys(OF_PROJECT), ...SHARED].sort(), tables());
  });

  test('shows what deleting removes, with counts, every row included, and what is still open (SPEC-013)', async () => {
    const charlie = fill('charlie');
    const answer = await preview('charlie');
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, charlie.preview);
    // A space with no snapshot yet: no revision or commit, and nothing in it.
    db.prepare("INSERT INTO project_spaces (name, created_at, created_by_credential) VALUES ('empty', ?, ?)").run(TIME, s.agent.key);
    const empty = await preview('empty');
    assert.deepEqual(empty.json, {
      project: 'empty',
      revision: null,
      commit: null,
      deletes: {
        snapshots: 0, diagrams: 0, drawings: 0, threads: 0, comments: 0, change_sets: 0, confirmations: 0, positions: 0,
        workshops: 0, notes: 0, tool_links: 0,
      },
      open: { threads: 0, change_sets: 0, confirmations_to_record: 0 },
    });
  });

  test('deleting removes that project\'s rows, and the blobs only it named, and nothing else (SPEC-013)', async () => {
    const alpha = fill('alpha');
    const bravo = fill('bravo');
    // Rows of no project: a backup with its rehearsal.
    const backup = Number(db.prepare(
      "INSERT INTO backups (name, attempt, state, bytes, started_at, finished_at) VALUES ('nexus-2026-11-23.sqlite', 1, 'succeeded', 1024, ?, ?)",
    ).run(TIME, TIME).lastInsertRowid);
    db.prepare("INSERT INTO restore_rehearsals (release, backup_id, result, rehearsed_at) VALUES ('v3.0.0', ?, 'succeeded', ?)").run(backup, TIME);

    const ofAlpha = rowsOf(alpha.space);
    const ofBravo = rowsOf(bravo.space);
    for (const [table, n] of Object.entries(ofAlpha)) assert.ok(n > 0, `alpha has a row in ${table}`);
    const was = dump();
    const shared = sha256('The same requirements, word for word.');
    const alphaOnly = [sha256(`Only alpha has this document.`), sha256(JSON.stringify({ project: { name: 'alpha' }, pictures: [] }))];
    for (const blob of [shared, ...alphaOnly]) assert.ok(db.prepare('SELECT 1 FROM document_blobs WHERE sha256 = ?').get(blob));

    const answer = await remove('alpha');
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, { project: 'alpha', removed: true, deleted: alpha.preview.deletes });

    const now = dump();
    // Every table of a project lost exactly alpha's rows, kept bravo's, and changed no row it kept.
    assert.deepEqual(rowsOf(alpha.space), Object.fromEntries(Object.keys(OF_PROJECT).map((table) => [table, 0])));
    assert.deepEqual(rowsOf(bravo.space), ofBravo);
    for (const table of Object.keys(OF_PROJECT)) {
      assert.equal(now[table].length, was[table].length - ofAlpha[table], table);
      const kept = new Set(was[table]);
      for (const row of now[table]) assert.ok(kept.has(row), `${table} changed a row it kept`);
    }
    // Of the blobs, only those no remaining snapshot names went: alpha's own two; the one bravo names too stayed.
    assert.equal(now.document_blobs.length, was.document_blobs.length - 2);
    for (const row of now.document_blobs) assert.ok(was.document_blobs.includes(row));
    for (const blob of alphaOnly) assert.equal(db.prepare('SELECT 1 FROM document_blobs WHERE sha256 = ?').get(blob), undefined);
    assert.ok(db.prepare('SELECT 1 FROM document_blobs WHERE sha256 = ?').get(shared));
    // The credentials, the backups and the rehearsals stay as they were; the request keys gain this deletion's.
    for (const table of ['agent_credentials', 'backups', 'restore_rehearsals']) assert.deepEqual(now[table], was[table], table);
    assert.equal(now.request_keys.length, was.request_keys.length + 1);
    for (const row of was.request_keys) assert.ok(now.request_keys.includes(row));
    // The store's keys still hold.
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    // The project is gone for every reader.
    const gone = await server.send({ path: '/api/projects/alpha', headers: owner() });
    assert.deepEqual([gone.status, gone.json.code], [404, 'project_not_found']);
  });

  test('given a space with 3 diagrams and 5 comments, its deletion removes its 5 comments (SPEC-013)', async () => {
    const space = s.project('delta');
    const diagrams = [s.diagram(space), s.diagram(space, { stage: '06-api', sourceKey: '/pictures/06-api', kind: 'erd', name: 'API' }),
      s.diagram(space, { stage: '02-prd', sourceKey: '/items/02-prd', kind: 'item_table', name: '02-prd' })];
    const thread = s.thread(diagrams[0]);
    for (let i = 0; i < 2; i += 1) s.comment(thread);
    s.comment(s.thread(diagrams[1]), { author: 'owner' });
    const counted = (await preview('delta')).json.deletes;
    assert.deepEqual([counted.diagrams, counted.comments], [3, 5]);
    // The project list (API-262) has it before the deletion and not after.
    const listed = async () => {
      const answer = await server.send({ path: '/api/projects', headers: owner() });
      assert.equal(answer.status, 200);
      return answer.json.projects.map((project) => project.name);
    };
    assert.ok((await listed()).includes('delta'));
    assert.equal((await remove('delta')).status, 200);
    assert.equal((await listed()).includes('delta'), false);
    assert.equal(db.prepare("SELECT count(*) AS n FROM project_spaces WHERE name = 'delta'").get().n, 0);
    assert.equal(db.prepare('SELECT count(*) AS n FROM comment_threads WHERE diagram_id IN (?, ?, ?)').get(...diagrams.map((d) => d.id)).n, 0);
  });

  test('removes nothing when the name sent is not the project\'s, or is missing, and names the field only', async () => {
    const space = s.project('echo');
    s.thread(s.diagram(space));
    const was = dump();
    for (const [body, field] of [
      [JSON.stringify({ name: 'echo-other' }), 'name'],
      [JSON.stringify({ name: 'ECHO' }), 'name'],
      [JSON.stringify({ name: ' echo' }), 'name'],
      [JSON.stringify({}), 'name'],
      [JSON.stringify({ name: 5 }), 'name'],
      [JSON.stringify({ name: 'echo', also: true }), 'body'],
      ['{"name":', 'body'],
    ]) {
      const answer = await remove('echo', { body });
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', field], body);
      assert.equal(answer.json.detail.includes('echo-other'), false);
    }
    assert.deepEqual(dump(), was);
  });

  test('a space already gone is project_not_found, and a repeat of the deletion answers what it answered', async () => {
    s.project('foxtrot');
    const requestKey = key();
    const first = await remove('foxtrot', { headers: requestKey });
    assert.equal(first.status, 200);
    const was = dump();
    // The same request key gives the first answer again and removes nothing more (rule 3).
    const repeat = await remove('foxtrot', { headers: requestKey });
    assert.deepEqual([repeat.status, repeat.json], [200, first.json]);
    // Another request key finds no space; so does a name that cannot be a project's.
    for (const name of ['foxtrot', 'no-such-project', 'Upper', 'a--b']) {
      const answer = await remove(name);
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], name);
      assert.equal(answer.json.detail.includes(name), false);
      const shown = await preview(name);
      assert.deepEqual([shown.status, shown.json.code], [404, 'project_not_found'], name);
    }
    // A space already gone is project_not_found whatever the body's fields are, since it is found before they are read
    // (API-278). A body that is not a JSON object is the request layer's, refused before any operation, as 413 and 415.
    for (const body of ['{}', '{"name":5}', '{"name":"foxtrot","more":1}', '{"name":"other"}']) {
      const answer = await remove('foxtrot', { body });
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], body);
    }
    assert.deepEqual(dump(), was);
    // The same request key for another action is refused.
    s.project('golf');
    const reused = await remove('golf', { headers: requestKey });
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    assert.equal(db.prepare("SELECT count(*) AS n FROM project_spaces WHERE name = 'golf'").get().n, 1);
  });

  test('refuses a body that is not JSON or too large, and removes nothing', async () => {
    s.project('hotel');
    const was = dump();
    const wrongType = await remove('hotel', { headers: { 'Content-Type': 'text/plain' } });
    assert.deepEqual([wrongType.status, wrongType.json.code], [415, 'json_required']);
    const { answers } = await exchange(server.port, [head('POST', '/api/projects/hotel/removal', {
      ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 2 * MiB + 1,
    })]);
    assert.equal(answers.length, 1);
    responses.note('deleteProject', answers[0]);
    assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    assert.deepEqual(dump(), was);
  });

  test('refuses a request without the owner\'s sign-in, of another person, with an agent credential or from another site', async () => {
    s.project('india');
    const was = dump();
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const [headers, status, code] of [[{}, 401, 'unauthenticated'], [someone, 403, 'not_owner'], [s.agent.headers, 403, 'owner_only']]) {
      const shown = await preview('india', headers);
      assert.deepEqual([shown.status, shown.json.code], [status, code]);
      const sent = { ...JSON_TYPE, ...key(), ...headers };
      const removed = responses.note('deleteProject', await server.send({
        method: 'POST', path: '/api/projects/india/removal', headers: sent, body: JSON.stringify({ name: 'india' }),
      }));
      assert.deepEqual([removed.status, removed.json.code], [status, code]);
    }
    for (const site of ['cross-site', 'same-site']) {
      const removed = await remove('india', { headers: { 'Sec-Fetch-Site': site } });
      assert.deepEqual([removed.status, removed.json.code], [403, 'cross_site']);
    }
    assert.deepEqual(dump(), was);
  });

  test('a preview writes nothing', async () => {
    fill('juliet');
    const was = dump();
    assert.equal((await preview('juliet')).status, 200);
    assert.deepEqual(dump(), was);
  });

  test('answers internal when the store fails, and a deletion that fails part way removes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const space = failing.project('broken');
    failing.thread(failing.diagram(space));
    // A store whose blobs cannot be dropped, as when the disk fails after the space's row was deleted.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            const statement = target.prepare(sql);
            if (!sql.includes('DELETE FROM document_blobs')) return statement;
            return new Proxy(statement, {
              get(inner, field) {
                if (field === 'run') return () => { throw new Error('the store failed'); };
                const own = Reflect.get(inner, field, inner);
                return typeof own === 'function' ? own.bind(inner) : own;
              },
            });
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const rows = () => JSON.stringify(['project_spaces', 'snapshots', 'diagrams', 'comment_threads', 'comments', 'document_blobs']
      .map((table) => store.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()));
    const was = rows();
    const removed = responses.note('deleteProject', await other.send({
      method: 'POST', path: '/api/projects/broken/removal', headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{"name":"broken"}',
    }));
    assert.deepEqual([removed.status, removed.json.code], [500, 'internal']);
    assert.equal(rows(), was);
    // A store whose counts cannot be read.
    const unreadable = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('FROM tool_links')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const third = await startServer({ store: unreadable, gate: local.gate, routes: ROUTES });
    t.after(() => third.close());
    const shown = responses.note('getRemovalPreview', await third.send({ path: '/api/projects/broken/removal', headers: owner() }));
    assert.deepEqual([shown.status, shown.json.code], [500, 'internal']);
    for (const server of [other, third]) assert.equal(server.logText().includes('the store failed'), false);
  });

  test('logs one line per request with its sender, and never the project\'s name or the data folder (rule 5)', async () => {
    const name = `kilo-${randomBytes(6).toString('hex')}`;
    s.project(name);
    assert.equal((await preview(name)).status, 200);
    assert.equal((await remove(name)).status, 200);
    const lines = (await server.logged(2)).filter((line) => ['getRemovalPreview', 'deleteProject'].includes(line.action));
    assert.ok(lines.length >= 2);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['owner', 'unknown', s.agent.name].includes(line.sender), line.sender);
    }
    const text = server.logText();
    for (const value of [name, 'word for word', 'Only alpha', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answers every response API-277 and API-278 list', () => {
    responses.assertEvery('getRemovalPreview');
    responses.assertEvery('deleteProject');
  });

  test('touches the tables their x-corthex.tables list, changes only tables SPEC-013 feeds, and admission only the layer\'s (notes 18 and 23)', () => {
    checkTables(recorder, 'getRemovalPreview');
    checkTables(recorder, 'deleteProject');
    checkLayer(recorder);
  });
});
