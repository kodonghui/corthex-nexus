// Answers, each checked whole before it is sent, so that a write whose answer cannot be sent is rolled back rather than
// stored (see writes.js).

import { validateHeaderName, validateHeaderValue } from 'node:http';

const JSON_TYPE = 'application/json; charset=utf-8';
const PROBLEM_TYPE = 'application/problem+json';
// The statuses of the contract's successes. Every other answer of the contract is a Problem.
const SUCCESSES = new Set([200, 201]);
// Headers of every answer, which a handler may replace.
const DEFAULT_HEADERS = Object.freeze({ 'cache-control': 'no-store' });
// Headers that frame the message or the connection, which only Node and the server set.
const FRAMING_HEADERS = new Set([
  'connection', 'content-length', 'keep-alive', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade',
]);

// The answer to what an operation's handler returns: { status, body, headers }, where status is 200 or 201 (200 when
// left out), body a non-empty JSON object, as the contract makes every success, since the hub reads an empty answer as
// a failure, and headers names and values Node can send, none of them a framing header. A handler refuses by throwing
// a Problem. Returns { status, type, text, headers }; anything else is a fault of the server, a TypeError, which
// answers internal.
export function answerOf(result) {
  if (typeof result !== 'object' || result === null) throw new TypeError('a handler returns { status, body, headers }');
  const status = result.status ?? 200;
  if (!SUCCESSES.has(status)) throw new TypeError('a handler answers 200 or 201 and refuses with a Problem');
  // The text as sent is checked, not the value: { id: undefined } is sent as {}.
  const text = JSON.stringify(result.body);
  if (typeof text !== 'string' || !text.startsWith('{') || text === '{}') {
    throw new TypeError('a success is a non-empty JSON object');
  }
  return answer(status, JSON_TYPE, text, result.headers);
}

// The first answer to a request key, as it was sent: its status and JSON text, which the key keeps (see keys.js).
export function keptAnswer(status, text) {
  return answer(status, JSON_TYPE, text);
}

// The answer of a Problem, whose headers, such as Allow, are the server's own.
export function problemAnswer(problem, traceId) {
  return answer(problem.status, PROBLEM_TYPE, JSON.stringify(problem.body(traceId)), problem.headers);
}

// Header names are matched without case, so a handler's header replaces a default of the same name.
function answer(status, type, text, extra) {
  if (typeof text !== 'string') throw new TypeError('an answer needs a JSON body');
  const headers = Object.assign(Object.create(null), DEFAULT_HEADERS);
  for (const [name, value] of Object.entries(extra ?? {})) {
    const key = name.toLowerCase();
    if (FRAMING_HEADERS.has(key)) throw new TypeError(`a handler cannot set ${key}`);
    validateHeaderName(key);
    validateHeaderValue(key, value);
    headers[key] = value;
  }
  return Object.freeze({ status, type, text, headers: Object.freeze(headers) });
}
