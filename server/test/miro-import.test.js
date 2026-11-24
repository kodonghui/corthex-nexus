// The Miro import (TASK-453; API-292, SPEC-041, REQ-047, rule 5): a Miro board export of up to 5 MiB, read from the
// owner's upload only, becomes the owner's sticky notes and links in the open workshop, all or none. Every response
// API-292 lists, the rules the coordinator chose (see the server README's "Miro import"), the file as hostile input,
// the tables the import touches (note 23) and its log lines.
//
// The fixture is built from the examples of Miro's REST API v2 reference, read on 2026-11-24: "Get items on board"
// (the page and the items), "Get sticky note item", "Get frame item" and "Get connectors", and the Web SDK's sticky
// note, whose example content is HTML. The README names the pages and the fields whose form they leave undocumented.

import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { COLOURS, ITEMS, KIND_STEPS, NOTE, readMiroBoard, textOf } from '../src/miro.js';
import { ROUTES } from '../src/routes.js';
import { openStore } from '../src/store.js';
import { LIMITS } from '../src/workshop.js';
import { responseRecord } from './responses.js';
import { seed } from './seed.js';
import { exchange, head, localGate, newId, startServer, testStore, TRACE_ID } from './support.js';
import { checkLayer, checkTables, recordTables } from './tables.js';

const JSON_TYPE = { 'Content-Type': 'application/json' };
const MiB = 1024 * 1024;
const START = Date.parse('2026-11-24T03:00:00.000Z');
const at = (minutes) => new Date(START + minutes * 60 * 1000).toISOString();

// Miro's IDs are numbers of 19 digits kept as text: ParentLinksEnvelope.id's example, and others after the sticky
// note's example ID.
const FRAME_2 = '3074457362577955300';
const miro = (n) => String(3458764517517819000n + BigInt(n));
const USER = { id: '3458764517517852417', type: 'user' };
const STAMPS = { createdAt: '2022-03-30 17:26:50+00:00', createdBy: USER, modifiedAt: '2022-03-30 17:26:50+00:00', modifiedBy: USER };

// A sticky note as "Get sticky note item" documents it; fillColor left out when colour is undefined, and parent only
// for a note in a frame, whose x and y are then the frame's (relativeTo parent_top_left).
function sticky(id, content, colour, x, y, parent) {
  return {
    id,
    type: 'sticky_note',
    data: { content, shape: 'square' },
    style: { ...(colour === undefined ? {} : { fillColor: colour }), textAlign: 'center', textAlignVertical: 'top' },
    position: { x, y, origin: 'center', relativeTo: parent === undefined ? 'canvas_center' : 'parent_top_left' },
    geometry: { width: 320, height: 60 },
    ...(parent === undefined ? {} : { parent: { id: parent } }),
    ...STAMPS,
  };
}

// A frame as "Get frame item" documents it.
const frame = (id, title, x = 100, y = 100) => ({
  id,
  type: 'frame',
  data: { title, format: 'custom', type: 'freeform', showContent: true },
  style: { fillColor: '#ffffffff' },
  position: { x, y, origin: 'center', relativeTo: 'canvas_center' },
  geometry: { width: 320, height: 60 },
  ...STAMPS,
});

// A connector as "Get connectors" documents it. Its REST type is undocumented; the Web SDK's is "connector".
const connector = (id, start, end) => ({
  id,
  type: 'connector',
  ...(start === undefined ? {} : { startItem: { id: start } }),
  ...(end === undefined ? {} : { endItem: { id: end } }),
  shape: 'curved',
  captions: [{ content: '<p>Caption text</p>', position: '50%' }],
  style: { strokeColor: '#2d9bf0', strokeWidth: '2.0' },
  ...STAMPS,
});

// The page "Get items on board" answers: { data, total, size, cursor, limit }.
const page = (data) => ({ data, total: data.length, size: data.length, cursor: 'MzQ1ODc2NDUyMjQ5MDA4Mjg5NX4=', limit: 10 });

// The notes of the documented board: each with its Miro item and the note it becomes, in the file's order. A note's x
// and y in the NEXUS frame are its Miro place moved by its step's smallest x and y.
const F1B = miro(901);
const F_PLAIN = miro(902);
const F1A = miro(903);
const F_TEN = miro(904);
const NOTES = [
  // The Web SDK's example sticky note, in its default colour.
  [sticky(miro(1), '<p>This is a sticky note. It looks just like the actual paper one.</p>', 'light_yellow', 100, 100),
    { step: '5', kind: 'actor', text: 'This is a sticky note. It looks just like the actual paper one.', x: 0, y: 0 }],
  // "Get sticky note item"'s example content.
  [sticky(miro(2), 'Hello', 'orange', 100, 100), { step: '1', kind: 'event', text: 'Hello', x: 60, y: 70 }],
  // A frame naming step 2 takes the note whatever its kind.
  [sticky(miro(3), '<p>Payment provider</p>', 'orange', 160, 120, FRAME_2), { step: '2', kind: 'event', text: 'Payment provider', x: 660, y: 0 }],
  [sticky(miro(4), 'Card network', 'pink', -500, 300), { step: '2', kind: 'external-system', text: 'Card network', x: 0, y: 180 }],
  [sticky(miro(5), '<p>Credential <strong>revoked</strong></p>', 'light_pink', 10, 20, F1B),
    { step: '1-b', kind: 'external-system', text: 'Credential revoked', x: 0, y: 0 }],
  [sticky(miro(6), '<p>When credential revoked,<br>notify owner</p>', 'violet', 0, 0),
    { step: '8', kind: 'policy', text: 'When credential revoked, notify owner', x: 0, y: 40 }],
  [sticky(miro(7), 'Credential list', 'light_green', 300, -40), { step: '8', kind: 'read-model', text: 'Credential list', x: 300, y: 0 }],
  // A frame that names no step leaves the note to its kind: gray is "note", which goes to step 0.
  [sticky(miro(8), 'Open question', 'gray', 5, 5, F_PLAIN), { step: '0', kind: NOTE, text: 'Open question', x: 15, y: 25 }],
  [sticky(miro(9), 'Unsorted', undefined, -10, 50), { step: '0', kind: NOTE, text: 'Unsorted', x: 0, y: 70 }],
  // A parent that is no frame names no step.
  [sticky(miro(10), 'Side note', 'cyan', 100, -20, miro(2)), { step: '0', kind: NOTE, text: 'Side note', x: 110, y: 0 }],
  [sticky(miro(11), 'Who may revoke?', 'red', 900, 900), { step: '4', kind: 'hotspot', text: 'Who may revoke?', x: 0, y: 0 }],
  [sticky(miro(12), 'Revoke credential', 'blue', 200, 200), { step: '3', kind: 'command', text: 'Revoke credential', x: 150, y: 140 }],
  [sticky(miro(13), 'Credential', 'yellow', -7.5, 3.25), { step: '6', kind: 'aggregate', text: 'Credential', x: 0, y: 0 }],
  // "1-a", the mockup's label of step 1.
  [sticky(miro(14), 'Snapshot accepted', 'orange', 40, 30, F1A), { step: '1', kind: 'event', text: 'Snapshot accepted', x: 0, y: 0 }],
  // A note left empty is skipped.
  [sticky(miro(15), '<p>&nbsp;</p><p><br></p>', 'orange', 0, 0), null],
  // "10 ideas" names no step: 1 is followed by a digit.
  [sticky(miro(16), 'Revoke all', 'dark_blue', 50, 60, F_TEN), { step: '3', kind: 'command', text: 'Revoke all', x: 0, y: 0 }],
];
// The links of the documented board, by the Miro IDs of their notes.
const LINKS = [[miro(2), miro(4)], [miro(4), miro(2)], [miro(6), miro(12)]];

function documentedBoard() {
  return page([
    frame(FRAME_2, 'Step 2 · External systems'),
    frame(F1B, '1-b 타임라인'),
    frame(F_PLAIN, 'Sample frame title'),
    frame(F1A, '1-a 이벤트'),
    frame(F_TEN, '10 ideas'),
    ...NOTES.map(([item]) => item),
    connector(miro(101), miro(2), miro(4)),
    connector(miro(102), miro(4), miro(2)),
    // Again in the same direction, to itself, to a frame, to an empty note and without a start: skipped.
    connector(miro(103), miro(2), miro(4)),
    connector(miro(104), miro(2), miro(2)),
    connector(miro(105), miro(2), FRAME_2),
    connector(miro(106), miro(2), miro(15)),
    connector(miro(107), undefined, miro(4)),
    connector(miro(108), miro(6), miro(12)),
    // Items of other types, with their documented examples: skipped, and nothing they name is fetched.
    { id: miro(201), type: 'text', data: { content: 'Hello' }, position: { x: 0, y: 0 }, ...STAMPS },
    { id: miro(202), type: 'shape', data: { content: 'Hello', shape: 'rectangle' }, position: { x: 0, y: 0 }, ...STAMPS },
    {
      id: miro(203),
      type: 'image',
      data: { imageUrl: 'https://api.miro.com/v2/boards/uXjVOfjkmAk=/resources/98765467890987654?format=preview&redirect=false', title: 'Sample image title' },
      position: { x: 0, y: 0 },
    },
    {
      id: miro(204),
      type: 'embed',
      data: { url: 'https://www.youtube.com/watch?v=HlVSNEiFCBk', providerName: 'YouTube', html: '<iframe src="//cdn.embedly.com/widgets/media.html"></iframe>' },
      position: { x: 0, y: 0 },
    },
    { id: miro(205), type: 'card', data: { title: 'sample card item', description: 'sample card description' }, position: { x: 0, y: 0 } },
  ]);
}

// A board of sticky notes { content, colour, x, y, parent } and nothing else.
const notesBoard = (notes) => page(notes.map((note, index) => sticky(miro(index + 1), note.content ?? `Note ${index}`, note.colour ?? 'orange', note.x ?? 0, note.y ?? 0, note.parent)));

describe('Miro import', () => {
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
  const clean = (headers) => Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
  const call = async (action, { method = 'POST', path, headers, body }) => responses.note(action, await server.send({
    method,
    path,
    headers: clean({ ...(body === undefined ? {} : JSON_TYPE), ...headers }),
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
  }));
  const board = (name) => `/api/projects/${name}/workshop`;
  const importing = (name, body, headers = {}) => call('importMiroBoard', { path: `${board(name)}/imports`, headers: { ...owner(), ...key(), ...headers }, body });
  const read = async (name) => (await server.send({ method: 'GET', path: board(name), headers: owner() })).json;
  const problem = (answer) => [answer.status, answer.json.code];
  const refusedOn = (answer, field, code = 'invalid_request') => assert.deepEqual([answer.status, answer.json.code, answer.json.field], [400, code, field]);
  const rows = (workshop) => ({
    notes: db.prepare('SELECT * FROM sticky_notes WHERE workshop_id = ? ORDER BY id').all(workshop).map((row) => ({ ...row })),
    links: db.prepare('SELECT * FROM sticky_links WHERE workshop_id = ? ORDER BY id').all(workshop).map((row) => ({ ...row })),
  });
  // A project with a workshop opened through API-284: { space, workshop, id }.
  const opened = async () => {
    const space = s.project();
    const answer = await server.send({ method: 'POST', path: board(space.name), headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{}' });
    assert.equal(answer.status, 201);
    return { space, id: answer.json.id, workshop: Number(db.prepare('SELECT id FROM workshops WHERE project_id = ?').get(space.id).id) };
  };
  // Writes notes straight into a step, as many as count, made by the owner: their keys.
  const fill = (workshop, step, count) => {
    const insert = db.prepare("INSERT INTO sticky_notes (workshop_id, step, kind, body, x, y, made_by, created_at) VALUES (?, ?, 'event', 'n', 0, 0, 'owner', ?)");
    return Array.from({ length: count }, () => Number(insert.run(workshop, step, at(0)).lastInsertRowid));
  };
  // A note of the read, as the import makes it.
  const shown = ({ kind, text, x, y }) => ({ kind, text, x, y, made_by: 'owner', confidence: null, from_miro: true, created_at: new Date(clock.now).toISOString() });

  before(async () => {
    folder = mkdtempSync(join(tmpdir(), 'nexus-miro-'));
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

  test('imports a documented Miro export: sticky notes by colour and frame, connectors as links, all the owner\'s (SPEC-041)', async () => {
    const { space, id } = await opened();
    clock.now = Date.parse(at(5));
    const answer = await importing(space.name, documentedBoard());
    const expected = NOTES.filter(([, note]) => note !== null).map(([item, note]) => ({ miro: item.id, ...note }));
    assert.deepEqual([answer.status, answer.json], [201, { workshop: id, notes: expected.length, links: LINKS.length }]);
    const workshop = await read(space.name);
    for (const { step, notes } of workshop.steps) {
      const fields = notes.map(({ id: _id, step: _step, ...rest }) => rest);
      assert.deepEqual(fields, expected.filter((note) => note.step === step).map(shown), step);
    }
    // Each link from its connector's start to its end, by the notes' texts.
    const textOfNote = new Map(workshop.steps.flatMap((step) => step.notes).map((note) => [note.id, note.text]));
    const miroText = new Map(expected.map((note) => [note.miro, note.text]));
    assert.deepEqual(
      workshop.links.map((link) => [textOfNote.get(link.from), textOfNote.get(link.to), link.made_by]),
      LINKS.map(([from, to]) => [miroText.get(from), miroText.get(to), 'owner']),
    );
  });

  test('a colour gives its kind as the design tokens name the sticky colours, and each kind its step', () => {
    const tokens = JSON.parse(readFileSync(new URL('../../design/corthex/light.tokens.json', import.meta.url), 'utf8'));
    const named = new Set(Object.keys(tokens.corthex.sticky).filter((name) => !name.startsWith('$')));
    for (const kind of new Set(Object.values(COLOURS))) assert.ok(named.has(kind), kind);
    assert.deepEqual([...named].filter((name) => !Object.values(COLOURS).includes(name)), ['hotspot-answered']);
    // Miro's 16 sticky colours: 13 give a kind, and gray, cyan and black give "note".
    const fillColors = ['gray', 'light_yellow', 'yellow', 'orange', 'light_green', 'green', 'dark_green', 'cyan', 'light_pink', 'pink', 'violet', 'red', 'light_blue', 'blue', 'dark_blue', 'black'];
    assert.deepEqual(fillColors.filter((colour) => !Object.hasOwn(COLOURS, colour)), ['gray', 'cyan', 'black']);
    assert.deepEqual(Object.keys(COLOURS).filter((colour) => !fillColors.includes(colour)), []);
    assert.deepEqual(KIND_STEPS, { event: '1', 'external-system': '2', command: '3', hotspot: '4', actor: '5', aggregate: '6', policy: '8', 'read-model': '8', note: '0' });
    for (const [colour, kind] of [['black', NOTE], ['#ff0000', NOTE], ['ORANGE', NOTE], ['orange', 'event']]) {
      assert.equal(readMiroBoard(notesBoard([{ colour }]), 200).notes[0].kind, kind, colour);
    }
  });

  test('a frame\'s title names its step, after "Step" or "스텝" or not, in any case', () => {
    const stepOf = (title) => readMiroBoard(page([frame(FRAME_2, title), sticky(miro(1), 'n', 'orange', 0, 0, FRAME_2)]), 200).notes[0].step;
    for (const [title, step] of [
      ['0 준비', '0'], ['1-a 이벤트', '1'], ['1-b 타임라인', '1-b'], ['Step 1-B · Timeline', '1-b'], ['step 7: Bounded contexts', '7'],
      ['스텝 9 컨텍스트 표', '9'], ['  8', '8'], ['2', '2'], ['STEP3', '3'],
      // No step: the event's own step, 1.
      ['10 ideas', '1'], ['1-c', '1'], ['1a', '1'], ['Timeline 1-b', '1'], ['', '1'], [`${' '.repeat(60)}5`, '1'],
    ]) {
      assert.equal(stepOf(title), step, title);
    }
    // A title that is no text names no step.
    for (const title of [7, null, ['2'], { step: '2' }]) assert.equal(stepOf(title), '1', JSON.stringify(title));
  });

  test('the notes of each step move together so that their smallest x and y are 0, within ±1,000,000', async () => {
    const read1 = readMiroBoard(notesBoard([{ x: -250.5, y: 1e6 }, { x: 749.5, y: 1e6 + 40 }, { colour: 'red', x: 3, y: -3 }]), 200);
    assert.deepEqual(read1.notes.map(({ step, x, y }) => [step, x, y]), [['1', 0, 0], ['1', 1000, 40], ['4', 0, 0]]);
    const { space, workshop } = await opened();
    const before = rows(workshop);
    // A number JSON.parse makes Infinity passes as a number, and the place refuses it, alone or beside a finite one.
    const infinite = (xs) => JSON.stringify(notesBoard(xs.map(() => ({})))).replace(/"x":0/gu, () => `"x":${xs.shift()}`);
    for (const body of [
      notesBoard([{ x: -600_000 }, { x: 600_000 }]),
      notesBoard([{ y: -1e308 }, { y: 1e308 }]),
      infinite(['1e400']),
      infinite(['-1e400']),
      infinite(['1e400', '0']),
      infinite(['1e400', '-1e400']),
    ]) {
      refusedOn(await importing(space.name, body), 'data');
    }
    assert.equal(JSON.parse(infinite(['1e400'])).data[0].position.x, Infinity);
    // Notes far apart in different steps are each placed in their own.
    assert.equal((await importing(space.name, notesBoard([{ x: -900_000 }, { colour: 'red', x: 900_000 }]))).status, 201);
    assert.deepEqual(rows(workshop).notes.slice(before.notes.length).map((row) => [row.step, Number(row.x), Number(row.y)]), [['1', 0, 0], ['4', 0, 0]]);
  });

  test('a note\'s text is its content\'s HTML as plain text, of at most 200 characters', async () => {
    for (const [content, text] of [
      ['<p>Credential <strong>revoked</strong></p><p>by <em>the</em> owner</p>', 'Credential revoked by the owner'],
      ['<p>One<br>two<br/>three</p>', 'One two three'],
      ['<p><a href="https://example.org/a">Linked</a> <u>text</u> <s>gone</s> <b>bold</b> <i>it</i></p>', 'Linked text gone bold it'],
      ['&lt;p&gt;kept&lt;/p&gt; &amp;lt; Q&amp;A&#33; &#x1F600; &quot;&apos;', '<p>kept</p> &lt; Q&A! 😀 "\''],
      ['a&nbsp;&nbsp;b \t\n c', 'a b c'],
      // A reference to no character stays as written.
      ['&#0; &#55296; &#x110000; &#12345678; &copy;', '&#0; &#55296; &#x110000; &#12345678; &copy;'],
      // A < without its > is text.
      ['a < b and c <d', 'a < b and c <d'],
      // <pre> is no <p>; Miro escapes the tags it does not take, so none comes to this.
      ['<pre>p</pre>q', 'pq'],
    ]) {
      assert.equal(textOf(content), text, content);
    }
    const { space, workshop } = await opened();
    const ok = await importing(space.name, notesBoard([
      { content: `<p>${'é'.repeat(200)}</p>` },
      { content: '😀'.repeat(200) },
      { content: `<p><strong>${'x'.repeat(10)}</strong></p>${'<b></b>'.repeat(800)}` },
    ]));
    assert.deepEqual([ok.status, ok.json.notes], [201, 3]);
    const count = rows(workshop).notes.length;
    const secret = `Secret-${randomBytes(6).toString('hex')}`;
    const long = await importing(space.name, notesBoard([{ content: 'fine' }, { content: `<p>${secret}${'y'.repeat(200)}</p>` }]));
    assert.deepEqual([long.status, long.json.code, long.json.field, long.json.limit], [400, 'text_too_long', 'data[1].data.content', 200]);
    assert.equal(long.text.includes(secret), false);
    // Miro's content is shorter than 6000 characters.
    refusedOn(await importing(space.name, notesBoard([{ content: `<b>${'x'.repeat(5993)}</b>` }])), 'data[0].data.content');
    // 6007 UTF-16 units are 5807 characters: under Miro's limit, and a text of 200.
    const emoji = `<b>${'😀'.repeat(200)}</b>${'<i></i>'.repeat(800)}`;
    assert.deepEqual([emoji.length, [...emoji].length], [6007, 5807]);
    assert.equal((await importing(space.name, notesBoard([{ content: emoji }]))).status, 201);
    refusedOn(await importing(space.name, notesBoard([{ content: '\ud800 lone' }])), 'data[0].data.content');
    assert.equal(rows(workshop).notes.length, count + 1);
  });

  test('refuses a file that is not a Miro export, naming the field and never its value', async () => {
    const { space, workshop } = await opened();
    const before = await read(space.name);
    const secret = `Secret-${randomBytes(6).toString('hex')}`;
    const note = (fields) => ({ ...sticky(miro(1), secret, 'orange', 0, 0), ...fields });
    for (const [body, field] of [
      [{}, 'data'],
      [{ items: [note({})] }, 'data'],
      [{ data: secret }, 'data'],
      [{ data: { 0: note({}) } }, 'data'],
      [{ data: null }, 'data'],
      [{ data: Array.from({ length: ITEMS + 1 }, (_, index) => ({ id: miro(index), type: 'shape' })) }, 'data'],
      [{ data: [null] }, 'data'],
      [{ data: [[note({})]] }, 'data'],
      [{ data: [secret] }, 'data'],
      [{ data: [7] }, 'data'],
      [{ data: [{ type: 'sticky_note' }] }, 'data'],
      [{ data: [note({ id: 3458764517517819000 })] }, 'data'],
      [{ data: [note({ id: '' })] }, 'data'],
      [{ data: [note({ id: '9'.repeat(101) })] }, 'data'],
      [{ data: [{ id: miro(1) }] }, 'data'],
      [{ data: [note({ type: ['sticky_note'] })] }, 'data'],
      [{ data: [note({}), note({})] }, 'data'],
      [{ data: [{ id: miro(2), type: 'shape' }, note({ data: undefined })] }, 'data[1].data.content'],
      [{ data: [note({ data: { content: 5 } })] }, 'data[0].data.content'],
      [{ data: [note({ data: { content: [secret] } })] }, 'data[0].data.content'],
      [{ data: [note({ data: secret })] }, 'data[0].data.content'],
      [{ data: [note({ position: undefined })] }, 'data[0].position.x'],
      [{ data: [note({ position: { x: '10', y: 0 } })] }, 'data[0].position.x'],
      [{ data: [note({ position: { x: 0, y: null } })] }, 'data[0].position.y'],
      [{ data: [note({ position: [0, 0] })] }, 'data[0].position.x'],
    ]) {
      const answer = await importing(space.name, JSON.parse(JSON.stringify(body)));
      refusedOn(answer, field);
      assert.equal(answer.text.includes(secret), false, field);
    }
    for (const body of ['[]', '"data"', '{"data":', '{"data":[]}x']) refusedOn(await importing(space.name, body), 'body');
    assert.deepEqual(await read(space.name), before);
    assert.equal(rows(workshop).notes.length, 0);
    // An export without a sticky note is still one.
    assert.deepEqual((await importing(space.name, page([frame(FRAME_2, 'Step 2')]))).json, { workshop: before.id, notes: 0, links: 0 });
    assert.deepEqual((await importing(space.name, { data: [] })).json, { workshop: before.id, notes: 0, links: 0 });
  });

  test('reads the hostile file by fixed paths only: deep nesting, huge lists, prototype keys and wrong types', async () => {
    const { space, workshop } = await opened();
    // A nesting a million deep, and a list of a million numbers, where nothing is read: imported.
    const deep = `${'['.repeat(1_000_000)}${']'.repeat(1_000_000)}`;
    const nested = `{"data":[${JSON.stringify(sticky(miro(1), 'Deep', 'orange', 0, 0)).slice(0, -1)},"geometry":${deep}}],"links":${deep}}`;
    const listed = `{"data":[${JSON.stringify(sticky(miro(1), 'Long', 'orange', 0, 0)).slice(0, -1)},"geometry":[${'0,'.repeat(999_999)}0]}]}`;
    for (const body of [nested, listed]) assert.ok(Buffer.byteLength(body) < 5 * MiB);
    assert.deepEqual([(await importing(space.name, nested)).json.notes, (await importing(space.name, listed)).json.notes], [1, 1]);
    // The same nesting where an item or a field is read: refused.
    refusedOn(await importing(space.name, `{"data":[${deep}]}`), 'data');
    refusedOn(await importing(space.name, `{"data":${deep}}`), 'data');
    refusedOn(await importing(space.name, `{"data":[{"id":"1","type":"sticky_note","data":{"content":${deep}},"position":{"x":0,"y":0}}]}`), 'data[0].data.content');
    // Prototype keys are the items' own members and read as nothing else.
    const proto = [
      ['{"__proto__":{"data":[]}}', 'data'],
      ['{"data":[{"__proto__":{"id":"1","type":"sticky_note"}}]}', 'data'],
      ['{"data":[{"id":"1","type":"sticky_note","__proto__":{"data":{"content":"x"}},"position":{"x":0,"y":0}}]}', 'data[0].data.content'],
      ['{"data":[{"id":"1","type":"sticky_note","data":{"content":"x"},"position":{"__proto__":{"x":0,"y":0}}}]}', 'data[0].position.x'],
      ['{"data":[{"id":"1","type":"sticky_note","data":{"content":"x"},"position":{"x":0,"y":0},"style":{"__proto__":{"fillColor":"red"}}}]}', null],
      ['{"data":[{"id":"constructor","type":"sticky_note","data":{"content":"x"},"position":{"x":0,"y":0},"style":{"fillColor":"__proto__"}}]}', null],
      ['{"data":[{"id":"toString","type":"connector","startItem":{"id":"hasOwnProperty"},"endItem":{"id":"__proto__"}}],"constructor":{"prototype":{"polluted":true}}}', null],
    ];
    for (const [body, field] of proto) {
      const answer = await importing(space.name, body);
      if (field === null) assert.equal(answer.status, 201, body);
      else refusedOn(answer, field);
    }
    assert.equal(rows(workshop).notes.at(-1).kind, NOTE);
    assert.equal({}.polluted, undefined);
    assert.equal(Object.prototype.data, undefined);
    // Wrong types where the rules read nothing: the note goes by its kind, the connector is skipped.
    const wrong = page([
      frame(FRAME_2, 2),
      { ...sticky(miro(1), 'a', 'orange', 0, 0, FRAME_2), style: 'red' },
      { ...sticky(miro(2), 'b', 'orange', 0, 0), style: { fillColor: 5 } },
      { ...sticky(miro(3), 'c', 'red', 0, 0), parent: FRAME_2 },
      { ...sticky(miro(4), 'd', 'red', 0, 0), parent: { id: 5 } },
      { id: miro(5), type: 'connector', startItem: miro(1), endItem: { id: miro(2) } },
      { id: miro(6), type: 'connector', startItem: { id: Number(miro(1)) }, endItem: { id: miro(2) } },
      { id: miro(7), type: 'connector', startItem: [{ id: miro(1) }], endItem: { id: miro(2) } },
    ]);
    assert.deepEqual(readMiroBoard(wrong, 200), {
      notes: [
        { step: '0', kind: NOTE, text: 'a', x: 0, y: 0 },
        { step: '0', kind: NOTE, text: 'b', x: 0, y: 0 },
        { step: '4', kind: 'hotspot', text: 'c', x: 0, y: 0 },
        { step: '4', kind: 'hotspot', text: 'd', x: 0, y: 0 },
      ],
      links: [],
    });
    // 5000 items, the contract's most, are read.
    const many = page(Array.from({ length: ITEMS }, (_, index) => (index % 10 === 0
      ? sticky(miro(index), `n${index}`, ['orange', 'red', 'blue', 'yellow', 'violet'][(index / 10) % 5], index, index)
      : { id: miro(index), type: 'shape', data: { content: 'Hello' } })));
    const started = Date.now();
    assert.deepEqual((await importing(space.name, many)).json.notes, ITEMS / 10);
    assert.ok(Date.now() - started < 10_000);
  });

  test('an import is all or none: a refused one leaves the workshop exactly as it was', async () => {
    const { space, workshop } = await opened();
    // 998 notes in step 1 and 1999 links, written in one transaction.
    db.exec('BEGIN');
    const kept = fill(workshop, '1', LIMITS.stepNotes - 2);
    const link = db.prepare("INSERT INTO sticky_links (workshop_id, from_note, to_note, made_by, created_at) VALUES (?, ?, ?, 'owner', ?)");
    let made = 0;
    for (let from = 0; from < kept.length && made < LIMITS.links - 1; from += 1) {
      for (let to = from + 1; to < kept.length && made < LIMITS.links - 1; to += 1) {
        link.run(workshop, kept[from], kept[to], at(0));
        made += 1;
      }
    }
    db.exec('COMMIT');
    const before = { read: await read(space.name), rows: rows(workshop) };
    const unchanged = async () => {
      assert.deepEqual(await read(space.name), before.read);
      assert.deepEqual(rows(workshop), before.rows);
    };
    const linkedPair = (extra = []) => page([sticky(miro(1), 'a', 'red', 0, 0), sticky(miro(2), 'b', 'red', 0, 0), connector(miro(3), miro(1), miro(2)), connector(miro(4), miro(2), miro(1)), ...extra]);
    for (const [body, field, code] of [
      // Three more events would put 1001 notes in step 1.
      [notesBoard([{}, {}, {}]), 'data', 'invalid_request'],
      // Two more links would put 2001 on the board.
      [linkedPair(), 'data', 'invalid_request'],
      // A bad field late in the list.
      [page([...Array.from({ length: 4998 }, (_, index) => sticky(miro(index), `n${index}`, 'red', 0, 0)), { ...sticky(miro(4999), 'late', 'red', 0, 0), position: { x: 0 } }]), 'data[4998].position.y', 'invalid_request'],
      // A text over 200 at the end.
      [notesBoard([{ colour: 'red' }, { colour: 'blue' }, { content: 'z'.repeat(201) }]), 'data[2].data.content', 'text_too_long'],
    ]) {
      refusedOn(await importing(space.name, body), field, code);
      await unchanged();
    }
    // Up to the limits, it is taken.
    assert.deepEqual((await importing(space.name, notesBoard([{}, {}]))).json.notes, 2);
    assert.deepEqual((await importing(space.name, page([sticky(miro(1), 'a', 'red', 0, 0), sticky(miro(2), 'b', 'red', 0, 0), connector(miro(3), miro(1), miro(2))]))).json.links, 1);
    refusedOn(await importing(space.name, notesBoard([{}])), 'data');
    // Removed notes and links make room again.
    const removed = (await read(space.name)).links[0];
    assert.equal((await server.send({ method: 'DELETE', path: `${board(space.name)}/links/${removed.id}`, headers: { ...owner(), ...key() } })).status, 200);
    assert.equal((await importing(space.name, page(linkedPair().data.slice(0, 3)))).status, 201);
  });

  test('a confirmed step takes the import and stays confirmed; importing twice doubles; a retry gets the first answer', async () => {
    const { space, workshop } = await opened();
    fill(workshop, '1', 1);
    assert.equal((await server.send({ method: 'POST', path: `${board(space.name)}/steps/1/confirm`, headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{}' })).status, 200);
    const confirmedAt = (await read(space.name)).steps.find((step) => step.step === '1').confirmed_at;
    assert.notEqual(confirmedAt, null);
    const file = documentedBoard();
    const requestKey = key();
    const first = await importing(space.name, file, requestKey);
    assert.equal(first.status, 201);
    const once = rows(workshop);
    clock.now += 60_000;
    const retry = await importing(space.name, file, requestKey);
    assert.deepEqual([retry.status, retry.json], [201, first.json]);
    assert.deepEqual(rows(workshop), once);
    const second = await importing(space.name, file);
    assert.deepEqual(second.json, first.json);
    const twice = rows(workshop);
    assert.deepEqual([twice.notes.length, twice.links.length], [1 + 2 * first.json.notes, 2 * first.json.links]);
    const after = await read(space.name);
    assert.equal(after.steps.find((step) => step.step === '1').confirmed_at, confirmedAt);
    assert.equal(after.steps.find((step) => step.step === '1').notes.length, 1 + 2 * 2);
    // Each import makes rows of its own: the owner's, from Miro, without a credential or label.
    for (const row of twice.notes.slice(1)) {
      assert.deepEqual([row.made_by, row.credential_id, row.confidence, row.from_miro, row.removed_at], ['owner', null, null, 1, null]);
    }
    // A key another action took is refused.
    const taken = key();
    assert.equal((await server.send({ method: 'POST', path: `${board(space.name)}/notes`, headers: { ...JSON_TYPE, ...owner(), ...taken }, body: JSON.stringify({ step: '1', kind: 'event', text: 't', x: 0, y: 0 }) })).status, 201);
    assert.deepEqual(problem(await importing(space.name, file, taken)), [409, 'request_key_reused']);
    assert.equal(rows(workshop).notes.length, twice.notes.length + 1);
  });

  test('needs an open workshop and a project that is', async () => {
    const none = s.project();
    assert.deepEqual(problem(await importing(none.name, documentedBoard())), [409, 'workshop_closed']);
    const closed = s.project();
    s.closeWorkshop(s.workshop(closed));
    assert.deepEqual(problem(await importing(closed.name, documentedBoard())), [409, 'workshop_closed']);
    const missing = `gone-${randomBytes(4).toString('hex')}`;
    const answer = await importing(missing, documentedBoard());
    assert.deepEqual(problem(answer), [404, 'project_not_found']);
    assert.equal(answer.text.includes(missing), false);
    assert.equal(db.prepare('SELECT count(*) AS n FROM sticky_notes WHERE from_miro = 1 AND workshop_id IN (SELECT id FROM workshops WHERE project_id IN (?, ?))').get(none.id, closed.id).n, 0);
  });

  test('takes only the owner\'s sign-in, a request key, JSON, and a body of at most 5 MiB', async () => {
    const { space, workshop } = await opened();
    const someone = { 'Cf-Access-Jwt-Assertion': local.token({ email: 'someone@example.org' }) };
    for (const [headers, status, code] of [
      [{ 'Cf-Access-Jwt-Assertion': undefined }, 401, 'unauthenticated'],
      [someone, 403, 'not_owner'],
      [{ 'Cf-Access-Jwt-Assertion': undefined, ...s.agent.headers }, 403, 'owner_only'],
      [{ 'Sec-Fetch-Site': 'cross-site' }, 403, 'cross_site'],
    ]) {
      assert.deepEqual(problem(await importing(space.name, documentedBoard(), headers)), [status, code]);
    }
    refusedOn(await importing(space.name, documentedBoard(), { 'Idempotency-Key': undefined }), 'Idempotency-Key');
    const path = `${board(space.name)}/imports`;
    assert.deepEqual(problem(await call('importMiroBoard', { path, headers: { ...owner(), ...key(), 'Content-Type': 'text/plain' }, body: '{}' })), [415, 'json_required']);
    const { answers } = await exchange(server.port, [head('POST', path, { ...JSON_TYPE, ...owner(), ...key(), 'Content-Length': 5 * MiB + 1 })]);
    responses.note('importMiroBoard', answers[0]);
    assert.deepEqual([answers[0].status, answers[0].json.code, answers[0].json.limit], [413, 'body_too_large', 5 * MiB]);
    // A file of 5 MiB, over the other bodies' 2 MiB, is read.
    const padded = documentedBoard();
    padded.data.push({ id: miro(999), type: 'shape', data: { content: '' } });
    padded.data.at(-1).data.content = 'p'.repeat(5 * MiB - Buffer.byteLength(JSON.stringify(padded)));
    assert.equal(Buffer.byteLength(JSON.stringify(padded)), 5 * MiB);
    assert.equal((await importing(space.name, padded)).status, 201);
    assert.equal(rows(workshop).notes.length, NOTES.filter(([, note]) => note !== null).length);
  });

  test('answers internal when the store fails', async (t) => {
    const store = testStore(t);
    const failing = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            if (sql.includes('sticky_notes')) throw new Error('the store failed');
            return target.prepare(sql);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const broken = await startServer({ store: failing, gate: local.gate, routes: ROUTES });
    t.after(() => broken.close());
    const answer = responses.note('importMiroBoard', await broken.send({
      method: 'POST', path: '/api/projects/demo/workshop/imports', headers: { ...JSON_TYPE, ...owner(), ...key() }, body: JSON.stringify(documentedBoard()),
    }));
    assert.deepEqual(problem(answer), [500, 'internal']);
    assert.equal(broken.logText().includes('the store failed'), false);
  });

  test('a failure while writing rolls the whole import back: the notes written before it are gone', async (t) => {
    const store = testStore(t);
    const seeded = seed(store);
    const space = seeded.project();
    const workshop = seeded.workshop(space);
    // A store whose link insert fails once the notes are in, as when the disk fails mid-write.
    const failing = new Proxy(store, {
      get(target, name) {
        const value = Reflect.get(target, name, target);
        if (name === 'prepare') {
          return (sql) => {
            const statement = target.prepare(sql);
            if (!sql.startsWith('INSERT INTO sticky_links')) return statement;
            return new Proxy(statement, {
              get(inner, member) {
                if (member === 'run') return () => { throw new Error('the store failed'); };
                const own = Reflect.get(inner, member, inner);
                return typeof own === 'function' ? own.bind(inner) : own;
              },
            });
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const broken = await startServer({ store: failing, gate: local.gate, routes: ROUTES });
    t.after(() => broken.close());
    const answer = responses.note('importMiroBoard', await broken.send({
      method: 'POST', path: `${board(space.name)}/imports`, headers: { ...JSON_TYPE, ...owner(), ...key() }, body: JSON.stringify(documentedBoard()),
    }));
    assert.deepEqual(problem(answer), [500, 'internal']);
    assert.deepEqual(store.prepare('SELECT count(*) AS n FROM sticky_notes WHERE workshop_id = ?').get(workshop).n, 0);
    // Without the failure, the same file writes its notes and links.
    const working = await startServer({ store, gate: local.gate, routes: ROUTES });
    t.after(() => working.close());
    const imported = await working.send({
      method: 'POST', path: `${board(space.name)}/imports`, headers: { ...JSON_TYPE, ...owner(), ...key() }, body: JSON.stringify(documentedBoard()),
    });
    assert.deepEqual([imported.status, imported.json.links], [201, LINKS.length]);
  });

  test('calls out to nothing: no fetch, and no network module in the import\'s code', async () => {
    const { space } = await opened();
    const fetched = [];
    const fetching = globalThis.fetch;
    globalThis.fetch = (...args) => {
      fetched.push(args);
      throw new Error('no call out');
    };
    try {
      assert.equal((await importing(space.name, documentedBoard())).status, 201);
    } finally {
      globalThis.fetch = fetching;
    }
    assert.deepEqual(fetched, []);
    for (const file of ['miro.js', 'workshop.js']) {
      const code = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
      assert.doesNotMatch(code, /\bfetch\(|node:(?:http|https|http2|net|tls|dgram|dns|child_process)\b|\bimport\(/u, file);
    }
  });

  test('logs one line per request with its sender, and never the file\'s text, the project\'s name or a Miro address (rule 5)', async () => {
    const name = `miro-${randomBytes(6).toString('hex')}`;
    s.project(name);
    await server.send({ method: 'POST', path: board(name), headers: { ...JSON_TYPE, ...owner(), ...key() }, body: '{}' });
    const text = `Secret-${randomBytes(6).toString('hex')}`;
    const file = documentedBoard();
    file.data.push(sticky(miro(500), `<p>${text}</p>`, 'orange', 0, 0));
    await importing(name, file);
    await importing(name, notesBoard([{ content: `${text}-too-long`.repeat(20) }]));
    await importing(name, { data: [{ id: text, type: 7 }] });
    // The three imports are the last requests, each logged as it ends.
    const lines = (await server.logged(3)).slice(-3);
    for (const line of lines) {
      assert.equal(line.action, 'importMiroBoard');
      assert.match(line.traceId, TRACE_ID);
      assert.equal(line.sender, 'owner');
    }
    const logged = server.logText();
    for (const value of [name, text, 'youtube.com', 'api.miro.com', 'Payment provider', folder, folder.replaceAll('\\', '/')]) {
      assert.equal(logged.includes(value), false, value);
    }
  });

  test('answers every response API-292 lists', () => {
    responses.assertEvery('importMiroBoard');
  });

  test('touches the tables its x-corthex.tables list, and admission only the layer\'s (note 23)', () => {
    checkTables(recorder, 'importMiroBoard');
    checkLayer(recorder);
  });
});
