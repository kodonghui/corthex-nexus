// The gate's sign-in: the JWT that Cloudflare Access signs for the owner and sends in Cf-Access-Jwt-Assertion,
// verified with Node's own node:crypto (SPEC-048). The contract's ownerSignIn names the checks: the signature, by a
// key of the team's certs endpoint, the audience and the issuer, from the settings, and the expiry.
//
// Nothing here logs or keeps a token or a claim. A check that fails throws SignInError with a reason of the server's
// own words, which the log may name (rule 5, rule 8).

import { createPublicKey, verify } from 'node:crypto';
import { performance } from 'node:perf_hooks';

// Where Access publishes the team's signing keys, under the issuer.
export const CERTS_PATH = '/cdn-cgi/access/certs';
// A sign-in longer than this is refused before it is decoded.
const TOKEN_CHARACTERS = 8192;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
// A key is read again after an hour, and the certs endpoint is asked at most once in this gap, so a token with a kid
// the server does not know, or an endpoint that fails, cannot make it ask on every request.
const KEYS_MAX_AGE_MS = 60 * 60 * 1000;
const FETCH_GAP_MS = 10 * 1000;
const FETCH_TIMEOUT_MS = 5 * 1000;
const CERTS_BYTES = 64 * 1024;
// The server's clock may run behind the gate's.
const NOT_BEFORE_LEEWAY_S = 60;
const MIN_MODULUS_BITS = 2048;

// Why a sign-in was not admitted: no_sign_in, malformed, unknown_key, bad_signature, wrong_issuer, wrong_audience,
// expired or not_yet_valid.
export class SignInError extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'SignInError';
    this.reason = reason;
  }
}

// The keys could not be read, so no sign-in can be checked: a fault of the server, not of the request. code is a
// system or Node code when the fetch failed with one, which the log's errorKind names.
export class GateKeysError extends Error {
  constructor(code) {
    super('the gate\'s signing keys could not be read');
    this.name = 'GateKeysError';
    if (code !== undefined) this.code = code;
  }
}

// The gate: { issuer, audience, owner } from the settings, and the keys that sign its tokens.
export function createGate({ issuer, audience, owner, keys = createGateKeys({ issuer }), now = Date.now }) {
  const ownerEmail = owner.toLowerCase();
  return Object.freeze({
    // The verified claims of a request's sign-in, or SignInError; GateKeysError when the keys cannot be read.
    signIn: (headers) => verifySignIn(headers['cf-access-jwt-assertion'], { issuer, audience, keys, now }),
    // Whether verified claims are the one owner's: the email the gate checked, matched without case.
    isOwner: (claims) => typeof claims.email === 'string' && claims.email.toLowerCase() === ownerEmail,
  });
}

export async function verifySignIn(token, { issuer, audience, keys, now = Date.now }) {
  if (token === undefined || token === '') throw new SignInError('no_sign_in');
  if (typeof token !== 'string' || token.length > TOKEN_CHARACTERS) throw new SignInError('malformed');
  const parts = token.split('.');
  if (parts.length !== 3 || !parts.every((part) => BASE64URL.test(part))) throw new SignInError('malformed');
  const header = jsonPart(parts[0]);
  const claims = jsonPart(parts[1]);
  // Access signs with RS256 and names its key. No other algorithm is taken, so a token cannot choose a weaker one.
  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid === '' || header.crit !== undefined) {
    throw new SignInError('malformed');
  }

  const key = await keys.key(header.kid);
  if (key === null) throw new SignInError('unknown_key');
  let valid;
  try {
    valid = verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), key, Buffer.from(parts[2], 'base64url'));
  } catch {
    valid = false;
  }
  if (!valid) throw new SignInError('bad_signature');

  // The claims are read only once the gate's signature holds.
  if (claims.iss !== issuer) throw new SignInError('wrong_issuer');
  const audiences = typeof claims.aud === 'string' ? [claims.aud] : Array.isArray(claims.aud) ? claims.aud : [];
  if (!audiences.includes(audience)) throw new SignInError('wrong_audience');
  const seconds = now() / 1000;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) throw new SignInError('malformed');
  if (claims.exp <= seconds) throw new SignInError('expired');
  if (claims.nbf !== undefined) {
    if (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf)) throw new SignInError('malformed');
    if (claims.nbf > seconds + NOT_BEFORE_LEEWAY_S) throw new SignInError('not_yet_valid');
  }
  return claims;
}

function jsonPart(part) {
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(part, 'base64url')));
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value;
  } catch {
    // Refused below.
  }
  throw new SignInError('malformed');
}

// The team's signing keys from its certs endpoint, kept for an hour. key(kid) answers the public key of that kid, or
// null when the endpoint does not list it; it throws GateKeysError when no current keys can be read. The hour and the
// gap are measured on a monotonic clock, so a step of the system's clock neither keeps old keys nor stops a fetch.
export function createGateKeys({ issuer, fetch = globalThis.fetch, now = () => performance.now() }) {
  const url = `${issuer}${CERTS_PATH}`;
  let keys = null;
  let fetchedAt = 0;
  let startedAt = -Infinity;
  let pending = null;
  // The error of the last fetch while it is the last word on the keys, otherwise null.
  let failure = null;

  const fresh = () => keys !== null && now() - fetchedAt < KEYS_MAX_AGE_MS;

  function refresh() {
    if (pending === null) {
      startedAt = now();
      pending = readKeys(url, fetch)
        .then((read) => {
          keys = read;
          fetchedAt = now();
          failure = null;
        }, (error) => {
          // Whatever failed, the keys could not be read, which the log names as keys_unavailable.
          failure = error instanceof GateKeysError ? error : new GateKeysError();
        })
        .finally(() => {
          pending = null;
        });
    }
    return pending;
  }

  return Object.freeze({
    async key(kid) {
      // A kid of current keys is answered at once, even while a fetch for another kid runs or the endpoint fails.
      if (fresh() && keys.has(kid)) return keys.get(kid);
      if (pending !== null || now() - startedAt >= FETCH_GAP_MS) await refresh();
      // A kid the endpoint could not be asked about is not unknown: the keys are unavailable, a fault of the server's,
      // so the owner is not sent back to the gate for a sign-in it would sign with the same key.
      if (failure !== null) throw failure;
      if (!fresh()) throw new GateKeysError();
      return keys.get(kid) ?? null;
    },
  });
}

async function readKeys(url, fetch) {
  let response;
  try {
    response = await fetch(url, {
      redirect: 'error',
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    // fetch names the system's code on its cause, such as ENOTFOUND or ECONNREFUSED.
    const code = error?.cause?.code ?? error?.code;
    throw new GateKeysError(typeof code === 'string' ? code : undefined);
  }
  if (response.status !== 200) {
    // A body that fails as it is dropped, such as one the time limit ends, is the same failure.
    await response.body?.cancel().catch(() => {});
    throw new GateKeysError();
  }
  let document;
  try {
    document = JSON.parse(await textOf(response));
  } catch {
    throw new GateKeysError();
  }
  if (document === null || typeof document !== 'object' || !Array.isArray(document.keys)) throw new GateKeysError();
  const keys = new Map();
  for (const jwk of document.keys) {
    if (jwk === null || typeof jwk !== 'object' || typeof jwk.kid !== 'string' || jwk.kid === '') continue;
    if (jwk.kty !== 'RSA' || (jwk.alg !== undefined && jwk.alg !== 'RS256') || (jwk.use !== undefined && jwk.use !== 'sig')) continue;
    let key;
    try {
      // Only the public members are read, even from an endpoint that sends more.
      key = createPublicKey({ key: { kty: 'RSA', n: jwk.n, e: jwk.e }, format: 'jwk' });
    } catch {
      continue;
    }
    if (key.asymmetricKeyDetails.modulusLength < MIN_MODULUS_BITS) continue;
    // Two usable keys with one kid would leave the token to choose; the whole set is refused.
    if (keys.has(jwk.kid)) throw new GateKeysError();
    keys.set(jwk.kid, key);
  }
  if (keys.size === 0) throw new GateKeysError();
  return keys;
}

// The body as text, refused past CERTS_BYTES.
async function textOf(response) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength;
    if (size > CERTS_BYTES) throw new Error('the certs answer is too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}
