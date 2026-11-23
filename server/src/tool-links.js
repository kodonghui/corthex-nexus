// Tool links (TASK-451; API-282, API-283, SPEC-046, SPEC-047): the owner links a Notion page or a Jira project to a
// project or one of its stages, and removes the link. The server keeps the link only (TBL-168). It never calls Notion
// or Jira and holds no token; reading a link's status is TASK-467, so until it is built status and status_read_at
// stay null and the page shows "not read yet" (SPEC-046).
//
// An address counts by its host, never by its path (the coordinator's choice for TASK-451, waiting for the
// maintainer's delegate):
// - Notion: notion.so, notion.site, notion.com and their subdomains, such as www.notion.so and app.notion.com;
// - Jira: a subdomain of atlassian.net whose path does not start with /wiki, which is Confluence's.
// So a database or a board address of the same tool counts too: the server reads neither tool and cannot tell them
// apart. The address must be https, with no user name, password or port other than 443; anything else is
// invalid_request on url, and the refusal never repeats the address.
//
// The same link is the same scope and the same address once its host is in lower case and a :443 port and the
// #fragment are dropped, which is the address kept: the path and query stay as the owner gave them. The same link
// again answers 200 with the link kept. A link with another scope is another link, and one added again after its
// removal is a new link with a new ID. A project holds at most 200 live links, as many as the project read lists
// (Project.tool_links): the 201st is refused.
//
// Removing a link marks it removed (removed_at); the project read no longer lists it, and deleting the project space
// (TASK-448) still counts it. Removed again, it changes nothing: changed false (SPEC-047, "the same result").

import { idOf, keyOf } from './ids.js';
import { invalidRequest, Problem } from './problem.js';
import { STAGES } from './snapshot.js';

const PREFIX = 'tl';
const SCOPES = new Set(['project', ...STAGES]);
// The contract's Link: an https address of at most 2,000 characters without white space.
const URL_LENGTH = 2000;
const LINK = /^https:\/\/\S+$/u;
// What the address may not hold: control characters, which a URL parser drops or rejects, and the backslash, which it
// reads as a slash, so that the host the server checks is the one the address shows.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f\\]/u;
// The live links a project holds: as many as Project.tool_links lists (see project.js).
const LINKS = 200;
const NOT_A_TOOL = 'url must be the address of a Notion page or a Jira project';

// The statements of each store, prepared on first use (see credentials.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      project: store.prepare('SELECT id FROM project_spaces WHERE name = ?'),
      live: store.prepare(
        `SELECT id, scope, tool, url, status, status_read_at, added_at FROM tool_links
         WHERE project_id = ? AND scope = ? AND url = ? AND removed_at IS NULL`,
      ),
      count: store.prepare('SELECT count(*) AS n FROM tool_links WHERE project_id = ? AND removed_at IS NULL'),
      insert: store.prepare('INSERT INTO tool_links (project_id, scope, tool, url, added_at) VALUES (?, ?, ?, ?, ?)'),
      byKey: store.prepare('SELECT id, removed_at FROM tool_links WHERE id = ? AND project_id = ?'),
      remove: store.prepare('UPDATE tool_links SET removed_at = ? WHERE id = ? AND removed_at IS NULL'),
    };
    prepared.set(store, statements);
  }
  return statements;
}

const timeOf = (now) => new Date(now()).toISOString();

// A link as the contract's ToolLink.
function shown(row) {
  return {
    id: idOf(PREFIX, Number(row.id)),
    scope: row.scope,
    tool: row.tool,
    url: row.url,
    status: row.status,
    status_read_at: row.status_read_at,
    added_at: row.added_at,
  };
}

const under = (host, domain) => host === domain || host.endsWith(`.${domain}`);

// Whether a path of atlassian.net is Confluence's: its first segment is wiki, in any case, however it is
// percent-encoded, after any number of slashes and before a slash, a ;parameter or the end.
function isWiki(path) {
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // A path that does not decode is read as written.
  }
  return /^\/+wiki(?:[/;]|$)/iu.test(decoded);
}

// The tool an address belongs to and the address kept, { tool, url }, or an invalid_request Problem on url.
export function toolLinkOf(text) {
  if (typeof text !== 'string') throw invalidRequest('url', 'url must be text');
  if (!text.isWellFormed() || [...text].length > URL_LENGTH || !LINK.test(text) || UNSAFE.test(text)) {
    throw invalidRequest('url', `url must be an https address of at most ${URL_LENGTH} characters`);
  }
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw invalidRequest('url', 'url must be an https address');
  }
  if (parsed.username !== '' || parsed.password !== '') throw invalidRequest('url', 'url must not hold a user name or password');
  // The authority as written, which must be the host the parser read: in lower case, and with :443 at most.
  const rest = text.slice('https://'.length);
  const end = rest.search(/[/?#]/u);
  const authority = (end === -1 ? rest : rest.slice(0, end)).toLowerCase();
  if (parsed.port !== '' || (authority !== parsed.host && authority !== `${parsed.host}:443`)) throw invalidRequest('url', NOT_A_TOOL);
  const host = parsed.hostname;
  let tool = null;
  if (under(host, 'notion.so') || under(host, 'notion.site') || under(host, 'notion.com')) tool = 'notion';
  else if (host.endsWith('.atlassian.net') && !isWiki(parsed.pathname)) tool = 'jira';
  if (tool === null) throw invalidRequest('url', NOT_A_TOOL);
  // The path and query as given, without the fragment.
  const tail = end === -1 ? '' : rest.slice(end);
  const hash = tail.indexOf('#');
  return { tool, url: `https://${parsed.host}${hash === -1 ? tail : tail.slice(0, hash)}` };
}

// NewToolLink: { scope, url }. A refusal names the field, never the value.
function newLinkOf(body) {
  if (Object.keys(body).some((field) => field !== 'scope' && field !== 'url')) throw invalidRequest('body', 'the body takes scope and url only');
  if (!Object.hasOwn(body, 'scope')) throw invalidRequest('scope', 'scope is required');
  if (typeof body.scope !== 'string' || !SCOPES.has(body.scope)) throw invalidRequest('scope', 'scope must be project or a stage');
  if (!Object.hasOwn(body, 'url')) throw invalidRequest('url', 'url is required');
  return { scope: body.scope, ...toolLinkOf(body.url) };
}

function projectOf(statements, name) {
  const project = statements.project.get(name);
  if (project === undefined) throw new Problem('project_not_found');
  return Number(project.id);
}

// API-282: links a Notion page or a Jira project to the project or a stage (SPEC-046). The same link again answers
// 200 with the link kept.
function addToolLink({ store, params, body, now }) {
  const statements = statementsOf(store);
  const projectId = projectOf(statements, params.project);
  const { scope, tool, url } = newLinkOf(body);
  const kept = statements.live.get(projectId, scope, url);
  if (kept !== undefined) return { body: shown(kept) };
  if (Number(statements.count.get(projectId).n) >= LINKS) throw invalidRequest('url', `a project holds at most ${LINKS} tool links`);
  const addedAt = timeOf(now);
  const { lastInsertRowid } = statements.insert.run(projectId, scope, tool, url, addedAt);
  return { status: 201, body: shown({ id: lastInsertRowid, scope, tool, url, status: null, status_read_at: null, added_at: addedAt }) };
}

// API-283: removes a tool link (SPEC-047). Removed again: changed false.
function removeToolLink({ store, params, now }) {
  const statements = statementsOf(store);
  const projectId = projectOf(statements, params.project);
  const key = keyOf(PREFIX, params.link);
  const row = key === null ? undefined : statements.byKey.get(key, projectId);
  if (row === undefined) throw new Problem('tool_link_not_found');
  const id = idOf(PREFIX, key);
  if (row.removed_at !== null) return { body: { id, changed: false } };
  statements.remove.run(timeOf(now), key);
  return { body: { id, changed: true } };
}

// The routes of API-282 and API-283 (see router.js), of the owner family.
export const TOOL_LINK_ROUTES = Object.freeze([
  {
    method: 'POST',
    path: '/api/projects/{project}/tool-links',
    action: 'addToolLink',
    params: { project: 'project_not_found' },
    body: 'json',
    requestKey: true,
    handle: addToolLink,
  },
  {
    method: 'DELETE',
    path: '/api/projects/{project}/tool-links/{link}',
    action: 'removeToolLink',
    params: { project: 'project_not_found', link: 'tool_link_not_found' },
    requestKey: true,
    handle: removeToolLink,
  },
]);
