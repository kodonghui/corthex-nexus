// The app shell: the frame every screen opens in, the header, the stage tabs, and the shared loading, error,
// permission and stale states (docs/08-screens, sections 2 and 3). A screen is a module of screens.js that the shell
// runs; the server README's "App shell" section says how one plugs in.
//
// The page holds no project data before the API answers it: the shell reads the screen's data and the header's, and
// draws nothing of a project until a read answered it. It keeps nothing an API answered (see storage.js).

import { parseAddress, PROJECTS_HREF, projectHref, stageHref, TODO_HREF } from './address.js';
import { probe, read, write } from './api.js';
import { fill, h, icon } from './dom.js';
import { MESSAGES } from './messages.js';
import { STAGES } from './stages.js';
import { ago, GATE_KEY, gateStep, readTag, SHARED_STATES, stateOf, switchName, THEME_KEY, themeOf } from './states.js';
import { draftOf, keepDraft, store, stored } from './storage.js';

// The header's reads: API-262 for the project menu and API-263 for "내 차례 N".
const PROJECTS = '/api/projects';
const TODO = '/api/todo';
const PHONE = '(max-width: 1055.98px) and (pointer: coarse)';
const TICK_MS = 30_000;
// The 404 of a read, by its code: what the screen says under the code's message, and where its link goes.
const GONE = Object.freeze({
  project_not_found: { sub: '지워졌거나 주소가 바뀌었어요.', link: { text: '프로젝트 목록', href: PROJECTS_HREF }, tabs: false },
});

// The Korean message of a Problem code, from the contract's registry (see src/problem.js).
export function message(code) {
  return Object.hasOwn(MESSAGES, code ?? '') ? MESSAGES[code] : MESSAGES.internal;
}

// Whether this is a phone: a touch screen narrower than 1056 px, where PC-only actions are not offered (SPEC-051).
export function isPhone() {
  return globalThis.matchMedia?.(PHONE).matches ?? false;
}

// Runs screen at address in root, the page's #app, and returns the shell it gives the screen.
export function startShell(root, screen, address) {
  const states = screen.states ?? SHARED_STATES;
  // The reads whose failure shows in the screen's own part (shell.missed), not in place of the whole screen.
  const parts = new Set(screen.parts ?? []);
  const leaving = [];
  let round = new Map();
  let data = null;
  let readAt = null;
  let reread = null;
  let ended = false;
  let busy = false;
  // A load asked for while one runs, such as a reload after a write: null, or whether it reads again (refresh). Each
  // ask's promise ends once that load has ended, as if it had run at once.
  let queued = null;
  let waiting = [];
  let tag = null;
  // The times the view shows as how long ago they were (since), each moved on with the read time.
  let clocks = [];
  // The outcomes of the parts' reads that failed in the last load, by the read's name.
  let misses = {};
  // Whether a part's read again failed and the part kept what it showed, so the read time shows (states.js readTag).
  let partStale = false;
  // How the address was last reached: 'open' (the page opened, or the browser went back or forward to it), 'switch'
  // (shell.go) or 'instead' (see showGone), and the note a screen's instead() left for its next view.
  let via = 'open';
  let note = null;
  // How many times the address changed in the page (arrive, or showGone's instead): a load whose address changed while
  // it read leaves its answers unshown, and the load the change asked for shows the new address.
  let arrivals = 0;
  // Whether the load waiting in queued is a reload('instead'). The running load sets via back to 'open' when it
  // settles, so the waiting one takes 'switch' only as it starts; a change of address forgets it.
  let insteadNext = false;

  const shell = {
    read: (path) => {
      if (!round.has(path)) round.set(path, read(path));
      return round.get(path);
    },
    reload,
    write: writeOf,
    redraw,
    missed: (name) => misses[name] ?? null,
    probe: probeOf,
    go,
    onLeave: (keep) => leaving.push(keep),
    keepDraft,
    draftOf,
    isPhone,
    message,
    staleBar,
    errorNotice,
    since,
    outcome,
  };
  const header = createHeader(address);
  const tabs = screen.tabs ? stageTabs(address) : null;
  const view = h('div', { class: 'view' });
  fill(root, header.element, tabs, view);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && data !== null) load(true);
  });
  globalThis.addEventListener?.('popstate', () => arrive(globalThis.location.pathname, globalThis.location.search, 'open'));
  setInterval(showTimes, TICK_MS);
  load(false);
  return shell;

  // Reads the screen's data and the header's. A first load shows the loading state; a read again (refresh) keeps
  // what is shown until its answer replaces it, and when it fails keeps it with the error notice and the read time.
  // A load asked for while one runs waits for it and then runs once, so no answer older than the request stays; its
  // promise ends when that load ends.
  async function load(refresh) {
    if (ended) return undefined;
    if (busy) {
      queued = queued === false ? false : refresh;
      return new Promise((resolve) => { waiting.push(resolve); });
    }
    busy = true;
    round = new Map();
    const at = arrivals;
    const how = via;
    if (!refresh) {
      data = null;
      render({ loading: true });
    }
    // A header read again that fails keeps what the header shows, as the screen keeps its data.
    const keep = () => {};
    const headerReads = [
      headerRead(PROJECTS, (body) => header.projects(body), refresh ? keep : () => header.noProjects()),
      headerRead(TODO, (body) => header.todo(body), refresh ? keep : () => header.noTodo()),
    ];
    const reads = Object.entries(screen.reads(address));
    const outcomes = await Promise.all(reads.map(([, path]) => shell.read(path)));
    // The reads that need what the first ones answered, such as the workbench's diagram (API-265), which API-264's list
    // names: made once every first read answered, and shown with them as one load.
    if (screen.follow !== undefined && outcomes.every((outcome) => stateOf(outcome, states).state === 'normal')) {
      const answered = Object.fromEntries(reads.map(([name], index) => [name, outcomes[index].body]));
      const more = Object.entries(screen.follow({ address, data: answered, shell, via, note }));
      reads.push(...more);
      outcomes.push(...await Promise.all(more.map(([, path]) => shell.read(path))));
    }
    await Promise.all(headerReads);
    busy = false;
    if (!ended && at === arrivals) {
      settle(refresh, reads, outcomes, how);
      // Only the load the switch asked for opens something else instead of a gone thing; a later one, such as a read
      // again or a reload after a write, shows it gone.
      if (at === arrivals) via = 'open';
    }
    const asked = waiting;
    waiting = [];
    if (queued !== null && !ended) {
      const next = queued;
      queued = null;
      if (insteadNext) via = 'switch';
      insteadNext = false;
      load(next).then(() => asked.forEach((resolve) => resolve()));
    } else {
      queued = null;
      asked.forEach((resolve) => resolve());
    }
    return undefined;
  }

  // Shows what a load's reads answered. A read of one of the screen's parts that fails leaves the rest of the screen
  // as it is: the part keeps what it showed, or has null on a first load, and the screen shows the failure there.
  function settle(refresh, reads, outcomes, how) {
    const found = outcomes.map((outcome) => stateOf(outcome, states));
    const denied = found.findIndex(({ state }) => state === 'permission');
    if (denied !== -1) return permission(found[denied].kind, outcomes[denied]);
    const failed = found.findIndex(({ state }, index) => state !== 'normal' && !parts.has(reads[index][0]));
    // A read again that fails keeps the data, unless what it read is gone.
    if (failed !== -1 && refresh && data !== null && found[failed].kind !== 'gone') {
      reread = outcomes[failed];
      return again(showData);
    }
    if (failed !== -1) {
      data = null;
      if (found[failed].kind === 'gone') return showGone(goneOf(outcomes[failed].code), how);
      return render({ failure: outcomes[failed] });
    }
    if (found.length === 0 || found.some(({ state }) => state === 'normal')) succeeded();
    const missed = {};
    // Whether a part kept what an earlier read showed: the read time then stays that of the earlier read.
    let kept = false;
    const next = Object.fromEntries(reads.map(([name], index) => {
      if (found[index].state === 'normal') return [name, outcomes[index].body];
      missed[name] = outcomes[index];
      const before = refresh && data !== null ? data[name] ?? null : null;
      if (before !== null) kept = true;
      return [name, before];
    }));
    // A read again that answers what is shown leaves the view as it is, with what the owner typed, chose or
    // scrolled to; only the read time moves.
    const whole = Object.keys(missed).length === 0 && Object.keys(misses).length === 0;
    const same = refresh && whole && reread === null && data !== null && JSON.stringify(next) === JSON.stringify(data);
    data = next;
    misses = missed;
    if (!kept) readAt = Date.now();
    reread = null;
    partStale = kept;
    if (same) return showTimes();
    if (refresh) return again(showData);
    showData();
  }

  // Reads the screen's data again. reload('instead') is a read again after which a gone thing opens what the screen
  // gives instead, as after a switch: TASK-459 reads a removed diagram again so, after closing its last thread, since
  // nothing may keep it listed then (SPEC-027). Its promise ends once that read again has ended (see load).
  function reload(how) {
    if (how === 'instead' && busy) insteadNext = true;
    else if (how === 'instead') via = 'switch';
    return load(true);
  }

  // A write of the screen's (api.js write), whose outcome it returns. A 401 or 403 goes through the permission rule,
  // which ends the page or reloads it through the gate, as a read's does.
  async function writeOf(method, path, body, key, options) {
    return met(await write(method, path, body, key, options));
  }

  // An outcome of the screen's own request, met by the permission rule and the gate's mark, and returned.
  function met(outcome) {
    const { state, kind } = stateOf(outcome, states);
    if (state === 'permission') permission(kind, outcome);
    else if (state === 'normal') succeeded();
    return outcome;
  }

  // Draws the screen again from the data it has, without a read, as after a change of its own state such as a write
  // that began or ended. It does nothing before the data came or once the page ended.
  function redraw() {
    if (data !== null && !ended) again(showData);
  }

  // The status of a page that an operation serves rather than JSON (api.js probe), such as the mockup page (API-293)
  // before its frame shows it. A 401 or 403 goes through the permission rule, as a read's does.
  async function probeOf(path) {
    return met(await probe(path));
  }

  // Opens href in this page when it is another address of the same screen and place, such as another diagram of the
  // stage (?d=): the address goes into the browser's history and the screen loads it, as on opening, with its loading
  // state. Any other address opens as a page of its own.
  function go(href) {
    const { pathname, search } = partsOf(href);
    if (!samePlace(parseAddress(pathname, search))) {
      globalThis.location.assign(href);
      return;
    }
    globalThis.history.pushState(null, '', href);
    arrive(pathname, search, 'switch');
  }

  // Loads the address the page is now at, reached as how says (see via). The browser going back or forward to another
  // page's address reloads the page.
  function arrive(pathname, search, how) {
    if (ended) return;
    const next = parseAddress(pathname, search);
    if (!samePlace(next)) {
      globalThis.location.reload();
      return;
    }
    Object.assign(address, next);
    arrivals += 1;
    via = how;
    insteadNext = false;
    note = null;
    load(false);
  }

  function samePlace(next) {
    return next !== null && ['screen', 'project', 'part', 'stage'].every((name) => next[name] === address[name]);
  }

  // What is gone, in place of the view, unless the screen opens something else instead (screen.instead): when the load
  // a switch asked for (how) finds it, the workbench opens the stage's first diagram with a note (SCR-145). The address
  // it gives replaces the one in the history; a second gone thing shows as gone.
  function showGone(gone, how = 'open') {
    const other = how === 'switch' ? screen.instead?.(context(), gone) ?? null : null;
    if (other === null) return render({ gone });
    const { pathname, search } = partsOf(other.href);
    globalThis.history.replaceState(null, '', other.href);
    Object.assign(address, parseAddress(pathname, search));
    arrivals += 1;
    via = 'instead';
    insteadNext = false;
    note = other.note ?? null;
    load(false);
  }

  // Draws the view again where the page is scrolled to.
  function again(draw) {
    const y = globalThis.scrollY ?? 0;
    draw();
    globalThis.scrollTo?.(0, y);
  }

  function headerRead(path, show, hide) {
    return shell.read(path).then((outcome) => {
      const { state, kind } = stateOf(outcome);
      if (ended) return;
      if (state === 'normal') {
        succeeded();
        show(outcome.body);
      } else if (state === 'permission') {
        permission(kind, outcome);
      } else {
        hide();
      }
    });
  }

  // A screen's own read or write, such as SCR-144's removal preview or a tool link (see the server README's "App
  // shell"), meets the shell's states as the screen's reads do: a 401 goes through the gate, keeping unsent text, a 403
  // shows its message in place of the page, and a 404 of what the page shows, such as project_not_found, shows it
  // gone. The shell takes the page then, and returns null; after gone it reads nothing more, so a load still under way
  // cannot draw the page over it. Otherwise it returns stateOf's { state, kind } for the screen to show by what it
  // sent: normal (a success, or a 404 that is the normal state), error with its kind, or stale.
  function outcome(answer) {
    const found = stateOf(answer, states);
    if (ended) return null;
    if (found.state === 'permission') {
      permission(found.kind, answer);
      return null;
    }
    if (found.kind === 'gone') {
      ended = true;
      data = null;
      render({ gone: goneOf(answer.code) });
      return null;
    }
    if (found.state === 'normal') succeeded();
    return found;
  }

  // A read answered, so the gate let the page through: a later 401 may reload once again.
  function succeeded() {
    store('sessionStorage', GATE_KEY, null);
  }

  function context() {
    return { address, data, shell, via, note };
  }

  function showData() {
    const ctx = context();
    const gone = screen.check?.(ctx) ?? null;
    header.current(screen.projectTitle?.(ctx) ?? null);
    // While a load settles, via is still how its address was reached; a later redraw's is 'open'.
    if (gone !== null) return showGone(gone, via);
    render({ ctx });
  }

  // What a read's 404 says is gone: its code, with what the shell, or else the screen (screen.gone), says under it and
  // links to.
  function goneOf(code) {
    return { code, ...(GONE[code] ?? screen.gone?.(code, address) ?? {}) };
  }

  // Draws the view: the loading state, a failed read, a gone thing, or the screen's data.
  function render({ loading = false, failure = null, gone = null, ctx = null }) {
    clocks = [];
    if (gone !== null) {
      if (tabs !== null) tabs.hidden = gone.tabs === false;
      document.title = 'NEXUS';
      tag = null;
      fill(view, h('main', { class: 'center' },
        h('h1', {}, message(gone.code)),
        gone.sub ? h('p', { class: 'sec' }, gone.sub) : null,
        h('a', { class: 'btn tertiary', href: (gone.link ?? { href: TODO_HREF }).href }, (gone.link ?? { text: '내 차례' }).text)));
      return;
    }
    if (tabs !== null) tabs.hidden = false;
    const known = ctx ?? context();
    // What the screen draws from its data only once the data came; until then its fixed title, if it has one.
    const answered = !loading && failure === null;
    const title = answered && screen.title !== undefined ? screen.title(known) : screen.fixedTitle ?? null;
    const description = typeof screen.description === 'function'
      ? (answered ? screen.description(known) : null)
      : screen.description ?? null;
    document.title = title === null ? 'NEXUS' : `${title} · NEXUS`;
    tag = h('span', { class: 'tag gray', hidden: true });
    const top = [];
    if (screen.crumb !== undefined && answered) top.push(crumbOf(screen.crumb(known)));
    else if (screen.crumb !== undefined && loading) top.push(h('span', { class: 'sk line w160', 'aria-hidden': 'true' }));
    // The title's own tags and buttons, such as the workshop's 열림 and 스티커 더하기, once the data came.
    const tags = answered ? screen.titleTags?.(known) ?? null : null;
    const actions = answered ? screen.titleActions?.(known) ?? null : null;
    if (title !== null || loading) top.push(titleOf(title, tag, description, tags, actions));
    let body;
    if (loading) body = screen.skeleton?.(known) ?? [];
    else if (failure !== null) body = errorNotice(failure, () => load(false));
    else body = [reread === null ? null : errorNotice(reread, () => load(true)), ...screen.render(known)];
    // The work panel's loading state is the screen's own (screen.panelSkeleton), such as its sections' titles.
    const panel = failure !== null ? [] : loading ? screen.panelSkeleton?.(known) ?? [] : screen.panel?.(known) ?? [];
    if (screen.layout === 'workbench') {
      fill(view, h('div', { class: 'wb' },
        h('main', { class: 'board-col' }, top, body),
        h('aside', { class: 'panel-col', 'aria-label': '작업 패널' }, panel)));
    } else {
      fill(view, h('main', { class: 'main' }, top, body));
    }
    showTimes();
  }

  // The read time beside the title, and how long ago each time of the view was; the tick runs it every 30 seconds.
  function showTimes() {
    const now = Date.now();
    for (const { element, time, words } of clocks) {
      const text = words(ago(time, now));
      if (element.textContent !== text) element.textContent = text;
    }
    if (tag === null) return;
    const text = readTag(readAt, now, reread !== null || partStale);
    tag.hidden = text === null;
    tag.textContent = text ?? '';
  }

  // A time of the data as how long ago it was, such as "12분 전" (states.js ago), in a <time> that holds the moment
  // itself. words turns that into the screen's text, such as "12분 전에 보냄". The text moves on with the shell's tick
  // and with each read, also when a read again leaves the view as it is.
  function since(time, words = (text) => text) {
    const element = h('time', { datetime: time });
    element.textContent = words(ago(time, Date.now()));
    clocks.push({ element, time, words });
    return element;
  }

  // The permission state, in place of the whole page. A 401 first reloads the page through the gate, keeping unsent
  // text; a second one before any read succeeded shows "다시 로그인하세요." (see states.js gateStep).
  function permission(kind, outcome) {
    if (ended) return;
    ended = true;
    if (kind === 'gate' && gateStep(stored('sessionStorage', GATE_KEY)) === 'reload') {
      store('sessionStorage', GATE_KEY, String(Date.now()));
      // Without the mark the page could not tell the next 401 from this one, so it reloads only once the mark holds:
      // where this tab's storage is blocked, it shows the message at once.
      if (stored('sessionStorage', GATE_KEY) !== null) {
        for (const keep of leaving) {
          try {
            keep();
          } catch {
            // A screen that cannot keep its text does not hold the others.
          }
        }
        globalThis.location.reload();
        return;
      }
    }
    const code = kind === 'gate' ? 'unauthenticated' : outcome.code ?? 'not_owner';
    document.title = 'NEXUS';
    fill(root,
      h('header', { class: 'hd' }, h('span', { class: 'brand' }, 'NEXUS')),
      h('main', { class: 'center' },
        h('h1', {}, message(code)),
        kind === 'message' ? null : h('div', { class: 'btns' }, reloadButton())));
  }

  // The bar of a 409 that says the data changed (SCR-145 and SCR-146): its message, a line such as "쓰던 댓글은 남아
  // 있어요." when typed text was kept, and a reload that reads the screen's data again.
  function staleBar({ text, kept = null }) {
    return h('div', { class: 'nt warn', role: 'alert' },
      h('div', { class: 'b' }, h('b', {}, text), kept === null ? null : h('span', {}, kept)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => load(true) } }, '새로 고침'));
  }

  // The error notice of a failed answer: the code's message, a retry, and the request's traceId when it has one.
  function errorNotice(outcome, retry) {
    return [
      h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, message(outcome.code ?? 'internal')))),
      h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn tertiary', on: { click: retry } }, '다시 시도')),
      outcome.traceId ? h('span', { class: 'helper mono' }, `traceId ${outcome.traceId}`) : null,
    ];
  }
}

// The path and the query of an address of this site, such as stageHref gives: "/p/a/_/03-user-flow?d=dg_...".
function partsOf(href) {
  const at = href.indexOf('?');
  return at === -1 ? { pathname: href, search: '' } : { pathname: href.slice(0, at), search: href.slice(at) };
}

function reloadButton() {
  return h('button', { type: 'button', class: 'btn tertiary', on: { click: () => globalThis.location.reload() } }, '새로 고침');
}

function crumbOf(items) {
  const parts = [];
  for (const [index, { text, href = null }] of items.entries()) {
    if (index > 0) parts.push(h('span', { 'aria-hidden': 'true' }, '/'));
    parts.push(href === null ? h('span', {}, text) : h('a', { href }, text));
  }
  return h('nav', { class: 'crumb', 'aria-label': '위치' }, parts);
}

// A screen's title, its tag of the read time and the text under it: a text, a node or a list of them, or { text, mono }
// for a text in code type, such as a mockup's name. tags go after the title and actions, buttons, at the row's end.
function titleOf(title, tag, description, tags = null, actions = null) {
  const heading = title === null ? h('span', { class: 'sk head', 'aria-hidden': 'true' }) : h('h1', {}, title);
  // { text, mono } is a plain object; a text, a node or a list of them, such as SCR-144's, is drawn as it is.
  const plain = description !== null && typeof description === 'object' && Object.getPrototypeOf(description) === Object.prototype;
  const under = plain
    ? h('p', { class: description.mono ? 'sec mono' : 'sec' }, description.text)
    : description === null ? null : h('p', { class: 'sec' }, description);
  return h('div', { class: 'title' }, h('div', { class: 't' }, h('div', { class: 'row' }, heading, tags, tag), under),
    actions === null || actions.length === 0 ? null : h('div', { class: 'btns' }, actions));
}

// The stage tabs of the address's project and part, the current stage marked. They are the 13 stages whatever was
// sent: a stage with nothing sent opens to the workbench's empty state.
function stageTabs(address) {
  return h('nav', { class: 'tabs', 'aria-label': '단계' }, STAGES.map((stage) => {
    const on = stage.id === address.stage;
    return h('a', { class: on ? 'tab on' : 'tab', href: stageHref(address.project, address.part, stage.id), 'aria-current': on ? 'page' : null },
      h('span', { class: 'n' }, stage.number), stage.name);
  }));
}

// The header (docs/08-screens, section 2): NEXUS, the project menu, "내 차례 N" and the dark-screen switch. The menu
// and the count show once their reads answer and stay out when they fail; the rest of the page works without them.
function createHeader(address) {
  const label = h('span', { class: 'proj' }, '프로젝트');
  const list = h('ul', { class: 'menu', id: 'project-menu', role: 'menu', hidden: true });
  const button = h('button', {
    type: 'button', class: 'hb', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'project-menu',
    on: { click: () => (list.hidden ? open() : close(false)) },
  }, label, icon('chevron'));
  const count = h('span', { class: 'cnt' });
  const turn = h('a', { class: 'hb', href: TODO_HREF, hidden: true }, '내 차례', count);
  const themeLabel = h('span', { class: 'theme-label' });
  const theme = h('button', { type: 'button', class: 'hb', on: { click: switchTheme } }, themeLabel, icon('moon', 'ic theme-icon'));
  // The menu opens under its button, which .pm holds with it (nexus.css), so no script places it.
  const element = h('header', { class: 'hd' },
    h('a', { class: 'brand hb', href: TODO_HREF }, 'NEXUS'), h('div', { class: 'pm' }, button, list), h('span', { class: 'sp' }), turn, theme);
  let titled = false;
  const all = h('li', { role: 'none', class: 'all' }, h('a', { role: 'menuitem', href: PROJECTS_HREF }, '프로젝트 목록'));
  fill(list, all);
  showTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', (event) => {
    const chosen = stored('localStorage', THEME_KEY);
    if (chosen !== 'light' && chosen !== 'dark') showTheme(themeOf(null, event.matches));
  });
  list.addEventListener('keydown', moveInMenu);
  document.addEventListener('click', (event) => {
    if (!list.hidden && !element.contains(event.target)) close(false);
  });

  function open() {
    list.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    list.querySelector('a')?.focus();
  }

  function close(focus) {
    list.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (focus) button.focus();
  }

  function moveInMenu(event) {
    const items = [...list.querySelectorAll('a')];
    const at = items.indexOf(document.activeElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      items[(at + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      items[event.key === 'Home' ? 0 : items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      close(false);
    }
  }

  function showTheme(value) {
    document.documentElement.setAttribute('data-theme', value);
    const name = switchName(value);
    themeLabel.textContent = name;
    theme.setAttribute('aria-label', name);
  }

  function switchTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    store('localStorage', THEME_KEY, next);
    showTheme(next);
  }

  return {
    element,
    // API-262's projects, newest send first as it lists them, each to its project page, then the projects list.
    projects(body) {
      const projects = Array.isArray(body.projects) ? body.projects : [];
      const items = projects.map((project) => h('li', { role: 'none' },
        h('a', { role: 'menuitem', href: projectHref(project.name), 'aria-current': project.name === address.project ? 'page' : null },
          project.title || project.name)));
      fill(list, items, all);
      button.hidden = false;
      const here = projects.find((project) => project.name === address.project);
      if (!titled && here !== undefined) label.textContent = here.title || here.name;
    },
    noProjects() {
      close(false);
      button.hidden = true;
    },
    todo(body) {
      const number = Array.isArray(body.entries) ? body.entries.length : 0;
      count.textContent = String(number);
      turn.setAttribute('aria-label', `내 차례 ${number}개`);
      turn.hidden = false;
    },
    noTodo() {
      turn.hidden = true;
    },
    // The current project's title, from the screen's own read of it.
    current(title) {
      if (title === null) return;
      titled = true;
      label.textContent = title;
    },
  };
}
