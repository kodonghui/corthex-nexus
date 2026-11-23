// The router: a table of operations, each a method and a path template of api/openapi.yaml such as
// /api/spaces/{project}/todo, matched one segment at a time.
//
// A route is { method, path, action, handle, params, body, requestKey, repeat }:
// - action is the operation's operationId, which the log names, and handle(context) answers it.
// - params names, for each parameter of the path, the 404 code of what it names (see params.js), such as
//   { project: 'project_not_found' }. A path parameter matches one non-empty segment and is percent-decoded, or kept
//   as sent when it does not decode; app.js answers a value that is not in its form with that code, so a handler
//   gets only values in the contract's form, never one holding / or .. or a control character.
// - body is the kind of JSON body the operation takes (see body.js): 'json', 'miro' or 'snapshot'; without it the
//   operation takes no body and the server reads none.
// - requestKey is true when the operation takes an Idempotency-Key (rule 3, see writes.js), and repeat(result), if
//   given, is what a repeat of the key answers instead of the first result.
// - media is the type of a success other than JSON, 'text/html' for a page (see answer.js), for a GET only; headers are
//   headers every answer of the operation carries once its path and method are matched, its refusals and faults
//   included, such as API-293's Content-Security-Policy.
// Where two templates match a path, the one with a literal segment where the other has a parameter wins. A handler runs
// as its operation (see operation.js), and what it waits for with it.

import { validateHeaderName, validateHeaderValue } from 'node:http';
import { MEDIA } from './answer.js';
import { BODY_KINDS } from './body.js';
import { runAs } from './operation.js';
import { FORMS } from './params.js';

const PARAMETER = /^\{([a-z_][a-z0-9_]*)\}$/;
const LITERAL = /^[A-Za-z0-9._~-]+$/;
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function createRouter(routes) {
  const compiled = routes.map(compile);
  const seen = new Set();
  for (const route of compiled) {
    const key = `${route.method} ${route.shape}`;
    if (seen.has(key)) throw new Error(`two routes for ${key}`);
    seen.add(key);
  }

  // Returns { route, params } for an operation, { allow } when the path takes other methods only, or null.
  return function find(method, pathname) {
    const segments = pathname.split('/');
    let best = null;
    const allow = new Set();
    for (const route of compiled) {
      const params = route.match(segments);
      if (params === null) continue;
      if (route.method !== method) {
        allow.add(route.method);
      } else if (best === null || moreLiteral(route, best.route)) {
        best = { route, params };
      }
    }
    if (best !== null) return best;
    return allow.size > 0 ? { allow: [...allow].sort() } : null;
  };
}

function compile(route) {
  const {
    method, path, action, handle, params = {}, body, requestKey = false, repeat, media, headers = {},
  } = route;
  if (!METHODS.has(method)) throw new Error(`unknown method ${method}`);
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`path ${path} must start with /`);
  if (typeof action !== 'string' || action === '') throw new Error(`${method} ${path} needs its action`);
  if (typeof handle !== 'function') throw new Error(`${method} ${path} needs its handler`);
  if (body !== undefined && !Object.hasOwn(BODY_KINDS, body)) throw new Error(`${method} ${path} has an unknown body`);
  if (typeof requestKey !== 'boolean') throw new Error(`${method} ${path}: requestKey is true or false`);
  if (method === 'GET' && (body !== undefined || requestKey)) {
    throw new Error(`GET ${path} takes no body or request key`);
  }
  if (repeat !== undefined && (typeof repeat !== 'function' || !requestKey)) {
    throw new Error(`${method} ${path}: repeat is a function, for a route with a request key`);
  }
  if (media !== undefined && (!Object.hasOwn(MEDIA, media) || method !== 'GET')) {
    throw new Error(`${method} ${path}: media is a type answer.js sends, for a GET`);
  }
  if (typeof headers !== 'object' || headers === null || Array.isArray(headers)) throw new Error(`${method} ${path}: headers is an object`);
  const own = Object.create(null);
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    validateHeaderName(key);
    validateHeaderValue(key, value);
    if (typeof value !== 'string' || ['content-type', 'content-length', 'connection', 'x-content-type-options'].includes(key)) {
      throw new Error(`${method} ${path}: a route's header is text, and not one the server sets`);
    }
    own[key] = value;
  }
  const parts = path.slice(1).split('/').map((segment) => {
    const parameter = PARAMETER.exec(segment);
    if (parameter !== null) return { parameter: parameter[1] };
    if (!LITERAL.test(segment)) throw new Error(`path ${path} has an invalid segment`);
    return { literal: segment };
  });
  const names = parts.filter((part) => part.parameter).map((part) => part.parameter);
  if (new Set(names).size !== names.length) throw new Error(`path ${path} repeats a parameter`);
  if (typeof params !== 'object' || params === null) throw new Error(`${method} ${path}: params is an object`);
  for (const name of Object.keys(params)) {
    if (!names.includes(name)) throw new Error(`${method} ${path} has no parameter ${name}`);
  }
  const checks = names.map((name) => {
    const code = Object.hasOwn(params, name) ? params[name] : undefined;
    if (!Object.hasOwn(FORMS, code)) throw new Error(`${method} ${path} needs the 404 code of {${name}}`);
    return [name, code];
  });
  return {
    method,
    path,
    action,
    handle: (context) => runAs(action, () => handle(context)),
    checks,
    body,
    requestKey,
    repeat,
    media,
    headers: Object.freeze(own),
    literals: parts.map((part) => part.literal !== undefined),
    shape: `/${parts.map((part) => (part.literal !== undefined ? part.literal : '{}')).join('/')}`,
    match(segments) {
      // segments[0] is the empty text before the leading slash.
      if (segments.length !== parts.length + 1) return null;
      const params = {};
      for (let index = 0; index < parts.length; index += 1) {
        const segment = segments[index + 1];
        const part = parts[index];
        if (part.literal !== undefined) {
          if (segment !== part.literal) return null;
          continue;
        }
        if (segment === '') return null;
        try {
          params[part.parameter] = decodeURIComponent(segment);
        } catch {
          params[part.parameter] = segment;
        }
      }
      return params;
    },
  };
}

function moreLiteral(route, other) {
  for (let index = 0; index < route.literals.length; index += 1) {
    if (route.literals[index] !== other.literals[index]) return route.literals[index];
  }
  return false;
}
