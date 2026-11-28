// Shared by the tests: snapshots of this repository in corthex-hub/0.2 and corthex-hub/0.3, built when the tests run
// from the repository's own files, so that no snapshot file is kept in Git. node --test also runs this file, which
// holds no test.
//
// A snapshot follows components.schemas.Snapshot of api/openapi.yaml and the fields the pinned hub sends (its
// snapshot02.py): the project and its parts from .corthex/project.json, each stage's record with its source, the
// repository and its default commit under repos["."], the items each stage's source defines, and the pictures:
// - in both formats, stages 01, 05 and 07 as a parsed picture of the part nexus, a list of what the source defines;
// - in corthex-hub/0.3, also each user flow, each screen definition and the mockup page, one picture per file with its
//   key and its whole text, translation copies left out.
// The parsed pictures and the items are simpler than the hub's, which NEXUS keeps as they come: TASK-418 reads
// neither, and the drawing tasks test their own sources. TASK-431 checks the real hub's 0.3 snapshot.

import { randomBytes } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { read } from './contract.js';

export const FORMAT_02 = 'corthex-hub/0.2';
export const FORMAT_03 = 'corthex-hub/0.3';
export const REPOSITORY = 'https://github.com/kodonghui/corthex-nexus';

const STAGE_NAMES = {
  '01-domain': 'Domain', '02-prd': 'PRD', '03-user-flow': 'User flow', '04-functional-spec': 'Functional spec',
  '05-erd': 'ERD', '06-api': 'API', '07-sitemap': 'Sitemap', '08-screen-states': 'Screen states', '09-mockup': 'Mockup',
  '10-wbs': 'WBS', '11-development': 'Development', '12-qa': 'QA', '13-presentation': 'Presentation',
};
const KINDS = { CTX: 'context', TERM: 'term', REQ: 'requirement', FL: 'flow', SPEC: 'spec', TBL: 'table', API: 'api', SCR: 'screen', TASK: 'task' };
const TRANSLATION = /\.[a-z]{2}(?:[-_][A-Za-z]{2,4})?\.(?:md|html)$/;

// The files of a folder of the repository whose names match, sorted, as paths from the repository's root.
function filesIn(folder, pattern) {
  return readdirSync(new URL(`../../${folder}`, import.meta.url))
    .filter((name) => pattern.test(name) && !TRANSLATION.test(name)).sort().map((name) => `${folder}${name}`);
}

// What a stage's source defines: each line that matches, as { id, title, where }, where the file and its line.
function defined(path, pattern) {
  const found = [];
  read(path).split('\n').forEach((line, index) => {
    const match = pattern.exec(line);
    if (match !== null) found.push({ id: match[1], title: (match[2] ?? match[1]).trim(), where: `${path}:${index + 1}` });
  });
  return found;
}

// Each stage's sources and what they define. Flows and screens are one file each, named by their first heading.
function definitions() {
  const flows = filesIn('docs/03-user-flow/', /^FL-\d+-.+\.md$/).flatMap((path) => defined(path, /^# (FL-\d+) (.+)$/));
  const sitemap = defined('docs/07-sitemap/nexus.yaml', /^\s*- id: (SCR-\d+)$/);
  const lines = read('docs/07-sitemap/nexus.yaml').split('\n');
  for (const screen of sitemap) {
    const line = Number(screen.where.split(':').at(-1));
    const name = /^\s*name: (.+)$/.exec(lines[line] ?? '');
    if (name !== null) screen.title = name[1];
  }
  return {
    '01-domain': defined('docs/01-domain/nexus.md', /^\| ((?:CTX|TERM)-\d+) ?([^|]*?) ?\|/),
    '02-prd': defined('docs/02-prd/requirements.md', /^\| (REQ-\d+) \| ([^|]+?) \|/),
    '03-user-flow': flows,
    '04-functional-spec': defined('docs/04-functional-spec/spec.md', /^\| (SPEC-\d+) \| ([^|]+?) \|/),
    '05-erd': defined('db/nexus.sql', /^-- (TBL-\d+) ([a-z_]+) /),
    '06-api': defined('api/openapi.yaml', /^ {8}id: (API-\d+)$/),
    '07-sitemap': sitemap,
    '10-wbs': defined('docs/10-wbs/wbs.md', /^\| (TASK-\d+) \| ([^|]+?) \|/),
  };
}

// The part of a picture's file, as the pinned hub gives it: the project's part that the file's name, from the stage's
// source, starts with, or none.
function partOf(path, source, parts) {
  const base = source.replace(/\/$/, '');
  const name = path.startsWith(`${base}/`) ? path.slice(base.length + 1) : path.split('/').at(-1);
  return parts.find((part) => name === part || ['/', '.', '-'].some((sep) => name.startsWith(part + sep))) ?? '';
}

// A new commit in the form the hub sends, made at run time.
export function newCommit() {
  return randomBytes(20).toString('hex');
}

// A snapshot of this repository at commit in format, as a new object each time. replaces names the commit it
// replaces; name, the project's name, is the repository's own unless given.
export function repositorySnapshot(format, { commit = newCommit(), replaces, name } = {}) {
  const settings = JSON.parse(read('.corthex/project.json'));
  const parts = settings.parts;
  const time = '2026-11-23T10:00:00+09:00';
  const found = definitions();
  const stages = Object.fromEntries(Object.entries(STAGE_NAMES).map(([stage, title]) => {
    const record = { name: title, truth: 'source', human: 'nexus', state: 'unknown', parts: { nexus: { state: 'in_progress', checkpoints: [], next: '' } } };
    const source = settings.stages[stage]?.source;
    if (source !== undefined) Object.assign(record, { source, source_state: 'found', read: true, items: found[stage]?.length ?? 0 });
    return [stage, record];
  }));
  const items = Object.entries(found).flatMap(([stage, list]) => list.map(({ id, title, where }) => ({
    id, kind: KINDS[id.split('-')[0]], stage, where, title, links: [],
  })));
  const picture = (stage, key) => ({
    part: 'nexus',
    stage,
    commit,
    time,
    source: { format: 1, [key]: found[stage].map(({ id, title, where }) => ({ id, name: title, where, removed: false })) },
  });
  const pictures = [picture('01-domain', 'contexts'), picture('05-erd', 'tables'), picture('07-sitemap', 'screens')];
  if (format === FORMAT_03) {
    const files = [
      ['03-user-flow', filesIn('docs/03-user-flow/', /^FL-\d+-.+\.md$/)],
      ['08-screen-states', filesIn('docs/08-screens/', /^SCR-\d+\.md$/)],
      ['09-mockup', ['design/mockup/nexus-mockup.html']],
    ];
    for (const [stage, paths] of files) {
      for (const path of paths) {
        pictures.push({ part: partOf(path, settings.stages[stage].source, parts), stage, key: path, commit, time, source: { text: read(path) } });
      }
    }
  }
  const snapshot = {
    schema: format,
    generator: format === FORMAT_02 ? 'corthex-nexus 0.5.0' : 'corthex-nexus 0.6.0',
    generated_at: time,
    project: { name: name ?? settings.name, title: settings.title, team: settings.team, language: settings.language, parts },
    ids: Object.fromEntries(Object.entries(KINDS).map(([prefix, kind]) => [prefix, kind])),
    repos: {
      '.': { commit, branch: 'main', dirty: false, web: REPOSITORY, url: REPOSITORY, default: { branch: 'main', commit, time } },
      harness: { checkout: false, url: settings.repos.harness, web: settings.repos.harness },
    },
    stages,
    items,
    checks: [],
    summary: { items: items.length, checks: { error: 0, warn: 0, info: 0 } },
    truncated: false,
    ask_before: { entries: ['external messages', 'deploys', 'payments', 'deletions', 'publishing'], source: 'default', left_out: [] },
    pictures,
    left_out: [],
    records: { from: 'repository', commit, time },
  };
  if (replaces !== undefined) snapshot.replaces = replaces;
  return snapshot;
}
