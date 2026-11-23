// Shared by the tests: a server on a free loopback port whose log lines are kept, and a plain HTTP client.
// node --test also runs this file, which holds no test.

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createNexusServer } from '../src/app.js';
import { jsonLines } from '../src/log.js';

export const TRACE_ID = /^[0-9a-f]{16}(?:-[A-Z]{3})?$/;

export async function startServer({ routes = [] } = {}) {
  const text = [];
  const stream = { write: (chunk) => text.push(chunk) };
  const settings = Object.freeze({ host: '127.0.0.1', port: 0 });
  const server = createNexusServer({ settings, routes, log: jsonLines(stream) });
  server.listen(settings.port, settings.host);
  await once(server, 'listening');
  const { port } = server.address();
  return {
    // Every character the server wrote to its log.
    logText: () => text.join(''),
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
        const text = Buffer.concat(chunks).toString('utf8');
        let json;
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
        resolve({ status: response.statusCode, headers: response.headers, rawHeaders: response.rawHeaders, text, json });
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
