// Running a screen of web/ on test/fake-dom.js, against stubbed answers or the server's: the shell's tests
// (shell.test.js) and the screens' (such as todo-screen.test.js) share it.

import { registerHooks } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { messagesModule } from '../src/pages.js';
import { parseAddress } from '../web/address.js';
import { fakePage } from './fake-dom.js';
import { waitFor } from './support.js';

// web/messages.js is made by the server as it starts (src/pages.js); here it is made the same way for the import. The
// server serves src/layout.js as /web/layout.js (SHARED in src/pages.js); here a page's import of it reads that file.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === './messages.js' && context.parentURL?.endsWith('/web/shell.js')) {
      return { url: `data:text/javascript;charset=utf-8,${encodeURIComponent(messagesModule())}`, shortCircuit: true };
    }
    if (specifier === './layout.js' && context.parentURL?.includes('/web/')) {
      return { url: new URL('../src/layout.js', import.meta.url).href, shortCircuit: true };
    }
    return next(specifier, context);
  },
});
export const { message, startShell } = await import('../web/shell.js');
export const { chosenDiagram, LISTED_DIAGRAMS, MISSING, SCREENS } = await import('../web/screens.js');

export const TRACE = 'a1b2c3d4e5f60718';
export const json = (status, body) => () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const problem = (status, code) => json(status, { title: 'x', status, detail: 'x', code, traceId: TRACE });
// The gate sending a read to its sign-in, as fetch with redirect: 'manual' gives it.
export const GATE = () => ({ type: 'opaqueredirect', status: 0, json: async () => { throw new SyntaxError('no body'); } });

// Runs the screen of pathname and search on a fake page, with answers by path (each a function that makes a Response,
// or an Error to throw) or a function of the path and the request. The page's globals stay installed until close();
// phone and clipboard are fakePage's.
export async function openPage(pathname, { search = '', answers = {}, session = {}, local = {}, blocked = false, phone = false, clipboard = 'allowed' } = {}) {
  const page = fakePage({ pathname, search, session, local, blocked, phone, clipboard });
  const restore = page.install();
  const realFetch = globalThis.fetch;
  let pending = 0;
  page.calls = [];
  globalThis.fetch = async (path, init) => {
    page.calls.push(path);
    pending += 1;
    try {
      const answer = typeof answers === 'function' ? answers : answers[path];
      if (answer === undefined) throw new Error(`no answer for ${path}`);
      const made = await answer(path, init);
      if (made instanceof Error) throw made;
      // A real answer's body comes over the network after fetch resolves: read it here, so that settle() waits for it.
      if (made instanceof Response) return new Response(await made.arrayBuffer(), { status: made.status, headers: made.headers });
      return made;
    } finally {
      pending -= 1;
    }
  };
  page.settle = async () => {
    // Let zero-delay queued actions start before waiting for their requests.
    await delay(2);
    await waitFor(() => pending === 0);
    await delay(10);
  };
  page.close = () => {
    restore();
    globalThis.fetch = realFetch;
  };
  const address = parseAddress(pathname, search);
  try {
    page.shell = startShell(page.app, address === null ? MISSING : SCREENS[address.screen], address ?? {}, { pendingOptions: { schedule: (fn) => setTimeout(fn, 0) } });
    await page.settle();
  } catch (error) {
    page.close();
    throw error;
  }
  return page;
}

export const texts = (page, tag, className = null) => page.app.all(tag, className).filter((element) => element.shown).map((element) => element.textContent);
export const headerOf = (page) => page.app.all('header')[0];
export const errorShown = (page) => page.app.all('div', 'err').some((element) => element.shown);
