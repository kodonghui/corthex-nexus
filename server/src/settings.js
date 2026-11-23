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
  // The backups' folder has no default either: the operator names where the daily backups are kept (SPEC-052).
  NEXUS_BACKUP_DIR: '',
  // When the day's backup runs, as HH:MM in UTC. This default is an example; the deploy (TASK-464) sets the real time.
  NEXUS_BACKUP_TIME: '03:00',
});
// Access names each application by a 64-hex-digit audience tag.
const AUDIENCE = /^[0-9a-f]{64}$/;
// One address of the one owner, as the gate's sign-in carries it.
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}$/;
// A time of day, HH:MM from 00:00 to 23:59.
const TIME_OF_DAY = /^([01][0-9]|2[0-3]):([0-5][0-9])$/;
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
  const { dataDirectory, backup } = readStoreSettings(env);
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
    dataDirectory,
    backup,
    gate: Object.freeze({ issuer, audience, owner: owner.toLowerCase() }),
  });
}

// The settings of the store and its backups, which the server and the restore rehearsal (rehearse.js) both read:
// { dataDirectory, backup: { directory, hour, minute } }.
export function readStoreSettings(env = process.env) {
  // The folder of the store, nexus-v3.sqlite (see store.js). An absolute path, so it does not depend on the folder
  // the server is started from.
  const dataDirectory = absoluteFolder(env, 'NEXUS_DATA_DIR');
  // The folder of the daily backups (backups.js), kept beside the server (SPEC-052).
  const directory = absoluteFolder(env, 'NEXUS_BACKUP_DIR');
  const time = TIME_OF_DAY.exec(valueOf(env, 'NEXUS_BACKUP_TIME'));
  if (time === null) throw new SettingsError('NEXUS_BACKUP_TIME', 'must be a time of day in UTC, HH:MM from 00:00 to 23:59');
  return Object.freeze({
    dataDirectory,
    backup: Object.freeze({ directory, hour: Number(time[1]), minute: Number(time[2]) }),
  });
}

function absoluteFolder(env, name) {
  const value = valueOf(env, name);
  if (value === '' || value.includes('\u0000') || !fullyAbsolute(value)) {
    throw new SettingsError(name, 'must be set to an absolute folder path');
  }
  return resolve(value);
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
