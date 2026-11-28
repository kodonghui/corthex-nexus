// Reads and writes of NEXUS's API from a page. Each returns an outcome, which states.js turns into a screen's state:
// - { status, body } for a success, body being its JSON object;
// - { status, code, traceId } for any other answer, from its Problem when it is one;
// - { failure } when no answer of NEXUS came: 'gate' when the gate redirected the request to its sign-in, 'timeout',
//   'network', or 'answer' for a success that is not a JSON object.
// The page holds nothing of a project before the API answers it, and keeps none of it after (see storage.js).

export const READ_TIMEOUT_MS = 30_000;

export function read(path) {
  return request(path, { headers: { accept: 'application/json' } });
}

// A write of the owner's (docs/08-screens, section 2): method (POST, PATCH or DELETE) on path, with body as JSON, or no
// body when it is null, and the request key, a write ID that newRequestKey() made, in double quotes as the contract's
// Idempotency-Key takes it. With raw, body is a text that goes as it is, as JSON: a Miro export the owner chose, which
// only the server reads (API-292). The shell's write (shell.js) sends a 401 or 403 through the permission rule.
export function write(method, path, body, key, { raw = false, keepalive = false } = {}) {
  const headers = { accept: 'application/json', 'idempotency-key': `"${key}"` };
  if (body !== null) headers['content-type'] = 'application/json';
  return request(path, { method, headers, keepalive, body: body === null ? undefined : raw ? body : JSON.stringify(body) });
}

// The contract's write ID, the request key's value: nw_ and 12 random characters of its base 32. The caller keeps a
// key only after a timeout or a lost connection, so that a retry that reaches a write that went through gets its
// first answer, and makes a new one when its input changes or after any answer.
const BASE32 = '0123456789abcdefghjkmnpqrstvwxyz';

export function newRequestKey() {
  // 256 is a multiple of 32, so each character is equally likely.
  return `nw_${Array.from(crypto.getRandomValues(new Uint8Array(12)), (byte) => BASE32[byte % 32]).join('')}`;
}

async function request(path, init) {
  let response;
  try {
    // redirect: 'manual', since a redirect is the gate's (NEXUS never redirects a request), and following it to the
    // gate's sign-in fails as a cross-site request anyway.
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
  } catch (error) {
    return { failure: error?.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    if (error?.name === 'TimeoutError') return { failure: 'timeout' };
  }
  return outcomeOf(response.type, response.status, body);
}

// The outcome of an answer of the type (Response.type), the status and the parsed body (null when it was not JSON).
export function outcomeOf(type, status, body) {
  if (type === 'opaqueredirect' || (status >= 300 && status < 400)) return { failure: 'gate' };
  const object = typeof body === 'object' && body !== null && !Array.isArray(body);
  if (status >= 200 && status < 300) return object ? { status, body } : { failure: 'answer' };
  return {
    status,
    code: object && typeof body.code === 'string' ? body.code : null,
    traceId: object && typeof body.traceId === 'string' ? body.traceId : null,
  };
}

// The status of a page that an operation serves rather than JSON, such as a stage-09 mockup page (API-293), read
// before a frame shows it (TASK-458). A success is { status, body: null }: its body is left unread, since the frame
// loads the page itself. Any other answer is the outcome outcomeOf gives, its Problem read as a read's is.
export async function probe(path) {
  let response;
  try {
    response = await fetch(path, {
      headers: { accept: 'text/html, application/problem+json' },
      credentials: 'same-origin',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(READ_TIMEOUT_MS),
    });
  } catch (error) {
    return { failure: error?.name === 'TimeoutError' ? 'timeout' : 'network' };
  }
  if (response.type !== 'opaqueredirect' && response.status >= 200 && response.status < 300) {
    try {
      await response.body?.cancel();
    } catch {
      // A body that cannot be cancelled is left to the browser.
    }
    return { status: response.status, body: null };
  }
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    if (error?.name === 'TimeoutError') return { failure: 'timeout' };
  }
  return outcomeOf(response.type, response.status, body);
}
