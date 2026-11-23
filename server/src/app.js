// The HTTP server: routes each request, answers JSON or a Problem, and logs one line per request.

import { createServer } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createAdmission, familyOf } from './admission.js';
import { answerOf, problemAnswer } from './answer.js';
import { BODY_KINDS, BodyAborted, closesConnection, readJson } from './body.js';
import { requestKeyOf } from './keys.js';
import { LIMITS } from './limits.js';
import { errorKind, jsonLines, methodOf, randomTraceId } from './log.js';
import { malformedParameter } from './params.js';
import { internal, methodNotAllowed, notFound, Problem } from './problem.js';
import { createRouter } from './router.js';
import { createWrites, isWrite } from './writes.js';

// The request listener. routes are the operations the server takes (see router.js); a handler gets
// { request, params, traceId, settings, store, caller, body } and returns { status, body, headers }: 200 or 201 (200
// when left out), a non-empty JSON object and headers of its own. It refuses by throwing a Problem; any other answer
// is a fault that answers internal (see answer.js). store is the open store's DatabaseSync (see store.js). Each
// request is admitted by its operation's family before anything else of it is read (see admission.js); gate is the
// gate's sign-in (see gate.js), which owner operations need. now() is the time in milliseconds.
//
// A request goes through these steps, each of which can refuse it: its path and method; its admission; its path
// parameters' forms (the 404 of what each names); its request key's form (rule 3); its body, JSON within its limit;
// then the operation, a write one at a time in the order they arrive with its request key (see writes.js).
export function createApp({
  settings, routes = [], log = jsonLines(), store = null, gate = null, now = Date.now,
}) {
  const find = createRouter(routes);
  // An action's family, from the contract: one action is one operation, so it has one family.
  const families = new Map(routes.map((route) => [route.action, familyOf(route)]));
  if (gate === null && [...families.values()].includes('owner')) throw new Error('owner operations need the gate');
  const admit = createAdmission(gate);
  const write = createWrites({ store, now });

  return async function listener(request, response) {
    const started = performance.now();
    // Every field is the server's own (see log.js); the request's path, query, headers and body stay out. The trace
    // ID and the sender change once admission knows the gate sent the request and who sent it.
    const entry = {
      time: new Date().toISOString(),
      traceId: randomTraceId(),
      method: methodOf(request.method),
      action: null,
      sender: 'unknown',
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

    // The most of an unread body the server reads and drops before answering on the same connection (see body.js):
    // the limit of the operation's body, or of any other body.
    let drainLimit = LIMITS.bodyBytes;
    try {
      const pathname = pathOf(request.url);
      const match = pathname === null ? null : find(request.method, pathname);
      if (match === null) throw notFound(pathname);
      if (match.allow) throw methodNotAllowed(match.allow);
      const { route, params } = match;
      entry.action = route.action;
      if (route.body !== undefined) drainLimit = BODY_KINDS[route.body].limit;
      // A refused request never reaches its handler, so its answer holds nothing of the store.
      const family = families.get(route.action);
      await admit(family, request, entry);
      const { traceId } = entry;
      // The caller a request key belongs to (TBL-169's actor): an admitted owner operation's is the owner. TASK-417
      // gives an agent operation its credential's ID; until then no agent request is admitted.
      const caller = family === 'owner' ? 'owner' : null;
      const malformed = malformedParameter(route.checks, params);
      if (malformed !== null) throw new Problem(malformed);
      const key = route.requestKey ? requestKeyOf(request.headers) : null;
      const { value: body, bytes = null } = route.body === undefined ? {} : await readJson(request, route.body);
      const context = { request, params, traceId, settings, store, caller, body };
      const answer = isWrite(route)
        ? await write(route, context, { pathname, key, bytes })
        : answerOf(await route.handle(context));
      send(response, answer, closesConnection(request, drainLimit));
    } catch (error) {
      // A request whose connection dropped before its body arrived has no one to answer; its log line says aborted.
      if (error instanceof BodyAborted) {
        response.destroy();
        return;
      }
      const problem = error instanceof Problem ? error : internal();
      if (problem !== error) entry.error = errorKind(error);
      entry.code = problem.code;
      if (response.headersSent) {
        response.destroy();
        return;
      }
      try {
        send(response, problemAnswer(problem, entry.traceId), closesConnection(request, drainLimit));
      } catch (sendError) {
        // A refusal that cannot be sent drops the connection; the listener itself never fails.
        entry.error ??= errorKind(sendError);
        response.destroy();
      }
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

// Sends an answer of answer.js. The body's type, its length and nosniff are always the server's. close is true when
// the answer closes the connection, for a body the server will not read to its end.
function send(response, answer, close) {
  const all = Object.assign(Object.create(null), answer.headers);
  all['x-content-type-options'] = 'nosniff';
  if (close) all.connection = 'close';
  all['content-type'] = answer.type;
  all['content-length'] = Buffer.byteLength(answer.text);
  response.writeHead(answer.status, all);
  response.end(answer.text);
}
