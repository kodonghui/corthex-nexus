// The server's settings, read from the environment once at start.
//
// An invalid value stops the server with the name of the setting and the rule it breaks, never the value, since a
// value set by mistake can be a secret (rule 5).

import { isIP } from 'node:net';
import { isAbsolute, resolve } from 'node:path';

const DEFAULTS = Object.freeze({
  // The gate's tunnel reaches the server on the same machine, so it listens on loopback unless told otherwise.
  NEXUS_HOST: '127.0.0.1',
  NEXUS_PORT: '8787',
  // The data folder has no default: the operator names it, so the server never makes its store in a folder it
  // guessed (SPEC-015).
  NEXUS_DATA_DIR: '',
});

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
  if (dataDirectory === '' || dataDirectory.includes('\u0000') || !isAbsolute(dataDirectory)) {
    throw new SettingsError('NEXUS_DATA_DIR', 'must be set to an absolute folder path');
  }
  return Object.freeze({ host, port: Number(port), dataDirectory: resolve(dataDirectory) });
}

function valueOf(env, name) {
  const value = env[name];
  return value === undefined || value === '' ? DEFAULTS[name] : value;
}
