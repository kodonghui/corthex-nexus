// The operations the server takes: the routes of router.js that main.js serves. Each task that builds operations of
// api/openapi.yaml adds its routes here, and test/tables.test.js checks that each one's tests compare the tables it
// touches with the contract (note 23 of the WBS).

import { CLAIM_ROUTES } from './claims.js';
import { COMMENT_ROUTES } from './comments.js';
import { CREDENTIAL_ROUTES } from './credentials.js';
import { MOCKUP_PAGE_ROUTES } from './mockup-page.js';
import { OWNER_ROUTES } from './owner.js';
import { PROJECT_ROUTES } from './project.js';
import { REMOVAL_ROUTES } from './removal.js';
import { SNAPSHOT_ROUTES } from './snapshots.js';
import { TODO_ROUTES } from './todo.js';

export const ROUTES = Object.freeze([
  // TASK-417: API-279, API-280 and API-281.
  ...CREDENTIAL_ROUTES,
  // TASK-418: API-242 and API-243.
  ...SNAPSHOT_ROUTES,
  // TASK-433: API-245.
  ...TODO_ROUTES,
  // TASK-440: API-264.
  ...PROJECT_ROUTES,
  // TASK-434: API-250 and API-251.
  ...CLAIM_ROUTES,
  // TASK-439: API-262 and API-263.
  ...OWNER_ROUTES,
  // TASK-437: API-252, API-253, API-254 and API-255.
  ...COMMENT_ROUTES,
  // TASK-448: API-277 and API-278.
  ...REMOVAL_ROUTES,
  // TASK-427: API-293.
  ...MOCKUP_PAGE_ROUTES,
]);
