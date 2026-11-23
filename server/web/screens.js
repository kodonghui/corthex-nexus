// The screens of the sitemap (docs/07-sitemap) as the shell runs them (see shell.js and the server README's "App
// shell" section). Each draws its title, its place and its shared states from API-262, API-263 and API-264; its own
// body in the normal and empty states is the task's that builds the screen (TASK-455 to TASK-462).
//
// A screen is an object:
// - layout: 'list' (one column, main.main) or 'workbench' (the diagram's column and the work panel, div.wb);
// - tabs: true for the stage tabs under the header;
// - states: the states it has beyond the shared ones, for the 409s that lead to one (see states.js stateOf);
// - reads(address): its API reads, { name: path }; the shell reads them and hands their bodies over as data[name];
// - fixedTitle: its title before its data came, or null for a title from its data;
// - title(ctx), crumb(ctx) and description (a text, or a function of ctx): drawn once its data came;
// - projectTitle(ctx): the project's title for the header's menu button, on a project's screens;
// - check(ctx): null, or what is gone, { code, sub, link: { text, href }, tabs }, when its data shows the address
//   names nothing, such as an unknown ?d=;
// - skeleton(ctx): the grey shapes of its loading state;
// - render(ctx) and panel(ctx): its body and, on the workbench, its work panel, as nodes.
// ctx is { address, data, shell }: shell gives read, reload, onLeave, keepDraft, draftOf, isPhone, message, staleBar
// and errorNotice.

import { isThreadId, projectHref, PROJECTS_HREF, stageHref, TODO_HREF } from './address.js';
import { h } from './dom.js';
import { SHARED_STATES } from './states.js';
import { stageOf } from './stages.js';

const WORKBENCH_STATES = Object.freeze([...SHARED_STATES, 'waiting', 'confirmed', 'not-drawn', 'workshop']);
const CHANGES_STATES = Object.freeze([...SHARED_STATES, 'waiting', 'not-drawn', 'confirmed']);
const DIAGRAM_GONE_SUB = '문서에서 빠졌거나 주소가 바뀌었어요. 작업대의 다른 단계는 그대로 열려요.';

const projectRead = (address) => ({ project: `/api/projects/${encodeURIComponent(address.project)}` });
const skeletonRows = (count) => h('div', { class: 'cards' },
  Array.from({ length: count }, () => h('span', { class: 'sk row full', 'aria-hidden': 'true' })));
const skeletonGroup = (count, heading = true) => h('section', { class: 'group', 'aria-hidden': 'true' },
  heading ? h('span', { class: 'sk line w160' }) : null, skeletonRows(count));

// The row of API-264's stage list that the address names, or undefined when the project has no such part.
export function stageRow(project, address) {
  return (project.stages ?? []).find((row) => row.stage === address.stage && row.part === address.part);
}

// The diagram the workbench or the changes page opens: the one ?d= names, or else the stage's first that is not
// removed (removed ones are listed last), or else its first; null when the stage has none or ?d= names none of them.
export function chosenDiagram(row, diagram) {
  const diagrams = row?.diagrams ?? [];
  if (diagram !== null) return diagrams.find((each) => each.id === diagram) ?? null;
  return diagrams.find((each) => !each.removed) ?? diagrams[0] ?? null;
}

// What a stage screen's data says is gone: the part, or the diagram of ?d=.
function stageGone({ address, data }) {
  const row = stageRow(data.project, address);
  const toProject = { text: '프로젝트로', href: projectHref(address.project) };
  if (row === undefined) return { code: 'part_not_found', link: toProject, tabs: false };
  if (address.diagram !== null && chosenDiagram(row, address.diagram) === null) {
    return { code: 'diagram_not_found', sub: DIAGRAM_GONE_SUB, link: toProject };
  }
  return null;
}

const stageName = (address) => {
  const stage = stageOf(address.stage);
  return `${stage.number} ${stage.name}`;
};

export const SCREENS = Object.freeze({
  'SCR-142': {
    layout: 'list',
    reads: () => ({ todo: '/api/todo' }),
    fixedTitle: '내 차례',
    title: () => '내 차례',
    description: '모든 프로젝트에서 나를 기다리는 일이에요. 최근 것부터 보여요.',
    skeleton: () => [skeletonGroup(2), skeletonGroup(2)],
    render: () => [],
  },
  'SCR-143': {
    layout: 'list',
    reads: () => ({ projects: '/api/projects' }),
    fixedTitle: '프로젝트',
    title: () => '프로젝트',
    description: '에이전트가 보낸 프로젝트 공간이에요. 최근에 보낸 것부터 보여요.',
    skeleton: () => [skeletonGroup(2, false)],
    render: () => [],
  },
  'SCR-144': {
    layout: 'list',
    reads: projectRead,
    fixedTitle: null,
    title: ({ data }) => data.project.title,
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ data }) => [{ text: '프로젝트', href: PROJECTS_HREF }, { text: data.project.title }],
    skeleton: () => [skeletonGroup(13)],
    render: () => [],
  },
  'SCR-145': {
    layout: 'workbench',
    tabs: true,
    states: WORKBENCH_STATES,
    reads: projectRead,
    fixedTitle: null,
    // The diagram's name, or the stage's when nothing was sent for it.
    title: ({ address, data }) => chosenDiagram(stageRow(data.project, address), address.diagram)?.name || stageOf(address.stage).name,
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ address, data }) => [{ text: data.project.title, href: projectHref(address.project) }, { text: stageName(address) }],
    check: stageGone,
    skeleton: () => [h('div', { class: 'boardbox', 'aria-hidden': 'true' }, h('span', { class: 'sk board' }))],
    // SCR-145#empty when nothing was sent for the stage; the diagram itself is the workbench's.
    render: ({ address, data }) => (chosenDiagram(stageRow(data.project, address), null) === null
      ? [h('div', { class: 'empty' }, h('h2', {}, '아직 보낸 것이 없어요.'), h('p', { class: 'sec' }, '에이전트가 다음에 보낼 때 나와요.'))]
      : []),
    // A ?thread= that is no thread's ID reads as a thread that is gone; a thread's ID is the workbench's to open.
    panel: ({ address, data, shell }) => {
      if (address.thread === null || isThreadId(address.thread)) return [];
      const diagram = chosenDiagram(stageRow(data.project, address), address.diagram);
      const again = stageHref(address.project, address.part, address.stage, { diagram: diagram?.id ?? null });
      return [h('div', { class: 'nt warn', role: 'status' },
        h('div', { class: 'b' }, h('b', {}, shell.message('thread_not_found'))),
        h('a', { class: 'btn tertiary sm', href: again }, '새로 고침'))];
    },
  },
  'SCR-146': {
    layout: 'list',
    tabs: true,
    states: CHANGES_STATES,
    reads: projectRead,
    fixedTitle: '확정 뒤 바뀐 곳',
    title: () => '확정 뒤 바뀐 곳',
    description: '지난 확정 버전 뒤 더하고 빼고 바뀐 요소예요. 이름은 지금 그림의 이름이고, 뺀 요소는 키로 보여요.',
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ address, data }) => [
      { text: data.project.title, href: projectHref(address.project) },
      { text: stageName(address), href: stageHref(address.project, address.part, address.stage, { diagram: address.diagram }) },
      { text: '확정 뒤 바뀐 곳' },
    ],
    check: stageGone,
    skeleton: () => [skeletonGroup(4)],
    render: () => [],
  },
});

// An address that names no screen: "없는 주소예요." with a link to the to-do; the header still works.
export const MISSING = Object.freeze({
  layout: 'list',
  reads: () => ({}),
  fixedTitle: null,
  title: () => null,
  check: () => ({ code: 'not_found', link: { text: '내 차례', href: TODO_HREF } }),
  render: () => [],
});
