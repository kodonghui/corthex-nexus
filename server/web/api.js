// Reads of NEXUS's API from a page. A read returns an outcome, which states.js turns into a screen's state:
// - { status, body } for a success, body being its JSON object;
// - { status, code, traceId } for any other answer, from its Problem when it is one;
// - { failure } when no answer of NEXUS came: 'gate' when the gate redirected the read to its sign-in, 'timeout',
//   'network', or 'answer' for a success that is not a JSON object.
// The page holds nothing of a project before the API answers it, and keeps none of it after (see storage.js).

export const READ_TIMEOUT_MS = 30_000;

export async function read(path) {
  let response;
  try {
    // redirect: 'manual', since a redirect is the gate's (NEXUS never redirects a read), and following it to the
    // gate's sign-in fails as a cross-site read anyway.
    response = await fetch(path, {
      headers: { accept: 'application/json' },
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
