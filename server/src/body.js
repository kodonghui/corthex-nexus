// Request bodies: JSON only, each within the limit the contract gives its operation (TASK-415).
//
// A body is read only after the request is routed and its caller admitted, and only as far as its limit: a body
// over it is refused without reading the rest, and the connection is then closed rather than drained.

import { LIMITS } from './limits.js';
import { invalidRequest, Problem, tooLarge } from './problem.js';

// The kinds of body an operation takes, by its limit (components.x-corthex.limits): a snapshot (API-242), a Miro
// export (API-292) and any other body. invalid is the code of a body that is not a JSON object.
export const BODY_KINDS = Object.freeze({
  json: Object.freeze({ limit: LIMITS.bodyBytes, tooLarge: 'body_too_large', invalid: 'invalid_request' }),
  miro: Object.freeze({ limit: LIMITS.miroBytes, tooLarge: 'body_too_large', invalid: 'invalid_request' }),
  snapshot: Object.freeze({ limit: LIMITS.snapshotBytes, tooLarge: 'snapshot_too_large', invalid: 'invalid_snapshot' }),
});

const MEDIA_TYPE = /^\s*application\/json\s*$/i;
const UTF8 = new TextDecoder('utf-8', { fatal: true });

// The connection dropped before the whole body arrived; there is no one to answer.
export class BodyAborted extends Error {
  constructor() {
    super('the request ended before its body');
    this.name = 'BodyAborted';
  }
}

// Whether the request has a body, from its framing headers alone, before any of it is read.
export function hasBody(request) {
  const length = request.headers['content-length'];
  return request.headers['transfer-encoding'] !== undefined || (length !== undefined && Number(length) > 0);
}

// Whether an answer sent now closes the connection instead of letting Node read and drop the rest of the body. Node
// reads an unread body to its end before the connection takes the next request, so the server lets it do so only
// for a body whose declared length is within limit: the caller, which may still be sending, then reads its answer
// rather than a reset connection. A body over limit, one whose length is not declared and one partly read already
// close the connection, so the server never reads more than limit of a body it did not take.
export function closesConnection(request, limit) {
  if (!hasBody(request) || request.complete) return false;
  const declared = request.headers['content-length'];
  return declared === undefined || Number(declared) > limit || request.readableFlowing !== null;
}

// Reads a JSON object body of the given kind. Returns { value, bytes }: the parsed object and the bytes as sent.
// Refuses json_required (415) when the body is not application/json, the kind's too-large code (413) when it is over
// its limit, and the kind's invalid code (400, field "body") when it is not UTF-8 JSON text of an object.
export async function readJson(request, kind) {
  const { limit, tooLarge: tooLargeCode, invalid } = BODY_KINDS[kind];
  if (!isJson(request.headers)) throw new Problem('json_required');
  const declared = request.headers['content-length'];
  if (declared !== undefined && Number(declared) > limit) throw tooLarge(tooLargeCode, limit);
  const bytes = await readBytes(request, limit, tooLargeCode);
  let value;
  try {
    value = JSON.parse(UTF8.decode(bytes));
  } catch {
    throw invalidRequest('body', 'the body is not JSON text in UTF-8', invalid);
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw invalidRequest('body', 'the body must be a JSON object', invalid);
  }
  return { value, bytes };
}

// application/json, with at most a charset of utf-8 (RFC 8259 JSON is UTF-8), and no content coding.
function isJson(headers) {
  const encoding = headers['content-encoding'];
  if (encoding !== undefined && encoding.trim().toLowerCase() !== 'identity') return false;
  const [type, ...parameters] = (headers['content-type'] ?? '').split(';');
  if (!MEDIA_TYPE.test(type)) return false;
  return parameters.every((parameter) => {
    const [name, value = ''] = parameter.split('=');
    if (name.trim().toLowerCase() !== 'charset') return true;
    return value.trim().replace(/^"(.*)"$/, '$1').toLowerCase() === 'utf-8';
  });
}

// The body's bytes, up to limit. Past it, reading stops: the stream is paused and left unread.
function readBytes(request, limit, tooLargeCode) {
  if (request.destroyed) return Promise.reject(new BodyAborted());
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const settle = (error, value) => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      request.off('close', onClose);
      if (error) reject(error);
      else resolve(value);
    };
    const onData = (chunk) => {
      size += chunk.length;
      if (size > limit) {
        request.pause();
        settle(tooLarge(tooLargeCode, limit));
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => settle(null, Buffer.concat(chunks, size));
    const onError = () => settle(new BodyAborted());
    const onClose = () => settle(new BodyAborted());
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    request.once('close', onClose);
  });
}
