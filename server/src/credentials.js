// Agent credentials (SPEC-049, SPEC-050, TASK-417): the owner issues, lists and revokes them (API-279, API-280,
// API-281), and admission checks the pair an agent sends on every agent request (see admission.js).
//
// A credential is a row of TBL-146 agent_credentials. Its ID, ac_ and 12 characters, is its row's key (see ids.js),
// and the agent sends it as Nexus-Agent-Client-Id or CF-Access-Client-Id. Its secret is 32 random bytes in base64url,
// 43 characters, sent as Nexus-Agent-Client-Secret or CF-Access-Client-Secret, paired with its ID. The secret is in
// API-280's first answer only: the store keeps its SHA-256 in
// hex as secret_digest (REQ-078), and a repeat of the request answers secret null. 32 random bytes cannot be guessed
// back from their digest, so a plain digest is enough, and a slow one such as scrypt would only slow every agent
// request. No answer and no log line holds a secret or a digest (rule 5).
//
// A credential is never deleted, only revoked: its name stays taken, and its next request gets access_missing. Revoking
// releases its live claims (TBL-167), so its work is not held.

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { idOf, keyOf } from './ids.js';
import { LIMITS } from './limits.js';
import { invalidRequest, Problem } from './problem.js';

const PREFIX = 'ac';
// The contract's CredentialId.
const ID = /^ac_[0-9a-hjkmnp-tv-z]{12}$/;
const SECRET_BYTES = 32;
// The contract's IssuedCredential.secret: 32 bytes in base64url without padding.
const SECRET = /^[A-Za-z0-9_-]{43}$/;
// CredentialList's maxItems.
const LISTED = 500;
// last_used_at is written at most once a minute per credential, so that a busy agent does not write the store on
// every request.
const USED_EVERY_MS = 60_000;
// What a digest is compared with when the ID names no credential, so that an unknown ID takes as long as a wrong secret.
const NO_DIGEST = Buffer.alloc(32);

// The statements of each store, prepared on first use. Handlers and admission reach the store they are given, which a
// test can wrap (see test/tables.js).
const prepared = new WeakMap();

function statementsOf(store) {
  let statements = prepared.get(store);
  if (statements === undefined) {
    statements = {
      byKey: store.prepare('SELECT id, name, secret_digest, issued_at, revoked_at, last_used_at FROM agent_credentials WHERE id = ?'),
      byName: store.prepare('SELECT id FROM agent_credentials WHERE name = ?'),
      // Live credentials first, so that the list's limit never leaves one out while fewer than 500 are live; then the
      // newest first.
      list: store.prepare(
        'SELECT id, name, issued_at, revoked_at, last_used_at FROM agent_credentials ORDER BY revoked_at IS NOT NULL, id DESC LIMIT ?',
      ),
      insert: store.prepare('INSERT INTO agent_credentials (name, secret_digest, issued_at) VALUES (?, ?, ?)'),
      revoke: store.prepare('UPDATE agent_credentials SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL'),
      release: store.prepare(
        "UPDATE claims SET released_at = ?, release_reason = 'revoked' WHERE credential_id = ? AND released_at IS NULL",
      ),
      used: store.prepare(
        'UPDATE agent_credentials SET last_used_at = ? WHERE id = ? AND revoked_at IS NULL AND (last_used_at IS NULL OR last_used_at <= ?)',
      ),
    };
    prepared.set(store, statements);
  }
  return statements;
}

// The SHA-256 of a secret, as the store keeps it.
function digestOf(secret) {
  return createHash('sha256').update(secret, 'utf8').digest();
}

// A row as the contract's Credential: never its digest.
function shown(row) {
  return {
    id: idOf(PREFIX, Number(row.id)),
    name: row.name,
    issued_at: row.issued_at,
    revoked_at: row.revoked_at,
    last_used_at: row.last_used_at,
  };
}

const timeOf = (now) => new Date(now()).toISOString();

// The credential named by exactly one complete NEXUS or legacy header pair: { credential } with its id, key
// and name when the pair is a live credential's, or { reason } when it is not. The reason goes to the log only: the
// answer is access_missing whatever it is, so a caller learns nothing about which (rule 8, the contract's
// access_missing). no_credential: no credential headers; malformed: a missing, mixed, duplicate or invalid header; unknown_credential:
// no credential has the ID; wrong_secret; revoked.
export function checkCredential(store, headers) {
  const legacyId = headers['cf-access-client-id'];
  const legacySecret = headers['cf-access-client-secret'];
  const nexusId = headers['nexus-agent-client-id'];
  const nexusSecret = headers['nexus-agent-client-secret'];
  const hasLegacy = legacyId !== undefined || legacySecret !== undefined;
  const hasNexus = nexusId !== undefined || nexusSecret !== undefined;
  if (!hasLegacy && !hasNexus) return { reason: 'no_credential' };
  if (hasLegacy && hasNexus) return { reason: 'malformed' };
  const id = hasLegacy ? legacyId : nexusId;
  const secret = hasLegacy ? legacySecret : nexusSecret;
  // A header sent twice reaches Node as one value joined by a comma, which is in no form.
  if (typeof id !== 'string' || !ID.test(id) || typeof secret !== 'string' || !SECRET.test(secret)) {
    return { reason: 'malformed' };
  }
  // An ID in its form may name no key the store can hold; it names no credential then.
  const key = keyOf(PREFIX, id);
  const row = key === null ? undefined : statementsOf(store).byKey.get(key);
  const stored = row === undefined ? NO_DIGEST : Buffer.from(row.secret_digest, 'hex');
  const presented = digestOf(secret);
  const matches = stored.length === presented.length && timingSafeEqual(stored, presented);
  if (row === undefined) return { reason: 'unknown_credential' };
  if (!matches) return { reason: 'wrong_secret' };
  if (row.revoked_at !== null) return { reason: 'revoked' };
  return { credential: Object.freeze({ id, key, name: row.name }) };
}

// Whether the credential with this key is still live, for a write that waited behind its revocation (rule 4).
export function isLive(store, key) {
  const row = statementsOf(store).byKey.get(key);
  return row !== undefined && row.revoked_at === null;
}

// Notes that a live credential was used now: last_used_at, at most once a minute.
export function markUsed(store, key, now) {
  const at = now();
  statementsOf(store).used.run(new Date(at).toISOString(), key, new Date(at - USED_EVERY_MS).toISOString());
}

// API-279: the credentials, names and times only.
function listCredentials({ store }) {
  return { body: { credentials: statementsOf(store).list.all(LISTED).map(shown) } };
}

// API-280: a new credential with the owner's name for it, and its secret, shown this once.
function issueCredential({ store, body, now }) {
  const name = nameOf(body);
  const statements = statementsOf(store);
  if (statements.byName.get(name) !== undefined) throw new Problem('name_taken');
  const secret = randomBytes(SECRET_BYTES).toString('base64url');
  const issuedAt = timeOf(now);
  const { lastInsertRowid } = statements.insert.run(name, digestOf(secret).toString('hex'), issuedAt);
  const credential = shown({ id: lastInsertRowid, name, issued_at: issuedAt, revoked_at: null, last_used_at: null });
  return { status: 201, body: { credential, secret } };
}

// The name of NewCredential: text of 1 to 64 characters that is not only white space. A refusal names the field, never
// the value.
function nameOf(body) {
  if (Object.keys(body).some((field) => field !== 'name')) throw invalidRequest('body', 'the body takes name only');
  if (!Object.hasOwn(body, 'name')) throw invalidRequest('name', 'name is required');
  const { name } = body;
  if (typeof name !== 'string') throw invalidRequest('name', 'name must be text');
  // A lone surrogate cannot be stored as UTF-8: the store would keep another name than the one given.
  if (!name.isWellFormed()) throw invalidRequest('name', 'name must be Unicode text');
  if (!/\S/u.test(name)) throw invalidRequest('name', 'name must not be empty');
  const limit = LIMITS.credentialNameCharacters;
  if ([...name].length > limit) throw invalidRequest('name', `name must be at most ${limit} characters`);
  return name;
}

// API-281: marks the credential revoked and releases its live claims, in one transaction. Revoked again, it changes
// nothing (SPEC-050, "the same result"): changed false and no claim released. None can be live then: the revoke
// released them all, and a write of the credential's that waited behind it is refused (rule 4, see admission.js).
function revokeCredential({ store, params, body, now }) {
  if (Object.keys(body).length > 0) throw invalidRequest('body', 'the body is the empty object {}');
  const statements = statementsOf(store);
  const key = keyOf(PREFIX, params.credential);
  const row = key === null ? undefined : statements.byKey.get(key);
  if (row === undefined) throw new Problem('credential_not_found');
  if (row.revoked_at !== null) return { body: { credential: shown(row), changed: false, claims_released: 0 } };
  const at = timeOf(now);
  statements.revoke.run(at, key);
  const released = Number(statements.release.run(at, key).changes);
  return { body: { credential: shown({ ...row, revoked_at: at }), changed: true, claims_released: released } };
}

// The routes of API-279, API-280 and API-281 (see router.js), all of the owner family.
export const CREDENTIAL_ROUTES = Object.freeze([
  { method: 'GET', path: '/api/credentials', action: 'listCredentials', handle: listCredentials },
  {
    method: 'POST',
    path: '/api/credentials',
    action: 'issueCredential',
    body: 'json',
    requestKey: true,
    handle: issueCredential,
    // The secret is never kept, not even with the request key: a repeat answers 200 and secret null.
    repeat: ({ body }) => ({ status: 200, body: { ...body, secret: null } }),
  },
  {
    method: 'POST',
    path: '/api/credentials/{credential}/revoke',
    action: 'revokeCredential',
    params: { credential: 'credential_not_found' },
    body: 'json',
    requestKey: true,
    handle: revokeCredential,
  },
]);
