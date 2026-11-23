// SCR-142, the owner's to-do (SPEC-042, TASK-455): what waits on the owner across every project, from API-263, with
// the projects' titles from API-262. screens.js runs it in the shell; the shell draws the title, the loading, error,
// permission and stale states, and the header.
//
// - The entries keep API-263's order: projects by their newest entry, each project's entries newest first. Every entry
//   it answers shows, up to its 5000; there is no "more".
// - A project's group is headed by its title (API-262), or its name when the list leaves it out, with 프로젝트 보기 to
//   SCR-144. A row shows its kind as a tag, the stage and the diagram's name, for a confirmation why it waits, and how
//   long it has waited; it opens SCR-145 at its diagram, and at its thread when it has one. No ID shows.
// - A failed daily backup is a warning on top, in the empty state too, until a backup succeeds.
// - With nothing to do: "기다리는 일이 없어요" and the projects, or, with no project yet, the way to the agent
//   credentials of SCR-143.

import { PROJECTS_HREF, projectHref, stageHref } from './address.js';
import { h, icon } from './dom.js';
import { stageOf } from './stages.js';
import { dayOf, sentWords } from './states.js';

// Each kind's tag, as the mockup draws it.
const KINDS = Object.freeze({
  confirm: { class: 'tag gray', text: '확정' },
  proposal: { class: 'ai', text: 'AI 제안' },
  question: { class: 'tag cyan', text: '질문' },
});
// Why a diagram waits for its confirmation (OwnerTodoEntry.reason).
export const REASONS = Object.freeze({
  new: '아직 확정한 적이 없어요',
  invalidated: '새 문서로 확정이 풀렸어요',
  cancelled: '확정을 취소했어요',
});
const STAGE_COUNT = 13;

// The body of SCR-142 from data.todo (API-263) and data.projects (API-262).
export function todoBody({ data, shell }) {
  const entries = data.todo.entries ?? [];
  const projects = data.projects.projects ?? [];
  const warning = data.todo.backup ? backupWarning(data.todo.backup) : null;
  if (entries.length === 0) return [warning, nothingToDo(projects, shell)];
  const titles = new Map(projects.map((project) => [project.name, project.title || project.name]));
  return [warning, groupsOf(entries).map(([project, items]) => h('section', { class: 'group' },
    h('div', { class: 'gh' }, h('h2', {}, titles.get(project) ?? project), h('a', { class: 'small', href: projectHref(project) }, '프로젝트 보기')),
    h('div', { class: 'list' }, items.map((entry) => entryRow(entry, shell)))))];
}

// The entries by project, the projects in the order of their first entry and each one's entries in their order.
function groupsOf(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.project)) groups.set(entry.project, []);
    groups.get(entry.project).push(entry);
  }
  return [...groups];
}

function entryRow(entry, shell) {
  const kind = KINDS[entry.kind] ?? null;
  const stage = stageOf(entry.stage);
  const place = [stage === undefined ? entry.stage : `${stage.number} ${stage.name}`, entry.diagram_name].filter(Boolean).join(' · ');
  const reason = entry.kind === 'confirm' ? REASONS[entry.reason] ?? null : null;
  return h('a', { class: 'li', href: stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram, thread: entry.thread }) },
    h('span', { class: 'lead' }, kind === null ? null : h('span', { class: kind.class }, kind.text)),
    h('span', { class: 'grow' }, h('b', {}, place), reason === null ? null : h('span', { class: 'sec' }, reason)),
    h('span', { class: 'end' }, shell.since(entry.since)),
    icon('next', 'ic chev'));
}

// The warning of a failed daily backup (BackupWarning): the local date it failed on, as the mockup says it.
export function backupWarning(backup) {
  return h('div', { class: 'nt warn', role: 'alert' }, h('div', { class: 'b' },
    h('b', {}, `${dayOf(backup.failed_at)} 백업이 실패했어요.`),
    h('span', {}, '서버 기록을 확인하세요. 다음 백업이 성공하면 이 알림은 사라져요.')));
}

// SCR-142#empty: nothing waits, with the projects, each to SCR-144; or, with no project yet, the agent credentials.
function nothingToDo(projects, shell) {
  if (projects.length === 0) {
    return h('div', { class: 'empty' },
      h('h2', {}, '기다리는 일이 없어요'),
      h('p', { class: 'sec' }, '에이전트가 처음 보내면 여기에 나와요.'),
      h('a', { class: 'btn tertiary', href: PROJECTS_HREF }, '에이전트 자격'));
  }
  return [
    h('div', { class: 'empty' },
      h('h2', {}, '기다리는 일이 없어요'),
      h('p', { class: 'sec' }, '에이전트가 확정할 그림이나 질문을 보내면 여기에 나와요.')),
    h('section', { class: 'group' },
      h('div', { class: 'gh' }, h('h2', {}, '프로젝트')),
      h('div', { class: 'list' }, projects.map((project) => h('a', { class: 'li', href: projectHref(project.name) },
        h('span', { class: 'grow' },
          h('b', {}, project.title || project.name),
          h('span', { class: 'sec' }, `${STAGE_COUNT}단계 중 ${project.stages_passed} 통과`,
            project.pushed_at ? [' · ', shell.since(project.pushed_at, sentWords)] : null)),
        icon('next', 'ic chev'))))),
  ];
}
