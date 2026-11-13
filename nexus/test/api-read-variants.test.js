// Exact named GET fixtures left open by the earlier response matrices.
// These are local actual-handler/SQLite checks, not live Access or browser proof.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../src/app.js';
import { Store } from '../src/store.js';
import { inputFailure } from '../src/input-check.js';
import { fakeD1 } from './fake-d1.js';
import { testAccess } from './access-fixture.js';
import { viewSnapshot } from './view-fixtures.js';

const CASES = ['TC-794', 'TC-800', 'TC-820', 'TC-828', 'TC-829', 'TC-840', 'TC-848', 'TC-962'];
const JSON_HEADERS = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'x-robots-tag': 'noindex, nofollow',
  'cross-origin-resource-policy': 'same-origin',
  'content-type': 'application/json; charset=utf-8',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
};
const digest = (text) => createHash('sha256').update(text).digest('hex');

// Since TASK-296 the agent's read of the to-do records its time and session
// label for its space (SPEC-187). Without lastRead the shape leaves out those
// two columns of TBL-102, so that the read is shown to change nothing else.
function databaseShape(db, { lastRead = true } = {}) {
  const tables = db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  const kept = (name, row) => {
    if (lastRead || name !== 'project_spaces') return row;
    const { read_at, read_session, ...rest } = row;
    return rest;
  };
  const values = tables.map(({ name, sql }) => [name, sql,
    db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '"').all().map((row) => JSON.stringify(kept(name, row))).sort()]);
  return { hash: digest(JSON.stringify(values)), counts: Object.fromEntries(values.map(([name, , rows]) => [name, rows.length])) };
}

function oneDiscrepancySnapshot(name) {
  const snapshot = viewSnapshot(name);
  // The board's aggregate keeps TERM-001, while no table names that term.
  // The read-model/screen pair remains matched. The real push cross-check
  // therefore creates one no-table discrepancy without SQL fixture writes.
  snapshot.pictures.find((p) => p.stage === '05-erd').source.tables[0].terms = [];
  return snapshot;
}

test('eight named API read variants preserve their exact state, policy and whole database', async () => {
  const originalFetch = globalThis.fetch;
  const databases = [];
  const requests = [];
  const results = [];
  let completed = false;
  let serial = 0;
  try {
    const access = await testAccess(); // Generated keys; its certificate fetch is an in-memory stub.
    async function fixture(name) {
      const db = new DatabaseSync(':memory:');
      databases.push(db);
      const binding = fakeD1(db);
      // Initialization is setup. Even the empty-list GET is measured after
      // migrations so its before/after hash includes the complete schema.
      await new Store(binding).ensure();
      return { name, db, env: { ...access.env, DB: binding, NEXUS_LANGUAGE: 'en' }, base: '/api/spaces/' + name };
    }
    async function call(f, method, path, { body, kind = 'user', status = 200 } = {}) {
      const headers = { ...access.headers(kind) };
      if (method === 'POST') headers['Idempotency-Key'] = '"nw_' + String(++serial).padStart(12, '0') + '"';
      if (kind === 'agent') headers['Nexus-Session'] = 'qa-read-variants-agent';
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const records = method === 'GET' && kind === 'agent' && path === f.base + '/todo';
      const before = databaseShape(f.db, { lastRead: !records });
      const errors = [];
      const originalError = console.error;
      let response;
      try {
        console.error = (...args) => errors.push(args);
        response = await handle(new Request('https://nexus.example.com' + path, {
          method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }), f.env, access.ctx);
      } finally {
        console.error = originalError;
      }
      const text = await response.text();
      const data = JSON.parse(text);
      const after = databaseShape(f.db, { lastRead: !records });
      const row = { method, status: response.status, media: response.headers.get('Content-Type'),
        bodySha256: digest(text), databaseUnchanged: before.hash === after.hash,
        beforeDatabaseSha256: before.hash, afterDatabaseSha256: after.hash,
        beforeCounts: before.counts, afterCounts: after.counts, errorLogCount: errors.length };
      requests.push(row);
      assert.equal(response.status, status, method + ' ' + path);
      assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8');
      if (method === 'GET') {
        for (const [name, expected] of Object.entries(JSON_HEADERS)) assert.equal(response.headers.get(name), expected, name);
        assert.equal(after.hash, before.hash, 'GET preserves every table/schema/row, including write receipts');
        assert.deepEqual(after.counts, before.counts);
        assert.ok(Object.hasOwn(before.counts, 'writes'), 'write receipts are inside the comparison');
        // Stage06 requires matching Problem.traceId/error logs on errors.
        // These named 200 success schemas do not acquire a Problem field.
        assert.equal(errors.length, 0, 'a successful GET emits no error trace');
        if (records) {
          const space = f.db.prepare('SELECT read_at, read_session FROM project_spaces WHERE project = ?').get(f.name);
          assert.deepEqual({ ...space }, { read_at: data.read_at, read_session: 'qa-read-variants-agent' }, 'the agent\'s read records its time and label');
          row.lastRead = 'recorded: read_at and read_session of TBL-102 alone changed (SPEC-187, TASK-296)';
        }
        row.headers = Object.fromEntries(Object.keys(JSON_HEADERS).map((name) => [name, response.headers.get(name)]));
        row.traceRule = 'success response; Problem/error-log trace coupling is conditional on errors';
      }
      return { data, row };
    }
    async function push(f, snapshot) {
      const schema = snapshot.schema === 'corthex-hub/0.1' ? 'Snapshot01' : 'Snapshot02';
      assert.equal(inputFailure(snapshot, schema), null, 'synthetic snapshot satisfies ' + schema);
      return (await call(f, 'POST', '/api/snapshots', { body: snapshot, kind: 'agent' })).data;
    }
    async function post(f, path, body, { kind = 'user', status = 201, schema } = {}) {
      if (schema) assert.equal(inputFailure(body, schema), null, 'synthetic body satisfies ' + schema);
      return (await call(f, 'POST', f.base + path, { body, kind, status })).data;
    }
    async function readCase(id, f, path, verify, options) {
      const entry = { caseId: id, requestIndex: requests.length, result: 'started' };
      results.push(entry);
      const { data, row } = await call(f, 'GET', path, options);
      entry.observation = row;
      entry.semantic = verify(data);
      entry.result = 'pass';
      return data;
    }

    const empty = await fixture('qa-read-empty');
    await readCase('TC-794', empty, '/api/snapshots', (data) => {
      assert.deepEqual(data, { projects: [] });
      return { projects: data.projects.length };
    });

    const legacy = await fixture('qa-read-legacy');
    const legacySnapshot = viewSnapshot(legacy.name);
    legacySnapshot.schema = 'corthex-hub/0.1';
    legacySnapshot.generator = 'corthex-nexus 0.1.0';
    for (const key of ['pictures', 'left_out', 'ask_before', 'records']) delete legacySnapshot[key];
    delete legacySnapshot.project.parts;
    delete legacySnapshot.repos['.'].default;
    for (const stage of Object.values(legacySnapshot.stages)) {
      delete stage.parts;
      stage.state = 'in_progress';
    }
    await push(legacy, legacySnapshot);
    await readCase('TC-800', legacy, '/api/snapshots/' + legacy.name, (data) => {
      assert.equal(data.schema, 'corthex-hub/0.1');
      assert.deepEqual(data, legacySnapshot, 'the actual stored legacy snapshot is returned without invented 0.2 fields');
      assert.equal(Object.hasOwn(data, 'pictures'), false);
      return { snapshotSchema: data.schema, equalsPushedLegacySnapshot: true, picturesFieldPresent: false };
    });

    const mixed = await fixture('qa-read-open');
    await push(mixed, oneDiscrepancySnapshot(mixed.name));
    let discrepancyId;
    await readCase('TC-828', mixed, mixed.base + '/pictures/sample/01-domain', (data) => {
      assert.equal(data.stage, '01-domain');
      assert.equal(data.picture.source.contexts.length, 1);
      assert.equal(data.discrepancies.length, 1);
      const discrepancy = data.discrepancies[0];
      assert.equal(discrepancy.state, 'open');
      assert.equal(discrepancy.compares, 'aggregate-table');
      assert.equal(discrepancy.term, 'TERM-001');
      assert.deepEqual(discrepancy.reasons, [{ kind: 'no-table' }]);
      assert.equal(discrepancy.waiting, false);
      assert.deepEqual(data.comments, { total: 0, entries: [] });
      assert.deepEqual(data.closed_comments, { total: 0, entries: [] });
      assert.deepEqual(data.proposals, []);
      assert.deepEqual(data.reflections, []);
      discrepancyId = discrepancy.id;
      return { stage: data.stage, contexts: 1, openDiscrepancies: 1, reason: 'no-table', otherOpenEntries: 0 };
    });

    const firstComment = await post(mixed, '/comments', { part: 'sample', stage: '01-domain', item: 'CTX-001', text: 'Synthetic board question' }, { schema: 'NewComment' });
    const secondComment = await post(mixed, '/comments', { part: 'sample', stage: '05-erd', item: 'TBL-001', text: 'Synthetic table question' }, { schema: 'NewComment' });
    const proposalBody = { part: 'sample', stage: '05-erd', items: ['TBL-001'], reason: 'Synthetic read fixture', change: 'Clarify the synthetic table' };
    const acceptedProposal = await post(mixed, '/proposals', proposalBody, { kind: 'agent', schema: 'NewProposal' });
    const accepted = await post(mixed, '/proposals/' + acceptedProposal.id + '/accept', undefined, { status: 200 });
    await post(mixed, '/edits/' + accepted.edit.id + '/report', { event: 'opened', pull_request: 'https://example.com/qa/repo/pull/1' }, { kind: 'agent', status: 200, schema: 'EditReport' });
    await readCase('TC-848', mixed, mixed.base + '/todo', (data) => {
      assert.equal(data.comments.total, 2);
      assert.deepEqual(new Set(data.comments.entries.map((c) => c.id)), new Set([firstComment.id, secondComment.id]));
      assert.ok(data.comments.entries.every((c) => c.state === 'open' && c.waits === 'agent'));
      assert.equal(data.discrepancies.total, 1);
      assert.equal(data.discrepancies.entries[0].id, discrepancyId);
      assert.equal(data.discrepancies.entries[0].state, 'open');
      assert.equal(data.reflections.total, 1);
      const reflection = data.reflections.entries[0];
      assert.equal(reflection.id, accepted.edit.id);
      assert.equal(reflection.state, 'in-review');
      assert.equal(reflection.proposal.id, acceptedProposal.id);
      assert.equal(reflection.proposal.state, 'accepted');
      assert.deepEqual(data.checkpoints, { total: 0, entries: [] });
      assert.equal(data.waiting_for_user, 0, 'only the two agent-waiting comments exist at this point');
      assert.equal(data.taken, 0, 'no other session has claimed an entry');
      return { comments: 2, discrepancies: 1, reflections: 1, reflectionState: 'in-review', checkpoints: 0, waitingForUser: 0, taken: 0 };
    }, { kind: 'agent' });

    // Creating the comment-linked proposal comes after the 2/1/1 todo read:
    // a proposal changes that comment's wait to user through the real API.
    const thirdComment = await post(mixed, '/comments', { part: 'sample', stage: '05-erd', item: 'TBL-001', text: 'Synthetic proposal question' }, { schema: 'NewComment' });
    const linkedProposal = await post(mixed, '/proposals', { ...proposalBody, comment: thirdComment.id, source_text: 'CREATE TABLE synthetic_orders (' }, { kind: 'agent', schema: 'NewProposal' });
    await readCase('TC-962', mixed, mixed.base + '/proposals/' + linkedProposal.id, (data) => {
      assert.equal(data.id, linkedProposal.id);
      assert.equal(data.state, 'open');
      assert.equal(data.comment, thirdComment.id);
      assert.deepEqual(data.items, ['TBL-001']);
      assert.equal(data.source_text, 'CREATE TABLE synthetic_orders (');
      assert.equal(data.closed_at, null);
      assert.equal(data.edit, null);
      return { state: data.state, linksCreatedComment: true, sourceTextPreserved: true, closed: false, editPresent: false };
    });

    await readCase('TC-820', mixed, '/api/snapshots/' + mixed.name + '/removal', (data) => {
      assert.deepEqual(data.deletes, { snapshot: true, space: true, pictures: 3, discrepancies: 1, comments: 3, proposals: 2, edits: 1, checkpoints: 0, replies: 0, decisions: 0 });
      assert.equal(data.open.comments.total, 3);
      assert.deepEqual(new Set(data.open.comments.ids), new Set([firstComment.id, secondComment.id, thirdComment.id]));
      assert.deepEqual(data.open.proposals, { total: 1, ids: [linkedProposal.id] });
      assert.deepEqual(data.open.reflections, { total: 1, ids: [accepted.edit.id] });
      assert.deepEqual(data.open.checkpoints, { total: 0, ids: [] });
      return { openComments: 3, openProposals: 1, openReflections: 1, openCheckpoints: 0, deletionTotalsMatchApiCreatedFixture: true };
    });

    const overview = await fixture('qa-read-overview');
    await push(overview, oneDiscrepancySnapshot(overview.name));
    const checkpoint = await post(overview, '/checkpoints', { part: 'sample', stage: '05-erd' }, { schema: 'NewCheckpoint' });
    await readCase('TC-840', overview, overview.base + '/overview/sample/05-erd', (data) => {
      assert.equal(data.stage, '05-erd');
      assert.equal(data.discrepancies.total, 1);
      assert.equal(data.discrepancies.entries[0].state, 'open');
      assert.equal(data.checkpoints.length, 1);
      assert.equal(data.checkpoints[0].id, checkpoint.id);
      assert.equal(data.checkpoints[0].state, 'passed');
      assert.equal(data.checkpoints[0].recorded_commit, null);
      assert.equal(data.checkpoints[0].pull_request, null);
      assert.deepEqual(data.comments, { total: 0, entries: [] });
      assert.deepEqual(data.reflections, { total: 0, entries: [] });
      return { stage: data.stage, openDiscrepancies: 1, passedCheckpoints: 1, recordedCheckpoints: 0, otherOpenEntries: 0 };
    });

    const sitemap = await fixture('qa-read-no-parts');
    const sitemapSnapshot = viewSnapshot(sitemap.name);
    delete sitemapSnapshot.project.parts;
    for (const stage of Object.values(sitemapSnapshot.stages)) {
      Object.assign(stage, stage.parts.sample);
      delete stage.parts;
    }
    // Manual API-111 named sitemap example (stage07 template + terms, with
    // blank IDs/empty flows). Its equivalence is a contract fixture check;
    // this test does not execute the hub parser or render a browser picture.
    const source = { format: 1, screens: [
      { id: '', name: 'Home', path: '/', access: 'everyone', flows: [], context: '', terms: [], removed: false, where: 'docs/07-sitemap/sitemap.yaml:1' },
      { id: '', name: 'Order detail', path: '/orders/:id', access: 'signed-in customer', flows: [], parent: 0, context: '', terms: ['TERM-085'], removed: false, where: 'docs/07-sitemap/sitemap.yaml:6' },
    ], without_screen: [] };
    const drawnPicture = { ...sitemapSnapshot.pictures.find((p) => p.stage === '07-sitemap'), part: '', source };
    sitemapSnapshot.pictures = [drawnPicture];
    await push(sitemap, sitemapSnapshot);
    const sourceGone = structuredClone(sitemapSnapshot);
    sourceGone.generated_at = new Date(Date.parse(sitemapSnapshot.generated_at) + 1).toISOString();
    sourceGone.pictures = [];
    Object.assign(sourceGone.stages['07-sitemap'], { source_state: 'missing', read: false, files: 0 });
    await push(sitemap, sourceGone);
    await readCase('TC-829', sitemap, sitemap.base + '/pictures/_/07-sitemap', (data) => {
      assert.equal(data.part, '');
      assert.equal(data.stage, '07-sitemap');
      assert.equal(data.picture.not_current, 'source-gone');
      assert.equal(data.picture.commit, drawnPicture.commit);
      assert.deepEqual(data.picture.source, source, 'the previously drawn template picture survives source removal');
      assert.ok(data.picture.source.screens.every((screen) => screen.id === '' && screen.flows.length === 0));
      assert.deepEqual(data.picture.source.screens[1].terms, ['TERM-085']);
      assert.deepEqual(data.comments, { total: 0, entries: [] });
      assert.deepEqual(data.proposals, []);
      assert.deepEqual(data.reflections, []);
      assert.deepEqual(data.discrepancies, []);
      return { partEmpty: true, screens: 2, allIdsBlank: true, allFlowsEmpty: true, termsRetained: true, notCurrent: 'source-gone', drawnSourcePreserved: true };
    });

    assert.deepEqual(results.map((r) => r.caseId).sort(), [...CASES].sort());
    assert.ok(results.every((r) => r.result === 'pass'));
    for (const db of databases) {
      assert.equal(db.prepare('PRAGMA quick_check').get().quick_check, 'ok');
      assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    }
    completed = true;
  } finally {
    for (const db of databases) db.close();
    globalThis.fetch = originalFetch;
    // Explicit opt-in output only; never discover a user's directories or
    // record tokens, cookies, request headers, raw responses or account data.
    if (process.env.NEXUS_READ_VARIANT_RESULTS) writeFileSync(process.env.NEXUS_READ_VARIANT_RESULTS,
      JSON.stringify({ schema: 'synthetic-named-read-variants/1', plannedCases: CASES, completed, cases: results, requests }, null, 2) + '\n');
  }
});
