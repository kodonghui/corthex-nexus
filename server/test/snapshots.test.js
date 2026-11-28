// Snapshot intake (TASK-418; SPEC-001, SPEC-002, SPEC-014, REQ-077, rule 5): the hub's push (API-242) and the held
// commit (API-243), with corthex-hub/0.2 and 0.3 snapshots of this repository that test/snapshots.js builds when the
// tests run. Secret-looking and email-looking values are made at run time from parts; no test holds one as a literal.
// The push draws with the test drawers of test/drawers.js, so its answers count diagrams; test/drawing.test.js tests
// the drawing (TASK-419).

import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { idOf } from '../src/ids.js';
import { ROUTES } from '../src/routes.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { contract, validate } from './contract.js';
import { testDrawers } from './drawers.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { FORMAT_02, FORMAT_03, newCommit, REPOSITORY, repositorySnapshot } from './snapshots.js';
import { assertNoneIn, exchange, forbiddenValues, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-23T01:00:00.000Z');
const MiB = 1024 * 1024;
const JSON_TYPE = { 'Content-Type': 'application/json' };
const FORMATS = [FORMAT_02, FORMAT_03];
const SNAPSHOT_SCHEMA = { $ref: '#/components/schemas/Snapshot' };
const KEYED = new Set(['03-user-flow', '08-screen-states', '09-mockup']);
const STAGES = ['01-domain', '02-prd', '03-user-flow', '04-functional-spec', '05-erd', '06-api', '07-sitemap',
  '08-screen-states', '09-mockup', '10-wbs', '11-development', '12-qa', '13-presentation'];

const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
const at = (ms) => new Date(ms).toISOString();

// Values that look like a secret or an email address, made at run time from parts, so that no literal in the
// repository reads as one.
function secretValues() {
  const word = (size) => randomBytes(size).toString('hex');
  return {
    openAi: ['s', 'k', '-', word(16)].join(''),
    gitHub: ['gh', 'p_', word(18)].join(''),
    slack: ['xo', 'xb', '-', word(8)].join(''),
    aws: ['AK', 'IA', word(8).toUpperCase()].join(''),
    privateKey: ['-'.repeat(5), 'BEGIN', ' RSA ', 'PRIVATE', ' KEY', '-'.repeat(5)].join(''),
  };
}
function emailValue() {
  return [`reader${randomBytes(4).toString('hex')}`, '@', 'mail', '.', 'test'].join('');
}

// A store in a data folder of its own, for a suite: { db, remove() }.
function suiteStore() {
  const folder = mkdtempSync(join(tmpdir(), 'nexus-snapshots-'));
  const { db } = openStore(folder);
  return {
    db,
    remove() {
      db.close();
      rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
    },
  };
}

// An agent credential in the store, made as API-280 makes one: { headers, key, name }.
function agentCredential(db, name) {
  const secret = randomBytes(32).toString('base64url');
  const { lastInsertRowid } = db.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)')
    .run(name, sha256(secret), at(START));
  const key = Number(lastInsertRowid);
  return { headers: { 'CF-Access-Client-Id': idOf('ac', key), 'CF-Access-Client-Secret': secret }, key, name };
}

// The documents NEXUS keeps of a snapshot, by their names (see src/snapshot.js), as { stage, text }.
function documentsOf(snapshot) {
  const documents = new Map();
  for (const picture of snapshot.pictures) {
    if (KEYED.has(picture.stage)) {
      documents.set(picture.key, { stage: picture.stage, text: picture.source.text });
    } else {
      const name = picture.part === '' ? `/pictures/${picture.stage}` : `/pictures/${picture.stage}/${picture.part}`;
      documents.set(name, { stage: picture.stage, text: JSON.stringify(picture.source) });
    }
  }
  for (const stage of STAGES) {
    const items = snapshot.items.filter((item) => item.stage === stage);
    // A stage the hub read keeps its items, an empty list when it has none.
    if (items.length > 0 || snapshot.stages[stage]?.read === true) documents.set(`/items/${stage}`, { stage, text: JSON.stringify(items) });
  }
  // A picture file keeps the other members of its source in the rest, which a test below checks on its own.
  const pictures = snapshot.pictures.map(({ source: { text, ...others }, ...picture }) => (
    KEYED.has(picture.stage) && Object.keys(others).length > 0 ? { ...picture, source: others } : picture));
  const rest = { ...snapshot, items: [], pictures };
  documents.set('/snapshot', { stage: '', text: JSON.stringify(rest) });
  return documents;
}

// The diagrams this repository's snapshot draws, with the test drawers (see src/drawing.js): in corthex-hub/0.2 the
// pictures of stages 01, 05 and 07, the item tables of stages 02, 03, 04, 06 and 10, and the empty item tables of
// stages 08, 09, 12 and 13, which the hub read and which have no items; in 0.3 the same pictures, the 19 picture files
// of stages 03, 08 and 09, and the item tables of stages 02, 04, 06, 10, 12 and 13.
const DIAGRAMS_02 = 12;
const DIAGRAMS_03 = 28;

// The answer of a push as the contract's PushAnswer, with the counts of what it drew: diagrams, laid over none.
function pushAnswer({ project, revision, commit, replaced = null, created = false, sameCommit = false, refused = [], diagrams = {} }) {
  return {
    project,
    revision,
    commit,
    replaced,
    created,
    same_commit: sameCommit,
    diagrams: { drawn: 0, unchanged: 0, failed: 0, removed: 0, ...diagrams },
    failures: [],
    refused,
    confirmations_invalidated: 0,
    change_sets_reflected: 0,
    threads_moved: 0,
  };
}

describe('snapshot intake', () => {
  const responses = responseRecord();
  let opened;
  let recorder;
  let local;
  let server;
  let agent;
  const clock = { now: START };
  // Every answer the tests got, so that they can be searched for what rule 5 keeps out.
  const answers = [];

  before(async () => {
    opened = suiteStore();
    recorder = recordTables(opened.db);
    local = localGate();
    server = await startServer({
      store: recorder.store, gate: local.gate, now: () => clock.now, routes: snapshotRoutes({ drawers: testDrawers() }),
    });
    agent = agentCredential(opened.db, 'push-job');
  });

  after(async () => {
    await server.close();
    opened.remove();
  });

  async function sent(request, action) {
    const answer = await server.send(request);
    answers.push(answer.text);
    if (action !== undefined) responses.note(action, answer);
    return answer;
  }

  // Sends a snapshot, as a value or as the text of a body.
  const push = (snapshot, headers = agent.headers) => sent({
    method: 'POST',
    path: '/api/snapshots',
    headers: { ...JSON_TYPE, ...headers },
    body: typeof snapshot === 'string' ? snapshot : JSON.stringify(snapshot),
  }, 'pushSnapshot');
  const held = (project, headers = agent.headers) => sent({ path: `/api/snapshots/${project}/held`, headers }, 'getHeldCommit');

  const db = () => opened.db;
  const project = (name) => db().prepare('SELECT * FROM project_spaces WHERE name = ?').get(name);
  const snapshots = (name) => db().prepare(
    'SELECT s.* FROM snapshots s JOIN project_spaces p ON p.id = s.project_id WHERE p.name = ? ORDER BY s.revision',
  ).all(name).map((row) => ({ ...row }));
  // The documents a snapshot of the project keeps, by name: { stage, text }.
  const kept = (name, revision) => new Map(db().prepare(
    `SELECT f.path, f.stage, b.body, b.bytes, b.sha256 FROM snapshot_files f JOIN document_blobs b ON b.sha256 = f.blob_sha256
     JOIN snapshots s ON s.id = f.snapshot_id JOIN project_spaces p ON p.id = s.project_id WHERE p.name = ? AND s.revision = ?`,
  ).all(name, revision).map((row) => {
    assert.equal(row.sha256, sha256(row.body));
    assert.equal(row.bytes, Buffer.byteLength(row.body));
    return [row.path, { stage: row.stage, text: row.body }];
  }));
  const counts = () => Object.fromEntries(['project_spaces', 'snapshots', 'snapshot_files', 'document_blobs']
    .map((table) => [table, Number(db().prepare(`SELECT count(*) AS n FROM ${table}`).get().n)]));

  const heldAnswer = (name, commit, revision, format) => ({
    project: name, default_commit: commit, revision, formats: FORMATS, format,
  });

  test('the first send creates the space and keeps the snapshot, its documents and the held commit with its format', async () => {
    const name = 'first-send';
    clock.now = START + 60_000;
    const snapshot = repositorySnapshot(FORMAT_02, { name });
    const { commit } = snapshot.repos['.'].default;
    const body = JSON.stringify(snapshot);
    assert.equal((await held(name)).json.code, 'project_not_found');
    const answer = await push(body);
    assert.equal(answer.status, 201);
    assert.deepEqual(answer.json, pushAnswer({ project: name, revision: 1, commit, created: true, diagrams: { drawn: DIAGRAMS_02 } }));

    const space = project(name);
    assert.deepEqual([space.repository, space.held_commit, space.created_at, space.created_by_credential],
      [REPOSITORY, commit, at(clock.now), agent.key]);
    const [row] = snapshots(name);
    assert.deepEqual([row.revision, row.commit_sha, row.replaced_commit, row.format_version, row.bytes, row.received_at, row.credential_id],
      [1, commit, null, FORMAT_02, Buffer.byteLength(body), at(clock.now), agent.key]);
    // Each picture source and each stage's items as a document, and the rest of the snapshot as it came.
    const expected = documentsOf(snapshot);
    assert.deepEqual(kept(name, 1), expected);
    assert.deepEqual([...expected.keys()].filter((path) => path.startsWith('/pictures/')),
      ['/pictures/01-domain/nexus', '/pictures/05-erd/nexus', '/pictures/07-sitemap/nexus']);
    assert.ok(expected.get('/items/02-prd').text.includes('"REQ-077"'));
    const rest = JSON.parse(expected.get('/snapshot').text);
    assert.deepEqual([rest.project.title, rest.project.parts, rest.items], ['NEXUS', ['nexus'], []]);
    assert.equal(rest.pictures.some((picture) => 'source' in picture), false);

    const answerHeld = await held(name);
    assert.equal(answerHeld.status, 200);
    assert.deepEqual(answerHeld.json, heldAnswer(name, commit, 1, FORMAT_02));
  });

  test('a first send in corthex-hub/0.3 keeps each picture file by its key with its whole text', async () => {
    const name = 'first-send-03';
    const snapshot = repositorySnapshot(FORMAT_03, { name });
    const { commit } = snapshot.repos['.'].default;
    const answer = await push(snapshot);
    assert.deepEqual([answer.status, answer.json], [201, pushAnswer({ project: name, revision: 1, commit, created: true, diagrams: { drawn: DIAGRAMS_03 } })]);
    const documents = kept(name, 1);
    assert.deepEqual(documents, documentsOf(snapshot));
    const files = [...documents.keys()].filter((path) => !path.startsWith('/'));
    // This repository's 13 flows, 5 screens and its mockup page, and no translation copy.
    assert.equal(files.filter((path) => path.startsWith('docs/03-user-flow/FL-')).length, 13);
    assert.equal(files.filter((path) => path.startsWith('docs/08-screens/SCR-')).length, 5);
    assert.ok(files.includes('docs/09-mockup/nexus-combination.html'));
    assert.equal(files.length, 19);
    assert.equal(files.some((path) => path.includes('.ko.')), false);
    assert.equal(documents.get('docs/03-user-flow/FL-001-put-a-project-on-nexus.md').stage, '03-user-flow');
    assert.equal(documents.get('docs/09-mockup/nexus-combination.html').text, readFileSync(new URL('../../docs/09-mockup/nexus-combination.html', import.meta.url), 'utf8'));
    assert.deepEqual((await held(name)).json, heldAnswer(name, commit, 1, FORMAT_03));
  });

  test('a picture file\'s source keeps its members other than text, in the rest of the snapshot', async () => {
    const name = 'file-members';
    const snapshot = repositorySnapshot(FORMAT_03, { name });
    const file = snapshot.pictures.find((picture) => picture.stage === '08-screen-states');
    Object.assign(file.source, { truncated: false, lines: { counted: 12 } });
    assert.equal((await push(snapshot)).status, 201);
    const documents = kept(name, 1);
    assert.equal(documents.get(file.key).text, file.source.text);
    const rest = JSON.parse(documents.get('/snapshot').text);
    const sources = rest.pictures.filter((picture) => 'source' in picture);
    const { source, ...fields } = file;
    assert.deepEqual(sources, [{ ...fields, source: { truncated: false, lines: { counted: 12 } } }]);
  });

  describe('one project, commit by commit', () => {
    const name = 'commits';
    const [a, b, c, d] = [newCommit(), newCommit(), newCommit(), newCommit()];

    test('a send that replaces the held commit becomes the next revision and the held commit', async () => {
      assert.equal((await push(repositorySnapshot(FORMAT_02, { name, commit: a }))).status, 201);
      clock.now = START + 120_000;
      const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: b, replaces: a }));
      // The same documents: every diagram is unchanged.
      assert.deepEqual([answer.status, answer.json],
        [200, pushAnswer({ project: name, revision: 2, commit: b, replaced: a, diagrams: { unchanged: DIAGRAMS_02 } })]);
      const rows = snapshots(name);
      assert.deepEqual(rows.map((row) => [row.revision, row.commit_sha, row.replaced_commit]), [[1, a, null], [2, b, a]]);
      assert.equal(project(name).held_commit, b);
      // The documents that did not change are kept once: both snapshots name the same texts.
      assert.deepEqual([...kept(name, 2).keys()].sort(), [...kept(name, 1).keys()].sort());
      assert.deepEqual((await held(name)).json, heldAnswer(name, b, 2, FORMAT_02));
    });

    test('an older snapshot is refused, naming its revision, and changes nothing', async () => {
      const before = counts();
      for (const replaces of [undefined, b]) {
        const answer = await push(repositorySnapshot(FORMAT_03, { name, commit: a, replaces }));
        assert.deepEqual([answer.status, answer.json.code, answer.json.revision], [409, 'older_snapshot', 1]);
      }
      assert.deepEqual(counts(), before);
      assert.deepEqual((await held(name)).json, heldAnswer(name, b, 2, FORMAT_02));
    });

    test('a commit that does not name the held one in replaces is refused, naming it, and changes nothing', async () => {
      const before = counts();
      for (const replaces of [undefined, a, c]) {
        const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: c, replaces }));
        assert.deepEqual([answer.status, answer.json.code, answer.json.held_commit], [409, 'commit_not_replaced', b]);
      }
      assert.deepEqual(counts(), before);
    });

    test('the same commit again is the same revision and keeps nothing again', async () => {
      const before = counts();
      for (const replaces of [undefined, a]) {
        const answer = await push(repositorySnapshot(FORMAT_02, { name, commit: b, replaces }));
        assert.deepEqual([answer.status, answer.json],
          [200, pushAnswer({ project: name, revision: 2, commit: b, sameCommit: true, diagrams: { unchanged: DIAGRAMS_02 } })]);
      }
      assert.deepEqual(counts(), before);
    });

    test('the same commit in a newer format completes its revision with the pictures the older one did not carry', async () => {
      const before = kept(name, 2);
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a });
      const answer = await push(snapshot);
      // It draws the 19 files of stages 03, 08 and 09, and the item tables of those stages make way for them (SPEC-005).
      assert.deepEqual([answer.status, answer.json], [200, pushAnswer({
        project: name, revision: 2, commit: b, sameCommit: true, diagrams: { drawn: 19, unchanged: DIAGRAMS_02 - 3, removed: 3 },
      })]);
      const after = kept(name, 2);
      const added = [...after.keys()].filter((path) => !before.has(path)).sort();
      // The files of stages 03, 08 and 09, which corthex-hub/0.2 does not carry; the documents 0.2 carried stay as
      // kept.
      const expected = documentsOf(snapshot);
      assert.deepEqual(added, [...expected.keys()].filter((path) => !path.startsWith('/')).sort());
      for (const path of added) assert.deepEqual(after.get(path), expected.get(path));
      for (const [path, document] of before) assert.deepEqual(after.get(path), document);
      assert.equal(snapshots(name).length, 2);
      assert.deepEqual((await held(name)).json, heldAnswer(name, b, 2, FORMAT_03));
    });

    test('the same commit again in the same or an older format keeps nothing, and the held format stays the newer', async () => {
      const before = counts();
      for (const format of [FORMAT_03, FORMAT_02]) {
        const answer = await push(repositorySnapshot(format, { name, commit: b }));
        assert.deepEqual([answer.status, answer.json],
          [200, pushAnswer({ project: name, revision: 2, commit: b, sameCommit: true, diagrams: { unchanged: DIAGRAMS_03 } })]);
      }
      assert.deepEqual(counts(), before);
      assert.deepEqual((await held(name)).json, heldAnswer(name, b, 2, FORMAT_03));
    });

    test('the next commit in corthex-hub/0.3 keeps every document, and a 0.2 one after it is held as 0.2', async () => {
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit: c, replaces: b });
      assert.deepEqual((await push(snapshot)).json,
        pushAnswer({ project: name, revision: 3, commit: c, replaced: b, diagrams: { unchanged: DIAGRAMS_03 } }));
      assert.deepEqual(kept(name, 3), documentsOf(snapshot));
      const next = repositorySnapshot(FORMAT_02, { name, commit: d, replaces: c });
      // 0.2 does not carry the pictures of stages 03, 08 and 09, which stay as last drawn (SPEC-005).
      assert.deepEqual((await push(next)).json,
        pushAnswer({ project: name, revision: 4, commit: d, replaced: c, diagrams: { unchanged: DIAGRAMS_03 } }));
      assert.deepEqual(kept(name, 4), documentsOf(next));
      assert.deepEqual((await held(name)).json, heldAnswer(name, d, 4, FORMAT_02));
    });

    test('a snapshot of another repository is refused and changes nothing', async () => {
      const before = counts();
      const snapshot = repositorySnapshot(FORMAT_02, { name, commit: newCommit(), replaces: d });
      snapshot.repos['.'].url = `${REPOSITORY}-fork`;
      assert.equal((await push(snapshot)).json.code, 'repository_mismatch');
      delete snapshot.repos['.'].url;
      const answer = await push(snapshot);
      assert.deepEqual([answer.status, answer.json.code], [409, 'repository_mismatch']);
      assert.deepEqual(counts(), before);
    });
  });

  test('two first sends of one project at once create one space; the second is the same commit', async () => {
    const name = 'at-once';
    const snapshot = repositorySnapshot(FORMAT_02, { name });
    const both = await Promise.all([push(snapshot), push(snapshot)]);
    assert.deepEqual(both.map((answer) => answer.status).sort(), [200, 201]);
    assert.deepEqual(both.map((answer) => [answer.json.created, answer.json.same_commit, answer.json.revision]).sort(),
      [[false, true, 1], [true, false, 1]]);
    assert.equal(snapshots(name).length, 1);
  });

  describe('a secret and an email address left out (REQ-077)', () => {
    const secrets = secretValues();
    const email = emailValue();
    const marker = `left out text ${randomBytes(8).toString('hex')}`;
    // Every value that must stay out of the store, the answers and the log.
    const values = { ...secrets, email, marker };
    const where = [];

    test('of a corthex-hub/0.2 snapshot: a picture source and a stage\'s items', async () => {
      const name = 'leaks-02';
      const snapshot = repositorySnapshot(FORMAT_02, { name });
      const erd = snapshot.pictures.find((picture) => picture.stage === '05-erd');
      erd.source.tables[3].name = `${marker} ${secrets.privateKey}`;
      snapshot.items.find((item) => item.stage === '02-prd').title = `${marker} ${email}`;
      const answer = await push(snapshot);
      assert.equal(answer.status, 201);
      assert.deepEqual(answer.json.refused, [
        { part: 'nexus', stage: '05-erd', where: 'db/nexus.sql', why: 'secret' },
        { part: '', stage: '02-prd', where: 'docs/02-prd/requirements.md', why: 'email' },
      ]);
      const expected = documentsOf(snapshot);
      expected.delete('/pictures/05-erd/nexus');
      expected.delete('/items/02-prd');
      assert.deepEqual(kept(name, 1), expected);
      where.push('db/nexus.sql', 'docs/02-prd/requirements.md');
    });

    test('of a corthex-hub/0.3 snapshot: picture files, each named by its key', async () => {
      const name = 'leaks-03';
      const snapshot = repositorySnapshot(FORMAT_03, { name });
      const files = snapshot.pictures.filter((picture) => KEYED.has(picture.stage));
      const leaks = [
        [files.find((picture) => picture.stage === '03-user-flow'), secrets.openAi, 'secret'],
        [files.find((picture) => picture.stage === '08-screen-states'), email, 'email'],
        [files.find((picture) => picture.stage === '09-mockup'), secrets.gitHub, 'secret'],
        [files.filter((picture) => picture.stage === '03-user-flow')[1], secrets.slack, 'secret'],
        [files.filter((picture) => picture.stage === '03-user-flow')[2], secrets.aws, 'secret'],
      ];
      for (const [picture, value] of leaks) picture.source.text += `\n${marker}\n${value}\n`;
      const answer = await push(snapshot);
      assert.equal(answer.status, 201);
      // In the order of the snapshot's pictures.
      const why = new Map(leaks.map(([picture, , kind]) => [picture, kind]));
      assert.deepEqual(answer.json.refused, snapshot.pictures.filter((picture) => why.has(picture))
        .map((picture) => ({ part: picture.part, stage: picture.stage, where: picture.key, why: why.get(picture) })));
      const documents = kept(name, 1);
      for (const [picture] of leaks) assert.equal(documents.has(picture.key), false);
      assert.equal(documents.size, documentsOf(snapshot).size - leaks.length);
      where.push(...leaks.map(([picture]) => picture.key));
    });

    test('of the files a newer format adds when it completes a revision', async () => {
      const name = 'leaks-completed';
      const commit = newCommit();
      assert.equal((await push(repositorySnapshot(FORMAT_02, { name, commit }))).status, 201);
      const snapshot = repositorySnapshot(FORMAT_03, { name, commit });
      const mockup = snapshot.pictures.find((picture) => picture.stage === '09-mockup');
      mockup.source.text += `<!-- ${marker} ${email} -->`;
      const answer = await push(snapshot);
      assert.deepEqual(answer.json.refused, [{ part: 'nexus', stage: '09-mockup', where: mockup.key, why: 'email' }]);
      assert.equal(kept(name, 1).has(mockup.key), false);
      assert.deepEqual((await held(name)).json.format, FORMAT_03);
    });

    test('a snapshot whose other fields hold such text is refused whole, naming the field', async () => {
      const before = counts();
      const cases = [
        ['checks', (snapshot) => snapshot.checks.push({ rule: 'review', level: 'info', message: `${marker} ${email}` })],
        ['project', (snapshot) => { snapshot.project.title = secrets.aws; }],
        ['stages', (snapshot) => { snapshot.stages['02-prd'].parts.nexus.next = `${marker} ${secrets.openAi}`; }],
        ['pictures', (snapshot) => { snapshot.pictures[0].time = email; }],
        ['items', (snapshot) => snapshot.items.push({ id: 'X-1', title: email })],
        ['body', (snapshot) => { snapshot.extra = { note: secrets.gitHub }; }],
        ['body', (snapshot) => { snapshot[email] = true; }],
        ['pictures', (snapshot) => {
          snapshot.pictures.find((picture) => KEYED.has(picture.stage)).source.note = `${marker} ${secrets.slack}`;
        }, FORMAT_03],
      ];
      for (const [field, change, format = FORMAT_02] of cases) {
        const snapshot = repositorySnapshot(format, { name: 'leaks-whole' });
        change(snapshot);
        const answer = await push(snapshot);
        assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_snapshot', field], field);
      }
      assert.deepEqual(counts(), before);
    });

    test('no table, answer or log line holds the text left out or what was found in it, and no log line where it is (rule 5)', () => {
      const tables = db().prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all().map((row) => row.name);
      const stored = tables.map((table) => JSON.stringify(db().prepare(`SELECT * FROM "${table}"`).all())).join('\n');
      assertNoneIn(stored, values);
      assertNoneIn(answers.join('\n'), values);
      const forbidden = { ...values, ...forbiddenValues([]) };
      where.forEach((path, index) => { forbidden[`where${index}`] = path; });
      assertNoneIn(server.logText(), forbidden);
    });
  });

  test('an unknown format gets unsupported_format, naming the formats NEXUS takes', async () => {
    const before = counts();
    for (const format of ['corthex-hub/0.1', 'corthex-hub/0.4', 'corthex-hub/1.0', 'corthex-nexus/0.3', '']) {
      const snapshot = repositorySnapshot(FORMAT_03, { name: 'unknown-format' });
      snapshot.schema = format;
      const answer = await push(snapshot);
      assert.deepEqual([answer.status, answer.json.code, answer.json.versions], [400, 'unsupported_format', FORMATS], format);
      assert.equal(answer.json.detail, 'NEXUS takes the snapshot formats corthex-hub/0.2 and corthex-hub/0.3');
    }
    assert.deepEqual(counts(), before);
  });

  describe('the schema\'s rules for each format', () => {
    // A change to a snapshot, the field its refusal names, and whose rule it is: the contract's Snapshot schema's,
    // which the contract's validator also refuses, or NEXUS's own, which the schema leaves open.
    const tiny = (commit) => ({ part: '', stage: '01-domain', commit, source: {} });
    const keyed = (snapshot) => snapshot.pictures.findIndex((picture) => KEYED.has(picture.stage));
    const SCHEMA_RULES = [
      ['schema', (s) => { delete s.schema; }],
      ['schema', (s) => { s.schema = 3; }],
      ...['generator', 'generated_at', 'project', 'repos', 'stages', 'items', 'checks', 'pictures']
        .map((name) => [name, (s) => { delete s[name]; }]),
      ['generator', (s) => { s.generator = 'corthex-nexus'; }],
      ['generator', (s) => { s.generator = 5; }],
      ['generator', (s) => { s.generator = `corthex-nexus 1.0.${'0'.repeat(30)}`; }],
      ['generated_at', (s) => { s.generated_at = 1; }],
      ['generated_at', (s) => { s.generated_at = 'x'.repeat(41); }],
      ['project', (s) => { s.project = []; }],
      ['project.name', (s) => { delete s.project.name; }],
      ...['Demo', '', 'a--b', '-a', 'a_b', 'a'.repeat(65)].map((value) => ['project.name', (s) => { s.project.name = value; }]),
      ['project.title', (s) => { s.project.title = 'x'.repeat(121); }],
      ['project.title', (s) => { s.project.title = 5; }],
      ['project.parts', (s) => { s.project.parts = []; }],
      ['project.parts', (s) => { s.project.parts = Array.from({ length: 51 }, (_, index) => `p${index}`); }],
      ['project.parts', (s) => { s.project.parts = ['nexus', 'nexus']; }],
      ['project.parts', (s) => { s.project.parts = 'nexus'; }],
      ['project.parts[0]', (s) => { s.project.parts = ['Nexus']; }],
      ...['ids', 'repos', 'stages', 'summary', 'records', 'ask_before'].map((name) => [name, (s) => { s[name] = []; }]),
      ['items', (s) => { s.items = {}; }],
      ['items', (s) => { s.items = Array.from({ length: 3001 }, () => ({})); }],
      ['items[0]', (s) => { s.items[0] = 'REQ-001'; }],
      ['checks', (s) => { s.checks = 'none'; }],
      ['checks', (s) => { s.checks = Array.from({ length: 2002 }, () => ({})); }],
      ['checks[0]', (s) => { s.checks = [null]; }],
      ['truncated', (s) => { s.truncated = 'no'; }],
      ['pictures', (s) => { s.pictures = {}; }],
      ['pictures', (s) => { s.pictures = Array.from({ length: 1001 }, () => tiny(s.repos['.'].default.commit)); }],
      ['pictures[0]', (s) => { s.pictures[0] = []; }],
      ...['part', 'stage', 'commit', 'source'].map((name) => [`pictures[0].${name}`, (s) => { delete s.pictures[0][name]; }]),
      ['pictures[0].part', (s) => { s.pictures[0].part = 'Nexus'; }],
      ['pictures[0].stage', (s) => { s.pictures[0].stage = '02-prd'; }],
      ['pictures[0].key', (s) => { s.pictures[0].key = ''; }],
      ['pictures[0].key', (s) => { s.pictures[0].key = `docs/${'x'.repeat(300)}`; }],
      ['pictures[0].key', (s) => { s.pictures[0].key = 7; }],
      ['pictures[0].commit', (s) => { s.pictures[0].commit = 'HEAD'; }],
      ['pictures[0].source', (s) => { s.pictures[0].source = 'text'; }],
      ['pictures[0].source.text', (s) => { s.pictures[0].source.text = 7; }],
      ['pictures[0].source.text', (s) => { s.pictures[0].source.text = 'x'.repeat(MiB + 1); }],
      ['left_out', (s) => { s.left_out = {}; }],
      ['left_out', (s) => { s.left_out = Array.from({ length: 1001 }, () => ({})); }],
      ['left_out[0]', (s) => { s.left_out = ['05-erd']; }],
      ['replaces', (s) => { s.replaces = 'HEAD'; }],
      ['replaces', (s) => { s.replaces = 'A'.repeat(40); }],
    ];
    // Rules of one format only.
    const FORMAT_RULES = {
      [FORMAT_02]: ['03-user-flow', '08-screen-states', '09-mockup'].map((stage) => [`pictures[3].stage`, (s) => {
        s.pictures.push({ part: '', stage, key: `docs/${stage}.md`, commit: s.repos['.'].default.commit, source: { text: 'x' } });
      }]),
      [FORMAT_03]: [
        ['pictures[%].key', (s) => { delete s.pictures[keyed(s)].key; }],
        ['pictures[%].source.text', (s) => { delete s.pictures[keyed(s)].source.text; }],
        ['pictures[%].source.text', (s) => { s.pictures[keyed(s)].source = { lines: [] }; }],
      ],
    };
    const NEXUS_RULES = [
      ['repos["."]', (s) => { delete s.repos['.']; }],
      ['repos["."].default', (s) => { delete s.repos['.'].default; }],
      ['repos["."].default.commit', (s) => { s.repos['.'].default.commit = 'HEAD'; }],
      ['repos["."].default.commit', (s) => { delete s.repos['.'].default.commit; }],
      ['repos["."].url', (s) => { s.repos['.'].url = 'http://github.test/x'; }],
      ['repos["."].url', (s) => { s.repos['.'].url = `https://github.test/${'\ud800'}`; }],
      ['pictures[0].commit', (s) => { s.pictures[0].commit = newCommit(); }],
      ['pictures[0].part', (s) => { s.pictures[0].part = 'other'; }],
      ['pictures[3]', (s) => { s.pictures.splice(3, 0, structuredClone(s.pictures[0])); }],
      ['checks', (s) => {
        let deep = {};
        for (let level = 0; level < 120; level += 1) deep = { deep };
        s.checks.push(deep);
      }],
      ['body', (s) => {
        let deep = [];
        for (let level = 0; level < 120; level += 1) deep = [deep];
        s.extra = deep;
      }],
    ];
    const NEXUS_FORMAT_RULES = {
      [FORMAT_02]: [],
      [FORMAT_03]: [
        ['pictures[%].key', (s) => {
          const index = keyed(s);
          s.pictures.push({ ...structuredClone(s.pictures[index]) });
          s.pictures.splice(index, 0, s.pictures.pop());
          return index + 1;
        }],
        ...['/docs/a.md', 'docs//a.md', 'docs/./a.md', 'docs/../a.md', 'docs\\a.md', 'docs/a\u0001.md', 'docs/a.md/', 'docs/\ud800.md']
          .map((key) => ['pictures[%].key', (s) => { s.pictures[keyed(s)].key = key; }]),
        ['pictures[%].source.text', (s) => { s.pictures[keyed(s)].source.text = 'a\udc00b'; }],
      ],
    };

    let cases = 0;
    async function refused(format, field, change, schemaRefuses) {
      cases += 1;
      const snapshot = repositorySnapshot(format, { name: `rules-${cases}` });
      const returned = change(snapshot);
      // % is the index of the picture the change names: what it returns, or the first picture of a file.
      const named = field.includes('%') ? field.replace('%', String(returned ?? keyed(snapshot))) : field;
      const errors = validate(contract, snapshot, SNAPSHOT_SCHEMA);
      if (schemaRefuses) assert.notDeepEqual(errors, [], `the schema takes ${format} ${named}`);
      else assert.deepEqual(errors, [], `the schema refuses ${format} ${named}`);
      const answer = await push(snapshot);
      assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_snapshot', named], `${format} ${named}`);
      assert.equal(project(`rules-${cases}`), undefined);
    }

    for (const format of FORMATS) {
      test(`${format}: this repository's snapshot follows the schema and is taken`, async () => {
        const snapshot = repositorySnapshot(format, { name: `rules-taken-${format.slice(-1)}` });
        assert.deepEqual(validate(contract, snapshot, SNAPSHOT_SCHEMA), []);
        assert.equal((await push(snapshot)).status, 201);
      });

      test(`${format}: a snapshot that breaks a rule of the schema is refused, naming the field`, async () => {
        const before = counts();
        for (const [field, change] of [...SCHEMA_RULES, ...FORMAT_RULES[format]]) await refused(format, field, change, true);
        assert.deepEqual(counts(), before);
      });

      test(`${format}: a snapshot that breaks a rule NEXUS adds to keep it is refused, naming the field`, async () => {
        const before = counts();
        for (const [field, change] of [...NEXUS_RULES, ...NEXUS_FORMAT_RULES[format]]) await refused(format, field, change, false);
        assert.deepEqual(counts(), before);
      });
    }

    test('a body that is not a JSON object is refused as invalid_snapshot', async () => {
      for (const body of ['[]', 'null', '{"schema":', '"corthex-hub/0.2"']) {
        const answer = await push(body);
        assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_snapshot', 'body'], body);
      }
    });
  });

  test('a push that carries a request key is refused: the same commit again answers its revision', async () => {
    const before = counts();
    const answer = await push(repositorySnapshot(FORMAT_02, { name: 'with-key' }), { ...agent.headers, 'Idempotency-Key': `"${newId('nw')}"` });
    assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, 'invalid_request', 'Idempotency-Key']);
    assert.deepEqual(counts(), before);
  });

  test('the held commit of a project without a space, or of a name in no project\'s form, is project_not_found', async () => {
    for (const name of ['no-such-project', 'Demo', 'a'.repeat(65), encodeURIComponent('../x'), '%ZZ']) {
      const answer = await held(name);
      assert.deepEqual([answer.status, answer.json.code], [404, 'project_not_found'], name);
      assert.equal(answer.text.includes(name), false);
    }
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const owner = { 'Cf-Access-Jwt-Assertion': local.token() };
    const before = counts();
    for (const [headers, code] of [[{}, 'access_missing'], [owner, 'agent_only'],
      [{ 'CF-Access-Client-Id': agent.headers['CF-Access-Client-Id'], 'CF-Access-Client-Secret': randomBytes(32).toString('base64url') }, 'access_missing']]) {
      const pushed = await push(repositorySnapshot(FORMAT_02, { name: 'not-admitted' }), headers);
      const read = await held('first-send', headers);
      for (const answer of [pushed, read]) assert.equal(answer.json.code, code);
      assert.equal(read.text.includes('first-send'), false);
    }
    assert.deepEqual(counts(), before);
  });

  test('a snapshot that is not JSON gets json_required, and one over 8 MiB snapshot_too_large', async () => {
    const notJson = await push(JSON.stringify(repositorySnapshot(FORMAT_02, { name: 'not-json' })), { ...agent.headers, 'Content-Type': 'text/plain' });
    assert.deepEqual([notJson.status, notJson.json.code], [415, 'json_required']);
    const { answers: [tooLarge] } = await exchange(server.port, [
      head('POST', '/api/snapshots', { ...JSON_TYPE, ...agent.headers, 'Content-Length': 8 * MiB + 1 }),
    ]);
    responses.note('pushSnapshot', tooLarge);
    assert.deepEqual([tooLarge.status, tooLarge.json.code, tooLarge.json.limit], [413, 'snapshot_too_large', 8 * MiB]);
    assert.equal(project('not-json'), undefined);
  });

  test('every answer has a trace ID the log names, and the log names who sent it', async () => {
    const lines = (await server.logged(answers.length)).filter((line) => line.action === 'pushSnapshot' || line.action === 'getHeldCommit');
    assert.ok(lines.length > 50);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok(['push-job', 'unknown', 'owner'].includes(line.sender));
    }
  });

  test('answer internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = agentCredential(store, 'failing');
    // A store whose project statements cannot be prepared, as when the disk fails.
    const broken = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('project_spaces')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: broken, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    for (const [action, request] of [
      ['pushSnapshot', { method: 'POST', path: '/api/snapshots', headers: { ...JSON_TYPE, ...failing.headers }, body: JSON.stringify(repositorySnapshot(FORMAT_02)) }],
      ['getHeldCommit', { path: '/api/snapshots/corthex-nexus/held', headers: failing.headers }],
    ]) {
      const answer = await other.send(request);
      responses.note(action, answer);
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    assert.deepEqual((await other.logged(2)).map((line) => line.error), ['Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
    assert.equal(Number(store.prepare('SELECT count(*) AS n FROM snapshots').get().n), 0);
  });

  test('a snapshot of a pull request\'s merge commit reflects its change sets, and says what its drawing lacks (SPEC-025, note 26)', async () => {
    const name = 'merged-and-lacking';
    const [a, b] = [newCommit(), newCommit()];
    assert.equal((await push(repositorySnapshot(FORMAT_03, { name, commit: a }))).status, 201);
    // A direct edit of the ERD, in a pull request merged as b, renames an element to a name no document has.
    const rows = seed(db());
    const space = { id: Number(project(name).id) };
    const erd = db().prepare("SELECT id FROM diagrams WHERE project_id = ? AND kind = 'erd'").get(space.id);
    const drawing = db().prepare("SELECT max(id) AS id FROM drawings WHERE diagram_id = ? AND status = 'drawn'").get(erd.id);
    const where = { id: Number(erd.id), drawing: Number(drawing.id) };
    const { element_key: key } = db().prepare('SELECT element_key FROM elements WHERE drawing_id = ? ORDER BY id LIMIT 1').get(where.drawing);
    const set = rows.changeSet(space, where);
    rows.change(set, { op: 'rename', element: key, name: 'a_name_no_document_has' });
    const merged = rows.pullRequest(space, { number: 18, state: 'merged' });
    rows.setChangeSet(set, { pullRequestId: merged });
    db().prepare('UPDATE pull_requests SET merge_commit = ? WHERE id = ?').run(b, merged);

    const answer = await push(repositorySnapshot(FORMAT_03, { name, commit: b, replaces: a }));
    assert.deepEqual([answer.status, answer.json.change_sets_reflected], [200, 1]);
    const bodies = db().prepare(
      "SELECT c.body FROM comments c JOIN comment_threads h ON h.id = c.thread_id WHERE h.diagram_id = ? AND h.target_kind = 'diagram'",
    ).all(where.id).map((row) => row.body);
    assert.equal(bodies.length, 1);
    assert.ok(bodies[0].startsWith('병합한 PR #18의 문서에 이 변경이 없어요.'));
  });

  test('answer every response API-242 and API-243 list', () => {
    responses.assertEvery('pushSnapshot');
    responses.assertEvery('getHeldCommit');
  });

  test('touch the tables their x-corthex.tables lists, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'pushSnapshot', { coveredElsewhere: ['TBL-172'] }); // Resolution is exercised in after-drawing.test.js.
    checkTables(recorder, 'getHeldCommit');
    checkLayer(recorder);
  });
});
