// Problem answers (RFC 9457), in the shape of components.schemas.Problem of api/openapi.yaml.
//
// The skeleton gives the codes of the router only; TASK-415 adds the rest of the registry in
// components.x-corthex.errors. test/problem.test.js checks each entry here against that registry.

// The commands of the pinned hub that NEXUS takes (SPEC-014), which a missing path under /api/spaces names.
export const AGENT_COMMANDS = Object.freeze(['push', 'todo', 'claim', 'comment', 'decide', 'reflect', 'status', 'record']);

const ENTRIES = Object.freeze({
  not_found: { status: 404, title: 'No such address' },
  method_not_allowed: { status: 405, title: 'This address does not take that method' },
  internal: { status: 500, title: 'Something went wrong' },
  // Admission (admission.js, TASK-416).
  unauthenticated: { status: 401, title: 'Sign in to NEXUS' },
  not_owner: { status: 403, title: 'Only the owner can open NEXUS' },
  cross_site: { status: 403, title: 'A request from another site' },
  access_missing: { status: 401, title: 'No valid agent credential' },
});

export const PROBLEM_CODES = Object.freeze(Object.keys(ENTRIES));

export class Problem extends Error {
  constructor(code, detail, headers = {}) {
    const entry = ENTRIES[code];
    if (entry === undefined) throw new TypeError(`no Problem entry for ${code}`);
    super(detail);
    this.name = 'Problem';
    this.code = code;
    this.status = entry.status;
    this.title = entry.title;
    this.detail = detail;
    this.headers = headers;
  }

  body(traceId) {
    return { title: this.title, status: this.status, detail: this.detail, code: this.code, traceId };
  }
}

// A path that is no operation. The detail never repeats the path the request gave.
export function notFound(pathname) {
  if (pathname === '/api/spaces' || pathname?.startsWith('/api/spaces/')) {
    return new Problem('not_found', `no agent command has this address; NEXUS takes ${listed(AGENT_COMMANDS)}`);
  }
  return new Problem('not_found', 'no operation has this address');
}

export function methodNotAllowed(allow) {
  return new Problem('method_not_allowed', `this address takes ${listed(allow)}`, { Allow: allow.join(', ') });
}

export function internal() {
  return new Problem('internal', 'an unexpected error; the trace ID names it');
}

function listed(words) {
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}
