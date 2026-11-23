// Shared by the tests: a server on a free loopback port whose log lines are kept, a plain HTTP client, a raw one,
// data folders and stores that are removed after each test, and a gate with a local signing key. node --test also
// runs this file, which holds no test.

import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createNexusServer } from '../src/app.js';
import { createGate } from '../src/gate.js';
import { jsonLines } from '../src/log.js';
import { openStore } from '../src/store.js';

export const TRACE_ID = /^[0-9a-f]{16}(?:-[A-Z]{3})?$/;

// The 32 characters of the contract's IDs, [0-9a-hjkmnp-tv-z].
const ID_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz';

// A new ID of the contract's form with its prefix, such as nw for a write ID or ac for an agent credential. Tests make
// them at run time, so that no literal in the history reads as a key to the secret scan.
export function newId(prefix) {
  return `${prefix}_${Array.from(randomBytes(12), (byte) => ID_ALPHABET[byte % ID_ALPHABET.length]).join('')}`;
}

// A new data folder for one test, removed after it.
export function dataFolder(t, prefix = 'nexus-test-') {
  const folder = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(folder, { recursive: true, force: true, maxRetries: 5 }));
  return folder;
}

// A new store in its own data folder, closed and removed after the test.
export function testStore(t) {
  const folder = mkdtempSync(join(tmpdir(), 'nexus-store-'));
  const { db } = openStore(folder);
  t.after(() => {
    db.close();
    rmSync(folder, { recursive: true, force: true, maxRetries: 5 });
  });
  return db;
}

// gate and now are createApp's (see app.js): owner operations need a gate, such as localGate's.
export async function startServer({ routes = [], store = null, gate = null, now, pages = null } = {}) {
  const text = [];
  const stream = { write: (chunk) => text.push(chunk) };
  const settings = Object.freeze({ host: '127.0.0.1', port: 0 });
  const server = createNexusServer({ settings, routes, log: jsonLines(stream), store, gate, now, pages });
  server.listen(settings.port, settings.host);
  await once(server, 'listening');
  const { port } = server.address();
  return {
    // Every character the server wrote to its log.
    logText: () => text.join(''),
    port,
    send: (options) => send(port, options),
    // The parsed log lines, once there are at least count of them.
    async logged(count) {
      await waitFor(() => text.join('').split('\n').filter(Boolean).length >= count);
      return text.join('').split('\n').filter(Boolean).map((line) => JSON.parse(line));
    },
    close: () => new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    }),
  };
}

export function send(port, { method = 'GET', path = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const request = httpRequest({ host: '127.0.0.1', port, method, path, headers, agent: false }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const bytes = Buffer.concat(chunks);
        const text = bytes.toString('utf8');
        resolve({ status: response.statusCode, headers: response.headers, rawHeaders: response.rawHeaders, bytes, text, json: parsed(text) });
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    // A server that never answers fails the test instead of holding it.
    request.setTimeout(5000, () => request.destroy(new Error('no answer within 5 seconds')));
    if (body !== undefined) request.write(body);
    request.end();
  });
}

const CRLF = '\r\n';

// Writes raw bytes to a server and reads its answers until it closes the connection or waitMs passes, for what the
// HTTP client cannot do, such as declaring a body it never sends. Returns { answers, closed, ms }: each answer as
// { status, headers, text, json }, whether the server closed the connection, and how long that took.
export function exchange(port, chunks, { waitMs = 3000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect(port, '127.0.0.1');
    const received = [];
    let timer;
    const finish = (closed) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({ answers: answersIn(Buffer.concat(received)), closed, ms: Date.now() - started });
    };
    timer = setTimeout(() => finish(false), waitMs);
    socket.on('data', (chunk) => received.push(chunk));
    // A reset after the answer is a close too; the answers read before it are kept.
    socket.on('error', () => {});
    socket.on('close', () => finish(true));
    for (const chunk of chunks) socket.write(chunk);
  });
}

// The head of a raw request: its request line and headers, then the empty line.
export function head(method, path, headers) {
  return [`${method} ${path} HTTP/1.1`, 'Host: 127.0.0.1', ...Object.entries(headers).map(([name, value]) => `${name}: ${value}`), '', '']
    .join(CRLF);
}

function answersIn(bytes) {
  const answers = [];
  let rest = bytes;
  while (rest.length > 0) {
    const end = rest.indexOf(CRLF + CRLF);
    if (end === -1) break;
    const [statusLine, ...lines] = rest.subarray(0, end).toString('latin1').split(CRLF);
    const headers = Object.fromEntries(lines.map((line) => {
      const colon = line.indexOf(':');
      return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
    }));
    const length = Number(headers['content-length'] ?? 0);
    const text = rest.subarray(end + 4, end + 4 + length).toString('utf8');
    answers.push({ status: Number(statusLine.split(' ')[1]), headers, text, json: parsed(text) });
    rest = rest.subarray(end + 4 + length);
  }
  return answers;
}

function parsed(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

export async function waitFor(condition, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > until) throw new Error('timed out waiting');
    await delay(10);
  }
}

const base64url = (value) => Buffer.from(value).toString('base64url');

// What rule 5 keeps out of the log, each in the forms it could take there. The values are made at run time, so
// that no secret-like text is written into the repository.
export function forbiddenValues(serverPaths) {
  const secret = randomBytes(24).toString('base64url');
  const digest = createHash('sha256').update(secret).digest();
  const signInToken = [
    base64url(JSON.stringify({ alg: 'RS256', kid: randomUUID() })),
    base64url(JSON.stringify({ aud: [randomUUID()], sub: randomUUID(), exp: 4102444800 })),
    randomBytes(64).toString('base64url'),
  ].join('.');
  const refusedText = `refused file text ${randomUUID()}`;
  const values = {
    secret,
    digestHex: digest.toString('hex'),
    digestBase64: digest.toString('base64'),
    digestBase64url: digest.toString('base64url'),
    signInToken,
    refusedText,
  };
  for (const [index, path] of serverPaths.entries()) {
    const trimmed = path.replace(/[\\/]+$/, '');
    values[`serverPath${index}`] = trimmed;
    values[`serverPath${index}Slashed`] = trimmed.replaceAll('\\', '/');
    // How JSON writes a path with backslashes.
    values[`serverPath${index}Escaped`] = JSON.stringify(trimmed).slice(1, -1);
  }
  return values;
}

export function assertNoneIn(text, values) {
  for (const [name, value] of Object.entries(values)) {
    assert.ok(value.length >= 8, `${name} is too short to search for`);
    assert.equal(text.includes(value), false, `the log holds the ${name}`);
  }
}

// The gate's settings in the tests. Placeholders: no test reaches a gate or the network.
export const ISSUER = 'https://gate.example.com';
export const OWNER_EMAIL = 'owner@example.com';

// A gate whose key pair is made here, as Access signs its sign-ins: RS256 with a key the certs endpoint names by its
// kid. token(claims, header) signs the owner's sign-in with claims laid over it; a claim set to undefined is left out.
export function localGate({ now } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const kid = randomBytes(32).toString('hex');
  const audience = randomBytes(32).toString('hex');
  const keys = { key: async (id) => (id === kid ? publicKey : null) };
  return {
    audience,
    kid,
    privateKey,
    publicKey,
    gate: createGate({ issuer: ISSUER, audience, owner: OWNER_EMAIL, keys, now }),
    token(claims = {}, header = {}) {
      const seconds = Math.floor(Date.now() / 1000);
      return signToken(privateKey, { alg: 'RS256', kid, typ: 'JWT', ...header }, {
        aud: [audience],
        email: OWNER_EMAIL,
        exp: seconds + 3600,
        iat: seconds,
        nbf: seconds,
        iss: ISSUER,
        type: 'app',
        identity_nonce: randomBytes(12).toString('base64url'),
        sub: randomUUID(),
        country: 'KR',
        ...claims,
      });
    },
    // The certs endpoint's answer for this gate's key.
    certs: () => ({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }] }),
  };
}

export function signToken(privateKey, header, claims) {
  const signed = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  return `${signed}.${sign('sha256', Buffer.from(signed), privateKey).toString('base64url')}`;
}
