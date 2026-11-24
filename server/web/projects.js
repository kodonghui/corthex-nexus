// SCR-143, the projects and the agent credentials (SPEC-015, SPEC-049, SPEC-050, TASK-456): the project spaces from
// API-262 and the credentials from API-279, with issuing one (API-280) and revoking one (API-281). screens.js runs it in
// the shell, which draws the title, the loading, permission and stale states, and the header. The two reads are the
// screen's parts (shell.missed): when one fails, its table shows the failure with a retry and the other still shows.
//
// - Projects keep API-262's order, newest send first; credentials keep API-279's, live ones first and each newest first.
// - Issuing and revoking are a PC's (SPEC-051): a phone shows both tables to read, with "자격 발급과 폐기는 PC에서
//   하세요.". Below 672 px the tables are the mockup's cards; a narrow PC window keeps both actions.
// - A revoke asks once, in its own row: "폐기할까요?" with 폐기 and 취소.
// - After a deletion on SCR-144 the page opens at /p?deleted={project} and says "{project}를 지웠어요" once.
//
// The secret of a credential just issued is in API-280's 201 answer only (TASK-417). The page keeps it in this page's
// memory, in the state below, and shows it until the page is left or reloaded, another credential is issued, or this one
// is revoked here. It never goes to a browser store, the console, a log or an address, and the page never asks for it.

import { isProjectName, PROJECTS_HREF, projectHref } from './address.js';
import { newRequestKey, write } from './api.js';
import { h } from './dom.js';
import { objectParticle } from './korean.js';
import { STAGES } from './stages.js';
import { clockOf, dayOf, stateOf } from './states.js';

const CREDENTIALS = '/api/credentials';
// The unsent name, kept in this tab through the gate like any unsent text (storage.js).
const NAME_DRAFT = 'p:credential-name';
const ABOUT = '에이전트가 NEXUS로 보낼 때 쓰는 자격이에요. 폐기하면 그 자격의 다음 요청은 거절돼요.';
const PC_ONLY = '자격 발급과 폐기는 PC에서 하세요.';
const NO_PROJECT = '에이전트가 처음 보내면 여기에 나와요. 아래에서 자격을 발급해 hub에 설정하고 --first로 보내세요.';
const SHOWN_ONCE = '비밀값은 지금만 보여요. 이 페이지를 떠나거나 새로 고치면 다시 볼 수 없어요.';
// API-280's repeat (200, secret null): a retry reached a request that had issued the credential, whose secret is gone.
const REPEATED = '이 자격은 이미 발급됐어요. 비밀값은 처음 응답에만 있어서 다시 보여 줄 수 없어요. 이 자격을 폐기하고 새로 발급하세요.';
const COPIED = '복사했어요';

// Each page's own state, by its shell: what the owner typed, what runs, what was refused, and the credential just
// issued with its secret. It lives as long as the page and nowhere else.
const PAGES = new WeakMap();

function pageOf(shell) {
  let page = PAGES.get(shell);
  if (page === undefined) {
    page = {
      name: shell.draftOf(NAME_DRAFT),
      // The request key of the issue: kept only after a timeout or a lost connection, for the same name.
      issueKey: null,
      issuing: false,
      // The issue's refusal, { code, traceId }, shown by the name.
      refused: null,
      // { credential, secret }, secret null for API-280's repeat.
      issued: null,
      // Which value was copied last: 'id' or 'secret'; and the elements that say so, by value, from the last draw.
      copied: null,
      statuses: {},
      // The credential whose revoke is being asked, and the one whose revoke runs.
      asking: null,
      revoking: null,
      // The request key of each credential's revoke, kept only after a timeout or a lost connection.
      revokeKeys: new Map(),
      // A revoke's refusal, { code, traceId }, shown above the credentials.
      revokeRefused: null,
      // What to focus once the page is drawn, and the elements that can take it, from the last draw.
      focus: null,
      targets: new Map(),
      deleted: deletedOnce(),
    };
    PAGES.set(shell, page);
  }
  return page;
}

// The project of ?deleted=, which SCR-144 opens this page with after deleting it (API-278), or null. The query leaves
// the address at once, so a reload does not say it again.
function deletedOnce() {
  const name = new URLSearchParams(globalThis.location?.search ?? '').get('deleted');
  if (name === null) return null;
  globalThis.history?.replaceState?.(globalThis.history.state ?? null, '', PROJECTS_HREF);
  return isProjectName(name) ? name : null;
}

// The body of SCR-143 from data.projects (API-262) and data.credentials (API-279), either of them null when its read
// failed before it ever answered.
export function projectsBody({ data, shell }) {
  const page = pageOf(shell);
  // A draw replaces every element, so the one that had the focus gives it to its new self, by its id.
  const had = globalThis.document?.activeElement?.getAttribute?.('id') ?? null;
  page.targets = new Map();
  page.statuses = {};
  const projects = data.projects?.projects ?? null;
  const body = [
    deletedNotice(page.deleted, projects),
    projectsPart(projects, shell.missed('projects'), shell),
    credentialsPart(data.credentials?.credentials ?? null, shell.missed('credentials'), page, shell),
  ];
  const key = page.focus ?? (had === null ? null : `#${had}`);
  page.focus = null;
  // The shell puts the body in the page as soon as this returns.
  if (key !== null) queueMicrotask(() => focusOn(page, key));
  return body;
}

// SCR-143#loading: grey rows for the projects and the credentials, and the issue form off.
export function projectsSkeleton() {
  return [
    h('section', { class: 'group', 'aria-hidden': 'true' }, greyRows()),
    h('section', { class: 'group' },
      credentialsHead(),
      h('div', { 'aria-hidden': 'true' }, greyRows()),
      issueForm({ name: '', off: true, refused: null }),
      pcOnlyNote()),
  ];
}

const greyRows = () => h('div', { class: 'cards' }, h('span', { class: 'sk row full' }), h('span', { class: 'sk row full' }));

function deletedNotice(name, projects) {
  // Said only when API-262 answered and no longer lists the project.
  if (name === null || projects === null || projects.some((project) => project.name === name)) return null;
  return h('div', { class: 'nt ok', role: 'status' }, h('div', { class: 'b' }, h('b', {}, `${name}${objectParticle(name)} 지웠어요`)));
}

// A part's read that failed: its message with 다시 시도, which reads the page again, and the request's traceId.
function readFailure(text, outcome, shell) {
  return [
    h('div', { class: 'nt err', role: 'alert' },
      h('div', { class: 'b' }, h('b', {}, text)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, '다시 시도')),
    outcome.traceId ? h('span', { class: 'helper mono' }, `traceId ${outcome.traceId}`) : null,
  ];
}

// The projects: a table at 672 px and wider, rows below, each to its SCR-144.
function projectsPart(projects, missed, shell) {
  const failure = missed === null ? null : readFailure('프로젝트를 읽지 못했어요.', missed, shell);
  if (projects === null) return h('section', { class: 'group' }, failure);
  if (projects.length === 0) {
    return h('section', { class: 'group' }, failure,
      h('div', { class: 'empty' }, h('h2', {}, '아직 프로젝트가 없어요'), h('p', { class: 'sec' }, NO_PROJECT)));
  }
  return h('section', { class: 'group' }, failure,
    h('table', { class: 'tb wide-only' },
      h('thead', {}, h('tr', {}, ['프로젝트', '진행', '할 일', '마지막으로 보낸 때'].map((text) => h('th', { scope: 'col' }, text)))),
      h('tbody', {}, projects.map((project) => h('tr', {},
        h('td', {}, h('a', { href: projectHref(project.name) }, h('b', {}, titleOf(project))), ' ', h('span', { class: 'helper mono' }, project.name)),
        h('td', {}, h('span', { class: 'bar', 'data-passed': passedOf(project), 'aria-hidden': 'true' }, h('i')), passedText(project)),
        h('td', {}, todoTag(project)),
        h('td', { class: 'sec' }, sent(project, shell)))))),
    h('div', { class: 'list narrow-only' }, projects.map((project) => {
      const when = sent(project, shell);
      return h('a', { class: 'li keep', href: projectHref(project.name) },
        h('span', { class: 'grow' }, h('b', {}, titleOf(project)), h('span', { class: 'sec' }, passedText(project), when === null ? null : [' · ', when])),
        h('span', { class: 'end' }, todoTag(project)));
    })));
}

const titleOf = (project) => project.title || project.name;
const passedOf = (project) => Math.min(STAGES.length, Math.max(0, Math.trunc(Number(project.stages_passed) || 0)));
const passedText = (project) => `${STAGES.length}단계 중 ${passedOf(project)} 통과`;

function todoTag(project) {
  const count = Math.max(0, Math.trunc(Number(project.owner_todo) || 0));
  return h('span', { class: count > 0 ? 'tag blue' : 'tag gray' }, `할 일 ${count}`);
}

// "리비전 66 · 12분 전", or null for a space that holds no snapshot yet.
function sent(project, shell) {
  if (project.revision === null || project.revision === undefined) return null;
  return [`리비전 ${project.revision}`, project.pushed_at ? [' · ', shell.since(project.pushed_at)] : null];
}

// The heading takes the focus from a script only: while a revoke runs, its row's buttons are gone.
function credentialsHead(page = null) {
  const heading = h('h2', { id: 'credentials-heading', tabindex: '-1' }, '에이전트 자격');
  if (page !== null) {
    target(page, 'credentials', heading);
    target(page, '#credentials-heading', heading);
  }
  return [h('div', { class: 'gh' }, heading), h('p', { class: 'sec' }, ABOUT)];
}

const pcOnlyNote = () => h('div', { class: 'nt info', role: 'status', 'data-phone-only': true }, h('div', { class: 'b' }, h('b', {}, PC_ONLY)));

// The credentials: the secret of the one just issued, a refused revoke, the table (cards below 672 px), the issue
// form, and on a phone the note that both actions are a PC's.
function credentialsPart(credentials, missed, page, shell) {
  let list = null;
  if (credentials !== null) {
    list = credentials.length === 0
      ? h('div', { class: 'empty' }, h('p', {}, '아직 보낼 수 있는 에이전트가 없어요.'))
      : [credentialTable(credentials, page, shell), credentialCards(credentials, page, shell)];
  }
  return h('section', { class: 'group', 'aria-labelledby': 'credentials-heading' },
    credentialsHead(page),
    page.issued === null ? null : issuedPanel(page),
    page.revokeRefused === null ? null : refusal(page.revokeRefused, shell),
    missed === null ? null : readFailure('에이전트 자격을 읽지 못했어요.', missed, shell),
    list,
    issueForm({ name: page.name, off: page.issuing, busy: page.revoking !== null, refused: page.refused, page, shell }),
    pcOnlyNote());
}

function refusal({ code, traceId }, shell) {
  return [
    h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(code)))),
    traceId ? h('span', { class: 'helper mono' }, `traceId ${traceId}`) : null,
  ];
}

function credentialTable(credentials, page, shell) {
  return h('table', { class: 'tb wide-only' },
    h('thead', {}, h('tr', {}, ['이름', '발급', '마지막으로 씀'].map((text) => h('th', { scope: 'col' }, text)), h('th', {}))),
    h('tbody', {}, credentials.map((credential) => {
      const name = `credential-t-${credential.id}`;
      return h('tr', { class: credential.revoked_at === null ? null : 'off' },
        h('td', { class: 'mono', id: name }, credential.name),
        h('td', {}, dayOf(credential.issued_at)),
        h('td', {}, lastUsed(credential, shell)),
        h('td', { class: 'r' }, endOf(credential, name, page, shell)));
    })));
}

function credentialCards(credentials, page, shell) {
  return h('div', { class: 'cards narrow-only' }, credentials.map((credential) => {
    const name = `credential-c-${credential.id}`;
    return h('div', { class: 'card' },
      h('div', { class: 'top' }, h('b', { class: 'mono', id: name }, credential.name), endOf(credential, name, page, shell)),
      h('span', { class: 'small' }, `발급 ${dayOf(credential.issued_at)} · 마지막으로 씀 `, lastUsed(credential, shell)));
  }));
}

// When a credential was last used: how long ago for a live one, the date for a revoked one, whose row is history.
function lastUsed(credential, shell) {
  if (credential.last_used_at === null) return '아직 안 씀';
  if (credential.revoked_at !== null) return dayOf(credential.last_used_at);
  return shell.since(credential.last_used_at);
}

// The end of a credential's row: "폐기됨" with the time for a revoked one; otherwise 폐기, or the question it asks.
function endOf(credential, name, page, shell) {
  if (credential.revoked_at !== null) {
    return h('span', { class: 'tag gray' }, `폐기됨 ${dayOf(credential.revoked_at)} ${clockOf(credential.revoked_at)}`);
  }
  const off = page.revoking !== null || page.issuing;
  if (page.asking === credential.id) {
    const ask = `${name}-ask`;
    const cancel = h('button', { type: 'button', class: 'btn ghost sm', on: { click: () => stopAsking(page, shell, credential) } }, '취소');
    target(page, `cancel:${credential.id}`, cancel);
    return h('span', {
      class: 'ask', 'data-pc-only': true, role: 'group', 'aria-labelledby': `${ask} ${name}`,
      on: { keydown: (event) => event.key === 'Escape' && stopAsking(page, shell, credential) },
    },
    h('span', { id: ask }, '폐기할까요?'),
    h('button', { type: 'button', class: 'btn danger sm', disabled: off, on: { click: () => revoke(page, shell, credential) } }, '폐기'),
    cancel);
  }
  const button = `${name}-revoke`;
  const revokeButton = h('button', {
    type: 'button', class: 'btn danger-ghost sm', id: button, 'data-pc-only': true, disabled: off, 'aria-labelledby': `${button} ${name}`,
    on: { click: () => ask(page, shell, credential) },
  }, '폐기');
  target(page, `revoke:${credential.id}`, revokeButton);
  target(page, `#${button}`, revokeButton);
  return revokeButton;
}

// The credential just issued: its ID and its secret, each with 복사, and the hub's setting. A repeat of the issue
// (secret null) shows its ID only, and says to revoke it and issue another.
function issuedPanel(page) {
  const { credential, secret } = page.issued;
  const heading = h('h2', { id: 'issued-heading', tabindex: '-1' }, `새 자격 ${credential.name}`);
  target(page, 'issued', heading);
  target(page, '#issued-heading', heading);
  if (secret === null) {
    return h('section', { class: 'panel', 'aria-labelledby': 'issued-heading' },
      h('div', { class: 'ph' }, heading),
      copyField(page, 'id', 'Client ID', credential.id),
      h('p', {}, REPEATED));
  }
  return h('section', { class: 'panel', 'aria-labelledby': 'issued-heading' },
    h('div', { class: 'ph' }, heading, h('span', { class: 'tag red' }, '지금만 보여요')),
    h('p', {}, SHOWN_ONCE),
    copyField(page, 'id', 'Client ID', credential.id),
    copyField(page, 'secret', 'Client secret', secret),
    h('p', { class: 'sec' }, 'hub가 도는 기기의 환경 변수 ', h('span', { class: 'mono' }, 'CORTHEX_NEXUS_CLIENT_ID'), '와 ',
      h('span', { class: 'mono' }, 'CORTHEX_NEXUS_CLIENT_SECRET'), '에 넣으세요. 파일이나 명령줄에는 넣지 마세요.'));
}

// A value to copy, in a field that only shows it, with 복사 named by the field's label ("복사 Client ID").
function copyField(page, which, label, value) {
  const id = `issued-${which}`;
  const field = h('input', { id, class: 'field mono', readonly: true, value, autocomplete: 'off', spellcheck: 'false' });
  target(page, `field:${which}`, field);
  const status = h('span', { class: 'small', role: 'status' }, page.copied === which ? COPIED : '');
  page.statuses[which] = status;
  const button = h('button', {
    type: 'button', class: 'btn tertiary sm', id: `${id}-copy`, 'aria-labelledby': `${id}-copy ${id}-label`,
    on: { click: () => copy(page, which, value) },
  }, '복사');
  target(page, `#${id}-copy`, button);
  return h('div', {},
    h('label', { class: 'l', for: id, id: `${id}-label` }, label),
    h('div', { class: 'form' }, h('div', {}, field), button, status));
}

// Puts value on the clipboard and says "복사했어요" by its button until the next copy. When the browser refuses, the
// field's text shows selected for the owner to copy (SPEC-011's rule, as SCR-145 copies an element).
async function copy(page, which, value) {
  let done = true;
  try {
    await globalThis.navigator.clipboard.writeText(value);
  } catch {
    done = false;
  }
  page.copied = done ? which : null;
  for (const [each, status] of Object.entries(page.statuses)) status.textContent = each === page.copied ? COPIED : '';
  // The field as the page shows it now: a draw while the clipboard answered replaced the one clicked.
  const field = page.targets.get(`field:${which}`)?.[0] ?? null;
  if (!done && field !== null) {
    field.focus();
    field.select?.();
  }
}

// The issue form: the name and 발급, off while the page loads or an issue runs, with a refusal's message by the name.
// 발급 is off while a revoke runs too, and the name is marked only when the server refused it (an input error).
function issueForm({ name, off, busy = false, refused, page = null, shell = null }) {
  const bad = refused !== null && refused.input;
  const field = h('input', {
    id: 'credential-name', class: bad ? 'field bad' : 'field', placeholder: '예: laptop', value: name,
    autocomplete: 'off', spellcheck: 'false', disabled: off,
    'aria-invalid': bad ? 'true' : null, 'aria-describedby': refused === null ? null : 'credential-name-refused',
    on: page === null ? {} : {
      input: (event) => named(page, shell, event.target.value),
      keydown: (event) => event.key === 'Enter' && !event.isComposing && issue(page, shell),
    },
  });
  if (page !== null) {
    target(page, 'name', field);
    target(page, '#credential-name', field);
  }
  return h('div', { 'data-pc-only': true },
    h('div', { class: 'form' },
      h('div', {}, h('label', { class: 'l', for: 'credential-name' }, '새 자격 이름'), field),
      h('button', { type: 'button', class: 'btn primary', disabled: off || busy, on: page === null ? {} : { click: () => issue(page, shell) } }, '발급')),
    refused === null ? null : [
      // A div, not a p: the shell's `.nx p{margin:0}` would take away err-text's space under the field.
      h('div', { class: 'err-text', id: 'credential-name-refused', role: 'alert' }, shell.message(refused.code)),
      refused.traceId ? h('span', { class: 'helper mono' }, `traceId ${refused.traceId}`) : null,
    ]);
}

// The owner typed: the name is kept as unsent text, and a changed name takes a new request key.
function named(page, shell, value) {
  if (value !== page.name) page.issueKey = null;
  page.name = value;
  shell.keepDraft(NAME_DRAFT, value);
}

// API-280 with the name as typed. The server refuses an empty name, one over 64 characters or one in use, and the
// message shows by the name, which stays. A 201 shows the secret; a 200 is a repeat, without it.
async function issue(page, shell) {
  if (page.issuing || page.revoking !== null || shell.isPhone()) return;
  page.issuing = true;
  page.refused = null;
  page.issueKey ??= newRequestKey();
  shell.redraw();
  const outcome = await write('POST', CREDENTIALS, { name: page.name }, page.issueKey);
  page.issuing = false;
  // The answer meets the shell's states (shell.outcome): null when the shell took the page, after a 401 or a 403.
  const found = shell.outcome(outcome);
  if (found === null) return;
  const { state, kind } = found;
  if (outcome.failure === undefined) page.issueKey = null;
  if (state === 'normal' && typeof outcome.body.credential === 'object' && outcome.body.credential !== null) {
    page.issued = { credential: outcome.body.credential, secret: outcome.body.secret ?? null };
    page.copied = null;
    named(page, shell, '');
    page.focus = 'issued';
    shell.redraw();
    shell.reload();
    return;
  }
  // A failure of the request (no answer, 415, 500) says so by the name too, but does not mark the name as wrong.
  page.refused = { code: outcome.code ?? 'internal', traceId: outcome.traceId ?? null, input: kind === 'input' };
  page.focus = 'name';
  shell.redraw();
}

function ask(page, shell, credential) {
  if (page.revoking !== null || shell.isPhone()) return;
  page.asking = credential.id;
  page.focus = `cancel:${credential.id}`;
  shell.redraw();
}

function stopAsking(page, shell, credential) {
  if (page.asking !== credential.id) return;
  page.asking = null;
  page.focus = `revoke:${credential.id}`;
  shell.redraw();
}

// API-281 on the credential asked about. Once it answers, the list is read again, so its row shows it revoked; a
// credential gone meanwhile says "NEXUS에 없는 자격 증명이에요." and the list is read again too.
async function revoke(page, shell, credential) {
  if (page.revoking !== null || shell.isPhone()) return;
  page.asking = null;
  page.revoking = credential.id;
  page.revokeRefused = null;
  if (!page.revokeKeys.has(credential.id)) page.revokeKeys.set(credential.id, newRequestKey());
  // The question and its buttons go, so the focus waits on the heading of the credentials.
  page.focus = 'credentials';
  shell.redraw();
  const path = `${CREDENTIALS}/${encodeURIComponent(credential.id)}/revoke`;
  const outcome = await write('POST', path, {}, page.revokeKeys.get(credential.id));
  page.revoking = null;
  // A credential gone meanwhile (404 credential_not_found) is its row's to say, since the page still shows the others;
  // shell.outcome would show the whole page gone. Any other answer meets the shell's states, as an issue's does.
  const found = outcome.status === 404 ? stateOf(outcome) : shell.outcome(outcome);
  if (found === null) return;
  const { state, kind } = found;
  if (outcome.failure === undefined) page.revokeKeys.delete(credential.id);
  if (state === 'normal') {
    // The secret of a credential revoked here leaves the page with it.
    if (page.issued?.credential.id === credential.id) page.issued = null;
  } else {
    page.revokeRefused = { code: outcome.code ?? 'internal', traceId: outcome.traceId ?? null };
    // The row stays unless the credential is gone, so its 폐기 takes the focus back for a retry.
    if (kind !== 'gone') page.focus = `revoke:${credential.id}`;
  }
  shell.redraw();
  if (state === 'normal' || kind === 'gone') shell.reload();
}

function target(page, key, element) {
  if (!page.targets.has(key)) page.targets.set(key, []);
  page.targets.get(key).push(element);
}

// Focuses the first element of key that takes the focus: of a row drawn as a table and as cards, the one that shows.
function focusOn(page, key) {
  for (const element of page.targets.get(key) ?? []) {
    element.focus();
    if (globalThis.document.activeElement === element) return;
  }
}
