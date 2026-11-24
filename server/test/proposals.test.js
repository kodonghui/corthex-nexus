// Agent proposals (TASK-438; API-256, API-257, SPEC-018, SPEC-027, rule 3, rule 5): TASK-438's done condition, every
// response the two operations list, the change set, its changes and its thread against the contract, the to-do and the
// claims they change, the tables they touch (note 23) and their log lines. The project's diagrams, drawings, elements
// and threads are written straight into the store with test/seed.js, as the push and the owner's operations of other
// tasks would write them; the drawings of stage 03 and 08 are this repository's own flow and screen files, drawn by
// their drawers as a push draws them, and those of the space sources, for TASK-466 and TASK-470, the pinned hub's
// pictures of this repository's docs/01-domain/nexus.md, db/nexus.sql and docs/07-sitemap/nexus.yaml
// (ddd-board-picture.json, erd-picture.json and sitemap-picture.json), and in its part split, pictures read from two
// files each, all kept in the snapshot as the push sent them.

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { TRACE_ID as ITEM_ID } from '../src/drawer.js';
import { drawProposed, pictureWarnings } from '../src/drawing.js';
import { threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { readDomainPicture } from '../src/domain-picture.js';
import { idFormat } from '../src/picture-text.js';
import { ROUTES } from '../src/routes.js';
import { readSitemapPicture } from '../src/sitemap-picture.js';
import { readSqlPicture } from '../src/sql-picture.js';
import { openStore } from '../src/store.js';
import { read } from './contract.js';
import { responseRecord } from './responses.js';
import { seed, TIME } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const START = Date.parse('2026-11-24T02:00:00.000Z');
const MINUTE = 60 * 1000;
const MiB = 1024 * 1024;
const S1 = 'claude-code-4f2a91';
const S2 = 'codex-7d1e';
const at = (ms) => new Date(ms).toISOString();
const FL3 = 'docs/03-user-flow/FL-003-comment-and-answer-an-ai-proposal.md';
const SCR = 'docs/08-screens/SCR-144.md';
const flow = (name) => `docs/03-user-flow/${name}.md`;
// The project's /snapshot document lists its file pictures with their part, so that a diagram's part is found.
const PICTURES = [
  ...[FL3, flow('FL-020'), flow('FL-021'), flow('FL-009')].map((key) => ({ stage: '03-user-flow', key, part: 'nexus' })),
  { stage: '08-screen-states', key: SCR, part: 'nexus' },
];
const ACTIONS = ['makeProposal', 'withdrawProposal'];
// The proposed flow: J renamed, a box W with two arrows added, and R2 removed with its two arrows.
const FL3_TEXT = read(FL3);
const FL3_PROPOSED = FL3_TEXT
  .replace('J["Mark it rejected, thread<br/>stays open<br/>REQ-024"]', 'J["Mark it rejected, the thread<br/>stays open<br/>REQ-024"]')
  .replace('  Y(["Reflect it: FL-005"])\n', '  Y(["Reflect it: FL-005"])\n  W["Agent withdraws the proposal<br/>REQ-022"]\n')
  .replace('  R2["Not offered on a phone<br/>REQ-068"]\n', '')
  .replace('  G e10@-->|owner on a phone| R2\n', '  G e20@-->|the agent withdraws| W\n  W e21@--> K\n')
  .replace('  R2 e18@--> Z\n', '')
  .replace('class B,E,F,I,J,K,R1,R2,R3 proc', 'class B,E,F,I,J,K,R1,R3,W proc')
  .replace(/e10,|e18,/g, '');
const FL3_CHANGES = [
  { op: 'rename', element: 'J', name: 'Mark it rejected, the thread stays open', target: null },
  { op: 'add', element: 'W', name: 'Agent withdraws the proposal', target: null },
  { op: 'connect', element: 'G', name: 'the agent withdraws', target: 'W' },
  { op: 'connect', element: 'W', name: null, target: 'K' },
  { op: 'remove', element: 'R2', name: null, target: null },
  { op: 'remove', element: 'G->R2', name: null, target: null },
  { op: 'remove', element: 'R2->Z', name: null, target: null },
];
const SCR_TEXT = read(SCR);
// TASK-466: the pinned hub's pictures of this repository's schema and sitemap, and their texts.
const fixture = (name) => JSON.parse(readFileSync(new URL(name, import.meta.url), 'utf8'));
const ERD_PICTURE = fixture('erd-picture.json');
const SITEMAP_PICTURE = fixture('sitemap-picture.json');
const SQL_TEXT = read('db/nexus.sql');
const YAML_TEXT = read('docs/07-sitemap/nexus.yaml');
// TASK-470: the pinned hub's stage-01 picture of this repository's domain document, and its text.
const DDD_PICTURE = fixture('ddd-board-picture.json');
const DOMAIN_FILE = 'docs/01-domain/nexus.md';
const DOMAIN_TEXT = read(DOMAIN_FILE);
// TASK-470: part split's board, ERD and sitemap, each read from two files. In the ERD, db/left.sql gives a table of
// db/right.sql a foreign key and has a unique index the hub leaves out.
const COMMANDS = '| Given by | Read model | Command | Aggregate | Events |\n| --- | --- | --- | --- | --- |\n';
const SPLIT_DOMAIN = [
  ['docs/01-domain/a.md', `### CTX-301 Ordering\n\n${COMMANDS}| Customer | Basket | Place order | Order | Order placed |\n`],
  ['docs/01-domain/b.md', `### CTX-302 Billing\n\n${COMMANDS}| Bank | Ledger | Record payment | Invoice | Invoice paid |\n`],
];
const SPLIT_SQL = [
  ['db/left.sql', '-- TBL-301 left items\nCREATE TABLE left_items (id INTEGER PRIMARY KEY, code TEXT);\n'
    + 'CREATE UNIQUE INDEX left_code ON left_items (lower(code));\n'
    + 'ALTER TABLE right_items ADD FOREIGN KEY (left_id) REFERENCES left_items (id);\n'],
  ['db/right.sql', '-- TBL-302 right items\nCREATE TABLE right_items (id INTEGER PRIMARY KEY, left_id INTEGER);\n'],
];
const SPLIT_YAML = [
  ['docs/07-sitemap/a.yaml', '- id: SCR-301\n  name: Start\n  children:\n    - id: SCR-302\n      name: Orders\n'],
  ['docs/07-sitemap/b.yaml', '- id: SCR-303\n  name: Billing\n  children:\n    - id: SCR-304\n      name: Invoices\n'],
];
const SPLIT = [
  { stage: '01-domain', kind: 'ddd_board', name: 'DDD board', ...readDomainPicture(SPLIT_DOMAIN, { part: 'split' }), files: SPLIT_DOMAIN },
  { stage: '05-erd', kind: 'erd', name: 'ERD', ...readSqlPicture(SPLIT_SQL, { part: 'split' }), files: SPLIT_SQL },
  { stage: '07-sitemap', kind: 'sitemap', name: 'Sitemap', ...readSitemapPicture(SPLIT_YAML, { part: 'split' }), files: SPLIT_YAML },
];
const SPLIT_LEFT_OUT = 'unique index has an unreadable column expression; rule omitted';
// The hub's warning of a file past its limit of files, which it did not read: a left_out element of part own's ERD,
// whose file it does not make one of the drawing's files.
const OWN_NOT_READ = {
  rule: 'picture-partial', level: 'warn', message: 'db/zz.sql:1: first of 2 supported sources omitted after 500 files', by: 'scan', stage: '05-erd', part: 'own',
};
// The proposed schema: request_keys renamed, the elements' drawing_id referencing diagrams in place of drawings, a
// column's type changed, restore_rehearsals removed, agent_notes added with a foreign key, a unique index on an
// expression, which the hub leaves out, and a view, which it passes over.
const SQL_PROPOSED = SQL_TEXT
  .replace('CREATE TABLE request_keys (', 'CREATE TABLE idempotency_keys (')
  .replace('drawing_id   INTEGER NOT NULL REFERENCES drawings (id) ON DELETE CASCADE,\n  element_key',
    'drawing_id   INTEGER NOT NULL REFERENCES diagrams (id) ON DELETE CASCADE,\n  element_key')
  .replace('  bytes        INTEGER,\n', '  bytes        BIGINT,\n')
  .replace(/-- TBL-171 restore_rehearsals[^]*?CREATE INDEX restore_rehearsals_by_backup[^\n]*\n/u, '')
  .concat('\n-- TBL-172 agent_notes (operations)\n',
    'CREATE TABLE agent_notes (id INTEGER PRIMARY KEY, credential_id INTEGER NOT NULL REFERENCES agent_credentials (id), body TEXT);\n',
    'CREATE UNIQUE INDEX todos_kind_lower ON todos (lower(kind));\n',
    'CREATE VIEW open_todos AS SELECT * FROM todos WHERE closed_at IS NULL;\n');
const LEFT_OUT = 'unique index has an unreadable column expression; rule omitted';
const SQL_CHANGES = [
  { op: 'rename', element: 'TBL-169', name: 'idempotency_keys', target: null },
  { op: 'add', element: 'TBL-172', name: 'agent_notes', target: null },
  { op: 'remove', element: 'TBL-153/line:drawing_id', name: null, target: null },
  { op: 'connect', element: 'TBL-153', name: 'drawing_id', target: 'TBL-151' },
  { op: 'connect', element: 'TBL-172', name: 'credential_id', target: 'TBL-146' },
  { op: 'add', element: `statement:${LEFT_OUT}`, name: LEFT_OUT, target: null },
  { op: 'remove', element: 'TBL-171', name: null, target: null },
  { op: 'remove', element: 'TBL-171/line:backup_id', name: null, target: null },
];
// The proposed sitemap: SCR-146 renamed and moved from under SCR-145 to under SCR-144, and SCR-147 added under SCR-143.
const SCR146 = YAML_TEXT.slice(YAML_TEXT.indexOf('                - id: SCR-146'));
const YAML_PROPOSED = YAML_TEXT.slice(0, YAML_TEXT.indexOf(SCR146))
  .concat(SCR146.replace(/^ {4}/gmu, '').replace('Changes since the last confirmation', 'Changes since confirmation'))
  .concat('        - id: SCR-147\n          name: Agent sessions\n          path: /p/{project}/sessions\n');
const YAML_CHANGES = [
  { op: 'rename', element: 'SCR-146', name: 'Changes since confirmation', target: null },
  { op: 'add', element: 'SCR-147', name: 'Agent sessions', target: null },
  { op: 'connect', element: 'SCR-144', name: 'Changes since confirmation', target: 'SCR-146' },
  { op: 'connect', element: 'SCR-143', name: 'Agent sessions', target: 'SCR-147' },
  { op: 'remove', element: 'SCR-145/line:SCR-146', name: null, target: null },
];

describe('agent proposals', () => {
  const responses = responseRecord();
  let folder;
  let db;
  let recorder;
  let local;
  let server;
  let s;
  let space;
  let bare;
  let bareItems;
  let commits;
  let erd;
  let flow3;
  let flow20;
  let flow21;
  let removedFlow;
  let screen;
  let board;
  let sitemap;
  let sources;
  let clock = START;

  // An element of a drawing, by its trace ID, which is its key (TBL-153).
  const element = (drawing, traceId, name, kind = 'table') => s.elements(drawing, [{ key: traceId, trace_id: traceId, kind, name }]);
  // A file's drawing as the push draws it: its drawer's elements, checked and keyed.
  const drawFile = (drawing, stage, kind, key, text) => {
    const { elements } = drawProposed({ stage, part: 'nexus', kind, key, text });
    s.elements(drawing, elements);
  };
  // A stage's picture drawn as the push draws it, with the hub's warnings; an element keyed by a trace ID holds it.
  const drawPicture = (drawing, stage, kind, part, { source, picture, checks }) => {
    const warnings = pictureWarnings(checks, stage, part);
    const { elements } = drawProposed({ stage, part, kind, key: null, source, text: JSON.stringify(picture), warnings });
    // A push keeps each warning's element as left_out, a status drawProposed does not give.
    const left = new Set(warnings.map(({ detail }) => detail));
    s.elements(drawing, elements.map((each) => ({
      ...each, trace_id: ITEM_ID.test(each.key) ? each.key : null, status: left.has(each.name) ? 'left_out' : null,
    })));
  };

  // Sends a write of action with its JSON body, request key and session, and checks the answer against the contract.
  const write = async (action, path, body, {
    session = S1, headers = s.agent.headers, key = `"${newId('nw')}"`, type = 'application/json', raw,
  } = {}) => {
    const all = { ...headers, 'Content-Type': type };
    if (session !== null) all['Nexus-Session'] = session;
    if (key !== null) all['Idempotency-Key'] = key;
    const answer = await server.send({ method: 'POST', path, headers: all, body: raw ?? JSON.stringify(body) });
    return responses.note(action, answer);
  };
  const propose = (body, options = {}) => write('makeProposal', `/api/spaces/${options.project ?? space.name}/proposals`, body, options);
  const withdraw = (id, options = {}) => write(
    'withdrawProposal', `/api/spaces/${options.project ?? space.name}/proposals/${id}/withdraw`, options.body ?? {}, options,
  );
  const getJson = async (path) => (await server.send({ method: 'GET', path, headers: s.agent.headers })).json;

  const erdProposal = (extra = {}) => ({
    part: 'nexus', stage: '05-erd', items: ['TBL-146'], reason: 'The owner asked to name the table after the term.',
    change: 'Rename agent_credentials to agent_keys.', ...extra,
  });
  const flowProposal = (extra = {}) => ({
    part: 'nexus', stage: '03-user-flow', items: ['FL-003'], reason: 'The agent may withdraw a proposal.', change: 'Add the withdrawal.',
    ...extra,
  });
  const sourceProposal = (extra = {}) => propose({
    part: 'nexus', stage: '05-erd', items: ['TBL-169'], reason: 'The schema reads better so.', change: 'Change the schema.', ...extra,
  }, { project: sources.name });

  // An owner's thread that waits on the agent, with its comment entry: { thread, id, entry }.
  const waiting = (where, options = {}) => {
    const thread = s.thread(where, options);
    threadChanged(db, { project: space.id, thread, time: TIME });
    return { thread, id: idOf('nc', thread), entry: openEntry('comment', thread) };
  };
  const openEntry = (kind, thread) => {
    const row = db.prepare('SELECT id FROM todos WHERE thread_id = ? AND kind = ? AND closed_at IS NULL').get(thread, kind);
    return row === undefined ? null : Number(row.id);
  };
  const lastSet = () => Number(db.prepare('SELECT id FROM change_sets ORDER BY id DESC LIMIT 1').get().id);
  const lastThread = () => Number(db.prepare('SELECT id FROM comment_threads ORDER BY id DESC LIMIT 1').get().id);
  const threadEntries = (thread) => db.prepare('SELECT side, kind, close_reason FROM todos WHERE thread_id = ? ORDER BY id')
    .all(thread).map((row) => `${row.side} ${row.kind} ${row.close_reason ?? 'open'}`);
  const proposalEntries = (set) => db.prepare("SELECT side, close_reason FROM todos WHERE change_set_id = ? AND kind = 'proposal' ORDER BY id")
    .all(set).map((row) => `${row.side} proposal ${row.close_reason ?? 'open'}`);
  const commentsOf = (thread) => db.prepare('SELECT seq, author, credential_id, body, detail FROM comments WHERE thread_id = ? ORDER BY seq')
    .all(thread).map((row) => ({ ...row, credential_id: row.credential_id === null ? null : Number(row.credential_id), detail: JSON.parse(row.detail) }));
  const threadRow = (thread) => ({ ...db.prepare('SELECT target_kind, element_key, drawing_id, state, waits_on FROM comment_threads WHERE id = ?').get(thread) });
  const claimsOf = (entry) => db.prepare('SELECT session, release_reason FROM claims WHERE todo_id = ? ORDER BY id').all(entry)
    .map((row) => ({ ...row }));
  const setRow = (set) => ({ ...db.prepare('SELECT origin, state, credential_id, thread_id, detail, decided_at FROM change_sets WHERE id = ?').get(set) });
  const count = (table) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  const claim = (id, session) => server.send({
    method: 'POST', path: `/api/spaces/${space.name}/claims/${id}`, headers: { ...s.agent.headers, 'Nexus-Session': session },
  });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-proposals-'));
    ({ db } = openStore(folder));
    recorder = recordTables(db);
    local = localGate();
    server = await startServer({ store: recorder.store, gate: local.gate, now: () => clock, routes: ROUTES });
    s = seed(db);
    space = s.project('demo', { parts: ['nexus'], pictures: PICTURES });
    commits = [space.commit];
    // The ERD drew at the first snapshot, the second left it as it was, the third drew it again and the fourth left
    // that drawing.
    erd = s.diagram(space, { sourceKey: '/pictures/05-erd/nexus' });
    const firstErd = erd.drawing;
    element(firstErd, 'TBL-146', 'agent_credentials');
    element(firstErd, 'TBL-147', 'project_spaces');
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    commits.push(space.commit);
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    commits.push(space.commit);
    erd = { id: erd.id, drawing: s.drawing(space, erd.id), first: firstErd };
    element(erd.drawing, 'TBL-146', 'agent_credentials');
    element(erd.drawing, 'TBL-147', 'project_spaces');
    element(erd.drawing, 'TBL-148', 'snapshots');
    // A part left out as unreadable: its element counts as gone (SPEC-027).
    s.elements(erd.drawing, [{ key: 'TBL-160', trace_id: 'TBL-160', kind: 'table', name: 'confirmations', status: 'unreadable' }]);
    // Stage 03: this repository's FL-003, drawn by its drawer; two flows whose boxes hold TERM-300, and a removed flow.
    flow3 = s.diagram(space, { stage: '03-user-flow', sourceKey: FL3, kind: 'user_flow', name: 'FL-003 Comment and answer an AI proposal' });
    drawFile(flow3.drawing, '03-user-flow', 'user_flow', FL3, FL3_TEXT);
    flow20 = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('FL-020'), kind: 'user_flow', name: 'FL-020 Alpha' });
    element(flow20.drawing, 'TERM-300', 'Alpha step', 'step');
    flow21 = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('FL-021'), kind: 'user_flow', name: 'FL-021 Beta' });
    element(flow21.drawing, 'TERM-300', 'Beta step', 'step');
    removedFlow = s.diagram(space, { stage: '03-user-flow', sourceKey: flow('FL-009'), kind: 'user_flow', name: 'FL-009 Issue and revoke agent access', removed: true });
    element(removedFlow.drawing, 'TERM-301', 'Revoke', 'step');
    // Stage 08: this repository's SCR-144, drawn by its drawer.
    screen = s.diagram(space, { stage: '08-screen-states', sourceKey: SCR, kind: 'screen_states', name: 'SCR-144 Project' });
    drawFile(screen.drawing, '08-screen-states', 'screen_states', SCR, SCR_TEXT);
    // Stage 01's board drew; stage 07's sitemap never drew.
    board = s.diagram(space, { stage: '01-domain', sourceKey: '/pictures/01-domain/nexus', kind: 'ddd_board', name: 'DDD board' });
    element(board.drawing, 'CTX-038', 'Comments and changes', 'context');
    sitemap = s.diagram(space, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap/nexus', kind: 'sitemap', name: 'Sitemap', status: 'failed' });
    s.snapshot(space, { parts: ['nexus'], pictures: PICTURES });
    commits.push(space.commit);
    // TASK-466: a space whose ERD and sitemap are the pinned hub's pictures of this repository's schema and sitemap;
    // in part own an ERD of the project's own table ID prefix, and in part split one drawn from two files.
    // TASK-470: its board too, and in part split a board, an ERD and a sitemap each drawn from two files; the snapshot
    // keeps each picture as the push sent it, and the hub's checks.
    sources = s.project('sources', { parts: ['nexus', 'own', 'split'], checks: [...SPLIT.flatMap((each) => each.checks), OWN_NOT_READ] });
    const keep = (stage, part, picture) => s.document(sources, `/pictures/${stage}/${part}`, stage, JSON.stringify(picture));
    const schema = s.diagram(sources, { sourceKey: '/pictures/05-erd/nexus' });
    drawPicture(schema.drawing, '05-erd', 'erd', 'nexus', ERD_PICTURE);
    keep('05-erd', 'nexus', ERD_PICTURE.picture);
    const screens = s.diagram(sources, { stage: '07-sitemap', sourceKey: '/pictures/07-sitemap/nexus', kind: 'sitemap', name: 'Sitemap' });
    drawPicture(screens.drawing, '07-sitemap', 'sitemap', 'nexus', SITEMAP_PICTURE);
    keep('07-sitemap', 'nexus', SITEMAP_PICTURE.picture);
    const domain = s.diagram(sources, { stage: '01-domain', sourceKey: '/pictures/01-domain/nexus', kind: 'ddd_board', name: 'DDD board' });
    drawPicture(domain.drawing, '01-domain', 'ddd_board', 'nexus', DDD_PICTURE);
    keep('01-domain', 'nexus', DDD_PICTURE.picture);
    const own = s.diagram(sources, { sourceKey: '/pictures/05-erd/own' });
    const ownSql = '-- T-1 users of the own part\nCREATE TABLE users (id INTEGER PRIMARY KEY);\n';
    const ownPicture = readSqlPicture([['db/own.sql', ownSql]], { ids: idFormat([['T', 'table']]), part: 'own' });
    ownPicture.checks.push(OWN_NOT_READ);
    drawPicture(own.drawing, '05-erd', 'erd', 'own', { source: 'db/own.sql', ...ownPicture });
    keep('05-erd', 'own', ownPicture.picture);
    for (const { stage, kind, name, picture, checks, files } of SPLIT) {
      const split = s.diagram(sources, { stage, sourceKey: `/pictures/${stage}/split`, kind, name });
      drawPicture(split.drawing, stage, kind, 'split', { source: files[0][0], picture, checks });
      keep(stage, 'split', picture);
    }
    // A space whose stage 08 shows its item table, and whose other stages drew nothing.
    bare = s.project('bare');
    bareItems = s.diagram(bare, { stage: '08-screen-states', sourceKey: '/items/08-screen-states', kind: 'item_table', name: 'Item table' });
  });

  after(async () => {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });

  test('a proposal of its own opens a thread that waits on the owner, who sees its question and the proposal (SPEC-018)', async () => {
    clock = START;
    const answer = await propose(erdProposal({ adds: ['TERM-217'] }));
    assert.equal(answer.status, 201);
    const set = lastSet();
    const thread = lastThread();
    assert.deepEqual(answer.json, {
      id: idOf('np', set),
      part: 'nexus',
      stage: '05-erd',
      diagram: idOf('dg', erd.id),
      drawing: idOf('dw', erd.drawing),
      version: commits[2],
      origin: 'proposal',
      thread: idOf('nc', thread),
      state: 'proposed',
      items: ['TBL-146'],
      adds: ['TERM-217'],
      reason: 'The owner asked to name the table after the term.',
      change: 'Rename agent_credentials to agent_keys.',
      source_text: false,
      changes: [],
      made_at: at(clock),
      decided_at: null,
      reflection: null,
      pull_request: null,
    });
    // TBL-158 keeps the request under ProposalRequest's names, with the agent's credential and the thread.
    assert.deepEqual(setRow(set), {
      origin: 'proposal', state: 'proposed', credential_id: s.agent.key, thread_id: thread, decided_at: null,
      detail: JSON.stringify({
        items: ['TBL-146'], adds: ['TERM-217'], reason: 'The owner asked to name the table after the term.', change: 'Rename agent_credentials to agent_keys.',
      }),
    });
    // The thread is on the diagram as a whole at the proposal's drawing, with the change text as its one entry.
    assert.deepEqual(threadRow(thread), { target_kind: 'diagram', element_key: null, drawing_id: erd.drawing, state: 'open', waits_on: 'owner' });
    assert.deepEqual(commentsOf(thread), [{ seq: 1, author: 'agent', credential_id: s.agent.key, body: 'Rename agent_credentials to agent_keys.', detail: {} }]);
    assert.deepEqual(threadEntries(thread), ['owner question open']);
    assert.deepEqual(proposalEntries(set), ['owner proposal open']);
    // API-247 reads the change set back as API-256 answered it, and API-246 the thread with its entry and change set.
    assert.deepEqual(await getJson(`/api/spaces/${space.name}/proposals/${idOf('np', set)}`), answer.json);
    const shown = await getJson(`/api/spaces/${space.name}/comments/${idOf('nc', thread)}`);
    assert.deepEqual([shown.entries.length, shown.entries[0].text, shown.change_sets, shown.waits_on], [1, 'Rename agent_credentials to agent_keys.', [idOf('np', set)], 'owner']);
  });

  test('with source_text on stage 03, the differences become changes; the item that names the flow lays it over the whole (SPEC-018)', async () => {
    clock = START + MINUTE;
    const answer = await propose(flowProposal({ source_text: FL3_PROPOSED }));
    assert.equal(answer.status, 201);
    assert.deepEqual(
      [answer.json.diagram, answer.json.drawing, answer.json.items, answer.json.source_text, answer.json.changes],
      [idOf('dg', flow3.id), idOf('dw', flow3.drawing), ['FL-003'], true, FL3_CHANGES],
    );
    const set = lastSet();
    assert.equal(JSON.parse(setRow(set).detail).source_text, FL3_PROPOSED);
    assert.deepEqual(threadRow(lastThread()).target_kind, 'diagram');
    // The same text proposes nothing; a moved box changes only its place, which makes no change either.
    const same = await propose(flowProposal({ source_text: FL3_TEXT }));
    assert.deepEqual([same.status, same.json.changes], [201, []]);
    const moved = await propose(flowProposal({ source_text: FL3_TEXT.replace('flowchart TD', 'flowchart LR') }));
    assert.deepEqual([moved.status, moved.json.changes], [201, []]);
  });

  test('with source_text on stage 08, added and removed states become changes, and a description makes none', async () => {
    clock = START + 2 * MINUTE;
    const text = SCR_TEXT
      .replace(/^\| SCR-144#loading \|.*\n/m, '')
      .replace(/^(\| SCR-144#empty \|)[^|]*\|/m, '$1 A space with nothing drawn yet. |')
      .replace(/^(\| SCR-144#permission \|.*\n)/m, '$1| SCR-144#offline | The page says it is offline. | - |\n');
    const answer = await propose({ ...flowProposal({ stage: '08-screen-states', items: ['SCR-144'] }), source_text: text });
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.diagram, answer.json.changes], [idOf('dg', screen.id), [
      { op: 'add', element: 'SCR-144#offline', name: 'SCR-144#offline', target: null },
      { op: 'remove', element: 'SCR-144#loading', name: null, target: null },
    ]]);
  });

  test('a proposed document that does not draw, or makes more than 500 changes, gets invalid_request on source_text', async () => {
    const sets = count('change_sets');
    const broken = SCR_TEXT.replace(/^\| SCR-144#loading \|.*\n/m, '| SCR-144#loading | two cells |\n');
    const line = SCR_TEXT.split('\n').findIndex((each) => each.startsWith('| SCR-144#loading |')) + 1;
    const cases = [
      [{ ...flowProposal({ stage: '08-screen-states', items: ['SCR-144'] }), source_text: broken }, `source_text does not draw at its line ${line}`],
      [flowProposal({ source_text: '# FL-003 No flowchart here' }), 'source_text does not draw'],
      [{
        ...flowProposal({ stage: '08-screen-states', items: ['SCR-144'] }),
        source_text: `# SCR-144 Project\n\n| State | What | From |\n| --- | --- | --- |\n${Array.from({ length: 501 }, (_, n) => `| SCR-144#s${n} | x | - |`).join('\n')}\n`,
      }, 'source_text makes more than 500 changes'],
    ];
    for (const [body, detail] of cases) {
      const refused = await propose(body);
      assert.deepEqual([refused.status, refused.json.code, refused.json.field, refused.json.detail], [400, 'invalid_request', 'source_text', detail]);
    }
    assert.equal(count('change_sets'), sets);
  });

  test('with source_text on stage 01, NEXUS reads the Markdown as the pinned hub does, and the differences become changes (TASK-470)', async () => {
    clock = START + 3 * MINUTE;
    const domainAt = (extra) => sourceProposal({ stage: '01-domain', items: ['CTX-038'], ...extra });
    const renamed = DOMAIN_TEXT.replace('### CTX-038 Review\n', '### CTX-038 Review and proposals\n');
    assert.notEqual(renamed, DOMAIN_TEXT);
    const answer = await domainAt({ source_text: renamed });
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.source_text, answer.json.items, answer.json.changes],
      [true, ['CTX-038'], [{ op: 'rename', element: 'CTX-038', name: 'Review and proposals', target: null }]]);
    // The document as it is makes no change, nor does it with a byte order mark, nor a path that names its one file.
    for (const extra of [{ source_text: DOMAIN_TEXT }, { source_text: `\uFEFF${DOMAIN_TEXT}` }, { source_text: DOMAIN_TEXT, source_path: DOMAIN_FILE }]) {
      const same = await domainAt(extra);
      assert.deepEqual([same.status, same.json.changes], [201, []], Object.keys(extra).join());
    }
    // The path is not kept.
    assert.deepEqual(Object.keys(JSON.parse(setRow(lastSet()).detail)), ['items', 'reason', 'change', 'source_text']);
    // Markdown that reads no context is refused, and nothing is written.
    const sets = count('change_sets');
    const none = await domainAt({ source_text: '# Domain\n\nNo context here.\n' });
    assert.deepEqual([none.status, none.json.code, none.json.field, none.json.detail], [400, 'invalid_request', 'source_text', 'source_text reads no context']);
    assert.equal(count('change_sets'), sets);
  });

  test('with source_text and source_path on a drawing of several files, the text takes that file\'s place, and only its differences are changes (TASK-470)', async () => {
    clock = START + 3 * MINUTE;
    const splitAt = (stage, items, path, text) => sourceProposal({ part: 'split', stage, items, source_path: path, source_text: text });
    const [domain, sql, yaml] = SPLIT.map((each) => Object.fromEntries(each.files));
    // Stage 01: a context of b.md renamed; a.md's context and stickies stay.
    const board = await splitAt('01-domain', ['CTX-302'], 'docs/01-domain/b.md', domain['docs/01-domain/b.md'].replace('CTX-302 Billing', 'CTX-302 Payments'));
    assert.deepEqual([board.status, board.json.changes], [201, [{ op: 'rename', element: 'CTX-302', name: 'Payments', target: null }]]);
    // Stage 05: a table added to db/right.sql with a foreign key; the foreign key db/left.sql gives its table and the
    // unique index the hub left out of db/left.sql stay.
    const added = `${sql['db/right.sql']}-- TBL-303 extras\nCREATE TABLE extras (id INTEGER PRIMARY KEY, right_id INTEGER REFERENCES right_items (id));\n`;
    const right = await splitAt('05-erd', ['TBL-302'], 'db/right.sql', added);
    assert.deepEqual([right.status, right.json.changes], [201, [
      { op: 'add', element: 'TBL-303', name: 'extras', target: null },
      { op: 'connect', element: 'TBL-303', name: 'right_id', target: 'TBL-302' },
    ]]);
    // A table of db/left.sql renamed, the table its ALTER TABLE reaches in db/right.sql keeping its foreign key.
    const left = await splitAt('05-erd', ['TBL-301'], 'db/left.sql', sql['db/left.sql'].replaceAll('left_items', 'left_rows'));
    assert.deepEqual([left.status, left.json.changes], [201, [{ op: 'rename', element: 'TBL-301', name: 'left_rows', target: null }]]);
    // Without the unique index, what the hub left out of it goes.
    const index = await splitAt('05-erd', ['TBL-301'], 'db/left.sql', sql['db/left.sql'].replace(/CREATE UNIQUE INDEX[^\n]*\n/u, ''));
    assert.deepEqual([index.status, index.json.changes], [201, [{ op: 'remove', element: `statement:${SPLIT_LEFT_OUT}`, name: null, target: null }]]);
    // Stage 07: a screen added in a.yaml, which moves b.yaml's screens down the hub's list; they make no change.
    const screens = `${yaml['docs/07-sitemap/a.yaml']}    - id: SCR-305\n      name: Baskets\n`;
    const sitemap = await splitAt('07-sitemap', ['SCR-301'], 'docs/07-sitemap/a.yaml', screens);
    assert.deepEqual([sitemap.status, sitemap.json.changes], [201, [
      { op: 'add', element: 'SCR-305', name: 'Baskets', target: null },
      { op: 'connect', element: 'SCR-301', name: 'Baskets', target: 'SCR-305' },
    ]]);
    // A file left with none of its own entries still takes its place: what it gave the picture goes, and the other
    // file's entries stay.
    for (const [stage, path, text, gone, other] of [
      ['01-domain', 'docs/01-domain/b.md', '# Billing\n\nNot yet.\n', 'CTX-302', 'CTX-301'],
      ['05-erd', 'db/right.sql', '-- no table yet\n', 'TBL-302', 'TBL-301'],
      ['07-sitemap', 'docs/07-sitemap/b.yaml', '# no screen yet\n', 'SCR-303', 'SCR-301'],
    ]) {
      const emptied = await splitAt(stage, [gone], path, text);
      assert.equal(emptied.status, 201, path);
      assert.ok(emptied.json.changes.some(({ op, element }) => op === 'remove' && element === gone), path);
      assert.ok(emptied.json.changes.every(({ element }) => element !== other), path);
    }
    // Each file as it is makes no change.
    for (const { stage, files } of SPLIT) {
      for (const [path, text] of files) {
        const items = [{ '01-domain': 'CTX-301', '05-erd': 'TBL-301', '07-sitemap': 'SCR-301' }[stage]];
        const same = await splitAt(stage, items, path, text);
        assert.deepEqual([same.status, same.json.changes], [201, []], path);
      }
    }
  });

  test('source_path is needed on a drawing of several files, and one that names no file the drawing reads is refused (TASK-470)', async () => {
    const sets = count('change_sets');
    const threads = count('comment_threads');
    const needed = 'source_path is needed: the drawing reads several files';
    const unknown = 'source_path names no file the drawing reads';
    for (const [body, options, detail] of [
      [{ part: 'split', items: ['TBL-301'], source_text: SPLIT_SQL[0][1] }, { project: sources.name }, needed],
      [{ part: 'split', stage: '01-domain', items: ['CTX-301'], source_text: SPLIT_DOMAIN[0][1] }, { project: sources.name }, needed],
      [{ part: 'split', stage: '07-sitemap', items: ['SCR-301'], source_text: SPLIT_YAML[0][1] }, { project: sources.name }, needed],
      [{ part: 'split', items: ['TBL-301'], source_text: SPLIT_SQL[0][1], source_path: 'db/other.sql' }, { project: sources.name }, unknown],
      // A path that differs from the file only in case, or that names the picture's key.
      [{ part: 'split', items: ['TBL-301'], source_text: SPLIT_SQL[0][1], source_path: 'db/LEFT.sql' }, { project: sources.name }, unknown],
      [{ part: 'split', items: ['TBL-301'], source_text: SPLIT_SQL[0][1], source_path: '/pictures/05-erd/split' }, { project: sources.name }, unknown],
      // A file the hub did not read, of which the drawing holds only the hub's warning.
      [{ part: 'own', items: ['T-1'], source_text: '-- T-1 users\nCREATE TABLE users (id INTEGER PRIMARY KEY);\n', source_path: 'db/zz.sql' }, { project: sources.name }, unknown],
      // A drawing of one file, and one whose elements name no file.
      [{ items: ['TBL-169'], source_text: SQL_TEXT, source_path: 'db/other.sql' }, { project: sources.name }, unknown],
      [{ stage: '01-domain', items: ['CTX-038'], source_text: '### CTX-038 Review\n', source_path: DOMAIN_FILE }, {}, unknown],
      // Stage 03 and 08 draw the file at the diagram's key.
      [{ stage: '03-user-flow', items: ['FL-003'], source_text: FL3_TEXT, source_path: flow('FL-020') }, {}, unknown],
      [{ stage: '08-screen-states', items: ['SCR-144'], source_text: SCR_TEXT, source_path: 'docs/08-screens/SCR-145.md' }, {}, unknown],
    ]) {
      const refused = await propose({ ...erdProposal(), ...body }, options);
      const where = `${body.stage ?? '05-erd'} ${body.source_path ?? 'no path'}`;
      assert.deepEqual([refused.status, refused.json.code, refused.json.field, refused.json.detail], [400, 'invalid_request', 'source_path', detail], where);
      assert.equal(refused.text.includes(body.source_text.trim().split('\n')[0]), false, where);
    }
    assert.deepEqual([count('change_sets'), count('comment_threads')], [sets, threads]);
    // On stage 03 the path that names the diagram's key is taken.
    clock = START + 3 * MINUTE;
    const named = await propose(flowProposal({ source_text: FL3_PROPOSED, source_path: FL3 }));
    assert.deepEqual([named.status, named.json.changes], [201, FL3_CHANGES]);
  });

  test('with source_text on stage 05, NEXUS reads the SQL as the pinned hub does, and the differences become changes (TASK-466)', async () => {
    clock = START + 3 * MINUTE;
    // Each edit of the schema took place, so that a change of db/nexus.sql cannot quietly leave one out.
    for (const part of ['CREATE TABLE idempotency_keys (', 'REFERENCES diagrams (id)', 'bytes        BIGINT,', 'CREATE TABLE agent_notes']) {
      assert.ok(SQL_PROPOSED.includes(part), part);
    }
    assert.equal(SQL_PROPOSED.includes('CREATE TABLE restore_rehearsals'), false);
    const answer = await sourceProposal({ source_text: SQL_PROPOSED });
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.source_text, answer.json.items, answer.json.changes], [true, ['TBL-169'], SQL_CHANGES]);
    assert.equal(JSON.parse(setRow(lastSet()).detail).source_text, SQL_PROPOSED);
    // The schema as it is makes no change, and neither do a column's type, a comment or a statement the hub passes over.
    for (const text of [SQL_TEXT, SQL_TEXT.replace('  bytes        INTEGER,\n', '  bytes        BIGINT, -- in bytes\n'), `${SQL_TEXT}CREATE VIEW v AS SELECT 1;\n`]) {
      const same = await sourceProposal({ source_text: text });
      assert.deepEqual([same.status, same.json.changes], [201, []]);
    }
    // A table keyed by the project's own ID prefix, which the drawing's tables have, keeps its key. The file the hub
    // did not read is not one of the drawing's files, so no source_path is needed, and its warning stays.
    const own = await sourceProposal({ part: 'own', items: ['T-1'], source_text: '-- T-1 members\nCREATE TABLE members (id INTEGER PRIMARY KEY);\n' });
    assert.deepEqual([own.status, own.json.changes], [201, [{ op: 'rename', element: 'T-1', name: 'members', target: null }]]);
  });

  test('with source_text on stage 07, NEXUS reads the YAML as the pinned hub does: a moved screen moves its line (TASK-466)', async () => {
    clock = START + 3 * MINUTE;
    assert.ok(YAML_PROPOSED.includes('\n            - id: SCR-146\n              name: Changes since confirmation\n'));
    const answer = await sourceProposal({ stage: '07-sitemap', items: ['SCR-146'], source_text: YAML_PROPOSED });
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.items, answer.json.changes], [['SCR-146'], YAML_CHANGES]);
    const same = await sourceProposal({ stage: '07-sitemap', items: ['SCR-146'], source_text: `${YAML_TEXT}# a comment\n` });
    assert.deepEqual([same.status, same.json.changes], [201, []]);
  });

  test('SQL that reads no table, YAML that reads no screen or does not read, get invalid_request on source_text (TASK-466)', async () => {
    const sets = count('change_sets');
    const sitemapAt = (text) => ({ stage: '07-sitemap', items: ['SCR-146'], source_text: text });
    for (const [body, detail] of [
      [{ source_text: 'INSERT INTO request_keys VALUES (1);\nCREATE VIEW v AS SELECT 1;\n' }, 'source_text reads no table'],
      [sitemapAt('# no screen here\n---\n'), 'source_text reads no screen'],
      [sitemapAt('- id: SCR-146\n  name: a : b\n'), 'source_text does not draw at its line 2'],
      [sitemapAt('- id: SCR-146\n\tname: tabbed\n'), 'source_text does not draw at its line 2'],
      [sitemapAt('- id: SCR-146\n  name: &anchor x\n'), 'source_text does not draw at its line 2'],
      [sitemapAt('- id: SCR-146\n  name: "\\ud800"\n'), 'source_text does not draw at its line 2'],
    ]) {
      const refused = await sourceProposal(body);
      assert.deepEqual([refused.status, refused.json.code, refused.json.field, refused.json.detail], [400, 'invalid_request', 'source_text', detail]);
      assert.equal(refused.text.includes(body.source_text.trim().split('\n')[1] ?? body.source_text), false);
    }
    assert.equal(count('change_sets'), sets);
  });

  test('stage 09, and a stage or diagram with no drawn picture, are refused, and nothing is written (SPEC-018)', async () => {
    const sets = count('change_sets');
    const threads = count('comment_threads');
    const mockup = await propose(flowProposal({ stage: '09-mockup', items: ['TOKEN-1'] }));
    assert.deepEqual([mockup.status, mockup.json.code, mockup.json.field], [400, 'invalid_request', 'stage']);
    for (const stage of ['02-prd', '06-api', '14-later']) {
      const refused = await propose(flowProposal({ stage }));
      assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', 'stage'], stage);
    }
    const refusals = [
      // The sitemap never drew, by items and named.
      [flowProposal({ stage: '07-sitemap', items: ['SCR-142'] }), {}],
      [flowProposal({ stage: '07-sitemap', items: ['SCR-142'], diagram: idOf('dg', sitemap.id) }), {}],
      // A stage shown as its item table, by items and named; and a stage that drew nothing.
      [flowProposal({ part: '', stage: '08-screen-states', items: ['SCR-144'] }), { project: 'bare' }],
      [flowProposal({ part: '', stage: '08-screen-states', items: ['SCR-144'], diagram: idOf('dg', bareItems.id) }), { project: 'bare' }],
      [erdProposal({ part: '' }), { project: 'bare' }],
    ];
    for (const [body, options] of refusals) {
      const refused = await propose(body, options);
      assert.deepEqual([refused.status, refused.json.code], [409, 'not_drawn'], JSON.stringify(body));
    }
    assert.equal(count('change_sets'), sets);
    assert.equal(count('comment_threads'), threads);
  });

  test('items pick the one diagram that holds them all; otherwise diagram_ambiguous names the diagrams, and an unheld item is not found', async () => {
    clock = START + 4 * MINUTE;
    const both = await propose(flowProposal({ items: ['TERM-300'] }));
    assert.deepEqual([both.status, both.json.code, both.json.diagrams], [409, 'diagram_ambiguous', [idOf('dg', flow20.id), idOf('dg', flow21.id)]]);
    // No single diagram holds FL-003 and FL-020: the union, in the stage's order.
    const apart = await propose(flowProposal({ items: ['FL-020', 'FL-003'] }));
    assert.deepEqual([apart.status, apart.json.code, apart.json.diagrams], [409, 'diagram_ambiguous', [idOf('dg', flow3.id), idOf('dg', flow20.id)]]);
    // FL-021 holds TERM-300 by an element and its own ID by its name.
    const picked = await propose(flowProposal({ items: ['TERM-300', 'FL-021'] }));
    assert.deepEqual([picked.status, picked.json.diagram, picked.json.items], [201, idOf('dg', flow21.id), ['TERM-300', 'FL-021']]);
    // Named, the diagram takes it.
    const named = await propose(flowProposal({ items: ['TERM-300'], diagram: idOf('dg', flow20.id) }));
    assert.deepEqual([named.status, named.json.diagram], [201, idOf('dg', flow20.id)]);
    // Each item that the diagram, or every diagram, does not hold is named.
    const notHeld = await propose(flowProposal({ items: ['FL-003', 'TERM-300', 'FL-404'], diagram: idOf('dg', flow3.id) }));
    assert.deepEqual([notHeld.status, notHeld.json.code, notHeld.json.items], [404, 'item_not_found', ['TERM-300', 'FL-404']]);
    const nowhere = await propose(erdProposal({ items: ['TBL-146', 'TBL-999', 'TBL-998'] }));
    assert.deepEqual([nowhere.status, nowhere.json.code, nowhere.json.items], [404, 'item_not_found', ['TBL-999', 'TBL-998']]);
    // An element drawn as unreadable holds no item, by the items or by the diagram.
    const unreadable = await propose(erdProposal({ items: ['TBL-146', 'TBL-160'] }));
    assert.deepEqual([unreadable.status, unreadable.json.code, unreadable.json.items], [404, 'item_not_found', ['TBL-160']]);
    const namedUnreadable = await propose(erdProposal({ items: ['TBL-160'], diagram: idOf('dg', erd.id) }));
    assert.deepEqual([namedUnreadable.status, namedUnreadable.json.code, namedUnreadable.json.items], [404, 'item_not_found', ['TBL-160']]);
  });

  test('a removed diagram takes no proposal: named, through its thread, or through its items (SPEC-027, note 6)', async () => {
    const sets = count('change_sets');
    const named = await propose(flowProposal({ items: ['TERM-301'], diagram: idOf('dg', removedFlow.id) }));
    assert.deepEqual([named.status, named.json.code], [404, 'diagram_not_found']);
    const { id } = waiting(removedFlow, { target: 'diagram' });
    const viaThread = await propose(flowProposal({ items: ['TERM-301'], comment: id }));
    assert.deepEqual([viaThread.status, viaThread.json.code], [404, 'diagram_not_found']);
    for (const items of [['TERM-301'], ['FL-009']]) {
      const unheld = await propose(flowProposal({ items }));
      assert.deepEqual([unheld.status, unheld.json.code, unheld.json.items], [404, 'item_not_found', items]);
    }
    // A diagram of another stage or part, or of another project, is not found either.
    for (const [body, options] of [
      [flowProposal({ diagram: idOf('dg', erd.id) }), {}],
      [erdProposal({ part: '', diagram: idOf('dg', erd.id) }), {}],
      [erdProposal({ part: '', diagram: idOf('dg', erd.id) }), { project: 'bare' }],
      [erdProposal({ diagram: 'dg_zzzzzzzzzzzz' }), {}],
    ]) {
      const refused = await propose(body, options);
      assert.deepEqual([refused.status, refused.json.code], [404, 'diagram_not_found'], JSON.stringify(body));
    }
    assert.equal(count('change_sets'), sets);
  });

  test('a commit other than the drawing\'s version is document_changed, unless the diagram showed the same drawing at it', async () => {
    clock = START + 5 * MINUTE;
    for (const commit of [commits[0], commits[1], 'a'.repeat(40)]) {
      const refused = await propose(erdProposal({ commit }));
      assert.deepEqual(
        [refused.status, refused.json.code, refused.json.drawing, refused.json.version],
        [409, 'document_changed', idOf('dw', erd.drawing), commits[2]],
      );
    }
    for (const commit of [commits[2], commits[3]]) {
      const taken = await propose(erdProposal({ commit }));
      assert.deepEqual([taken.status, taken.json.drawing, taken.json.version], [201, idOf('dw', erd.drawing), commits[2]]);
    }
  });

  test('a proposal answering a comment writes on its thread as a reply does, and keeps and releases its claim (SPEC-017, SPEC-018)', async () => {
    clock = START + 6 * MINUTE;
    const { thread, id, entry } = waiting({ id: flow3.id, drawing: flow3.drawing }, { target: 'diagram' });
    const answer = await propose(flowProposal({ comment: id, source_text: FL3_PROPOSED }));
    assert.equal(answer.status, 201);
    assert.deepEqual([answer.json.thread, answer.json.changes], [id, FL3_CHANGES]);
    assert.deepEqual(commentsOf(thread).map((row) => [row.seq, row.author, row.body]), [
      [1, 'owner', 'Should this table keep its last use?'], [2, 'agent', 'Add the withdrawal.'],
    ]);
    assert.deepEqual(threadRow(thread).waits_on, 'owner');
    assert.deepEqual(threadEntries(thread), ['agent comment done', 'owner question open']);
    assert.deepEqual(proposalEntries(lastSet()), ['owner proposal open']);
    assert.deepEqual(claimsOf(entry), [{ session: S1, release_reason: 'done' }]);
    // A second proposal on the thread, which now waits on the owner, keeps it there and claims nothing.
    const again = await propose(flowProposal({ comment: id, diagram: idOf('dg', flow3.id) }));
    assert.deepEqual([again.status, again.json.thread, again.json.changes], [201, id, []]);
    assert.equal(commentsOf(thread).length, 3);
    assert.deepEqual(threadEntries(thread), ['agent comment done', 'owner question open']);
  });

  test('a thread another session claims gets claimed; a closed, unknown or other stage\'s thread is refused; nothing is written', async () => {
    clock = START + 7 * MINUTE;
    const { thread, id, entry } = waiting(erd);
    assert.equal((await claim(id, S2)).status, 200);
    const sets = count('change_sets');
    const refused = await propose(erdProposal({ comment: id }));
    assert.deepEqual([refused.status, refused.json.code, refused.json.session], [409, 'claimed', S2]);
    assert.equal(count('change_sets'), sets);
    assert.equal(commentsOf(thread).length, 1);
    // The session that holds it proposes.
    const held = await propose(erdProposal({ comment: id }), { session: S2 });
    assert.equal(held.status, 201);
    assert.deepEqual(claimsOf(entry), [{ session: S2, release_reason: 'done' }]);
    // Closed, unknown, on another stage, or with another diagram named.
    const closed = waiting(erd);
    s.closeThread(closed.thread);
    threadChanged(db, { project: space.id, thread: closed.thread, time: TIME });
    const after = count('change_sets');
    const shut = await propose(erdProposal({ comment: closed.id }));
    assert.deepEqual([shut.status, shut.json.code], [409, 'thread_closed']);
    for (const body of [erdProposal({ comment: 'nc_zzzzzzzzzzzz' }), flowProposal({ comment: id }), erdProposal({ part: '', comment: id })]) {
      const unknown = await propose(body);
      assert.deepEqual([unknown.status, unknown.json.code], [404, 'comment_not_found'], JSON.stringify(body));
    }
    const other = await propose(erdProposal({ comment: id, diagram: idOf('dg', flow3.id) }));
    assert.deepEqual([other.status, other.json.code, other.json.field], [400, 'invalid_request', 'diagram']);
    assert.equal(count('change_sets'), after);
  });

  test('withdrawing cancels a proposed change set and takes it off the owner\'s to-do; again, changed false (SPEC-018)', async () => {
    clock = START + 8 * MINUTE;
    const made = await propose(erdProposal({ items: ['TBL-147'], change: 'Rename project_spaces to spaces.' }));
    const set = lastSet();
    const thread = lastThread();
    clock = START + 9 * MINUTE;
    const answer = await withdraw(made.json.id);
    assert.equal(answer.status, 200);
    assert.deepEqual(answer.json, { proposal: { ...made.json, state: 'cancelled', decided_at: at(clock) }, changed: true });
    assert.deepEqual(proposalEntries(set), ['owner proposal withdrawn']);
    // The thread stays as it is, with its question.
    assert.deepEqual([threadRow(thread).state, threadRow(thread).waits_on, commentsOf(thread).length], ['open', 'owner', 1]);
    assert.deepEqual(threadEntries(thread), ['owner question open']);
    clock = START + 10 * MINUTE;
    const again = await withdraw(made.json.id);
    assert.deepEqual([again.status, again.json], [200, { proposal: answer.json.proposal, changed: false }]);
    assert.deepEqual(await getJson(`/api/spaces/${space.name}/proposals/${made.json.id}`), answer.json.proposal);
  });

  test('an answered proposal gets change_set_state, a direct edit or unknown ID proposal_not_found, and a removed diagram\'s is withdrawn', async () => {
    clock = START + 11 * MINUTE;
    for (const state of ['accepted', 'rejected']) {
      const made = await propose(erdProposal());
      s.setChangeSet(lastSet(), { state });
      const refused = await withdraw(made.json.id);
      assert.deepEqual([refused.status, refused.json.code, refused.json.state], [409, 'change_set_state', state]);
    }
    const reflected = await propose(erdProposal());
    s.setChangeSet(lastSet(), { reflectedDrawing: erd.drawing });
    const done = await withdraw(reflected.json.id);
    assert.deepEqual([done.status, done.json.code, done.json.state], [409, 'change_set_state', 'reflected']);
    const edit = s.changeSet(space, erd);
    for (const [id, options] of [[idOf('np', edit), {}], ['np_zzzzzzzzzzzz', {}], [reflected.json.id, { project: 'bare' }]]) {
      const missing = await withdraw(id, options);
      assert.deepEqual([missing.status, missing.json.code], [404, 'proposal_not_found'], id);
    }
    // A proposal stays withdrawable after its diagram is removed.
    const flowMade = await propose(flowProposal({ items: ['TERM-300'], diagram: idOf('dg', flow21.id) }));
    s.removeDiagram(flow21.id);
    const gone = await withdraw(flowMade.json.id);
    assert.deepEqual([gone.status, gone.json.changed, gone.json.proposal.state], [200, true, 'cancelled']);
    s.removeDiagram(flow21.id, false);
  });

  test('withdrawing while the thread waits on the agent keeps its comment entry\'s claim, or gets claimed', async () => {
    clock = START + 12 * MINUTE;
    const made = await propose(erdProposal());
    const thread = lastThread();
    // The owner answers the proposal's thread, which then waits on the agent.
    s.comment(thread, { author: 'owner', body: 'Not yet.' });
    threadChanged(db, { project: space.id, thread, time: TIME });
    const entry = openEntry('comment', thread);
    assert.equal((await claim(idOf('nc', thread), S2)).status, 200);
    const refused = await withdraw(made.json.id);
    assert.deepEqual([refused.status, refused.json.code, refused.json.session], [409, 'claimed', S2]);
    assert.equal(setRow(lastSet()).state, 'proposed');
    const held = await withdraw(made.json.id, { session: S2 });
    assert.deepEqual([held.status, held.json.changed], [200, true]);
    // The comment entry stays open and claimed: the agent still answers the owner.
    assert.deepEqual(claimsOf(entry), [{ session: S2, release_reason: null }]);
    assert.deepEqual(threadEntries(thread), ['owner question done', 'agent comment open']);
  });

  test('refuses an unknown project or part, a discrepancy, and a request out of form, naming the field and never its value', async () => {
    const sets = count('change_sets');
    const project = await propose(erdProposal(), { project: 'nowhere' });
    assert.deepEqual([project.status, project.json.code], [404, 'project_not_found']);
    const part = await propose(erdProposal({ part: 'other' }));
    assert.deepEqual([part.status, part.json.code], [404, 'part_not_found']);
    const discrepancy = await propose(erdProposal({ discrepancy: 'nd_3k7m1q9r2s4t' }));
    assert.deepEqual([discrepancy.status, discrepancy.json.code], [404, 'discrepancy_not_found']);
    const withdrawn = await withdraw('np_3k7m1q9r2s4t', { project: 'nowhere' });
    assert.deepEqual([withdrawn.status, withdrawn.json.code], [404, 'project_not_found']);
    const secretish = 'value-that-must-not-come-back';
    const refusals = [
      [erdProposal({ extra: 1 }), 'invalid_request', 'body'],
      [{ ...erdProposal(), part: undefined }, 'invalid_request', 'part'],
      [erdProposal({ part: secretish.toUpperCase() }), 'invalid_request', 'part'],
      [{ ...erdProposal(), stage: undefined }, 'invalid_request', 'stage'],
      [{ ...erdProposal(), items: undefined }, 'invalid_request', 'items'],
      [erdProposal({ items: [] }), 'invalid_request', 'items'],
      [erdProposal({ items: ['TBL-146', 'TBL-146'] }), 'invalid_request', 'items'],
      [erdProposal({ items: [secretish] }), 'invalid_request', 'items'],
      [erdProposal({ items: Array.from({ length: 51 }, (_, n) => `TBL-${n}`) }), 'invalid_request', 'items'],
      [erdProposal({ adds: [] }), 'invalid_request', 'adds'],
      [erdProposal({ adds: 'TERM-1' }), 'invalid_request', 'adds'],
      [{ ...erdProposal(), reason: undefined }, 'invalid_request', 'reason'],
      [erdProposal({ reason: ' \n ' }), 'invalid_request', 'reason'],
      [erdProposal({ change: 3 }), 'invalid_request', 'change'],
      [erdProposal({ change: 'x'.repeat(4001) }), 'text_too_long', 'change', 4000],
      [erdProposal({ reason: 'x'.repeat(4001) }), 'text_too_long', 'reason', 4000],
      [erdProposal({ source_text: '' }), 'invalid_request', 'source_text'],
      [erdProposal({ source_text: 'x\uD800' }), 'invalid_request', 'source_text'],
      [erdProposal({ source_text: 'x'.repeat(1_000_001) }), 'text_too_long', 'source_text', 1_000_000],
      [erdProposal({ source_path: 'db/nexus.sql' }), 'invalid_request', 'source_text'],
      [erdProposal({ source_text: 'x', source_path: '' }), 'invalid_request', 'source_path'],
      [erdProposal({ source_text: 'x', source_path: `${secretish}${'x'.repeat(301)}` }), 'invalid_request', 'source_path'],
      [erdProposal({ source_text: 'x', source_path: 5 }), 'invalid_request', 'source_path'],
      [erdProposal({ source_text: 'x', source_path: ['db/nexus.sql'] }), 'invalid_request', 'source_path'],
      [erdProposal({ source_text: 'x', source_path: `${secretish}\uD800` }), 'invalid_request', 'source_path'],
      [erdProposal({ diagram: secretish }), 'invalid_request', 'diagram'],
      [erdProposal({ commit: 'abc' }), 'invalid_request', 'commit'],
      [erdProposal({ comment: secretish }), 'invalid_request', 'comment'],
      [erdProposal({ discrepancy: secretish }), 'invalid_request', 'discrepancy'],
    ];
    for (const [body, code, field, limit] of refusals) {
      const refused = await propose(JSON.parse(JSON.stringify(body)));
      const where = `${JSON.stringify(body).slice(0, 80)} → ${code} ${field}`;
      assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, code, field], where);
      if (limit !== undefined) assert.equal(refused.json.limit, limit, where);
      assert.equal(refused.text.includes(secretish), false, where);
    }
    const made = await propose(erdProposal());
    const notEmpty = await withdraw(made.json.id, { body: { reason: 'x' } });
    assert.deepEqual([notEmpty.status, notEmpty.json.code, notEmpty.json.field], [400, 'invalid_request', 'body']);
    // Every write needs its session label and its request key.
    for (const send of [(options) => propose(erdProposal(), options), (options) => withdraw(made.json.id, options)]) {
      for (const [options, field] of [[{ session: null }, 'Nexus-Session'], [{ session: 'has space' }, 'Nexus-Session'], [{ key: null }, 'Idempotency-Key']]) {
        const refused = await send(options);
        assert.deepEqual([refused.status, refused.json.code, refused.json.field], [400, 'invalid_request', field]);
        assert.equal(refused.text.includes('has space'), false);
      }
    }
    assert.equal(count('change_sets'), sets + 1);
    assert.equal(setRow(lastSet()).state, 'proposed');
  });

  test('a request key sent again answers the first answer and writes nothing; with another body it is refused (rule 3)', async () => {
    clock = START + 13 * MINUTE;
    const key = `"${newId('nw')}"`;
    const first = await propose(erdProposal({ change: 'Once.' }), { key });
    const sets = count('change_sets');
    const again = await propose(erdProposal({ change: 'Once.' }), { key });
    assert.deepEqual([again.status, again.json], [first.status, first.json]);
    assert.equal(count('change_sets'), sets);
    const reused = await propose(erdProposal({ change: 'Twice.' }), { key });
    assert.deepEqual([reused.status, reused.json.code], [409, 'request_key_reused']);
    const own = `"${newId('nw')}"`;
    const done = await withdraw(first.json.id, { key: own });
    const repeated = await withdraw(first.json.id, { key: own });
    assert.deepEqual([repeated.status, repeated.json], [done.status, done.json]);
    const other = await withdraw(first.json.id, { key: own, body: { x: 1 } });
    assert.deepEqual([other.status, other.json.code], [409, 'request_key_reused']);
  });

  test('refuses a body that is not JSON or too large', async () => {
    const made = await propose(erdProposal());
    for (const [action, path] of [
      ['makeProposal', `/api/spaces/${space.name}/proposals`],
      ['withdrawProposal', `/api/spaces/${space.name}/proposals/${made.json.id}/withdraw`],
    ]) {
      const typed = await write(action, path, null, { type: 'text/plain', raw: '{}' });
      assert.deepEqual([typed.status, typed.json.code], [415, 'json_required']);
      const headers = { ...s.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1, 'Idempotency-Key': `"${newId('nw')}"` };
      const { answers } = await exchange(server.port, [head('POST', path, { ...headers, 'Content-Length': 2 * MiB + 1 })]);
      assert.equal(answers.length, 1);
      responses.note(action, answers[0]);
      assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 2 * MiB]);
    }
  });

  test('a request without a live agent credential gets access_missing, and the owner\'s sign-in agent_only', async () => {
    const made = await propose(erdProposal());
    for (const send of [(options) => propose(erdProposal(), options), (options) => withdraw(made.json.id, options)]) {
      const none = await send({ headers: {} });
      assert.deepEqual([none.status, none.json.code], [401, 'access_missing']);
      const owner = await send({ headers: { 'Cf-Access-Jwt-Assertion': local.token() } });
      assert.deepEqual([owner.status, owner.json.code], [403, 'agent_only']);
    }
  });

  test('answers internal when the store fails, and changes nothing', async (t) => {
    const store = testStore(t);
    const failing = seed(store);
    const broken = failing.project('broken');
    const where = failing.diagram(broken);
    store.prepare("INSERT INTO elements (drawing_id, element_key, trace_id, kind, name) VALUES (?, 'TBL-146', 'TBL-146', 'table', 'x')").run(where.drawing);
    const thread = failing.thread(where, { author: 'agent' });
    const proposed = failing.changeSet(broken, where, { origin: 'proposal', threadId: thread });
    // A store whose change-set statements cannot be prepared, as when the disk fails.
    const failingStore = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('INSERT INTO change_sets') || sql.includes("SET state = 'cancelled'")) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const other = await startServer({ store: failingStore, gate: local.gate, routes: ROUTES });
    t.after(() => other.close());
    const headers = { ...failing.agent.headers, 'Content-Type': 'application/json', 'Nexus-Session': S1 };
    const sent = [
      ['makeProposal', '/api/spaces/broken/proposals', { part: '', stage: '05-erd', items: ['TBL-146'], reason: 'x', change: 'y' }],
      ['withdrawProposal', `/api/spaces/broken/proposals/${idOf('np', proposed)}/withdraw`, {}],
    ];
    for (const [action, path, body] of sent) {
      const answer = responses.note(action, await other.send({
        method: 'POST', path, headers: { ...headers, 'Idempotency-Key': `"${newId('nw')}"` }, body: JSON.stringify(body),
      }));
      assert.deepEqual([answer.status, answer.json.code], [500, 'internal']);
    }
    const lines = await other.logged(2);
    assert.deepEqual(lines.map((line) => line.error), ['Error', 'Error']);
    assert.equal(other.logText().includes('the store failed'), false);
    assert.equal(store.prepare('SELECT count(*) AS n FROM change_sets').get().n, 1);
    assert.equal(store.prepare("SELECT state FROM change_sets").get().state, 'proposed');
    assert.equal(store.prepare('SELECT count(*) AS n FROM request_keys').get().n, 0);
  });

  test('logs one line per request with its sender, and never a text, a source_text, a session or the data folder (rule 5)', async () => {
    const lines = (await server.logged(20)).filter((line) => ACTIONS.includes(line.action));
    assert.ok(lines.length >= 20);
    for (const line of lines) {
      assert.match(line.traceId, TRACE_ID);
      assert.ok([s.agent.name, 'unknown', 'owner'].includes(line.sender));
    }
    const text = server.logText();
    for (const value of [S1, S2, 'Rename agent_credentials', 'The owner asked', 'Agent withdraws the proposal', 'CREATE TABLE agent_keys',
      'CREATE TABLE agent_notes', 'Agent sessions', 'tabbed', 'idempotency_keys',
      'value-that-must-not-come-back', folder, folder.replaceAll('\\', '/'), JSON.stringify(folder).slice(1, -1)]) {
      assert.equal(text.includes(value), false, value);
    }
  });

  test('answer every response API-256 and API-257 list', () => {
    for (const action of ACTIONS) responses.assertEvery(action);
  });

  test('touch the tables their x-corthex.tables list, change only tables SPEC-018 feeds, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'makeProposal');
    checkTables(recorder, 'withdrawProposal');
    checkLayer(recorder);
  });
});
