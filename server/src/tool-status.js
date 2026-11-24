// The tool status read (TASK-467; SPEC-046, REQ-058, REQ-061; TBL-168): the server reads the status of each live
// Notion page and Jira project link with read-only tokens that only its environment holds (settings.js's
// readToolSettings), and keeps the status and the time it was read on the link.
//
// - Where it asks. Only two hosts, fixed here and never taken from a setting or a link: api.notion.com for Notion and
//   api.atlassian.com for Jira, through its gateway for scoped API tokens, /ex/jira/{cloud ID}. A link gives only an
//   ID, checked by its form: a Notion page ID of exactly 32 hex digits, with or without its dashes, ending the last
//   segment of its path; a Jira project key from /browse/KEY, /browse/KEY-12 or /jira/.../projects/KEY on the one site
//   the settings name. So the stored address is never fetched, and a link cannot send the server elsewhere. No
//   redirect is followed, an answer is read up to 1 MiB, and each token goes only to its own tool's host.
// - What the status is. Notion: the page's first property of type status, else a select property named Status or 상태
//   (in any case); a page with neither is read with status null; a page in the trash is "휴지통에 있음". Jira: the
//   project's work items by status category, from three approximate counts, as "할 일 3 · 진행 중 2 · 완료 10". The
//   status is cut to 120 characters, the contract's limit, with its control characters made spaces.
// - When. Every minute the job looks for live links not read for 30 minutes, so a new link is read within a minute
//   and each link about every 30 minutes. A round still running when the next look is due makes that look skip. It
//   reads one link at a time, at most two requests a second for each tool, each request ending after 10 seconds.
// - What a failure keeps. A link that cannot be read keeps its last status and the time it was read (REQ-061); one
//   never read keeps status_read_at null, "not read yet". A 401, 403 or 429 stops that tool until the next 30
//   minutes, so a refused token is not tried on every link. A tool with no token is never called.
// - The log. One line per tool and round that asked anything: how many links were read, failed and gave no ID, and
//   for each failure the link's ID, the kind and the HTTP status. Never a token, an address, a page ID, a project key,
//   the site, its cloud ID, the account or anything a tool answered (rule 5).

import { idOf } from './ids.js';
import { errorKind } from './log.js';

export const NOTION_API = 'https://api.notion.com';
export const JIRA_API = 'https://api.atlassian.com';
// The Notion API version the page read is written for.
export const NOTION_VERSION = '2025-09-03';
export const LOOK_MS = 60_000;
export const INTERVAL_MS = 30 * 60_000;
export const GAP_MS = 500;
export const REQUEST_MS = 10_000;
export const ANSWER_BYTES = 1024 * 1024;
export const STATUS_CHARS = 120;
// The failures listed in one log line; the counts hold all of them.
const LOGGED_FAILURES = 20;

export const TRASHED = '휴지통에 있음';
// Jira's status categories, by the names JQL takes, and the words the status shows for them.
const CATEGORIES = Object.freeze([['To Do', '할 일'], ['In Progress', '진행 중'], ['Done', '완료']]);
const STATUS_NAMES = new Set(['status', '상태']);

// A Notion page ID: 32 hex digits, or the same with the dashes of a UUID, ending the path's last segment, alone or
// after a hyphen (Page-title-<ID>).
const NOTION_ID = /^(?:.*-)?([0-9a-f]{32})$/isu;
const NOTION_UUID = /^(?:.*-)?([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/isu;
// A Jira project key as Jira forms it: a capital letter, then capitals, digits or _, 2 to 255 characters.
const JIRA_KEY = '[A-Z][A-Z0-9_]{1,254}';
const JIRA_PATHS = Object.freeze([
  new RegExp(`^/browse/(${JIRA_KEY})(?:-[0-9]{1,18})?/?$`, 'u'),
  new RegExp(`^/jira/(?:[a-z]{1,40}/){0,4}projects/(${JIRA_KEY})(?:/|$)`, 'u'),
]);
// Characters a status does not keep: control characters and the line and paragraph separators.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/gu;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const iso = (ms) => new Date(ms).toISOString();

function parse(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// The page ID a Notion link gives, 32 lowercase hex digits, or null: for an address with no page ID, and for a
// database view (?v=), which is not a page.
export function notionPageOf(url) {
  const parsed = parse(url);
  if (parsed === null || parsed.searchParams.has('v')) return null;
  const last = parsed.pathname.split('/').filter((segment) => segment !== '').at(-1);
  if (last === undefined || last.length > 2000) return null;
  const found = NOTION_ID.exec(last) ?? NOTION_UUID.exec(last);
  return found === null ? null : found.slice(1).join('').toLowerCase();
}

// The project key a Jira link on site gives, or null: for another site and for an address with no key.
export function jiraProjectOf(url, site) {
  const parsed = parse(url);
  if (parsed === null || parsed.hostname !== site) return null;
  for (const pattern of JIRA_PATHS) {
    const found = pattern.exec(parsed.pathname);
    if (found !== null) return found[1];
  }
  return null;
}

// The JQL of a project's work items of one status category. key has passed JIRA_KEY, so it holds no quote, and it is
// put inside double quotes: a link can never change the query.
export function categoryQuery(key, category) {
  if (!new RegExp(`^${JIRA_KEY}$`, 'u').test(key)) throw new TypeError('a Jira project key');
  return `project = "${key}" AND statusCategory = "${category}"`;
}

// A status as kept: Unicode text without control characters, at most STATUS_CHARS characters; null when empty.
export function statusText(value) {
  if (typeof value !== 'string') return null;
  const text = value.toWellFormed().replace(CONTROL, ' ').replace(/\s+/gu, ' ').trim();
  if (text === '') return null;
  const characters = [...text];
  return characters.length <= STATUS_CHARS ? text : `${characters.slice(0, STATUS_CHARS - 1).join('')}…`;
}

const optionName = (option) => (isObject(option) ? statusText(option.name) : null);

// A Notion page's status (see the top of this file).
export function notionStatus(page) {
  if (page.in_trash === true || page.archived === true) return TRASHED;
  const properties = isObject(page.properties) ? Object.entries(page.properties).filter(([, value]) => isObject(value)) : [];
  const status = properties.find(([, value]) => value.type === 'status');
  if (status !== undefined) return optionName(status[1].status);
  const select = properties.find(([name, value]) => value.type === 'select' && STATUS_NAMES.has(name.trim().toLowerCase()));
  return select === undefined ? null : optionName(select[1].select);
}

// What failed, by the answer's HTTP status.
function failureOf(status) {
  if (status === 401 || status === 403) return 'refused';
  if (status === 404) return 'not_found';
  if (status === 429) return 'busy';
  if (status >= 300 && status < 400) return 'redirect';
  if (status >= 500) return 'server';
  return 'rejected';
}

// The answer's body as JSON, read up to ANSWER_BYTES; null for a larger or broken one.
async function jsonOf(response) {
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of response.body ?? []) {
      size += chunk.byteLength;
      if (size > ANSWER_BYTES) {
        await response.body.cancel().catch(() => {});
        return null;
      }
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

// The tool status job. settings is settings.tools: { notion, jira }, each null when not set. queue is the server's one
// queue of store writes (writes.js) and log the server's log. fetch, now and the timers are Node's own; tests replace
// them to stub the tools' answers and move the clock. Returns { start(), stop(), round() }: start() starts the looks
// when a tool has a token, stop() ends them and the read that runs, and round() is one look, for the tests.
export function createToolStatus({
  store, settings, queue, log, fetch = globalThis.fetch, now = Date.now, timers = { setTimeout, clearTimeout },
}) {
  const statements = {
    live: store.prepare('SELECT id, tool, url FROM tool_links WHERE removed_at IS NULL ORDER BY id'),
    keep: store.prepare('UPDATE tool_links SET status = ?, status_read_at = ? WHERE id = ? AND removed_at IS NULL'),
  };
  // When each live link was last tried, and until when a tool that refused is left alone, in milliseconds.
  const tried = new Map();
  const pausedUntil = new Map();
  const lastRequest = new Map();
  const stopping = new AbortController();
  let timer = null;
  let running = false;
  let stopped = false;

  const sleep = (ms) => new Promise((resolve) => { timers.setTimeout(resolve, ms); });

  // Asks one of the two hosts, at most two requests a second for each tool. Returns { body } or { kind, status }.
  async function ask(tool, url, init) {
    const wait = (lastRequest.get(tool) ?? -Infinity) + GAP_MS - now();
    if (wait > 0) await sleep(wait);
    if (stopped) return { kind: 'stopped', status: null };
    lastRequest.set(tool, now());
    let response;
    try {
      response = await fetch(url, {
        ...init,
        redirect: 'manual',
        signal: AbortSignal.any([stopping.signal, AbortSignal.timeout(REQUEST_MS)]),
      });
    } catch (error) {
      if (stopped) return { kind: 'stopped', status: null };
      return { kind: error?.name === 'TimeoutError' ? 'timeout' : 'network', status: null };
    }
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => {});
      return { kind: failureOf(response.status), status: response.status };
    }
    const body = await jsonOf(response);
    return isObject(body) ? { body } : { kind: 'answer', status: 200 };
  }

  const readers = {};
  if (settings.notion !== null) {
    const headers = {
      accept: 'application/json',
      authorization: `Bearer ${settings.notion.token}`,
      'notion-version': NOTION_VERSION,
    };
    readers.notion = {
      target: notionPageOf,
      async read(page) {
        const answer = await ask('notion', `${NOTION_API}/v1/pages/${page}`, { method: 'GET', headers });
        if (answer.body === undefined) return answer;
        if (answer.body.object !== 'page') return { kind: 'answer', status: 200 };
        return { status: notionStatus(answer.body) };
      },
    };
  }
  if (settings.jira !== null) {
    const { site, cloudId, email, token } = settings.jira;
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
    };
    const url = `${JIRA_API}/ex/jira/${cloudId}/rest/api/3/search/approximate-count`;
    readers.jira = {
      target: (link) => jiraProjectOf(link, site),
      async read(key) {
        const counts = [];
        for (const [category, word] of CATEGORIES) {
          const answer = await ask('jira', url, { method: 'POST', headers, body: JSON.stringify({ jql: categoryQuery(key, category) }) });
          if (answer.body === undefined) return answer;
          const { count } = answer.body;
          if (!Number.isSafeInteger(count) || count < 0) return { kind: 'answer', status: 200 };
          counts.push(`${word} ${count}`);
        }
        return { status: counts.join(' · ') };
      },
    };
  }

  // One look: reads each live link of a tool with a token that is due, one at a time.
  async function round() {
    if (running || stopped) return;
    running = true;
    try {
      const links = await queue(() => statements.live.all());
      const live = new Set(links.map((link) => Number(link.id)));
      for (const id of tried.keys()) if (!live.has(id)) tried.delete(id);
      const tally = new Map();
      for (const link of links) {
        if (stopped) break;
        const id = Number(link.id);
        const reader = readers[link.tool];
        if (reader === undefined || (pausedUntil.get(link.tool) ?? -Infinity) > now()) continue;
        if (tried.has(id) && now() - tried.get(id) < INTERVAL_MS) continue;
        tried.set(id, now());
        if (!tally.has(link.tool)) tally.set(link.tool, { read: 0, failed: 0, no_id: 0, failures: [] });
        const counts = tally.get(link.tool);
        const target = reader.target(link.url);
        if (target === null) {
          counts.no_id += 1;
          continue;
        }
        const outcome = await reader.read(target);
        if (outcome.kind === 'stopped' || stopped) break;
        if (outcome.kind === undefined) {
          await queue(() => statements.keep.run(outcome.status, iso(now()), id));
          counts.read += 1;
          continue;
        }
        counts.failed += 1;
        if (counts.failures.length < LOGGED_FAILURES) counts.failures.push({ link: idOf('tl', id), kind: outcome.kind, status: outcome.status });
        // A refused token or a tool that asks to slow down is left alone until the next 30 minutes.
        if (outcome.kind === 'refused' || outcome.kind === 'busy') pausedUntil.set(link.tool, now() + INTERVAL_MS);
      }
      if (stopped) return;
      for (const [tool, counts] of tally) {
        if (counts.read + counts.failed === 0) continue;
        log({ time: iso(now()), event: 'tool_status_read', tool, ...counts });
      }
    } catch (error) {
      log({ time: iso(now()), event: 'tool_status_failed', error: errorKind(error) });
    } finally {
      running = false;
    }
  }

  function look() {
    timer = null;
    if (stopped) return;
    timer = timers.setTimeout(look, LOOK_MS);
    round();
  }

  return {
    start() {
      if (stopped || Object.keys(readers).length === 0) return;
      look();
    },
    stop() {
      stopped = true;
      stopping.abort();
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    },
    round,
  };
}
