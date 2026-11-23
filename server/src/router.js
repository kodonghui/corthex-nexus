// The router: a table of operations, each a method and a path template of api/openapi.yaml such as
// /api/spaces/{project}/todo, matched one segment at a time.
//
// A route is { method, path, action, handle }: action is the operation's operationId, which the log names, and
// handle(context) answers it. A path parameter matches one non-empty segment and is passed percent-decoded, or as
// sent when it does not decode. The router does not check it: the decoded text can hold any character, such as / or
// .., and the contract gives a value in another form the 404 of what it names, so each handler checks its
// parameters against their schemas before using them. Where two templates match a path, the one with a literal
// segment where the other has a parameter wins.

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
  const { method, path, action, handle } = route;
  if (!METHODS.has(method)) throw new Error(`unknown method ${method}`);
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error(`path ${path} must start with /`);
  if (typeof action !== 'string' || action === '') throw new Error(`${method} ${path} needs its action`);
  if (typeof handle !== 'function') throw new Error(`${method} ${path} needs its handler`);
  const parts = path.slice(1).split('/').map((segment) => {
    const parameter = PARAMETER.exec(segment);
    if (parameter !== null) return { parameter: parameter[1] };
    if (!LITERAL.test(segment)) throw new Error(`path ${path} has an invalid segment`);
    return { literal: segment };
  });
  const names = parts.filter((part) => part.parameter).map((part) => part.parameter);
  if (new Set(names).size !== names.length) throw new Error(`path ${path} repeats a parameter`);
  return {
    method,
    action,
    handle,
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
