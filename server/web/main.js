// The page's start: the screen its address names, run in the shell.

import { parseAddress } from './address.js';
import { MISSING, SCREENS } from './screens.js';
import { startShell } from './shell.js';

const address = parseAddress(globalThis.location.pathname, globalThis.location.search);
startShell(document.getElementById('app'), address === null ? MISSING : SCREENS[address.screen], address ?? {});
