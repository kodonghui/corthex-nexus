// The screens of the sitemap (docs/07-sitemap) as the shell runs them (see shell.js and the server README's "App
// shell" section). Each draws its title, its place and its shared states from API-262, API-263 and API-264; its own
// body in the normal and empty states is the task's that builds the screen (TASK-455 to TASK-462): SCR-142's is
// todo.js (TASK-455), SCR-143's is projects.js (TASK-456), SCR-144's is project.js (TASK-457), SCR-145's pictures
// are workbench.js (TASK-458), its workshop on stage 01 is workshop.js (TASK-462), and SCR-146's is changes-page.js
// (TASK-461).
//
// A screen is an object:
// - layout: 'list' (one column, main.main) or 'workbench' (the diagram's column and the work panel, div.wb);
// - tabs: true for the stage tabs under the header;
// - states: the states it has beyond the shared ones, for the 409s that lead to one (see states.js stateOf);
// - reads(address): its API reads, { name: path }; the shell reads them and hands their bodies over as data[name];
// - parts: the names of its reads that fail in their own part of the screen: data[name] keeps what it showed, or is
//   null, shell.missed(name) gives the failure, and the rest of the screen shows as usual;
// - follow(ctx): optional, the reads that need what reads answered, { name: path }, made once every read answered and
//   shown with them as one load, such as the workbench's diagram (API-265), which API-264's list names;
// - fixedTitle: its title before data comes, optionally from the address, or null for a title from data;
// - title(ctx), crumb(ctx) and description (a text, { text, mono }, or a function of ctx giving one): drawn once its
//   data came; without title, the fixed title stays;
// - titleTags(ctx) and titleActions(ctx): optional, nodes drawn once its data came: tags after the title, and buttons
//   at the end of the title's row, such as the workshop's 열림, 스티커 더하기 and Miro에서 가져오기;
// - projectTitle(ctx): the project's title for the header's menu button, on a project's screens;
// - check(ctx): null, or what is gone, { code, sub, link: { text, href }, tabs }, when its data shows the address
//   names nothing, such as an unknown ?d=;
// - gone(code, address): what a read's 404 of that code says under it and links to, { sub, link }, beyond the shell's
//   own (a project that is gone);
// - instead(ctx, gone): after shell.go, what opens instead of a gone thing, { href, note }, or null: the address that
//   replaces the one in the history, and a note the next view gets as ctx.note;
// - skeleton(ctx): the grey shapes of its loading state; panelSkeleton(ctx), on the workbench, its work panel's;
// - render(ctx) and panel(ctx): its body and, on the workbench, its work panel, as nodes.
// ctx is { address, data, shell, via, note }: via is how the address was reached ('open', 'switch' through shell.go, or
// 'instead'), and shell gives read, reload, write, redraw, missed, probe, go, onLeave, keepDraft, draftOf, isPhone,
// message, staleBar, errorNotice, since and outcome.

import { changesBody, changesSkeleton, changesTags } from './changes-page.js';
import { CONFIRM_WORDS } from './confirm.js';
import { diagramApi, HOME_HREF, isDiagramId, isThreadId, projectApi, projectHref, PROJECTS_HREF, stageHref, TODO_HREF } from './address.js';
import { h } from './dom.js';
import { emptyStageGuidance } from './guidance.js';
import { projectBody, projectDescription, projectSkeleton } from './project.js';
import { projectsBody, projectsSkeleton } from './projects.js';
import { SHARED_STATES } from './states.js';
import { stageOf } from './stages.js';
import { todoBody } from './todo.js';
import { descriptionOf, emptyPanel, panelSkeleton, workbenchOf } from './workbench.js';
import { openPart, workshopMissing, workshopMode, workshopRead, workshopShown, workshopView } from './workshop.js';

const WORKBENCH_STATES = Object.freeze([...SHARED_STATES, 'waiting', 'confirmed', 'not-drawn', 'workshop']);
const CHANGES_STATES = Object.freeze([...SHARED_STATES, 'waiting', 'not-drawn', 'confirmed']);
// The most diagrams API-264 lists for a stage (StageState.diagrams, maxItems, of the contract).
export const LISTED_DIAGRAMS = 500;
const DIAGRAM_GONE_SUB = '문서에서 빠졌거나 주소가 바뀌었어요. 작업대의 다른 단계는 그대로 열려요.';

const projectRead = (address) => ({ project: projectApi(address.project) });
const diagramPath = (address, id) => diagramApi(address.project, id);
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

// What a stage screen's data says is gone: the part, or the diagram of ?d=. A diagram's ID that the stage's list
// leaves out is gone only while the list is whole: a stage listed to the most API-264 lists may hold it beyond them,
// and the workbench's own read of the diagram (API-265) says.
export function stageGone({ address, data }) {
  const row = stageRow(data.project, address);
  const toProject = { text: '프로젝트로', href: projectHref(address.project) };
  if (row === undefined) return { code: 'part_not_found', link: toProject, tabs: false };
  const whole = (row.diagrams ?? []).length < LISTED_DIAGRAMS;
  const read = data.diagram !== undefined && data.diagram !== null && data.diagram.id === address.diagram;
  if (address.diagram !== null && !read && chosenDiagram(row, address.diagram) === null && (whole || !isDiagramId(address.diagram))) {
    return { code: 'diagram_not_found', sub: DIAGRAM_GONE_SUB, link: toProject };
  }
  return null;
}

// The workbench's diagram (API-265): the one ?d= names, or the stage's first that is not removed. An ID the stage's list
// leaves out is read only while the list is full (LISTED_DIAGRAMS), as it may hold the diagram beyond it; otherwise
// check() says it is gone.
function workbenchRead({ address, data }) {
  const row = stageRow(data.project, address);
  if (row === undefined) return {};
  const chosen = chosenDiagram(row, address.diagram);
  if (chosen !== null) return { diagram: diagramPath(address, chosen.id) };
  const full = (row.diagrams ?? []).length >= LISTED_DIAGRAMS;
  return address.diagram !== null && full && isDiagramId(address.diagram) ? { diagram: diagramPath(address, address.diagram) } : {};
}

const stageName = (address) => {
  const stage = stageOf(address.stage);
  return `${stage.number} ${stage.name}`;
};

export const SCREENS = Object.freeze({
  'SCR-142': {
    layout: 'list',
    // API-262 for the projects' titles and the empty state's list; the header reads the same two, in one request each.
    reads: () => ({ todo: '/api/todo', projects: '/api/projects' }),
    parts: ['todo', 'progress'],
    follow: ({ address, data }) => {
      const first = address.view !== 'todo' ? data.todo?.morning?.[0] : null;
      return first ? { progress: projectApi(first.project) } : {};
    },
    fixedTitle: ({ address }) => address.view === 'todo' ? '모든 할 일' : '아침 보고',
    title: ({ address }) => address.view === 'todo' ? '모든 할 일' : '아침 보고',
    description: ({ address }) => address.view === 'todo' ? '모든 프로젝트에서 나를 기다리는 일이에요. 오래된 일부터 보여요.' : '오늘 할 일을 확인해 주세요.',
    skeleton: () => [skeletonGroup(2), skeletonGroup(2)],
    render: todoBody,
  },
  'SCR-143': {
    layout: 'list',
    // API-262 for the projects and API-279 for the credentials, each a part: a failed read shows in its own table.
    reads: () => ({ projects: '/api/projects', credentials: '/api/credentials' }),
    parts: ['projects', 'credentials'],
    fixedTitle: '프로젝트',
    description: '에이전트가 보낸 프로젝트 공간이에요. 최근에 보낸 것부터 보여요.',
    skeleton: projectsSkeleton,
    render: projectsBody,
  },
  'SCR-144': {
    layout: 'list',
    reads: (address) => ({ ...projectRead(address), todo: '/api/todo' }),
    parts: ['todo'],
    fixedTitle: null,
    title: ({ data }) => data.project.title,
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ data }) => [{ text: '프로젝트', href: HOME_HREF }, { text: data.project.title }],
    description: projectDescription,
    skeleton: projectSkeleton,
    render: projectBody,
  },
  'SCR-145': {
    layout: 'workbench',
    tabs: true,
    states: WORKBENCH_STATES,
    reads: projectRead,
    // On stage 01 while the workshop is open and no ?d= or ?thread= names a drawn diagram, the workshop (API-285) in
    // place of a diagram (workshop.js).
    follow: (ctx) => (workshopShown(ctx) ? workshopRead(ctx) : workbenchRead(ctx)),
    fixedTitle: null,
    // The workshop's step; else the diagram's name, or the stage's when nothing was sent for it.
    title: (ctx) => {
      const { address, data } = ctx;
      if (workshopShown(ctx)) return workshopMode(ctx) ? workshopView(ctx).title : stageOf(address.stage).name;
      return data.diagram?.name || chosenDiagram(stageRow(data.project, address), address.diagram)?.name || stageOf(address.stage).name;
    },
    description: (ctx) => {
      if (workshopShown(ctx)) return workshopMode(ctx) ? workshopView(ctx).description : null;
      return descriptionOf(ctx.data.diagram, ctx.shell.isPhone());
    },
    titleTags: (ctx) => (workshopMode(ctx) ? workshopView(ctx).tags : null),
    titleActions: (ctx) => (workshopMode(ctx) ? workshopView(ctx).actions : null),
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ address, data }) => [{ text: data.project.title, href: projectHref(address.project) }, { text: stageName(address) }],
    check: stageGone,
    gone: (code, address) => (code === 'diagram_not_found' ? { sub: DIAGRAM_GONE_SUB, link: { text: '프로젝트로', href: projectHref(address.project) } } : null),
    // After choosing a diagram of the list that is gone meanwhile, the stage's first diagram opens with a note (SCR-145).
    instead: ({ address }, gone) => (gone.code === 'diagram_not_found' ? { href: stageHref(address.project, address.part, address.stage), note: 'gone' } : null),
    skeleton: () => [h('div', { class: 'boardbox', 'aria-hidden': 'true' }, h('span', { class: 'sk board' }))],
    panelSkeleton: ({ shell }) => panelSkeleton(shell.isPhone()),
    // SCR-145#workshop on stage 01 while the workshop shows (workshop.js); SCR-145#empty when nothing was sent for the
    // stage; otherwise the workbench's pictures (workbench.js). On stage 01 with no workshop open, 워크숍 열기 comes first.
    render: (ctx) => {
      if (workshopShown(ctx)) return workshopMode(ctx) ? workshopView(ctx).body : workshopMissing(ctx);
      const open = openPart(ctx);
      if (ctx.data.diagram === undefined || ctx.data.diagram === null) {
        return [open, h('div', { class: 'empty' }, h('h2', {}, '아직 보낸 것이 없어요.'), h('p', {}, emptyStageGuidance(ctx.address.stage)))];
      }
      return [open, ...workbenchOf(ctx, stageRow(ctx.data.project, ctx.address)).body];
    },
    // A ?thread= that is no thread's ID reads as a thread that is gone; a thread's ID is the workbench's to open.
    panel: (ctx) => {
      if (workshopShown(ctx)) return workshopMode(ctx) ? workshopView(ctx).panel : [];
      const { address, data, shell } = ctx;
      const own = data.diagram ? workbenchOf(ctx, stageRow(data.project, address)).panel : emptyPanel(shell.isPhone());
      if (address.thread === null || isThreadId(address.thread)) return own;
      const diagram = chosenDiagram(stageRow(data.project, address), address.diagram);
      const again = stageHref(address.project, address.part, address.stage, { diagram: diagram?.id ?? null });
      return [h('div', { class: 'nt warn', role: 'status' },
        h('div', { class: 'b' }, h('b', {}, shell.message('thread_not_found'))),
        h('a', { class: 'btn tertiary sm', href: again }, '새로 고침')), own];
    },
  },
  // The changes since the last confirmation of the diagram the workbench opens (changes-page.js, TASK-461).
  'SCR-146': {
    layout: 'list',
    tabs: true,
    states: CHANGES_STATES,
    reads: projectRead,
    follow: workbenchRead,
    fixedTitle: CONFIRM_WORDS.title,
    description: CONFIRM_WORDS.description,
    titleTags: changesTags,
    projectTitle: ({ data }) => data.project.title,
    crumb: ({ address, data }) => [
      { text: data.project.title, href: projectHref(address.project) },
      { text: stageName(address), href: stageHref(address.project, address.part, address.stage, { diagram: address.diagram }) },
      { text: CONFIRM_WORDS.title },
    ],
    check: stageGone,
    gone: (code, address) => (code === 'diagram_not_found' ? { sub: DIAGRAM_GONE_SUB, link: { text: '프로젝트로', href: projectHref(address.project) } } : null),
    skeleton: changesSkeleton,
    render: changesBody,
  },
});

// An address that names no screen: "없는 주소예요." with a link to the to-do; the header still works.
export const MISSING = Object.freeze({
  layout: 'list',
  reads: () => ({}),
  fixedTitle: null,
  check: () => ({ code: 'not_found', link: { text: '내 차례', href: TODO_HREF } }),
  render: () => [],
});
