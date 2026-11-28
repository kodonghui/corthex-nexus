// Shared by the tests of the app shell (TASK-454) and the workbench (TASK-458): the little of a browser that web/shell.js,
// web/dom.js, web/screens.js and the workbench's modules use, so that node --test runs them without a browser or a
// dependency. It is no browser:
// it lays nothing out and runs no CSS, so the browser walk of the pull request shows how the pages look. node --test
// also runs this file, which holds no test.

class FakeText {
  constructor(text) {
    this.text = String(text);
    this.parent = null;
  }

  get textContent() {
    return this.text;
  }
}

export class FakeElement {
  constructor(tag, document) {
    this.tagName = tag.toUpperCase();
    this.document = document;
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this.listeners = new Map();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  get hidden() {
    return this.attributes.has('hidden');
  }

  set hidden(value) {
    if (value) this.setAttribute('hidden', '');
    else this.removeAttribute('hidden');
  }

  get className() {
    return this.getAttribute('class') ?? '';
  }

  get parentNode() {
    return this.parent;
  }

  append(...nodes) {
    for (const each of nodes) {
      const node = typeof each === 'string' ? new FakeText(each) : each;
      if (node.parent !== null) node.parent.children = node.parent.children.filter((child) => child !== node);
      node.parent = this;
      this.children.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.children) child.parent = null;
    this.children = [];
    this.append(...nodes);
  }

  get textContent() {
    return this.children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this.replaceChildren(String(value));
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  // Sends an event of type to this element's listeners and then its ancestors' and the document's, as a bubbling
  // event does; preventDefault marks it defaultPrevented for the listeners after.
  dispatch(type, fields = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    for (let node = this; node !== null; node = node.parent) {
      for (const listener of node.listeners.get(type) ?? []) listener(event);
    }
    for (const listener of this.document.listeners.get(type) ?? []) listener(event);
  }

  click() {
    this.dispatch('click');
  }

  focus() {
    this.document.activeElement = this;
  }

  // Selects a field's text, as a browser does: here it only marks the field.
  select() {
    this.selectedAll = true;
  }

  contains(node) {
    for (let each = node; each !== null && each !== undefined; each = each.parent) if (each === this) return true;
    return false;
  }

  // Every element under this one, in document order.
  descendants() {
    return this.children.flatMap((child) => (child instanceof FakeElement ? [child, ...child.descendants()] : []));
  }

  // querySelector and querySelectorAll by a tag name only, which is all the shell asks.
  querySelectorAll(tag) {
    return this.descendants().filter((element) => element.tagName === tag.toUpperCase());
  }

  querySelector(tag) {
    return this.querySelectorAll(tag)[0] ?? null;
  }

  // The elements under this one that a test looks for: by tag, and by a class they carry.
  all(tag, className = null) {
    return this.querySelectorAll(tag).filter((element) => className === null || element.className.split(' ').includes(className));
  }

  // Whether the element shows: neither it nor an ancestor is hidden.
  get shown() {
    for (let node = this; node !== null; node = node.parent) if (node.hidden) return false;
    return true;
  }
}

class FakeStorage {
  constructor(entries = {}) {
    this.entries = new Map(Object.entries(entries));
  }

  get length() { return this.entries.size; }

  key(index) { return [...this.entries.keys()][index] ?? null; }

  getItem(key) {
    return this.entries.has(key) ? this.entries.get(key) : null;
  }

  setItem(key, value) {
    this.entries.set(key, String(value));
  }

  removeItem(key) {
    this.entries.delete(key);
  }
}

// Storage that the browser refuses, as with site data blocked: every call throws.
const BLOCKED = Object.freeze({
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
});

// A page at pathname and search: { app, document, location, history, session, local, ticks, copied, install, pop }.
// install() puts its document, location, history, storage, matchMedia, setInterval, the window's addEventListener, a
// clipboard on the navigator and CSS.supports on globalThis, and returns a function that takes them away again; a
// history or a clipboard that a test put in place before keeps its place. The interval functions the page starts are
// kept in ticks for the test to run. blocked refuses sessionStorage; phone
// makes the page a phone's (a narrow screen with a coarse pointer); clipboard 'refused' makes writing to it fail, and
// what is written goes into copied. history.pushState and replaceState move location; location.assign keeps each
// address in assigned; pop(href) goes back or forward to href, as the browser's buttons do.
export function fakePage({ pathname = '/', search = '', session = {}, local = {}, systemDark = false, blocked = false, phone = false, clipboard = 'allowed' } = {}) {
  const document = {
    listeners: new Map(),
    title: '',
    visibilityState: 'visible',
    activeElement: null,
    createElement: (tag) => new FakeElement(tag, document),
    getElementById: (id) => app.descendants().find((element) => element.getAttribute('id') === id) ?? null,
    createElementNS: (namespace, tag) => new FakeElement(tag, document),
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    },
    dispatch(type) {
      for (const listener of this.listeners.get(type) ?? []) listener({ type, target: this });
    },
  };
  document.documentElement = new FakeElement('html', document);
  const app = new FakeElement('div', document);
  // assign() keeps the addresses the page went to, in assigned, and goes nowhere.
  const location = { pathname, search, reloads: 0, assigned: [], reload() { this.reloads += 1; }, assign(url) { this.assigned.push(String(url)); } };
  const go = (href) => {
    const at = href.indexOf('?');
    location.pathname = at === -1 ? href : href.slice(0, at);
    location.search = at === -1 ? '' : href.slice(at);
  };
  const history = {
    pushed: [],
    pushState(state, title, href) {
      this.pushed.push(href);
      go(href);
    },
    replaceState(state, title, href) {
      go(href);
    },
  };
  const windowListeners = new Map();
  const page = {
    app,
    document,
    location,
    history,
    session: new FakeStorage(session),
    local: new FakeStorage(local),
    ticks: [],
    copied: [],
    pop(href) {
      go(href);
      for (const listener of windowListeners.get('popstate') ?? []) listener({ type: 'popstate' });
    },
    install() {
      const names = ['document', 'location', 'history', 'sessionStorage', 'localStorage', 'matchMedia', 'setInterval', 'addEventListener', 'CSS'];
      const before = Object.fromEntries(names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
      const ownClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, 'clipboard');
      const values = {
        document,
        location,
        history: before.history?.value ?? history,
        sessionStorage: blocked ? BLOCKED : page.session,
        localStorage: page.local,
        matchMedia: (query) => ({
          matches: (query.includes('prefers-color-scheme: dark') && systemDark) || (phone && query.includes('pointer: coarse')),
          addEventListener() {},
        }),
        setInterval: (listener) => page.ticks.push(listener),
        addEventListener(type, listener) {
          if (!windowListeners.has(type)) windowListeners.set(type, []);
          windowListeners.get(type).push(listener);
        },
        // A stand-in for the browser's colour parser: a hex colour, rgb(), hsl() or a word.
        CSS: { supports: (property, value) => property === 'color' && /^(?:#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([^()]*\)|[a-z]+)$/i.test(value) },
      };
      for (const name of names) Object.defineProperty(globalThis, name, { value: values[name], configurable: true, writable: true });
      const pageClipboard = {
        async writeText(text) {
          if (clipboard === 'refused') throw new Error('NotAllowedError');
          page.copied.push(text);
        },
      };
      if (ownClipboard === undefined) Object.defineProperty(globalThis.navigator, 'clipboard', { value: pageClipboard, configurable: true, writable: true });
      return () => {
        for (const name of names) {
          if (before[name] === undefined) delete globalThis[name];
          else Object.defineProperty(globalThis, name, before[name]);
        }
        if (ownClipboard === undefined) delete globalThis.navigator.clipboard;
      };
    },
  };
  return page;
}
