// The HTTP server: routes each request, answers JSON or a Problem, and logs one line per request.

import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { errorKind, jsonLines, methodOf, traceIdFor } from './log.js';
import { internal, methodNotAllowed, notFound, Problem } from './problem.js';
import { createRouter } from './router.js';

const SAFE_HEADERS = Object.freeze({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });

// The request listener. routes are the operations the server takes (see router.js); a handler gets
// { request, params, traceId, settings } and returns { status, body, headers }, body being a JSON object.
export function createApp({ settings, routes = [], log = jsonLines() }) {
  const find = createRouter(routes);

  return async function listener(request, response) {
    const started = performance.now();
    const traceId = traceIdFor(request.headers);
    // Every field is the server's own (see log.js); the request's path, query, headers and body stay out.
    const entry = {
      time: new Date().toISOString(),
      traceId,
      method: methodOf(request.method),
      action: null,
      status: null,
      code: null,
      ms: 0,
    };
    // 'close' follows a finished answer and a dropped connection alike, so each request logs exactly once.
    response.once('close', () => {
      entry.status = response.headersSent ? response.statusCode : null;
      entry.ms = Math.round(performance.now() - started);
      if (!response.writableFinished) entry.aborted = true;
      try {
        log(entry);
      } catch {
        // A log that cannot be written does not change the answer.
      }
    });

    try {
      const pathname = pathOf(request.url);
      const match = pathname === null ? null : find(request.method, pathname);
      if (match === null) throw notFound(pathname);
      if (match.allow) throw methodNotAllowed(match.allow);
      entry.action = match.route.action;
      const result = await match.route.handle({ request, params: match.params, traceId, settings });
      send(response, result.status ?? 200, 'application/json; charset=utf-8', result.body, result.headers);
    } catch (error) {
      const problem = error instanceof Problem ? error : internal();
      if (problem !== error) entry.error = errorKind(error);
      entry.code = problem.code;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      send(response, problem.status, 'application/problem+json', problem.body(traceId), problem.headers);
    }
  };
}

export function createNexusServer(options) {
  return createServer(createApp(options));
}

// The path of an origin-form request target, without its query. Any other form names no operation.
function pathOf(target) {
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) return null;
  const end = target.indexOf('?');
  return end === -1 ? target : target.slice(0, end);
}

function send(response, status, type, body, headers = {}) {
  const text = JSON.stringify(body);
  if (typeof text !== 'string') throw new TypeError('an answer needs a JSON body');
  response.writeHead(status, {
    ...SAFE_HEADERS,
    ...headers,
    'Content-Type': type,
    'Content-Length': Buffer.byteLength(text),
  });
  response.end(text);
}
