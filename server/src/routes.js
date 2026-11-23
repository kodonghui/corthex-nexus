// The operations the server takes: the routes of router.js that main.js serves. Each task that builds operations of
// api/openapi.yaml adds its routes here, and test/tables.test.js checks that each one's tests compare the tables it
// touches with the contract (note 23 of the WBS).

import { CREDENTIAL_ROUTES } from './credentials.js';
import { SNAPSHOT_ROUTES } from './snapshots.js';

export const ROUTES = Object.freeze([
  // TASK-417: API-279, API-280 and API-281.
  ...CREDENTIAL_ROUTES,
  // TASK-418: API-242 and API-243.
  ...SNAPSHOT_ROUTES,
]);
