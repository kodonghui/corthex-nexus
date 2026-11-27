// The pages' addresses (docs/07-sitemap, section 5): which screen an address names, and the addresses of the screens.
// The server serves the shell for exactly the addresses parseAddress names a screen for (see src/pages.js), and the
// page reads its screen from the same function, so the two never disagree.
//
//   /                                          SCR-142, project home; ?view=todo opens the owner's to-do
//   /p                                         SCR-143, the projects
//   /p/{project}                               SCR-144, a project (#data is the page's own)
//   /p/{project}/{part or _}/{stage}           SCR-145, the stage workbench, with ?d={diagram} and ?thread={thread}
//   /p/{project}/{part or _}/{stage}/changes   SCR-146, the changes since the last confirmation, with ?d={diagram}
//
// `_` is the project as a whole, whose part is the empty string in the API. A project and a part are named as the
// contract's ProjectName and Part are, so an address never needs escaping; any other form names no screen. ?d= and
// ?thread= are read as they are given: whether one is a diagram or a thread of the project is the screen's to say.

import { STAGES } from './stages.js';

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIAGRAM = /^dg_[0-9a-hjkmnp-tv-z]{12}$/;
const THREAD = /^nc_[0-9a-hjkmnp-tv-z]{12}$/;
const STAGE_IDS = new Set(STAGES.map((stage) => stage.id));

export const HOME_HREF = '/';
export const TODO_HREF = '/?view=todo';
export const PROJECTS_HREF = '/p';

export const isProjectName = (value) => typeof value === 'string' && value.length <= 64 && NAME.test(value);
export const isPartName = (value) => typeof value === 'string' && value.length <= 100 && NAME.test(value);
// A diagram's and a comment thread's ID (DiagramId and CommentId of the contract).
export const isDiagramId = (value) => typeof value === 'string' && DIAGRAM.test(value);
export const isThreadId = (value) => typeof value === 'string' && THREAD.test(value);

// The screen pathname and search name: { screen, project, part, stage, diagram, thread } with only the members of
// that screen, diagram and thread being the query's text or null; or null when the address names no screen.
export function parseAddress(pathname, search = '') {
  if (pathname === '/') return new URLSearchParams(search).get('view') === 'todo' ? { screen: 'SCR-142', view: 'todo' } : { screen: 'SCR-142' };
  if (pathname === '/p') return { screen: 'SCR-143' };
  const parts = pathname.split('/');
  if (parts[0] !== '' || parts[1] !== 'p' || !isProjectName(parts[2])) return null;
  const project = parts[2];
  if (parts.length === 3) return { screen: 'SCR-144', project };
  if (parts.length !== 5 && parts.length !== 6) return null;
  if (parts[3] !== '_' && !isPartName(parts[3])) return null;
  if (!STAGE_IDS.has(parts[4])) return null;
  const query = new URLSearchParams(search);
  const place = { project, part: parts[3] === '_' ? '' : parts[3], stage: parts[4], diagram: query.get('d') };
  if (parts.length === 5) return { screen: 'SCR-145', ...place, thread: query.get('thread') };
  return parts[5] === 'changes' ? { screen: 'SCR-146', ...place } : null;
}

export function projectHref(project) {
  return `/p/${encodeURIComponent(project)}`;
}

// A project's path in the API (API-264), which its other operations extend.
export function projectApi(project) {
  return `/api/projects/${encodeURIComponent(project)}`;
}

// A diagram's API path (API-265), under which its mockup page (API-293) and its positions (API-274) are.
export function diagramApi(project, diagram) {
  return `${projectApi(project)}/diagrams/${encodeURIComponent(diagram)}`;
}

// The workbench of a stage, at a diagram and a thread when they are given.
export function stageHref(project, part, stage, { diagram = null, thread = null } = {}) {
  return `${stagePath(project, part, stage)}${query({ d: diagram, thread })}`;
}

// The changes page of a stage, for a diagram when it is given.
export function changesHref(project, part, stage, { diagram = null } = {}) {
  return `${stagePath(project, part, stage)}/changes${query({ d: diagram })}`;
}

function stagePath(project, part, stage) {
  return `${projectHref(project)}/${part === '' ? '_' : encodeURIComponent(part)}/${encodeURIComponent(stage)}`;
}

function query(values) {
  const entries = Object.entries(values).filter(([, value]) => value !== null && value !== undefined);
  return entries.length === 0 ? '' : `?${new URLSearchParams(entries)}`;
}
