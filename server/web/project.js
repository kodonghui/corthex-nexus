// SCR-144, a project (TASK-457; SPEC-013, SPEC-035, SPEC-046, SPEC-047), the body the shell runs at /p/{project}: the
// stages grouped by part with their state and last checkpoint (API-264), the tool links with the form that links one
// (API-282) and the button that removes one (API-283), and at #data the deletion of the space with what it removes
// (API-277, API-278). The server README's "Project screen" section says what each state shows.
//
// A tool link's address goes only into an href and into text, never into markup, and opens in a new tab with
// rel="noopener noreferrer" (TASK-451). Its status stays "아직 안 읽음" until TASK-467 reads one.
//
// What the page holds between its draws is in `held`, for the page's shell and project only: the writes under way and
// what they answered, the chosen scope, and the delete panel. A draw of new data keeps it, and nothing of it outlives
// the page. The address typed into the link form is unsent text (shell.keepDraft), so it comes back after the gate;
// the name typed into the delete panel is not kept anywhere, so closing the panel or leaving the page forgets it.
//
// A button whose write runs is busy (aria-disabled), not disabled, so it keeps the focus. Each draw keeps the focus
// on the element of the same id, with the caret where it was in a field (see redraw).

import { projectApi, PROJECTS_HREF, projectHref, stageHref } from './address.js';
import { newRequestKey, read, write } from './api.js';
import { fill, h, icon } from './dom.js';
import { objectParticle } from './korean.js';
import { clockOf, sentWords } from './states.js';
import { STAGES, stageOf } from './stages.js';

const TOOL_NAMES = Object.freeze({ notion: 'Notion', jira: 'Jira' });
const toolName = (tool) => (Object.hasOwn(TOOL_NAMES, tool) ? TOOL_NAMES[tool] : String(tool));
// A row's state as the mockup draws it: the dot's colour and its label. A pass marked changed keeps 통과 and adds the
// tag; when no stage of the project was sent (SCR-144#empty), each row says NOTHING_SENT.
const STATES = Object.freeze({
  passed: { dot: 'done', label: '통과' },
  changed_since_pass: { dot: 'done', label: '통과' },
  open: { dot: 'prog', label: '진행 중' },
  not_sent: { dot: 'not', label: '시작 전' },
});
const PASSED = new Set(['passed', 'changed_since_pass']);
const NOTHING_SENT = '아직 보낸 것이 없어요';
const CHANGED = '통과 뒤 바뀜';
const NOT_READ = '아직 안 읽음';
const PC_ONLY = '도구 잇기와 링크 지우기, 공간 지우기는 PC에서 하세요.';
const DELETE = '이 프로젝트 공간 지우기';
// The counts the delete panel shows (SCR-144#delete), of the eleven API-277 gives.
const DELETES = Object.freeze([
  ['snapshots', '스냅숏'], ['diagrams', '그림'], ['comments', '댓글'], ['confirmations', '확정'], ['positions', '레이아웃'],
]);
// Failures after which the server may or may not have written: the same input goes again with the same request key.
const UNANSWERED = new Set(['timeout', 'network']);

let held = null;

function heldFor(ctx) {
  const { shell, address } = ctx;
  if (held === null || held.shell !== shell || held.project !== address.project) {
    held = {
      shell,
      project: address.project,
      ctx,
      links: null,
      panel: null,
      toggle: null,
      link: { sending: false, attempt: null, error: null, scope: 'project' },
      removals: new Map(),
      deletion: { open: false, round: 0, typed: '', preview: null, previewError: null, sending: false, attempt: null, error: null },
    };
  }
  held.ctx = ctx;
  return held;
}

const linkDraft = (project) => `${projectHref(project)} link`;
// The request key to send the same input with again, or null for a new one: only when no answer came.
const keyAfter = (answer, kept) => (UNANSWERED.has(answer.failure) ? kept : null);
const turn = (button, on) => (on ? button.removeAttribute('disabled') : button.setAttribute('disabled', ''));
const busy = (sending) => (sending ? 'true' : null);

// What has the focus, inside within when it is given, as a function that puts it back after a draw: on the element of
// the same id, with the caret where it was in a field, or on the element of the id instead when that one is gone or
// off or had no id, such as a notice's 다시 시도.
function focusNow(within = null) {
  const doc = globalThis.document;
  const active = doc?.activeElement ?? null;
  if (active === null || active === doc.body || (within !== null && !within.contains(active))) return () => {};
  const id = active.getAttribute?.('id') ?? null;
  const caret = id !== null && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
  return (instead = null) => {
    const usable = (element) => element !== null && element.getAttribute('disabled') === null;
    let next = id === null ? null : doc.getElementById(id);
    if (!usable(next)) next = instead === null ? null : doc.getElementById(instead);
    if (!usable(next)) return;
    next.focus({ preventScroll: true });
    if (caret !== null && next.getAttribute('id') === id) next.setSelectionRange?.(...caret);
  };
}

// Fills container with nodes as fill does, keeping the focus (focusNow).
function redraw(container, nodes, instead = null) {
  const back = focusNow(container);
  fill(container, ...nodes);
  back(instead);
}
const refused = (found, answer) => ({ kind: found.kind === 'input' ? 'input' : 'retry', outcome: answer });

// The line under the title: the project's name, its revision and when it was last sent, as "12분 전에 보냄".
export function projectDescription({ data, shell }) {
  const { name, revision, pushed_at: pushedAt } = data.project;
  return [
    name,
    revision === null || revision === undefined ? null : ` · 리비전 ${revision}`,
    pushedAt ? [' · ', shell.since(pushedAt, sentWords)] : null,
  ];
}

// SCR-144#loading: thirteen grey rows in the stage list's places, a grey link, and a grey line at #data. The link
// form is there already and keeps what is typed into it; it sends once the project is read.
export function projectSkeleton(ctx) {
  const state = heldFor(ctx);
  return [
    h('section', { class: 'group', 'aria-hidden': 'true' },
      h('div', { class: 'gh' }, h('h2', {}, '단계'), h('span', { class: 'sk line w160' })),
      h('div', { class: 'cards' }, Array.from({ length: STAGES.length }, () => h('span', { class: 'sk mid full' })))),
    h('section', { class: 'group' },
      h('div', { class: 'gh' }, h('h2', {}, '도구 링크')),
      h('div', { class: 'cards', 'aria-hidden': 'true' }, h('span', { class: 'sk row full' })),
      linkForm(state, false),
      phoneNotice()),
    h('section', { class: 'group', 'aria-hidden': 'true', 'data-pc-only': true },
      h('h2', {}, '데이터'),
      h('div', { class: 'cards' }, h('span', { class: 'sk line w240' }))),
  ];
}

// SCR-144#normal and #empty, and #delete while the panel is open.
export function projectBody(ctx) {
  const project = ctx.data.project;
  const state = heldFor(ctx);
  // The shell puts the body on the page right after this returns; the focus comes back then.
  queueMicrotask(focusNow());
  state.links = h('section', { class: 'group', 'aria-labelledby': 'links-h' });
  drawLinks(state);
  return [...stageGroups(project), state.links, dataSection(state)];
}

// The stages grouped by part as API-264 lists them, 13 rows a group. The project as a whole ('') keeps the mockup's
// "단계" and "파트 없음"; a part's group is named by the part.
function stageGroups(project) {
  const empty = project.stages.every((row) => row.state === 'not_sent');
  const links = new Map();
  for (const link of project.tool_links) {
    if (link.scope === 'project') continue;
    if (!links.has(link.scope)) links.set(link.scope, []);
    links.get(link.scope).push(link);
  }
  const groups = new Map();
  for (const row of project.stages) {
    if (!groups.has(row.part)) groups.set(row.part, []);
    groups.get(row.part).push(row);
  }
  return [...groups].map(([part, rows]) => h('section', { class: 'group' },
    h('div', { class: 'gh' },
      h('h2', {}, part === '' ? '단계' : part),
      h('span', { class: 'small' }, part === '' ? `파트 없음 · ${rows.length}단계` : `${rows.length}단계`)),
    h('div', { class: 'list' }, rows.map((row) => stageRow(project.name, row, empty, links.get(row.stage) ?? [])))));
}

// A stage's row: its number and name, which open its workbench; its state; the date of its last checkpoint and
// "통과 뒤 바뀜" when its pass changed since (SPEC-035); and the stage's tool links, which only the wide layout shows.
function stageRow(name, row, empty, links) {
  const stage = stageOf(row.stage);
  const { dot, label } = STATES[row.state] ?? STATES.not_sent;
  const checkpoint = PASSED.has(row.state) && row.passed_at ? `마지막 체크포인트 ${monthDay(row.passed_at)}` : '';
  return h('div', { class: 'li keep stg' },
    h('span', { class: 'grow' },
      h('a', { class: 'go', href: stageHref(name, row.part, row.stage) }, h('span', { class: 'no mono sec' }, stage.number), ' ', stage.name),
      h('span', { class: `dot ${dot}` }, h('span', {}, empty ? NOTHING_SENT : label)),
      h('span', { class: 'cps' },
        h('span', { class: 'small cp' }, checkpoint),
        row.state === 'changed_since_pass' ? h('span', { class: 'tag purple' }, CHANGED) : null),
      links.map((link) => outside(link.url, `${toolName(link.tool)} · ${link.url} ↗`, 'small tl'))),
    icon('next', 'ic chev'));
}

// The local date of a moment as MM-DD, as "마지막 체크포인트 11-23".
function monthDay(time) {
  const at = new Date(time);
  return `${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
}

// A link to an address outside NEXUS: the address only as the href, in a new tab that cannot reach this page. An
// address that is not https, which the server never keeps, shows as text.
function outside(url, text, className = null) {
  if (typeof url !== 'string' || !url.startsWith('https://')) return h('span', { class: className }, text);
  return h('a', { class: className, href: url, target: '_blank', rel: 'noopener noreferrer' }, text);
}

function scopeName(scope) {
  if (scope === 'project') return '프로젝트';
  const stage = stageOf(scope);
  return stage === undefined ? scope : `${stage.number} ${stage.name}`;
}

// The status last read and the time it was read, or "아직 안 읽음" until a read (SPEC-046; TASK-467 reads it).
function statusOf(link) {
  if (link.status === null || link.status === undefined) return NOT_READ;
  return link.status_read_at ? `${link.status} · ${clockOf(link.status_read_at)}` : link.status;
}

// The tool links: a card each, oldest first, with 지우기 on a PC; the form; and on a phone the line that says these are
// done on a PC.
function drawLinks(state, instead = null) {
  const links = state.ctx.data.project.tool_links;
  redraw(state.links, [
    h('div', { class: 'gh' }, h('h2', { id: 'links-h' }, '도구 링크')),
    links.length === 0 ? h('p', { class: 'sec' }, '아직 이은 도구가 없어요.') : links.map((link) => linkCard(state, link)),
    linkForm(state, true),
    phoneNotice(),
  ], instead);
}

function phoneNotice() {
  return h('div', { class: 'nt info', role: 'status', 'data-phone-only': true }, h('div', { class: 'b' }, h('b', {}, PC_ONLY)));
}

function linkCard(state, link) {
  const removal = state.removals.get(link.id) ?? null;
  const title = `tl-${link.id}`;
  return h('div', { class: 'card' },
    h('div', { class: 'top' },
      h('b', { class: 'tl', id: title }, `${toolName(link.tool)} · `, outside(link.url, link.url)),
      h('button', {
        type: 'button', id: `rm-${link.id}`, class: 'btn ghost sm', 'data-pc-only': true, 'aria-describedby': title,
        'aria-disabled': busy(removal?.sending === true), on: { click: () => removeLink(state, link) },
      }, '지우기')),
    h('span', { class: 'small' }, `${scopeName(link.scope)} · ${statusOf(link)}`),
    removal?.error ? refusal(state, removal.error, () => removeLink(state, link)) : null);
}

// What a write answered that the page shows where it was sent: an input error's message, or a failure's notice with
// 다시 시도 and the request's traceId.
function refusal(state, { kind, outcome }, retry) {
  if (kind === 'input') return h('p', { class: 'err-text', role: 'alert' }, state.ctx.shell.message(outcome.code));
  return h('div', { class: 'cards' }, state.ctx.shell.errorNotice(outcome, retry));
}

// The form that links a Notion page or a Jira project to the project or a stage (SPEC-046). A refused address keeps
// its text, with the registry's message under it.
function linkForm(state, ready) {
  const { shell, address } = state.ctx;
  const link = state.link;
  const input = link.error?.kind === 'input' ? link.error : null;
  const field = h('input', {
    id: 'ln', class: input ? 'field bad' : 'field', type: 'url', placeholder: 'https://', autocomplete: 'off',
    spellcheck: 'false', 'aria-invalid': input ? 'true' : null, 'aria-describedby': input ? 'ln-err' : null,
    on: { input: () => shell.keepDraft(linkDraft(address.project), field.value ?? '') },
  });
  field.value = shell.draftOf(linkDraft(address.project));
  const select = h('select', { id: 'lt', class: 'field', on: { change: () => { link.scope = select.value || 'project'; } } },
    h('option', { value: 'project' }, '프로젝트 전체'),
    STAGES.map((stage) => h('option', { value: stage.id }, `${stage.number} ${stage.name}`)));
  select.value = link.scope;
  const button = h('button', {
    type: 'button', id: 'ln-go', class: 'btn primary', disabled: !ready, 'aria-disabled': busy(link.sending),
    on: { click: () => addLink(state, field, select) },
  }, '잇기');
  return h('div', { class: 'linking', 'data-pc-only': true },
    h('div', { class: 'form' },
      h('div', {},
        h('label', { class: 'l', for: 'ln' }, 'Notion 페이지나 Jira 프로젝트 주소'),
        field,
        input ? h('p', { class: 'err-text', id: 'ln-err' }, shell.message(input.outcome.code)) : null),
      h('div', { class: 'scope' }, h('label', { class: 'l', for: 'lt' }, '어디에'), select),
      button),
    link.error?.kind === 'retry' ? refusal(state, link.error, () => addLink(state, field, select)) : null);
}

// API-282. The same link again answers 200 with the link kept, so a link added twice is one link.
async function addLink(state, field, select) {
  const link = state.link;
  if (link.sending) return;
  const { shell, address } = state.ctx;
  const sent = { scope: select.value || 'project', url: field.value ?? '' };
  if (link.attempt === null || link.attempt.scope !== sent.scope || link.attempt.url !== sent.url) {
    link.attempt = { ...sent, key: newRequestKey() };
  }
  // What the last attempt answered goes while this one runs.
  link.sending = true;
  link.error = null;
  drawLinks(state, 'ln-go');
  const answer = await write('POST', `${projectApi(address.project)}/tool-links`, sent, link.attempt.key);
  link.sending = false;
  link.attempt = keyAfter(answer, link.attempt);
  const found = shell.outcome(answer);
  if (found === null || state !== held) return;
  if (found.state === 'normal') {
    shell.keepDraft(linkDraft(address.project), '');
    drawLinks(state);
    shell.reload();
    return;
  }
  link.error = refused(found, answer);
  drawLinks(state);
  if (link.error.kind === 'input') state.links.querySelector('input')?.focus();
}

// API-283. A link already gone (404 tool_link_not_found) is the normal state: the list read again leaves it out.
async function removeLink(state, link) {
  const removal = state.removals.get(link.id) ?? { sending: false, key: null, error: null };
  if (removal.sending) return;
  const { shell, address } = state.ctx;
  removal.key ??= newRequestKey();
  removal.sending = true;
  removal.error = null;
  state.removals.set(link.id, removal);
  drawLinks(state, `rm-${link.id}`);
  const answer = await write('DELETE', `${projectApi(address.project)}/tool-links/${encodeURIComponent(link.id)}`, null, removal.key);
  removal.key = keyAfter(answer, removal.key);
  const found = shell.outcome(answer);
  if (found === null || state !== held) return;
  if (found.state === 'normal') {
    // The button stays busy until the list read again leaves the link out; a read that fails shows it again.
    state.removals.delete(link.id);
    shell.reload();
    return;
  }
  removal.sending = false;
  removal.error = refused(found, answer);
  drawLinks(state, `rm-${link.id}`);
}

// #data: the button that opens and closes the delete panel (SCR-144#delete), and the panel. On a phone neither shows.
function dataSection(state) {
  const deletion = state.deletion;
  state.toggle = h('button', {
    type: 'button', id: 'dn-open', class: 'btn ghost start',
    on: { click: () => (deletion.open ? closeDeletion(state) : openDeletion(state)) },
  }, DELETE);
  state.panel = h('div', { class: 'cards' });
  drawPanel(state);
  return h('section', { class: 'group', id: 'data', 'aria-labelledby': 'data-h', 'data-pc-only': true },
    h('div', { class: 'gh' }, h('h2', { id: 'data-h' }, '데이터')),
    state.toggle,
    state.panel);
}

function drawPanel(state, instead = null) {
  const open = state.deletion.open;
  state.toggle.setAttribute('aria-expanded', String(open));
  if (open) state.toggle.setAttribute('aria-controls', 'delete-panel');
  else state.toggle.removeAttribute('aria-controls');
  state.panel.hidden = !open;
  redraw(state.panel, [open ? deletePanel(state) : null], instead);
}

// Opening reads API-277 again, with grey counts until it answers.
async function openDeletion(state) {
  const deletion = state.deletion;
  const round = deletion.round + 1;
  Object.assign(deletion, { open: true, round, preview: null, previewError: null, error: null });
  drawPanel(state);
  const { shell, address } = state.ctx;
  const answer = await read(`${projectApi(address.project)}/removal`);
  if (state !== held || deletion.round !== round || !deletion.open) return;
  const found = shell.outcome(answer);
  if (found === null) return;
  if (found.state === 'normal') deletion.preview = answer.body;
  else deletion.previewError = answer;
  drawPanel(state);
}

// Closing forgets the typed name and what the panel showed.
function closeDeletion(state) {
  const deletion = state.deletion;
  Object.assign(deletion, { open: false, round: deletion.round + 1, typed: '', preview: null, previewError: null, error: null, attempt: null });
  drawPanel(state);
}

function deletePanel(state) {
  const { shell, address } = state.ctx;
  const deletion = state.deletion;
  const name = address.project;
  const input = deletion.error?.kind === 'input' ? deletion.error : null;
  // What goes shows before the owner confirms (SPEC-013): the button waits for the counts and the exact name.
  const ready = () => deletion.preview !== null && deletion.typed === name;
  const field = h('input', {
    id: 'dn', class: input ? 'field bad' : 'field', autocomplete: 'off', spellcheck: 'false', autocapitalize: 'off',
    'aria-invalid': input ? 'true' : null, 'aria-describedby': input ? 'dn-err' : null,
    on: {
      input: () => {
        deletion.typed = field.value ?? '';
        turn(button, ready());
      },
    },
  });
  field.value = deletion.typed;
  const button = h('button', {
    type: 'button', id: 'dn-go', class: 'btn danger', disabled: !ready(), 'aria-disabled': busy(deletion.sending),
    on: { click: () => deleteSpace(state) },
  }, '공간 지우기');
  let counts;
  if (deletion.previewError !== null) {
    counts = h('div', { class: 'cards' }, shell.errorNotice(deletion.previewError, () => openDeletion(state)));
  } else {
    counts = h('ul', { class: 'chg', 'aria-busy': deletion.preview === null ? 'true' : null }, DELETES.map(([key, label]) => h('li', {},
      h('span', { class: 'grow' }, label),
      deletion.preview === null
        ? h('span', { class: 'sk line w40', 'aria-hidden': 'true' })
        : h('b', {}, `${deletion.preview.deletes?.[key] ?? 0}개`))));
  }
  return h('section', { class: 'panel', id: 'delete-panel', 'aria-labelledby': 'dh' },
    h('h2', { id: 'dh' }, DELETE),
    h('p', {}, '지우면 NEXUS에서 아래 것이 모두 사라지고 되돌릴 수 없어요. Git 저장소의 문서는 그대로예요.'),
    counts,
    h('div', { class: 'form' },
      h('div', {},
        h('label', { class: 'l', for: 'dn' }, '지우려면 프로젝트 이름 ', h('span', { class: 'mono' }, name), `${objectParticle(name)} 적으세요`),
        field,
        input ? h('p', { class: 'err-text', id: 'dn-err' }, shell.message(input.outcome.code)) : null),
      button),
    deletion.error?.kind === 'retry' ? refusal(state, deletion.error, () => deleteSpace(state)) : null);
}

// API-278, once the counts came and the typed name is the project's (SPEC-013). The button is busy while it runs, and
// what the last attempt answered goes; once the space is removed, the projects list opens, where TASK-456's SCR-143
// says so once.
async function deleteSpace(state) {
  const deletion = state.deletion;
  const { shell, address } = state.ctx;
  const name = deletion.typed;
  if (deletion.sending || deletion.preview === null || name !== address.project) return;
  if (deletion.attempt === null || deletion.attempt.name !== name) deletion.attempt = { name, key: newRequestKey() };
  deletion.sending = true;
  deletion.error = null;
  drawPanel(state, 'dn-go');
  const answer = await write('POST', `${projectApi(address.project)}/removal`, { name }, deletion.attempt.key);
  deletion.attempt = keyAfter(answer, deletion.attempt);
  const found = shell.outcome(answer);
  if (found === null || state !== held) return;
  if (found.state === 'normal') {
    globalThis.location.assign(`${PROJECTS_HREF}?deleted=${encodeURIComponent(address.project)}`);
    return;
  }
  deletion.sending = false;
  deletion.error = refused(found, answer);
  drawPanel(state, 'dn-go');
  if (deletion.error.kind === 'input') state.panel.querySelector('input')?.focus();
}
