// The stage-09 mockup page in a frame of its own (TASK-458; SPEC-009, API-293), as the contract's getMockupPage says:
//
// - The view first reads the page's status (shell.probe, which stops the transfer once the status came), since a page
//   cannot read the status of a frame. Only a 200 opens the page, in an iframe with sandbox="allow-scripts" and nothing
//   more; the server's own sandbox header keeps it from NEXUS's origin. The page's frame-src 'self' lets the frame load
//   it (src/pages.js).
// - A bar above the frame always marks it as a mockup page, and NEXUS never asks for a sign-in inside it.
// - The view watches the frame. When it loads a second document, the mockup went to another page, which no header
//   covers: the view opens the mockup page again once and says that the mockup tried to open another page. The second
//   time it stops with "목업이 계속 다른 페이지를 열어요" and 다시 열기, which starts over.
// - A mockup that never drew (409 not_drawn) shows its name and the reason in place of the page (SCR-145#not-drawn).
//
// Its state lives in its nodes: the workbench keeps the same frame while the owner chooses tokens, and a new view of
// the screen, after a read that changed the data, makes a new frame.

import { diagramApi } from './address.js';
import { fill, h } from './dom.js';

export const FRAME_WORDS = Object.freeze({
  group: '떨어진 프레임에 연 목업 페이지',
  tag: 'sandbox',
  bar: '목업 페이지예요 · NEXUS는 이 안에서 로그인을 묻지 않아요. 다른 페이지로 가면 한 번 다시 열어요',
  reopened: '목업이 다른 페이지를 열려고 했어요.',
  stopped: '목업이 계속 다른 페이지를 열어요',
  again: '다시 열기',
});

// The mockup page's path (API-293).
export function pagePath(project, diagram) {
  return `${diagramApi(project, diagram)}/page`;
}

// The frame of diagram (API-265's Diagram) in a group with its bar, and its watcher.
export function mockupFrame({ diagram, shell }) {
  const path = pagePath(diagram.project, diagram.id);
  const notice = h('div', { class: 'frame-note' });
  const slot = h('div', { class: 'frame-slot' }, h('span', { class: 'sk frame', 'aria-hidden': 'true' }));
  const group = h('div', { class: 'isolated', role: 'group', 'aria-label': FRAME_WORDS.group },
    h('div', { class: 'isobar' }, h('span', { class: 'tag gray' }, FRAME_WORDS.tag), h('span', {}, FRAME_WORDS.bar)),
    notice,
    slot);
  let gone = false;

  // Reads the page's status, then frames it or says why not.
  async function open() {
    slot.replaceChildren(h('span', { class: 'sk frame', 'aria-hidden': 'true' }));
    const outcome = await shell.probe(path);
    if (gone) return;
    if (outcome.status === 200) return frame();
    if (outcome.status === 409) {
      slot.replaceChildren(h('div', { class: 'empty' }, h('h2', {}, diagram.name), h('p', { class: 'sec' }, shell.message(outcome.code ?? 'not_drawn'))));
      return;
    }
    if (outcome.status === 401 || outcome.status === 403 || outcome.failure === 'gate') return;
    if (outcome.status === 404) {
      slot.replaceChildren(h('div', { class: 'nt err', role: 'alert' }, h('div', { class: 'b' }, h('b', {}, shell.message(outcome.code))),
        h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => shell.reload() } }, '새로 고침')));
      return;
    }
    fill(slot, shell.errorNotice(outcome, open));
  }

  // The frame, and its watch: the first load is the mockup page's own; any later one is another document.
  function frame() {
    let own = true;
    let reopened = false;
    const iframe = h('iframe', {
      class: 'mock', src: path, sandbox: 'allow-scripts', title: diagram.name, referrerpolicy: 'no-referrer',
    });
    iframe.addEventListener('load', () => {
      if (own) {
        own = false;
        return;
      }
      if (!reopened) {
        reopened = true;
        notice.replaceChildren(h('div', { class: 'nt warn', role: 'status' }, h('div', { class: 'b' }, h('b', {}, FRAME_WORDS.reopened))));
        own = true;
        iframe.setAttribute('src', path);
        return;
      }
      stop();
    });
    slot.replaceChildren(iframe);
  }

  function stop() {
    notice.replaceChildren();
    slot.replaceChildren(h('div', { class: 'nt warn', role: 'alert' },
      h('div', { class: 'b' }, h('b', {}, FRAME_WORDS.stopped)),
      h('button', { type: 'button', class: 'btn tertiary sm', on: { click: () => open() } }, FRAME_WORDS.again)));
  }

  open();
  return {
    element: group,
    // Ends the watch when the view that holds the frame is drawn again.
    end() {
      gone = true;
    },
  };
}
