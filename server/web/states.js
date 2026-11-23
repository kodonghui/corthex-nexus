// The shared states of every screen (docs/08-screens/README.md, sections 2 and 3), as functions of what an answer
// was, so that node --test checks them without a browser.

// The states every screen has. A screen may have more, such as waiting or workshop, which it names.
export const SHARED_STATES = Object.freeze(['normal', 'loading', 'empty', 'error', 'permission', 'stale']);

// 409s that lead elsewhere than stale, by their Problem code (section 3's examples): an input error, or a state of the
// screen when it has that state, otherwise stale.
const CONFLICTS = Object.freeze({
  request_key_reused: 'error',
  name_taken: 'error',
  waiting_reflection: 'waiting',
  not_drawn: 'not-drawn',
  workshop_open: 'workshop',
  step_empty: 'workshop',
});
// 404s that are the normal state: a tool link already gone, and no open workshop.
const NORMAL_NOT_FOUND = new Set(['tool_link_not_found', 'workshop_not_found']);

// The state an outcome of api.js leads to on a screen with the states has, and the kind of it:
// - normal: the answer's data;
// - error with kind input (400, 413, and a 409 of a reused request key or a taken name): the message by the input;
// - error with kind gone (404): it is no longer there, with a link to where it was listed;
// - error with kind retry (415, any other status, a timeout, no network, an answer that is not JSON): a message and a
//   retry, with the rest of the screen still working;
// - permission with kind gate (401, or the gate's redirect): to the gate and back (see gateStep);
// - permission with kind message (403 not_owner, owner_only or any other 403): only the code's message;
// - permission with kind reload (403 cross_site): the message and a reload;
// - stale with kind reload (409): it changed, with a reload; or the screen's own state for the 409s above.
export function stateOf(outcome, has = SHARED_STATES) {
  if (outcome.failure === 'gate') return { state: 'permission', kind: 'gate' };
  if (outcome.failure !== undefined) return { state: 'error', kind: 'retry' };
  const { status, code = null } = outcome;
  if (status >= 200 && status < 300) return { state: 'normal', kind: null };
  if (status === 400 || status === 413) return { state: 'error', kind: 'input' };
  if (status === 401) return { state: 'permission', kind: 'gate' };
  if (status === 403) return { state: 'permission', kind: code === 'cross_site' ? 'reload' : 'message' };
  if (status === 404) return NORMAL_NOT_FOUND.has(code) ? { state: 'normal', kind: null } : { state: 'error', kind: 'gone' };
  if (status === 409) {
    const other = Object.hasOwn(CONFLICTS, code) ? CONFLICTS[code] : null;
    if (other === 'error') return { state: 'error', kind: 'input' };
    if (other !== null && has.includes(other)) return { state: other, kind: null };
    return { state: 'stale', kind: 'reload' };
  }
  return { state: 'error', kind: 'retry' };
}

// The stale state of read data (section 2): the screen shows when it read its data once that is STALE_AFTER_MS old,
// or as soon as a read again failed, as "HH:MM에 읽음" beside its title; null while there is nothing to show.
export const STALE_AFTER_MS = 5 * 60 * 1000;

export function readTag(readAt, now, failed = false) {
  if (readAt === null) return null;
  if (!failed && now - readAt < STALE_AFTER_MS) return null;
  return `${clockOf(readAt)}에 읽음`;
}

// The local time of a moment as HH:MM.
export function clockOf(time) {
  const at = new Date(time);
  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
}

// What a 401, or the gate's redirect, does on a page. The page reloads its own address once, through the gate, which
// signs the owner in and brings them back; before it does, it keeps a mark in this tab (sessionStorage, GATE_KEY: the
// time of that reload), and it drops the mark once a read succeeds. So reloadedAt is the mark or null, and the step is
// 'reload' when it is null and otherwise 'message', however long ago the reload was: a 401 that comes again before any
// read succeeded shows "다시 로그인하세요." with a reload button and never reloads by itself again. Where the mark
// cannot be kept, the page shows the message at once (shell.js).
export const GATE_KEY = 'nexus-gate-reload';

export function gateStep(reloadedAt) {
  return reloadedAt === null ? 'reload' : 'message';
}

// The theme (light or dark): the one the owner chose with the switch, kept in localStorage under THEME_KEY, or else
// the system's.
export const THEME_KEY = 'nexus-theme';

export function themeOf(stored, systemDark) {
  if (stored === 'light' || stored === 'dark') return stored;
  return systemDark ? 'dark' : 'light';
}

// The switch's name, which says the theme it turns to.
export function switchName(theme) {
  return theme === 'dark' ? '밝은 화면' : '어두운 화면';
}
