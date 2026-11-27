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

import { PROJECTS_HREF, TODO_HREF, projectHref, stageHref } from './address.js';
import { h, icon } from './dom.js';
import { STAGES, stageOf } from './stages.js';
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

// The body of SCR-142 from data.todo (API-263) and data.projects (API-262).
export function todoBody({ address, data, shell }) {
  if (address.view !== 'todo') return projectHome(data, shell);
  if (shell.missed('todo')) return shell.errorNotice(shell.missed('todo'), () => shell.reload());
  if (data.todo == null) return [h('div', { class: 'nt warn', role: 'status' }, '할 일을 불러오지 못했어요.')];
  const entries = data.todo.entries ?? [];
  const projects = data.projects.projects ?? [];
  const warning = data.todo.backup ? backupWarning(data.todo.backup) : null;
  if (entries.length === 0) return [warning, nothingToDo(projects, shell)];
  const titles = new Map(projects.map((project) => [project.name, project.title || project.name]));
  // Each 프로젝트 보기 is named with its group's heading too, so that a list of the links tells them apart.
  return [warning, groupsOf(entries).map(([project, items], index) => h('section', { class: 'group' },
    h('div', { class: 'gh' },
      h('h2', { id: `todo-group-${index}` }, titles.get(project) ?? project),
      h('a', { class: 'small', id: `todo-open-${index}`, href: projectHref(project), 'aria-labelledby': `todo-open-${index} todo-group-${index}` }, '프로젝트 보기')),
    h('div', { class: 'list' }, items.map((entry) => entryRow(entry, shell)))))];
}

// Project-first home: only known counts are shown, and a capped to-do is labelled as a minimum.
function projectHome(data, shell) {
  const projects = data.projects.projects ?? [];
  const entries = shell.missed('todo') ? null : data.todo?.entries ?? null;
  const capped = entries !== null && entries.length >= 5000;
  const counts = new Map();
  for (const entry of entries ?? []) {
    const count = counts.get(entry.project) ?? { questions: 0, reviews: 0, firstQuestion: null };
    if (entry.kind === 'question') {
      count.questions += 1;
      count.firstQuestion ??= entry;
    }
    if (entry.kind === 'confirm' || entry.kind === 'proposal') count.reviews += 1;
    counts.set(entry.project, count);
  }
  const warning = data.todo?.backup ? backupWarning(data.todo.backup) : null;
  const missing = entries === null ? [h('p', {}, '할 일 수를 불러오지 못했어요.'),
    ...(shell.missed('todo') ? shell.errorNotice(shell.missed('todo'), () => shell.reload()) : [])] : null;
  if (projects.length === 0) return [warning, missing, h('div', { class: 'empty' },
    h('h2', {}, '아직 프로젝트가 없어요'),
    h('p', {}, '함께 일하는 AI에게 프로젝트를 NEXUS로 보내 달라고 요청해 주세요.'),
    h('a', { href: PROJECTS_HREF, class: 'btn tertiary' }, '프로젝트 설정'))];
  return [warning, missing,
    h('section', { class: 'group', 'aria-label': '프로젝트' }, h('div', { class: 'list' }, projects.map((project) => {
      const { questions, reviews, firstQuestion } = counts.get(project.name) ?? { questions: 0, reviews: 0, firstQuestion: null };
      const number = (value) => capped ? `${value}개 이상` : `${value}개`;
      return h('div', { class: 'li keep project-card' },
        h('a', { class: 'project-card-main', href: projectHref(project.name) },
          h('span', { class: 'grow' }, h('b', {}, project.title || project.name),
          h('span', { class: 'sec' }, entries === null ? '할 일 수를 읽지 못했어요' : `답할 질문 ${number(questions)} · 확인할 내용 ${number(reviews)}`),
          h('span', { class: 'sec' }, `${STAGES.length}단계 중 ${project.stages_passed} 통과`)), icon('next', 'ic chev')),
        firstQuestion === null ? null : h('a', { class: 'btn primary sm',
          href: stageHref(firstQuestion.project, firstQuestion.part, firstQuestion.stage, { diagram: firstQuestion.diagram, thread: firstQuestion.thread }),
          'aria-label': `${project.title || project.name}의 최근 질문에 답하기` }, '최근 질문에 답하기'));
    }))), h('a', { class: 'btn tertiary', href: TODO_HREF }, '모든 할 일 보기'),
    h('a', { class: 'btn tertiary', href: PROJECTS_HREF }, '프로젝트 설정')];
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
  const reason = entry.kind === 'confirm' ? REASONS[entry.reason] ?? null
    : entry.kind === 'question' ? '열어서 질문을 읽고 댓글에 답해 주세요.' : null;
  return h('a', { class: 'li', href: stageHref(entry.project, entry.part, entry.stage, { diagram: entry.diagram, thread: entry.thread }) },
    h('span', { class: 'lead' }, kind === null ? null : h('span', { class: kind.class }, kind.text)),
    h('span', { class: 'grow' }, h('b', {}, place), reason === null ? null : h('span', { class: 'sec' }, reason)),
    h('span', { class: 'end' }, shell.since(entry.since)),
    icon('next', 'ic chev'));
}

// The warning of a failed daily backup (BackupWarning): the local date it failed on, as the mockup says it. It stays
// while backups keep failing and is drawn again with each changed answer, so it is a status, not an alert that would
// break in on a screen reader each time.
export function backupWarning(backup) {
  return h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' },
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
          h('span', { class: 'sec' }, `${STAGES.length}단계 중 ${project.stages_passed} 통과`,
            project.pushed_at ? [' · ', shell.since(project.pushed_at, sentWords)] : null)),
        icon('next', 'ic chev'))))),
  ];
}
