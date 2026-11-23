// The server's settings, read from the environment once at start.
//
// An invalid value stops the server with the name of the setting and the rule it breaks, never the value, since a
// value set by mistake can be a secret (rule 5).

import { isIP } from 'node:net';
import { posix, resolve, win32 } from 'node:path';

const DEFAULTS = Object.freeze({
  // The gate's tunnel reaches the server on the same machine, so it listens on loopback unless told otherwise.
  NEXUS_HOST: '127.0.0.1',
  NEXUS_PORT: '8787',
  // The data folder has no default: the operator names it, so the server never makes its store in a folder it
  // guessed (SPEC-015).
  NEXUS_DATA_DIR: '',
  // The gate's sign-in has no default either: without them no owner could be admitted (SPEC-048).
  NEXUS_ACCESS_ISSUER: '',
  NEXUS_ACCESS_AUD: '',
  NEXUS_OWNER_EMAIL: '',
});
// Access names each application by a 64-hex-digit audience tag.
const AUDIENCE = /^[0-9a-f]{64}$/;
// One address of the one owner, as the gate's sign-in carries it.
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
// A domain name, never an IP address, whose last label is letters.
const HOST_NAME = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export class SettingsError extends Error {
  constructor(setting, rule) {
    super(`${setting} ${rule}`);
    this.name = 'SettingsError';
    this.setting = setting;
    this.rule = rule;
  }
}

export function readSettings(env = process.env) {
  const host = valueOf(env, 'NEXUS_HOST');
  if (host !== 'localhost' && isIP(host) === 0) {
    throw new SettingsError('NEXUS_HOST', 'must be an IP address or localhost');
  }
  const port = valueOf(env, 'NEXUS_PORT');
  // 0 lets the system choose a free port, which the start line names.
  if (!/^[0-9]{1,5}$/.test(port) || Number(port) > 65535) {
    throw new SettingsError('NEXUS_PORT', 'must be a whole number from 0 to 65535');
  }
  // The folder of the store, nexus-v3.sqlite (see store.js). An absolute path, so it does not depend on the folder
  // the server is started from.
  const dataDirectory = valueOf(env, 'NEXUS_DATA_DIR');
  if (dataDirectory === '' || dataDirectory.includes('\u0000') || !fullyAbsolute(dataDirectory)) {
    throw new SettingsError('NEXUS_DATA_DIR', 'must be set to an absolute folder path');
  }
  // The gate's sign-in (gate.js): the issuer its tokens name and whose certs endpoint lists its keys, the audience tag
  // of the NEXUS application, and the owner it admits.
  const issuer = issuerOf(valueOf(env, 'NEXUS_ACCESS_ISSUER'));
  if (issuer === null) {
    throw new SettingsError('NEXUS_ACCESS_ISSUER', 'must be the gate\'s https team address, with no path');
  }
  const audience = valueOf(env, 'NEXUS_ACCESS_AUD');
  if (!AUDIENCE.test(audience)) {
    throw new SettingsError('NEXUS_ACCESS_AUD', 'must be the application\'s audience tag, 64 lowercase hex digits');
  }
  const owner = valueOf(env, 'NEXUS_OWNER_EMAIL');
  if (!EMAIL.test(owner)) throw new SettingsError('NEXUS_OWNER_EMAIL', 'must be the owner\'s email address');
  return Object.freeze({
    host,
    port: Number(port),
    dataDirectory: resolve(dataDirectory),
    gate: Object.freeze({ issuer, audience, owner: owner.toLowerCase() }),
  });
}

// The origin of an https address with no path, query, user or port, such as https://team.cloudflareaccess.com, as
// the gate's tokens name it; otherwise null.
function issuerOf(value) {
  if (/\s/.test(value)) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const plain = url.protocol === 'https:' && url.username === '' && url.password === '' && url.port === ''
    && url.pathname === '/' && url.search === '' && url.hash === '' && HOST_NAME.test(url.hostname);
  return plain ? url.origin : null;
}

// An absolute path that names its drive too: on Windows, \data and /data are absolute but take the drive of the
// folder the server starts from, so they need a drive letter or a UNC share.
export function fullyAbsolute(path, platform = process.platform) {
  const paths = platform === 'win32' ? win32 : posix;
  return paths.isAbsolute(path) && (platform !== 'win32' || paths.parse(path).root.length > 1);
}

function valueOf(env, name) {
  const value = env[name];
  return value === undefined || value === '' ? DEFAULTS[name] : value;
}
