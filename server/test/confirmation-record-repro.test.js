// Optional private reproduction: the two source files are supplied outside Git.
// The fixture alone does not establish that those changes were already approved.
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { readDomainPicture } from '../src/domain-picture.js';
import { COMMENT_ROUTES } from '../src/comments.js';
import { confirmationsChanged, threadChanged } from '../src/entries.js';
import { idOf } from '../src/ids.js';
import { snapshotRoutes } from '../src/snapshots.js';
import { openStore } from '../src/store.js';
import { seed } from './seed.js';
import { FORMAT_03, newCommit, repositorySnapshot } from './snapshots.js';
import { newId, startServer } from './support.js';

test('a verified decision recorded on the same diagram keeps its confirmation', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'nexus-record-test-'));
  const { db } = openStore(folder);
  const rows = seed(db);
  const server = await startServer({ store: db, routes: [...snapshotRoutes(), ...COMMENT_ROUTES] });
  const picture = JSON.parse(readFileSync(new URL('./ddd-board-picture.json', import.meta.url))).picture;
  picture.hotspots[0].state = 'open';
  picture.hotspots[0].answer = '';
  picture.hotspots[1].state = 'open';
  picture.hotspots[1].answer = '';
  picture.hotspots[2].state = 'open';
  picture.hotspots[2].answer = '';
  picture.hotspots[3].state = 'open';
  picture.hotspots[3].answer = '';
  picture.hotspots[4].state = 'open';
  picture.hotspots[4].answer = '';
  const first = newCommit();
  const next = newCommit();
  const push = async (commit, source, replaces) => {
    const snapshot = repositorySnapshot(FORMAT_03, { name: 'verified-record', commit, replaces });
    snapshot.pictures = [{ part: 'nexus', stage: '01-domain', commit, time: '2026-11-27T10:00:00Z', source }];
    const answer = await server.send({ method: 'POST', path: '/api/snapshots', headers: { 'Content-Type': 'application/json', ...rows.agent.headers }, body: JSON.stringify(snapshot) });
    assert.ok([200, 201].includes(answer.status), JSON.stringify(answer.json));
    return answer.json;
  };
  try {
    await push(first, picture);
    const project = Number(db.prepare('SELECT id FROM project_spaces WHERE name = ?').get('verified-record').id);
    const diagram = Number(db.prepare("SELECT id FROM diagrams WHERE project_id = ? AND stage = '01-domain'").get(project).id);
    const drawing = Number(db.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?').get(diagram).id);
    const hotspot = (index) => db.prepare("SELECT element_key FROM elements WHERE drawing_id = ? AND kind = 'hotspot' AND json_extract(detail, '$.number') = ?").get(drawing, picture.hotspots[index].number).element_key;
    const time = '2026-11-27T10:00:00.000Z';
    const confirmation = rows.confirm({ id: project }, { id: diagram, drawing }, { at: time });
    const pass = rows.pass({ id: project }, '01-domain', { passedAt: '2026-11-27T10:00:30.000Z' });
    confirmationsChanged(db, { project, diagram, time });
    const decided = 'Record the previously approved answer.';
    const thread = rows.thread({ id: diagram, drawing }, { elementKey: hotspot(0), body: decided, at: '2026-11-27T10:01:00.000Z' });
    rows.comment(thread, { body: decided, at: '2026-11-27T10:02:00.000Z' });
    const repository = db.prepare('SELECT repository FROM project_spaces WHERE id = ?').get(project).repository;
    const pull = rows.pullRequest({ id: project }, { number: 91, state: 'merged' });
    db.prepare('UPDATE pull_requests SET merge_commit = ? WHERE id = ?').run(next, pull);
    db.prepare("UPDATE comments SET detail = ? WHERE thread_id = ? AND seq = 2").run(JSON.stringify({ link: `${repository}/pull/91` }), thread);
    const proposalThread = rows.thread({ id: diagram, drawing }, { elementKey: hotspot(1), at: '2026-11-27T10:01:00.000Z' });
    const proposalText = 'Use the accepted proposal.';
    rows.changeSet({ id: project }, { id: diagram, drawing }, {
      origin: 'proposal', threadId: proposalThread, state: 'accepted', detail: { change: proposalText },
      decidedAt: '2026-11-27T10:02:00.000Z',
    });
    const recommendationText = 'Use the recommended option.';
    const recommended = rows.thread({ id: diagram, drawing }, {
      elementKey: hotspot(2), author: 'agent', body: recommendationText, at: '2026-11-27T10:01:00.000Z',
    });
    db.prepare('UPDATE comments SET detail = ? WHERE thread_id = ? AND seq = 1').run(JSON.stringify({ asks: 'recommended' }), recommended);
    rows.comment(recommended, { author: 'owner', body: '추천안', at: '2026-11-27T10:02:00.000Z' });
    rows.comment(recommended, { body: recommendationText, at: '2026-11-27T10:03:00.000Z' });
    db.prepare('UPDATE comments SET detail = ? WHERE thread_id = ? AND seq = 3').run(JSON.stringify({ link: `${repository}/pull/91` }), recommended);
    const answeredText = 'Keep the answered decision.';
    const answered = rows.thread({ id: diagram, drawing }, { elementKey: hotspot(3), body: answeredText, at: '2026-11-27T10:01:00.000Z' });
    threadChanged(db, { project, thread: answered, time: '2026-11-27T10:01:00.000Z' });
    const marked = await server.send({ method: 'POST', path: `/api/spaces/verified-record/comments/${idOf('nc', answered)}/answered`,
      headers: { 'Content-Type': 'application/json', ...rows.agent.headers, 'Nexus-Session': 'record-test', 'Idempotency-Key': `"${newId('nw')}"` }, body: '{}' });
    assert.equal(marked.status, 200);
    const updated = structuredClone(picture);
    updated.hotspots[0].answer = decided;
    updated.hotspots[0].state = 'answered';
    updated.hotspots[1].answer = proposalText;
    updated.hotspots[1].state = 'answered';
    updated.hotspots[2].answer = recommendationText;
    updated.hotspots[2].state = 'answered';
    updated.hotspots[3].answer = answeredText;
    updated.hotspots[3].state = 'answered';
    await push(next, updated, first);
    assert.equal(db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state, 'confirmed');
    assert.equal(db.prepare('SELECT changed_at FROM stage_passes WHERE id = ?').get(pass).changed_at, null);
    assert.equal(db.prepare('SELECT state FROM comment_threads WHERE id = ?').get(thread).state, 'closed');
    assert.equal(Number(db.prepare("SELECT count(*) AS n FROM thread_resolution_events WHERE thread_id = ? AND event = 'resolved'").get(thread).n), 1);
    const replayed = await Promise.all([push(next, updated, first), push(next, updated, first)]);
    assert.ok(replayed.every((answer) => answer.same_commit === true));
    assert.equal(db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state, 'confirmed');
    assert.equal(Number(db.prepare("SELECT count(*) AS n FROM thread_resolution_events WHERE thread_id = ? AND event = 'resolved'").get(thread).n), 1);
    const candidates = [newCommit(), newCommit()];
    const competing = await Promise.allSettled(candidates.map((commit) => push(commit, updated, next)));
    assert.equal(competing.filter((result) => result.status === 'fulfilled').length, 1);
    const winner = candidates[competing.findIndex((result) => result.status === 'fulfilled')];
    assert.equal(db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state, 'confirmed');
    const changed = structuredClone(updated);
    // An identical answer from a different hotspot is not evidence for this one.
    changed.hotspots[4].answer = decided;
    changed.hotspots[4].state = 'answered';
    await push(newCommit(), changed, winner);
    assert.equal(db.prepare('SELECT state FROM confirmations WHERE id = ?').get(confirmation).state, 'invalidated');
    assert.notEqual(db.prepare('SELECT changed_at FROM stage_passes WHERE id = ?').get(pass).changed_at, null);
  } finally {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

test('a real record with changes not proved by a decision needs confirmation again', {
  skip: !process.env.NEXUS_REPRO_BEFORE || !process.env.NEXUS_REPRO_AFTER,
}, async () => {
  const folder = mkdtempSync(join(tmpdir(), 'nexus-record-repro-'));
  const { db } = openStore(folder);
  const rows = seed(db);
  const server = await startServer({ store: db, routes: snapshotRoutes() });
  let previous;
  try {
    for (const [index, file] of [process.env.NEXUS_REPRO_BEFORE, process.env.NEXUS_REPRO_AFTER].entries()) {
      const commit = newCommit();
      const snapshot = repositorySnapshot(FORMAT_03, { name: 'record-repro', commit, replaces: previous });
      const { picture, checks } = readDomainPicture([['domain.md', readFileSync(file, 'utf8')]], { part: 'nexus' });
      assert.ok(picture);
      assert.equal(checks.length, 0);
      snapshot.pictures = [{ part: 'nexus', stage: '01-domain', commit, time: '2026-11-27T10:00:00Z', source: picture }];
      const answer = await server.send({ method: 'POST', path: '/api/snapshots', headers: { 'Content-Type': 'application/json', ...rows.agent.headers }, body: JSON.stringify(snapshot) });
      assert.ok([200, 201].includes(answer.status), JSON.stringify(answer.json));
      const project = db.prepare('SELECT id FROM project_spaces WHERE name = ?').get('record-repro');
      const diagram = db.prepare("SELECT id FROM diagrams WHERE project_id = ? AND stage = '01-domain'").get(project.id);
      if (index === 0) {
        const drawing = db.prepare('SELECT max(id) AS id FROM drawings WHERE diagram_id = ?').get(diagram.id);
        rows.confirm({ id: Number(project.id) }, { id: Number(diagram.id), drawing: Number(drawing.id) });
        confirmationsChanged(db, { project: Number(project.id), diagram: Number(diagram.id), time: '2026-11-27T10:00:00.000Z' });
      } else {
        const confirmation = db.prepare('SELECT state FROM confirmations WHERE diagram_id = ?').get(diagram.id);
        assert.equal(confirmation.state, 'invalidated');
      }
      previous = commit;
    }
  } finally {
    await server.close();
    db.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
