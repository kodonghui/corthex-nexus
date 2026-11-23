// The app shell: the frame every screen opens in, the header, the stage tabs, and the shared loading, error,
// permission and stale states (docs/08-screens, sections 2 and 3). A screen is a module of screens.js that the shell
// runs; the server README's "App shell" section says how one plugs in.
//
// The page holds no project data before the API answers it: the shell reads the screen's data and the header's, and
// draws nothing of a project until a read answered it. It keeps nothing an API answered (see storage.js).

import { PROJECTS_HREF, projectHref, stageHref, TODO_HREF } from './address.js';
import { read } from './api.js';
import { fill, h, icon } from './dom.js';
import { MESSAGES } from './messages.js';
import { STAGES } from './stages.js';
import { GATE_KEY, gateStep, readTag, SHARED_STATES, stateOf, switchName, THEME_KEY, themeOf } from './states.js';
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
  const leaving = [];
  let round = new Map();
  let data = null;
  let readAt = null;
  let reread = null;
  let ended = false;
  let busy = false;
  let tag = null;

  const shell = {
    read: (path) => {
      if (!round.has(path)) round.set(path, read(path));
      return round.get(path);
    },
    reload: () => load(true),
    onLeave: (keep) => leaving.push(keep),
    keepDraft,
    draftOf,
    isPhone,
    message,
    staleBar,
    errorNotice,
  };
  const header = createHeader(address);
  const tabs = screen.tabs ? stageTabs(address) : null;
  const view = h('div', { class: 'view' });
  fill(root, header.element, tabs, view);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && data !== null) load(true);
  });
  setInterval(showTag, TICK_MS);
  load(false);
  return shell;

  // Reads the screen's data and the header's. A first load shows the loading state; a read again (refresh) keeps
  // what is shown until its answer replaces it, and when it fails keeps it with the error notice and the read time.
  async function load(refresh) {
    if (ended || busy) return;
    busy = true;
    round = new Map();
    if (!refresh) {
      data = null;
      render({ loading: true });
    }
    const headerReads = [
      headerRead(PROJECTS, (body) => header.projects(body), () => header.noProjects()),
      headerRead(TODO, (body) => header.todo(body), () => header.noTodo()),
    ];
    const reads = Object.entries(screen.reads(address));
    const outcomes = await Promise.all(reads.map(([, path]) => shell.read(path)));
    await Promise.all(headerReads);
    busy = false;
    if (ended) return;
    const found = outcomes.map((outcome) => stateOf(outcome, states));
    const denied = found.findIndex(({ state }) => state === 'permission');
    if (denied !== -1) return permission(found[denied].kind, outcomes[denied]);
    const failed = found.findIndex(({ state }) => state !== 'normal');
    if (failed !== -1 && refresh && data !== null) {
      reread = outcomes[failed];
      return showData();
    }
    if (failed !== -1) return render({ failure: outcomes[failed], kind: found[failed].kind });
    succeeded();
    data = Object.fromEntries(reads.map(([name], index) => [name, outcomes[index].body]));
    readAt = Date.now();
    reread = null;
    showData();
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

  // A read answered, so the gate let the page through: a later 401 may reload once again.
  function succeeded() {
    store('sessionStorage', GATE_KEY, null);
  }

  function context() {
    return { address, data, shell };
  }

  function showData() {
    const ctx = context();
    const gone = screen.check?.(ctx) ?? null;
    header.current(screen.projectTitle?.(ctx) ?? null);
    if (gone !== null) return render({ gone });
    render({ ctx });
  }

  // Draws the view: the loading state, a failed read, a gone thing, or the screen's data.
  function render({ loading = false, failure = null, kind = null, gone = null, ctx = null }) {
    if (gone === null && failure !== null && kind === 'gone') gone = { code: failure.code, ...(GONE[failure.code] ?? {}) };
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
    const title = answered ? screen.title(known) : screen.fixedTitle ?? null;
    const description = typeof screen.description === 'function'
      ? (answered ? screen.description(known) : null)
      : screen.description ?? null;
    document.title = title === null ? 'NEXUS' : `${title} · NEXUS`;
    tag = h('span', { class: 'tag gray', hidden: true });
    const top = [];
    if (screen.crumb !== undefined && answered) top.push(crumbOf(screen.crumb(known)));
    else if (screen.crumb !== undefined && loading) top.push(h('span', { class: 'sk line w160', 'aria-hidden': 'true' }));
    if (title !== null || loading) top.push(titleOf(title, tag, description));
    let body;
    if (loading) body = screen.skeleton?.(known) ?? [];
    else if (failure !== null) body = errorNotice(failure, () => load(false));
    else body = [reread === null ? null : errorNotice(reread, () => load(true)), ...screen.render(known)];
    const panel = loading || failure !== null ? [] : screen.panel?.(known) ?? [];
    if (screen.layout === 'workbench') {
      fill(view, h('div', { class: 'wb' },
        h('main', { class: 'board-col' }, top, body),
        h('aside', { class: 'panel-col', 'aria-label': '작업 패널' }, panel)));
    } else {
      fill(view, h('main', { class: 'main' }, top, body));
    }
    showTag();
  }

  function showTag() {
    if (tag === null) return;
    const text = readTag(readAt, Date.now(), reread !== null);
    tag.hidden = text === null;
    tag.textContent = text ?? '';
  }

  // The permission state, in place of the whole page. A 401 first reloads the page through the gate, keeping unsent
  // text; a second one before any read succeeded shows "다시 로그인하세요." (see states.js gateStep).
  function permission(kind, outcome) {
    if (ended) return;
    ended = true;
    if (kind === 'gate' && gateStep(stored('sessionStorage', GATE_KEY)) === 'reload') {
      for (const keep of leaving) {
        try {
          keep();
        } catch {
          // A screen that cannot keep its text does not hold the others.
        }
      }
      store('sessionStorage', GATE_KEY, String(Date.now()));
      globalThis.location.reload();
      return;
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

function titleOf(title, tag, description) {
  const heading = title === null ? h('span', { class: 'sk head', 'aria-hidden': 'true' }) : h('h1', {}, title);
  return h('div', { class: 'title' }, h('div', { class: 't' },
    h('div', { class: 'row' }, heading, tag),
    description === null ? null : h('p', { class: 'sec' }, description)));
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
  const element = h('header', { class: 'hd' },
    h('a', { class: 'brand hb', href: TODO_HREF }, 'NEXUS'), button, list, h('span', { class: 'sp' }), turn, theme);
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
    element.style.setProperty('--menu-left', `${button.offsetLeft}px`);
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
