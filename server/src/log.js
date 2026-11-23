// The server's log: one JSON line per request, and a line when the server starts, stops or crashes.
//
// Rule 5 of the functional spec: no log line holds an agent credential's secret, a credential digest, a sign-in
// token, a server path or the text of a refused file. Every field below is built by the server from values it
// checks, never copied from the request (its path, query, headers or body) or from an error's message or stack.

import { randomBytes } from 'node:crypto';
import dns from 'node:dns';
import { constants } from 'node:os';
import { getSystemErrorMap } from 'node:util';

// The gate's CF-Ray, as the contract's traceId pattern allows: 16 hex digits and the data centre's code.
const CF_RAY = /^[0-9a-f]{16}-[A-Z]{3}$/;
const METHOD = /^[A-Z][A-Z-]{0,19}$/;
const ERROR_NAMES = new Set([
  'Error', 'AggregateError', 'EvalError', 'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError',
]);
// Error codes by name only: the system's and libuv's, such as ENOENT or EAI_AGAIN, the resolver's, such as ENOTFOUND,
// and Node's own, such as ERR_INVALID_ARG_TYPE.
const SYSTEM_CODES = new Set([
  ...Object.keys(constants.errno),
  ...[...getSystemErrorMap().values()].map(([name]) => name),
  ...Object.values(dns).filter((value) => typeof value === 'string' && /^E[A-Z]+$/.test(value)),
]);
const NODE_CODE = /^ERR_[A-Z0-9_]{1,60}$/;
const ignore = () => {};
// The streams whose write errors are already dropped.
const guarded = new WeakSet();

// The ID of one request in the log and in its Problem answer. Every request starts with 16 random hex digits; one the
// gate is known to have sent, because the owner's sign-in on it was admitted (admission.js), takes the gate's CF-Ray.
export function randomTraceId() {
  return randomBytes(8).toString('hex');
}

// The gate's CF-Ray when it has the right form, or null. Anyone who reaches the server without the gate can send one,
// so it is taken only for a request the gate is known to have sent.
export function rayOf(headers) {
  const ray = headers['cf-ray'];
  return typeof ray === 'string' && CF_RAY.test(ray) ? ray : null;
}

export function methodOf(method) {
  return typeof method === 'string' && METHOD.test(method) ? method : 'OTHER';
}

// What kind of error it was, from the built-in error types and Node's codes only.
export function errorKind(error) {
  const name = error?.constructor?.name;
  const kind = ERROR_NAMES.has(name) ? name : 'Error';
  const code = error?.code;
  const known = typeof code === 'string' && (SYSTEM_CODES.has(code) || NODE_CODE.test(code));
  return known ? `${kind} ${code}` : kind;
}

// Writes each entry as one line of JSON. A log that cannot be written, such as a closed pipe (EPIPE), must not stop
// the server, so the stream's write errors are dropped.
export function jsonLines(stream = process.stdout) {
  if (typeof stream.on === 'function' && !guarded.has(stream)) {
    stream.on('error', ignore);
    guarded.add(stream);
  }
  return (entry) => {
    stream.write(`${JSON.stringify(entry)}\n`);
  };
}

// Replaces Node's report of an uncaught error, which prints the stack and so the server's paths, with one line.
export function logCrashes(target, log, exit = (code) => target.exit(code)) {
  const crashed = (error) => {
    try {
      log({ time: new Date().toISOString(), event: 'crashed', error: errorKind(error) });
    } finally {
      exit(1);
    }
  };
  target.on('uncaughtException', crashed);
  target.on('unhandledRejection', crashed);
}
